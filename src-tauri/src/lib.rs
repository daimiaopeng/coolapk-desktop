pub mod coolapk;

use coolapk::client::CoolapkClient;
use coolapk::commands::{
    create_feed, follow_user, get_app_detail, get_board_feeds, get_cool_picture_rank,
    get_digest_feeds, get_feed_detail, get_feed_replies, get_hot_feeds, get_hot_replies,
    get_image_data_url, get_index_v8_feeds, get_latest_feeds, get_notification_count,
    get_notifications, get_secondhand_feeds, get_topic_detail, get_topic_feeds, get_user_feeds,
    get_user_profile, get_user_space, like_feed, list_chat_history, list_messages, reply_feed,
    save_cookie_securely, search_all, search_feeds, send_private_message, unfollow_user,
    unlike_feed, AppState,
};

pub fn run() {
    let client = CoolapkClient::new();
    let state = AppState { client };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_index_v8_feeds,
            get_hot_feeds,
            get_latest_feeds,
            get_digest_feeds,
            get_cool_picture_rank,
            get_board_feeds,
            get_secondhand_feeds,
            get_feed_detail,
            get_hot_replies,
            search_all,
            search_feeds,
            get_feed_replies,
            get_user_space,
            get_user_profile,
            get_user_feeds,
            get_topic_detail,
            get_topic_feeds,
            get_app_detail,
            get_notification_count,
            get_notifications,
            list_messages,
            list_chat_history,
            send_private_message,
            like_feed,
            unlike_feed,
            reply_feed,
            follow_user,
            unfollow_user,
            create_feed,
            save_cookie_securely,
            get_image_data_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
