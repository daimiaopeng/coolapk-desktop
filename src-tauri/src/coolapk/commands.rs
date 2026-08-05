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
    state.client.set_user_cookie(cookie_str)?;
    if let Some(win) = app.get_webview_window("login_window") {
        let _ = win.close();
    }
    Ok("登录 Cookie 已载入当前桌面会话".to_string())
}

#[tauri::command]
pub async fn check_login_status(state: State<'_, AppState>) -> Result<Value, String> {
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
    if let Some(win) = app.get_webview_window("login_window") {
        let _ = win.close();
    }
    Ok(())
}

#[tauri::command]
pub async fn open_login_webview(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    if let Some(win) = app.get_webview_window("login_window") {
        let _ = win.set_focus();
        return Ok(());
    }

    let login_url = reqwest::Url::parse("https://account.coolapk.com/auth/loginByCoolapk?forward=http%3A%2F%2F127.0.0.1%3A14280%2F%23%2Fauth_callback")
        .map_err(|e| e.to_string())?;

    let js_script = r#"
        (function() {
            var saved = false;
            
            function notifySuccess() {
                if (saved) return;
                var cookies = document.cookie || "";
                if (window.__TAURI_INTERNALS__) {
                    saved = true;
                    window.__TAURI_INTERNALS__.invoke('save_cookie_securely', { cookieStr: cookies })
                        .then(function() {
                            setTimeout(function() {
                                window.__TAURI_INTERNALS__.invoke('close_login_window');
                            }, 200);
                        }).catch(function() {
                            setTimeout(function() {
                                window.__TAURI_INTERNALS__.invoke('close_login_window');
                            }, 300);
                        });
                }
            }

            // 1. 代理 XHR 网络库，拦截 POST /auth/validateLogin 响应完成
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
                            setTimeout(notifySuccess, 300);
                        }
                    });
                    return oldSend.apply(this, arguments);
                };
            } catch(e) {}

            // 2. 轮询侦测域名跳转与 Cookie
            setInterval(function() {
                var cookies = document.cookie || "";
                var href = window.location.href || "";
                var hasCreds = (cookies.indexOf("SESSID=") !== -1 || cookies.indexOf("uid=") !== -1 || cookies.indexOf("token=") !== -1);
                var isRedirected = (href.indexOf("loginByCoolapk") === -1 && (href.indexOf("coolapk.com") !== -1 || href.indexOf("account.coolapk.com") !== -1));

                if (hasCreds || (cookies.length > 15 && isRedirected)) {
                    notifySuccess();
                }
            }, 400);
        })();
    "#;

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

    // 在 Rust 侧使用原生 Task 监控 Webview URL 重定向状态，解决跨域沙箱无法调用 IPC 的瓶颈
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            if let Some(win) = app_handle.get_webview_window("login_window") {
                if let Ok(url) = win.url() {
                    let url_str = url.as_str();
                    // 当跳转至 auth_callback 或 www.coolapk.com 官网宣传落地页时，执行关窗与同步
                    let is_auth_flow = (url_str.contains("/auth/") && !url_str.contains("auth_callback")) || url_str.contains("key=") || url_str.contains("loginBy");
                    let is_final_redirect = url_str.contains("auth_callback") || url_str.contains("www.coolapk.com") || (url_str.contains("coolapk.com") && !is_auth_flow);

                    if is_final_redirect {
                        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                        let _ = win.close();
                        use tauri::Emitter;
                        let _ = app_handle.emit("login-window-closed", ());
                        break;
                    }
                }
            } else {
                break;
            }
        }
    });

    Ok(())
}
