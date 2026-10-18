// Clona os dados de produção (%APPDATA%\com.monet.app) para o perfil dev
// (%APPDATA%\com.monet.app.dev), para o golden set e a reindexação rodarem
// sobre a base real. A produção só é LIDA (cópia de arquivos; os bancos de
// produção nunca são abertos). O dev atual vira backup
// (com.monet.app.dev.bak-<timestamp>) e as chaves e o rag-eval dele são
// recolocados no dev novo.
//
// Os caminhos absolutos de produção gravados nos bancos (documents.original_path,
// books.file_path) são reescritos para o dev. Sem isso, o app dev apagaria
// arquivos de produção (notes_index_upsert, documents_delete, exclusão de pasta
// `ai`). Se sobrar qualquer caminho de produção, o dev novo é apagado e o
// backup restaurado.
//
// Uso (de src-tauri/, com o Monet de produção e o dev fechados, inclusive no tray):
//   cargo run --example clone_prod_to_dev -- --confirm
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use monet_lib::rag;
use rusqlite::{params, Connection, OpenFlags};

const PROD_PROFILE: &str = "com.monet.app";
const DEV_PROFILE: &str = "com.monet.app.dev";
const DB_FILES: [&str; 6] = [
    "monet.db",
    "monet.db-wal",
    "monet.db-shm",
    "monet-vec.db",
    "monet-vec.db-wal",
    "monet-vec.db-shm",
];
const DATA_DIRS: [&str; 4] = ["documents", "notes", "web-research", "books"];
const KEPT_FROM_DEV_FILES: [&str; 2] = ["openrouter_key", "tavily_key"];
const KEPT_FROM_DEV_DIRS: [&str; 1] = ["rag-eval"];
// Colunas que guardam caminho absoluto dentro do perfil.
const PATH_COLUMNS: [(&str, &str); 2] = [("documents", "original_path"), ("books", "file_path")];

struct Profiles {
    prod: PathBuf,
    dev: PathBuf,
}

impl Profiles {
    // Toda escrita passa por aqui: só dentro do perfil dev, nunca na produção.
    fn ensure_dev_target(&self, p: &Path) -> Result<(), String> {
        let dev_ok = self.dev.file_name().and_then(|n| n.to_str()) == Some(DEV_PROFILE);
        if !dev_ok || !p.starts_with(&self.dev) || p.starts_with(&self.prod) {
            return Err(format!(
                "refusing to write outside the dev profile: {}",
                p.display()
            ));
        }
        Ok(())
    }

    fn copy_file(&self, src: &Path, dst: &Path) -> Result<(), String> {
        self.ensure_dev_target(dst)?;
        fs::copy(src, dst)
            .map(|_| ())
            .map_err(|e| format!("failed to copy {}: {}", src.display(), e))
    }

    fn copy_dir(&self, src: &Path, dst: &Path) -> Result<u64, String> {
        self.ensure_dev_target(dst)?;
        fs::create_dir_all(dst).map_err(|e| format!("failed to create {}: {}", dst.display(), e))?;
        let mut count = 0;
        let entries =
            fs::read_dir(src).map_err(|e| format!("failed to read {}: {}", src.display(), e))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("failed to read {}: {}", src.display(), e))?;
            let ft = entry
                .file_type()
                .map_err(|e| format!("failed to stat {}: {}", entry.path().display(), e))?;
            let target = dst.join(entry.file_name());
            if ft.is_dir() {
                count += self.copy_dir(&entry.path(), &target)?;
            } else if ft.is_file() {
                self.copy_file(&entry.path(), &target)?;
                count += 1;
            } else {
                eprintln!("warning: skipping non-regular file {}", entry.path().display());
            }
        }
        Ok(count)
    }
}

// Timestamp YYYYMMDDHHmmss em UTC (sem dependência de crate de datas).
fn utc_timestamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    // civil_from_days (H. Hinnant)
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!(
        "{:04}{:02}{:02}{:02}{:02}{:02}",
        y,
        m,
        d,
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

fn ensure_monet_not_running() -> Result<(), String> {
    let out = Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq monet.exe", "/NH"])
        .output()
        .map_err(|e| format!("failed to run tasklist: {}", e))?;
    if !out.status.success() {
        return Err("tasklist failed; cannot confirm Monet is closed".into());
    }
    if String::from_utf8_lossy(&out.stdout)
        .to_lowercase()
        .contains("monet.exe")
    {
        return Err(
            "monet.exe is running. Close the production and dev apps (including the tray icon) and retry."
                .into(),
        );
    }
    Ok(())
}

fn populate(profiles: &Profiles, backup: Option<&Path>) -> Result<(), String> {
    let (prod, dev) = (&profiles.prod, &profiles.dev);
    profiles.ensure_dev_target(dev)?;
    fs::create_dir(dev).map_err(|e| format!("failed to create {}: {}", dev.display(), e))?;

    for f in DB_FILES {
        let src = prod.join(f);
        if src.is_file() {
            profiles.copy_file(&src, &dev.join(f))?;
            println!("copied {}", f);
        }
    }
    for d in DATA_DIRS {
        let src = prod.join(d);
        if src.is_dir() {
            let n = profiles.copy_dir(&src, &dev.join(d))?;
            println!("copied {}\\ ({} files)", d, n);
        }
    }

    match backup {
        Some(backup) => {
            for f in KEPT_FROM_DEV_FILES {
                let src = backup.join(f);
                if src.is_file() {
                    profiles.copy_file(&src, &dev.join(f))?;
                    println!("restored {} from the dev backup", f);
                } else {
                    eprintln!("warning: the dev backup has no {}", f);
                }
            }
            for d in KEPT_FROM_DEV_DIRS {
                let src = backup.join(d);
                if src.is_dir() {
                    profiles.copy_dir(&src, &dev.join(d))?;
                    println!("restored {}\\ from the dev backup", d);
                }
            }
        }
        None => eprintln!("warning: there was no dev profile; dev has no API keys"),
    }

    rewrite_paths(profiles)?;
    print_counts(dev)
}

fn path_prefixes(profile: &Path) -> [String; 2] {
    let back = format!("{}\\", profile.display());
    let fwd = back.replace('\\', "/");
    [back, fwd]
}

fn rewrite_paths(profiles: &Profiles) -> Result<(), String> {
    let db_path = profiles.dev.join("monet.db");
    profiles.ensure_dev_target(&db_path)?;
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("failed to open {}: {}", db_path.display(), e))?;
    conn.busy_timeout(Duration::from_secs(5))
        .map_err(|e| format!("failed to set busy_timeout: {}", e))?;

    let prod_prefix = format!("{}\\", profiles.prod.display());
    let dev_prefix = format!("{}\\", profiles.dev.display());
    let prefix_len = prod_prefix.chars().count() as i64;

    for (table, col) in PATH_COLUMNS {
        let sql = format!(
            "UPDATE {t} SET {c} = ?1 || substr({c}, ?3 + 1) WHERE lower(substr({c}, 1, ?3)) = lower(?2)",
            t = table,
            c = col
        );
        let n = conn
            .execute(&sql, params![dev_prefix, prod_prefix, prefix_len])
            .map_err(|e| format!("failed to rewrite {}.{}: {}", table, col, e))?;
        println!("rewrote {} path(s) in {}.{}", n, table, col);
    }

    // Verificação 1: nenhuma das colunas de caminho cita o perfil de produção.
    for (table, col) in PATH_COLUMNS {
        let sql = format!(
            "SELECT COUNT(*) FROM {t} WHERE instr(lower(replace({c}, '/', '\\')), '\\{p}\\') > 0",
            t = table,
            c = col,
            p = PROD_PROFILE
        );
        let left: i64 = conn
            .query_row(&sql, [], |r| r.get(0))
            .map_err(|e| format!("failed to verify {}.{}: {}", table, col, e))?;
        if left != 0 {
            return Err(format!(
                "{} row(s) in {}.{} still point to production",
                left, table, col
            ));
        }
    }

    // Verificação 2: nenhuma coluna de nenhuma tabela guarda um caminho absoluto
    // de produção (pega colunas de caminho que não estejam em PATH_COLUMNS).
    let tables: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
            .map_err(|e| format!("failed to list tables: {}", e))?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| format!("failed to list tables: {}", e))?;
        rows.collect::<Result<_, _>>()
            .map_err(|e| format!("failed to list tables: {}", e))?
    };
    for table in &tables {
        let cols: Vec<String> = {
            let mut stmt = conn
                .prepare(&format!("PRAGMA table_info(\"{}\")", table))
                .map_err(|e| format!("failed to inspect {}: {}", table, e))?;
            let rows = stmt
                .query_map([], |r| r.get::<_, String>(1))
                .map_err(|e| format!("failed to inspect {}: {}", table, e))?;
            rows.collect::<Result<_, _>>()
                .map_err(|e| format!("failed to inspect {}: {}", table, e))?
        };
        for col in &cols {
            for prefix in path_prefixes(&profiles.prod) {
                let sql = format!(
                    "SELECT COUNT(*) FROM \"{t}\" WHERE lower(substr(CAST(\"{c}\" AS TEXT), 1, ?2)) = lower(?1)",
                    t = table,
                    c = col
                );
                let left: i64 = conn
                    .query_row(&sql, params![prefix, prefix.chars().count() as i64], |r| r.get(0))
                    .map_err(|e| format!("failed to verify {}.{}: {}", table, col, e))?;
                if left != 0 {
                    return Err(format!(
                        "{} row(s) in {}.{} hold a production path",
                        left, table, col
                    ));
                }
            }
        }
    }
    println!("verified: no production paths left in monet.db");
    Ok(())
}

fn print_counts(dev: &Path) -> Result<(), String> {
    let doc_conn = Connection::open_with_flags(dev.join("monet.db"), OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("failed to open dev monet.db: {}", e))?;
    let count = |conn: &Connection, sql: &str| -> Result<i64, String> {
        conn.query_row(sql, [], |r| r.get(0))
            .map_err(|e| format!("count failed ({}): {}", sql, e))
    };
    let files = count(
        &doc_conn,
        "SELECT COUNT(*) FROM documents WHERE COALESCE(type, 'file') = 'file'",
    )?;
    let folders = count(&doc_conn, "SELECT COUNT(*) FROM documents WHERE type = 'folder'")?;
    let notes = count(&doc_conn, "SELECT COUNT(*) FROM notes")?;
    let books = count(&doc_conn, "SELECT COUNT(*) FROM books")?;
    let vec_conn = rag::open_vec_db_readonly(&dev.join("monet-vec.db"))?;
    let chunks = count(&vec_conn, "SELECT COUNT(*) FROM chunks_meta")?;
    println!(
        "\ndev profile now has: {} documents ({} folders), {} chunks, {} notes, {} books",
        files, folders, chunks, notes, books
    );
    Ok(())
}

fn rollback(profiles: &Profiles, backup: Option<&Path>) {
    if profiles.dev.exists() {
        match profiles
            .ensure_dev_target(&profiles.dev)
            .and_then(|_| fs::remove_dir_all(&profiles.dev).map_err(|e| e.to_string()))
        {
            Ok(()) => eprintln!("removed the partial dev profile"),
            Err(e) => {
                eprintln!("FAILED to remove the partial dev profile: {}", e);
                if let Some(b) = backup {
                    eprintln!("the previous dev profile is kept at {}", b.display());
                }
                return;
            }
        }
    }
    if let Some(b) = backup {
        match fs::rename(b, &profiles.dev) {
            Ok(()) => eprintln!("restored the previous dev profile"),
            Err(e) => eprintln!(
                "FAILED to restore {} to {}: {}",
                b.display(),
                profiles.dev.display(),
                e
            ),
        }
    }
}

fn clone() -> Result<(), String> {
    let appdata = PathBuf::from(std::env::var("APPDATA").map_err(|_| "APPDATA is not set")?);
    let profiles = Profiles {
        prod: appdata.join(PROD_PROFILE),
        dev: appdata.join(DEV_PROFILE),
    };
    if !profiles.prod.join("monet.db").is_file() {
        return Err(format!("production database not found in {}", profiles.prod.display()));
    }
    ensure_monet_not_running()?;

    let backup = appdata.join(format!("{}.bak-{}", DEV_PROFILE, utc_timestamp()));
    if backup.exists() {
        return Err(format!("{} already exists", backup.display()));
    }
    let had_dev = profiles.dev.exists();
    if had_dev {
        fs::rename(&profiles.dev, &backup)
            .map_err(|e| format!("failed to back up the dev profile: {}", e))?;
        println!("dev profile backed up to {}", backup.display());
    }
    let backup = had_dev.then_some(backup.as_path());

    match populate(&profiles, backup) {
        Ok(()) => {
            if let Some(b) = backup {
                println!("previous dev profile kept at {}", b.display());
            }
            Ok(())
        }
        Err(e) => {
            rollback(&profiles, backup);
            Err(e)
        }
    }
}

fn main() {
    if !std::env::args().any(|a| a == "--confirm") {
        eprintln!(
            "Copies the production data into the dev profile (the current dev profile is backed up).\n\
             Close Monet (production and dev, including the tray) and run:\n  \
             cargo run --example clone_prod_to_dev -- --confirm"
        );
        std::process::exit(2);
    }
    if let Err(e) = clone() {
        eprintln!("clone_prod_to_dev: {}", e);
        std::process::exit(1);
    }
    println!("done");
}
