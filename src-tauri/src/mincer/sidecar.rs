// ffmpeg e yt-dlp como processos canceláveis, com prioridade abaixo do normal
// para não disputar CPU com o Monet.
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::watch;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

use super::{db, MincerProgressEvent, EVENT_PROGRESS};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const BELOW_NORMAL_PRIORITY_CLASS: u32 = 0x0000_4000;
const STDERR_TAIL_CHARS: usize = 800;

// O tauri-build copia o sidecar para junto do exe sem o triple no nome
// (target/debug em dev, pasta de instalação no NSIS).
pub(crate) fn resolve(name: &str) -> Result<PathBuf, String> {
    if let Some(dir) = std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf)) {
        let candidate = dir.join(format!("{}.exe", name));
        if candidate.exists() {
            return Ok(candidate);
        }
    }
    #[cfg(debug_assertions)]
    {
        let candidate = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(format!("{}-x86_64-pc-windows-msvc.exe", name));
        if candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(format!(
        "{} was not found next to Monet. Reinstall the app (dev: run npm run sidecars).",
        name
    ))
}

pub(crate) fn command(program: &Path) -> Command {
    let mut cmd = Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW | BELOW_NORMAL_PRIORITY_CLASS)
        .kill_on_drop(true)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    cmd
}

// Job Object com KILL_ON_JOB_CLOSE para cada processo: derrubar o ProcessJob
// mata o processo e todos os filhos (o yt-dlp é PyInstaller onefile e baixa
// num processo filho). O Windows fecha o handle se o Monet morrer (crash,
// saída pelo updater), então nada fica órfão.
pub(crate) struct ProcessJob(HANDLE);

// O HANDLE do job é só um identificador do kernel, válido em qualquer thread.
unsafe impl Send for ProcessJob {}

impl ProcessJob {
    fn attach(child: &tokio::process::Child) -> Result<Self, String> {
        let process = child.raw_handle().ok_or("the process already finished")?;
        unsafe {
            let job = ProcessJob(CreateJobObjectW(None, PCWSTR::null()).map_err(|e| e.to_string())?);
            let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            SetInformationJobObject(
                job.0,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
            .map_err(|e| e.to_string())?;
            AssignProcessToJobObject(job.0, HANDLE(process)).map_err(|e| e.to_string())?;
            Ok(job)
        }
    }
}

impl Drop for ProcessJob {
    fn drop(&mut self) {
        unsafe {
            let _ = TerminateJobObject(self.0, 1);
            let _ = CloseHandle(self.0);
        }
    }
}

pub(crate) enum JobError {
    Cancelled,
    Failed(String),
}

impl From<String> for JobError {
    fn from(message: String) -> Self {
        JobError::Failed(message)
    }
}

impl JobError {
    // Frase, linha em branco e o stderr como detalhe: o toast e o banner mostram
    // só a frase. A linha "ERROR:" do yt-dlp, quando existe, diz o motivo.
    pub(crate) fn context(self, prefix: &str) -> Self {
        match self {
            JobError::Failed(detail) => {
                let sentence = match error_reason(&detail) {
                    Some(reason) => format!("{}: {}", prefix, reason),
                    None => format!("{}.", prefix),
                };
                JobError::Failed(format!("{}\n\n{}", sentence, detail))
            }
            other => other,
        }
    }
}

// "ERROR: [youtube] <id>: Video unavailable" vira "Video unavailable".
fn error_reason(detail: &str) -> Option<String> {
    let line = detail
        .lines()
        .rev()
        .find_map(|l| l.trim().strip_prefix("ERROR:"))?
        .trim();
    let reason = match line.strip_prefix('[').and_then(|r| r.split_once("] ")) {
        Some((_, rest)) => rest
            .split_once(": ")
            .filter(|(id, _)| !id.contains(' '))
            .map_or(rest, |(_, r)| r),
        None => line,
    };
    let reason = reason.trim();
    (!reason.is_empty()).then(|| reason.to_string())
}

pub(crate) struct JobCtx {
    pub app: AppHandle,
    pub item_id: String,
    pub cancel: watch::Receiver<bool>,
    pub child_job: Arc<Mutex<Option<ProcessJob>>>,
}

impl JobCtx {
    pub(crate) fn progress(&self, stage: &str, current: i64, total: i64) {
        if let Err(e) = db::set_progress(&self.app, &self.item_id, stage, current, total) {
            eprintln!("mincer progress: {}", e);
        }
        let _ = self.app.emit(
            EVENT_PROGRESS,
            MincerProgressEvent {
                item_id: self.item_id.clone(),
                stage: stage.to_string(),
                current,
                total,
            },
        );
    }

    pub(crate) fn is_cancelled(&self) -> bool {
        *self.cancel.borrow()
    }

    pub(crate) async fn cancelled(&self) {
        let mut rx = self.cancel.clone();
        loop {
            if *rx.borrow_and_update() {
                return;
            }
            if rx.changed().await.is_err() {
                std::future::pending::<()>().await;
            }
        }
    }

    // Trocar ou limpar o job derruba o anterior, com a árvore de processos.
    fn set_job(&self, child: Option<&tokio::process::Child>) {
        let job = child.and_then(|c| {
            ProcessJob::attach(c)
                .map_err(|e| eprintln!("mincer job object: {}", e))
                .ok()
        });
        if let Ok(mut guard) = self.child_job.lock() {
            *guard = job;
        }
    }
}

fn stderr_tail(stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    let text = text.trim();
    let count = text.chars().count();
    if count <= STDERR_TAIL_CHARS {
        return text.to_string();
    }
    let tail: String = text.chars().skip(count - STDERR_TAIL_CHARS).collect();
    // Começa na próxima linha inteira.
    match tail.split_once('\n') {
        Some((_, rest)) if !rest.trim().is_empty() => rest.to_string(),
        _ => tail,
    }
}

pub(crate) async fn run(ctx: &JobCtx, mut cmd: Command) -> Result<std::process::Output, JobError> {
    if ctx.is_cancelled() {
        return Err(JobError::Cancelled);
    }
    let child = cmd
        .spawn()
        .map_err(|e| JobError::Failed(format!("Could not start the process: {}", e)))?;
    ctx.set_job(Some(&child));
    // Abandonar o select derruba o child; limpar o job mata os filhos dele.
    let result = tokio::select! {
        out = child.wait_with_output() => out.map_err(|e| JobError::Failed(e.to_string())),
        _ = ctx.cancelled() => Err(JobError::Cancelled),
    };
    ctx.set_job(None);
    let output = result?;
    if !output.status.success() {
        return Err(JobError::Failed(stderr_tail(&output.stderr)));
    }
    Ok(output)
}

pub(crate) async fn run_with_lines(
    ctx: &JobCtx,
    mut cmd: Command,
    mut on_line: impl FnMut(&str),
) -> Result<(), JobError> {
    if ctx.is_cancelled() {
        return Err(JobError::Cancelled);
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| JobError::Failed(format!("Could not start the process: {}", e)))?;
    ctx.set_job(Some(&child));
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let finished = {
        let work = async {
            let read_stdout = async {
                if let Some(out) = stdout {
                    let mut lines = BufReader::new(out).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        on_line(&line);
                    }
                }
            };
            // stderr lido em paralelo para o pipe não encher e travar o processo.
            let read_stderr = async {
                let mut buf = Vec::new();
                if let Some(mut err) = stderr {
                    let _ = err.read_to_end(&mut buf).await;
                }
                buf
            };
            let ((), err_buf) = tokio::join!(read_stdout, read_stderr);
            (child.wait().await, err_buf)
        };
        tokio::select! {
            r = work => Some(r),
            _ = ctx.cancelled() => None,
        }
    };

    let result = match finished {
        None => {
            let _ = child.start_kill();
            Err(JobError::Cancelled)
        }
        Some((Err(e), _)) => Err(JobError::Failed(e.to_string())),
        Some((Ok(status), err_buf)) => {
            if status.success() {
                Ok(())
            } else {
                Err(JobError::Failed(stderr_tail(&err_buf)))
            }
        }
    };
    ctx.set_job(None);
    result
}
