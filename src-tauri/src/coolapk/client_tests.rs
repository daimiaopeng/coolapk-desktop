use super::*;

#[test]
fn test_search_response_filters_sponsor_entities_recursively() {
    let raw = serde_json::json!({
        "data": [{
            "entities": [
                {"entityType": "feed", "id": "1", "message": "正常动态"},
                {"entityTemplate": "sponsorForSearch", "sponsorType": "apk", "id": "2"},
                {"entityType": "entityCard", "entities": [{"entityType": "sponsorForSearch", "id": "3"}]}
            ]
        }]
    });
    let filtered = CoolapkClient::wrap_sanitized_search_data(&raw);
    let json = filtered.to_string();
    assert!(json.contains("正常动态"));
    assert!(!json.contains("sponsorForSearch"));
    assert!(!json.contains("sponsorType"));
}

#[test]
fn test_classify_path_detects_requirements() {
    // DDI 写接口：需要 ddid（unlike 不在 useDDIEventList 内）
    assert!(classify_path("/v6/feed/like").needs_ddid);
    assert!(!classify_path("/v6/feed/unlike").needs_ddid);
    assert!(classify_path("/v6/feed/likeReply").needs_ddid);
    assert!(classify_path("/v6/message/send").needs_ddid);
    // PostToken 接口：发动态/评论需要 _v2_post_token
    assert!(classify_path("/v6/feed/createFeed").needs_post_token);
    assert!(classify_path("/v6/feed/reply").needs_post_token);
    assert!(classify_path("/v6/feed/createFeed").needs_ddid);
    // 只读接口：不需要
    assert!(!classify_path("/v6/main/indexV8").needs_ddid);
    assert!(!classify_path("/v6/feed/detail").needs_post_token);
    // 带查询串也能匹配
    assert!(classify_path("/v6/feed/like?id=123").needs_ddid);
}

#[test]
fn test_ddid_is_not_sent_when_disabled() {
    let cookie = "SESSID=session; uid=123; ddid=stale-ddid; sid=other";
    assert_eq!(cookie_without_ddid(cookie), "SESSID=session; uid=123; sid=other");
    assert!(!cookie_for_request(cookie, true).contains("ddid="));
}

#[test]
fn test_product_rating_query_matches_apk_contract() {
    assert_eq!(
        build_product_rating_query("2967", 5),
        vec![("id", "2967".to_string()), ("value", "5".to_string())]
    );
    assert_eq!(
        build_product_rating_query("2967", 0),
        vec![("id", "2967".to_string()), ("value", "0".to_string())]
    );
}

#[test]
fn test_product_rating_list_query_matches_apk_contract() {
    assert_eq!(
        build_product_rating_list_query("5573", 0, 0, 0),
        vec![
            ("url", "/feed/nodeRatingList".to_string()),
            ("targetType", "7".to_string()),
            ("targetId", "5573".to_string()),
            ("ratingType", "all".to_string()),
            ("isOwner", "0".to_string()),
            ("page", "1".to_string()),
        ]
    );
    assert_eq!(
        build_product_rating_list_query("5573", 5, 1, 2).last(),
        Some(&("star", "5".to_string()))
    );
}

#[test]
fn test_collection_list_query_includes_default_collection() {
    assert_eq!(
        build_collection_list_query("12345", 1),
        vec![
            ("uid", "12345".to_string()),
            ("showDefault", "1".to_string()),
            ("page", "1".to_string()),
        ]
    );
}

#[test]
fn test_product_feeds_query_includes_sort_only_when_selected() {
    assert_eq!(
        build_product_feeds_query("5573", "feed", "", 1),
        vec![
            ("url", "/page?url=/product/feedList".to_string()),
            ("id", "5573".to_string()),
            ("type", "feed".to_string()),
            ("page", "1".to_string()),
        ]
    );
    assert_eq!(
        build_product_feeds_query("5573", "feed", " rank_score ", 1),
        vec![
            ("url", "/page?url=/product/feedList".to_string()),
            ("id", "5573".to_string()),
            ("type", "feed".to_string()),
            ("listType", "rank_score".to_string()),
            ("page", "1".to_string()),
        ]
    );
}

#[test]
fn test_feed_cleaner_preserves_live_photo_metadata() {
    let raw = serde_json::json!({
        "id": "live-feed-1",
        "entityType": "feed",
        "username": "测试用户",
        "message": "实况图",
        "imageUriList": [{
            "sourceUrl": "https://image.coolapk.com/feed/livepic@1080x1920.jpg",
            "compressedUrl": "https://image.coolapk.com/feed/livepic-cover.jpg",
            "liveVideoUrl": "https://video.coolapk.com/live/1.mp4",
            "livePhotoEnable": 1,
            "livePhotoSoundEnable": 0
        }]
    });

    let cleaned = CoolapkClient::clean_single_feed(&raw, 0).expect("feed should be kept");
    assert_eq!(cleaned["pics"][0], "https://image.coolapk.com/feed/livepic@1080x1920.jpg");
    assert_eq!(
        cleaned["imageUriList"][0]["liveVideoUrl"],
        "https://video.coolapk.com/live/1.mp4"
    );
    assert_eq!(cleaned["imageUriList"][0]["livePhotoEnable"], 1);
}

#[test]
fn test_live_photo_response_extracts_nested_url_list() {
    let response = serde_json::json!({
        "code": 200,
        "data": {
            "urlList": [
                "not-a-url",
                "https://video.coolapk.com/live/123.mp4"
            ]
        }
    });
    assert_eq!(
        extract_live_photo_video_url(&response),
        Some("https://video.coolapk.com/live/123.mp4".to_string())
    );
}

/// 在线接口探测：需要网络，默认测试集不执行。
#[tokio::test]
#[ignore]
async fn probe_product_rating_endpoints_contract() {
    let client = CoolapkClient::new();
    let product_id = "5573";

    let chart = client
        .api_get("/v6/product/ratingChart", &[("id", product_id.to_string())])
        .await
        .expect("评分趋势接口应能返回 HTTP JSON");
    assert!(chart.get("data").is_some(), "评分趋势响应缺少 data: {chart}");
    assert!(chart["data"].is_object(), "评分趋势 data 不是对象: {chart}");

    let list_query = build_product_rating_list_query(product_id, 0, 0, 1);
    let list = client
        .api_get("/v6/page/dataList", &list_query)
        .await
        .expect("产品评分列表接口应能返回 HTTP JSON");
    assert!(list.get("data").is_some(), "评分列表响应缺少 data: {list}");
    assert!(list["data"].is_array(), "评分列表 data 不是数组: {list}");
}

#[test]
fn test_oss_image_url_uses_prepare_prefix_and_file_name() {
    let url = build_oss_image_url(
        "https://image.coolapk.com/",
        "/feed/2026/08/23/test.png",
    )
    .expect("应生成图片地址");
    assert_eq!(url, "https://image.coolapk.com/feed/2026/08/23/test.png");
    assert!(build_oss_image_url("image.coolapk.com", "feed/test.png").is_none());
}

#[test]
fn test_image_resolution_reads_png_dimensions() {
    let mut png_header = vec![
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0, 0, 0, 0, b'I', b'H', b'D', b'R',
        0, 0, 0x04, 0x38, 0, 0, 0x08, 0x70,
    ];
    assert_eq!(image_resolution(&png_header), "1080x2160");
    png_header[16..20].copy_from_slice(&1u32.to_be_bytes());
    png_header[20..24].copy_from_slice(&1u32.to_be_bytes());
    assert_eq!(image_resolution(&png_header), "1x1");
}

#[test]
fn test_reply_target_uses_comment_id_and_reply_type() {
    assert_eq!(
        reply_target_params("73356707", Some(" 601858220 ")),
        ("601858220".to_string(), "reply".to_string())
    );
    assert_eq!(
        reply_target_params("73356707", None),
        ("73356707".to_string(), "feed".to_string())
    );
}

#[test]
fn test_create_feed_form_includes_pic_and_publish_state() {
    let form = build_create_feed_form(
        "测试",
        Some("http://image.coolapk.com/feed/test@0x0.png"),
        None,
    );
    let value = |key: &str| {
        form.iter()
            .find(|(name, _)| *name == key)
            .map(|(_, value)| value.as_str())
    };

    assert_eq!(value("pic"), Some("http://image.coolapk.com/feed/test@0x0.png"));
    assert_eq!(value("status"), Some("1"));
    assert_eq!(value("publish_status"), Some("0"));
    assert_eq!(value("is_html_article"), Some("0"));
}

#[test]
fn test_hot_rank_routes_use_statistics_api() {
    assert_eq!(
        rank_feed_url("month"),
        Some("#/feed/statList?statType=30days&sortField=likenum")
    );
    assert_eq!(
        rank_feed_url("favorite"),
        Some("#/feed/statList?statType=7days&sortField=favnum")
    );
    assert_eq!(
        rank_feed_url("index"),
        Some("#/feed/statList?statType=7days&sortField=detailnum")
    );
    assert_eq!(rank_feed_url("unknown"), None);
}

#[test]
fn test_clean_feed_keeps_edit_metadata() {
    let raw = json!({
        "id": 123,
        "uid": 456,
        "username": "测试用户",
        "message": "测试正文",
        "isModified": 1,
        "change_count": 2,
        "last_change_time": 1_786_000_100_u64
    });

    let cleaned = CoolapkClient::clean_single_feed(&raw, 0).expect("动态应能正常清洗");
    assert_eq!(cleaned["isModified"], 1);
    assert_eq!(cleaned["changeCount"], 2);
    assert_eq!(cleaned["lastChangeTime"], 1_786_000_100_u64);
}

#[test]
fn test_clean_feed_preserves_cloud_collection_state() {
    let raw = json!({
        "id": 123,
        "uid": 456,
        "username": "测试用户",
        "message": "测试正文",
        "userAction": {"collect": 1, "like": 0}
    });

    let cleaned = CoolapkClient::clean_single_feed(&raw, 0).expect("动态应能正常清洗");
    assert_eq!(cleaned["userAction"]["collect"], 1);
    assert_eq!(cleaned["userAction"]["like"], 0);
}

#[test]
fn test_clean_feed_preserves_relation_and_video_fields() {
    let raw = json!({
        "id": 123,
        "uid": 456,
        "username": "测试用户",
        "target_row": {"id": 2967, "title": "黑神话：钟馗", "entityType": "game"},
        "relation_rows": [{"id": 2967, "title": "黑神话：钟馗"}],
        "extraRows": [{"id": 789, "title": "关联扩展卡片"}],
        "productRows": [{"id": 999, "title": "关联产品"}],
        "video_url": "https://example.com/video.mp4",
        "video_pic": "https://example.com/video.jpg",
        "video_duration": 900,
        "media_url": "https://video.example.com/media.mp4",
        "media_pic": "https://video.example.com/media.jpg",
        "media_info": "{\"mediaType\":\"video\",\"duration\":952183}",
        "media_type": "2",
        "feedType": "video",
        "feedTypeName": "视频"
    });

    let cleaned = CoolapkClient::clean_single_feed(&raw, 0).expect("带视频和关联标的的动态应能正常清洗");
    assert_eq!(cleaned["targetRow"]["id"], 2967);
    assert_eq!(cleaned["relationRows"][0]["title"], "黑神话：钟馗");
    assert_eq!(cleaned["extraRows"][0]["title"], "关联扩展卡片");
    assert_eq!(cleaned["productRows"][0]["title"], "关联产品");
    assert_eq!(cleaned["videoUrl"], "https://example.com/video.mp4");
    assert_eq!(cleaned["videoPic"], "https://example.com/video.jpg");
    assert_eq!(cleaned["videoDuration"], 900);
    assert_eq!(cleaned["mediaUrl"], "https://video.example.com/media.mp4");
    assert_eq!(cleaned["mediaPic"], "https://video.example.com/media.jpg");
    assert_eq!(cleaned["mediaInfo"], "{\"mediaType\":\"video\",\"duration\":952183}");
    assert_eq!(cleaned["mediaType"], "2");
    assert_eq!(cleaned["feedType"], "video");
}

#[test]
fn test_clean_feed_keeps_video_or_relation_only_items() {
    let video_only = json!({
        "id": 123,
        "uid": 456,
        "username": "视频用户",
        "videoUrl": "https://example.com/video.mp4"
    });
    let relation_only = json!({
        "id": 124,
        "uid": 456,
        "username": "关联用户",
        "relationRows": [{"id": 2967, "title": "黑神话：钟馗"}]
    });

    assert!(CoolapkClient::clean_single_feed(&video_only, 0).is_some());
    assert!(CoolapkClient::clean_single_feed(&relation_only, 1).is_some());
}

#[test]
fn test_user_page_data_url_allowlist() {
    assert!(CoolapkClient::is_allowed_user_page_url(
        "#/feed/userCoolPictureFeedList?fragmentTemplate=flex"
    ));
    assert!(CoolapkClient::is_allowed_user_page_url(
        "#/feed/nodeRatingList?uid=123&targetType=all&parseRatingToFeed=1"
    ));
    assert!(CoolapkClient::is_allowed_user_page_url(
        "#/feed/userDeleteFeedList"
    ));
    assert!(!CoolapkClient::is_allowed_user_page_url(
        "https://example.com/anything"
    ));
    assert!(!CoolapkClient::is_allowed_user_page_url(
        "#/feed/userCoolPictureFeedList?fragmentTemplate=flex&proxy=https://example.com"
    ));
}

#[test]
fn test_user_entity_rows_preserve_unknown_templates() {
    let raw = json!({
        "data": [
            {
                "entityType": "future_template",
                "entityTemplate": "server_v99",
                "title": "服务端新卡片",
                "unknownField": {"keep": true}
            },
            {
                "entityType": "card",
                "entities": [{"entityType": "apk", "id": 7, "title": "应用"}]
            }
        ]
    });
    let rows = CoolapkClient::extract_entity_rows(&raw);
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0]["entityTemplate"], "server_v99");
    assert_eq!(rows[0]["unknownField"]["keep"], true);
    assert_eq!(rows[1]["id"], 7);
}

/// 随机设备码：每次调用生成不同结果（游客态/新账号首次生成随机并持久化）
#[test]
fn test_device_code_is_random() {
    let a = generate_random_device_code();
    let b = generate_random_device_code();
    assert_ne!(a, b, "两次生成的设备码不应相同");
    assert!(a.len() >= 60, "设备码应有足够长度");
    assert!(is_valid_device_code(&a), "生成的设备码必须符合官方规范格式");
    assert!(
        HeaderValue::from_str(&a).is_ok(),
        "设备码必须是合法 HTTP header 值"
    );
}

#[test]
fn test_account_cookie_requires_real_sessid() {
    assert!(CoolapkClient::has_valid_session_cookie(
        "SESSID=valid-session; uid=12345; username=test"
    ));
    assert!(!CoolapkClient::has_valid_session_cookie(
        "uid=12345; username=test; token=only-token"
    ));
    assert!(!CoolapkClient::has_valid_session_cookie(
        "SESSID=deleted; uid=12345"
    ));
    assert!(!CoolapkClient::has_valid_session_cookie(
        "SESSID=expired; uid=12345"
    ));
}

#[tokio::test]
#[ignore]
async fn test_reply_list_api() {
    let client = CoolapkClient::new();
    println!("=== Fetching feeds ===");
    let feeds = match client.get_index_v8_feeds(1).await {
        Ok(f) => f,
        Err(e) => {
            println!("Fetching feeds failed in CI: {e}");
            return;
        }
    };
    let feed_id = match feeds["data"]
        .as_array()
        .and_then(|arr| {
            arr.iter()
                .find(|f| f.get("replynum").and_then(|v| v.as_u64()).unwrap_or(0) > 0)
        })
        .and_then(|f| f.get("id").and_then(|v| v.as_str()))
    {
        Some(id) => id.to_string(),
        None => {
            println!("No valid feed with replynum found");
            return;
        }
    };
    println!("Target feed_id: {}", feed_id);

    println!("=== Fetching top level replies ===");
    let replies = match client.get_feed_replies(&feed_id, 1).await {
        Ok(r) => r,
        Err(e) => {
            println!("Fetching feed replies failed in CI: {e}");
            return;
        }
    };
    let replies_arr = replies["data"].as_array().unwrap();
    println!("Replies count: {}", replies_arr.len());

    // 找到有楼中楼的评论
    let mut target_cid = String::new();
    for r in replies_arr.iter() {
        let rrc = r
            .get("replyRowsCount")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        if rrc > 2 {
            target_cid = r
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_default();
            println!(
                "Found comment with {} sub-replies: id={}, author={}",
                rrc,
                target_cid,
                r.get("username").and_then(|v| v.as_str()).unwrap_or("")
            );
            break;
        }
    }
    if target_cid.is_empty() {
        println!("No comment with >2 sub-replies found, skipping");
        return;
    }

    let embedded_ids: Vec<String> = replies_arr
        .iter()
        .find(|item| item.get("id").and_then(Value::as_str) == Some(target_cid.as_str()))
        .and_then(|item| item.get("replyRows"))
        .and_then(Value::as_array)
        .map(|rows| rows.iter().filter_map(|row| row.get("id").map(value_to_string)).collect())
        .unwrap_or_default();
    println!("Embedded child IDs: {:?}", embedded_ids);

    // 测试 APK 对应的 replyList 子回复分页请求，并按上一页最后一条 ID 传递游标。
    let mut last_item = String::new();
    for page in 1..=5 {
        println!("\nTesting APK sub-reply request page={page}, feedType=feed_reply");
        let json = match client
            .get_sub_replies_paged(&feed_id, &target_cid, page, &last_item)
            .await
        {
            Ok(value) => value,
            Err(error) => {
                println!("Sub-reply request failed: {error}");
                continue;
            }
        };
        let ids: Vec<String> = json
            .get("data")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.get("id").map(value_to_string))
                    .collect()
            })
            .unwrap_or_default();
        println!("Total items returned: {}, ids={ids:?}", ids.len());
        last_item = ids.last().cloned().unwrap_or_default();
    }
}

/// 验证公开动态在登录设备触发风控时，匿名设备仍可读取完整一级评论。
/// 该测试只输出评论数量与层级字段，不读取或打印任何登录凭据。
#[tokio::test]
#[ignore]
async fn probe_public_reply_list_for_single_comments() {
    let client = CoolapkClient::new();
    let query = [
        ("id", "72018814".to_string()),
        ("listType", "dateline_desc".to_string()),
        ("page", "1".to_string()),
        ("discussMode", "1".to_string()),
        ("feedType", "feed".to_string()),
        ("blockStatus", "0".to_string()),
        ("fromFeedAuthor", "0".to_string()),
    ];

    for (name, result) in [
        (
            "api2",
            client
                .public_api_get_from("https://api2.coolapk.com", "/v6/feed/replyList", &query)
                .await,
        ),
        (
            "api",
            client
                .public_api_get_from("https://api.coolapk.com", "/v6/feed/replyList", &query)
                .await,
        ),
    ] {
        match result {
            Ok(value) => {
                let rows = value
                    .get("data")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                let summary: Vec<Value> = rows
                    .iter()
                    .map(|item| {
                        json!({
                            "id": item.get("id").cloned().unwrap_or(Value::Null),
                            "rid": item.get("rid").cloned().unwrap_or(Value::Null),
                            "rrid": item.get("rrid").cloned().unwrap_or(Value::Null),
                            "replyRowsCount": item
                                .get("replyRowsCount")
                                .cloned()
                                .unwrap_or(Value::Null),
                        })
                    })
                    .collect();
                let field_names = rows
                    .first()
                    .and_then(Value::as_object)
                    .map(|object| {
                        let mut names = object.keys().cloned().collect::<Vec<_>>();
                        names.sort();
                        names
                    })
                    .unwrap_or_default();
                let available_fields = [
                    "device_title",
                    "deviceTitle",
                    "floor",
                    "rank",
                    "ipLocation",
                    "ip_location",
                    "location",
                    "pic",
                    "picArr",
                    "images",
                    "verify_title",
                    "dateline",
                ]
                .into_iter()
                .filter(|field| {
                    rows.iter().any(|item| {
                        let value = item.get(*field).unwrap_or(&Value::Null);
                        !value.is_null()
                            && value.as_str().is_none_or(|text| !text.trim().is_empty())
                            && value.as_array().is_none_or(|items| !items.is_empty())
                    })
                })
                .collect::<Vec<_>>();
                let user_info_fields = rows
                    .iter()
                    .find_map(|item| item.get("userInfo").and_then(Value::as_object))
                    .map(|object| {
                        let mut names = object.keys().cloned().collect::<Vec<_>>();
                        names.sort();
                        names
                    })
                    .unwrap_or_default();
                let nested_fields = rows
                    .iter()
                    .filter_map(|item| item.get("replyRows").and_then(Value::as_array))
                    .flatten()
                    .find_map(Value::as_object)
                    .map(|object| {
                        let mut names = object.keys().cloned().collect::<Vec<_>>();
                        names.sort();
                        names
                    })
                    .unwrap_or_default();
                println!("{name}: count={}, rows={}", rows.len(), json!(summary));
                println!("{name}: first_fields={field_names:?}");
                println!("{name}: available_display_fields={available_fields:?}");
                println!("{name}: user_info_fields={user_info_fields:?}");
                println!("{name}: nested_fields={nested_fields:?}");
            }
            Err(error) => println!("{name}: error={error}"),
        }
    }
}

/// 探测评论是否存在可读取的详情接口，以确认能否补齐发表评论时的设备信息。
/// 只打印状态码和字段名，不打印评论正文、用户信息或登录凭据。
#[tokio::test]
#[ignore]
async fn probe_reply_detail_metadata() {
    let client = CoolapkClient::new();
    let reply_id = "601858220";

    for path in ["/v6/feed/detail", "/v6/feed/replyDetail", "/v6/feed/reply"] {
        let result = client
            .public_api_get_from(
                "https://api.coolapk.com",
                path,
                &[("id", reply_id.to_string())],
            )
            .await;

        match result {
            Ok(value) => {
                let data = value.get("data").unwrap_or(&Value::Null);
                let mut fields = data
                    .as_object()
                    .map(|object| object.keys().cloned().collect::<Vec<_>>())
                    .unwrap_or_default();
                fields.sort();
                let has_device = data.get("device_title").is_some()
                    || data.get("deviceTitle").is_some()
                    || data.get("device_name").is_some();
                let device_metadata = json!({
                    "device_title": data.get("device_title").and_then(Value::as_str).unwrap_or(""),
                    "device_name": data.get("device_name").and_then(Value::as_str).unwrap_or(""),
                    "device_build": data.get("device_build").and_then(Value::as_str).unwrap_or(""),
                    "device_rom": data.get("device_rom").and_then(Value::as_str).unwrap_or(""),
                    "useragent": data.get("useragent").and_then(Value::as_str).unwrap_or(""),
                });
                println!(
                    "path={path}, code={:?}, data_fields={fields:?}, has_device={has_device}, device_metadata={device_metadata}",
                    value.get("code")
                );
            }
            Err(error) => println!("path={path}, error={error}"),
        }
    }
}

#[test]
fn test_parse_reply_user_agent_keeps_real_device_metadata() {
    let user_agent = "Dalvik/2.1.0 (Linux; U; Android 16; 2210132C Build/BP2A.250605.031.A3) (#Build; Xiaomi; 2210132C; BP2A.250605.031.A3; HyperOS_3.0; 3.0.310.0) +CoolMarket/16.5.1";
    let (device_title, device_build, device_rom) = parse_reply_user_agent(user_agent);
    assert_eq!(device_title, "Xiaomi 2210132C");
    assert_eq!(device_build, "BP2A.250605.031.A3");
    assert_eq!(device_rom, "Android 16 · HyperOS 3.0.310.0");
}

/// 模拟「登录 → 保存 Cookie → 落盘 JSON → 重启恢复 → 登出」完整链路（不依赖网络）
#[tokio::test]
async fn test_login_cookie_persistence_flow() {
    use std::path::PathBuf;

    let dir =
        std::env::temp_dir().join(format!("coolapk_desktop_login_test_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let cookie_file: PathBuf = dir.join("session_cookie.txt");
    let accounts_file: PathBuf = dir.join("accounts.json");

    // 1. 首次启动：无持久化凭据
    let client = CoolapkClient::new();
    client.persist_cookie_to(cookie_file.clone());
    assert_eq!(client.get_user_cookie(), None, "首次启动不应有 cookie");

    // 2. 模拟 Webview 授权登录：save_cookie_securely 内部调用 set_user_cookie
    let fake_cookie = "SESSID=abc123def456; uid=10086; Hm_lvt_xxx=1";
    client
        .save_account("10086", "测试用户", "", fake_cookie)
        .await
        .unwrap();
    assert_eq!(client.get_user_cookie(), Some(fake_cookie.to_string()));
    assert!(accounts_file.exists(), "登录后凭据应已写入 JSON 账户库");
    let root: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&accounts_file).unwrap()).unwrap();
    assert_eq!(
        root["lastLoginUid"].as_str(),
        Some("10086"),
        "JSON 库应记录当前登录 uid"
    );

    // 3. 模拟应用重启：新实例通过 persist_cookie_to 从 JSON 自动恢复
    let restarted = CoolapkClient::new();
    restarted.persist_cookie_to(cookie_file.clone());
    assert_eq!(
        restarted.get_user_cookie(),
        Some(fake_cookie.to_string()),
        "重启后应自动恢复登录凭据"
    );

    // 4. 模拟退出登录：clear_user_cookie 清空内存与当前登录标记（账户记录保留）
    restarted.clear_user_cookie().unwrap();
    assert_eq!(restarted.get_user_cookie(), None);
    let root2: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&accounts_file).unwrap()).unwrap();
    assert_eq!(
        root2["lastLoginUid"].as_str(),
        Some(""),
        "登出后当前登录标记应清空"
    );
    assert_eq!(
        root2["accounts"].as_array().map(|a| a.len()),
        Some(1),
        "账户记录应保留，便于下次快速切换"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

/// 网页外壳噪音剔除 + 正文提取：酷安 /feed/ 分享页只有导航/页脚/扫码提示，
/// 提取后不应残留导航与页脚链接
#[test]
fn test_extract_readable_content_strips_chrome() {
    let html = r#"<!DOCTYPE html>
<html><head><title>动态分享 - 酷安</title></head>
<body>
<header><a href="/">酷安</a><a href="/editorChoice">编辑精选</a></header>
<nav><a href="/apk/">应用</a><a href="/game/">游戏</a><a href="/u/1451266">oxygen的喵</a></nav>
<div>您当前查看的是「动态分享」，请用酷安手机APP扫码查看详情<br>下载酷安手机APP</div>
<article>
<p>在家用 Windows 刷酷安的新方式——</p>
<a href="/t/数码日常">#数码日常#</a>
</article>
<footer><a href="/about/contact.html">联系酷安</a><span>粤ICP备15030494号</span></footer>
<script>alert(1)</script>
</body></html>"#;

    let cleaned = extract_readable_content(html);
    assert!(cleaned.contains("在家用 Windows 刷酷安"), "正文应保留");
    assert!(cleaned.contains("#数码日常#"), "正文链接应保留");
    assert!(!cleaned.contains("编辑精选"), "导航不应残留");
    assert!(!cleaned.contains("oxygen的喵"), "导航用户链接不应残留");
    assert!(!cleaned.contains("粤ICP备"), "页脚不应残留");
    assert!(!cleaned.contains("alert"), "脚本不应残留");
    assert!(!cleaned.contains("<script"), "script 标签不应残留");
}

/// 无 article/main 容器时退化为整体剥壳结果，且自闭合/未闭合标签不 panic
#[test]
fn test_extract_readable_content_fallback_safe() {
    let html = r#"<html><body><nav>导航</nav><div><br/><img src="a.png">正文内容</div><footer>页脚</footer></body></html>"#;
    let cleaned = extract_readable_content(html);
    assert!(cleaned.contains("正文内容"));
    assert!(!cleaned.contains("导航"));
    assert!(!cleaned.contains("页脚"));

    let broken = "<article>无闭合正文...<div>内容";
    let out = extract_readable_content(broken);
    assert!(out.contains("无闭合正文"));
}

/// 浏览历史/最近访问实体没有 username/userInfo，
/// 必须能原样保留（此前走 clean_single_feed 会被全部丢弃）
#[test]
fn test_extract_history_list_preserves_entities() {
    let raw = json!({
        "data": [
            {
                "title": "oxygen",
                "description": "",
                "logo": "http://avatar.coolapk.com/data/001/45/12/66_avatar_middle.jpg",
                "url": "u/1451266",
                "historyType": "user",
                "typeName": "用户",
                "id": "user:1451266",
                "entityType": "history",
                "dateline": 1786022084
            },
            {
                "id": 247872765,
                "uid": 1451266,
                "target_type": "apk",
                "entityType": "recentHistory",
                "entityId": 247872765,
                "target_type_title": "应用",
                "title": "哔哩哔哩",
                "url": "/apk/tv.danmaku.bili",
                "logo": "//pp.myapp.com/ma_icon/0/icon/256",
                "follow_num": 25289
            }
        ]
    });

    let list = CoolapkClient::extract_history_list(&raw);
    assert_eq!(list.len(), 2, "历史实体不能被丢弃");

    let history = &list[0];
    assert_eq!(history["entityType"], "history");
    assert_eq!(history["url"], "/u/1451266", "url 应补全前导斜杠");
    assert_eq!(
        history["logo"], "https://avatar.coolapk.com/data/001/45/12/66_avatar_middle.jpg",
        "http 图片应升级为 https"
    );

    let recent = &list[1];
    assert_eq!(recent["entityType"], "recentHistory");
    assert_eq!(
        recent["url"], "/apk/tv.danmaku.bili",
        "已有前导斜杠的 url 不应被改动"
    );
    assert_eq!(
        recent["logo"], "https://pp.myapp.com/ma_icon/0/icon/256",
        "// 开头图片应补全 https"
    );
}

/// 数码品牌/分类实体没有 username/author/dyh_name，
/// 必须原样保留（此前走 clean_single_feed 会被全部丢弃，导致分类页为空）
#[test]
fn test_extract_product_entity_list_preserves_brands() {
    let raw = json!({
        "code": 200,
        "data": [
            {
                "id": 1,
                "title": "Apple",
                "logo": "http://image.coolapk.com/logo/apple.png",
                "product_num": 120,
                "entityType": "brand"
            },
            {
                "entityId": 2,
                "name": "华为",
                "pic": "//image.coolapk.com/logo/huawei.png",
                "series_num": 88,
                "entityType": "brand"
            },
            {
                "entityTemplate": "productGroupTitle",
                "title": "Mate 系列"
            },
            {
                "entityTemplate": "productGroupMore",
                "title": "查看更多",
                "url": "/product/more"
            },
            {
                "entityType": "header",
                "title": "热门品牌"
            }
        ]
    });

    let list = CoolapkClient::extract_product_entity_list(&raw);
    assert_eq!(list.len(), 4, "品牌实体和产品组结构卡不能被丢弃，普通占位应被过滤");

    let apple = &list[0];
    assert_eq!(apple["title"], "Apple");
    assert_eq!(apple["product_num"], 120);

    let huawei = &list[1];
    assert_eq!(huawei["name"], "华为");
    assert_eq!(huawei["series_num"], 88);
    assert_eq!(list[2]["entityTemplate"], "productGroupTitle");
    assert_eq!(list[3]["entityTemplate"], "productGroupMore");
}

#[test]
fn test_extract_product_entity_list_flattens_nested_entities() {
    let raw = json!({
        "code": 200,
        "data": [
            {
                "title": "分类组",
                "entities": [
                    { "id": "c1", "title": "手机" },
                    { "entities": [{ "id": "c2", "title": "平板" }] }
                ]
            }
        ]
    });

    let list = CoolapkClient::extract_product_entity_list(&raw);
    assert_eq!(list.len(), 2, "嵌套 entities 应被摊平");
    assert_eq!(list[0]["id"], "c1");
    assert_eq!(list[1]["id"], "c2");
}

#[test]
fn test_discovery_request_args_filters_reserved_and_unsafe_values() {
    let args = parse_discovery_request_args(
        r#"{"type":"phone","sort":"hot","page":99,"bad key":"x","nested":{"mode":"new"},"empty":null,"line":"a\n b"}"#,
    );
    assert_eq!(args.len(), 3);
    assert!(args.contains(&("type".to_string(), "phone".to_string())));
    assert!(args.contains(&("sort".to_string(), "hot".to_string())));
    assert!(args.contains(&("nested".to_string(), r#"{"mode":"new"}"#.to_string())));
    assert!(!args.iter().any(|(key, _)| key == "page" || key == "bad key" || key == "empty" || key == "line"));
}

#[test]
fn test_product_entity_page_response_keeps_pagination_metadata() {
    let raw = serde_json::json!({
        "data": [{ "id": 1, "title": "手机", "entityType": "product" }],
        "firstItem": "1",
        "lastItem": "1",
        "hasMore": true,
        "total": 42,
        "pagination": { "current": 1 }
    });
    let response = CoolapkClient::product_entity_page_response(&raw);
    assert_eq!(response["data"].as_array().map(|items| items.len()), Some(1));
    assert_eq!(response["firstItem"], "1");
    assert_eq!(response["lastItem"], "1");
    assert_eq!(response["hasMore"], true);
    assert_eq!(response["total"], 42);
    assert_eq!(response["pagination"]["current"], 1);
}

/// 模拟 Webview 登录脚本捕获到的真实 Cookie 形态（含中文/换行等脏字符），
/// 验证 set_user_cookie 的 ASCII 清洗与落盘逻辑不会崩坏
#[tokio::test]
async fn test_login_cookie_dirty_input_sanitized() {
    use std::path::PathBuf;

    let dir = std::env::temp_dir().join(format!(
        "coolapk_desktop_sanitize_test_{}",
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let cookie_file: PathBuf = dir.join("session_cookie.txt");

    let client = CoolapkClient::new();
    client.persist_cookie_to(cookie_file.clone());

    let dirty = "SESSID=abc;\r\n uid=10086; 昵称=oxygen的喵; other=\"v\"";
    client.set_user_cookie(dirty.to_string()).unwrap();
    // 先建立账户，set_user_cookie 才会同步写 JSON 账户库
    client
        .save_account("10086", "测试用户", "", dirty)
        .await
        .unwrap();
    client.set_user_cookie(dirty.to_string()).unwrap();

    let stored = client.get_user_cookie().unwrap();
    assert!(
        !stored.contains('\r') && !stored.contains('\n'),
        "不应包含换行"
    );
    assert!(stored.contains("SESSID=abc") && stored.contains("uid=10086"));
    // 落盘 JSON 账户库中的 cookie 字段必须是清洗后的安全形态
    let accounts_file: PathBuf = dir.join("accounts.json");
    let root: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&accounts_file).unwrap()).unwrap();
    let cookie = root["accounts"][0]["cookie"].as_str().unwrap_or("");
    assert!(
        !cookie.contains('\r') && !cookie.contains('\n'),
        "JSON 库中 cookie 不应包含换行"
    );
    assert!(
        cookie.contains("SESSID=abc") && cookie.contains("uid=10086"),
        "cookie 应保留有效字段"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

/// 验证修复后的 get_fans_user_list 返回真实粉丝（需登录）
#[tokio::test]
#[ignore]
async fn verify_fans_user_list_fixed() {
    let client = CoolapkClient::new();
    let accounts_path =
        std::path::Path::new(r"C:\Users\admin\AppData\Roaming\com.coolapk.desktop\accounts.json");
    if let Ok(content) = std::fs::read_to_string(accounts_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(cookie) = json["accounts"][0]["cookie"].as_str() {
                let _ = client.set_user_cookie(cookie.to_string());
            }
        }
    }

    match client.get_fans_user_list("1451266", 1).await {
        Ok(res) => {
            let arr = res["data"].as_array().cloned().unwrap_or_default();
            println!("[fixed fansList] len={}", arr.len());
            for u in arr.iter().take(5) {
                let uid = u
                    .get("uid")
                    .map(serde_json::to_string)
                    .and_then(Result::ok)
                    .unwrap_or_default();
                let name = u
                    .get("username")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                println!("  uid={} username={}", uid, name);
            }
        }
        Err(e) => println!("[fixed fansList] ERROR: {}", e),
    }
}

#[tokio::test]
#[ignore]
async fn test_live_oss_and_reply() {
    let client = CoolapkClient::new();
    client.persist_cookie_to(std::path::PathBuf::from(r"C:\Users\daimi\AppData\Roaming\com.coolapk.desktop\session_cookie.txt"));

    // Set a valid structured device code
    let valid_dev = ";t00LjQwODAzMjEuMVFLVTsgTzZDS1IzMTExMzIgO2ltb2FpWDsgO2ltb2FpWCA7IDsgOyA7IDRkM2MyYjFhNmY1ZTRrN2M".to_string();
    if let Ok(mut auth) = client.auth.write() {
        auth.set_device_code(valid_dev.clone());
    }
    if let Ok(mut guard) = client.device_code.write() {
        *guard = valid_dev.clone();
    }

    println!("Current UID: {:?}", client.current_uid());
    println!("Testing device code: {}", valid_dev);

    let fake_png: Vec<u8> = vec![
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
        0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
        0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78,
        0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    println!("\n=== TESTING UPLOAD IMAGE (REAL CALL) ===");
    let upload_res = client
        .upload_image(&fake_png, "test_dot.png", "image/png", "feed", None)
        .await;
    println!("upload_res = {:?}", upload_res);
}
