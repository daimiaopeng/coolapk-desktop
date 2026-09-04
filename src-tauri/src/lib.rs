pub mod coolapk;

use coolapk::client::CoolapkClient;
use coolapk::commands::{
    AppState, add_config_compare, add_goods_to_goods_list, add_to_black_list, add_to_ignore_list,
    bind_feed_to_goods_list, change_product_wish_status, change_rating_status, check_login_info,
    check_login_status, check_update, clean_expired_cache, clear_app_cache, clear_user_cookie,
    close_login_window, create_feed, create_forward, create_goods_list, create_product_album,
    delete_feed, delete_goods_list_items, delete_reply, download_update, edit_goods_list,
    edit_goods_list_item, export_json_file, favorite_apk, favorite_feed, fetch_external_page,
    follow_collection, follow_dyh, follow_live, follow_tag, follow_user, get_album_detail, get_album_list,
    create_album, edit_album, add_album_apk, delete_album_apk,
    get_album_replies, get_apk_discoverers, get_apk_feeds, get_apk_gift_list, get_apk_qr,
    get_apk_rating_user_list, get_apk_recommend_list, get_apk_url, get_apk_related_apps,
    get_app_detail, get_apk_comments, get_app_list, get_black_list, get_board_feeds, get_cache_info,
    get_collection_detail, get_collection_item_list, get_collection_list,
    cleanup_update_packages, is_update_package_available,
    get_feed_collection_status, get_cool_picture_rank,
    get_device_feed_list, get_device_info, get_digest_feeds, get_download_version_list,
    get_discovery_config, get_discovery_page_data, get_live_detail,
    get_dyh_detail, get_dyh_feeds, get_dyh_list, get_dyh_follow_list, get_dyh_subscribe_list,
    get_dyh_editor_list, get_editor_choice_feeds, get_event_detail, get_event_list, get_fans_user_list,
    get_favorite_list, get_feed_change_history, get_feed_detail, get_feed_forward_list,
    get_feed_like_list, get_feed_replies, get_follow_user_list, get_following_feeds, get_game_list,
    get_goods_detail, get_goods_list, get_goods_list_types, get_goods_search_hot_words,
    get_goods_store_items, get_headline_feeds, get_hit_history, get_hot_feeds, get_hot_replies,
    get_spam_feed_list, get_hidden_replies, get_followed_topics,
    get_hot_topics,
    get_ignore_list, get_image_data_url, get_index_v8_entities_paged, get_index_v8_feeds, get_index_v8_feeds_paged, get_latest_feeds, get_limit_list, get_live_photo_video_header,
    get_goods_list_items, get_home_tab_config, get_load_config, get_my_goods_feeds,
    get_my_product_list, get_node_feeds, get_notification_count, clear_notification_count, get_notifications, get_picture_list,
    get_product_albums, get_product_brand_list, get_product_category_list, get_product_config,
    get_product_detail, get_product_detail_by_name, get_product_feeds, get_product_list, get_product_brand_products,
    get_product_media_list, get_product_rating_chart, get_product_rating_list, get_question_answers,
    get_user_product_albums,
    get_hot_searches, get_rank_feeds, get_recent_history, get_reply_detail, get_search_suggestions,
    resolve_live_photo_video, resolve_video_url,
    get_search_suggestions_app, get_secondhand_feeds, get_sub_replies, get_tab_config,
    update_home_tab_config, update_user_profile, update_user_cover, change_avatar,
    get_topic_detail, get_topic_detail_v7, get_topic_feeds, get_topic_tab_data, get_topic_hub_data, get_update_list,
    get_user_cookie, get_user_feeds, get_user_follow_nodes, get_user_forum_follow_list, get_user_like_list, get_user_album_list, get_user_profile, get_user_rating_list,
    get_user_qr_image, get_user_space, get_user_tab_data, get_vote_comments, create_user_vote, install_update, like_collection, like_feed, like_reply, list_accounts,
    list_chat_history, delete_message_chat, list_messages, get_recent_chat_users, login_as, login_by_account, login_by_mobile,
    open_cache_directory, open_image_in_system_viewer, open_login_webview, open_url, persist_current_account, quit_app,
    read_message, remove_account, remove_from_black_list, remove_from_ignore_list, reply_feed,
    comment_apk,
    cancel_follower, special_follow_user, update_user_remark,
    save_account, save_cookie_securely, save_image, search_albums, search_all, search_apks, search_by_type,
    search_apks_by_developer, search_apks_by_tag, search_feed_topics, search_feeds, search_games,
    search_goods, search_tags, search_users, send_private_image, send_private_message, send_sms_vcode,
    remove_config_compare, get_product_wish_list, get_product_buy_list,
    unfavorite_apk, unfavorite_feed, unfollow_collection, unfollow_dyh, unfollow_live, unfollow_tag,
    update_collection_item,
    unfollow_user, unlike_collection, unlike_feed, unlike_reply, update_device_profile, upload_image,
    vote_goods_list_item,
};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tauri::{Manager, WindowEvent};

static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(false);
static START_MINIMIZED: AtomicBool = AtomicBool::new(false);
static REMEMBER_WINDOW_STATE: AtomicBool = AtomicBool::new(true);
static ALWAYS_ON_TOP: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct WindowState {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ScreenRect {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
}

static WINDOW_STATE: Mutex<Option<WindowState>> = Mutex::new(None);
static STARTUP_STATE_LOCK: Mutex<()> = Mutex::new(());
static STARTUP_STATE_TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

const STARTUP_STATE_FILE: &str = "startup_state.json";
const MIN_WINDOW_W: u32 = 800;
const MIN_WINDOW_H: u32 = 600;

fn startup_state_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    Some(dir.join(STARTUP_STATE_FILE))
}

fn update_startup_state_file<F>(
    path: &std::path::Path,
    fallback: serde_json::Value,
    update: F,
) -> Result<(), String>
where
    F: FnOnce(&mut serde_json::Value),
{
    let _lock = STARTUP_STATE_LOCK
        .lock()
        .map_err(|_| "启动状态锁已损坏".to_string())?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }
    let mut state: serde_json::Value = std::fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or(fallback);
    if !state.is_object() {
        state = serde_json::json!({});
    }
    update(&mut state);
    let raw = serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?;
    atomic_write_startup_state(path, raw.as_bytes())
}

fn atomic_write_startup_state(path: &std::path::Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;

    let file_name = path
        .file_name()
        .ok_or_else(|| "启动状态文件路径无效".to_string())?;
    let sequence = STARTUP_STATE_TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let mut temp_name = file_name.to_os_string();
    temp_name.push(format!(".{}-{nonce}-{sequence}.tmp", std::process::id()));
    let temp_path = path.with_file_name(temp_name);
    let mut temp_file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .map_err(|error| format!("创建启动状态临时文件失败：{error}"))?;
    if let Err(error) = temp_file
        .write_all(bytes)
        .and_then(|_| temp_file.flush())
        .and_then(|_| temp_file.sync_all())
    {
        drop(temp_file);
        let _ = std::fs::remove_file(&temp_path);
        return Err(format!("写入启动状态临时文件失败：{error}"));
    }
    drop(temp_file);

    if let Err(error) = replace_startup_state_file(&temp_path, path) {
        let _ = std::fs::remove_file(&temp_path);
        return Err(error);
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn replace_startup_state_file(temp_path: &std::path::Path, path: &std::path::Path) -> Result<(), String> {
    std::fs::rename(temp_path, path).map_err(|error| format!("替换启动状态文件失败：{error}"))
}

#[cfg(target_os = "windows")]
fn replace_startup_state_file(temp_path: &std::path::Path, path: &std::path::Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Storage::FileSystem::{
        MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
    };
    use windows::core::PCWSTR;

    let source: Vec<u16> = temp_path.as_os_str().encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    unsafe {
        MoveFileExW(
            PCWSTR(source.as_ptr()),
            PCWSTR(target.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    }
    .map_err(|error| format!("替换启动状态文件失败：{error}"))
}

/// 合并写入窗口几何信息，保留已有的启动参数（静默启动/记忆窗口/置顶）
fn persist_window_geometry(app: &tauri::AppHandle, state: WindowState) {
    let path = match startup_state_path(app) {
        Some(p) => p,
        None => return,
    };
    let fallback = serde_json::json!({
        "start_minimized": START_MINIMIZED.load(Ordering::SeqCst),
        "remember_window_state": REMEMBER_WINDOW_STATE.load(Ordering::SeqCst),
        "always_on_top": ALWAYS_ON_TOP.load(Ordering::SeqCst)
    });
    let _ = update_startup_state_file(&path, fallback, |flags| {
        flags["x"] = serde_json::json!(state.x);
        flags["y"] = serde_json::json!(state.y);
        flags["w"] = serde_json::json!(state.w);
        flags["h"] = serde_json::json!(state.h);
    });
}

fn cached_window_state() -> Option<WindowState> {
    WINDOW_STATE
        .lock()
        .ok()
        .and_then(|guard| *guard)
        .filter(|state| state.w >= MIN_WINDOW_W && state.h >= MIN_WINDOW_H)
}

fn parse_saved_window_state(flags: &serde_json::Value) -> Option<WindowState> {
    let x: i32 = flags.get("x")?.as_i64()?.try_into().ok()?;
    let y: i32 = flags.get("y")?.as_i64()?.try_into().ok()?;
    let w: u32 = flags.get("w")?.as_u64()?.try_into().ok()?;
    let h: u32 = flags.get("h")?.as_u64()?.try_into().ok()?;
    if w < MIN_WINDOW_W || h < MIN_WINDOW_H {
        return None;
    }
    Some(WindowState { x, y, w, h })
}

fn intersection_size(window: WindowState, screen: ScreenRect) -> (u32, u32) {
    let left = i64::from(window.x).max(i64::from(screen.x));
    let top = i64::from(window.y).max(i64::from(screen.y));
    let right = (i64::from(window.x) + i64::from(window.w))
        .min(i64::from(screen.x) + i64::from(screen.w));
    let bottom = (i64::from(window.y) + i64::from(window.h))
        .min(i64::from(screen.y) + i64::from(screen.h));
    (
        right.saturating_sub(left).max(0) as u32,
        bottom.saturating_sub(top).max(0) as u32,
    )
}

fn restore_window_rect(
    saved: WindowState,
    screens: &[ScreenRect],
    primary: Option<ScreenRect>,
) -> WindowState {
    const MIN_VISIBLE: u32 = 64;
    if screens.is_empty() {
        return saved;
    }

    let visible_screen = screens
        .iter()
        .copied()
        .filter_map(|screen| {
            let (visible_w, visible_h) = intersection_size(saved, screen);
            (visible_w >= MIN_VISIBLE && visible_h >= MIN_VISIBLE)
                .then_some((u64::from(visible_w) * u64::from(visible_h), screen))
        })
        .max_by_key(|(area, _)| *area)
        .map(|(_, screen)| screen);
    let screen = visible_screen.or(primary).unwrap_or(screens[0]);
    let width = saved.w.clamp(MIN_WINDOW_W, screen.w.max(MIN_WINDOW_W));
    let height = saved.h.clamp(MIN_WINDOW_H, screen.h.max(MIN_WINDOW_H));

    let (x, y) = if visible_screen.is_some() {
        let min_x = i64::from(screen.x) - i64::from(width) + i64::from(MIN_VISIBLE);
        let max_x = i64::from(screen.x) + i64::from(screen.w) - i64::from(MIN_VISIBLE);
        let min_y = i64::from(screen.y) - i64::from(height) + i64::from(MIN_VISIBLE);
        let max_y = i64::from(screen.y) + i64::from(screen.h) - i64::from(MIN_VISIBLE);
        (
            i64::from(saved.x).clamp(min_x, max_x) as i32,
            i64::from(saved.y).clamp(min_y, max_y) as i32,
        )
    } else {
        (
            (i64::from(screen.x) + (i64::from(screen.w) - i64::from(width)) / 2) as i32,
            (i64::from(screen.y) + (i64::from(screen.h) - i64::from(height)) / 2) as i32,
        )
    };

    WindowState {
        x,
        y,
        w: width,
        h: height,
    }
}

pub(crate) fn persist_current_window_geometry(app: &tauri::AppHandle) {
    if !REMEMBER_WINDOW_STATE.load(Ordering::SeqCst) {
        return;
    }
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let state = match (window.outer_position(), window.inner_size()) {
        (Ok(pos), Ok(size)) if size.width >= MIN_WINDOW_W && size.height >= MIN_WINDOW_H => {
            Some(WindowState {
                x: pos.x,
                y: pos.y,
                w: size.width,
                h: size.height,
            })
        }
        _ => cached_window_state(),
    };
    if let Some(state) = state {
        persist_window_geometry(app, state);
    }
}

#[cfg(test)]
mod window_state_tests {
    use super::{
        MIN_WINDOW_H, MIN_WINDOW_W, ScreenRect, WindowState, parse_saved_window_state,
        restore_window_rect, update_startup_state_file,
    };

    #[test]
    fn parses_valid_window_geometry() {
        let value = serde_json::json!({"x": -120, "y": 45, "w": 1200, "h": 700});
        assert_eq!(parse_saved_window_state(&value), Some(WindowState { x: -120, y: 45, w: 1200, h: 700 }));
    }

    #[test]
    fn rejects_invalid_or_too_small_window_geometry() {
        let too_small = serde_json::json!({"x": 0, "y": 0, "w": MIN_WINDOW_W - 1, "h": MIN_WINDOW_H});
        let wrong_type = serde_json::json!({"x": 0.5, "y": 0, "w": MIN_WINDOW_W, "h": MIN_WINDOW_H});
        assert!(parse_saved_window_state(&too_small).is_none());
        assert!(parse_saved_window_state(&wrong_type).is_none());
    }

    #[test]
    fn preserves_visible_window_geometry() {
        let screen = ScreenRect { x: 0, y: 0, w: 1920, h: 1080 };
        let saved = WindowState { x: 120, y: 80, w: 1200, h: 700 };
        assert_eq!(restore_window_rect(saved, &[screen], Some(screen)), saved);
    }

    #[test]
    fn recenters_window_that_is_completely_off_screen() {
        let screen = ScreenRect { x: 0, y: 0, w: 1920, h: 1080 };
        let saved = WindowState { x: 3000, y: 200, w: 1200, h: 700 };
        assert_eq!(
            restore_window_rect(saved, &[screen], Some(screen)),
            WindowState { x: 360, y: 190, w: 1200, h: 700 }
        );
    }

    #[test]
    fn startup_state_updates_preserve_geometry_and_flags() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("coolapk-startup-state-{unique}"));
        let path = root.join("startup_state.json");

        update_startup_state_file(&path, serde_json::json!({}), |state| {
            state["x"] = serde_json::json!(100);
            state["y"] = serde_json::json!(80);
            state["w"] = serde_json::json!(1200);
            state["h"] = serde_json::json!(700);
        })
        .unwrap();
        update_startup_state_file(&path, serde_json::json!({}), |state| {
            state["start_minimized"] = serde_json::json!(true);
            state["remember_window_state"] = serde_json::json!(true);
            state["always_on_top"] = serde_json::json!(false);
        })
        .unwrap();

        let state: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(state["x"], 100);
        assert_eq!(state["w"], 1200);
        assert_eq!(state["start_minimized"], true);
        assert_eq!(state["remember_window_state"], true);
        let _ = std::fs::remove_dir_all(root);
    }
}

#[tauri::command]
fn set_close_to_tray(enabled: bool) {
    CLOSE_TO_TRAY.store(enabled, Ordering::SeqCst);
}

#[tauri::command]
fn get_platform_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

#[cfg(windows)]
fn windows_notification_icon_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join("coolapk-notification-icon.png");
    let icon = include_bytes!("../icons/icon.png");
    if std::fs::read(&path).ok().as_deref() != Some(icon.as_slice()) {
        std::fs::write(&path, icon).map_err(|error| error.to_string())?;
    }
    Ok(path)
}

#[cfg(windows)]
fn register_windows_notification_identity(app: &tauri::AppHandle) -> Result<(), String> {
    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    let identifier = &app.config().identifier;
    let display_name = app
        .config()
        .product_name
        .clone()
        .unwrap_or_else(|| "酷安".to_string());
    let icon_path = windows_notification_icon_path(app)?;
    let registry = RegKey::predef(HKEY_CURRENT_USER);
    let path = format!("Software\\Classes\\AppUserModelId\\{identifier}");
    let (key, _) = registry
        .create_subkey(path)
        .map_err(|error| error.to_string())?;
    key.set_value("DisplayName", &display_name)
        .map_err(|error| error.to_string())?;
    key.set_value("IconUri", &icon_path.to_string_lossy().to_string())
        .map_err(|error| error.to_string())?;
    key.set_value("IconBackgroundColor", &"00B578")
        .map_err(|error| error.to_string())?;
    key.set_value("ShowInSettings", &1_u32)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(windows)]
fn escape_notification_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[tauri::command]
async fn send_desktop_notification(
    app: tauri::AppHandle,
    title: String,
    body: Option<String>,
) -> Result<(), String> {
    let identifier = app.config().identifier.clone();
    #[cfg(windows)]
    let icon_path = windows_notification_icon_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use windows::Data::Xml::Dom::XmlDocument;
            use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};
            use windows::core::HSTRING;

            let title = escape_notification_xml(&title);
            let body = escape_notification_xml(body.as_deref().unwrap_or_default());
            let icon_uri = format!(
                "file:///{}",
                icon_path.to_string_lossy().replace('\\', "/")
            );
            let xml = format!(
                r#"<toast duration="short"><visual><binding template="ToastGeneric"><image placement="appLogoOverride" hint-crop="circle" src="{icon_uri}" alt="酷安"/><text>{title}</text><text>{body}</text></binding></visual></toast>"#
            );
            let document = XmlDocument::new().map_err(|error| error.to_string())?;
            document
                .LoadXml(&HSTRING::from(xml))
                .map_err(|error| error.to_string())?;
            let toast = ToastNotification::CreateToastNotification(&document)
                .map_err(|error| error.to_string())?;
            let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(
                identifier,
            ))
            .map_err(|error| error.to_string())?;
            notifier.Show(&toast).map_err(|error| error.to_string())?;
            std::thread::sleep(std::time::Duration::from_secs(3));
            notifier.Hide(&toast).map_err(|error| error.to_string())?;
            return Ok(());
        }

        #[cfg(not(windows))]
        {
            let mut notification = notify_rust::Notification::new();
            notification.summary(&title).auto_icon();
            if let Some(body) = body.filter(|value| !value.trim().is_empty()) {
                notification.body(&body);
            }
            notification
                .show()
                .map(|_| ())
                .map_err(|error| error.to_string())
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 前端保存启动参数（静默启动 / 记忆窗口状态 / 置顶），重启后由 setup 读取生效
#[tauri::command]
fn set_startup_flags(
    app: tauri::AppHandle,
    start_minimized: bool,
    remember_window_state: bool,
    always_on_top: bool,
) -> Result<(), String> {
    START_MINIMIZED.store(start_minimized, Ordering::SeqCst);
    REMEMBER_WINDOW_STATE.store(remember_window_state, Ordering::SeqCst);
    ALWAYS_ON_TOP.store(always_on_top, Ordering::SeqCst);

    let path = startup_state_path(&app).ok_or("无法获取应用数据目录")?;
    update_startup_state_file(&path, serde_json::json!({}), |flags| {
        flags["start_minimized"] = serde_json::json!(start_minimized);
        flags["remember_window_state"] = serde_json::json!(remember_window_state);
        flags["always_on_top"] = serde_json::json!(always_on_top);
    })
}

/// 主窗口导航白名单：只允许应用自身源（dev 固定端口 / 打包后 tauri 自定义协议源）。
/// 主窗口一旦导航到外部域名，外部页面会接管整个窗口（钓鱼/UI 混淆风险），
/// 且登录回跳等依赖主窗口 URL 的逻辑会失去正确来源。
/// 外部链接一律由页面级 handleAnchorClick 在新窗口打开，这里仅作兜底防线。
fn is_main_window_navigation_allowed(url: &tauri::Url) -> bool {
    let scheme = url.scheme().to_ascii_lowercase();
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    match scheme.as_str() {
        "http" | "https" => {
            host == "tauri.localhost" || (host == "127.0.0.1" && url.port() == Some(17520))
        }
        "tauri" => host == "localhost",
        _ => false,
    }
}

pub fn run() {
    let client = CoolapkClient::new();
    let state = AppState { client };

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 重复启动时聚焦已有实例的主窗口
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        // 兜底防线：主窗口若被导航到本地源以外的页面（如某个 v-html 遗漏的裸链接），
        // 加载完成后立即返回上一页，避免外部页面驻留在主窗口。
        // 点击路径已由前端全局 <a> 拦截 + 页面级 handleAnchorClick 处理。
        .on_page_load(|window, payload| {
            if window.label() == "main" && !is_main_window_navigation_allowed(payload.url()) {
                let _ = window.eval("history.go(-1)");
            }
        })
        .manage(state)
        .setup(|app| {
            #[cfg(windows)]
            if let Err(error) = register_windows_notification_identity(app.app_handle()) {
                eprintln!("注册酷安通知身份失败：{error}");
            }

            // 读取启动参数并应用：窗口置顶 / 记忆上次窗口大小位置 / 静默启动到托盘
            if let Some(path) = startup_state_path(app.app_handle()) {
                if let Ok(raw) = std::fs::read_to_string(&path) {
                    if let Ok(flags) = serde_json::from_str::<serde_json::Value>(&raw) {
                        let w = app.get_webview_window("main");
                        if let Some(w) = w {
                            if flags["always_on_top"].as_bool().unwrap_or(false) {
                                ALWAYS_ON_TOP.store(true, Ordering::SeqCst);
                                let _ = w.set_always_on_top(true);
                            }
                            let remember_window_state =
                                flags["remember_window_state"].as_bool().unwrap_or(true);
                            REMEMBER_WINDOW_STATE.store(remember_window_state, Ordering::SeqCst);
                            if remember_window_state {
                                if let Some(saved_state) = parse_saved_window_state(&flags) {
                                    let screens: Vec<ScreenRect> = w
                                        .available_monitors()
                                        .unwrap_or_default()
                                        .into_iter()
                                        .map(|monitor| ScreenRect {
                                            x: monitor.position().x,
                                            y: monitor.position().y,
                                            w: monitor.size().width,
                                            h: monitor.size().height,
                                        })
                                        .collect();
                                    let primary = w.primary_monitor().ok().flatten().map(|monitor| {
                                        ScreenRect {
                                            x: monitor.position().x,
                                            y: monitor.position().y,
                                            w: monitor.size().width,
                                            h: monitor.size().height,
                                        }
                                    });
                                    let state = restore_window_rect(saved_state, &screens, primary);
                                    // set_size 使用内容区尺寸，因此保存时也必须读取 inner_size。
                                    let _ = w.set_size(tauri::PhysicalSize::new(state.w, state.h));
                                    // 先调整尺寸再恢复位置，避免窗口管理器按旧尺寸裁剪坐标。
                                    let _ = w.set_position(tauri::PhysicalPosition::new(state.x, state.y));
                                    if let Ok(mut guard) = WINDOW_STATE.lock() {
                                        *guard = Some(state);
                                    }
                                }
                            }
                            if flags["start_minimized"].as_bool().unwrap_or(false) {
                                START_MINIMIZED.store(true, Ordering::SeqCst);
                                let _ = w.hide();
                            }
                        }
                    }
                }
            }

            // 即使启动时没有发生移动/缩放事件，也缓存一次真实几何信息，
            // 供关闭或 app.exit() 时的持久化兜底使用。
            if let Some(w) = app.get_webview_window("main") {
                if let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) {
                    if size.width >= MIN_WINDOW_W && size.height >= MIN_WINDOW_H {
                        if let Ok(mut guard) = WINDOW_STATE.lock() {
                            *guard = Some(WindowState {
                                x: pos.x,
                                y: pos.y,
                                w: size.width,
                                h: size.height,
                            });
                        }
                    }
                }
            }

            // 将登录凭据持久化到应用数据目录，重启后自动恢复登录态
            if let Ok(dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&dir);
                let state = app.state::<AppState>();
                state
                    .client
                    .persist_cookie_to(dir.join("session_cookie.txt"));
            }

            // 系统托盘图标：常驻后台、快捷恢复窗口与退出
            if let Some(icon) = app.default_window_icon().cloned() {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;

                let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show, &quit])?;

                let tray_builder = TrayIconBuilder::with_id("main-tray")
                    .icon(icon)
                    .menu(&menu)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                        "quit" => {
                            // 退出前持久化窗口几何信息（托盘退出不触发 CloseRequested）
                            persist_current_window_geometry(app);
                            app.exit(0)
                        }
                        _ => {}
                    });

                #[cfg(any(target_os = "windows", target_os = "macos"))]
                let tray_builder = tray_builder
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|tray, event| {
                        use tauri::tray::{MouseButton, MouseButtonState};
                        if let tauri::tray::TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                    });

                // Linux 保留托盘实现的默认左键菜单行为，避免菜单弹出与窗口恢复同时触发。
                let _tray = tray_builder.build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            match event {
                WindowEvent::Moved(pos) => {
                    if let Ok(mut guard) = WINDOW_STATE.lock() {
                        let prev = guard.get_or_insert(WindowState {
                            x: 0,
                            y: 0,
                            w: 1440,
                            h: 900,
                        });
                        prev.x = pos.x;
                        prev.y = pos.y;
                    }
                }
                WindowEvent::Resized(size) => {
                    if let Ok(mut guard) = WINDOW_STATE.lock() {
                        let prev = guard.get_or_insert(WindowState {
                            x: 0,
                            y: 0,
                            w: 1440,
                            h: 900,
                        });
                        prev.w = size.width;
                        prev.h = size.height;
                    }
                }
                WindowEvent::CloseRequested { api, .. } => {
                    // 记忆窗口状态：先在隐藏/关闭前读取真实几何信息，避免托盘模式下查询失败。
                    persist_current_window_geometry(&window.app_handle());
                    // 关闭到托盘：仅主窗口点击关闭时隐藏而非退出，其余窗口（如外部链接窗口）正常关闭
                    if CLOSE_TO_TRAY.load(Ordering::SeqCst) {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                WindowEvent::Destroyed => {
                    // 兼容其他 app.exit() 调用：窗口已销毁后只能使用最近一次缓存。
                    if REMEMBER_WINDOW_STATE.load(Ordering::SeqCst) {
                        if let Some(state) = cached_window_state() {
                            persist_window_geometry(&window.app_handle(), state);
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_index_v8_feeds,
            get_index_v8_feeds_paged,
            get_index_v8_entities_paged,
            get_hot_feeds,
            get_rank_feeds,
            get_latest_feeds,
            get_digest_feeds,
            get_cool_picture_rank,
            get_board_feeds,
            get_secondhand_feeds,
            get_game_list,
            get_app_list,
            search_apks,
            search_games,
            get_tab_config,
            update_home_tab_config,
            get_discovery_config,
            get_discovery_page_data,
            get_live_detail,
            get_search_suggestions,
            get_hot_searches,
            get_topic_detail_v7,
            get_product_detail,
            get_product_feeds,
            get_product_config,
            add_config_compare,
            remove_config_compare,
            get_product_brand_list,
            get_product_category_list,
            get_product_list,
            get_product_brand_products,
            get_product_media_list,
            change_product_wish_status,
            get_product_wish_list,
            get_product_buy_list,
            get_my_product_list,
            get_product_rating_chart,
            get_product_rating_list,
            get_apk_rating_user_list,
            change_rating_status,
            get_dyh_detail,
            get_dyh_list,
            get_dyh_feeds,
            get_dyh_follow_list,
            get_dyh_subscribe_list,
            get_dyh_editor_list,
            get_event_list,
            get_event_detail,
            get_user_product_albums,
            get_goods_list_items,
            create_product_album,
            get_node_feeds,
            get_apk_feeds,
            check_login_info,
            get_feed_detail,
            resolve_live_photo_video,
            get_live_photo_video_header,
            resolve_video_url,
            get_reply_detail,
            get_hot_replies,
            search_all,
            search_by_type,
            search_feeds,
            get_feed_replies,
            get_sub_replies,
            get_user_space,
            get_user_qr_image,
            get_user_tab_data,
            get_user_profile,
            update_user_profile,
            change_avatar,
            update_user_cover,
            get_user_follow_nodes,
            get_user_forum_follow_list,
            get_user_feeds,
            get_user_like_list,
            get_topic_detail,
            get_topic_feeds,
            get_topic_tab_data,
            get_topic_hub_data,
            get_app_detail,
            get_apk_comments,
            get_notification_count,
            clear_notification_count,
            get_notifications,
            list_messages,
            get_recent_chat_users,
            list_chat_history,
            delete_message_chat,
            send_private_message,
            like_feed,
            unlike_feed,
            like_reply,
            unlike_reply,
            reply_feed,
            comment_apk,
            follow_user,
            unfollow_user,
            special_follow_user,
            cancel_follower,
            update_user_remark,
            create_feed,
            save_cookie_securely,
            check_login_status,
            update_device_profile,
            get_device_info,
            list_accounts,
            login_as,
            save_account,
            persist_current_account,
            remove_account,
            clear_user_cookie,
            get_user_cookie,
            login_by_account,
            send_sms_vcode,
            login_by_mobile,
            get_image_data_url,
            save_image,
            open_image_in_system_viewer,
            open_url,
            fetch_external_page,
            open_login_webview,
            close_login_window,
            get_following_feeds,
            get_follow_user_list,
            get_fans_user_list,
            get_platform_info,
            set_close_to_tray,
            set_startup_flags,
            send_desktop_notification,
            download_update,
            install_update,
            is_update_package_available,
            cleanup_update_packages,
            quit_app,
            export_json_file,
            get_cache_info,
            clear_app_cache,
            clean_expired_cache,
            open_cache_directory,
            get_album_detail,
            get_album_list,
            get_album_replies,
            get_user_album_list,
            create_album,
            edit_album,
            add_album_apk,
            delete_album_apk,
            get_apk_discoverers,
            get_apk_gift_list,
            get_apk_recommend_list,
            get_apk_related_apps,
            get_download_version_list,
            get_editor_choice_feeds,
            get_collection_item_list,
            get_collection_list,
            get_favorite_list,
            get_headline_feeds,
            get_collection_detail,
            get_feed_collection_status,
            update_collection_item,
            follow_collection,
            unfollow_collection,
            like_collection,
            unlike_collection,
            follow_dyh,
            unfollow_dyh,
            follow_live,
            unfollow_live,
            get_feed_forward_list,
            get_feed_like_list,
            get_feed_change_history,
            search_tags,
            follow_tag,
            unfollow_tag,
            get_device_feed_list,
            get_question_answers,
            get_vote_comments,
            create_user_vote,
            get_hit_history,
            get_recent_history,
            get_spam_feed_list,
            get_hidden_replies,
            get_followed_topics,
            search_users,
            get_search_suggestions_app,
            search_feed_topics,
            get_product_detail_by_name,
            get_load_config,
            get_home_tab_config,
            send_private_image,
            read_message,
            favorite_feed,
            unfavorite_feed,
            favorite_apk,
            unfavorite_apk,
            delete_feed,
            delete_reply,
            create_forward,
            upload_image,
            get_black_list,
            get_ignore_list,
            get_limit_list,
            add_to_black_list,
            remove_from_black_list,
            add_to_ignore_list,
            remove_from_ignore_list,
            get_apk_url,
            get_apk_qr,
            check_update,
            get_hot_topics,
            get_picture_list,
            get_update_list,
            get_user_rating_list,
            search_albums,
            search_apks_by_developer,
            search_apks_by_tag,
            get_goods_search_hot_words,
            search_goods,
            get_goods_detail,
            get_goods_list_types,
            get_goods_list,
            get_goods_store_items,
            get_product_albums,
            get_my_goods_feeds,
            create_goods_list,
            edit_goods_list,
            add_goods_to_goods_list,
            delete_goods_list_items,
            edit_goods_list_item,
            vote_goods_list_item,
            bind_feed_to_goods_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
