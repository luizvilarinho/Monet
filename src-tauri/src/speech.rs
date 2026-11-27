// Leitura em voz alta: uma frase por chamada ao endpoint de fala do OpenRouter,
// com cache em disco (appData/tts/<livro>/<hash>.mp3), uso contado em
// appData/tts/usage.json e a lista de modelos de voz lida do catálogo público
// do OpenRouter. A chave é lida aqui (read_key) e nunca vai ao frontend.
use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;
use uuid::Uuid;

use crate::mincer::sidecar;

const SPEECH_URL: &str = "https://openrouter.ai/api/v1/audio/speech";
const MODELS_URL: &str = "https://openrouter.ai/api/v1/models?output_modalities=speech";
const SPEECH_MODELS_URL: &str = "https://openrouter.ai/api/v1/audio/speech/models";
const WARNING_EVENT: &str = "tts://warning";
const SHARED_DIR: &str = "_shared";
const MAX_TEXT_CHARS: usize = 1000;
const MAX_ATTEMPTS: u32 = 3;
const CATALOG_TTL: Duration = Duration::from_secs(600);
const FORMAT_LOOKUP_TIMEOUT: Duration = Duration::from_secs(5);
const ERROR_DETAIL_CHARS: usize = 300;
const DEFAULT_PCM_RATE: u32 = 24_000;
const HEYGEN_PCM_RATE: u32 = 44_100;
const NO_STORE_WARNING: &str =
    "Audio can't be saved on this device, so each sentence is generated again next time. It still plays.";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TtsModel {
    pub id: String,
    pub name: String,
    pub prompt_price: f64,
    pub completion_price: f64,
    pub voices: Vec<String>,
    // Só o Rust usa (escolha do formato do pedido); o front não lê.
    pub formats: Vec<String>,
}

// Vai ao front como objeto: o invoke rejeita com { kind, message }. A mensagem
// é a frase do leitor; o detalhe técnico, quando há, vem depois de "\n\n".
#[derive(Serialize, Debug, PartialEq)]
pub struct TtsError {
    pub kind: String,
    pub message: String,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TtsCacheSize {
    pub files: u64,
    pub bytes: u64,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TtsUsage {
    // bookId → modelId → caracteres gerados
    pub books: HashMap<String, HashMap<String, u64>>,
    // "YYYY-MM" → modelId → caracteres gerados
    pub months: HashMap<String, HashMap<String, u64>>,
}

// request_id → canal que cancela a chamada em voo.
#[derive(Default)]
pub struct SpeechRequests(pub Mutex<HashMap<String, oneshot::Sender<()>>>);

fn tts_error(kind: &str, message: &str) -> TtsError {
    TtsError {
        kind: kind.to_string(),
        message: message.to_string(),
    }
}

fn truncate_chars(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

// ---------------------------------------------------------------------------
// Funções puras
// ---------------------------------------------------------------------------

fn price(value: &Value) -> f64 {
    match value {
        Value::String(s) => s.trim().parse().unwrap_or(0.0),
        Value::Number(n) => n.as_f64().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn string_list(value: &Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| items.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
        .unwrap_or_default()
}

// Vozes e formatos do modelo no segundo endereço.
fn speech_params(model: &Value) -> (Vec<String>, Vec<String>) {
    let params = model["output_modalities"]
        .as_array()
        .and_then(|list| list.iter().find(|m| m["type"] == "speech"))
        .map(|m| &m["supported_parameters"])
        .unwrap_or(&Value::Null);
    (
        string_list(&params["voice"]["values"]),
        string_list(&params["response_format"]["values"]),
    )
}

// Une os dois endereços pelo id. O preço vem de `/models?output_modalities=speech`;
// as vozes e os formatos, de `/audio/speech/models`. Sem vozes no
// segundo, vale o `supported_voices` do primeiro. Ordenado por nome.
pub fn parse_catalog(prices: &Value, speech: &Value) -> Vec<TtsModel> {
    let speech_items: Vec<&Value> = speech["data"].as_array().map(|d| d.iter().collect()).unwrap_or_default();
    let mut models: Vec<TtsModel> = Vec::new();

    for item in prices["data"].as_array().into_iter().flatten() {
        let Some(id) = item["id"].as_str() else { continue };
        let (mut voices, formats) = speech_items
            .iter()
            .find(|s| s["id"] == id)
            .map(|s| speech_params(s))
            .unwrap_or_default();
        if voices.is_empty() {
            voices = string_list(&item["supported_voices"]);
        }
        models.push(TtsModel {
            id: id.to_string(),
            name: item["name"].as_str().unwrap_or(id).to_string(),
            prompt_price: price(&item["pricing"]["prompt"]),
            completion_price: price(&item["pricing"]["completion"]),
            voices,
            formats,
        });
    }

    // Só no segundo endereço: entra sem preço publicado.
    for item in speech_items {
        let Some(id) = item["id"].as_str() else { continue };
        if models.iter().any(|m| m.id == id) {
            continue;
        }
        let (voices, formats) = speech_params(item);
        models.push(TtsModel {
            id: id.to_string(),
            name: item["name"].as_str().unwrap_or(id).to_string(),
            prompt_price: 0.0,
            completion_price: 0.0,
            voices,
            formats,
        });
    }

    models.sort_by_key(|m| m.name.to_lowercase());
    models
}

// mp3 se o modelo aceita; senão wav; senão pcm. Sem formato conhecido, mp3: só o
// Gemini e o HeyGen o recusam, e os dois trazem os formatos no catálogo. Pedir pcm
// às cegas leria o áudio na taxa errada (ver `pcm_rate`).
pub fn choose_format(formats: &[String]) -> &'static str {
    let has = |name: &str| formats.iter().any(|f| f.eq_ignore_ascii_case(name));
    if has("mp3") {
        "mp3"
    } else if has("wav") {
        "wav"
    } else if has("pcm") {
        "pcm"
    } else {
        "mp3"
    }
}

// O modelo no catálogo e, depois dele, o mesmo id sem o sufixo `:free` (ou
// qualquer `:…`): os modelos `:free` só estão no primeiro endereço, sem formatos e
// sem vozes do segundo.
fn model_chain<'a>(models: &'a [TtsModel], id: &str) -> Vec<&'a TtsModel> {
    let mut ids = vec![id];
    if let Some((base, _)) = id.split_once(':') {
        ids.push(base);
    }
    ids.into_iter()
        .filter_map(|candidate| models.iter().find(|m| m.id == candidate))
        .collect()
}

pub fn formats_for(models: &[TtsModel], id: &str) -> Vec<String> {
    model_chain(models, id)
        .into_iter()
        .map(|m| m.formats.clone())
        .find(|formats| !formats.is_empty())
        .unwrap_or_default()
}

// A primeira voz do modelo, para o pedido que chega sem voz (o front ainda sem o
// catálogo). Modelos sem voz na lista (Fish, Seed Audio) seguem sem.
pub fn default_voice(models: &[TtsModel], id: &str) -> Option<String> {
    model_chain(models, id)
        .into_iter()
        .find_map(|m| m.voices.first().cloned())
}

// Formato do pedido. Catálogo desconhecido (sem rede e sem cópia em disco): pcm, o
// padrão do endpoint, que todos os modelos aceitam; com o catálogo, a escolha por
// formatos acima.
pub fn request_format(models: &[TtsModel], id: &str) -> &'static str {
    if models.is_empty() {
        return "pcm";
    }
    choose_format(&formats_for(models, id))
}

pub fn normalize_text(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

// A velocidade fica fora: o mesmo áudio serve a todas. SHA-256 porque o hash
// precisa ser estável entre versões do Rust.
pub fn cache_key(model: &str, voice: Option<&str>, text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"v1\0");
    hasher.update(model.as_bytes());
    hasher.update(b"\0");
    hasher.update(voice.unwrap_or("").as_bytes());
    hasher.update(b"\0");
    hasher.update(normalize_text(text).as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect()
}

// Nunca `speed`: a velocidade é do player.
pub fn build_speech_body(model: &str, voice: Option<&str>, text: &str, format: &str) -> Value {
    let mut body = serde_json::json!({
        "model": model,
        "input": text,
        "response_format": format,
    });
    if let Some(voice) = voice {
        body["voice"] = Value::String(voice.to_string());
    }
    body
}

// Taxa do PCM: a do `Content-Type` (`audio/pcm;rate=24000`) quando vem. Sem ela,
// 24 kHz (Gemini e MAI), com uma única exceção por provedor: o PCM do HeyGen sai
// a 44,1 kHz pela documentação do OpenRouter, e lido a 24 kHz tocaria 1,84 vez
// mais lento e grave, o que a checagem de duração não pega.
pub fn pcm_rate(content_type: Option<&str>, model: &str) -> u32 {
    content_type
        .and_then(|ct| {
            ct.split(';').skip(1).find_map(|part| {
                let (name, value) = part.split_once('=')?;
                if !name.trim().eq_ignore_ascii_case("rate") {
                    return None;
                }
                value.trim().trim_matches('"').parse::<u32>().ok()
            })
        })
        .filter(|rate| (8_000..=96_000).contains(rate))
        .unwrap_or(if model.starts_with("heygen/") {
            HEYGEN_PCM_RATE
        } else {
            DEFAULT_PCM_RATE
        })
}

// PCM de 16 bits little-endian, mono, com cabeçalho WAV de 44 bytes.
pub fn wav_from_pcm(pcm: &[u8], rate: u32) -> Vec<u8> {
    let data_len = (pcm.len() / 2 * 2) as u32;
    let mut out = Vec::with_capacity(44 + data_len as usize);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&1u16.to_le_bytes()); // mono
    out.extend_from_slice(&rate.to_le_bytes());
    out.extend_from_slice(&(rate * 2).to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    out.extend_from_slice(&pcm[..data_len as usize]);
    out
}

// Posição do corpo e tamanho declarado do chunk "data".
fn wav_data_chunk(bytes: &[u8]) -> Option<(usize, u32)> {
    let mut pos = 12;
    while pos + 8 <= bytes.len() {
        let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().ok()?);
        if &bytes[pos..pos + 4] == b"data" {
            return Some((pos + 8, size));
        }
        // Chunks têm tamanho par.
        pos = pos.checked_add(8)?.checked_add(size as usize)?.checked_add(size as usize & 1)?;
    }
    None
}

// WAV em fluxo costuma sair com tamanhos provisórios (0 ou 0xFFFFFFFF), que o
// navegador não toca. Acerta os dois tamanhos pelo que de fato chegou.
fn fix_wav_sizes(bytes: &mut [u8]) {
    if !bytes.starts_with(b"RIFF") {
        return;
    }
    let Some((start, declared)) = wav_data_chunk(bytes) else { return };
    let available = bytes.len() - start;
    if declared == 0 || declared as usize > available {
        bytes[start - 4..start].copy_from_slice(&(available as u32).to_le_bytes());
        let riff = (bytes.len() - 8) as u32;
        bytes[4..8].copy_from_slice(&riff.to_le_bytes());
    }
}

fn wav_duration_secs(bytes: &[u8]) -> Option<f64> {
    let spec = hound::WavReader::new(Cursor::new(bytes)).ok()?.spec();
    let (start, declared) = wav_data_chunk(bytes)?;
    let frame = spec.channels as u64 * (spec.bits_per_sample as u64 / 8);
    if frame == 0 || spec.sample_rate == 0 {
        return None;
    }
    let available = (bytes.len() - start) as u64;
    let len = if declared == 0 || declared as u64 > available {
        available
    } else {
        declared as u64
    };
    Some((len / frame) as f64 / spec.sample_rate as f64)
}

const MP3_BITRATES_V1: [u32; 16] = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MP3_BITRATES_V2: [u32; 16] = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
// Ao pular o ID3, o primeiro frame tem de aparecer perto do começo.
const MP3_SYNC_SEARCH_BYTES: usize = 2048;

struct Mp3Frame {
    len: usize,
    samples: u32,
    rate: u32,
}

// Cabeçalho de um frame MPEG Layer III (versão 1, 2 ou 2.5).
fn mp3_frame(header: &[u8]) -> Option<Mp3Frame> {
    if header.len() < 4 || header[0] != 0xFF || header[1] & 0xE0 != 0xE0 {
        return None;
    }
    let version = (header[1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5, 1 = reservado
    let layer = (header[1] >> 1) & 3; // 1 = Layer III
    let bitrate_index = (header[2] >> 4) as usize;
    let rate_index = ((header[2] >> 2) & 3) as usize;
    let padding = ((header[2] >> 1) & 1) as usize;
    if version == 1 || layer != 1 || rate_index == 3 || bitrate_index == 0 || bitrate_index == 15 {
        return None;
    }
    let (bitrate, rate, samples) = match version {
        3 => (MP3_BITRATES_V1[bitrate_index], [44_100, 48_000, 32_000][rate_index], 1152),
        2 => (MP3_BITRATES_V2[bitrate_index], [22_050, 24_000, 16_000][rate_index], 576),
        _ => (MP3_BITRATES_V2[bitrate_index], [11_025, 12_000, 8_000][rate_index], 576),
    };
    let len = (samples / 8 * bitrate * 1000 / rate) as usize + padding;
    Some(Mp3Frame { len, samples, rate })
}

fn mp3_duration_secs(bytes: &[u8]) -> Option<f64> {
    let mut pos = 0;
    if bytes.starts_with(b"ID3") && bytes.len() >= 10 {
        let size = ((bytes[6] & 0x7F) as usize) << 21
            | ((bytes[7] & 0x7F) as usize) << 14
            | ((bytes[8] & 0x7F) as usize) << 7
            | (bytes[9] & 0x7F) as usize;
        let footer = if bytes[5] & 0x10 != 0 { 10 } else { 0 };
        pos = 10 + size + footer;
    }
    let search_end = pos + MP3_SYNC_SEARCH_BYTES;
    let mut secs = 0.0;
    let mut frames = 0u32;
    while pos + 4 <= bytes.len() {
        match mp3_frame(&bytes[pos..]) {
            Some(frame) => {
                secs += frame.samples as f64 / frame.rate as f64;
                frames += 1;
                pos += frame.len;
            }
            // Antes do primeiro frame, procura o sync; depois dele, o que sobra
            // (tag ID3v1, lixo) não conta.
            None if frames == 0 && pos < search_end => pos += 1,
            None => break,
        }
    }
    (frames > 0).then_some(secs)
}

// Duração do áudio, ou None quando o formato não é reconhecido (e então não há
// checagem).
pub fn audio_duration_secs(bytes: &[u8]) -> Option<f64> {
    if bytes.starts_with(b"RIFF") {
        wav_duration_secs(bytes)
    } else {
        mp3_duration_secs(bytes)
    }
}

// A fala não pode ser muito mais longa que o texto (áudio repetido ou lixo) nem
// muito mais curta (áudio cortado). Folgada de propósito: número escrito em
// algarismo vira muitas sílabas faladas.
pub fn duration_plausible(chars: usize, secs: f64) -> bool {
    let chars = chars as f64;
    if secs > chars / 4.0 + 5.0 {
        return false;
    }
    if chars >= 20.0 && secs < chars / 40.0 {
        return false;
    }
    true
}

fn error_detail(body: &str) -> String {
    let text = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| v["error"]["message"].as_str().map(str::to_string))
        .unwrap_or_else(|| body.trim().to_string());
    truncate_chars(text.trim(), ERROR_DETAIL_CHARS)
}

// Erro de status em frase do leitor, com o detalhe do provedor depois de "\n\n".
pub fn speech_error(status: u16, body: &str) -> TtsError {
    let (kind, sentence) = match status {
        401 => ("auth", "OpenRouter didn't accept the key. Check it in Settings."),
        402 => ("no_credit", "OpenRouter has no credit left for audio."),
        403 => ("refused", "OpenRouter refused this text."),
        413 => ("too_long", "This sentence is too long for the voice model."),
        429 => ("rate_limit", "Too many requests to the voice model. Wait a moment."),
        s if s >= 500 || s == 408 => ("server", "The voice model is unavailable right now."),
        // 400, 404 e o resto: o modelo não aceitou o pedido (voz ou formato
        // inválidos, modelo removido).
        _ => ("model", "This voice model didn't accept the request."),
    };
    let detail = error_detail(body);
    if detail.is_empty() {
        tts_error(kind, sentence)
    } else {
        tts_error(kind, &format!("{}\n\n{}", sentence, detail))
    }
}

pub fn network_speech_error(detail: &str) -> TtsError {
    tts_error(
        "network",
        &format!("Couldn't generate the audio. Check your connection.\n\n{}", detail.trim()),
    )
}

// O id vira nome de pasta: só letras, dígitos, `_` e `-`.
pub fn valid_book_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub fn record_usage(usage: &mut TtsUsage, book: &str, model: &str, chars: u64, month: &str) {
    *usage
        .books
        .entry(book.to_string())
        .or_default()
        .entry(model.to_string())
        .or_default() += chars;
    *usage
        .months
        .entry(month.to_string())
        .or_default()
        .entry(model.to_string())
        .or_default() += chars;
}

// ---------------------------------------------------------------------------
// Disco
// ---------------------------------------------------------------------------

fn cache_path(root: &Path, book: Option<&str>, key: &str) -> PathBuf {
    root.join(book.unwrap_or(SHARED_DIR)).join(format!("{}.mp3", key))
}

// Grava em `<nome>.<uuid>.tmp` e renomeia: ninguém lê um arquivo pela metade.
fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let stem = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let tmp = path.with_file_name(format!("{}.{}.tmp", stem, Uuid::new_v4()));
    let result = fs::write(&tmp, bytes).and_then(|_| fs::rename(&tmp, path));
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

// Arquivos .mp3 de todas as pastas de livro (não conta usage.json, catalog.json
// nem temporários).
fn cache_size(root: &Path) -> TtsCacheSize {
    let mut size = TtsCacheSize { files: 0, bytes: 0 };
    for dir in fs::read_dir(root).into_iter().flatten().flatten() {
        if !dir.path().is_dir() {
            continue;
        }
        for file in fs::read_dir(dir.path()).into_iter().flatten().flatten() {
            let path = file.path();
            if path.extension().and_then(|e| e.to_str()) == Some("mp3") {
                size.files += 1;
                size.bytes += file.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    size
}

// Apaga as pastas de áudio; usage.json e catalog.json ficam.
fn clear_audio(root: &Path) -> std::io::Result<()> {
    for entry in fs::read_dir(root).into_iter().flatten().flatten() {
        if entry.path().is_dir() {
            fs::remove_dir_all(entry.path())?;
        }
    }
    Ok(())
}

fn tts_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("tts"))
        .map_err(|e| format!("app data dir unavailable: {}", e))
}

fn read_usage(path: &Path) -> TtsUsage {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

// Leitura, alteração e escrita sob o mesmo lock: duas frases terminando juntas
// não perdem a contagem uma da outra.
static USAGE_LOCK: Mutex<()> = Mutex::new(());

fn add_usage(app: &AppHandle, book: &str, model: &str, chars: u64) -> Result<(), String> {
    let path = tts_dir(app)?.join("usage.json");
    let _guard = USAGE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut usage = read_usage(&path);
    let month = chrono::Local::now().format("%Y-%m").to_string();
    record_usage(&mut usage, book, model, chars, &month);
    let json = serde_json::to_string(&usage).map_err(|e| e.to_string())?;
    write_atomic(&path, json.as_bytes()).map_err(|e| format!("Could not save the usage: {}", e))
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

// Sem Authorization: os dois endereços são públicos.
async fn fetch_json(url: &str) -> Result<Value, String> {
    let response = http_client()
        .get(url)
        .header("HTTP-Referer", "https://monet.local")
        .header("X-Title", "Monet")
        .timeout(Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("Could not load the voice models: {}", e))?;
    if !response.status().is_success() {
        return Err(format!("Could not load the voice models: {}", response.status()));
    }
    response
        .json()
        .await
        .map_err(|e| format!("Could not load the voice models: {}", e))
}

pub async fn fetch_catalog() -> Result<Vec<TtsModel>, String> {
    let (prices, speech) = tokio::join!(fetch_json(MODELS_URL), fetch_json(SPEECH_MODELS_URL));
    Ok(parse_catalog(&prices?, &speech?))
}

static CATALOG: Mutex<Option<(Instant, Vec<TtsModel>)>> = Mutex::new(None);

fn memory_catalog() -> Option<(Instant, Vec<TtsModel>)> {
    CATALOG.lock().ok().and_then(|guard| guard.clone())
}

fn read_catalog_file(app: &AppHandle) -> Option<Vec<TtsModel>> {
    let path = tts_dir(app).ok()?.join("catalog.json");
    fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok())
}

fn store_catalog(app: &AppHandle, models: &[TtsModel]) {
    if let Ok(mut guard) = CATALOG.lock() {
        *guard = Some((Instant::now(), models.to_vec()));
    }
    let saved = tts_dir(app)
        .map(|dir| dir.join("catalog.json"))
        .and_then(|path| {
            let json = serde_json::to_string(models).map_err(|e| e.to_string())?;
            write_atomic(&path, json.as_bytes()).map_err(|e| e.to_string())
        });
    if let Err(e) = saved {
        eprintln!("tts catalog: {}", e);
    }
}

// Catálogo em memória por 10 min e em disco, para valer sem rede. Falha da rede
// com cópia guardada: devolve a cópia, mesmo velha.
#[tauri::command]
pub async fn tts_catalog(app: AppHandle) -> Result<Vec<TtsModel>, String> {
    if let Some((at, models)) = memory_catalog() {
        if at.elapsed() < CATALOG_TTL {
            return Ok(models);
        }
    }
    match fetch_catalog().await {
        Ok(models) => {
            store_catalog(&app, &models);
            Ok(models)
        }
        Err(e) => {
            let kept = memory_catalog().map(|(_, models)| models).or_else(|| read_catalog_file(&app));
            match kept {
                Some(models) if !models.is_empty() => Ok(models),
                _ => Err(e),
            }
        }
    }
}

// O catálogo para escolher formato e voz: o da memória ou do arquivo; com os dois
// vazios, uma tentativa de rede de 5 s. Sem nada, lista vazia (`request_format`
// trata).
async fn known_models(app: &AppHandle) -> Vec<TtsModel> {
    let known = memory_catalog()
        .map(|(_, models)| models)
        .or_else(|| read_catalog_file(app))
        .filter(|models| !models.is_empty());
    match known {
        Some(models) => models,
        None => match tokio::time::timeout(FORMAT_LOOKUP_TIMEOUT, fetch_catalog()).await {
            Ok(Ok(models)) => {
                store_catalog(app, &models);
                models
            }
            _ => Vec::new(),
        },
    }
}

// ---------------------------------------------------------------------------
// Fala
// ---------------------------------------------------------------------------

// Uma chamada ao endpoint. O bool diz se vale tentar de novo (429, 5xx e rede).
async fn request_once(key: &str, body: &Value) -> Result<(Vec<u8>, Option<String>), (TtsError, bool)> {
    let response = http_client()
        .post(SPEECH_URL)
        .bearer_auth(key)
        .header("HTTP-Referer", "https://monet.local")
        .header("X-Title", "Monet")
        .json(body)
        .send()
        .await
        .map_err(|e| (network_speech_error(&e.to_string()), true))?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        let retry = status.as_u16() == 429 || status.is_server_error();
        return Err((speech_error(status.as_u16(), &text), retry));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|e| (network_speech_error(&e.to_string()), true))?;
    // Um 2xx que não é áudio (JSON ou texto) não pode ir ao cache.
    let not_audio = content_type
        .as_deref()
        .map(|ct| {
            let ct = ct.to_ascii_lowercase();
            ct.contains("json") || ct.starts_with("text/")
        })
        .unwrap_or(false);
    if bytes.is_empty() || not_audio {
        let text = if not_audio { String::from_utf8_lossy(&bytes).to_string() } else { String::new() };
        return Err((speech_error(502, &text), true));
    }
    Ok((bytes.to_vec(), content_type))
}

// Até 3 tentativas, com 1 s e depois 2 s de espera.
async fn request_with_retry(key: &str, body: &Value) -> Result<(Vec<u8>, Option<String>), TtsError> {
    let mut last = tts_error("server", "The voice model is unavailable right now.");
    for attempt in 1..=MAX_ATTEMPTS {
        match request_once(key, body).await {
            Ok(audio) => return Ok(audio),
            Err((err, false)) => return Err(err),
            Err((err, true)) => {
                last = err;
                if attempt < MAX_ATTEMPTS {
                    tokio::time::sleep(Duration::from_secs(1u64 << (attempt - 1))).await;
                }
            }
        }
    }
    Err(last)
}

// Só o envio explícito cancela. Um canal fechado sem envio (o id foi registrado
// de novo) deixa a chamada seguir.
async fn cancel_signal(rx: oneshot::Receiver<()>) {
    if rx.await.is_err() {
        std::future::pending::<()>().await;
    }
}

fn warn_once(app: &AppHandle, detail: &str) {
    static WARNED: AtomicBool = AtomicBool::new(false);
    if WARNED.swap(true, Ordering::Relaxed) {
        return;
    }
    let message = if detail.is_empty() {
        NO_STORE_WARNING.to_string()
    } else {
        format!("{}\n\n{}", NO_STORE_WARNING, detail)
    };
    let _ = app.emit(WARNING_EVENT, serde_json::json!({ "message": message }));
}

// WAV → MP3 mono de 64 kbps pelo ffmpeg do Mincer, e só então o arquivo entra no
// cache. Os temporários saem sempre.
async fn convert_to_cache(path: &Path, wav: &[u8]) -> Result<(), String> {
    let ffmpeg = sidecar::resolve("ffmpeg")?;
    let dir = path.parent().ok_or("invalid cache path")?;
    fs::create_dir_all(dir).map_err(|e| format!("Could not create the audio folder: {}", e))?;
    let stem = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let id = Uuid::new_v4();
    let input = dir.join(format!("{}.{}.wav", stem, id));
    let output = dir.join(format!("{}.{}.tmp", stem, id));
    let result = async {
        fs::write(&input, wav).map_err(|e| format!("Could not write the audio: {}", e))?;
        let out = sidecar::command(&ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-y", "-f", "wav", "-i"])
            .arg(&input)
            .args(["-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", "-f", "mp3"])
            .arg(&output)
            .output()
            .await
            .map_err(|e| format!("Could not run ffmpeg: {}", e))?;
        if !out.status.success() {
            return Err(format!(
                "ffmpeg failed: {}",
                truncate_chars(String::from_utf8_lossy(&out.stderr).trim(), ERROR_DETAIL_CHARS)
            ));
        }
        fs::rename(&output, path).map_err(|e| format!("Could not save the audio: {}", e))
    }
    .await;
    let _ = fs::remove_file(&input);
    if result.is_err() {
        let _ = fs::remove_file(&output);
    }
    result
}

// Sobe a cada "Clear saved audio" e a cada livro apagado, antes de apagar: uma
// gravação que falha depois disso falhou porque a pasta sumiu, não porque o
// aparelho não guarda áudio, e não merece o único aviso da execução.
static CLEARS: AtomicU64 = AtomicU64::new(0);

// Gravação sem segurar a resposta: o áudio já está tocando.
async fn save_to_cache(app: AppHandle, path: PathBuf, bytes: Vec<u8>, is_mp3: bool) {
    let clears = CLEARS.load(Ordering::SeqCst);
    let result = if is_mp3 {
        write_atomic(&path, &bytes).map_err(|e| format!("Could not save the audio: {}", e))
    } else {
        convert_to_cache(&path, &bytes).await
    };
    if let Err(detail) = result {
        if CLEARS.load(Ordering::SeqCst) == clears {
            warn_once(&app, &detail);
        }
    }
}

// Tira o request_id do mapa de cancelamento em qualquer saída de tts_speak.
struct CancelGuard<'a> {
    requests: &'a SpeechRequests,
    id: String,
}

impl Drop for CancelGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut map) = self.requests.0.lock() {
            map.remove(&self.id);
        }
    }
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn tts_speak(
    app: AppHandle,
    requests: State<'_, SpeechRequests>,
    request_id: String,
    book_id: Option<String>,
    model: String,
    voice: Option<String>,
    text: String,
) -> Result<tauri::ipc::Response, TtsError> {
    // O cancelamento se registra já na entrada: um tts_cancel que chega durante a
    // leitura do cache ou da chave fica guardado no canal e vale no pedido.
    let (cancel_tx, cancel_rx) = oneshot::channel();
    if let Ok(mut map) = requests.0.lock() {
        map.insert(request_id.clone(), cancel_tx);
    }
    let _registered = CancelGuard {
        requests: &requests,
        id: request_id.clone(),
    };

    // 1. Validação.
    let text = normalize_text(&text);
    let chars = text.chars().count();
    if chars == 0 || chars > MAX_TEXT_CHARS {
        return Err(tts_error("invalid", "The text to read is empty or too long."));
    }
    if !crate::is_valid_model_id(&model) {
        return Err(tts_error("invalid", "Invalid voice model id."));
    }
    if let Some(id) = book_id.as_deref() {
        if !valid_book_id(id) {
            return Err(tts_error("invalid", "Invalid book id."));
        }
    }
    let voice = voice.map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
    if voice.as_deref().map_or(false, |v| v.chars().count() > 200) {
        return Err(tts_error("invalid", "Invalid voice."));
    }

    // 2. Cache: não conta uso.
    let root = tts_dir(&app).map_err(|e| tts_error("invalid", &e))?;
    let key = cache_key(&model, voice.as_deref(), &text);
    let path = cache_path(&root, book_id.as_deref(), &key);
    let cached = {
        let path = path.clone();
        tauri::async_runtime::spawn_blocking(move || fs::read(&path).ok().filter(|b| !b.is_empty()))
            .await
            .ok()
            .flatten()
    };
    if let Some(bytes) = cached {
        return Ok(tauri::ipc::Response::new(bytes));
    }

    // 3. Chave.
    let api_key = crate::read_key(&app, "openrouter_key")
        .ok_or_else(|| tts_error("no_key", "Add your OpenRouter key in Settings to listen."))?;

    // 4 e 5. Formato e voz (do catálogo) e pedido, com cancelamento por request_id:
    // o cancelamento vale também durante a consulta do catálogo. A voz que o front
    // não mandou (o catálogo dele falhou) vem da primeira do modelo; o cache segue
    // pela chave do pedido, sem voz.
    let outcome = tokio::select! {
        r = async {
            let models = known_models(&app).await;
            let format = request_format(&models, &model);
            let body_voice = voice.clone().or_else(|| default_voice(&models, &model));
            let body = build_speech_body(&model, body_voice.as_deref(), &text, format);
            request_with_retry(&api_key, &body).await.map(|audio| (format, audio))
        } => Some(r),
        _ = cancel_signal(cancel_rx) => None,
    };
    let Some(outcome) = outcome else {
        return Err(tts_error("cancelled", "Cancelled."));
    };
    // 6. Status não-2xx já saiu como TtsError.
    let (format, (mut audio, content_type)) = outcome?;

    // 7. PCM vira WAV; WAV em fluxo ganha os tamanhos certos.
    let is_mp3 = format == "mp3";
    if format == "pcm" {
        audio = wav_from_pcm(&audio, pcm_rate(content_type.as_deref(), &model));
    } else if format == "wav" {
        fix_wav_sizes(&mut audio);
    }

    // 8. Uso: foi gerado e cobrado, mesmo que o áudio seja recusado.
    let usage_book = book_id.as_deref().unwrap_or(SHARED_DIR);
    if let Err(e) = add_usage(&app, usage_book, &model, chars as u64) {
        eprintln!("tts usage: {}", e);
    }
    // Duração contra o tamanho do texto.
    if let Some(secs) = audio_duration_secs(&audio) {
        if !duration_plausible(chars, secs) {
            return Err(tts_error(
                "duration",
                "The audio didn't match the text, so it wasn't played.",
            ));
        }
    }

    // 9. Gravação em segundo plano.
    tauri::async_runtime::spawn(save_to_cache(app.clone(), path, audio.clone(), is_mp3));

    // 10. Retorno pelo mesmo caminho dos livros.
    Ok(tauri::ipc::Response::new(audio))
}

#[tauri::command]
pub fn tts_cancel(requests: State<'_, SpeechRequests>, request_id: String) {
    let sender = requests.0.lock().ok().and_then(|mut map| map.remove(&request_id));
    if let Some(tx) = sender {
        let _ = tx.send(());
    }
}

#[tauri::command]
pub async fn tts_clear_book(app: AppHandle, book_id: String) -> Result<(), String> {
    if !valid_book_id(&book_id) {
        return Err("Invalid book id.".into());
    }
    let dir = tts_dir(&app)?.join(&book_id);
    CLEARS.fetch_add(1, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || match fs::remove_dir_all(&dir) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(format!("Could not delete the audio: {}", e)),
        _ => Ok(()),
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn tts_clear_all(app: AppHandle) -> Result<(), String> {
    let root = tts_dir(&app)?;
    CLEARS.fetch_add(1, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        clear_audio(&root).map_err(|e| format!("Could not delete the audio: {}", e))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn tts_cache_size(app: AppHandle) -> Result<TtsCacheSize, String> {
    let root = tts_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || cache_size(&root))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tts_usage(app: AppHandle) -> Result<TtsUsage, String> {
    let path = tts_dir(&app)?.join("usage.json");
    let _guard = USAGE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    Ok(read_usage(&path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn strings(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    fn temp_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!("monet-tts-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn sample_prices() -> Value {
        json!({ "data": [
            { "id": "google/gemini-3.8-flash-tts", "name": "Google: Gemini 3.8 Flash TTS",
              "pricing": { "prompt": "0.0000005", "completion": "0.000009" },
              "supported_voices": ["Zephyr", "Puck"] },
            { "id": "elevenlabs/eleven-v4-turbo", "name": "ElevenLabs: Eleven v4 Turbo",
              "pricing": { "prompt": "0.00004", "completion": "0" },
              "supported_voices": ["george", "sarah"] },
            { "id": "fish-audio/s2-pro", "name": "Fish Audio: S2 Pro",
              "pricing": { "prompt": "0.00002", "completion": "0" },
              "supported_voices": [] },
            { "id": "minimax/speech-2.8-hd", "name": "MiniMax: Speech 2.8 HD",
              "pricing": { "prompt": "0.00006", "completion": "0" },
              "supported_voices": ["Narrator"] }
        ] })
    }

    fn sample_speech() -> Value {
        json!({ "data": [
            { "id": "google/gemini-3.8-flash-tts", "name": "Google: Gemini 3.8 Flash TTS",
              "output_modalities": [{ "type": "speech", "supported_parameters": {
                "voice": { "type": "enum", "values": ["Zephyr", "Puck", "Kore"] },
                "response_format": { "type": "enum", "values": ["pcm", "wav"] },
                "instructions": { "type": "unknown" } } }] },
            { "id": "elevenlabs/eleven-v4-turbo", "name": "ElevenLabs: Eleven v4 Turbo",
              "output_modalities": [{ "type": "speech", "supported_parameters": {
                "voice": { "type": "enum", "values": ["george", "sarah", "alice"] },
                "response_format": { "type": "enum", "values": ["mp3", "pcm"] },
                "speed": { "type": "range", "min": 0.7, "max": 1.2 } } }] },
            { "id": "fish-audio/s2-pro", "name": "Fish Audio: S2 Pro",
              "output_modalities": [{ "type": "speech", "supported_parameters": {
                "voice": { "type": "unknown" },
                "response_format": { "type": "enum", "values": ["mp3", "pcm", "wav"] } } }] }
        ] })
    }

    #[test]
    fn parse_catalog_joins_the_two_endpoints_by_id() {
        let models = parse_catalog(&sample_prices(), &sample_speech());
        let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
        // Ordenado por nome.
        assert_eq!(
            ids,
            [
                "elevenlabs/eleven-v4-turbo",
                "fish-audio/s2-pro",
                "google/gemini-3.8-flash-tts",
                "minimax/speech-2.8-hd"
            ]
        );

        let gemini = models.iter().find(|m| m.id == "google/gemini-3.8-flash-tts").unwrap();
        // Preço do primeiro endereço; vozes e formatos do segundo.
        assert_eq!(gemini.prompt_price, 0.0000005);
        assert_eq!(gemini.completion_price, 0.000009);
        assert_eq!(gemini.voices, strings(&["Zephyr", "Puck", "Kore"]));
        assert_eq!(gemini.formats, strings(&["pcm", "wav"]));

        let eleven = models.iter().find(|m| m.id == "elevenlabs/eleven-v4-turbo").unwrap();
        assert_eq!(eleven.prompt_price, 0.00004);
        assert_eq!(eleven.completion_price, 0.0);
        assert_eq!(eleven.formats, strings(&["mp3", "pcm"]));
    }

    #[test]
    fn parse_catalog_handles_models_without_voices_or_without_the_second_endpoint() {
        let models = parse_catalog(&sample_prices(), &sample_speech());
        // Voz "unknown" no segundo e nenhuma no primeiro: lista vazia.
        let fish = models.iter().find(|m| m.id == "fish-audio/s2-pro").unwrap();
        assert!(fish.voices.is_empty());
        assert_eq!(fish.formats, strings(&["mp3", "pcm", "wav"]));
        // Só no primeiro endereço: as vozes vêm dele e não há formatos (vira mp3).
        let minimax = models.iter().find(|m| m.id == "minimax/speech-2.8-hd").unwrap();
        assert_eq!(minimax.voices, strings(&["Narrator"]));
        assert!(minimax.formats.is_empty());
        assert_eq!(choose_format(&minimax.formats), "mp3");
    }

    #[test]
    fn parse_catalog_keeps_a_model_that_only_the_second_endpoint_lists() {
        let prices = json!({ "data": [] });
        let models = parse_catalog(&prices, &sample_speech());
        assert_eq!(models.len(), 3);
        assert!(models.iter().all(|m| m.prompt_price == 0.0 && m.completion_price == 0.0));
    }

    #[test]
    fn parse_catalog_on_unexpected_json_gives_an_empty_list() {
        assert!(parse_catalog(&json!({}), &json!({ "data": "x" })).is_empty());
    }

    #[test]
    fn choose_format_prefers_mp3_then_wav_then_pcm() {
        assert_eq!(choose_format(&strings(&["pcm", "mp3", "wav"])), "mp3");
        assert_eq!(choose_format(&strings(&["pcm", "wav"])), "wav");
        assert_eq!(choose_format(&strings(&["pcm"])), "pcm");
        // Sem formato conhecido: mp3, nunca pcm às cegas.
        assert_eq!(choose_format(&[]), "mp3");
        assert_eq!(choose_format(&strings(&["flac"])), "mp3");
    }

    // Trecho inventado no formato dos dois catálogos: dois ids `:free` só no
    // primeiro endereço (os pagos estão nos dois), um MiniMax só no primeiro e o
    // Gemini nos dois.
    fn partial_catalog() -> Vec<TtsModel> {
        let prices = json!({ "data": [
            { "id": "heygen/voice-turbo:free", "name": "HeyGen: Voice Turbo (free)",
              "pricing": { "prompt": "0", "completion": "0" }, "supported_voices": ["Ana"] },
            { "id": "heygen/voice-turbo", "name": "HeyGen: Voice Turbo",
              "pricing": { "prompt": "0.00001", "completion": "0" } },
            { "id": "fish-audio/s2-free:free", "name": "Fish Audio: S2 (free)",
              "pricing": { "prompt": "0", "completion": "0" } },
            { "id": "fish-audio/s2-free", "name": "Fish Audio: S2",
              "pricing": { "prompt": "0.00002", "completion": "0" } },
            { "id": "minimax/speech-2.8-turbo", "name": "MiniMax: Speech 2.8 Turbo",
              "pricing": { "prompt": "0.00003", "completion": "0" }, "supported_voices": ["Narrator"] },
            { "id": "google/gemini-3.8-flash-tts", "name": "Google: Gemini 3.8 Flash TTS",
              "pricing": { "prompt": "0.0000005", "completion": "0.000009" } }
        ] });
        let speech = json!({ "data": [
            { "id": "heygen/voice-turbo", "name": "HeyGen: Voice Turbo",
              "output_modalities": [{ "type": "speech", "supported_parameters": {
                "voice": { "type": "enum", "values": ["Ana", "Bruno"] },
                "response_format": { "type": "enum", "values": ["pcm"] } } }] },
            { "id": "fish-audio/s2-free", "name": "Fish Audio: S2",
              "output_modalities": [{ "type": "speech", "supported_parameters": {
                "voice": { "type": "unknown" },
                "response_format": { "type": "enum", "values": ["mp3", "pcm", "wav"] } } }] },
            { "id": "google/gemini-3.8-flash-tts", "name": "Google: Gemini 3.8 Flash TTS",
              "output_modalities": [{ "type": "speech", "supported_parameters": {
                "voice": { "type": "enum", "values": ["Zephyr", "Puck"] },
                "response_format": { "type": "enum", "values": ["pcm", "wav"] } } }] }
        ] });
        parse_catalog(&prices, &speech)
    }

    #[test]
    fn a_model_without_formats_never_falls_back_to_pcm_at_an_unknown_rate() {
        let models = partial_catalog();
        // O `:free` herda os formatos do id sem o sufixo (o HeyGen só tem pcm, e a
        // taxa dele está em `pcm_rate`; o Fish aceita mp3).
        let heygen_free = models.iter().find(|m| m.id == "heygen/voice-turbo:free").unwrap();
        assert!(heygen_free.formats.is_empty());
        assert_eq!(request_format(&models, "heygen/voice-turbo:free"), "pcm");
        assert_eq!(request_format(&models, "fish-audio/s2-free:free"), "mp3");
        // Sem irmão no segundo endereço: mp3.
        assert_eq!(request_format(&models, "minimax/speech-2.8-turbo"), "mp3");
        // Modelo que o catálogo nem lista: mp3.
        assert_eq!(request_format(&models, "acme/voice-9"), "mp3");
        // O padrão do projeto não aceita mp3 e usa o que o catálogo diz.
        assert_eq!(request_format(&models, "google/gemini-3.8-flash-tts"), "wav");
    }

    #[test]
    fn without_any_catalog_the_request_asks_for_the_endpoint_default() {
        assert_eq!(request_format(&[], "google/gemini-3.8-flash-tts"), "pcm");
    }

    #[test]
    fn default_voice_is_the_first_of_the_model_or_of_its_base_id() {
        let models = partial_catalog();
        assert_eq!(default_voice(&models, "google/gemini-3.8-flash-tts"), Some("Zephyr".to_string()));
        // O `:free` tem a lista do primeiro endereço; sem ela, a do irmão.
        assert_eq!(default_voice(&models, "heygen/voice-turbo:free"), Some("Ana".to_string()));
        assert_eq!(default_voice(&models, "heygen/voice-turbo"), Some("Ana".to_string()));
        // Fish não lista voz: o pedido segue sem.
        assert_eq!(default_voice(&models, "fish-audio/s2-free:free"), None);
        assert_eq!(default_voice(&[], "google/gemini-3.8-flash-tts"), None);
    }

    #[test]
    fn normalize_text_trims_and_collapses_whitespace() {
        assert_eq!(normalize_text("  Elle \n sursauta.\t "), "Elle sursauta.");
        assert_eq!(normalize_text("   "), "");
    }

    #[test]
    fn cache_key_is_stable_across_versions() {
        // Vetor fixo: se o hash mudar, o cache de todo mundo vira lixo.
        assert_eq!(
            cache_key("google/gemini-3.8-flash-tts", Some("Kore"), "La porte du grenier était entrebâillée."),
            "073afc0c591594bb57991bed7dec7e87a3c0365471dd6cbcefb698dbf339c41e"
        );
        assert_eq!(
            cache_key("google/gemini-3.8-flash-tts", None, "La porte du grenier était entrebâillée."),
            "abf7fee8809a456f3c3c761837a7007939756bcaaadfa5f995f90e98bf62add4"
        );
    }

    #[test]
    fn cache_key_changes_with_model_voice_and_text_but_not_with_extra_spaces() {
        let base = cache_key("google/gemini-3.8-flash-tts", Some("Kore"), "Elle sursauta.");
        assert_ne!(base, cache_key("elevenlabs/eleven-v4-turbo", Some("Kore"), "Elle sursauta."));
        assert_ne!(base, cache_key("google/gemini-3.8-flash-tts", Some("Puck"), "Elle sursauta."));
        assert_ne!(base, cache_key("google/gemini-3.8-flash-tts", None, "Elle sursauta."));
        assert_ne!(base, cache_key("google/gemini-3.8-flash-tts", Some("Kore"), "Elle sursauta"));
        assert_eq!(base, cache_key("google/gemini-3.8-flash-tts", Some("Kore"), "  Elle \n sursauta.  "));
        // Sem voz e voz vazia são a mesma chave.
        assert_eq!(
            cache_key("google/gemini-3.8-flash-tts", None, "Elle sursauta."),
            cache_key("google/gemini-3.8-flash-tts", Some(""), "Elle sursauta.")
        );
    }

    #[test]
    fn speech_body_has_no_speed_and_no_voice_when_none() {
        let body = build_speech_body("google/gemini-3.8-flash-tts", None, "Elle sursauta.", "wav");
        assert_eq!(
            body,
            json!({ "model": "google/gemini-3.8-flash-tts", "input": "Elle sursauta.", "response_format": "wav" })
        );
        let with_voice = build_speech_body("elevenlabs/eleven-v4-turbo", Some("george"), "Elle sursauta.", "mp3");
        assert_eq!(with_voice["voice"], "george");
        assert_eq!(with_voice["response_format"], "mp3");
        assert!(with_voice.get("speed").is_none());
    }

    #[test]
    fn pcm_rate_comes_from_the_content_type_or_defaults_to_24k() {
        let model = "google/gemini-3.8-flash-tts";
        assert_eq!(pcm_rate(Some("audio/pcm;rate=44100"), model), 44_100);
        assert_eq!(pcm_rate(Some("audio/L16; Rate=\"16000\"; channels=1"), model), 16_000);
        assert_eq!(pcm_rate(Some("audio/pcm"), model), 24_000);
        assert_eq!(pcm_rate(Some("audio/pcm;rate=abc"), model), 24_000);
        assert_eq!(pcm_rate(Some("audio/pcm;rate=5"), model), 24_000);
        assert_eq!(pcm_rate(None, model), 24_000);
    }

    #[test]
    fn heygen_pcm_without_a_rate_is_44k_and_the_header_still_wins() {
        // A única exceção por provedor: pela documentação, o PCM do HeyGen é 44,1 kHz.
        assert_eq!(pcm_rate(Some("audio/pcm"), "heygen/voice-turbo"), 44_100);
        assert_eq!(pcm_rate(Some("audio/pcm"), "heygen/voice-turbo:free"), 44_100);
        assert_eq!(pcm_rate(None, "heygen/voice-turbo"), 44_100);
        assert_eq!(pcm_rate(Some("audio/pcm;rate=16000"), "heygen/voice-turbo"), 16_000);
        assert_eq!(pcm_rate(Some("audio/pcm"), "minimax/speech-2.8-turbo"), 24_000);
    }

    #[test]
    fn the_duration_check_cannot_catch_pcm_read_at_the_wrong_rate() {
        // 100 caracteres a 15 por segundo: 6,7 s de fala a 44,1 kHz. Lido a 24 kHz
        // mede 12,3 s, abaixo do teto de 30 s: passa, e ficaria no cache. Por isso a
        // taxa certa tem de vir de `pcm_rate`, não da checagem.
        let samples = (6.67 * 44_100.0) as usize;
        let wav = wav_from_pcm(&pcm_samples(samples), pcm_rate(Some("audio/pcm"), "acme/voice-9"));
        let slow = audio_duration_secs(&wav).unwrap();
        assert!((slow - 12.3).abs() < 0.1, "got {slow}");
        assert!(duration_plausible(100, slow));
        let right = audio_duration_secs(&wav_from_pcm(&pcm_samples(samples), 44_100)).unwrap();
        assert!((right - 6.67).abs() < 0.01, "got {right}");
    }

    fn pcm_samples(count: usize) -> Vec<u8> {
        (0..count).flat_map(|i| ((i % 100) as i16 - 50).to_le_bytes()).collect()
    }

    #[test]
    fn wav_from_pcm_reads_back_with_the_right_rate_and_duration() {
        let wav = wav_from_pcm(&pcm_samples(48_000), 24_000);
        assert_eq!(wav.len(), 44 + 96_000);
        let reader = hound::WavReader::new(Cursor::new(&wav)).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.sample_rate, 24_000);
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.bits_per_sample, 16);
        assert_eq!(reader.duration(), 48_000);
        assert_eq!(audio_duration_secs(&wav), Some(2.0));
    }

    #[test]
    fn wav_from_pcm_drops_a_dangling_byte() {
        let mut pcm = pcm_samples(10);
        pcm.push(7);
        let wav = wav_from_pcm(&pcm, 24_000);
        assert_eq!(wav.len(), 44 + 20);
        assert_eq!(hound::WavReader::new(Cursor::new(&wav)).unwrap().duration(), 10);
    }

    #[test]
    fn a_streamed_wav_with_placeholder_sizes_is_fixed_and_then_measured() {
        // Na ordem de tts_speak: os tamanhos são acertados antes de medir.
        for placeholder in [0u32, 0xFFFF_FFFF] {
            let mut wav = wav_from_pcm(&pcm_samples(12_000), 24_000);
            wav[40..44].copy_from_slice(&placeholder.to_le_bytes());
            wav[4..8].copy_from_slice(&placeholder.to_le_bytes());
            fix_wav_sizes(&mut wav);
            assert_eq!(u32::from_le_bytes(wav[40..44].try_into().unwrap()), 24_000);
            assert_eq!(u32::from_le_bytes(wav[4..8].try_into().unwrap()), 24_036);
            assert_eq!(hound::WavReader::new(Cursor::new(&wav)).unwrap().duration(), 12_000);
            assert_eq!(audio_duration_secs(&wav), Some(0.5), "placeholder {placeholder:#x}");
        }
    }

    #[test]
    fn a_wav_header_that_declares_zero_is_still_measured_by_what_arrived() {
        let mut wav = wav_from_pcm(&pcm_samples(12_000), 24_000);
        wav[40..44].copy_from_slice(&0u32.to_le_bytes());
        assert_eq!(audio_duration_secs(&wav), Some(0.5));
    }

    #[test]
    fn fix_wav_sizes_leaves_a_good_wav_alone() {
        let wav = wav_from_pcm(&pcm_samples(100), 24_000);
        let mut copy = wav.clone();
        fix_wav_sizes(&mut copy);
        assert_eq!(wav, copy);
    }

    // Frames MPEG-1 Layer III de 128 kbps e 44,1 kHz: cabeçalho 0xFFFB9064 e corpo
    // zerado, 417 bytes cada (144 × 128000 / 44100, sem padding).
    fn synthetic_mp3(frames: usize) -> Vec<u8> {
        let mut out = Vec::new();
        for _ in 0..frames {
            out.extend_from_slice(&[0xFF, 0xFB, 0x90, 0x64]);
            out.extend(std::iter::repeat(0u8).take(417 - 4));
        }
        out
    }

    #[test]
    fn mp3_duration_sums_the_frames() {
        let secs = audio_duration_secs(&synthetic_mp3(100)).unwrap();
        assert!((secs - 100.0 * 1152.0 / 44_100.0).abs() < 1e-9, "got {secs}");
    }

    #[test]
    fn mp3_duration_skips_the_id3v2_tag_and_trailing_bytes() {
        let mut bytes = b"ID3\x04\x00\x00\x00\x00\x01\x00".to_vec(); // tamanho syncsafe = 128
        bytes.extend(std::iter::repeat(0u8).take(128));
        bytes.extend(synthetic_mp3(50));
        bytes.extend(std::iter::repeat(b'T').take(128)); // tag ID3v1 ao fim
        let secs = audio_duration_secs(&bytes).unwrap();
        assert!((secs - 50.0 * 1152.0 / 44_100.0).abs() < 1e-9, "got {secs}");
    }

    #[test]
    fn mp3_duration_handles_mpeg2_layer_iii() {
        // MPEG-2, Layer III, 64 kbps, 22,05 kHz: 72 × 64000 / 22050 = 208 bytes.
        let mut bytes = Vec::new();
        for _ in 0..40 {
            bytes.extend_from_slice(&[0xFF, 0xF3, 0x80, 0x64]);
            bytes.extend(std::iter::repeat(0u8).take(208 - 4));
        }
        let secs = audio_duration_secs(&bytes).unwrap();
        assert!((secs - 40.0 * 576.0 / 22_050.0).abs() < 1e-9, "got {secs}");
    }

    #[test]
    fn unrecognized_audio_has_no_duration() {
        assert_eq!(audio_duration_secs(b"{\"error\":\"nope\"}"), None);
        assert_eq!(audio_duration_secs(&[]), None);
        assert_eq!(audio_duration_secs(&[0u8; 5000]), None);
    }

    #[test]
    fn duration_plausible_at_the_limits() {
        // Longo demais: secs > chars/4 + 5.
        assert!(duration_plausible(40, 15.0));
        assert!(!duration_plausible(40, 15.01));
        // Curto demais: só com chars >= 20, e secs < chars/40.
        assert!(duration_plausible(400, 10.0));
        assert!(!duration_plausible(400, 9.99));
        assert!(duration_plausible(19, 0.0));
        assert!(!duration_plausible(20, 0.4));
        assert!(duration_plausible(20, 0.5));
        // Uma frase cheia de algarismos (muitas sílabas) passa.
        assert!(duration_plausible(60, 12.0));
        // Fala normal (15 caracteres por segundo).
        assert!(duration_plausible(150, 10.0));
    }

    #[test]
    fn speech_error_maps_each_status_to_a_sentence() {
        let cases = [
            (400, "model", "This voice model didn't accept the request."),
            (401, "auth", "OpenRouter didn't accept the key. Check it in Settings."),
            (402, "no_credit", "OpenRouter has no credit left for audio."),
            (403, "refused", "OpenRouter refused this text."),
            (404, "model", "This voice model didn't accept the request."),
            (413, "too_long", "This sentence is too long for the voice model."),
            (429, "rate_limit", "Too many requests to the voice model. Wait a moment."),
            (500, "server", "The voice model is unavailable right now."),
            (502, "server", "The voice model is unavailable right now."),
            (503, "server", "The voice model is unavailable right now."),
            (524, "server", "The voice model is unavailable right now."),
            (529, "server", "The voice model is unavailable right now."),
        ];
        for (status, kind, sentence) in cases {
            let err = speech_error(status, "");
            assert_eq!(err.kind, kind, "status {status}");
            assert_eq!(err.message, sentence, "status {status}");
        }
    }

    #[test]
    fn speech_error_adds_the_provider_message_after_a_blank_line_cut_at_300() {
        let body = r#"{"error":{"code":400,"message":"voice 'Zoe' is not available"}}"#;
        let err = speech_error(400, body);
        assert_eq!(
            err.message,
            "This voice model didn't accept the request.\n\nvoice 'Zoe' is not available"
        );
        let long = format!(r#"{{"error":{{"message":"{}"}}}}"#, "x".repeat(500));
        let err = speech_error(500, &long);
        let (sentence, detail) = err.message.split_once("\n\n").unwrap();
        assert_eq!(sentence, "The voice model is unavailable right now.");
        assert_eq!(detail.chars().count(), 300);
        // Corpo que não é JSON vira o detalhe, também cortado.
        let err = speech_error(503, "  upstream timeout  ");
        assert!(err.message.ends_with("\n\nupstream timeout"));
    }

    #[test]
    fn network_error_has_a_sentence_and_the_detail() {
        let err = network_speech_error("connection refused");
        assert_eq!(err.kind, "network");
        assert_eq!(
            err.message,
            "Couldn't generate the audio. Check your connection.\n\nconnection refused"
        );
    }

    #[test]
    fn errors_serialize_as_kind_and_message() {
        let err = tts_error("no_key", "Add your OpenRouter key in Settings to listen.");
        assert_eq!(
            serde_json::to_value(&err).unwrap(),
            json!({ "kind": "no_key", "message": "Add your OpenRouter key in Settings to listen." })
        );
    }

    #[test]
    fn valid_book_id_accepts_uuids_and_rejects_paths() {
        assert!(valid_book_id("3f2b8c1e-9a47-4d0e-8f55-0c1d2e3f4a5b"));
        assert!(valid_book_id("book_1"));
        assert!(valid_book_id(&"a".repeat(64)));
        assert!(!valid_book_id(""));
        assert!(!valid_book_id(&"a".repeat(65)));
        assert!(!valid_book_id("../books"));
        assert!(!valid_book_id("a/b"));
        assert!(!valid_book_id("a\\b"));
        assert!(!valid_book_id("a b"));
        assert!(!valid_book_id("é"));
    }

    #[test]
    fn record_usage_adds_characters_by_book_model_and_month() {
        let mut usage = TtsUsage::default();
        record_usage(&mut usage, "book-1", "google/gemini-3.8-flash-tts", 120, "2026-11");
        record_usage(&mut usage, "book-1", "google/gemini-3.8-flash-tts", 80, "2026-11");
        record_usage(&mut usage, "book-1", "elevenlabs/eleven-v4-turbo", 50, "2026-11");
        record_usage(&mut usage, "_shared", "google/gemini-3.8-flash-tts", 30, "2026-12");
        assert_eq!(usage.books["book-1"]["google/gemini-3.8-flash-tts"], 200);
        assert_eq!(usage.books["book-1"]["elevenlabs/eleven-v4-turbo"], 50);
        assert_eq!(usage.books["_shared"]["google/gemini-3.8-flash-tts"], 30);
        assert_eq!(usage.months["2026-11"]["google/gemini-3.8-flash-tts"], 200);
        assert_eq!(usage.months["2026-11"]["elevenlabs/eleven-v4-turbo"], 50);
        assert_eq!(usage.months["2026-12"]["google/gemini-3.8-flash-tts"], 30);
    }

    #[test]
    fn usage_round_trips_through_json_in_camel_case() {
        let mut usage = TtsUsage::default();
        record_usage(&mut usage, "book-1", "google/gemini-3.8-flash-tts", 7, "2026-11");
        let json = serde_json::to_string(&usage).unwrap();
        assert!(json.contains("\"books\"") && json.contains("\"months\""));
        assert_eq!(serde_json::from_str::<TtsUsage>(&json).unwrap(), usage);
    }

    #[test]
    fn cache_path_uses_the_book_folder_or_the_shared_one() {
        let root = Path::new("tts-root");
        assert_eq!(cache_path(root, Some("book-1"), "abc"), root.join("book-1").join("abc.mp3"));
        assert_eq!(cache_path(root, None, "abc"), root.join("_shared").join("abc.mp3"));
    }

    #[test]
    fn write_atomic_creates_the_folder_and_leaves_no_temporary_file() {
        let root = temp_root();
        let path = cache_path(&root, Some("book-1"), "abc");
        write_atomic(&path, b"audio").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"audio");
        let names: Vec<String> = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(names, ["abc.mp3"]);
        // Reescrever troca o conteúdo inteiro.
        write_atomic(&path, b"new").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"new");
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn cache_size_counts_only_mp3_files_in_book_folders() {
        let root = temp_root();
        assert_eq!(cache_size(&root), TtsCacheSize { files: 0, bytes: 0 });
        write_atomic(&cache_path(&root, Some("book-1"), "a"), &[0u8; 100]).unwrap();
        write_atomic(&cache_path(&root, Some("book-1"), "b"), &[0u8; 50]).unwrap();
        write_atomic(&cache_path(&root, None, "c"), &[0u8; 10]).unwrap();
        // Não contam: temporário, wav de conversão, usage.json e catalog.json.
        fs::write(root.join("book-1").join("d.1234.tmp"), [0u8; 999]).unwrap();
        fs::write(root.join("book-1").join("e.1234.wav"), [0u8; 999]).unwrap();
        fs::write(root.join("usage.json"), "{}").unwrap();
        fs::write(root.join("catalog.json"), "[]").unwrap();
        assert_eq!(cache_size(&root), TtsCacheSize { files: 3, bytes: 160 });
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn clear_audio_removes_the_folders_and_keeps_usage_and_catalog() {
        let root = temp_root();
        write_atomic(&cache_path(&root, Some("book-1"), "a"), b"x").unwrap();
        write_atomic(&cache_path(&root, None, "b"), b"x").unwrap();
        fs::write(root.join("usage.json"), "{}").unwrap();
        fs::write(root.join("catalog.json"), "[]").unwrap();
        clear_audio(&root).unwrap();
        assert_eq!(cache_size(&root), TtsCacheSize { files: 0, bytes: 0 });
        assert!(!root.join("book-1").exists() && !root.join("_shared").exists());
        assert!(root.join("usage.json").exists() && root.join("catalog.json").exists());
        // Pasta que não existe: nada a apagar.
        fs::remove_dir_all(&root).unwrap();
        assert!(clear_audio(&root).is_ok());
    }
}
