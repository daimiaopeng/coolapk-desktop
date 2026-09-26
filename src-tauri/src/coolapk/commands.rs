use crate::coolapk::client::{CoolapkClient, DeviceProfile};
use crate::download_manager::{DownloadControl, DownloadManager};
use base64::{Engine as _, engine::general_purpose::{STANDARD as BASE64, STANDARD_NO_PAD as BASE64_NO_PAD}};
use md5::{Digest, Md5};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime};
use tauri::{Emitter, Manager, State};

pub struct AppState {
    pub client: CoolapkClient,
    pub downloads: DownloadManager,
}

static IMAGE_SAVE_LOCK: Mutex<()> = Mutex::new(());
static IMAGE_TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// 登录窗口使用桌面 Chromium UA，避免网易易盾把鼠标事件误判为仅支持触摸事件。
const LOGIN_WEBVIEW_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

#[tauri::command]
pub async fn get_index_v8_feeds(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_index_v8_feeds(page).await
}

#[tauri::command]
pub async fn get_index_v8_feeds_paged(
    state: State<'_, AppState>,
    page: u32,
    first_item: String,
    last_item: String,
) -> Result<Value, String> {
    state
        .client
        .get_index_v8_feeds_paged(page, &first_item, &last_item)
        .await
}

#[tauri::command]
pub async fn get_index_v8_entities_paged(
    state: State<'_, AppState>,
    page: u32,
    first_item: String,
    last_item: String,
) -> Result<Value, String> {
    state
        .client
        .get_index_v8_entities_paged(page, &first_item, &last_item)
        .await
}

#[tauri::command]
pub async fn get_tab_config(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_tab_config().await
}

#[tauri::command]
pub async fn update_home_tab_config(
    state: State<'_, AppState>,
    config_json: String,
) -> Result<Value, String> {
    state.client.update_home_tab_config(&config_json).await
}

#[tauri::command]
pub async fn get_discovery_config(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_discovery_config().await
}

#[tauri::command]
pub async fn get_discovery_page_data(
    state: State<'_, AppState>,
    url: String,
    title: String,
    sub_title: String,
    page: u32,
    first_item: String,
    last_item: String,
    page_context: String,
    request_args_json: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .get_discovery_page_data(
            &url,
            &title,
            &sub_title,
            page,
            &first_item,
            &last_item,
            &page_context,
            request_args_json.as_deref().unwrap_or(""),
        )
        .await
}

#[tauri::command]
pub async fn get_live_detail(state: State<'_, AppState>, live_id: String) -> Result<Value, String> {
    state.client.get_live_detail(&live_id).await
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
    list_type: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_product_feeds(&product_id, &feed_type, &list_type, page)
        .await
}

#[tauri::command]
pub async fn get_product_config(
    state: State<'_, AppState>,
    config_id: String,
) -> Result<Value, String> {
    state.client.get_product_config(&config_id).await
}

#[tauri::command]
pub async fn add_config_compare(
    state: State<'_, AppState>,
    config_id: String,
) -> Result<Value, String> {
    state.client.add_config_compare(&config_id).await
}

#[tauri::command]
pub async fn remove_config_compare(
    state: State<'_, AppState>,
    config_id: String,
) -> Result<Value, String> {
    state.client.remove_config_compare(&config_id).await
}

#[tauri::command]
pub async fn get_product_brand_list(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_product_brand_list().await
}

#[tauri::command]
pub async fn get_product_category_list(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_product_category_list().await
}

#[tauri::command]
pub async fn get_product_list(
    state: State<'_, AppState>,
    url: String,
    title: String,
    sub_title: String,
    page: u32,
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .get_product_list(&url, &title, &sub_title, page, first_item.as_deref().unwrap_or(""), last_item.as_deref().unwrap_or(""))
        .await
}

#[tauri::command]
pub async fn get_product_brand_products(
    state: State<'_, AppState>,
    brand_id: String,
    brand_type: String,
    page: u32,
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .get_product_brand_products(&brand_id, &brand_type, page, first_item.as_deref().unwrap_or(""), last_item.as_deref().unwrap_or(""))
        .await
}

#[tauri::command]
pub async fn get_secondhand_brand_list(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_secondhand_brand_list().await
}

#[tauri::command]
pub async fn get_secondhand_product_list(
    state: State<'_, AppState>,
    brand_id: String,
    list_type: String,
    page: u32,
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .get_secondhand_product_list(&brand_id, &list_type, page, first_item.as_deref().unwrap_or(""), last_item.as_deref().unwrap_or(""))
        .await
}

#[tauri::command]
pub async fn get_product_media_list(
    state: State<'_, AppState>,
    product_id: String,
    media_type: String,
    is_recommend: i32,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_product_media_list(&product_id, &media_type, is_recommend, page)
        .await
}

#[tauri::command]
pub async fn change_product_wish_status(
    state: State<'_, AppState>,
    product_id: String,
    status: i32,
) -> Result<Value, String> {
    state
        .client
        .change_product_wish_status(&product_id, status)
        .await
}

#[tauri::command]
pub async fn change_product_follow_status(
    state: State<'_, AppState>,
    product_id: String,
    status: i32,
) -> Result<Value, String> {
    state
        .client
        .change_product_follow_status(&product_id, status)
        .await
}

#[tauri::command]
pub async fn get_product_wish_list(
    state: State<'_, AppState>,
    product_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_product_wish_list(&product_id, page).await
}

#[tauri::command]
pub async fn get_product_buy_list(
    state: State<'_, AppState>,
    product_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_product_buy_list(&product_id, page).await
}

#[tauri::command]
pub async fn get_my_product_list(
    state: State<'_, AppState>,
    uid: String,
    product_type: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_my_product_list(&uid, &product_type, page)
        .await
}

#[tauri::command]
pub async fn get_product_rating_chart(
    state: State<'_, AppState>,
    product_id: String,
) -> Result<Value, String> {
    state.client.get_product_rating_chart(&product_id).await
}

#[tauri::command]
pub async fn get_product_rating_list(
    state: State<'_, AppState>,
    product_id: String,
    star: i32,
    is_owner: i32,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_product_rating_list(&product_id, star, is_owner, page)
        .await
}

#[tauri::command]
pub async fn get_apk_rating_user_list(
    state: State<'_, AppState>,
    apk_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_apk_rating_user_list(&apk_id, page).await
}

#[tauri::command]
pub async fn change_rating_status(
    state: State<'_, AppState>,
    product_id: String,
    value: i32,
    uid: String,
    buy_status: Option<i32>,
    is_owner: Option<i32>,
) -> Result<Value, String> {
    state
        .client
        .change_rating_status(&product_id, value, &uid, buy_status, is_owner)
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
pub async fn get_event_list(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_event_list(page).await
}

#[tauri::command]
pub async fn get_event_detail(
    state: State<'_, AppState>,
    event_id: String,
) -> Result<Value, String> {
    state.client.get_event_detail(&event_id).await
}

#[tauri::command]
pub async fn get_dyh_follow_list(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_dyh_follow_list(page).await
}

#[tauri::command]
pub async fn get_dyh_subscribe_list(
    state: State<'_, AppState>,
    page: u32,
) -> Result<Value, String> {
    state.client.get_dyh_subscribe_list(page).await
}

#[tauri::command]
pub async fn get_dyh_editor_list(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_dyh_editor_list(page).await
}

#[tauri::command]
pub async fn get_user_product_albums(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_user_product_albums(&uid, page).await
}

#[tauri::command]
pub async fn get_goods_list_items(
    state: State<'_, AppState>,
    uid: String,
    goods_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_goods_list_items(&uid, &goods_id, page).await
}

#[tauri::command]
pub async fn create_product_album(
    state: State<'_, AppState>,
    title: String,
    description: String,
    album_type: u32,
    target_type: String,
    target_id: String,
    product_items: String,
) -> Result<Value, String> {
    state
        .client
        .create_product_album(
            &title,
            &description,
            album_type,
            &target_type,
            &target_id,
            &product_items,
        )
        .await
}

#[tauri::command]
pub async fn get_node_feeds(
    state: State<'_, AppState>,
    node_type: String,
    node_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_node_feeds(&node_type, &node_id, page).await
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
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .get_favorite_list(
            &fav_type,
            page,
            first_item.as_deref().unwrap_or(""),
            last_item.as_deref().unwrap_or(""),
        )
        .await
}

#[tauri::command]
pub async fn get_feed_collection_status(
    state: State<'_, AppState>,
    feed_id: String,
) -> Result<Value, String> {
    state.client.get_feed_collection_status(&feed_id).await
}

#[tauri::command]
pub async fn update_collection_item(
    state: State<'_, AppState>,
    collection_ids: String,
    cancel_ids: String,
    target_id: String,
    feed_type: String,
    trace: String,
) -> Result<Value, String> {
    state
        .client
        .update_collection_item(
            &collection_ids,
            &cancel_ids,
            &target_id,
            &feed_type,
            &trace,
        )
        .await
}

#[tauri::command]
pub async fn get_collection_list(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state.client.get_collection_list(&uid, page, first_item.as_deref().unwrap_or(""), last_item.as_deref().unwrap_or("")).await
}

#[tauri::command]
pub async fn get_collection_item_list(
    state: State<'_, AppState>,
    collection_id: String,
    page: u32,
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .get_collection_item_list(
            &collection_id,
            page,
            first_item.as_deref().unwrap_or(""),
            last_item.as_deref().unwrap_or(""),
        )
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
pub async fn create_collection(
    state: State<'_, AppState>,
    title: String,
    description: String,
    cover: String,
    is_open: i32,
    source_id: String,
) -> Result<Value, String> {
    state
        .client
        .create_collection(&title, &description, &cover, is_open, &source_id)
        .await
}

#[tauri::command]
pub async fn update_collection(
    state: State<'_, AppState>,
    id: String,
    title: String,
    description: String,
    cover: String,
    is_open: i32,
) -> Result<Value, String> {
    state
        .client
        .update_collection(&id, &title, &description, &cover, is_open)
        .await
}

#[tauri::command]
pub async fn delete_collection(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    state.client.delete_collection(&id).await
}

#[tauri::command]
pub async fn remove_collection_item(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<Value, String> {
    state.client.remove_collection_item(&item_id).await
}

#[tauri::command]
pub async fn clear_collection_invalid_items(
    state: State<'_, AppState>,
    collection_id: String,
) -> Result<Value, String> {
    state
        .client
        .clear_collection_invalid_items(&collection_id)
        .await
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
pub async fn follow_live(state: State<'_, AppState>, live_id: String) -> Result<Value, String> {
    state.client.follow_live(&live_id).await
}

#[tauri::command]
pub async fn unfollow_live(state: State<'_, AppState>, live_id: String) -> Result<Value, String> {
    state.client.unfollow_live(&live_id).await
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
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .get_device_feed_list(&tag, page, first_item.as_deref().unwrap_or(""), last_item.as_deref().unwrap_or(""))
        .await
}

#[tauri::command]
pub async fn get_question_answers(
    state: State<'_, AppState>,
    feed_id: String,
    sort: String,
    page: u32,
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .get_question_answers(
            &feed_id,
            &sort,
            page,
            first_item.as_deref().unwrap_or(""),
            last_item.as_deref().unwrap_or(""),
        )
        .await
}

#[tauri::command]
pub async fn follow_question(state: State<'_, AppState>, question_id: String) -> Result<Value, String> {
    state.client.follow_question(&question_id).await
}

#[tauri::command]
pub async fn unfollow_question(state: State<'_, AppState>, question_id: String) -> Result<Value, String> {
    state.client.unfollow_question(&question_id).await
}

#[tauri::command]
pub async fn invite_question_answer(state: State<'_, AppState>, question_id: String, uid: String) -> Result<Value, String> {
    state.client.invite_question_answer(&question_id, &uid).await
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
pub async fn create_user_vote(
    state: State<'_, AppState>,
    feed_id: String,
    option_ids: Vec<String>,
    anonymous_status: bool,
) -> Result<Value, String> {
    state
        .client
        .create_user_vote(&feed_id, &option_ids, anonymous_status)
        .await
}

#[tauri::command]
pub async fn get_hit_history(
    state: State<'_, AppState>,
    page: u32,
    history_type: String,
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state.client.get_hit_history(page, &history_type, first_item.as_deref(), last_item.as_deref()).await
}

#[tauri::command]
pub async fn get_recent_history(state: State<'_, AppState>, page: u32, first_item: Option<String>, last_item: Option<String>) -> Result<Value, String> {
    state.client.get_recent_history(page, first_item.as_deref(), last_item.as_deref()).await
}

#[tauri::command]
pub async fn get_spam_feed_list(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_spam_feed_list(page).await
}

#[tauri::command]
pub async fn get_hidden_replies(
    state: State<'_, AppState>,
    feed_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_hidden_replies(&feed_id, page).await
}

#[tauri::command]
pub async fn get_followed_topics(state: State<'_, AppState>, page: u32) -> Result<Value, String> {
    state.client.get_followed_topics(page).await
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
pub async fn get_home_tab_config(
    state: State<'_, AppState>,
    reset: bool,
) -> Result<Value, String> {
    state.client.get_home_tab_config(reset).await
}

#[tauri::command]
pub async fn get_feed_detail(state: State<'_, AppState>, feed_id: String) -> Result<Value, String> {
    state.client.get_feed_detail(&feed_id).await
}

#[tauri::command]
pub async fn get_public_feed_detail(state: State<'_, AppState>, feed_id: String) -> Result<Value, String> {
    state.client.get_public_feed_detail(&feed_id).await
}

#[tauri::command]
pub async fn get_editable_feed(state: State<'_, AppState>, feed_id: String) -> Result<Value, String> {
    state.client.get_editable_feed(&feed_id).await
}

#[tauri::command]
pub async fn update_feed(state: State<'_, AppState>, feed_id: String, message: String, pic: String, post_token: Option<String>) -> Result<Value, String> {
    state.client.update_feed(&feed_id, &message, &pic, post_token.as_deref()).await
}

#[tauri::command]
pub async fn resolve_video_url(
    state: State<'_, AppState>,
    request_params: String,
) -> Result<Value, String> {
    state.client.resolve_video_url(&request_params).await
}

#[tauri::command]
pub async fn resolve_live_photo_video(
    state: State<'_, AppState>,
    image_url: String,
    content_id: String,
    content_type: String,
) -> Result<Value, String> {
    state
        .client
        .resolve_live_photo_video(&image_url, &content_id, &content_type)
        .await
}

#[tauri::command]
pub async fn get_live_photo_video_header(state: State<'_, AppState>, video_url: String) -> Result<String, String> {
    state.client.get_live_photo_video_header(&video_url).await
}

#[tauri::command]
pub async fn get_reply_detail(
    state: State<'_, AppState>,
    reply_id: String,
) -> Result<Value, String> {
    state.client.get_reply_detail(&reply_id).await
}

#[tauri::command]
pub async fn get_feed_replies(
    state: State<'_, AppState>,
    feed_id: String,
    page: u32,
    first_item: Option<String>,
    last_item: Option<String>,
    list_type: Option<String>,
    from_feed_author: Option<u32>,
) -> Result<Value, String> {
    state
        .client
        .get_feed_replies_paged(
            &feed_id,
            page,
            first_item.as_deref().unwrap_or(""),
            last_item.as_deref().unwrap_or(""),
            list_type.as_deref().unwrap_or("lastupdate_desc"),
            from_feed_author.unwrap_or(0),
        )
        .await
}

#[tauri::command]
pub async fn get_sub_replies(
    state: State<'_, AppState>,
    feed_id: String,
    reply_id: String,
    page: u32,
    last_item: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .get_sub_replies_paged(
            &feed_id,
            &reply_id,
            page,
            last_item.as_deref().unwrap_or(""),
        )
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
pub async fn search_by_type(
    state: State<'_, AppState>,
    search_type: String,
    query: String,
    page: u32,
    first_item: String,
    last_item: String,
    page_type: String,
    page_param: String,
    feed_type: String,
    sort: String,
    is_strict: u32,
    category: String,
    page_context: String,
) -> Result<Value, String> {
    state
        .client
        .search_by_type(
            &search_type,
            &query,
            page,
            &first_item,
            &last_item,
            &page_type,
            &page_param,
            &feed_type,
            &sort,
            is_strict,
            &category,
            &page_context,
        )
        .await
}

#[tauri::command]
pub async fn get_hot_searches(state: State<'_, AppState>, refresh: bool) -> Result<Value, String> {
    state.client.get_hot_searches(refresh).await
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
pub async fn get_public_user_space(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.get_public_user_space(&uid).await
}

#[tauri::command]
pub async fn get_user_profile(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.get_user_profile(&uid).await
}

#[tauri::command]
pub async fn get_public_user_profile(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.get_public_user_profile(&uid).await
}

#[tauri::command]
pub async fn get_user_remark_list(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.get_user_remark_list(&uid).await
}

#[tauri::command]
pub async fn update_user_profile(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<Value, String> {
    state.client.update_user_profile(&key, &value).await
}

#[tauri::command]
pub async fn change_avatar(
    state: State<'_, AppState>,
    image_bytes: Vec<u8>,
    file_name: String,
    content_type: String,
) -> Result<Value, String> {
    state
        .client
        .change_avatar(&image_bytes, &file_name, &content_type)
        .await
}

#[tauri::command]
pub async fn update_user_cover(
    state: State<'_, AppState>,
    url: String,
) -> Result<Value, String> {
    state.client.update_user_cover(&url).await
}

#[tauri::command]
pub async fn get_user_qr_image(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.get_user_qr_image(&uid).await
}

#[tauri::command]
pub async fn get_user_follow_nodes(
    state: State<'_, AppState>,
    uid: String,
) -> Result<Value, String> {
    state.client.get_user_follow_nodes(&uid).await
}

#[tauri::command]
pub async fn get_user_forum_follow_list(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_user_forum_follow_list(&uid, page).await
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
pub async fn get_user_like_list(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_user_like_list(&uid, page).await
}

#[tauri::command]
pub async fn get_user_tab_data(
    state: State<'_, AppState>,
    uid: String,
    tab: String,
    page: u32,
    first_item: String,
    last_item: String,
    rating_target: String,
) -> Result<Value, String> {
    state
        .client
        .get_user_tab_data(
            &uid,
            &tab,
            page,
            &first_item,
            &last_item,
            &rating_target,
        )
        .await
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
    list_type: String,
    first_item: String,
    last_item: String,
    block_status: i32,
) -> Result<Value, String> {
    state
        .client
        .get_topic_feeds(&tag, page, &list_type, &first_item, &last_item, block_status)
        .await
}

#[tauri::command]
pub async fn get_topic_tab_data(
    state: State<'_, AppState>,
    url: String,
    title: String,
    sub_title: String,
    page: u32,
    first_item: String,
    last_item: String,
    page_context: String,
) -> Result<Value, String> {
    state
        .client
        .get_topic_tab_data(&url, &title, &sub_title, page, &first_item, &last_item, &page_context)
        .await
}

#[tauri::command]
pub async fn get_topic_hub_data(
    state: State<'_, AppState>,
    sub_url: String,
    page: u32,
    first_item: String,
    last_item: String,
) -> Result<Value, String> {
    state
        .client
        .get_topic_hub_data(&sub_url, page, &first_item, &last_item)
        .await
}

#[tauri::command]
pub async fn get_app_detail(
    state: State<'_, AppState>,
    package_name: String,
) -> Result<Value, String> {
    state.client.get_app_detail(&package_name).await
}

#[tauri::command]
pub async fn get_apk_comments(
    state: State<'_, AppState>,
    app_id: String,
    list_type: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_apk_comments(&app_id, &list_type, page)
        .await
}

#[tauri::command]
pub async fn get_notification_count(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_notification_count().await
}

#[tauri::command]
pub async fn clear_notification_count(
    state: State<'_, AppState>,
    notification_type: String,
) -> Result<Value, String> {
    state.client.clear_notification_count(&notification_type).await
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
pub async fn get_recent_chat_users(
    state: State<'_, AppState>,
    page: u32,
) -> Result<Value, String> {
    state.client.get_recent_chat_users(page).await
}

#[tauri::command]
pub async fn list_chat_history(
    state: State<'_, AppState>,
    ukey: String,
    page: u32,
    first_item: Option<String>,
    last_item: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .list_chat_history(&ukey, page, first_item.as_deref().unwrap_or(""), last_item.as_deref().unwrap_or(""))
        .await
}

#[tauri::command]
pub async fn delete_message_chat(
    state: State<'_, AppState>,
    ukey: String,
) -> Result<Value, String> {
    state.client.delete_message_chat(&ukey).await
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

const APK_DOWNLOAD_MAX_BYTES: u64 = 8 * 1024 * 1024 * 1024;

fn download_value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) if !value.trim().is_empty() => Some(value.trim().to_string()),
        Value::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

fn download_object_string(value: Option<&Value>, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| value.and_then(|item| item.get(*key)).and_then(download_value_to_string))
}

fn decode_extra_analysis_data(value: &str) -> Option<Value> {
    let encoded = value.split('~').next()?.trim();
    if encoded.is_empty() {
        return None;
    }
    let bytes = BASE64
        .decode(encoded)
        .or_else(|_| BASE64_NO_PAD.decode(encoded))
        .ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn build_coolapk_download_url(package_name: &str, apk_id: &str, version_code: &str) -> Result<reqwest::Url, String> {
    let package_name = package_name.trim();
    let apk_id = apk_id.trim();
    let version_code = version_code.trim();
    if package_name.is_empty() || apk_id.is_empty() || version_code.is_empty() {
        return Err("应用下载参数不完整，缺少包名、应用 ID 或版本号".to_string());
    }
    let mut url = reqwest::Url::parse("https://api.coolapk.com/v6/apk/download")
        .map_err(|error| format!("构造酷安下载地址失败：{error}"))?;
    url.query_pairs_mut()
        .append_pair("pn", package_name)
        .append_pair("aid", apk_id)
        .append_pair("vc", version_code)
        .append_pair("extra", "");
    Ok(url)
}

fn is_coolapk_download_host(host: &str) -> bool {
    matches!(host.to_ascii_lowercase().as_str(), "api.coolapk.com" | "api-dev.coolapk.com")
}

fn is_windows_reserved_file_name(file_name: &str) -> bool {
    if !cfg!(windows) {
        return false;
    }
    let base_name = file_name
        .split('.')
        .next()
        .unwrap_or_default()
        .trim_end_matches(|character| character == ' ' || character == '.')
        .to_ascii_uppercase();
    if matches!(base_name.as_str(), "CON" | "PRN" | "AUX" | "NUL") {
        return true;
    }
    let bytes = base_name.as_bytes();
    (bytes.len() == 4 && (bytes.starts_with(b"COM") || bytes.starts_with(b"LPT")))
        && (b'1'..=b'9').contains(&bytes[3])
}

fn sanitize_apk_file_name(file_name: &str) -> Result<String, String> {
    let mut safe_name = file_name
        .chars()
        .take(160)
        .map(|character| {
            if character.is_control() || matches!(character, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
                '_'
            } else {
                character
            }
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();
    if safe_name.is_empty() || safe_name == "." || safe_name == ".." || safe_name.contains("..") {
        return Err("下载文件名不合法".to_string());
    }
    let lower_name = safe_name.to_ascii_lowercase();
    if ![".apk", ".xapk", ".apks"].iter().any(|suffix| lower_name.ends_with(suffix)) {
        safe_name.push_str(".apk");
    }
    if is_windows_reserved_file_name(&safe_name) {
        safe_name.insert(0, '_');
    }
    Ok(safe_name)
}

fn constrain_windows_download_file_name(target_dir: &Path, file_name: String) -> Result<String, String> {
    if !cfg!(windows) {
        return Ok(file_name);
    }
    const MAX_WINDOWS_PATH_UNITS: usize = 240;
    let path = Path::new(&file_name);
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("apk");
    let suffix = format!(".{extension}");
    let stem = path.file_stem().and_then(|value| value.to_str()).unwrap_or("coolapk");
    let directory_units = target_dir.as_os_str().to_string_lossy().encode_utf16().count();
    let reserved_units = directory_units + 1 + suffix.encode_utf16().count() + ".part".encode_utf16().count();
    let max_stem_units = MAX_WINDOWS_PATH_UNITS.saturating_sub(reserved_units);
    if max_stem_units == 0 {
        return Err("下载目录路径过长，请选择更短的目录".to_string());
    }
    let mut shortened_stem = String::new();
    let mut used_units = 0;
    for character in stem.chars() {
        let units = character.len_utf16();
        if used_units + units > max_stem_units {
            break;
        }
        shortened_stem.push(character);
        used_units += units;
    }
    if shortened_stem.is_empty() {
        return Err("下载文件名过长且无法缩短".to_string());
    }
    Ok(format!("{shortened_stem}{suffix}"))
}

fn partial_download_path(target: &Path) -> Result<PathBuf, String> {
    let file_name = target.file_name().ok_or_else(|| "下载文件路径不合法".to_string())?;
    let mut partial_name = file_name.to_os_string();
    partial_name.push(".part");
    Ok(target.with_file_name(partial_name))
}

fn paths_equivalent(left: &Path, right: &Path) -> bool {
    if cfg!(windows) {
        left.to_string_lossy().eq_ignore_ascii_case(&right.to_string_lossy())
    } else {
        left == right
    }
}

fn path_is_direct_child_of(path: &Path, target_dir: &Path) -> Result<bool, String> {
    let parent = path.parent().ok_or_else(|| "下载文件路径不合法".to_string())?;
    let canonical_dir = std::fs::canonicalize(target_dir).map_err(|_| "下载目录不存在或无法访问".to_string())?;
    let canonical_parent = std::fs::canonicalize(parent).map_err(|_| "下载文件所在目录不存在或无法访问".to_string())?;
    Ok(paths_equivalent(&canonical_dir, &canonical_parent))
}

fn reject_download_symlink(path: &Path) -> Result<(), String> {
    if let Ok(metadata) = std::fs::symlink_metadata(path) {
        if metadata.file_type().is_symlink() {
            return Err("拒绝操作符号链接下载文件".to_string());
        }
    }
    Ok(())
}

fn empty_download_verification(value: &Value) -> bool {
    match value.get("data") {
        None | Some(Value::Null) => true,
        Some(Value::String(data)) => data.trim().is_empty(),
        Some(_) => false,
    }
}

fn download_event_payload(
    task_id: &str,
    status: &str,
    downloaded: u64,
    total: u64,
    speed: u64,
    target_path: &std::path::Path,
    partial_path: &std::path::Path,
    error: Option<&str>,
) -> Value {
    let mut payload = json!({
        "taskId": task_id,
        "status": status,
        "downloaded": downloaded,
        "total": total,
        "speed": speed,
        "path": target_path.to_string_lossy(),
        "partialPath": partial_path.to_string_lossy(),
    });
    if let Some(error) = error {
        payload["error"] = json!(error);
    }
    payload
}

fn download_control(control: &tokio::sync::watch::Receiver<DownloadControl>) -> DownloadControl {
    *control.borrow()
}

async fn run_apk_download(
    app: &tauri::AppHandle,
    client: &CoolapkClient,
    control: &mut tokio::sync::watch::Receiver<DownloadControl>,
    task_id: &str,
    package_name: &str,
    apk_name: &str,
    apk_id: Option<&str>,
    version_code: Option<&str>,
    file_name: &str,
    dir: Option<&str>,
    target_path: Option<&str>,
    extra_analysis_data: Option<&str>,
    proxy_url: Option<&str>,
) -> Result<Value, String> {
    use reqwest::header::{ACCEPT_ENCODING, CONTENT_TYPE, COOKIE, RANGE};
    use tauri::Emitter;
    use tokio::io::AsyncWriteExt;

    let target_dir = user_save_dir(app, dir)?;
    tokio::fs::create_dir_all(&target_dir)
        .await
        .map_err(|error| format!("创建下载目录失败：{error}"))?;
    let safe_file_name = constrain_windows_download_file_name(&target_dir, sanitize_apk_file_name(file_name)?)?;
    let target = if let Some(raw_path) = target_path.map(str::trim).filter(|value| !value.is_empty()) {
        let path = validate_download_path_for_file_operation(raw_path)?;
        if !path_is_direct_child_of(&path, &target_dir)? {
            return Err("下载文件必须位于当前下载目录中".to_string());
        }
        reject_download_symlink(&path)?;
        path
    } else {
        next_available_file_path(&target_dir, &safe_file_name)
    };
    let partial = partial_download_path(&target)?;
    reject_download_symlink(&partial)?;
    if target.is_file() && !partial.is_file() {
        return Err(format!("目标文件已经存在：{}", target.display()));
    }
    let existing_length = tokio::fs::metadata(&partial)
        .await
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if existing_length == 0 && !partial.exists() {
        // 先创建唯一的临时文件占位，避免两个并发任务在网络请求期间选中同一个目标路径。
        let reservation = tokio::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&partial)
            .await
            .map_err(|error| format!("创建临时文件失败：{error}"))?;
        drop(reservation);
    }
    let _ = app.emit(
        "apk-download-progress",
        download_event_payload(task_id, "starting", existing_length, 0, 0, &target, &partial, None),
    );

    // 官方客户端先从应用详情取得数字应用 ID 和版本号，再请求 /v6/apk/download。
    // /v6/apk/url 返回的是网页跳转地址，不能当作安装包下载地址。
    let requested_apk_id = apk_id.map(str::trim).filter(|value| !value.is_empty());
    let requested_version_code = version_code.map(str::trim).filter(|value| !value.is_empty());
    let detail = if requested_apk_id.is_none() || requested_version_code.is_none() {
        Some(client.get_app_detail(package_name).await?)
    } else {
        None
    };
    let detail_data = detail.as_ref().and_then(|value| value.get("data"));
    let decoded_extra = extra_analysis_data
        .and_then(decode_extra_analysis_data)
        .or_else(|| detail_data.and_then(|value| value.get("extraAnalysisData")).and_then(Value::as_str).and_then(decode_extra_analysis_data));
    let resolved_apk_id = requested_apk_id
        .map(str::to_string)
        .or_else(|| download_object_string(detail_data, &["aid", "id", "entityId"]))
        .ok_or_else(|| "应用详情未返回数字应用 ID".to_string())?;
    let resolved_version_code = requested_version_code
        .map(str::to_string)
        .or_else(|| download_object_string(detail_data, &["versionCode", "versioncode", "version_code", "apkversioncode", "apkVersionCode", "apk_version_code"]))
        .or_else(|| download_object_string(decoded_extra.as_ref(), &["versionCode", "versioncode", "version_code"]))
        .ok_or_else(|| "应用详情未返回应用版本号".to_string())?;
    let request_url = build_coolapk_download_url(package_name, &resolved_apk_id, &resolved_version_code)?;
    let host = request_url.host_str().unwrap_or_default().to_string();
    let is_coolapk_download = is_coolapk_download_host(&host);

    if download_control(control) == DownloadControl::Cancel {
        let _ = tokio::fs::remove_file(&partial).await;
        let _ = app.emit(
            "apk-download-progress",
            download_event_payload(task_id, "canceled", 0, 0, 0, &target, &partial, None),
        );
        return Ok(json!({ "status": "canceled", "path": target, "partialPath": partial }));
    }

    let mut builder = reqwest::Client::builder()
        .user_agent("Dalvik/2.1.0 (Linux; U; Android 16; 23113RKC6C Build/AQ3A.250226.002) +CoolMarket/16.2.0-2604201-universal")
        .redirect(reqwest::redirect::Policy::limited(10));
    if let Some(proxy) = proxy_url.map(str::trim).filter(|value| !value.is_empty()) {
        builder = builder.proxy(reqwest::Proxy::all(proxy).map_err(|error| format!("代理设置无效：{error}"))?);
    }
    let http_client = builder.build().map_err(|error| format!("创建下载客户端失败：{error}"))?;
    let mut request = if is_coolapk_download {
        http_client
            .post(request_url.clone())
            .form(&[("nd", "1"), ("extraAnalysisData", "")])
    } else {
        http_client.get(request_url.clone())
    };
    if is_coolapk_download {
        request = client.apply_download_headers(request)?;
        if let Some(cookie) = client.get_user_cookie().filter(|value| !value.trim().is_empty()) {
            let header = reqwest::header::HeaderValue::from_str(&cookie)
                .map_err(|_| "登录 Cookie 格式无效".to_string())?;
            request = request.header(COOKIE, header);
        }
    }
    // 反编译 APK 的下载器无论是否断点续传都会发送这两个请求头。
    request = request
        .header(RANGE, format!("bytes={existing_length}-"))
        .header(ACCEPT_ENCODING, "identity");
    let mut response = request
        .send()
        .await
        .map_err(|error| format!("下载请求失败：{error}"))?;
    if response.status().as_u16() == 416 && existing_length > 0 {
        drop(response);
        let _ = tokio::fs::remove_file(&partial).await;
        return Err("服务器拒绝断点续传，已清理临时文件，请重试下载".to_string());
    }
    if !response.status().is_success() {
        return Err(format!("下载失败：HTTP {}", response.status()));
    }
    let response_status = response.status();
    let append = existing_length > 0 && response_status.as_u16() == 206;
    let initial_downloaded = if append { existing_length } else { 0 };
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if content_type.starts_with("text/html") || content_type.starts_with("application/xhtml+xml") {
        return Err("下载响应是网页内容，不是应用安装包，已拒绝保存".to_string());
    }
    let final_url = response.url().to_string();
    if is_coolapk_download {
        // 反编译 APK 的 CoolMarketDownloadNetworkExecutor 会在收到响应后调用
        // downloadVerify；接口异常时官方会继续下载，只有明确返回空结果才判定为劫持。
        if let Ok(verification) = client
            .verify_apk_download(apk_name, request_url.as_str(), &final_url)
            .await
        {
            if empty_download_verification(&verification) {
                return Err("酷安下载校验未通过，已拒绝保存安装包".to_string());
            }
        }
    }
    let total = if append {
        response
            .content_length()
            .map(|length| length.saturating_add(existing_length))
            .unwrap_or(0)
    } else {
        response.content_length().unwrap_or(0)
    };
    if total > APK_DOWNLOAD_MAX_BYTES {
        return Err("安装包体积超过 8GB，已拒绝下载".to_string());
    }
    let mut file = if append {
        tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&partial)
            .await
            .map_err(|error| format!("打开断点文件失败：{error}"))?
    } else {
        tokio::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&partial)
            .await
            .map_err(|error| format!("创建临时文件失败：{error}"))?
    };
    let mut downloaded = initial_downloaded;
    let started_at = Instant::now();
    loop {
        match download_control(control) {
            DownloadControl::Pause => {
                drop(file);
                let _ = app.emit(
                    "apk-download-progress",
                    download_event_payload(task_id, "paused", downloaded, total, 0, &target, &partial, None),
                );
                return Ok(json!({ "status": "paused", "downloaded": downloaded, "total": total, "path": target, "partialPath": partial }));
            }
            DownloadControl::Cancel => {
                drop(file);
                let _ = tokio::fs::remove_file(&partial).await;
                let _ = app.emit(
                    "apk-download-progress",
                    download_event_payload(task_id, "canceled", 0, total, 0, &target, &partial, None),
                );
                return Ok(json!({ "status": "canceled", "downloaded": 0, "total": total, "path": target, "partialPath": partial }));
            }
            DownloadControl::Run => {}
        }
        let chunk = tokio::select! {
            result = response.chunk() => result.map_err(|error| format!("读取下载数据失败：{error}"))?,
            changed = control.changed() => {
                changed.map_err(|_| "下载任务控制器已关闭".to_string())?;
                continue;
            }
        };
        let Some(chunk) = chunk else { break };
        if chunk.is_empty() {
            continue;
        }
        downloaded = downloaded.saturating_add(chunk.len() as u64);
        if downloaded > APK_DOWNLOAD_MAX_BYTES {
            drop(file);
            return Err("安装包体积超过 8GB，已中止下载".to_string());
        }
        file.write_all(&chunk)
            .await
            .map_err(|error| format!("写入临时文件失败：{error}"))?;
        let speed = downloaded / started_at.elapsed().as_secs().max(1);
        let _ = app.emit(
            "apk-download-progress",
            download_event_payload(task_id, "downloading", downloaded, total, speed, &target, &partial, None),
        );
    }
    file.flush().await.map_err(|error| format!("刷新临时文件失败：{error}"))?;
    file.sync_all().await.map_err(|error| format!("同步临时文件失败：{error}"))?;
    drop(file);
    if total > 0 && downloaded != total {
        return Err(format!("下载中断：已下载 {downloaded}/{total} 字节"));
    }
    tokio::fs::rename(&partial, &target)
        .await
        .map_err(|error| format!("保存安装包失败：{error}"))?;
    let speed = downloaded / started_at.elapsed().as_secs().max(1);
    let _ = app.emit(
        "apk-download-progress",
        download_event_payload(task_id, "completed", downloaded, total, speed, &target, &partial, None),
    );
    Ok(json!({ "status": "completed", "downloaded": downloaded, "total": total, "path": target, "partialPath": partial }))
}

#[tauri::command]
pub async fn start_apk_download(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    task_id: String,
    package_name: String,
    apk_name: String,
    apk_id: Option<String>,
    version_code: Option<String>,
    file_name: String,
    dir: Option<String>,
    target_path: Option<String>,
    extra_analysis_data: Option<String>,
    proxy_url: Option<String>,
) -> Result<Value, String> {
    if task_id.trim().is_empty() || package_name.trim().is_empty() {
        return Err("下载任务参数不完整".to_string());
    }
    let mut control = state.downloads.register(&task_id)?;
    let result = run_apk_download(
        &app,
        &state.client,
        &mut control,
        &task_id,
        &package_name,
        if apk_name.trim().is_empty() { &package_name } else { &apk_name },
        apk_id.as_deref(),
        version_code.as_deref(),
        &file_name,
        dir.as_deref(),
        target_path.as_deref(),
        extra_analysis_data.as_deref(),
        proxy_url.as_deref(),
    )
    .await;
    state.downloads.finish(&task_id);
    if let Err(error) = &result {
        let _ = app.emit(
            "apk-download-progress",
            json!({ "taskId": task_id, "status": "failed", "error": error }),
        );
    }
    result
}

#[tauri::command]
pub fn pause_apk_download(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    state.downloads.request(&task_id, DownloadControl::Pause)
}

#[tauri::command]
pub fn cancel_apk_download(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    state.downloads.request(&task_id, DownloadControl::Cancel)
}

fn validate_download_path_for_file_operation(raw_path: &str) -> Result<PathBuf, String> {
    let path = validate_custom_dir(raw_path.trim(), "下载文件路径")?;
    let name = path.file_name().and_then(|value| value.to_str()).unwrap_or_default();
    let lower_name = name.to_ascii_lowercase();
    let is_partial = lower_name.ends_with(".part");
    let base_name = if is_partial { &lower_name[..lower_name.len() - 5] } else { &lower_name };
    if name.is_empty()
        || name.contains("..")
        || is_windows_reserved_file_name(base_name)
        || ![".apk", ".xapk", ".apks"].iter().any(|suffix| base_name.ends_with(suffix))
    {
        return Err("下载文件路径不合法".to_string());
    }
    Ok(path)
}

#[tauri::command]
pub async fn delete_apk_download_file(
    app: tauri::AppHandle,
    target_path: Option<String>,
    partial_path: Option<String>,
    dir: Option<String>,
) -> Result<(), String> {
    let target_dir = user_save_dir(&app, dir.as_deref())?;
    for raw_path in [target_path, partial_path]
        .into_iter()
        .flatten()
        .filter(|path| !path.trim().is_empty())
    {
        let path = validate_download_path_for_file_operation(&raw_path)?;
        if !path_is_direct_child_of(&path, &target_dir)? {
            return Err("下载文件必须位于当前下载目录中".to_string());
        }
        reject_download_symlink(&path)?;
        if path.is_file() {
            tokio::fs::remove_file(&path)
                .await
                .map_err(|error| format!("删除下载文件失败：{error}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_apk_download_directory(
    app: tauri::AppHandle,
    dir: Option<String>,
) -> Result<(), String> {
    let target_dir = user_save_dir(&app, dir.as_deref())?;
    std::fs::create_dir_all(&target_dir).map_err(|error| format!("创建下载目录失败：{error}"))?;
    opener::open(&target_dir).map_err(|error| format!("打开下载位置失败：{error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn get_apk_qr(state: State<'_, AppState>, package_name: String) -> Result<Value, String> {
    state.client.get_apk_qr(&package_name).await
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
pub async fn like_reply(state: State<'_, AppState>, reply_id: String) -> Result<Value, String> {
    state.client.like_reply(&reply_id).await
}

#[tauri::command]
pub async fn unlike_reply(state: State<'_, AppState>, reply_id: String) -> Result<Value, String> {
    state.client.unlike_reply(&reply_id).await
}

#[tauri::command]
pub async fn reply_feed(
    state: State<'_, AppState>,
    feed_id: String,
    message: String,
    rid: Option<String>,
    pic: Option<String>,
    post_token: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .reply_feed(
            &feed_id,
            &message,
            rid.as_deref(),
            pic.as_deref(),
            post_token.as_deref(),
        )
        .await
}

#[tauri::command]
pub async fn comment_apk(
    state: State<'_, AppState>,
    app_id: String,
    message: String,
) -> Result<Value, String> {
    state.client.comment_apk(&app_id, &message).await
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
pub async fn special_follow_user(
    state: State<'_, AppState>,
    uid: String,
    special: bool,
) -> Result<Value, String> {
    state.client.special_follow_user(&uid, special).await
}

#[tauri::command]
pub async fn cancel_follower(state: State<'_, AppState>, uid: String) -> Result<Value, String> {
    state.client.cancel_follower(&uid).await
}

#[tauri::command]
pub async fn update_user_remark(
    state: State<'_, AppState>,
    uid: String,
    name: String,
) -> Result<Value, String> {
    state.client.update_user_remark(&uid, &name).await
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
    post_token: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .create_feed(&message, pic.as_deref(), post_token.as_deref())
        .await
}

#[tauri::command]
pub async fn create_answer(
    state: State<'_, AppState>,
    question_id: String,
    message: String,
    pic: Option<String>,
    post_token: Option<String>,
) -> Result<Value, String> {
    state
        .client
        .create_answer(
            &question_id,
            &message,
            pic.as_deref(),
            post_token.as_deref(),
        )
        .await
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
    log::info!("login.cookie_received");
    state.client.set_user_cookie(cookie_str)?;
    // 保存和验证分开：回调页必须先确认服务端返回真实账号，再关登录窗口。
    log::info!("login.cookie_staged");
    Ok("登录 Cookie 已载入，正在验证会话".to_string())
}

#[tauri::command]
pub async fn check_login_status(state: State<'_, AppState>) -> Result<Value, String> {
    log::info!("login.status_check");
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

fn validate_custom_dir(value: &str, label: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err(format!("{label}必须是当前平台的绝对路径：{value}"));
    }
    Ok(path)
}

fn user_save_dir(app: &tauri::AppHandle, custom_dir: Option<&str>) -> Result<PathBuf, String> {
    if let Some(custom_dir) = custom_dir.map(str::trim).filter(|value| !value.is_empty()) {
        return validate_custom_dir(custom_dir, "自定义下载目录");
    }
    app.path()
        .download_dir()
        .map_err(|_| "无法获取系统下载目录，请在设置中选择下载目录".to_string())
}

/// 返回当前平台实际使用的下载目录，便于设置页展示真实路径。
#[tauri::command]
pub fn get_download_directory(app: tauri::AppHandle, dir: Option<String>) -> Result<String, String> {
    Ok(user_save_dir(&app, dir.as_deref())?.to_string_lossy().to_string())
}

/// 下载并保存图片原始数据，目录为空时使用系统下载目录。
#[tauri::command]
pub async fn save_image(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    url: String,
    dir: Option<String>,
) -> Result<String, String> {
    let (file_name, bytes) = if url.starts_with("data:image/") {
        let (mime_type, bytes) = decode_image_data_url(&url)?;
        let file_name = build_generated_image_file_name("coolapk_image", mime_type);
        (file_name, bytes)
    } else {
        let data_url = state.client.get_image_data_url(&url).await?;
        let (mime_type, bytes) = decode_image_data_url(&data_url)?;
        let file_name = build_image_file_name(&url, mime_type);
        (file_name, bytes)
    };
    let target_dir = user_save_dir(&app, dir.as_deref())?;

    tokio::fs::create_dir_all(&target_dir)
        .await
        .map_err(|error| format!("创建图片保存目录失败：{error}"))?;
    let target_path = save_image_bytes(&target_dir, &file_name, &bytes).await?;

    Ok(target_path.to_string_lossy().to_string())
}

/// 保存前端生成的 Base64 分享图，目录为空时使用系统下载目录。
#[tauri::command]
pub async fn save_image_data_url(
    app: tauri::AppHandle,
    data_url: String,
    file_name: String,
    dir: Option<String>,
) -> Result<String, String> {
    if data_url.len() > 64 * 1024 * 1024 {
        return Err("分享图数据过大（超过 64MB）".to_string());
    }
    let (mime_type, bytes) = decode_image_data_url(&data_url)?;
    if bytes.len() > 48 * 1024 * 1024 {
        return Err("分享图文件过大（超过 48MB）".to_string());
    }
    let file_name = build_generated_image_file_name(&file_name, mime_type);
    let target_dir = user_save_dir(&app, dir.as_deref())?;
    tokio::fs::create_dir_all(&target_dir)
        .await
        .map_err(|error| format!("创建分享图保存目录失败：{error}"))?;
    let target_path = save_image_bytes(&target_dir, &file_name, &bytes).await?;
    Ok(target_path.to_string_lossy().to_string())
}

/// 下载图片到应用缓存后交给系统默认图片查看器，避免把 HTTPS 地址交给浏览器。
#[tauri::command]
pub async fn open_image_in_system_viewer(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    url: String,
    cache_dir: Option<String>,
) -> Result<String, String> {
    let (file_name, bytes) = if url.starts_with("data:image/") {
        let (mime_type, bytes) = decode_image_data_url(&url)?;
        let mut hasher = Md5::new();
        hasher.update(url.as_bytes());
        let file_name = format!(
            "system-{}.{}",
            hex::encode(hasher.finalize()),
            image_extension(mime_type)
        );
        (file_name, bytes)
    } else {
        let data_url = state.client.get_image_data_url(&url).await?;
        let (mime_type, bytes) = decode_image_data_url(&data_url)?;
        let mut hasher = Md5::new();
        hasher.update(url.as_bytes());
        let file_name = format!(
            "system-{}.{}",
            hex::encode(hasher.finalize()),
            image_extension(mime_type)
        );
        (file_name, bytes)
    };
    let target_dir = image_cache_root(&app, cache_dir.as_deref())?;
    tokio::fs::create_dir_all(&target_dir)
        .await
        .map_err(|error| format!("创建图片缓存目录失败：{error}"))?;
    let preferred_path = target_dir.join(&file_name);
    let target_path = if preferred_path.is_file() {
        preferred_path
    } else {
        save_image_bytes(&target_dir, &file_name, &bytes).await?
    };
    opener::open(&target_path).map_err(|error| format!("打开系统图片查看器失败：{error}"))?;
    Ok(target_path.to_string_lossy().to_string())
}

async fn save_image_bytes(
    target_dir: &std::path::Path,
    file_name: &str,
    bytes: &[u8],
) -> Result<PathBuf, String> {
    use tokio::io::AsyncWriteExt;

    let sequence = IMAGE_TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let nonce = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp_path = target_dir.join(format!(
        ".{file_name}.{}-{nonce}-{sequence}.part",
        std::process::id()
    ));
    let mut temp_file = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .await
        .map_err(|error| format!("创建图片临时文件失败：{error}"))?;
    if let Err(error) = async {
        temp_file.write_all(bytes).await?;
        temp_file.flush().await?;
        temp_file.sync_all().await
    }
    .await
    {
        drop(temp_file);
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err(format!("写入图片临时文件失败：{error}"));
    }
    drop(temp_file);

    let result = {
        let _lock = IMAGE_SAVE_LOCK
            .lock()
            .map_err(|_| "图片保存锁已损坏".to_string())?;
        let target_path = next_available_file_path(target_dir, file_name);
        std::fs::rename(&temp_path, &target_path)
            .map(|_| target_path)
            .map_err(|error| format!("保存图片失败：{error}"))
    };
    if result.is_err() {
        let _ = tokio::fs::remove_file(&temp_path).await;
    }
    result
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

fn build_generated_image_file_name(file_name: &str, mime_type: &str) -> String {
    let requested_stem = std::path::Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let safe_stem: String = requested_stem
        .chars()
        .take(100)
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
        .collect();
    let final_stem = if safe_stem.is_empty() {
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("coolapk_share_{timestamp}")
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

/// 为包含 HTML 与图片资源的导出包创建独立目录。
#[tauri::command]
pub fn create_export_directory(
    app: tauri::AppHandle,
    directory_name: String,
    dir: Option<String>,
) -> Result<String, String> {
    let safe_name: String = directory_name
        .chars()
        .take(100)
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
        .collect();
    if safe_name.is_empty() || safe_name == "." || safe_name == ".." {
        return Err("导出目录名不合法".to_string());
    }

    let parent = user_save_dir(&app, dir.as_deref())?;
    std::fs::create_dir_all(&parent).map_err(|e| format!("创建导出目录失败：{e}"))?;
    let mut target = parent.join(&safe_name);
    if target.exists() {
        for index in 2..=9999 {
            let candidate = parent.join(format!("{safe_name}_{index}"));
            if !candidate.exists() {
                target = candidate;
                break;
            }
        }
    }
    std::fs::create_dir(&target).map_err(|e| format!("创建导出目录失败：{e}"))?;
    Ok(target.to_string_lossy().to_string())
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
    let browser = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::External(parsed))
        .title(title)
        .user_agent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1")
        .inner_size(1100.0, 780.0);
    #[cfg(desktop)]
    let browser = browser.center();
    #[cfg(desktop)]
    let browser = browser.decorations(true);
    browser
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn close_login_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;
    use tauri::Manager;
    let close_result = if let Some(win) = app.get_webview_window("login_window") {
        #[cfg(target_os = "android")]
        {
            // Android 登录页是独立 Activity。Window::close 只移除 Rust 窗口句柄，
            // 不能保证结束前台 Activity；明确调用 finish() 才会返回主界面。
            win.with_webview(|webview| {
                webview.jni_handle().exec(|env, activity, _| {
                    if env.call_method(activity, "finish", "()V", &[]).is_err() {
                        log::warn!("login.activity_finish_failed");
                    }
                });
            })
            .map_err(|error| error.to_string())
        }
        #[cfg(not(target_os = "android"))]
        {
            win.close().map_err(|error| error.to_string())
        }
    } else {
        Ok(())
    };
    // 即使关窗请求失败，也通知主窗口检查已保存的登录态。
    log::info!("login.window_closed close_ok={}", close_result.is_ok());
    let _ = app.emit("login-window-closed", ());
    close_result
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
fn extract_callback_param(url: &str, key: &str) -> Option<String> {
    let queries = [
        url.split_once('?')
            .map(|(_, value)| value.split('#').next().unwrap_or(value)),
        url.split_once('#')
            .and_then(|(_, value)| value.split_once('?').map(|(_, query)| query)),
    ];
    for query in queries.into_iter().flatten() {
        for pair in query.split('&') {
            let mut parts = pair.splitn(2, '=');
            let name = percent_decode(parts.next().unwrap_or_default());
            if name == key {
                return Some(percent_decode(parts.next().unwrap_or_default()));
            }
        }
    }
    None
}

/// 从回跳 URL 中提取完整 Cookie 字符串。
fn extract_ck_from_url(url: &str) -> Option<String> {
    extract_callback_param(url, "ck")
}

/// 合并回调参数和 WebView2 Cookie 存储中的 Cookie，后者覆盖同名旧值。
fn merge_cookie_headers(first: Option<&str>, second: Option<&str>) -> Option<String> {
    let mut pairs: Vec<(String, String)> = Vec::new();
    for source in [first.unwrap_or_default(), second.unwrap_or_default()] {
        for item in source.split(';') {
            let mut parts = item.trim().splitn(2, '=');
            let name = parts.next().unwrap_or_default().trim();
            let value = parts.next().unwrap_or_default().trim();
            if name.is_empty() {
                continue;
            }
            if let Some(existing) = pairs.iter_mut().find(|(key, _)| key == name) {
                existing.1 = value.to_string();
            } else {
                pairs.push((name.to_string(), value.to_string()));
            }
        }
    }
    if pairs.is_empty() {
        None
    } else {
        Some(pairs.into_iter().map(|(name, value)| format!("{name}={value}")).collect::<Vec<_>>().join("; "))
    }
}

/// 从登录 WebView 的 Cookie 存储读取酷安会话，包含 HttpOnly Cookie。
async fn get_login_webview_cookie<R: tauri::Runtime>(win: &tauri::WebviewWindow<R>) -> Result<String, String> {
    // Android 的 WebView::cookies() 返回空列表；从登录 Activity 的 CookieManager 读取。
    // 不使用 Wry RustWebView.getCookies：旧 APK 中该方法缺失时会导致 Java 进程崩溃。
    #[cfg(target_os = "android")]
    {
        let mut combined: Option<String> = None;
        for address in [
            "https://account.coolapk.com/",
            "https://www.coolapk.com/",
            "https://m.coolapk.com/",
            "https://api.coolapk.com/",
        ] {
            let (sender, receiver) = tokio::sync::oneshot::channel();
            let address = address.to_string();
            win.with_webview(move |webview| {
                webview.jni_handle().exec(move |env, activity, _| {
                    let result: jni::errors::Result<String> = (|| {
                        let address = env.new_string(address)?;
                        let value = env.call_method(
                            activity,
                            "getCoolapkCookies",
                            "(Ljava/lang/String;)Ljava/lang/String;",
                            &[(&address).into()],
                        )?.l()?;
                        let value = jni::objects::JString::from(value);
                        Ok(env.get_string(&value)?.into())
                    })();
                    if result.is_err() && env.exception_check().unwrap_or(false) {
                        let _ = env.exception_clear();
                    }
                    let _ = sender.send(result.map_err(|error| error.to_string()));
                });
            }).map_err(|error| error.to_string())?;
            let header = tokio::time::timeout(std::time::Duration::from_secs(5), receiver)
                .await
                .map_err(|_| "读取 Android 登录 Cookie 超时".to_string())?
                .map_err(|_| "Android 登录窗口已关闭".to_string())??;
            // account 域优先；其他子域只补充它没有的 Cookie。
            combined = merge_cookie_headers(Some(&header), combined.as_deref());
        }
        return Ok(combined.unwrap_or_default());
    }

    #[cfg(not(target_os = "android"))]
    {
        let cookies = win.cookies().map_err(|e| e.to_string())?;
        Ok(cookies
            .into_iter()
            .filter(|cookie| {
                let domain = cookie.domain().unwrap_or_default().trim_start_matches('.');
                domain == "coolapk.com" || domain.ends_with(".coolapk.com")
            })
            .map(|cookie| format!("{}={}", cookie.name(), cookie.value()))
            .collect::<Vec<_>>()
            .join("; "))
    }
}

/// APK 只在 ac=access_token 时把 code 交给 /account/accessToken。
fn extract_access_code_from_url(url: &str) -> Option<String> {
    if extract_callback_param(url, "ac").as_deref() != Some("access_token") {
        return None;
    }
    extract_callback_param(url, "code").filter(|code| !code.trim().is_empty())
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
        if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
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
    let callback_url = format!("{}/#/auth_callback", app_origin);
    let target_login = reqwest::Url::parse_with_params(
        "https://account.coolapk.com/auth/login",
        &[("type", "coolapk"), ("forward", callback_url.as_str())],
    )
    .map_err(|e| e.to_string())?
    .to_string();
    // 先发起 logout 清理网页底层 Cookie 旧会话，防止服务端自动 302 静默跳回旧账号，强制弹出全新登录框
    let login_url = reqwest::Url::parse_with_params(
        "https://account.coolapk.com/auth/logout",
        &[("forward", target_login)],
    )
    .map_err(|e| e.to_string())?;

    log::info!("login.webview_opened");

    // 登录完成后由 Rust monitor 读取 WebView2 Cookie 存储，避免 document.cookie 丢失 HttpOnly 和跨域 Cookie。
    let js_script = r#"
        (function() {
            var APP_ORIGIN = "__APP_ORIGIN__";

            function isLogoutPage() {
                var href = window.location.href || "";
                return href.indexOf('auth/logout') !== -1;
            }

            function clearCoolapkCookies() {
                var expires = "Thu, 01 Jan 1970 00:00:00 GMT";
                var names = (document.cookie || "").split(';');
                for (var i = 0; i < names.length; i++) {
                    var name = (names[i].split('=')[0] || "").trim();
                    if (!name) continue;
                    document.cookie = name + "=; expires=" + expires + "; path=/; domain=.coolapk.com";
                    document.cookie = name + "=; expires=" + expires + "; path=/";
                }
            }

            function checkLogoutPage() {
                var text = (document.body && document.body.innerText) || "";
                // 必须等待退出页面真正加载完成，不能只看到 auth/logout URL 就跳转，
                // 否则会取消服务端清理 Cookie 的请求，旧账号会被登录页再次自动识别。
                if (text.indexOf('已经退出登录') !== -1) {
                    clearCoolapkCookies();
                    window.location.replace("https://account.coolapk.com/auth/login?type=coolapk&forward=" + encodeURIComponent(APP_ORIGIN + "/#/auth_callback"));
                    return true;
                }
                return isLogoutPage();
            }

            if (checkLogoutPage() && !isLogoutPage()) return;

            document.addEventListener('DOMContentLoaded', function() {
                checkLogoutPage();
            });
        })();
    "#
    .replace("__APP_ORIGIN__", &app_origin);

    let login_window = tauri::WebviewWindowBuilder::new(
        &app,
        "login_window",
        tauri::WebviewUrl::External(login_url),
    )
    .title("酷安官方授权登录")
    .user_agent(LOGIN_WEBVIEW_USER_AGENT)
    .inner_size(440.0, 620.0);
    #[cfg(target_os = "android")]
    let login_window = login_window.activity_name("LoginActivity");
    #[cfg(desktop)]
    let login_window = login_window.center();
    let _window = login_window
    .initialization_script(js_script)
    .build()
    .map_err(|e| e.to_string())?;

    // 在 Rust 侧使用原生 Task 监控 Webview URL 重定向状态
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut last_monitor_url: Option<String> = None;
        let mut processed_callback_url: Option<String> = None;
        let mut attempted_landing_cookie: Option<String> = None;
        let mut last_landing_attempt: Option<std::time::Instant> = None;
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;
            if let Some(win) = app_handle.get_webview_window("login_window") {
                if let Ok(url) = win.url() {
                    let url_str = url.as_str();
                    let app_origin = get_app_origin(&app_handle);

                    if last_monitor_url.as_deref() != Some(url_str) {
                        log::info!("login.navigation_changed");
                        last_monitor_url = Some(url_str.to_string());
                    }

                    let is_account_callback = url.scheme() == "https"
                        && url.host_str() == Some("account.coolapk.com")
                        && url.path() == "/auth/callback";
                    let is_app_callback = url_str.starts_with(&format!("{}/", app_origin))
                        && url.fragment().is_some_and(|fragment| {
                            fragment.split('?').next() == Some("/auth_callback")
                        });
                    // 官方回调和本地回调都在 Rust 侧处理，避免回调页重复保存 Cookie 或覆盖完整会话。
                    if (is_account_callback || is_app_callback) && processed_callback_url.as_deref() != Some(url_str) {
                        let callback_code = extract_access_code_from_url(url_str);
                        let callback_cookie = extract_ck_from_url(url_str);
                        let webview_cookie = get_login_webview_cookie(&win).await.ok();
                        let effective_cookie = merge_cookie_headers(callback_cookie.as_deref(), webview_cookie.as_deref());
                        log::info!(
                            "login.callback kind={} has_access_code={} has_cookie={} cookie_has_session={}",
                            if is_account_callback { "official" } else { "app-origin" },
                            callback_code.is_some(),
                            effective_cookie.as_ref().map(|value| !value.trim().is_empty()).unwrap_or(false),
                            effective_cookie.as_ref().map(|value| CoolapkClient::has_valid_session_cookie(value)).unwrap_or(false)
                        );
                        let state = app_handle.state::<AppState>();
                        let mut valid = false;
                        if let Some(code) = callback_code {
                            match state.client.login_by_access_code(&code, effective_cookie.as_deref()).await {
                                Ok(_result) => {
                                    valid = true;
                                    log::info!("login.access_code_succeeded");
                                }
                                Err(_) => log::warn!("login.access_code_failed"),
                            }
                        } else if let Some(cookie) = effective_cookie {
                            match state.client.login_by_webview_cookie(&cookie).await {
                                Ok(_result) => {
                                    valid = true;
                                    log::info!("login.webview_cookie_succeeded");
                                }
                                Err(_) => log::warn!("login.webview_cookie_failed"),
                            }
                        }
                        processed_callback_url = Some(url_str.to_string());
                        if valid {
                            if close_login_window(app_handle.clone()).is_err() {
                                log::warn!("login.window_close_failed");
                            }
                            break;
                        }
                    }

                    // 登录落地页：读取 account.coolapk.com 的 Cookie 存储，而不是读取 www 域的 document.cookie。
                    if url.scheme() == "https"
                        && matches!(url.host_str(), Some("www.coolapk.com" | "m.coolapk.com" | "coolapk.com"))
                    {
                        if let Ok(cookie) = get_login_webview_cookie(&win).await {
                            let should_retry = last_landing_attempt
                                .is_none_or(|at| at.elapsed() >= std::time::Duration::from_secs(2));
                            if CoolapkClient::has_valid_session_cookie(&cookie)
                                && (attempted_landing_cookie.as_deref() != Some(cookie.as_str()) || should_retry)
                            {
                                attempted_landing_cookie = Some(cookie.clone());
                                last_landing_attempt = Some(std::time::Instant::now());
                                log::info!("login.landing_cookie_detected");
                                let state = app_handle.state::<AppState>();
                                match state.client.login_by_webview_cookie(&cookie).await {
                                    Ok(_result) => {
                                        log::info!("login.landing_cookie_succeeded");
                                        if close_login_window(app_handle.clone()).is_err() {
                                            log::warn!("login.window_close_failed");
                                        }
                                        break;
                                    }
                                    Err(_) => log::warn!("login.landing_cookie_not_ready"),
                                }
                            }
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

#[cfg(test)]
mod login_callback_tests {
    use super::{extract_access_code_from_url, extract_callback_param, extract_ck_from_url, LOGIN_WEBVIEW_USER_AGENT};

    #[test]
    fn login_webview_ua_keeps_desktop_mouse_events() {
        assert!(LOGIN_WEBVIEW_USER_AGENT.contains("Windows NT"));
        assert!(!LOGIN_WEBVIEW_USER_AGENT.contains("Mobile"));
    }

    #[test]
    fn extracts_access_code_and_cookie_from_hash_callback() {
        let url = "http://127.0.0.1:17520/#/auth_callback?ac=access_token&code=one%2Btime&ck=SESSID%3Dsession%3B%20uid%3D0";
        assert_eq!(extract_callback_param(url, "ac").as_deref(), Some("access_token"));
        assert_eq!(extract_access_code_from_url(url).as_deref(), Some("one+time"));
        assert_eq!(
            extract_ck_from_url(url).as_deref(),
            Some("SESSID=session; uid=0")
        );
    }

    #[test]
    fn extracts_access_code_from_account_query_callback() {
        let url = "https://account.coolapk.com/auth/callback?ac=access_token&code=server-code";
        assert_eq!(extract_access_code_from_url(url).as_deref(), Some("server-code"));
    }

    #[test]
    fn rejects_non_access_token_callback() {
        let url = "https://account.coolapk.com/auth/callback?ac=login&code=server-code";
        assert_eq!(extract_access_code_from_url(url), None);
    }
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

    let dir = update_cache_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // 文件名净化：只保留安全字符，防路径穿越，并按平台限制扩展名。
    let raw_name = url.rsplit('/').next().unwrap_or("").trim();
    let safe_name: String = raw_name
        .chars()
        .take(128)
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .collect();
    if safe_name.is_empty() || !is_update_package_extension(Path::new(&safe_name)) {
        return Err("更新包文件名不合法".to_string());
    }
    // 每次下载使用独立文件名，避免旧任务或另一个应用实例仍持有同名安装包时互相锁定。
    let extension = safe_name.rsplit('.').next().unwrap_or_default().to_ascii_lowercase();
    let stem = safe_name
        .get(..safe_name.len().saturating_sub(extension.len() + 1))
        .filter(|value| !value.is_empty())
        .unwrap_or("coolapk-desktop-update");
    let nonce = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let unique_name = format!("{stem}-{}-{nonce}.{extension}", std::process::id());
    let path = dir.join(unique_name);
    let partial_path = path.with_extension(format!("{extension}.part"));

    let mut builder = reqwest::Client::builder()
        .user_agent("coolapk-desktop-updater")
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let host = attempt.url().host_str().unwrap_or_default().to_ascii_lowercase();
            if attempt.previous().len() >= 10
                || attempt.url().scheme() != "https"
                || !UPDATE_ALLOWED_HOSTS.contains(&host.as_str())
            {
                attempt.error("更新包跳转到了不可信地址")
            } else {
                attempt.follow()
            }
        }));
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
    let mut file = tokio::fs::File::create(&partial_path)
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
            drop(file);
            let _ = tokio::fs::remove_file(&partial_path).await;
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
    file.sync_all().await.map_err(|e| e.to_string())?;
    // Windows 下启动安装程序前必须释放下载文件句柄，否则 CreateProcess 可能返回 os error 32。
    drop(file);
    // 服务端声明了文件大小时校验完整性，避免保存半成品安装包
    if total > 0 && downloaded != total {
        let _ = tokio::fs::remove_file(&partial_path).await;
        return Err(format!("下载中断：已下载 {downloaded}/{total} 字节"));
    }
    tokio::fs::rename(&partial_path, &path)
        .await
        .map_err(|e| format!("保存更新包失败：{e}"))?;
    #[cfg(target_os = "android")]
    {
        let published = call_android_update_method(
            &app,
            "publishUpdateApk",
            path.to_string_lossy().to_string(),
        ).await?;
        if published.starts_with("error:") {
            return Err(published.trim_start_matches("error:").to_string());
        }
        if published != "private_fallback" {
            if !published.starts_with("content://") {
                return Err(format!("Android 下载目录返回未知结果：{published}"));
            }
            let _ = tokio::fs::remove_file(&path).await;
            return Ok(published);
        }
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
    // 文件名净化：只保留安全字符，拒绝 .. 路径穿越与空名，并限制长度与内容体积
    let safe_name: String = file_name
        .chars()
        .take(100)
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .collect();
    if safe_name.is_empty() || safe_name == "." || safe_name == ".." || safe_name.contains("..") {
        return Err("导出文件名不合法".to_string());
    }
    // 保留较高上限以兼容大型 JSON/TXT/HTML 文本导出；HTML 图片资源单独保存。
    if content.len() > 256 * 1024 * 1024 {
        return Err("导出内容过大（超过 256MB）".to_string());
    }

    let dir = user_save_dir(&app, dir.as_deref())?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建导出目录失败：{e}"))?;
    let path = next_available_file_path(&dir, &safe_name);
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
        .map(|value| validate_custom_dir(value, "自定义缓存目录"))
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
) -> Result<(PathBuf, PathBuf), String> {
    let image = image_cache_root(app, custom_dir)?;
    let update = update_cache_dir(app)?;
    Ok((image, update))
}

fn update_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        // Tauri 的 Android app_data_dir 是应用数据根目录；files 子目录可由 FileProvider 安全共享。
        Ok(app.path().app_data_dir().map_err(|e| e.to_string())?
            .join("files")
            .join("coolapk-desktop-update"))
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(std::env::temp_dir().join("coolapk-desktop-update"))
    }
}

fn is_update_package_extension(path: &std::path::Path) -> bool {
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or_default();
    #[cfg(target_os = "android")]
    { extension.eq_ignore_ascii_case("apk") }
    #[cfg(not(target_os = "android"))]
    { extension.eq_ignore_ascii_case("exe") || extension.eq_ignore_ascii_case("msi") }
}

/// 启动时校验待安装包是否仍存在且位于应用更新目录内。
#[tauri::command]
pub async fn is_update_package_available(app: tauri::AppHandle, installer_path: String) -> Result<bool, String> {
    #[cfg(target_os = "android")]
    if installer_path.starts_with("content://") {
        return Ok(call_android_update_method(&app, "isUpdatePackageAvailable", installer_path).await? == "available");
    }
    let expected_dir = update_cache_dir(&app)?;
    let expected_dir = match expected_dir.canonicalize() {
        Ok(path) => path,
        Err(_) => return Ok(false),
    };
    let canonical = match std::fs::canonicalize(installer_path) {
        Ok(path) => path,
        Err(_) => return Ok(false),
    };
    if !canonical.starts_with(&expected_dir) || !is_update_package_extension(&canonical) {
        return Ok(false);
    }
    let metadata = match std::fs::metadata(canonical) {
        Ok(metadata) => metadata,
        Err(_) => return Ok(false),
    };
    Ok(metadata.is_file() && metadata.len() > 0)
}

/// 清理没有被待安装记录引用的旧安装包和未完成下载文件。
/// 更新包不属于普通图片/WebView缓存，不能由 clear_app_cache 直接删除。
#[tauri::command]
pub fn cleanup_update_packages(app: tauri::AppHandle, keep_path: Option<String>) -> Result<(), String> {
    let update_dir = update_cache_dir(&app)?;
    if !update_dir.exists() {
        return Ok(());
    }
    let canonical_keep = keep_path.and_then(|path| {
        let canonical = std::fs::canonicalize(path).ok()?;
        let expected_dir = update_dir.canonicalize().ok()?;
        if canonical.starts_with(expected_dir) && is_update_package_extension(&canonical) {
            Some(canonical)
        } else {
            None
        }
    });
    for entry in std::fs::read_dir(&update_dir)
        .map_err(|error| format!("读取更新目录失败：{error}"))?
        .flatten()
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let is_download_artifact = is_update_package_extension(&path)
            || path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("part"));
        let canonical_path = path.canonicalize().unwrap_or_else(|_| path.clone());
        if is_download_artifact && canonical_keep.as_ref() != Some(&canonical_path) {
            let _ = std::fs::remove_file(path);
        }
    }
    Ok(())
}

/// 统计应用自己管理的图片缓存和更新包临时文件，并返回实际图片缓存目录。
#[tauri::command]
pub fn get_cache_info(
    app: tauri::AppHandle,
    cache_dir: Option<String>,
) -> Result<serde_json::Value, String> {
    let (image, update) = cache_locations(&app, cache_dir.as_deref())?;
    let _ = std::fs::create_dir_all(&image);
    let image_bytes = dir_total_size(&image);
    let update_bytes = dir_total_size(&update);
    Ok(serde_json::json!({
        "bytes": image_bytes + update_bytes,
        "imageBytes": image_bytes,
        "webviewBytes": 0,
        "updateBytes": update_bytes,
        "path": image.to_string_lossy(),
    }))
}

/// 只删除应用自己管理的图片缓存，不触碰 WebView profile 和更新包。
#[tauri::command]
pub fn clear_app_cache(
    app: tauri::AppHandle,
    cache_dir: Option<String>,
) -> Result<serde_json::Value, String> {
    let (image, _update) = cache_locations(&app, cache_dir.as_deref())?;
    let _ = std::fs::remove_dir_all(&image);
    let _ = std::fs::create_dir_all(&image);
    // 更新包由独立的待安装流程管理，清理普通缓存时必须保留，
    // 否则用户下载后暂不安装，重启或手动清理缓存就会丢失安装包。
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

/// 返回当前 Windows 发行方式。安装版目录带有 NSIS 的 uninstall.exe；否则视为单文件便携版。
#[tauri::command]
pub fn get_update_distribution() -> String {
    #[cfg(target_os = "windows")]
    {
        let is_installed = std::env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(|parent| parent.join("uninstall.exe")))
            .is_some_and(|path| path.is_file());
        if is_installed {
            "installer".to_string()
        } else {
            "portable".to_string()
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        "installer".to_string()
    }
}

/// Windows 启动 NSIS/便携版更新；Android 将 APK 交给系统安装器确认。
#[tauri::command]
pub async fn install_update(app: tauri::AppHandle, installer_path: String, portable: bool) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        install_update_windows(&app, installer_path, portable).map(|_| "started".to_string())
    }
    #[cfg(target_os = "android")]
    {
        if portable {
            return Err("Android 更新包必须是 APK".to_string());
        }
        install_update_android(app, installer_path).await
    }
    #[cfg(not(any(target_os = "windows", target_os = "android")))]
    {
        let _ = app;
        let _ = installer_path;
        let _ = portable;
        Err("当前平台暂不支持应用内自动安装，请前往发布页面手动下载安装".to_string())
    }
}

#[cfg(target_os = "android")]
async fn install_update_android(app: tauri::AppHandle, installer_path: String) -> Result<String, String> {
    let location = if installer_path.starts_with("content://") {
        installer_path
    } else {
        let canonical = std::fs::canonicalize(&installer_path)
            .map_err(|_| "更新安装包不存在，可能已被清理，请重新下载".to_string())?;
        let expected_dir = update_cache_dir(&app)?
            .canonicalize()
            .map_err(|_| "更新目录不存在，请重新下载 APK".to_string())?;
        if !canonical.starts_with(&expected_dir) || !is_update_package_extension(&canonical) {
            return Err("拒绝安装不在更新目录内的 APK".to_string());
        }
        canonical.to_string_lossy().to_string()
    };
    let status = call_android_update_method(&app, "launchUpdateInstaller", location).await?;
    match status.as_str() {
        "started" | "permission_required" => Ok(status),
        error if error.starts_with("error:") => Err(error.trim_start_matches("error:").to_string()),
        _ => Err(format!("Android 安装器返回未知结果：{status}")),
    }
}

#[cfg(target_os = "android")]
async fn call_android_update_method(
    app: &tauri::AppHandle,
    method: &'static str,
    argument: String,
) -> Result<String, String> {
    let window = app.get_webview_window("main")
        .ok_or_else(|| "Android 主窗口不可用".to_string())?;
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window.with_webview(move |webview| {
        webview.jni_handle().exec(move |env, activity, _| {
            let result: jni::errors::Result<String> = (|| {
                let argument = env.new_string(argument)?;
                let value = env.call_method(
                    activity,
                    method,
                    "(Ljava/lang/String;)Ljava/lang/String;",
                    &[(&argument).into()],
                )?.l()?;
                let value = jni::objects::JString::from(value);
                Ok(env.get_string(&value)?.into())
            })();
            if result.is_err() && env.exception_check().unwrap_or(false) {
                let _ = env.exception_clear();
            }
            let _ = sender.send(result.map_err(|error| error.to_string()));
        });
    }).map_err(|error| format!("调用 Android 安装器失败：{error}"))?;
    tokio::time::timeout(Duration::from_secs(120), receiver)
        .await
        .map_err(|_| "等待 Android 安装器响应超时".to_string())?
        .map_err(|_| "Android 安装器未返回结果".to_string())?
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn install_update_windows(app: &tauri::AppHandle, installer_path: String, portable: bool) -> Result<(), String> {
    // 只允许执行更新目录内的 .exe/.msi 安装包：
    // 路径必须真实存在于下载目录（canonicalize 解析 .. / 符号链接后再前缀校验），
    // 防止前端被注入时借助该命令执行任意文件。
    let canonical = std::fs::canonicalize(&installer_path)
        .map_err(|_| "更新安装包不存在，可能已被清理，请重新下载".to_string())?;
    let expected_dir = update_cache_dir(app)?;
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

    if portable {
        if ext != "exe" {
            return Err("便携版更新包必须是 EXE 文件".to_string());
        }
        let current_exe = std::env::current_exe()
            .and_then(std::fs::canonicalize)
            .map_err(|error| format!("无法定位当前程序：{error}"))?;
        let current_dir = current_exe
            .parent()
            .ok_or_else(|| "无法定位便携版所在目录".to_string())?;
        let write_probe = current_dir.join(format!(
            ".coolapk-update-write-test-{}",
            std::process::id()
        ));
        std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&write_probe)
            .map_err(|error| format!("便携版所在目录不可写，无法自动更新：{error}"))?;
        let _ = std::fs::remove_file(write_probe);
        std::process::Command::new(&canonical)
            .arg("--coolapk-apply-portable-update")
            .arg(std::process::id().to_string())
            .arg(current_exe)
            .spawn()
            .map_err(|error| format!("启动便携版更新助手失败：{error}"))?;
        return Ok(());
    }

    std::process::Command::new(&canonical)
        .args(["/S", "/UPDATE", "/R"])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 退出整个应用（用于更新前关闭窗口）
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    crate::persist_current_window_geometry(&app);
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
pub async fn get_user_album_list(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_user_album_list(&uid, page).await
}

#[tauri::command]
pub async fn create_album(
    state: State<'_, AppState>,
    title: String,
    intro: String,
    cover: String,
) -> Result<Value, String> {
    state.client.create_album(&title, &intro, &cover).await
}

#[tauri::command]
pub async fn edit_album(
    state: State<'_, AppState>,
    album_id: String,
    title: String,
    intro: String,
    cover: String,
) -> Result<Value, String> {
    state.client.edit_album(&album_id, &title, &intro, &cover).await
}

#[tauri::command]
pub async fn add_album_apk(
    state: State<'_, AppState>,
    album_id: String,
    package_name: String,
    title: String,
    url: String,
    note: String,
    display_order: i32,
    logo: String,
) -> Result<Value, String> {
    state
        .client
        .add_album_apk(&album_id, &package_name, &title, &url, &note, display_order, &logo)
        .await
}

#[tauri::command]
pub async fn delete_album_apk(
    state: State<'_, AppState>,
    album_id: String,
    package_name: String,
) -> Result<Value, String> {
    state.client.delete_album_apk(&album_id, &package_name).await
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
pub async fn get_apk_related_apps(
    state: State<'_, AppState>,
    package_name: String,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .get_apk_related_apps(&package_name, page)
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

// === 好物 / 购物生态 ===
#[tauri::command]
pub async fn get_goods_search_hot_words(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_goods_search_hot_words().await
}

#[tauri::command]
pub async fn search_goods(
    state: State<'_, AppState>,
    keyword: String,
    sort_name: String,
    sort: String,
    is_coupon: u32,
    page: u32,
) -> Result<Value, String> {
    state
        .client
        .search_goods(&keyword, &sort_name, &sort, is_coupon, page)
        .await
}

#[tauri::command]
pub async fn get_goods_detail(
    state: State<'_, AppState>,
    goods_id: String,
) -> Result<Value, String> {
    state.client.get_goods_detail(&goods_id).await
}

#[tauri::command]
pub async fn get_goods_list_types(state: State<'_, AppState>) -> Result<Value, String> {
    state.client.get_goods_list_types().await
}

#[tauri::command]
pub async fn get_goods_list(
    state: State<'_, AppState>,
    uid: String,
    goods_id: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_goods_list(&uid, &goods_id, page).await
}

#[tauri::command]
pub async fn get_goods_store_items(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_goods_store_items(&uid, page).await
}

#[tauri::command]
pub async fn get_product_albums(
    state: State<'_, AppState>,
    uid: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_product_albums(&uid, page).await
}

#[tauri::command]
pub async fn get_my_goods_feeds(
    state: State<'_, AppState>,
    uid: String,
    goods_type: String,
    page: u32,
) -> Result<Value, String> {
    state.client.get_my_goods_feeds(&uid, &goods_type, page).await
}

#[tauri::command]
pub async fn create_goods_list(
    state: State<'_, AppState>,
    title: String,
    message: String,
    cover: String,
    top_limit: u32,
    is_open_vote: u32,
    list_type: String,
    target_id: String,
    target_type: String,
) -> Result<Value, String> {
    state
        .client
        .create_goods_list(
            &title,
            &message,
            &cover,
            top_limit,
            is_open_vote,
            &list_type,
            &target_id,
            &target_type,
        )
        .await
}

#[tauri::command]
pub async fn edit_goods_list(
    state: State<'_, AppState>,
    id: String,
    title: String,
    message: String,
    cover: String,
    top_limit: u32,
    is_open_vote: u32,
    list_type: String,
) -> Result<Value, String> {
    state
        .client
        .edit_goods_list(&id, &title, &message, &cover, top_limit, is_open_vote, &list_type)
        .await
}

#[tauri::command]
pub async fn add_goods_to_goods_list(
    state: State<'_, AppState>,
    feed_id: String,
    goods_id: String,
    note: String,
    pic: String,
) -> Result<Value, String> {
    state
        .client
        .add_goods_to_goods_list(&feed_id, &goods_id, &note, &pic)
        .await
}

#[tauri::command]
pub async fn delete_goods_list_items(
    state: State<'_, AppState>,
    cancel_feed_id: String,
    goods_id: String,
) -> Result<Value, String> {
    state
        .client
        .delete_goods_list_items(&cancel_feed_id, &goods_id)
        .await
}

#[tauri::command]
pub async fn edit_goods_list_item(
    state: State<'_, AppState>,
    feed_id: String,
    goods_id: String,
    note: String,
    pic: String,
) -> Result<Value, String> {
    state
        .client
        .edit_goods_list_item(&feed_id, &goods_id, &note, &pic)
        .await
}

#[tauri::command]
pub async fn vote_goods_list_item(
    state: State<'_, AppState>,
    id: String,
    item_id: String,
    value: i32,
) -> Result<Value, String> {
    state.client.vote_goods_list_item(&id, &item_id, value).await
}

#[tauri::command]
pub async fn bind_feed_to_goods_list(
    state: State<'_, AppState>,
    feed_id: String,
    goods_list_id: String,
) -> Result<Value, String> {
    state
        .client
        .bind_feed_to_goods_list(&feed_id, &goods_list_id)
        .await
}

#[cfg(test)]
mod cache_tests {
    use super::{
        build_generated_image_file_name, build_image_file_name, decode_image_data_url, next_available_file_path, read_image_cache,
        save_image_bytes, validate_custom_dir, write_image_cache,
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

    #[test]
    fn generated_image_file_name_is_safe_and_uses_payload_format() {
        assert_eq!(
            build_generated_image_file_name("coolapk-feed-42.png", "image/jpeg"),
            "coolapk-feed-42.jpg"
        );
        assert_eq!(
            build_generated_image_file_name("../unsafe/name.png", "image/png"),
            "name.png"
        );
    }

    #[test]
    fn json_export_path_avoids_overwrite() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("coolapk-json-export-test-{unique}"));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("history.json"), b"existing").unwrap();

        assert_eq!(
            next_available_file_path(&root, "history.json"),
            root.join("history_2.json")
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn concurrent_image_saves_do_not_overwrite_each_other() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("coolapk-image-concurrent-{unique}"));
        std::fs::create_dir_all(&root).unwrap();

        let (first, second) = tokio::join!(
            save_image_bytes(&root, "same.png", b"first"),
            save_image_bytes(&root, "same.png", b"second")
        );
        let first = first.unwrap();
        let second = second.unwrap();
        assert_ne!(first, second);
        assert_eq!(std::fs::read(first).unwrap(), b"first");
        assert_eq!(std::fs::read(second).unwrap(), b"second");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_custom_directory_that_is_not_absolute_on_current_platform() {
        #[cfg(target_os = "windows")]
        let incompatible = "/home/user/Downloads";
        #[cfg(not(target_os = "windows"))]
        let incompatible = r"D:\Downloads";

        assert!(validate_custom_dir(incompatible, "自定义目录").is_err());
        assert!(validate_custom_dir("relative/downloads", "自定义目录").is_err());
    }
}

#[cfg(test)]
mod download_tests {
    use super::{
        build_coolapk_download_url, constrain_windows_download_file_name,
        empty_download_verification, partial_download_path, sanitize_apk_file_name,
        validate_download_path_for_file_operation,
    };
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn download_file_name_keeps_supported_extension_and_removes_path_separators() {
        assert_eq!(sanitize_apk_file_name("酷安/测试.apk").unwrap(), "酷安_测试.apk");
        assert_eq!(sanitize_apk_file_name("demo").unwrap(), "demo.apk");
        assert!(sanitize_apk_file_name("..").is_err());
        #[cfg(windows)]
        assert_eq!(sanitize_apk_file_name("CON.apk").unwrap(), "_CON.apk");
    }

    #[test]
    fn download_partial_path_keeps_platform_path_separators() {
        let target = std::env::temp_dir().join("coolapk").join("demo.apk");
        assert_eq!(partial_download_path(&target).unwrap(), target.with_file_name("demo.apk.part"));
    }

    #[test]
    fn long_download_file_name_is_shortened_only_for_windows() {
        let root = std::env::temp_dir().join("coolapk-download-path");
        let file_name = format!("{}.apk", "a".repeat(400));
        let result = constrain_windows_download_file_name(&root, file_name.clone()).unwrap();
        #[cfg(windows)]
        assert!(root.join(&result).to_string_lossy().encode_utf16().count() <= 240);
        #[cfg(not(windows))]
        assert_eq!(result, file_name);
    }

    #[test]
    fn official_download_url_uses_the_v6_download_endpoint_and_required_fields() {
        let url = build_coolapk_download_url("com.demo.app", "943417", "275").unwrap();
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.host_str(), Some("api.coolapk.com"));
        assert_eq!(url.path(), "/v6/apk/download");
        assert_eq!(url.query(), Some("pn=com.demo.app&aid=943417&vc=275&extra="));
    }

    #[test]
    fn app_detail_version_accepts_coolapk_apkversioncode_field() {
        let detail = json!({ "apkversioncode": 7245864 });
        assert_eq!(super::download_object_string(Some(&detail), &["versionCode", "versioncode", "version_code", "apkversioncode"]), Some("7245864".to_string()));
    }

    #[test]
    fn only_official_api_hosts_use_the_coolapk_post_download_protocol() {
        assert!(super::is_coolapk_download_host("api.coolapk.com"));
        assert!(super::is_coolapk_download_host("api-dev.coolapk.com"));
        assert!(!super::is_coolapk_download_host("download.coolapk.com"));
        assert!(!super::is_coolapk_download_host("cdn.coolapk.com"));
    }

    #[test]
    fn download_verification_only_rejects_an_explicit_empty_result() {
        assert!(empty_download_verification(&json!({ "data": "" })));
        assert!(!empty_download_verification(&json!({ "data": "verified" })));
        assert!(!empty_download_verification(&json!({ "data": { "ok": true } })));
    }

    #[test]
    fn download_file_operations_accept_apk_and_partial_paths() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("coolapk-download-path-test-{unique}"));
        std::fs::create_dir_all(&root).unwrap();
        let apk = root.join("demo.apk").to_string_lossy().to_string();
        let partial = root.join("demo.apk.part").to_string_lossy().to_string();
        let text = root.join("demo.txt").to_string_lossy().to_string();
        assert!(validate_download_path_for_file_operation(&apk).is_ok());
        assert!(validate_download_path_for_file_operation(&partial).is_ok());
        assert!(validate_download_path_for_file_operation(&text).is_err());
        let _ = std::fs::remove_dir_all(root);
    }
}
