pub mod coolapk;

use coolapk::client::CoolapkClient;
    use coolapk::commands::{
        check_login_status, clear_user_cookie, create_feed, follow_user, get_app_detail, get_app_list,
        get_board_feeds, get_cool_picture_rank, get_digest_feeds, get_feed_detail, get_feed_replies,
        get_game_list, get_hot_feeds, get_hot_replies, get_image_data_url, get_index_v8_feeds, get_latest_feeds,
        get_notification_count, get_notifications, get_secondhand_feeds, get_sub_replies,
        get_topic_detail, get_topic_feeds, get_topic_hub_data, get_user_feeds, get_user_profile, get_user_space,
        get_user_follow_nodes,
        like_feed, list_chat_history, list_messages, login_by_account, login_by_mobile, open_url,
        reply_feed, save_cookie_securely, search_all, search_apks, search_feeds, send_private_message,
        search_games,
        send_sms_vcode, unfollow_user, unlike_feed, open_login_webview, close_login_window,
        get_following_feeds, get_follow_user_list, get_user_cookie, AppState,
        download_update, install_update, quit_app,
        get_tab_config, get_search_suggestions, get_topic_detail_v7, get_product_detail,
        get_product_feeds, get_dyh_detail, get_dyh_feeds, get_apk_feeds, check_login_info,
        get_album_detail,
        get_album_list,
        get_album_replies,
        get_apk_discoverers,
        get_apk_gift_list,
        get_apk_recommend_list,
        get_download_version_list,
        get_editor_choice_feeds,
        get_headline_feeds,
        get_picture_list,
        get_update_list,
        get_user_rating_list,
        search_albums,
        search_apks_by_developer,
        search_apks_by_tag,
    };
use tauri::{Manager, WindowEvent};
use std::sync::atomic::{AtomicBool, Ordering};

static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn set_close_to_tray(enabled: bool) {
    CLOSE_TO_TRAY.store(enabled, Ordering::SeqCst);
}

pub fn run() {
    let client = CoolapkClient::new();
    let state = AppState { client };

    tauri::Builder::default()
        .manage(state)
        .setup(|app| {
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

                let _tray = TrayIconBuilder::new()
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
                        "quit" => app.exit(0),
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
            if let WindowEvent::CloseRequested { api, .. } = event {
                // 关闭到托盘：点击关闭按钮时隐藏窗口而非退出
                if CLOSE_TO_TRAY.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_index_v8_feeds,
            get_hot_feeds,
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
            get_search_suggestions,
            get_topic_detail_v7,
            get_product_detail,
            get_product_feeds,
            get_dyh_detail,
            get_dyh_feeds,
            get_apk_feeds,
            check_login_info,

            get_feed_detail,
            get_hot_replies,
            search_all,
            search_feeds,
            get_feed_replies,
            get_sub_replies,
            get_user_space,
            get_user_profile,
            get_user_follow_nodes,
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
            open_url,
            open_login_webview,
            close_login_window,
            get_user_cookie,
            get_following_feeds,
            get_follow_user_list,
            set_close_to_tray,
            download_update,
            install_update,
            quit_app,
            get_album_detail,
            get_album_list,
            get_album_replies,
            get_apk_discoverers,
            get_apk_gift_list,
            get_apk_recommend_list,
            get_download_version_list,
            get_editor_choice_feeds,
            get_headline_feeds,
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
