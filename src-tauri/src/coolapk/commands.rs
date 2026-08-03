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
pub async fn create_feed(state: State<'_, AppState>, message: String) -> Result<Value, String> {
    state.client.create_feed(&message).await
}

#[tauri::command]
pub async fn save_cookie_securely(
    state: State<'_, AppState>,
    cookie_str: String,
) -> Result<String, String> {
    state.client.set_user_cookie(cookie_str)?;
    Ok("登录 Cookie 已载入当前桌面会话".to_string())
}

#[tauri::command]
pub async fn get_image_data_url(state: State<'_, AppState>, url: String) -> Result<String, String> {
    state.client.get_image_data_url(&url).await
}
