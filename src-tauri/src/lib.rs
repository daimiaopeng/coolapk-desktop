pub mod coolapk;

use coolapk::client::CoolapkClient;
use coolapk::commands::{
    check_login_status, clear_user_cookie, create_feed, follow_user, get_app_detail,
    get_board_feeds, get_cool_picture_rank, get_digest_feeds, get_feed_detail, get_feed_replies,
    get_hot_feeds, get_hot_replies, get_image_data_url, get_index_v8_feeds, get_latest_feeds,
    get_notification_count, get_notifications, get_secondhand_feeds, get_sub_replies,
    get_topic_detail, get_topic_feeds, get_topic_hub_data, get_user_feeds, get_user_profile, get_user_space,
    like_feed, list_chat_history, list_messages, login_by_account, login_by_mobile, open_url,
    reply_feed, save_cookie_securely, search_all, search_feeds, send_private_message,
    send_sms_vcode, unfollow_user, unlike_feed, AppState,
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
            get_sub_replies,
            get_user_space,
            get_user_profile,
            get_user_feeds,
            get_topic_detail,
            get_topic_feeds,
            get_topic_hub_data,
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
            check_login_status,
            clear_user_cookie,
            login_by_account,
            send_sms_vcode,
            login_by_mobile,
            get_image_data_url,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
