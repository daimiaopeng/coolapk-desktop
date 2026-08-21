pub mod coolapk;

use coolapk::client::CoolapkClient;
use coolapk::commands::{
    AppState, add_to_black_list, add_to_ignore_list, check_login_info, check_login_status,
    check_update, clean_expired_cache, clear_app_cache, clear_user_cookie, close_login_window,
    create_feed, create_forward, delete_feed, delete_reply, download_update, export_json_file,
    favorite_apk, favorite_feed, fetch_external_page, follow_collection, follow_dyh, follow_tag,
    follow_user, get_album_detail, get_album_list, get_album_replies, get_apk_discoverers,
    get_apk_feeds, get_apk_gift_list, get_apk_qr, get_apk_recommend_list, get_apk_url,
    get_app_detail, get_apk_comments, get_app_list, get_black_list, get_board_feeds, get_cache_info,
    get_collection_detail, get_collection_item_list, get_collection_list,
    get_feed_collection_status, get_cool_picture_rank,
    get_device_feed_list, get_device_info, get_digest_feeds, get_download_version_list,
    get_discovery_config, get_discovery_page_data,
    get_dyh_detail, get_dyh_feeds, get_dyh_list, get_editor_choice_feeds, get_fans_user_list,
    get_favorite_list, get_feed_change_history, get_feed_detail, get_feed_forward_list,
    get_feed_like_list, get_feed_replies, get_follow_user_list, get_following_feeds, get_game_list,
    get_headline_feeds, get_hit_history, get_hot_feeds, get_hot_replies, get_hot_topics,
    get_ignore_list, get_image_data_url, get_index_v8_feeds, get_latest_feeds, get_limit_list,
    get_load_config, get_notification_count, get_notifications, get_picture_list,
    get_product_detail, get_product_detail_by_name, get_product_feeds, get_question_answers,
    get_rank_feeds, get_recent_history, get_reply_detail, get_search_suggestions,
    resolve_video_url,
    get_search_suggestions_app, get_secondhand_feeds, get_sub_replies, get_tab_config,
    update_home_tab_config,
    get_topic_detail, get_topic_detail_v7, get_topic_feeds, get_topic_hub_data, get_update_list,
    get_user_cookie, get_user_feeds, get_user_follow_nodes, get_user_profile, get_user_rating_list,
    get_user_qr_image, get_user_space, get_user_tab_data, get_vote_comments, install_update, like_collection, like_feed, like_reply, list_accounts,
    list_chat_history, list_messages, login_as, login_by_account, login_by_mobile,
    open_cache_directory, open_login_webview, open_url, persist_current_account, quit_app,
    read_message, remove_account, remove_from_black_list, remove_from_ignore_list, reply_feed,
    comment_apk,
    cancel_follower, special_follow_user, update_user_remark,
    save_account, save_cookie_securely, save_image, search_albums, search_all, search_apks,
    search_apks_by_developer, search_apks_by_tag, search_feed_topics, search_feeds, search_games,
    search_tags, search_users, send_private_image, send_private_message, send_sms_vcode,
    unfavorite_apk, unfavorite_feed, unfollow_collection, unfollow_dyh, unfollow_tag,
    update_collection_item,
    unfollow_user, unlike_collection, unlike_feed, unlike_reply, update_device_profile, upload_image,
};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Manager, WindowEvent};

static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(false);
static START_MINIMIZED: AtomicBool = AtomicBool::new(false);
static REMEMBER_WINDOW_STATE: AtomicBool = AtomicBool::new(false);
static ALWAYS_ON_TOP: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Copy)]
struct WindowState {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
}

static WINDOW_STATE: Mutex<Option<WindowState>> = Mutex::new(None);

const STARTUP_STATE_FILE: &str = "startup_state.json";
const MIN_WINDOW_W: f64 = 800.0;
const MIN_WINDOW_H: f64 = 600.0;

fn startup_state_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    Some(dir.join(STARTUP_STATE_FILE))
}

/// 合并写入窗口几何信息，保留已有的启动参数（静默启动/记忆窗口/置顶）
fn persist_window_geometry(app: &tauri::AppHandle, state: WindowState) {
    let path = match startup_state_path(app) {
        Some(p) => p,
        None => return,
    };
    let mut flags: serde_json::Value = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(|| {
            serde_json::json!({
                "start_minimized": false,
                "remember_window_state": false,
                "always_on_top": false
            })
        });
    flags["x"] = serde_json::json!(state.x);
    flags["y"] = serde_json::json!(state.y);
    flags["w"] = serde_json::json!(state.w);
    flags["h"] = serde_json::json!(state.h);
    if let Ok(raw) = serde_json::to_string_pretty(&flags) {
        let _ = std::fs::write(&path, raw);
    }
}

#[tauri::command]
fn set_close_to_tray(enabled: bool) {
    CLOSE_TO_TRAY.store(enabled, Ordering::SeqCst);
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
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let mut flags: serde_json::Value = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    flags["start_minimized"] = serde_json::json!(start_minimized);
    flags["remember_window_state"] = serde_json::json!(remember_window_state);
    flags["always_on_top"] = serde_json::json!(always_on_top);
    let raw = serde_json::to_string_pretty(&flags).map_err(|e| e.to_string())?;
    std::fs::write(&path, raw).map_err(|e| e.to_string())?;
    Ok(())
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
                            if flags["remember_window_state"].as_bool().unwrap_or(false) {
                                REMEMBER_WINDOW_STATE.store(true, Ordering::SeqCst);
                                let (x, y, ww, hh) = (
                                    flags["x"].as_f64(),
                                    flags["y"].as_f64(),
                                    flags["w"].as_f64(),
                                    flags["h"].as_f64(),
                                );
                                if let (Some(x), Some(y), Some(ww), Some(hh)) = (x, y, ww, hh) {
                                    if ww >= MIN_WINDOW_W && hh >= MIN_WINDOW_H {
                                        let _ = w.set_position(tauri::PhysicalPosition::new(
                                            x as i32, y as i32,
                                        ));
                                        let _ = w.set_size(tauri::PhysicalSize::new(
                                            ww as u32, hh as u32,
                                        ));
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

                let _tray = TrayIconBuilder::with_id("main-tray")
                    .icon(icon)
                    .menu(&menu)
                    .show_menu_on_left_click(false)
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
                            if REMEMBER_WINDOW_STATE.load(Ordering::SeqCst) {
                                if let Some(w) = app.get_webview_window("main") {
                                    if let (Ok(pos), Ok(size)) =
                                        (w.outer_position(), w.outer_size())
                                    {
                                        persist_window_geometry(
                                            app,
                                            WindowState {
                                                x: pos.x,
                                                y: pos.y,
                                                w: size.width,
                                                h: size.height,
                                            },
                                        );
                                    }
                                }
                            }
                            app.exit(0)
                        }
                        _ => {}
                    })
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
                    })
                    .build(app)?;
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
                    // 关闭到托盘：仅主窗口点击关闭时隐藏而非退出，其余窗口（如外部链接窗口）正常关闭
                    if CLOSE_TO_TRAY.load(Ordering::SeqCst) {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    // 记忆窗口状态：关闭（含隐藏到托盘）时持久化当前几何信息
                    if REMEMBER_WINDOW_STATE.load(Ordering::SeqCst) {
                        if let Ok(guard) = WINDOW_STATE.lock() {
                            if let Some(state) = guard.as_ref() {
                                persist_window_geometry(&window.app_handle(), *state);
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_index_v8_feeds,
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
            get_search_suggestions,
            get_topic_detail_v7,
            get_product_detail,
            get_product_feeds,
            get_dyh_detail,
            get_dyh_list,
            get_dyh_feeds,
            get_apk_feeds,
            check_login_info,
            get_feed_detail,
            resolve_video_url,
            get_reply_detail,
            get_hot_replies,
            search_all,
            search_feeds,
            get_feed_replies,
            get_sub_replies,
            get_user_space,
            get_user_qr_image,
            get_user_tab_data,
            get_user_profile,
            get_user_follow_nodes,
            get_user_feeds,
            get_topic_detail,
            get_topic_feeds,
            get_topic_hub_data,
            get_app_detail,
            get_apk_comments,
            get_notification_count,
            get_notifications,
            list_messages,
            list_chat_history,
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
            open_url,
            fetch_external_page,
            open_login_webview,
            close_login_window,
            get_following_feeds,
            get_follow_user_list,
            get_fans_user_list,
            set_close_to_tray,
            set_startup_flags,
            send_desktop_notification,
            download_update,
            install_update,
            quit_app,
            export_json_file,
            get_cache_info,
            clear_app_cache,
            clean_expired_cache,
            open_cache_directory,
            get_album_detail,
            get_album_list,
            get_album_replies,
            get_apk_discoverers,
            get_apk_gift_list,
            get_apk_recommend_list,
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
            get_feed_forward_list,
            get_feed_like_list,
            get_feed_change_history,
            search_tags,
            follow_tag,
            unfollow_tag,
            get_device_feed_list,
            get_question_answers,
            get_vote_comments,
            get_hit_history,
            get_recent_history,
            search_users,
            get_search_suggestions_app,
            search_feed_topics,
            get_product_detail_by_name,
            get_load_config,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
