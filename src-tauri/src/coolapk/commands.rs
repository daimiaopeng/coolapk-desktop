use crate::coolapk::client::{CoolapkClient, DeviceProfile};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use md5::{Digest, Md5};
use serde_json::{Value, json};
use std::path::PathBuf;
use std::time::{Duration, SystemTime};
use tauri::{Manager, State};

pub struct AppState {
    pub client: CoolapkClient,
}

#[tauri::command]
pub async fn get_index_v8_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_index_v8_feeds(page).await
}

#[tauri::command]
pub async fn get_tab_config(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_tab_config().await
}

#[tauri::command]
pub async fn get_search_suggestions(
    state: State<'_, AppState>,
    query: String,
) -> Result<Value, String> {
    state.client.get_search_suggestions(&query).await
}

#[tauri::command]
pub async fn get_topic_detail_v7(state: State<'_, AppState>, tag: String) -> Result<Value, String> {
    state.client.get_topic_detail_v7(&tag).await
}

#[tauri::command]
pub async fn get_product_detail(
    state: State<'_, AppState>,
    product_id: String,
) -> Result<Value, String> {
    state.client.get_product_detail(&product_id).await
}

#[tauri::command]
pub async fn get_product_feeds(
    state: State<'_, AppState>,
    product_id: String,
    feed_type: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_product_feeds(&product_id, &feed_type, page)
        .await
}

#[tauri::command]
pub async fn get_dyh_detail(state: State<'_, AppState>, dyh_id: String) -> Result<Value, String> {
    state.client.get_dyh_detail(&dyh_id).await
}

#[tauri::command]
pub async fn get_dyh_list(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_dyh_list(page).await
}

#[tauri::command]
pub async fn get_dyh_feeds(
    state: State<'_, AppState>,
    dyh_id: String,
    feed_type: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_dyh_feeds(&dyh_id, &feed_type, page).await
}

#[tauri::command]
pub async fn get_apk_feeds(
    state: State<'_, AppState>,
    package_name: String,
    sort_type: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_apk_feeds(&package_name, &sort_type, page)
        .await
}

#[tauri::command]
pub async fn check_login_info(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.check_login_info().await
}

#[tauri::command]
pub async fn get_hot_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_hot_feeds(page).await
}

#[tauri::command]
pub async fn get_rank_feeds(
    state: State<'_, AppState>,
    rank_type: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_rank_feeds(&rank_type, page).await
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
pub async fn get_hot_topics(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_hot_topics().await
}

#[tauri::command]
pub async fn get_favorite_list(
    state: State<'_, AppState>,
    fav_type: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_favorite_list(&fav_type, page).await
}

#[tauri::command]
pub async fn get_collection_list(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_collection_list(&uid, page).await
}

#[tauri::command]
pub async fn get_collection_item_list(
    state: State<'_, AppState>,
    collection_id: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_collection_item_list(&collection_id, page)
        .await
}

#[tauri::command]
pub async fn get_collection_detail(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<Value, String> {
    state.client.get_collection_detail(&collection_id).await
}

#[tauri::command]
pub async fn follow_collection(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<Value, String> {
    state.client.follow_collection(&collection_id).await
}

#[tauri::command]
pub async fn unfollow_collection(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<Value, String> {
    state.client.unfollow_collection(&collection_id).await
}

#[tauri::command]
pub async fn like_collection(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<Value, String> {
    state.client.like_collection(&collection_id).await
}

#[tauri::command]
pub async fn unlike_collection(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<Value, String> {
    state.client.unlike_collection(&collection_id).await
}

#[tauri::command]
pub async fn follow_dyh(state: State<'_, AppState>, dyh_id: String) -> Result<Value, String> {
    state.client.follow_dyh(&dyh_id).await
}

#[tauri::command]
pub async fn unfollow_dyh(state: State<'_, AppState>, dyh_id: String) -> Result<Value, String> {
    state.client.unfollow_dyh(&dyh_id).await
}

#[tauri::command]
pub async fn get_feed_forward_list(
    state: State<'_, AppState>,
    feed_id: String,
    feed_type: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_feed_forward_list(&feed_id, &feed_type, page)
        .await
}

#[tauri::command]
pub async fn get_feed_like_list(
    state: State<'_, AppState>,
    feed_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_feed_like_list(&feed_id, page).await
}

#[tauri::command]
pub async fn get_feed_change_history(
    state: State<'_, AppState>,
    feed_id: String,
) -> Result<Value, String> {
    state.client.get_feed_change_history(&feed_id).await
}

#[tauri::command]
pub async fn search_tags(
    state: State<'_, AppState>,
    query: String,
    page: u32,
) -> Result<Value, String> {
    state.client.search_tags(&query, page).await
}

#[tauri::command]
pub async fn follow_tag(state: State<'_, AppState>, tag: String) -> Result<Value, String> {
    state.client.follow_tag(&tag).await
}

#[tauri::command]
pub async fn unfollow_tag(state: State<'_, AppState>, tag: String) -> Result<Value, String> {
    state.client.unfollow_tag(&tag).await
}

#[tauri::command]
pub async fn get_device_feed_list(
    state: State<'_, AppState>,
    tag: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_device_feed_list(&tag, page).await
}

#[tauri::command]
pub async fn get_question_answers(
    state: State<'_, AppState>,
    feed_id: String,
    sort: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_question_answers(&feed_id, &sort, page)
        .await
}

#[tauri::command]
pub async fn get_vote_comments(
    state: State<'_, AppState>,
    feed_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_vote_comments(&feed_id, page).await
}

#[tauri::command]
pub async fn get_hit_history(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_hit_history(page).await
}

#[tauri::command]
pub async fn get_recent_history(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_recent_history(page).await
}

#[tauri::command]
pub async fn search_users(
    state: State<'_, AppState>,
    query: String,
    page: u32,
) -> Result<Value, String> {
    state.client.search_users(&query, page).await
}

#[tauri::command]
pub async fn get_search_suggestions_app(
    state: State<'_, AppState>,
    query: String,
) -> Result<Value, String> {
    state.client.get_search_suggestions_app(&query).await
}

#[tauri::command]
pub async fn search_feed_topics(
    state: State<'_, AppState>,
    query: String,
    page: u32,
) -> Result<Value, String> {
    state.client.search_feed_topics(&query, page).await
}

#[tauri::command]
pub async fn get_product_detail_by_name(
    state: State<'_, AppState>,
    name: String,
) -> Result<Value, String> {
    state.client.get_product_detail_by_name(&name).await
}

#[tauri::command]
pub async fn get_load_config(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_load_config().await
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
    state
        .client
        .get_sub_replies(&feed_id, &reply_id, page)
        .await
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
pub async fn get_user_follow_nodes(
    state: State<'_, AppState>,
    uid: String,
) -> Result<Value, String> {
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
pub async fn send_private_image(
    state: State<'_, AppState>,
    uid: String,
    message_pic: String,
) -> Result<Value, String> {
    state.client.send_private_image(&uid, &message_pic).await
}

#[tauri::command]
pub async fn read_message(state: State<'_, AppState>, ukey: String) -> Result<Value, String> {
    state.client.read_message(&ukey).await
}

#[tauri::command]
pub async fn favorite_feed(state: State<'_, AppState>, feed_id: String) -> Result<Value, String> {
    state.client.favorite_feed(&feed_id).await
}

#[tauri::command]
pub async fn unfavorite_feed(state: State<'_, AppState>, feed_id: String) -> Result<Value, String> {
    state.client.unfavorite_feed(&feed_id).await
}

#[tauri::command]
pub async fn favorite_apk(
    state: State<'_, AppState>,
    package_name: String,
) -> Result<Value, String> {
    state.client.favorite_apk(&package_name).await
}

#[tauri::command]
pub async fn unfavorite_apk(
    state: State<'_, AppState>,
    package_name: String,
) -> Result<Value, String> {
    state.client.unfavorite_apk(&package_name).await
}

#[tauri::command]
pub async fn delete_feed(state: State<'_, AppState>, feed_id: String) -> Result<Value, String> {
    state.client.delete_feed(&feed_id).await
}

#[tauri::command]
pub async fn delete_reply(state: State<'_, AppState>, reply_id: String) -> Result<Value, String> {
    state.client.delete_reply(&reply_id).await
}

#[tauri::command]
pub async fn create_forward(
    state: State<'_, AppState>,
    feed_id: String,
    message: String,
    pic: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .create_forward(&feed_id, &message, pic.as_deref())
        .await
}

#[tauri::command]
pub async fn upload_image(
    state: State<'_, AppState>,
    image_bytes: Vec<u8>,
    file_name: String,
    content_type: String,
    dir: String,
    to_uid: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .upload_image(
            &image_bytes,
            &file_name,
            &content_type,
            &dir,
            to_uid.as_deref(),
        )
        .await
}

#[tauri::command]
pub async fn get_black_list(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_black_list(page).await
}

#[tauri::command]
pub async fn get_ignore_list(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_ignore_list(page).await
}

#[tauri::command]
pub async fn get_limit_list(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_limit_list(page).await
}

#[tauri::command]
pub async fn add_to_black_list(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.add_to_black_list(&uid).await
}

#[tauri::command]
pub async fn remove_from_black_list(
    state: State<'_, AppState>,
    uid: String,
) -> Result<Value, String> {
    state.client.remove_from_black_list(&uid).await
}

#[tauri::command]
pub async fn add_to_ignore_list(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.add_to_ignore_list(&uid).await
}

#[tauri::command]
pub async fn remove_from_ignore_list(
    state: State<'_, AppState>,
    uid: String,
) -> Result<Value, String> {
    state.client.remove_from_ignore_list(&uid).await
}

#[tauri::command]
pub async fn get_apk_url(
    state: State<'_, AppState>,
    package_name: String,
) -> Result<Value, String> {
    state.client.get_apk_url(&package_name).await
}

#[tauri::command]
pub async fn get_apk_qr(state: State<'_, AppState>, package_name: String) -> Result<Value, String> {
    state.client.get_apk_qr(&package_name).await
}

#[tauri::command]
pub async fn check_update(state: State<'_, AppState>, pkgs: String) -> Result<Value, String> {
    state.client.check_update(&pkgs).await
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
    rid: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .reply_feed(&feed_id, &message, rid.as_deref())
        .await
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
pub async fn get_fans_user_list(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_fans_user_list(&uid, page).await
}

#[tauri::command]
pub async fn create_feed(
    state: State<'_, AppState>,
    message: String,
    pic: Option<String>,
) -> Result<Value, String> {
    state.client.create_feed(&message, pic.as_deref()).await
}

#[tauri::command]
pub fn update_device_profile(
    state: State<'_, AppState>,
    profile: DeviceProfile,
) -> Result<Value, String> {
    state.client.update_device_profile(profile);
    Ok(json!({ "code": 200, "data": true }))
}

#[tauri::command]
pub fn get_device_info(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_device_info()
}

#[tauri::command]
pub async fn save_cookie_securely(
    state: State<'_, AppState>,
    cookie_str: String,
) -> Result<String, String> {
    eprintln!(
        "[login-debug] save_cookie_securely received cookie len={}",
        cookie_str.len()
    );
    state.client.set_user_cookie(cookie_str)?;
    // 保存和验证分开：回调页必须先确认服务端返回真实账号，再关登录窗口。
    eprintln!("[login-debug] save_cookie_securely done, cookie staged for validation");
    Ok("登录 Cookie 已载入，正在验证会话".to_string())
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
pub fn get_user_cookie(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.client.get_user_cookie())
}

#[tauri::command]
pub async fn list_accounts(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.list_accounts().await
}

#[tauri::command]
pub async fn login_as(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.login_as(&uid).await
}

#[tauri::command]
pub async fn save_account(
    state: State<'_, AppState>,
    uid: String,
    username: String,
    user_avatar: String,
    cookie: String,
) -> Result<Value, String> {
    state
        .client
        .save_account(&uid, &username, &user_avatar, &cookie)
        .await
}

#[tauri::command]
pub async fn persist_current_account(
    state: State<'_, AppState>,
    uid: String,
    username: String,
    user_avatar: String,
) -> Result<Value, String> {
    state
        .client
        .persist_current_account(&uid, &username, &user_avatar)
        .await
}

#[tauri::command]
pub async fn remove_account(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.remove_account(&uid).await
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
pub async fn send_sms_vcode(state: State<'_, AppState>, mobile: String) -> Result<Value, String> {
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
pub async fn get_image_data_url(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    url: String,
    cache_dir: Option<String>,
    cache_ttl_days: Option<u64>,
) -> Result<String, String> {
    let cache_file = image_cache_file(&app, cache_dir.as_deref(), &url)?;
    let ttl_days = cache_ttl_days.unwrap_or(7);

    if let Some(cached) = read_image_cache(&cache_file, ttl_days).await {
        return Ok(cached);
    }

    let data_url = state.client.get_image_data_url(&url).await?;
    // 写缓存失败不能影响图片显示，网络请求成功后始终优先返回图片。
    let _ = write_image_cache(&cache_file, &data_url).await;
    Ok(data_url)
}

/// 下载并保存图片原始数据，目录为空时使用系统下载目录。
#[tauri::command]
pub async fn save_image(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    url: String,
    dir: Option<String>,
) -> Result<String, String> {
    let data_url = state.client.get_image_data_url(&url).await?;
    let (mime_type, bytes) = decode_image_data_url(&data_url)?;
    let file_name = build_image_file_name(&url, mime_type);
    let target_dir = dir
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| app.path().download_dir().ok())
        .unwrap_or_else(std::env::temp_dir);

    tokio::fs::create_dir_all(&target_dir)
        .await
        .map_err(|error| format!("创建图片保存目录失败：{error}"))?;
    let target_path = next_available_file_path(&target_dir, &file_name);
    tokio::fs::write(&target_path, bytes)
        .await
        .map_err(|error| format!("保存图片失败：{error}"))?;

    Ok(target_path.to_string_lossy().to_string())
}

fn decode_image_data_url(data_url: &str) -> Result<(&str, Vec<u8>), String> {
    let (header, payload) = data_url
        .split_once(',')
        .ok_or_else(|| "图片数据格式无效".to_string())?;
    let mime_type = header
        .strip_prefix("data:")
        .and_then(|value| value.split(';').next())
        .filter(|value| value.starts_with("image/"))
        .ok_or_else(|| "下载内容不是图片".to_string())?;
    if !header.ends_with(";base64") {
        return Err("图片数据不是 Base64 格式".to_string());
    }
    let bytes = BASE64
        .decode(payload)
        .map_err(|error| format!("图片数据解码失败：{error}"))?;
    Ok((mime_type, bytes))
}

fn image_extension(mime_type: &str) -> &'static str {
    match mime_type.to_ascii_lowercase().as_str() {
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/avif" => "avif",
        "image/bmp" => "bmp",
        "image/svg+xml" => "svg",
        _ => "jpg",
    }
}

fn build_image_file_name(url: &str, mime_type: &str) -> String {
    let source_name = reqwest::Url::parse(url)
        .ok()
        .and_then(|parsed| {
            parsed
                .path_segments()
                .and_then(|mut segments| segments.next_back())
                .map(str::to_string)
        })
        .unwrap_or_default();
    let stem = std::path::Path::new(&source_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let safe_stem: String = stem
        .chars()
        .take(100)
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
        .collect();
    let final_stem = if safe_stem.is_empty() || safe_stem.eq_ignore_ascii_case("showimage") {
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("coolapk_image_{timestamp}")
    } else {
        safe_stem
    };
    format!("{final_stem}.{}", image_extension(mime_type))
}

fn next_available_file_path(dir: &std::path::Path, file_name: &str) -> PathBuf {
    let initial = dir.join(file_name);
    if !initial.exists() {
        return initial;
    }

    let path = std::path::Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("coolapk_image");
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("jpg");
    for index in 2..=9999 {
        let candidate = dir.join(format!("{stem}_{index}.{extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    dir.join(format!("{stem}_{}.{}", std::process::id(), extension))
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
pub async fn search_games(
    state: State<'_, AppState>,
    query: String,
    page: u32,
) -> Result<Value, String> {
    state.client.search_games(&query, page).await
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
pub fn open_url(app: tauri::AppHandle, url: String, mode: Option<String>) -> Result<(), String> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static BROWSER_WINDOW_ID: AtomicU64 = AtomicU64::new(1);

    // 协议白名单：仅允许 http/https/mailto/tel。
    // 拒绝 file:、ms-msdt:、smb:、javascript: 等可被系统协议处理器滥用的 scheme，
    // 防止来自动态/评论里的恶意链接触发本地程序。
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("无效链接: {e}"))?;
    let scheme = parsed.scheme().to_ascii_lowercase();
    if !matches!(scheme.as_str(), "http" | "https" | "mailto" | "tel") {
        return Err(format!("不支持的链接协议: {scheme}"));
    }

    // mode: "system" 交给系统默认程序；非 http(s) 协议（如 mailto:）也必须走系统默认程序
    let system_mode = mode.as_deref() == Some("system");
    if system_mode || (scheme != "http" && scheme != "https") {
        return opener::open(&url).map_err(|e| e.to_string());
    }

    // 应用本身即 WebView 浏览器：外部链接在新开窗口内浏览，不调起系统浏览器
    let label = format!(
        "browser_window_{}",
        BROWSER_WINDOW_ID.fetch_add(1, Ordering::Relaxed)
    );
    let title = parsed.host_str().unwrap_or("链接").to_string();

    // 移动端 UA：酷安网页（如账号安全页）在桌面 UA 下会白屏，与登录窗口同一套已验证可用的 UA
    tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::External(parsed))
        .title(title)
        .user_agent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1")
        .inner_size(1100.0, 780.0)
        .center()
        .decorations(true)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn close_login_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("login_window") {
        let _ = win.close();
    }
    // 无论通过 JS 还是 Rust 监控关闭，都必须通知主窗口同步登录态
    eprintln!("[login-debug] close_login_window -> emit login-window-closed");
    let _ = app.emit("login-window-closed", ());
    Ok(())
}

#[tauri::command]
pub async fn fetch_external_page(state: State<'_, AppState>, url: String) -> Result<Value, String> {
    state.client.fetch_external_page(&url).await
}

/// 从主窗口当前 URL 推导应用自身源地址（dev 为 http://127.0.0.1:17520，打包后为 tauri 自定义协议源），
/// 用于登录回跳 forward 与关窗判定，避免 dev/生产环境不一致。
///
/// 安全约束：只允许应用自身的固定源。登录回跳会把 Cookie 拼进 URL 带回本地，
/// 若主窗口被导航到外部域名，绝不能把凭据回跳到该域。
const ALLOWED_APP_ORIGINS: &[&str] = &[
    "http://127.0.0.1:17520",
    "http://tauri.localhost",
    "tauri://localhost",
];

fn get_app_origin(app: &tauri::AppHandle) -> String {
    use tauri::Manager;
    if let Some(main) = app.get_webview_window("main") {
        if let Ok(url) = main.url() {
            if let Some(host) = url.host_str() {
                let origin = match url.port() {
                    Some(port) => format!("{}://{}:{}", url.scheme(), host, port),
                    None => format!("{}://{}", url.scheme(), host),
                };
                if ALLOWED_APP_ORIGINS.contains(&origin.as_str()) {
                    return origin;
                }
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

/// 日志脱敏：只保留 scheme+host+path，剥离 query/hash（避免 ck 等凭据参数泄露到终端）
fn redact_url(url: &str) -> String {
    let without_frag = url.split('#').next().unwrap_or(url);
    let base = without_frag.split('?').next().unwrap_or(without_frag);
    base.to_string()
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
    let target_login = format!(
        "https://account.coolapk.com/auth/loginByCoolapk?forward={}/#/auth_callback",
        app_origin
    );
    // 先发起 logout 清理网页底层 Cookie 旧会话，防止服务端自动 302 静默跳回旧账号，强制弹出全新登录框
    let login_url = reqwest::Url::parse_with_params(
        "https://account.coolapk.com/auth/logout",
        &[("forward", target_login)],
    )
    .map_err(|e| e.to_string())?;

    eprintln!("[login-debug] open_login_webview url={}", login_url);

    // 远程域 IPC 在 Tauri 2 中受限，注入脚本侦测到有效 SESSID 后跳回本地回调页 {app_origin}/#/auth_callback?ck=<cookie>，
    // 由回调页及 Rust monitor 提取保存凭据并关窗。
    let js_script = r#"
        (function() {
            var APP_ORIGIN = "__APP_ORIGIN__";
            var saved = false;

            function checkLogoutPage() {
                var href = window.location.href || "";
                var text = (document.body && document.body.innerText) || "";
                if (href.indexOf('auth/logout') !== -1 || text.indexOf('已经退出登录') !== -1) {
                    window.location.replace("https://account.coolapk.com/auth/loginByCoolapk?forward=" + encodeURIComponent(APP_ORIGIN + "/#/auth_callback"));
                    return true;
                }
                return false;
            }

            function hasValidSessId(cookies) {
                if (!cookies) return false;
                var sm = cookies.match(/(?:^|;\s*)SESSID=([^;]+)/i);
                var um = cookies.match(/(?:^|;\s*)uid=([^;]+)/i);
                var sOk = sm && sm[1].trim().length > 5 && sm[1].indexOf('deleted') === -1 && sm[1].indexOf('expired') === -1;
                var uOk = um && um[1].trim() !== '0' && um[1].trim() !== '10000' && um[1].trim().length > 0;
                return Boolean(sOk && uOk);
            }

            function relayBack() {
                if (saved) return;
                var cookies = document.cookie || "";
                if (!hasValidSessId(cookies)) return;
                saved = true;
                window.location.replace(APP_ORIGIN + "/#/auth_callback?ck=" + encodeURIComponent(cookies));
            }

            if (checkLogoutPage()) return;

            document.addEventListener('DOMContentLoaded', function() {
                if (!checkLogoutPage()) {
                    relayBack();
                }
            });

            // 1. XHR 拦截：validateLogin / 登录 API 响应完成后等待 Cookie 写入立刻检查并回跳
            try {
                var oldOpen = XMLHttpRequest.prototype.open;
                var oldSend = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.open = function(method, url) {
                    this._reqUrl = url || "";
                    return oldOpen.apply(this, arguments);
                };
                XMLHttpRequest.prototype.send = function() {
                    this.addEventListener('load', function() {
                        if (this._reqUrl && (this._reqUrl.indexOf('validateLogin') !== -1 || this._reqUrl.indexOf('loginByCoolapk') !== -1 || this._reqUrl.indexOf('/account/login') !== -1)) {
                            setTimeout(relayBack, 250);
                        }
                    });
                    return oldSend.apply(this, arguments);
                };
            } catch(e) {}

            // 2. 轮询侦测真实有效的 SESSID 与 uid Cookie（绝不误判访客 uid=0）
            setInterval(function() {
                if (checkLogoutPage()) return;
                relayBack();
            }, 300);
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
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;
            if let Some(win) = app_handle.get_webview_window("login_window") {
                if let Ok(url) = win.url() {
                    let url_str = url.as_str();
                    let app_origin = get_app_origin(&app_handle);

                    eprintln!("[login-debug:monitor] url_origin={}", redact_url(url_str));

                    // 已落在登出提示页 auth/logout：自动跳至登录主页 loginByCoolapk
                    if url_str.contains("auth/logout") {
                        eprintln!(
                            "[login-debug:monitor] landed on logout page, auto-navigating to loginByCoolapk"
                        );
                        let target_login = format!(
                            "https://account.coolapk.com/auth/loginByCoolapk?forward={}/#/auth_callback",
                            app_origin
                        );
                        let _ = win.eval(&format!("window.location.replace('{}');", target_login));
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                        continue;
                    }

                    // 已回到本地回调页：凭据随 URL 带回，Rust 直接解析 ck 写入会话并关窗
                    if url_str.starts_with(&format!("{}/", app_origin)) {
                        eprintln!("[login-debug:monitor] reached app-origin callback");
                        let mut valid = false;
                        if let Some(ck) = extract_ck_from_url(url_str) {
                            if !ck.trim().is_empty() {
                                let state = app_handle.state::<AppState>();
                                if state.client.set_user_cookie(ck.clone()).is_ok() {
                                    if state.client.check_login_info().await.is_ok() {
                                        valid = true;
                                        eprintln!(
                                            "[login-debug:monitor] cookie captured and validated, len={}",
                                            ck.len()
                                        );
                                    }
                                }
                            }
                        }
                        if valid {
                            let _ = win.close();
                            use tauri::Emitter;
                            let _ = app_handle.emit("login-window-closed", ());
                            break;
                        }
                    }

                    // 登录落地页（www.coolapk.com / m.coolapk.com）：严禁抓取 uid=0 或空 SESSID
                    if (url_str.contains("www.coolapk.com")
                        || url_str.contains("m.coolapk.com")
                        || url_str.contains("coolapk.com"))
                        && !url_str.contains("account.coolapk.com/auth")
                    {
                        let eval_script = format!(
                            "(function() {{ var c = document.cookie || ''; var sm = c.match(/(?:^|;\\s*)SESSID=([^;]+)/i); var um = c.match(/(?:^|;\\s*)uid=([^;]+)/i); var sOk = sm && sm[1].trim().length > 5 && sm[1].indexOf('deleted') === -1; var uOk = um && um[1].trim() !== '0' && um[1].trim() !== '10000' && um[1].trim().length > 0; if (sOk && uOk) {{ window.location.replace('{}/#/auth_callback?ck=' + encodeURIComponent(c)); }} }})()",
                            app_origin
                        );
                        let _ = win.eval(&eval_script);
                    }
                }
            } else {
                break;
            }
        }
    });

    Ok(())
}

/// 后台静默下载更新安装包，实时向前端广播下载进度；
/// 支持限速（speed_limit_kbps，0 为不限速）与 HTTP 代理（proxy_url，空为不使用）
///
/// 安全约束：仅允许 https + GitHub 官方域名白名单（含 release 资源重定向目标），
/// 文件名净化 + 体积上限，防止前端被注入时被利用下载并执行任意文件。
const UPDATE_ALLOWED_HOSTS: &[&str] = &[
    "github.com",
    "www.github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
];
const UPDATE_MAX_BYTES: u64 = 500 * 1024 * 1024;

#[tauri::command]
pub async fn download_update(
    app: tauri::AppHandle,
    url: String,
    speed_limit_kbps: Option<u64>,
    proxy_url: Option<String>,
) -> Result<String, String> {
    use tauri::Emitter;
    use tokio::io::AsyncWriteExt;

    let parsed_url = reqwest::Url::parse(&url).map_err(|e| format!("更新链接无效: {e}"))?;
    if parsed_url.scheme() != "https" {
        return Err("更新链接必须为 HTTPS".to_string());
    }
    let host = parsed_url
        .host_str()
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !UPDATE_ALLOWED_HOSTS.contains(&host.as_str()) {
        return Err(format!("更新链接域名不在允许列表内: {host}"));
    }

    let dir = std::env::temp_dir().join("coolapk-desktop-update");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // 文件名净化：只保留安全字符，防路径穿越（..\..\x.exe 等），并限制扩展名
    let raw_name = url.rsplit('/').next().unwrap_or("").trim();
    let safe_name: String = raw_name
        .chars()
        .take(128)
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .collect();
    if safe_name.is_empty() || !(safe_name.ends_with(".exe") || safe_name.ends_with(".msi")) {
        return Err("更新包文件名不合法".to_string());
    }
    let path = dir.join(safe_name);

    let mut builder = reqwest::Client::builder().user_agent("coolapk-desktop-updater");
    if let Some(proxy) = proxy_url.filter(|p| !p.trim().is_empty()) {
        builder =
            builder.proxy(reqwest::Proxy::all(proxy).map_err(|e| format!("代理设置无效: {e}"))?);
    }
    let client = builder.build().map_err(|e| e.to_string())?;
    let mut response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("下载失败：HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    if total > UPDATE_MAX_BYTES {
        return Err("更新包体积异常（超过 500MB），已拒绝下载".to_string());
    }
    let mut file = tokio::fs::File::create(&path)
        .await
        .map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    // 限速：按 1 秒滑动窗口累积字节数，超出配额后补眠
    let limit_bytes_per_sec = speed_limit_kbps.unwrap_or(0).saturating_mul(1024);
    let mut window_bytes: u64 = 0;
    let mut window_start = tokio::time::Instant::now();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        downloaded += chunk.len() as u64;
        if downloaded > UPDATE_MAX_BYTES {
            let _ = tokio::fs::remove_file(&path).await;
            return Err("更新包体积异常（超过 500MB），已中止下载".to_string());
        }
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        if limit_bytes_per_sec > 0 {
            window_bytes += chunk.len() as u64;
            let elapsed = window_start.elapsed().as_secs_f64();
            if elapsed >= 1.0 {
                window_bytes = 0;
                window_start = tokio::time::Instant::now();
            } else {
                let budget = window_bytes as f64 / limit_bytes_per_sec as f64;
                if budget > elapsed {
                    tokio::time::sleep(std::time::Duration::from_secs_f64(budget - elapsed)).await;
                }
            }
        }
        if total > 0 {
            let _ = app.emit(
                "update-download-progress",
                serde_json::json!({ "downloaded": downloaded, "total": total }),
            );
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;
    // 服务端声明了文件大小时校验完整性，避免保存半成品安装包
    if total > 0 && downloaded != total {
        let _ = tokio::fs::remove_file(&path).await;
        return Err(format!("下载中断：已下载 {downloaded}/{total} 字节"));
    }
    Ok(path.to_string_lossy().to_string())
}

/// 将文本内容以 JSON 形式导出到指定目录（dir 为空时使用系统下载目录），返回完整保存路径
#[tauri::command]
pub fn export_json_file(
    app: tauri::AppHandle,
    file_name: String,
    content: String,
    dir: Option<String>,
) -> Result<String, String> {
    use tauri::Manager;

    // 文件名净化：只保留安全字符，拒绝 .. 路径穿越与空名，并限制长度与内容体积
    let safe_name: String = file_name
        .chars()
        .take(100)
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .collect();
    if safe_name.is_empty() || safe_name == "." || safe_name == ".." || safe_name.contains("..") {
        return Err("导出文件名不合法".to_string());
    }
    if content.len() > 20 * 1024 * 1024 {
        return Err("导出内容过大（超过 20MB）".to_string());
    }

    let dir = dir
        .filter(|d| !d.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| app.path().download_dir().ok())
        .unwrap_or_else(|| std::env::temp_dir());
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(safe_name);
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn dir_total_size(dir: &std::path::Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    total += dir_total_size(&entry.path());
                } else {
                    total += meta.len();
                }
            }
        }
    }
    total
}

const IMAGE_CACHE_CONTAINER: &str = "CoolapkDesktopCache";
const IMAGE_CACHE_MAGIC: &str = "COOLAPK_IMAGE_CACHE_V1";

fn image_cache_root(app: &tauri::AppHandle, custom_dir: Option<&str>) -> Result<PathBuf, String> {
    let base = custom_dir
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .map(Ok)
        .unwrap_or_else(|| app.path().app_cache_dir().map_err(|e| e.to_string()))?;
    Ok(base.join(IMAGE_CACHE_CONTAINER).join("images"))
}

fn image_cache_file(
    app: &tauri::AppHandle,
    custom_dir: Option<&str>,
    url: &str,
) -> Result<PathBuf, String> {
    let mut hasher = Md5::new();
    hasher.update(url.as_bytes());
    let key = hex::encode(hasher.finalize());
    Ok(image_cache_root(app, custom_dir)?.join(format!("{key}.bin")))
}

async fn read_image_cache(path: &std::path::Path, ttl_days: u64) -> Option<String> {
    let metadata = tokio::fs::metadata(path).await.ok()?;
    if ttl_days > 0 {
        let max_age = Duration::from_secs(ttl_days.saturating_mul(24 * 60 * 60));
        let modified = metadata.modified().ok()?;
        if SystemTime::now().duration_since(modified).ok()? > max_age {
            let _ = tokio::fs::remove_file(path).await;
            return None;
        }
    }

    let bytes = tokio::fs::read(path).await.ok()?;
    let first_break = bytes.iter().position(|byte| *byte == b'\n')?;
    let second_break = bytes[first_break + 1..]
        .iter()
        .position(|byte| *byte == b'\n')?
        + first_break
        + 1;
    let magic = std::str::from_utf8(&bytes[..first_break]).ok()?;
    let mime = std::str::from_utf8(&bytes[first_break + 1..second_break]).ok()?;
    if magic != IMAGE_CACHE_MAGIC || !mime.starts_with("image/") {
        let _ = tokio::fs::remove_file(path).await;
        return None;
    }
    Some(format!(
        "data:{mime};base64,{}",
        BASE64.encode(&bytes[second_break + 1..])
    ))
}

async fn write_image_cache(path: &std::path::Path, data_url: &str) -> Result<(), String> {
    let (meta, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "图片数据格式不正确".to_string())?;
    let mime = meta
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
        .filter(|value| value.starts_with("image/"))
        .ok_or_else(|| "图片类型不正确".to_string())?;
    let image = BASE64
        .decode(encoded)
        .map_err(|e| format!("图片缓存解码失败：{e}"))?;
    let parent = path.parent().ok_or_else(|| "缓存目录不正确".to_string())?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|e| format!("创建缓存目录失败：{e}"))?;

    let mut content = format!("{IMAGE_CACHE_MAGIC}\n{mime}\n").into_bytes();
    content.extend_from_slice(&image);
    let temp = path.with_extension(format!("tmp-{}", std::process::id()));
    tokio::fs::write(&temp, content)
        .await
        .map_err(|e| format!("写入图片缓存失败：{e}"))?;
    if tokio::fs::rename(&temp, path).await.is_err() {
        let _ = tokio::fs::remove_file(path).await;
        tokio::fs::rename(&temp, path)
            .await
            .map_err(|e| format!("保存图片缓存失败：{e}"))?;
    }
    Ok(())
}

fn cache_locations(
    app: &tauri::AppHandle,
    custom_dir: Option<&str>,
) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let image = image_cache_root(app, custom_dir)?;
    let webview = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("EBWebView");
    let update = std::env::temp_dir().join("coolapk-desktop-update");
    Ok((image, webview, update))
}

fn clear_dir_contents(dir: &std::path::Path) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let _ = std::fs::remove_dir_all(&path);
            } else {
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}

/// 统计当前图片缓存、WebView 缓存和更新包临时文件，并返回实际图片缓存目录。
#[tauri::command]
pub fn get_cache_info(
    app: tauri::AppHandle,
    cache_dir: Option<String>,
) -> Result<serde_json::Value, String> {
    let (image, webview, update) = cache_locations(&app, cache_dir.as_deref())?;
    let _ = std::fs::create_dir_all(&image);
    let image_bytes = dir_total_size(&image);
    let webview_bytes = dir_total_size(&webview);
    let update_bytes = dir_total_size(&update);
    Ok(serde_json::json!({
        "bytes": image_bytes + webview_bytes + update_bytes,
        "imageBytes": image_bytes,
        "webviewBytes": webview_bytes,
        "updateBytes": update_bytes,
        "path": image.to_string_lossy(),
    }))
}

/// 删除图片、WebView 与更新包缓存。只清理由应用固定创建的缓存子目录。
#[tauri::command]
pub fn clear_app_cache(
    app: tauri::AppHandle,
    cache_dir: Option<String>,
) -> Result<serde_json::Value, String> {
    let (image, webview, update) = cache_locations(&app, cache_dir.as_deref())?;
    let _ = std::fs::remove_dir_all(&image);
    let _ = std::fs::create_dir_all(&image);
    clear_dir_contents(&webview);
    let _ = std::fs::remove_dir_all(&update);
    get_cache_info(app, cache_dir)
}

/// 删除超过设置天数的原生图片缓存，启动和修改过期时间时调用。
#[tauri::command]
pub fn clean_expired_cache(
    app: tauri::AppHandle,
    cache_dir: Option<String>,
    cache_ttl_days: u64,
) -> Result<serde_json::Value, String> {
    let image = image_cache_root(&app, cache_dir.as_deref())?;
    if cache_ttl_days > 0 {
        let max_age = Duration::from_secs(cache_ttl_days.saturating_mul(24 * 60 * 60));
        if let Ok(entries) = std::fs::read_dir(&image) {
            for entry in entries.flatten() {
                let path = entry.path();
                let expired = entry
                    .metadata()
                    .ok()
                    .and_then(|meta| meta.modified().ok())
                    .and_then(|modified| SystemTime::now().duration_since(modified).ok())
                    .is_some_and(|age| age > max_age);
                if expired && path.is_file() {
                    let _ = std::fs::remove_file(path);
                }
            }
        }
    }
    get_cache_info(app, cache_dir)
}

/// 打开当前图片缓存目录，方便用户查看实际落盘文件。
#[tauri::command]
pub fn open_cache_directory(
    app: tauri::AppHandle,
    cache_dir: Option<String>,
) -> Result<String, String> {
    let image = image_cache_root(&app, cache_dir.as_deref())?;
    std::fs::create_dir_all(&image).map_err(|e| format!("创建缓存目录失败：{e}"))?;
    opener::open(&image).map_err(|e| format!("打开缓存目录失败：{e}"))?;
    Ok(image.to_string_lossy().to_string())
}

/// 以静默更新模式启动安装包：/S 静默、/UPDATE 跳过卸载、/R 安装完成后自动重新启动应用
#[tauri::command]
pub fn install_update(installer_path: String) -> Result<(), String> {
    // 只允许执行更新目录内的 .exe/.msi 安装包：
    // 路径必须真实存在于下载目录（canonicalize 解析 .. / 符号链接后再前缀校验），
    // 防止前端被注入时借助该命令执行任意文件。
    let canonical = std::fs::canonicalize(&installer_path)
        .map_err(|_| "更新安装包不存在，可能已被清理，请重新下载".to_string())?;
    let expected_dir = std::env::temp_dir().join("coolapk-desktop-update");
    let expected_dir = expected_dir.canonicalize().unwrap_or(expected_dir);
    if !canonical.starts_with(&expected_dir) {
        return Err("拒绝安装不在更新目录内的文件".to_string());
    }
    let ext = canonical
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if ext != "exe" && ext != "msi" {
        return Err("拒绝安装非安装包文件".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(&canonical)
            .args(["/S", "/UPDATE", "/R"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = canonical;
    }
    Ok(())
}

/// 退出整个应用（用于更新前关闭窗口）
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// === 应用集 ===
#[tauri::command]
pub async fn get_album_list(
    state: State<'_, AppState>,
    list_type: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_album_list(&list_type, page).await
}

#[tauri::command]
pub async fn search_albums(
    state: State<'_, AppState>,
    query: String,
    page: u32,
) -> Result<Value, String> {
    state.client.search_albums(&query, page).await
}

#[tauri::command]
pub async fn get_album_detail(
    state: State<'_, AppState>,
    album_id: String,
) -> Result<Value, String> {
    state.client.get_album_detail(&album_id).await
}

#[tauri::command]
pub async fn get_album_replies(
    state: State<'_, AppState>,
    album_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_album_replies(&album_id, page).await
}

// === 头条/编辑精选 ===
#[tauri::command]
pub async fn get_headline_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_headline_feeds(page).await
}

#[tauri::command]
pub async fn get_update_list(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_update_list(page).await
}

#[tauri::command]
pub async fn get_editor_choice_feeds(
    state: State<'_, AppState>,
    page: u32,
) -> Result<Value, String> {
    state.client.get_editor_choice_feeds(page).await
}

// === 应用额外 ===
#[tauri::command]
pub async fn get_apk_discoverers(
    state: State<'_, AppState>,
    package_name: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_apk_discoverers(&package_name, page).await
}

#[tauri::command]
pub async fn get_apk_recommend_list(
    state: State<'_, AppState>,
    apk_type: String,
    title: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_apk_recommend_list(&apk_type, &title, page)
        .await
}

#[tauri::command]
pub async fn get_apk_gift_list(
    state: State<'_, AppState>,
    apk_id: Option<String>,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_apk_gift_list(apk_id.as_deref(), page)
        .await
}

#[tauri::command]
pub async fn get_download_version_list(
    state: State<'_, AppState>,
    package_name: String,
) -> Result<Value, String> {
    state.client.get_download_version_list(&package_name).await
}

// === 图片 ===
#[tauri::command]
pub async fn get_picture_list(
    state: State<'_, AppState>,
    tag: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_picture_list(&tag, page).await
}

// === 用户 ===
#[tauri::command]
pub async fn get_user_rating_list(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_user_rating_list(&uid, page).await
}

// === 搜索 ===
#[tauri::command]
pub async fn search_apks_by_developer(
    state: State<'_, AppState>,
    developer: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .search_apks_by_developer(&developer, page)
        .await
}

#[tauri::command]
pub async fn search_apks_by_tag(
    state: State<'_, AppState>,
    tag: String,
    apk_type: String,
    page: u32,
) -> Result<Value, String> {
    state.client.search_apks_by_tag(&tag, &apk_type, page).await
}

#[cfg(test)]
mod cache_tests {
    use super::{
        build_image_file_name, decode_image_data_url, next_available_file_path, read_image_cache,
        write_image_cache,
    };
    use std::time::{SystemTime, UNIX_EPOCH};

    #[tokio::test]
    async fn image_cache_round_trip_keeps_binary_data() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("coolapk-image-cache-test-{unique}"));
        let path = root.join("sample.bin");
        let expected = "data:image/png;base64,Y2FjaGUtdGVzdA==";

        write_image_cache(&path, expected).await.unwrap();
        let actual = read_image_cache(&path, 7).await;

        assert_eq!(actual.as_deref(), Some(expected));
        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn invalid_image_cache_is_ignored() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("coolapk-image-cache-invalid-{unique}"));
        let path = root.join("sample.bin");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(&path, b"broken-cache").unwrap();

        assert!(read_image_cache(&path, 7).await.is_none());
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn image_save_helpers_keep_original_format_and_avoid_overwrite() {
        let (mime_type, bytes) = decode_image_data_url("data:image/png;base64,YWJj").unwrap();
        assert_eq!(mime_type, "image/png");
        assert_eq!(bytes, b"abc");
        assert_eq!(
            build_image_file_name("https://image.coolapk.com/feed/2026/abc123.jpg", mime_type),
            "abc123.png"
        );

        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("coolapk-image-save-test-{unique}"));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("abc123.png"), b"existing").unwrap();
        assert_eq!(
            next_available_file_path(&root, "abc123.png"),
            root.join("abc123_2.png")
        );
        let _ = std::fs::remove_dir_all(root);
    }
}
