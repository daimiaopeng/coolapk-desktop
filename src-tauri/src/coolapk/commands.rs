use crate::coolapk::client::CoolapkClient;
use serde_json::Value;
use tauri::State;

pub struct AppState {
    pub client: CoolapkClient,
}

#[tauri::command]
pub async fn get_index_v8_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_index_v8_feeds(page).await
}

#[tauri::command]
pub async fn get_hot_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_hot_feeds(page).await
}

#[tauri::command]
pub async fn get_latest_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_latest_feeds(page).await
}

#[tauri::command]
pub async fn get_digest_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_digest_feeds(page).await
}

#[tauri::command]
pub async fn get_cool_picture_rank(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_cool_picture_rank(page).await
}

#[tauri::command]
pub async fn get_board_feeds(
    state: State<'_, AppState>,
    board_tag: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_board_feeds(&board_tag, page).await
}

#[tauri::command]
pub async fn get_secondhand_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_secondhand_feeds(page).await
}

#[tauri::command]
pub async fn get_feed_detail(state: State<'_, AppState>, feed_id: String) -> Result<Value, String> {
    state.client.get_feed_detail(&feed_id).await
}

#[tauri::command]
pub async fn get_feed_replies(
    state: State<'_, AppState>,
    feed_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_feed_replies(&feed_id, page).await
}

#[tauri::command]
pub async fn get_sub_replies(
    state: State<'_, AppState>,
    feed_id: String,
    reply_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_sub_replies(&feed_id, &reply_id, page).await
}

#[tauri::command]
pub async fn get_hot_replies(
    state: State<'_, AppState>,
    feed_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_hot_replies(&feed_id, page).await
}

#[tauri::command]
pub async fn search_all(
    state: State<'_, AppState>,
    query: String,
    page: u32,
) -> Result<Value, String> {
    state.client.search_all(&query, page).await
}

#[tauri::command]
pub async fn search_feeds(
    state: State<'_, AppState>,
    query: String,
    page: u32,
    sort_type: String,
) -> Result<Value, String> {
    state.client.search_feeds(&query, page, &sort_type).await
}

#[tauri::command]
pub async fn get_user_space(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.get_user_space(&uid).await
}

#[tauri::command]
pub async fn get_user_profile(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.get_user_profile(&uid).await
}

#[tauri::command]
pub async fn get_user_follow_nodes(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.get_user_follow_nodes(&uid).await
}

#[tauri::command]
pub async fn get_user_feeds(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
    feed_type: String,
) -> Result<Value, String> {
    state.client.get_user_feeds(&uid, page, &feed_type).await
}

#[tauri::command]
pub async fn get_topic_detail(state: State<'_, AppState>, tag: String) -> Result<Value, String> {
    state.client.get_topic_detail(&tag).await
}

#[tauri::command]
pub async fn get_topic_feeds(
    state: State<'_, AppState>,
    tag: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_topic_feeds(&tag, page).await
}

#[tauri::command]
pub async fn get_topic_hub_data(
    state: State<'_, AppState>,
    sub_url: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_topic_hub_data(&sub_url, page).await
}

#[tauri::command]
pub async fn get_app_detail(
    state: State<'_, AppState>,
    package_name: String,
) -> Result<Value, String> {
    state.client.get_app_detail(&package_name).await
}

#[tauri::command]
pub async fn get_notification_count(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_notification_count().await
}

#[tauri::command]
pub async fn get_notifications(
    state: State<'_, AppState>,
    notification_type: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_notifications(&notification_type, page)
        .await
}

#[tauri::command]
pub async fn list_messages(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.list_messages(page).await
}

#[tauri::command]
pub async fn list_chat_history(
    state: State<'_, AppState>,
    ukey: String,
    page: u32,
) -> Result<Value, String> {
    state.client.list_chat_history(&ukey, page).await
}

#[tauri::command]
pub async fn send_private_message(
    state: State<'_, AppState>,
    uid: String,
    message: String,
) -> Result<Value, String> {
    state.client.send_private_message(&uid, &message).await
}

#[tauri::command]
pub async fn like_feed(state: State<'_, AppState>, feed_id: String) -> Result<Value, String> {
    state.client.like_feed(&feed_id).await
}

#[tauri::command]
pub async fn unlike_feed(state: State<'_, AppState>, feed_id: String) -> Result<Value, String> {
    state.client.unlike_feed(&feed_id).await
}

#[tauri::command]
pub async fn reply_feed(
    state: State<'_, AppState>,
    feed_id: String,
    message: String,
) -> Result<Value, String> {
    state.client.reply_feed(&feed_id, &message).await
}

#[tauri::command]
pub async fn follow_user(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.follow_user(&uid).await
}

#[tauri::command]
pub async fn unfollow_user(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.unfollow_user(&uid).await
}

#[tauri::command]
pub async fn get_following_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_following_feeds(page).await
}

#[tauri::command]
pub async fn get_follow_user_list(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_follow_user_list(&uid, page).await
}

#[tauri::command]
pub async fn create_feed(state: State<'_, AppState>, message: String) -> Result<Value, String> {
    state.client.create_feed(&message).await
}

#[tauri::command]
pub async fn save_cookie_securely(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    cookie_str: String,
) -> Result<String, String> {
    use tauri::Manager;
    eprintln!("[login-debug] save_cookie_securely received cookie len={}", cookie_str.len());
    state.client.set_user_cookie(cookie_str)?;
    if let Some(win) = app.get_webview_window("login_window") {
        let _ = win.close();
    }
    eprintln!("[login-debug] save_cookie_securely done, cookie saved");
    Ok("登录 Cookie 已载入当前桌面会话".to_string())
}

#[tauri::command]
pub async fn check_login_status(state: State<'_, AppState>) -> Result<Value, String> {
    eprintln!("[login-debug] check_login_status called");
    state.client.check_login_status().await
}

#[tauri::command]
pub fn clear_user_cookie(state: State<'_, AppState>) -> Result<String, String> {
    state.client.clear_user_cookie()?;
    Ok("登录状态已清除".to_string())
}

#[tauri::command]
pub async fn login_by_account(
    state: State<'_, AppState>,
    account: String,
    password: String,
) -> Result<Value, String> {
    state.client.login_by_account(&account, &password).await
}

#[tauri::command]
pub async fn send_sms_vcode(
    state: State<'_, AppState>,
    mobile: String,
) -> Result<Value, String> {
    state.client.send_sms_vcode(&mobile).await
}

#[tauri::command]
pub async fn login_by_mobile(
    state: State<'_, AppState>,
    mobile: String,
    vcode: String,
) -> Result<Value, String> {
    state.client.login_by_mobile(&mobile, &vcode).await
}

#[tauri::command]
pub async fn get_image_data_url(state: State<'_, AppState>, url: String) -> Result<String, String> {
    state.client.get_image_data_url(&url).await
}

#[tauri::command]
pub async fn get_game_list(
    state: State<'_, AppState>,
    page: u32,
    game_type: String,
) -> Result<Value, String> {
    state.client.get_game_list(page, &game_type).await
}

#[tauri::command]
pub async fn search_apks(
    state: State<'_, AppState>,
    query: String,
    page: u32,
) -> Result<Value, String> {
    state.client.search_apks(&query, page).await
}

#[tauri::command]
pub async fn get_app_list(
    state: State<'_, AppState>,
    page: u32,
    cat: String,
) -> Result<Value, String> {
    state.client.get_app_list(page, &cat).await
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {


    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn close_login_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    use tauri::Emitter;
    if let Some(win) = app.get_webview_window("login_window") {
        let _ = win.close();
    }
    // 无论通过 JS 还是 Rust 监控关闭，都必须通知主窗口同步登录态
    eprintln!("[login-debug] close_login_window -> emit login-window-closed");
    let _ = app.emit("login-window-closed", ());
    Ok(())
}

#[tauri::command]
pub fn get_user_cookie(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let val = state.client.get_user_cookie();
    eprintln!(
        "[login-debug] get_user_cookie -> {}",
        if val.is_some() { "present" } else { "none" }
    );
    Ok(val)
}

/// 登录 webview 注入脚本上报的调试信息，仅用于排查登录链路
#[tauri::command]
pub fn login_debug_report(tag: String, msg: String) {
    eprintln!("[login-debug:{}] {}", tag, msg);
}

/// 从主窗口当前 URL 推导应用自身源地址（dev 为 http://127.0.0.1:17520，打包后为 tauri 自定义协议源），
/// 用于登录回跳 forward 与关窗判定，避免 dev/生产环境不一致。
fn get_app_origin(app: &tauri::AppHandle) -> String {
    use tauri::Manager;
    if let Some(main) = app.get_webview_window("main") {
        if let Ok(url) = main.url() {
            if let Some(host) = url.host_str() {
                return match url.port() {
                    Some(port) => format!("{}://{}:{}", url.scheme(), host, port),
                    None => format!("{}://{}", url.scheme(), host),
                };
            }
        }
    }
    "http://127.0.0.1:17520".to_string()
}

/// 从回跳 URL 中提取 ck 参数（完整 cookie 字符串），例如
/// `http://127.0.0.1:17520/#/auth_callback?ck=uid%3D...%3BSESSID%3D...`
fn extract_ck_from_url(url: &str) -> Option<String> {
    let after_hash = url.split('#').nth(1)?;
    let after_q = after_hash.split('?').nth(1)?;
    for pair in after_q.split('&') {
        let mut it = pair.splitn(2, '=');
        if it.next()? == "ck" {
            let val = it.next()?;
            return Some(percent_decode(val));
        }
    }
    None
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[tauri::command]
pub async fn open_login_webview(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    if let Some(win) = app.get_webview_window("login_window") {
        let _ = win.set_focus();
        return Ok(());
    }

    let app_origin = get_app_origin(&app);
    let login_url = reqwest::Url::parse_with_params(
        "https://account.coolapk.com/auth/loginByCoolapk",
        &[("forward", format!("{}/#/auth_callback", app_origin))],
    )
    .map_err(|e| e.to_string())?;

    eprintln!("[login-debug] open_login_webview url={}", login_url);

    // 远程域 IPC 在 Tauri 2 中受限，注入脚本不再依赖 invoke 调 Rust，
    // 改为「URL 回跳」：检测到凭据后直接跳回本地回调页 {app_origin}/#/auth_callback?ck=<cookie>，
    // 由回调页（本地应用源，IPC 可用）负责保存凭据并关窗。
    let js_script = r#"
        (function() {
            var APP_ORIGIN = "__APP_ORIGIN__";
            var saved = false;

            function relayBack() {
                if (saved) return;
                var cookies = document.cookie || "";
                var hasCreds = (cookies.indexOf("SESSID=") !== -1 || cookies.indexOf("uid=") !== -1 || cookies.indexOf("token=") !== -1);
                if (!cookies || cookies.length < 5 || (!hasCreds && cookies.length <= 15)) return;
                saved = true;
                window.location.replace(APP_ORIGIN + "/#/auth_callback?ck=" + encodeURIComponent(cookies));
            }

            // 1. XHR 拦截：validateLogin 响应完成后凭据即已下发，立刻回跳
            try {
                var oldOpen = XMLHttpRequest.prototype.open;
                var oldSend = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.open = function(method, url) {
                    this._reqUrl = url || "";
                    return oldOpen.apply(this, arguments);
                };
                XMLHttpRequest.prototype.send = function() {
                    this.addEventListener('load', function() {
                        if (this._reqUrl && this._reqUrl.indexOf('validateLogin') !== -1) {
                            setTimeout(relayBack, 200);
                        }
                    });
                    return oldSend.apply(this, arguments);
                };
            } catch(e) {}

            // 2. 轮询侦测凭据（登录落地页 www.coolapk.com 上 .coolapk.com 域 cookie 同样可读）
            setInterval(function() {
                var cookies = document.cookie || "";
                var href = window.location.href || "";
                var hasCreds = (cookies.indexOf("SESSID=") !== -1 || cookies.indexOf("uid=") !== -1 || cookies.indexOf("token=") !== -1);
                var isOnLoginForm = (href.indexOf("loginByCoolapk") !== -1 || href.indexOf("auth/login") !== -1 || href.indexOf("validateLogin") !== -1);
                var isCoolapkPage = (href.indexOf("coolapk.com") !== -1);
                if (hasCreds || (cookies.length > 15 && isCoolapkPage && !isOnLoginForm)) {
                    relayBack();
                }
            }, 250);

            // 3. 页面即将跳离酷安域面前最后一刻回跳，规避轮询竞态
            window.addEventListener('pagehide', relayBack);
            window.addEventListener('unload', relayBack);
        })();
    "#
    .replace("__APP_ORIGIN__", &app_origin);

    let _window = tauri::WebviewWindowBuilder::new(
        &app,
        "login_window",
        tauri::WebviewUrl::External(login_url),
    )
    .title("酷安官方授权登录")
    .user_agent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1")
    .inner_size(440.0, 620.0)
    .center()
    .initialization_script(js_script)
    .build()
    .map_err(|e| e.to_string())?;

    // 在 Rust 侧使用原生 Task 监控 Webview URL 重定向状态
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut relay_sent = false;
        let mut landing_ticks = 0;
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            if let Some(win) = app_handle.get_webview_window("login_window") {
                if let Ok(url) = win.url() {
                    let url_str = url.as_str();
                    let app_origin = get_app_origin(&app_handle);
                    let is_auth_flow = url_str.contains("account.coolapk.com")
                        || url_str.contains("loginByCoolapk")
                        || url_str.contains("/auth/");

                    eprintln!("[login-debug:monitor] url={} | app_origin={} | auth_flow={}", url_str, app_origin, is_auth_flow);

                    // 已回到本地回调页：凭据随 URL 带回，Rust 直接解析 ck 写入会话并立即关窗，
                    // 避免登录窗口加载完整 SPA 引发的渲染/进程问题；AuthCallbackView 仅作兜底
                    if url_str.starts_with(&format!("{}/", app_origin)) {
                        eprintln!("[login-debug:monitor] reached app-origin callback");
                        if let Some(ck) = extract_ck_from_url(url_str) {
                            if !ck.trim().is_empty() {
                                let state = app_handle.state::<AppState>();
                                match state.client.set_user_cookie(ck.clone()) {
                                    Ok(_) => eprintln!(
                                        "[login-debug:monitor] cookie captured from URL ck, len={}",
                                        ck.len()
                                    ),
                                    Err(e) => eprintln!(
                                        "[login-debug:monitor] set_user_cookie from ck failed: {}",
                                        e
                                    ),
                                }
                            }
                        }
                        let _ = win.close();
                        use tauri::Emitter;
                        let _ = app_handle.emit("login-window-closed", ());
                        break;
                    }

                    // 登录落地页（非登录流程的 www.coolapk.com）：eval 回跳把 .coolapk.com 域 cookie 带回本地回调页
                    if url_str.contains("www.coolapk.com") && !is_auth_flow {
                        if !relay_sent {
                            relay_sent = true;
                            eprintln!("[login-debug:monitor] landing on www.coolapk.com, eval relay-back");
                            let _ = win.eval(&format!(
                                "if (document.cookie) {{ window.location.replace('{}/#/auth_callback?ck=' + encodeURIComponent(document.cookie)); }}",
                                app_origin
                            ));
                        }
                        landing_ticks += 1;
                        // 兜底：5 秒内未完成回跳则直接关窗并通知
                        if landing_ticks >= 10 {
                            let _ = win.close();
                            use tauri::Emitter;
                            let _ = app_handle.emit("login-window-closed", ());
                            break;
                        }
                    }
                }
            } else {
                break;
            }
        }
    });

    Ok(())
}
