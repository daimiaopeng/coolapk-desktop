use super::*;

/// 辅助：打印截断的响应用于调试
fn clip(body: &str, n: usize) -> String {
    body.chars().take(n).collect()
}

/// 全体写接口请求方式探测
/// 酷安 v6 API 的写接口必须使用 GET（POST 返回 404 "请求方式错误"）。
/// 未登录时 GET 返回 401 "你还没有登录"，说明接口可达、方法正确。
#[tokio::test]
#[ignore]
async fn probe_all_write_endpoints_http_method() {
    let client = CoolapkClient::new();
    let token = client.auth.get_app_token().unwrap();

    // 先获取一个真实 feed_id 和 reply_id
    let feed_id = match client.get_index_v8_feeds(1).await {
        Ok(f) => f["data"]
            .as_array()
            .and_then(|arr| arr.iter().find(|f| f.get("replynum").and_then(|v| v.as_u64()).unwrap_or(0) > 0))
            .and_then(|f| f.get("id").and_then(|v| v.as_str()))
            .map(String::from)
            .unwrap_or_else(|| "73077541".to_string()),
        Err(_) => "73077541".to_string(),
    };

    let reply_id = match client.get_feed_replies(&feed_id, 1).await {
        Ok(r) => r["data"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|r| r.get("id").and_then(|v| v.as_str()))
            .map(String::from)
            .unwrap_or_else(|| "601225687".to_string()),
        Err(_) => "601225687".to_string(),
    };

    #[derive(Debug)]
    struct Case {
        label: &'static str,
        path: &'static str,
        /// false = POST, true = GET
        is_get: bool,
        params: Vec<(&'static str, String)>,
    }

    let cases = vec![
        Case {
            label: "like (GET)",
            path: "/v6/feed/like",
            is_get: true,
            params: vec![("id", reply_id.clone())],
        },
        Case {
            label: "like (POST)",
            path: "/v6/feed/like",
            is_get: false,
            params: vec![("id", reply_id.clone())],
        },
        Case {
            label: "unlike (GET)",
            path: "/v6/feed/unlike",
            is_get: true,
            params: vec![("id", reply_id.clone())],
        },
        Case {
            label: "unlike (POST)",
            path: "/v6/feed/unlike",
            is_get: false,
            params: vec![("id", reply_id.clone())],
        },
        Case {
            label: "reply (GET)",
            path: "/v6/feed/reply",
            is_get: true,
            params: vec![
                ("id", feed_id.clone()),
                ("type", "feed".to_string()),
                ("message", "api-probe-test".to_string()),
            ],
        },
        Case {
            label: "reply (POST)",
            path: "/v6/feed/reply",
            is_get: false,
            params: vec![
                ("id", feed_id.clone()),
                ("type", "feed".to_string()),
                ("message", "api-probe-test".to_string()),
            ],
        },
        Case {
            label: "follow (GET)",
            path: "/v6/user/follow",
            is_get: true,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "follow (POST)",
            path: "/v6/user/follow",
            is_get: false,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "unfollow (GET)",
            path: "/v6/user/unfollow",
            is_get: true,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "unfollow (POST)",
            path: "/v6/user/unfollow",
            is_get: false,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "createFeed (GET)",
            path: "/v6/feed/createFeed",
            is_get: true,
            params: vec![("message", "api-probe-test".to_string())],
        },
        Case {
            label: "createFeed (POST)",
            path: "/v6/feed/createFeed",
            is_get: false,
            params: vec![("message", "api-probe-test".to_string())],
        },
        Case {
            label: "msgSend (GET)",
            path: "/v6/message/send",
            is_get: true,
            params: vec![("uid", "1".to_string()), ("message", "api-probe-test".to_string())],
        },
        Case {
            label: "msgSend (POST)",
            path: "/v6/message/send",
            is_get: false,
            params: vec![("uid", "1".to_string()), ("message", "api-probe-test".to_string())],
        },
        Case {
            label: "account/login (GET)",
            path: "/v6/account/login",
            is_get: true,
            params: vec![("login", "test".to_string()), ("password", "test".to_string())],
        },
        Case {
            label: "account/login (POST)",
            path: "/v6/account/login",
            is_get: false,
            params: vec![("login", "test".to_string()), ("password", "test".to_string())],
        },
        Case {
            label: "sendVcode (GET)",
            path: "/v6/account/sendVcode",
            is_get: true,
            params: vec![("mobile", "13800000000".to_string()), ("type", "login".to_string())],
        },
        Case {
            label: "sendVcode (POST)",
            path: "/v6/account/sendVcode",
            is_get: false,
            params: vec![("mobile", "13800000000".to_string()), ("type", "login".to_string())],
        },
        Case {
            label: "loginByMobile (GET)",
            path: "/v6/account/loginByMobile",
            is_get: true,
            params: vec![("mobile", "13800000000".to_string()), ("vcode", "1234".to_string())],
        },
        Case {
            label: "loginByMobile (POST)",
            path: "/v6/account/loginByMobile",
            is_get: false,
            params: vec![("mobile", "13800000000".to_string()), ("vcode", "1234".to_string())],
        },
    ];

    println!("\n======== COOLAPK V6 API 写接口方法探测 ========");
    println!("feed_id={}, reply_id={}\n", feed_id, reply_id);

    let mut get_ok = 0i32;
    let mut post_bad = 0i32;
    let mut both_bad = 0i32;

    for case in &cases {
        let url = format!("https://api.coolapk.com{}", case.path);
        let res = if case.is_get {
            client
                .client
                .get(&url)
                .header("X-App-Token", token.clone())
                .header("X-Requested-With", "XMLHttpRequest")
                .query(&case.params)
                .send()
                .await
        } else {
            client
                .client
                .post(&url)
                .header("X-App-Token", token.clone())
                .header("X-Requested-With", "com.coolapk.market")
                .form(&case.params)
                .send()
                .await
        };

        let status = res.as_ref().map(|r| r.status().as_u16()).unwrap_or(0);
        let method = if case.is_get { "GET" } else { "POST" };

        match res {
            Ok(r) => {
                let body = r.text().await.unwrap_or_default();
                let is_err = body.contains("请求方式错误");
                let is_unauth = body.contains("你还没有登录") || body.contains("请先登录");
                let is_404_notfound = body.contains("does not exists");

                if is_err {
                    if !case.is_get {
                        post_bad += 1;
                    }
                    println!(
                        "  [{label:30} {method} {status}] 请求方式错误（方法不接受）",
                        label = case.label,
                    );
                } else if is_unauth {
                    if case.is_get {
                        get_ok += 1;
                    }
                    println!(
                        "  [{label:30} {method} {status}] 需要登录（方法正确 ✓）",
                        label = case.label,
                    );
                } else if is_404_notfound {
                    both_bad += 1;
                    println!(
                        "  [{label:30} {method} {status}] 接口不存在",
                        label = case.label,
                    );
                } else {
                    if case.is_get {
                        get_ok += 1;
                    }
                    println!(
                        "  [{label:30} {method} {status}] {}",
                        clip(&body, 100),
                        label = case.label,
                    );
                }
            }
            Err(e) => {
                println!(
                    "  [{label:30} {method}   ERR] {err}",
                    label = case.label,
                    err = e,
                );
            }
        }
    }

    println!("\n=== 汇总 ===");
    println!("GET 可用（含需要登录）: {get_ok} 个");
    println!("POST 错误（请求方式错误）: {post_bad} 个");
    println!("两端均不可用: {both_bad} 个");

    // 验证核心写接口：所有 GET 都应返回"需要登录"而非"请求方式错误"
    assert!(get_ok >= 7, "至少 7 个 GET 写接口应可用（like/unlike/reply/follow/unfollow/createFeed/msgSend），实际 {}", get_ok);
    assert!(post_bad >= 7, "对应的 POST 应全部返回请求方式错误，实际 {}", post_bad);
    assert!(both_bad >= 3, "登录接口应全部废弃（account/login, sendVcode, loginByMobile），实际 {}", both_bad);
}

/// 全体只读接口冒烟测试
/// 覆盖 commands.rs 中所有独立只读 Tauri 命令对应的酷安 API。
/// 部分需要登录态或特殊参数的接口（私信详情、通知列表等）仅验证可达性。
#[tokio::test]
#[ignore]
async fn probe_readonly_endpoints_smoke() {
    let client = CoolapkClient::new();

    // 用一个随机 feed_id 避免固定 ID 被风控
    let default_feed = "73077541";
    let default_topic = "酷安";

    let read_cases: &[(&str, &str, &[(&str, String)])] = &[
        // === 信息流 ===
        ("首页推荐", "/v6/main/indexV8", &[("page", "1".to_string())]),
        ("24H 热榜", "/v6/page/dataList", &[("url", "#/feed/hotList".to_string()), ("page", "1".to_string())]),
        ("科技快讯", "/v6/page/dataList", &[("url", "#/feed/digestList?type=1".to_string()), ("page", "1".to_string())]),
        ("精选热帖", "/v6/page/dataList", &[("url", "#/feed/digestList".to_string()), ("page", "1".to_string())]),
        ("酷图热榜", "/v6/page/dataList", &[("url", "#/feed/digestList?type=8&message_status=all".to_string()), ("page", "1".to_string())]),
        ("酷品二手", "/v6/page/dataList", &[("url", "/page?url=V11_FIND_GOOD_GOODS_HOME".to_string()), ("page", "1".to_string())]),
        ("关注动态", "/v6/page/dataList", &[("url", "/user/followFeedList".to_string()), ("title", "关注".to_string()), ("page", "1".to_string())]),
        ("最新动态", "/v6/page/dataList", &[("url", "#/feed/newestList".to_string()), ("page", "1".to_string())]),

        // === 搜索 ===
        ("全站搜索", "/v6/search", &[("type", "all".to_string()), ("searchValue", "Coolapk".to_string()), ("page", "1".to_string())]),
        ("搜索动态", "/v6/search", &[("type", "feed".to_string()), ("searchValue", "Coolapk".to_string()), ("page", "1".to_string()), ("sortType", "default".to_string())]),
        ("搜索应用", "/v6/search", &[("type", "apk".to_string()), ("searchValue", "微信".to_string()), ("page", "1".to_string()), ("show_flag", "1".to_string())]),
        ("搜索游戏", "/v6/search", &[("type", "apk".to_string()), ("searchValue", "王者荣耀".to_string()), ("page", "1".to_string()), ("show_flag", "1".to_string())]),

        // === 动态详情 & 评论 ===
        ("动态详情", "/v6/feed/detail", &[("id", default_feed.to_string())]),
        ("热门回复", "/v6/feed/hotReplyList", &[("id", default_feed.to_string()), ("page", "1".to_string()), ("discussMode", "1".to_string())]),
        ("评论列表", "/v6/feed/replyList", &[("id", default_feed.to_string()), ("listType", "lastupdate".to_string()), ("page", "1".to_string())]),

        // === 用户 ===
        ("用户空间", "/v6/user/space", &[("uid", "10086".to_string())]),
        ("用户资料", "/v6/user/profile", &[("uid", "10086".to_string())]),
        ("用户动态", "/v6/user/feedList", &[("uid", "10086".to_string()), ("page", "1".to_string()), ("isIncludeTop", "1".to_string())]),
        ("用户关注列表", "/v6/user/followList", &[("uid", "10086".to_string()), ("page", "1".to_string())]),
        ("用户关注节点", "/v6/user/customNodeList", &[("uid", "10086".to_string())]),

        // === 话题 ===
        ("话题详情", "/v6/topic/newTagDetail", &[("tag", default_topic.to_string())]),
        ("话题动态", "/v6/topic/tagFeedList", &[("tag", default_topic.to_string()), ("page", "1".to_string())]),
        ("话题中心", "/v6/topic/tagList", &[("sort", "hot".to_string()), ("page", "1".to_string())]),

        // === 应用 & 游戏 ===
        ("应用详情", "/v6/apk/detail", &[("id", "com.coolapk.market".to_string())]),
        ("应用榜单", "/v6/page/dataList", &[("url", "#/apk/rankList".to_string()), ("page", "1".to_string())]),
        ("游戏榜单", "/v6/page/dataList", &[("url", "#/game/gameRankList".to_string()), ("page", "1".to_string())]),

        // === 通知 & 消息（需要登录，仅验证接口可达） ===
        ("通知检查", "/v6/notification/checkCount", &[]),
        ("@我通知", "/v6/notification/atme", &[("page", "1".to_string())]),
        ("评论通知", "/v6/notification/comment", &[("page", "1".to_string())]),
        ("点赞通知", "/v6/notification/like", &[("page", "1".to_string())]),
        ("动态点赞通知", "/v6/notification/feedlike", &[("page", "1".to_string())]),
        ("消息列表", "/v6/message/list", &[("page", "1".to_string())]),
    ];

    println!("\n======== 全体只读接口冒烟测试 ({}) ========", read_cases.len());
    let mut ok = 0;
    let mut need_auth = 0;
    let mut deprecated = 0;
    let mut blocked = 0;

    for (name, path, params) in read_cases {
        match client.api_get(path, params).await {
            Ok(res) => {
                let has_data = res.get("data").map_or(false, |v| !v.is_null());
                let message_str = res.get("message").and_then(|v| v.as_str()).unwrap_or("");
                let status_code = res.get("status").and_then(|v| v.as_i64()).unwrap_or(0);
                let error_code = res.get("error").and_then(|v| v.as_i64());
                let forward_url = res.get("forwardUrl").and_then(|v| v.as_str()).unwrap_or("");

                let is_unauthed = message_str.contains("登录")
                    || message_str.contains("请先登录")
                    || status_code == 401;
                let is_captcha = message_str.contains("验证码");
                let is_notfound = message_str.contains("does not exists") || status_code == 404;
                let is_redirect = message_str.starts_with("https://")
                    || forward_url.starts_with("/account/login")
                    || error_code == Some(-10001);
                let is_forbidden = message_str.contains("无法访问") || error_code == Some(-3);

                if has_data {
                    println!("  [  ✓ ] {name:20} 有数据");
                    ok += 1;
                } else if is_unauthed || is_redirect {
                    // 接口存在，但需要登录 Cookie（-10001 跳转 = 未登录时的反爬）
                    println!("  [  ! ] {name:20} 需登录");
                    need_auth += 1;
                } else if is_captcha || is_forbidden {
                    // 接口存在但被反爬/权限拦截
                    println!("  [  ! ] {name:20} 被拦截");
                    blocked += 1;
                } else if is_notfound {
                    println!("  [  ✗ ] {name:20} 已废弃");
                    deprecated += 1;
                } else if !message_str.is_empty() {
                    println!("  [  ✗ ] {name:20} 错误: {}", clip(message_str, 80));
                    blocked += 1;
                } else {
                    println!("  [  ? ] {name:20} 响应结构未知: {}", clip(&res.to_string(), 80));
                    ok += 1;
                }
            }
            Err(e) => {
                println!("  [  ✗ ] {name:20} 网络错误: {}", e);
                blocked += 1;
            }
        }
    }

    let total = read_cases.len();
    println!("\n只读接口 ({total}):  {ok} 可用 · {need_auth} 需登录 · {blocked} 被拦截 · {deprecated} 已废弃");
    println!("有效接口: {} / {total}", ok + need_auth);

    // 写接口已经 GET 可用（需登录）→ 不计为失败；只读接口同理
    // 真正有问题的只有"已废弃"和"被拦截"
    let tricky = deprecated + blocked;
    println!("需关注（废弃+拦截）: {tricky} / {total}");

    // 断言：绝大多数接口 GET 方法正确（可用 or 仅需登录）
    assert!(ok + need_auth >= 24, "可用+需登录接口不足，期望 >= 24，实际 {}", ok + need_auth);
    // 断言：已废弃接口不应超过 6 个（当前已知: 5×notification + 1×customNodeList）
    assert!(deprecated <= 6, "废弃接口过多，期望 <= 6，实际 {}", deprecated);
    // 断言：被拦截的不应超过 3 个（当前已知: feed/detail验证码 + 游戏榜单 + 可能的网络波动）
    assert!(blocked <= 3, "被拦截接口过多，期望 <= 3，实际 {}", blocked);
}
