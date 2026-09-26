use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Once;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const LOG_PREFIX: &str = "coolapk-diagnostics";
const MAX_FILES: usize = 5;
const MAX_TAIL_BYTES: usize = 2_000_000;
const SESSION_MARKER: &str = "coolapk-session.marker";
static VERBOSE: AtomicBool = AtomicBool::new(false);
static PANIC_HOOK: Once = Once::new();

pub fn install_panic_hook() {
    PANIC_HOOK.call_once(|| {
        let previous = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            let thread = std::thread::current();
            let location = info
                .location()
                .map(|value| format!("{}:{}:{}", value.file(), value.line(), value.column()))
                .unwrap_or_else(|| "unknown".to_string());
            // Panic 载荷可能包含账号或请求数据，只记录线程和代码位置。
            log::error!(
                "runtime.panic thread={} location={}",
                thread.name().unwrap_or("unnamed"),
                location
            );
            previous(info);
        }));
    });
}

fn create_session_marker(path: &Path) -> std::io::Result<bool> {
    let previous_unclean = path.exists();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let started_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs());
    fs::write(path, format!("pid={} started_at={started_at}\n", std::process::id()))?;
    Ok(previous_unclean)
}

pub fn begin_session(app: &tauri::AppHandle) {
    let marker = log_dir(app).map(|dir| dir.join(SESSION_MARKER));
    match marker.and_then(|path| create_session_marker(&path).map_err(|_| "write failed".to_string())) {
        Ok(previous_unclean) => log::info!(
            "runtime.started version={} os={} arch={} pid={} previous_exit_unclean={}",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS,
            std::env::consts::ARCH,
            std::process::id(),
            previous_unclean
        ),
        Err(_) => log::warn!("runtime.session_marker_failed operation=start"),
    }
}

pub fn end_session(app: &tauri::AppHandle) {
    log::info!("runtime.exit_normal pid={}", std::process::id());
    if let Ok(dir) = log_dir(app) {
        let marker = dir.join(SESSION_MARKER);
        if marker.exists() && fs::remove_file(marker).is_err() {
            log::warn!("runtime.session_marker_failed operation=exit");
        }
    }
}

pub fn verbose_enabled() -> bool {
    VERBOSE.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn get_diagnostic_verbose() -> bool {
    verbose_enabled()
}

#[tauri::command]
pub fn set_diagnostic_verbose(enabled: bool) {
    VERBOSE.store(enabled, Ordering::Relaxed);
    log::info!("diagnostics.verbose_changed enabled={enabled}");
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticFile {
    name: String,
    size: u64,
    modified_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticSnapshot {
    files: Vec<DiagnosticFile>,
    content: String,
    directory: String,
}

fn log_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_log_dir().map_err(|error| error.to_string())
}

fn is_diagnostic_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with(LOG_PREFIX) && name.contains(".log"))
}

fn list_log_paths(dir: &Path) -> Result<Vec<PathBuf>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut paths = Vec::new();
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.is_file() && is_diagnostic_file(&path) {
            paths.push(path);
        }
    }
    paths.sort_by_key(|path| path.metadata().and_then(|meta| meta.modified()).ok());
    Ok(paths)
}

#[tauri::command]
pub fn get_diagnostic_logs(app: tauri::AppHandle) -> Result<DiagnosticSnapshot, String> {
    let dir = log_dir(&app)?;
    let paths = list_log_paths(&dir)?;
    let mut files = Vec::new();
    let mut content = String::new();
    for path in paths.iter().rev().take(MAX_FILES).rev() {
        let metadata = path.metadata().map_err(|error| error.to_string())?;
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let bytes = fs::read(path).map_err(|error| error.to_string())?;
        let tail = &bytes[bytes.len().saturating_sub(MAX_TAIL_BYTES)..];
        content.push_str(&format!("\n===== {name} =====\n"));
        content.push_str(&String::from_utf8_lossy(tail));
        files.push(DiagnosticFile {
            name,
            size: metadata.len(),
            modified_at: metadata.modified().ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |duration| duration.as_secs()),
        });
    }
    Ok(DiagnosticSnapshot {
        files,
        content,
        directory: dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn clear_diagnostic_logs(app: tauri::AppHandle) -> Result<usize, String> {
    let dir = log_dir(&app)?;
    let paths = list_log_paths(&dir)?;
    let mut cleared = 0;
    for path in paths {
        if path.file_name().and_then(|name| name.to_str()) == Some("coolapk-diagnostics.log") {
            fs::OpenOptions::new().write(true).open(&path)
                .and_then(|file| file.set_len(0))
                .map_err(|error| format!("清空当前日志失败：{error}"))?;
        } else {
            fs::remove_file(&path).map_err(|error| format!("清理旧日志失败：{error}"))?;
        }
        cleared += 1;
    }
    Ok(cleared)
}

#[cfg(test)]
mod tests {
    use super::{create_session_marker, is_diagnostic_file};
    use std::path::Path;

    #[test]
    fn only_reads_own_log_files() {
        assert!(is_diagnostic_file(Path::new("coolapk-diagnostics.log")));
        assert!(is_diagnostic_file(Path::new("coolapk-diagnostics.log.2026-09-26")));
        assert!(!is_diagnostic_file(Path::new("other-app.log")));
        assert!(!is_diagnostic_file(Path::new("coolapk-diagnostics.txt")));
    }

    #[test]
    fn session_marker_identifies_unclean_restart() {
        let path = std::env::temp_dir().join(format!("coolapk-session-test-{}.marker", std::process::id()));
        let _ = std::fs::remove_file(&path);
        assert!(!create_session_marker(&path).unwrap());
        assert!(create_session_marker(&path).unwrap());
        std::fs::remove_file(&path).unwrap();
        assert!(!create_session_marker(&path).unwrap());
        std::fs::remove_file(path).unwrap();
    }
}
