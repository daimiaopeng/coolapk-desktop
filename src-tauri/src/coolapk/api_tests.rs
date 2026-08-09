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
    let token = client.get_token().unwrap();

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
            label: "addToBlackList (GET)",
            path: "/v6/user/addToBlackList",
            is_get: true,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "addToBlackList (POST)",
            path: "/v6/user/addToBlackList",
            is_get: false,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "removeFromBlackList (GET)",
            path: "/v6/user/removeFromBlackList",
            is_get: true,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "removeFromBlackList (POST)",
            path: "/v6/user/removeFromBlackList",
            is_get: false,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "addToIgnoreList (GET)",
            path: "/v6/user/addToIgnoreList",
            is_get: true,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "addToIgnoreList (POST)",
            path: "/v6/user/addToIgnoreList",
            is_get: false,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "removeFromIgnoreList (GET)",
            path: "/v6/user/removeFromIgnoreList",
            is_get: true,
            params: vec![("uid", "1".to_string())],
        },
        Case {
            label: "removeFromIgnoreList (POST)",
            path: "/v6/user/removeFromIgnoreList",
            is_get: false,
            params: vec![("uid", "1".to_string())],
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

/// 覆盖「在线文档收集到的全部酷安 API」的完整探测。
///
/// 数据来源: https://github.com/Coolapk-UWP/Coolapk-API-Collect (酷安-API收集整理)
/// 本测试逐条请求所有已文档化端点（含项目尚未接入的新端点），
/// 用于验证每个端点当前是否仍然可用，并输出分类汇总。
#[tokio::test]
#[ignore]
async fn probe_all_documented_endpoints_from_collect() {
    let client = CoolapkClient::new();

    let cases: &[(&str, &str, &[(&str, String)])] = &[
        // === 主页 (主页内容 V8 / Tab 内容) ===
        ("主页V8", "/v6/main/indexV8", &[("page", "1".to_string())]),
        ("Tab内容", "/v6/main/init", &[]),
        ("主页V7", "/v6/main/index", &[("page", "1".to_string())]),
        ("应用游戏V7", "/v6/apk/index", &[("apkType", "1".to_string()), ("page", "1".to_string())]),

        // === 主页 V7 系列（应用集/排行/分类/应用吧/发现/酷图/话题）===
        ("应用集V7", "/album/index", &[("page", "1".to_string())]),
        ("排行V7", "/apk/realRankList", &[("page", "1".to_string())]),
        ("分类V7", "/apk/categoryList", &[("page", "1".to_string())]),
        ("应用吧V7", "/appForum/list", &[("type", "default".to_string()), ("page", "1".to_string())]),
        ("发现频道V7", "/discovery/index", &[("page", "1".to_string())]),
        ("酷图V7", "/picture/list", &[("page", "1".to_string())]),
        ("应用圈V7", "/topic/feedList", &[("type", "all".to_string()), ("page", "1".to_string())]),
        ("全站V7", "/topic/recentFeedList", &[("page", "1".to_string())]),
        ("热门V7", "/topic/hotFeedList", &[("page", "1".to_string())]),

        // === 搜索 ===
        ("搜索候选", "/v6/search/suggestSearchWordsNew", &[("searchValue", "酷安".to_string())]),
        ("全站搜索", "/v6/search", &[("type", "all".to_string()), ("searchValue", "Coolapk".to_string()), ("page", "1".to_string()), ("show_flag", "1".to_string())]),
        ("搜索应用", "/v6/search", &[("type", "apk".to_string()), ("searchValue", "微信".to_string()), ("page", "1".to_string()), ("show_flag", "1".to_string())]),
        ("搜索话题", "/v6/search", &[("type", "topic".to_string()), ("searchValue", "酷安".to_string()), ("page", "1".to_string()), ("show_flag", "1".to_string())]),

        // === 动态详情 & 评论 ===
        ("动态详情", "/v6/feed/detail", &[("id", "73077541".to_string())]),
        ("热门回复", "/v6/feed/hotReplyList", &[("id", "73077541".to_string()), ("page", "1".to_string()), ("discussMode", "1".to_string())]),
        ("评论列表", "/v6/feed/replyList", &[("id", "73077541".to_string()), ("listType", "lastupdate".to_string()), ("page", "1".to_string())]),

        // === 用户 ===
        ("用户空间", "/v6/user/space", &[("uid", "10086".to_string())]),
        ("用户资料", "/v6/user/profile", &[("uid", "10086".to_string())]),
        ("用户动态", "/v6/user/feedList", &[("uid", "10086".to_string()), ("page", "1".to_string()), ("isIncludeTop", "1".to_string())]),
        ("用户关注列表", "/v6/user/followList", &[("uid", "10086".to_string()), ("page", "1".to_string())]),
        ("我的卡片配置", "/v6/account/loadConfig", &[("key", "my_page_card_config".to_string())]),
        ("检查登录", "/v6/account/checkLoginInfo", &[]),

        // === 话题 ===
        ("话题详情", "/v6/topic/newTagDetail", &[("tag", "酷安".to_string())]),
        ("话题详情旧版", "/v6/topic/tagDetail", &[("tag", "酷安".to_string())]),
        ("话题动态", "/v6/topic/tagFeedList", &[("tag", "酷安".to_string()), ("page", "1".to_string())]),
        ("话题中心", "/v6/topic/tagList", &[("sort", "hot".to_string()), ("page", "1".to_string())]),

        // === 应用 & 游戏 ===
        ("应用详情", "/v6/apk/detail", &[("id", "com.coolapk.market".to_string())]),
        ("应用榜单", "/v6/page/dataList", &[("url", "#/apk/rankList".to_string()), ("page", "1".to_string())]),
        ("应用所属动态", "/v6/page/dataList", &[("url", "#/feed/apkCommentList".to_string()), ("id", "com.coolapk.market".to_string()), ("page", "1".to_string())]),

        // === 数码 (产品) ===
        ("产品详情", "/v6/product/detail", &[("id", "5573".to_string())]),
        ("产品所属动态", "/v6/page/dataList", &[("url", "/page?url=/product/feedList".to_string()), ("id", "5573".to_string()), ("type", "feed".to_string()), ("page", "1".to_string())]),

        // === 看看号 ===
        ("看看号详情", "/v6/dyh/detail", &[("dyhId", "1429".to_string())]),
        ("看看号动态", "/v6/dyhArticle/list", &[("dyhId", "1429".to_string()), ("type", "all".to_string()), ("page", "1".to_string())]),

        // === 通知 & 消息（需要登录，仅验证可达性） ===
        ("通知检查", "/v6/notification/checkCount", &[]),
        ("@我通知", "/v6/notification/atme", &[("page", "1".to_string())]),
        ("消息列表", "/v6/message/list", &[("page", "1".to_string())]),
    ];

    println!("\n======== 在线文档收集的全部酷安 API 探测 ({}) ========", cases.len());
    let mut ok = 0;
    let mut need_auth = 0;
    let mut deprecated = 0;
    let mut blocked = 0;

    for (name, path, params) in cases {
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
                let is_deprecated_msg = message_str == "API unsupported." || message_str.contains("已下线");

                if has_data {
                    let count = res
                        .get("data")
                        .and_then(|v| v.as_array())
                        .map(|a| a.len())
                        .unwrap_or(1);
                    println!("  [  ✓ ] {name:24} 有数据 ({count} 条)");
                    ok += 1;
                } else if is_deprecated_msg {
                    println!("  [  ✗ ] {name:24} 已废弃 (API unsupported)");
                    deprecated += 1;
                } else if is_unauthed || is_redirect {
                    println!("  [  ! ] {name:24} 需登录");
                    need_auth += 1;
                } else if is_captcha || is_forbidden {
                    println!("  [  ! ] {name:24} 被拦截");
                    blocked += 1;
                } else if is_notfound {
                    println!("  [  ✗ ] {name:24} 已废弃");
                    deprecated += 1;
                } else if !message_str.is_empty() {
                    println!("  [  ✗ ] {name:24} 错误: {}", clip(message_str, 70));
                    blocked += 1;
                } else {
                    println!("  [  ? ] {name:24} 响应结构未知: {}", clip(&res.to_string(), 70));
                    ok += 1;
                }
            }
            Err(e) => {
                println!("  [  ✗ ] {name:24} 网络错误: {}", e);
                blocked += 1;
            }
        }
    }

    let total = cases.len();
    println!("\n全部文档化 API ({total}):  {ok} 可用 · {need_auth} 需登录 · {blocked} 被拦截 · {deprecated} 已废弃");
    println!("有效接口: {} / {total}", ok + need_auth);
    assert!(ok + need_auth >= 27, "有效接口不足，期望 >= 27，实际 {}", ok + need_auth);
    assert!(deprecated <= 11, "废弃接口过多，期望 <= 11，实际 {}", deprecated);
    assert!(blocked <= 3, "被拦截接口过多，期望 <= 3，实际 {}", blocked);
}

/// 补充探测：项目中未覆盖但在线文档收集到的 API 端点（含 V8 页面、用户子类型、各类通知等）。
/// 本测试逐条探测额外端点并输出分类汇总。
#[tokio::test]
#[ignore]
async fn probe_extra_endpoints_from_web() {
    let client = CoolapkClient::new();

    #[allow(clippy::type_complexity)]
    let cases: &[(&str, &str, &[(&str, String)])] = &[
        // === V8 页面端点 (通过 /v6/page/dataList 访问) ===
        ("V8关注页", "/v6/page/dataList", &[("url", "V9_HOME_TAB_FOLLOW".to_string()), ("page", "1".to_string())]),
        ("V8热榜页", "/v6/page/dataList", &[("url", "V9_HOME_TAB_RANKING".to_string()), ("page", "1".to_string())]),
        ("V8快讯页", "/v6/page/dataList", &[("url", "V11_HOME_TAB_NEWS".to_string()), ("page", "1".to_string())]),
        ("V8闲聊页", "/v6/page/dataList", &[("url", "V8_HUODONG_XIANLIAO_20210523".to_string()), ("page", "1".to_string())]),
        ("V8话题页", "/v6/page/dataList", &[("url", "V9_HOME_TAB_TOPIC".to_string()), ("page", "1".to_string())]),
        ("V8新机页", "/v6/page/dataList", &[("url", "V11_HOME_NEW".to_string()), ("page", "1".to_string())]),
        ("V8开箱页", "/v6/page/dataList", &[("url", "V13_IOSHOME_OPENSHOW".to_string()), ("page", "1".to_string())]),
        ("V8摄影页", "/v6/page/dataList", &[("url", "V13_HOME_SHEYING".to_string()), ("page", "1".to_string())]),
        ("V8教程页", "/v6/page/dataList", &[("url", "V11_HOME_TABJC".to_string()), ("page", "1".to_string())]),
        ("V8汽车页", "/v6/page/dataList", &[("url", "V11_HOME_CAR".to_string()), ("page", "1".to_string())]),
        ("V8外设页", "/v6/page/dataList", &[("url", "V14_WAISHE".to_string()), ("page", "1".to_string())]),
        ("V8视频页", "/v6/page/dataList", &[("url", "V9_HOME_TAB_SHIPIN".to_string()), ("page", "1".to_string())]),
        ("V8问答页", "/v6/page/dataList", &[("url", "V9_HOME_TAB_WENDA".to_string()), ("page", "1".to_string())]),
        ("V8美化页", "/v6/page/dataList", &[("url", "V11_HOME_MEIHUA".to_string()), ("page", "1".to_string())]),
        ("V8酷图页", "/v6/page/dataList", &[("url", "V11_FIND_COOLPIC".to_string()), ("page", "1".to_string())]),
        ("V8酷品页", "/v6/page/dataList", &[("url", "V11_FIND_GOODS".to_string()), ("page", "1".to_string())]),
        ("V8热议页", "/v6/page/dataList", &[("url", "V8_ZHUANTI_HOT_20201215".to_string()), ("page", "1".to_string())]),
        ("V8二手页", "/v6/page/dataList", &[("url", "V11_DISCOVERY_SECOND_HAND".to_string()), ("page", "1".to_string())]),
        ("V8评分页", "/v6/page/dataList", &[("url", "V13_PINGFEN".to_string()), ("page", "1".to_string())]),
        ("V8数码首页", "/v6/page/dataList", &[("url", "V10_DIGITAL_HOME".to_string()), ("page", "1".to_string())]),
        ("V8手机页", "/v6/page/dataList", &[("url", "V10_CHANNEL_SJB".to_string()), ("page", "1".to_string())]),
        ("V8电脑页", "/v6/page/dataList", &[("url", "V8_ZHUANTI_COMPUTER_20230413".to_string()), ("page", "1".to_string())]),
        ("V8耳机页", "/v6/page/dataList", &[("url", "V11_ZHUANTI_EARPHONE".to_string()), ("page", "1".to_string())]),
        ("V8排行页", "/v6/page/dataList", &[("url", "V10_CHANNEL_SMB_TOP".to_string()), ("page", "1".to_string())]),
        ("V8ROM页", "/v6/page/dataList", &[("url", "V13_DIGITAL_ROM".to_string()), ("page", "1".to_string())]),
        ("V8应用集页", "/v6/page/dataList", &[("url", "V8_MARKET_ALBUM".to_string()), ("page", "1".to_string())]),
        ("V8应用排行页", "/v6/page/dataList", &[("url", "V10_MARKET_RANK".to_string()), ("page", "1".to_string())]),
        ("V8好物榜页", "/v6/page/dataList", &[("url", "V12_HOME_KUBANG".to_string()), ("page", "1".to_string())]),
        ("V8市场首页", "/v6/page/dataList", &[("url", "V10_MARKET_HOME".to_string()), ("page", "1".to_string())]),
        ("V8应用页", "/v6/page/dataList", &[("url", "V8_MARKET_APP".to_string()), ("page", "1".to_string())]),
        ("V8游戏页", "/v6/page/dataList", &[("url", "V8_MARKET_GAME".to_string()), ("page", "1".to_string())]),
        ("V8直播页", "/v6/page/dataList", &[("url", "V9_HOME_TAB_LIVE".to_string()), ("page", "1".to_string())]),

        // === 用户子类型端点 ===
        ("用户酷图动态", "/v6/user/pictureList", &[("uid", "10086".to_string()), ("page", "1".to_string())]),
        ("用户评论列表", "/v6/user/replyList", &[("uid", "10086".to_string()), ("page", "1".to_string())]),
        ("用户评分列表", "/v6/user/apkRatingList", &[("uid", "10086".to_string()), ("page", "1".to_string())]),
        ("用户二手列表", "/v6/user/ershouList", &[("uid", "10086".to_string()), ("page", "1".to_string())]),
        ("用户收藏列表", "/v6/user/favList", &[("uid", "10086".to_string()), ("page", "1".to_string())]),

        // === 搜索补充 ===
        ("搜索动态带排序", "/v6/search", &[("type", "feed".to_string()), ("searchValue", "手机".to_string()), ("page", "1".to_string()), ("sortType", "default".to_string())]),
        ("搜索游戏专项", "/v6/search", &[("type", "game".to_string()), ("searchValue", "王者荣耀".to_string()), ("page", "1".to_string()), ("show_flag", "1".to_string())]),

        // === 通知/消息补充 ===
        ("评论通知", "/v6/notification/comment", &[("page", "1".to_string())]),
        ("点赞通知", "/v6/notification/like", &[("page", "1".to_string())]),
        ("动态点赞通知", "/v6/notification/feedlike", &[("page", "1".to_string())]),

        // === 关注动态专用端点 ===
        ("关注动态V6", "/v6/feed/followFeedList", &[("page", "1".to_string())]),

        // === 主页V8带类型 ===
        ("主页V8关注", "/v6/main/indexV8", &[("type", "follow".to_string()), ("page", "1".to_string())]),
        ("主页V8话题", "/v6/main/indexV8", &[("type", "topic".to_string()), ("page", "1".to_string())]),

        // === 数码产品类别 ===
        ("产品问答", "/v6/page/dataList", &[("url", "/page?url=/product/feedList".to_string()), ("id", "5573".to_string()), ("type", "answer".to_string()), ("page", "1".to_string())]),
        ("产品视频", "/v6/page/dataList", &[("url", "/page?url=/product/feedList".to_string()), ("id", "5573".to_string()), ("type", "video".to_string()), ("page", "1".to_string())]),
        ("产品图文", "/v6/page/dataList", &[("url", "/page?url=/product/feedList".to_string()), ("id", "5573".to_string()), ("type", "article".to_string()), ("page", "1".to_string())]),

        // === 应用评论列表（不同排序） ===
        ("应用讨论(最新)", "/v6/page/dataList", &[("url", "#/feed/apkCommentList".to_string()), ("id", "com.coolapk.market".to_string()), ("sort", "lastupdate_desc".to_string()), ("page", "1".to_string())]),
        ("应用讨论(最热)", "/v6/page/dataList", &[("url", "#/feed/apkCommentList".to_string()), ("id", "com.coolapk.market".to_string()), ("sort", "popular".to_string()), ("page", "1".to_string())]),

        // === 看看号分类 ===
        ("看看号广场", "/v6/dyhArticle/list", &[("dyhId", "1429".to_string()), ("type", "square".to_string()), ("page", "1".to_string())]),

        // === 话题中心不同排序 ===
        ("话题中心(最热)", "/v6/topic/tagList", &[("sort", "hot".to_string()), ("page", "1".to_string())]),
        ("话题中心(最新)", "/v6/topic/tagList", &[("sort", "new".to_string()), ("page", "1".to_string())]),
        ("话题中心(关注)", "/v6/topic/tagList", &[("sort", "follow".to_string()), ("page", "1".to_string())]),

        // === account/loadConfig 不同 key ===
        ("加载配置(我的卡片)", "/v6/account/loadConfig", &[("key", "my_page_card_config".to_string())]),

        // === 搜索补充类型 ===
        ("搜索用户", "/v6/search", &[("type", "user".to_string()), ("searchValue", "酷安小编".to_string()), ("page", "1".to_string()), ("show_flag", "1".to_string())]),

        // === 24H热榜备用端点 ===
        ("热榜备用VRank", "/v6/page/dataList", &[("url", "#/feed/statHotList?period=24h".to_string()), ("page", "1".to_string())]),
        ("热榜备用WRank", "/v6/page/dataList", &[("url", "#/feed/statHotList?period=7d".to_string()), ("page", "1".to_string())]),
    ];

    println!("\n======== 补充额外 API 端点探测 ({}) ========", cases.len());
    let mut ok = 0;
    let mut need_auth = 0;
    let mut deprecated = 0;
    let mut blocked = 0;
    for (name, path, params) in cases {
        match client.api_get(path, params).await {
            Ok(res) => {
                let has_data = res.get("data").map_or(false, |v| !v.is_null());
                let data_empty = res.get("data").and_then(|v| v.as_array()).map_or(true, |a| a.is_empty());
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
                let is_deprecated_msg = message_str == "API unsupported." || message_str.contains("已下线");

                if has_data && !data_empty {
                    let count = res
                        .get("data")
                        .and_then(|v| v.as_array())
                        .map(|a| a.len())
                        .unwrap_or(1);
                    println!("  [  ✓ ] {name:28} 有数据 ({count} 条)");
                    ok += 1;
                } else if has_data && data_empty {
                    println!("  [  ○ ] {name:28} 有响应但无数据");
                    ok += 1;
                } else if is_deprecated_msg {
                    println!("  [  ✗ ] {name:28} 已废弃 (API unsupported)");
                    deprecated += 1;
                } else if is_unauthed || is_redirect {
                    println!("  [  ! ] {name:28} 需登录");
                    need_auth += 1;
                } else if is_captcha || is_forbidden {
                    println!("  [  ! ] {name:28} 被拦截");
                    blocked += 1;
                } else if is_notfound {
                    println!("  [  ✗ ] {name:28} 已废弃");
                    deprecated += 1;
                } else if !message_str.is_empty() {
                    println!("  [  ✗ ] {name:28} 错误: {}", clip(message_str, 60));
                    blocked += 1;
                } else {
                    println!("  [  ? ] {name:28} 响应结构未知: {}", clip(&res.to_string(), 60));
                    ok += 1;
                }
            }
            Err(e) => {
                println!("  [  ✗ ] {name:28} 网络错误: {}", e);
                blocked += 1;
            }
        }
    }

    let total = cases.len();
    println!("\n补充API ({total}):  {ok} 可用 · {need_auth} 需登录 · {blocked} 被拦截 · {deprecated} 已废弃");
    println!("有效接口: {} / {total}", ok + need_auth);
}

/// 探测项目尚未接入但在线文档中出现的更多API端点
/// 包含 /v6/page 直连 V8 页面、Api2 路由、以及更多搜索/动态类型端点
#[tokio::test]
#[ignore]
async fn probe_more_endpoints_deep() {
    let client = CoolapkClient::new();
    let token = client.get_token().unwrap();

    #[allow(clippy::type_complexity)]
    let cases: &[(&str, &str, &[(&str, String)])] = &[
        // === /v6/page 直连 V8 页面 (不使用 /dataList) ===
        ("V8 直连-头条页", "/v6/page", &[("url", "V9_HOME_TAB_HEADLINE".to_string()), ("page", "1".to_string())]),
        ("V8 直连-关注页", "/v6/page", &[("url", "V9_HOME_TAB_FOLLOW".to_string()), ("page", "1".to_string())]),
        ("V8 直连-热榜页", "/v6/page", &[("url", "V9_HOME_TAB_RANKING".to_string()), ("page", "1".to_string())]),
        ("V8 直连-快讯页", "/v6/page", &[("url", "V11_HOME_TAB_NEWS".to_string()), ("page", "1".to_string())]),
        ("V8 直连-关注分组(circle)", "/v6/page", &[("url", "V9_HOME_TAB_FOLLOW".to_string()), ("type", "circle".to_string()), ("page", "1".to_string())]),
        ("V8 直连-关注分组(apk)", "/v6/page", &[("url", "V9_HOME_TAB_FOLLOW".to_string()), ("type", "apk".to_string()), ("page", "1".to_string())]),
        ("V8 直连-关注分组(topic)", "/v6/page", &[("url", "V9_HOME_TAB_FOLLOW".to_string()), ("type", "topic".to_string()), ("page", "1".to_string())]),
        ("V8 直连-关注分组(product)", "/v6/page", &[("url", "V9_HOME_TAB_FOLLOW".to_string()), ("type", "product".to_string()), ("page", "1".to_string())]),
        ("V8 直连-关注分组(question)", "/v6/page", &[("url", "V9_HOME_TAB_FOLLOW".to_string()), ("type", "question".to_string()), ("page", "1".to_string())]),
        ("V8 直连-数码库", "/v6/page", &[("url", "V11_DIGITAL_PRODUCT_LIST".to_string()), ("page", "1".to_string())]),

        // === api2.coolapk.com 路由（Tab初始化中 Api2.List2 公布的特殊路由） ===
        // 这些端点对 api.coolapk.com 也可用，但 api2 可能是效率优化的专用路由主机
        ("首页推荐(api2)", "/v6/main/indexV8", &[("page", "1".to_string())]),
        ("评论列表(api2)", "/v6/feed/replyList", &[("id", "73077541".to_string()), ("listType", "lastupdate".to_string()), ("page", "1".to_string())]),
        ("用户资料(api2)", "/v6/user/profile", &[("uid", "10086".to_string())]),
        ("动态详情(api2)", "/v6/feed/detail", &[("id", "73077541".to_string())]),

        // === 游戏索引 V7 ===
        ("游戏索引V7", "/v6/apk/index", &[("apkType", "2".to_string()), ("page", "1".to_string())]),

        // === 搜索补充类型 ===
        ("搜索动态按时间", "/v6/search", &[("type", "feed".to_string()), ("searchValue", "手机".to_string()), ("page", "1".to_string()), ("sortType", "dateline_desc".to_string())]),
        ("搜索动态按热度", "/v6/search", &[("type", "feed".to_string()), ("searchValue", "手机".to_string()), ("page", "1".to_string()), ("sortType", "popular".to_string())]),
        ("搜索游戏不限制", "/v6/search", &[("type", "game".to_string()), ("searchValue", "王者".to_string()), ("page", "1".to_string())]),

        // === 看看号 V11_FIND_DYH ===
        ("看看号发现", "/v6/page/dataList", &[("url", "/user/dyhSubscribe".to_string()), ("page", "1".to_string())]),

        // === 数码库 V11_DIGITAL_PRODUCT_LIST ===
        ("数码库产品列表", "/v6/page/dataList", &[("url", "/product/categoryList".to_string()), ("page", "1".to_string())]),

        // === user/feedList 包含置顶参数 ===
        ("用户动态含置顶", "/v6/user/feedList", &[("uid", "10086".to_string()), ("page", "1".to_string()), ("isIncludeTop", "1".to_string())]),

        // === 动态详情不同 feed_id ===
        ("动态详情2", "/v6/feed/detail", &[("id", "58250633".to_string())]),

        // === replyList 不同 listType ===
        ("评论(热门排序)", "/v6/feed/replyList", &[("id", "73077541".to_string()), ("listType", "popular".to_string()), ("page", "1".to_string())]),
        ("评论(时间排序)", "/v6/feed/replyList", &[("id", "73077541".to_string()), ("listType", "dateline_desc".to_string()), ("page", "1".to_string())]),

        // === 话题搜索 ===
        ("搜索话题MIUI", "/v6/search", &[("type", "topic".to_string()), ("searchValue", "MIUI".to_string()), ("page", "1".to_string()), ("show_flag", "1".to_string())]),
    ];

    println!("\n======== 深度探测更多 API 端点 ({}) ========", cases.len());
    let mut ok = 0;
    let mut need_auth = 0;
    let mut deprecated = 0;
    let mut blocked = 0;

    for (name, path, params) in cases {
        // 对于 api2 端点，我们仍请求 api.coolapk.com (因为 api2 是智能路由别名)
        let url = format!("https://api.coolapk.com{path}");
        let res = client
            .client
            .get(&url)
            .header("X-App-Token", token.clone())
            .header("X-Requested-With", "XMLHttpRequest")
            .query(params)
            .send()
            .await;

        match res {
            Ok(r) => {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                if !status.is_success() {
                    println!("  [  ✗ ] {name:28} HTTP {status}: {}", clip(&body, 60));
                    blocked += 1;
                    continue;
                }
                let json: serde_json::Value = match serde_json::from_str(&body) {
                    Ok(v) => v,
                    Err(e) => {
                        println!("  [  ✗ ] {name:28} JSON解析失败: {} - {}", e, clip(&body, 40));
                        blocked += 1;
                        continue;
                    }
                };
                let has_data = json.get("data").map_or(false, |v| !v.is_null());
                let data_empty = json.get("data").and_then(|v| v.as_array()).map_or(true, |a| a.is_empty());
                let message_str = json.get("message").and_then(|v| v.as_str()).unwrap_or("");
                let status_code = json.get("status").and_then(|v| v.as_i64()).unwrap_or(0);
                let forward_url = json.get("forwardUrl").and_then(|v| v.as_str()).unwrap_or("");
                let error_code = json.get("error").and_then(|v| v.as_i64());

                let is_unauthed = message_str.contains("登录") || status_code == 401;
                let is_captcha = message_str.contains("验证码");
                let is_notfound = message_str.contains("does not exists") || status_code == 404;
                let is_redirect = message_str.starts_with("https://")
                    || forward_url.starts_with("/account/login")
                    || error_code == Some(-10001);
                let is_forbidden = message_str.contains("无法访问") || error_code == Some(-3);
                let is_deprecated_msg = message_str == "API unsupported." || message_str.contains("已下线");

                if has_data && !data_empty {
                    let count = json.get("data").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(1);
                    println!("  [  ✓ ] {name:28} 有数据 ({count} 条)");
                    ok += 1;
                } else if has_data && data_empty {
                    println!("  [  ○ ] {name:28} 有响应但无数据");
                    ok += 1;
                } else if is_deprecated_msg {
                    println!("  [  ✗ ] {name:28} 已废弃");
                    deprecated += 1;
                } else if is_unauthed || is_redirect {
                    println!("  [  ! ] {name:28} 需登录");
                    need_auth += 1;
                } else if is_captcha || is_forbidden {
                    println!("  [  ! ] {name:28} 被拦截");
                    blocked += 1;
                } else if is_notfound {
                    println!("  [  ✗ ] {name:28} 已废弃");
                    deprecated += 1;
                } else if !message_str.is_empty() {
                    println!("  [  ✗ ] {name:28} 错误: {}", clip(message_str, 50));
                    blocked += 1;
                } else {
                    println!("  [  ? ] {name:28} 响应结构未知: {}", clip(&json.to_string(), 50));
                    ok += 1;
                }
            }
            Err(e) => {
                println!("  [  ✗ ] {name:28} 网络错误: {}", e);
                blocked += 1;
            }
        }
    }

    let total = cases.len();
    println!("\n深度API ({total}):  {ok} 可用 · {need_auth} 需登录 · {blocked} 被拦截 · {deprecated} 已废弃");
    println!("有效接口: {} / {total}", ok + need_auth);
}

/// 探测 api2.coolapk.com 专用路由主机及静态资源端点
/// 数据来源：/v6/main/init 返回的 Api2.List/Api2.List2/PushHost
#[tokio::test]
#[ignore]
async fn probe_api2_and_static_endpoints() {
    let client = CoolapkClient::new();
    let token = client.get_token().unwrap();

    // === api2.coolapk.com 专用路由 ===
    // Tab 初始化数据中 Api2.List2 指定这些端点走 api2路由
    let api2_cases: &[(&str, &str, &[(&str, String)])] = &[
        ("api2-用户资料", "/v6/user/profile", &[("uid", "10086".to_string())]),
        ("api2-评论列表", "/v6/feed/replyList", &[("id", "73077541".to_string()), ("listType", "lastupdate".to_string()), ("page", "1".to_string())]),
        ("api2-动态详情", "/v6/feed/detail", &[("id", "73077541".to_string())]),
        ("api2-首页推荐", "/v6/main/indexV8", &[("page", "1".to_string())]),
        ("api2-检查登录", "/v6/account/checkLoginInfo", &[]),
    ];

    println!("\n======== api2.coolapk.com 路由探测 ({}) ========", api2_cases.len());
    let mut api2_ok = 0;
    let mut api2_tauth = 0;
    let mut api2_blocked = 0;

    for (name, path, params) in api2_cases {
        let url = format!("https://api2.coolapk.com{path}");
        let res = client
            .client
            .get(&url)
            .header("X-App-Token", token.clone())
            .header("X-Requested-With", "XMLHttpRequest")
            .query(params)
            .send()
            .await;

        match res {
            Ok(r) => {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                if !status.is_success() {
                    println!("  [  ✗ ] {name:28} HTTP {status}: {}", clip(&body, 60));
                    api2_blocked += 1;
                    continue;
                }
                match serde_json::from_str::<Value>(&body) {
                    Ok(json) => {
                        let has_data = json.get("data").map_or(false, |v| !v.is_null());
                        let msg = json.get("message").and_then(|v| v.as_str()).unwrap_or("");
                        if has_data {
                            println!("  [  ✓ ] {name:28} 有数据");
                            api2_ok += 1;
                        } else if msg.contains("登录") {
                            println!("  [  ! ] {name:28} 需登录");
                            api2_tauth += 1;
                        } else {
                            println!("  [  ? ] {name:28} {} ", clip(msg, 50));
                            api2_blocked += 1;
                        }
                    }
                    Err(e) => {
                        println!("  [  ✗ ] {name:28} JSON错误: {} - {}", e, clip(&body, 40));
                        api2_blocked += 1;
                    }
                }
            }
            Err(e) => {
                println!("  [  ✗ ] {name:28} 网络错误: {}", e);
                api2_blocked += 1;
            }
        }
    }

    let api2_total = api2_cases.len();
    println!("\napi2 ({api2_total}):  {api2_ok} 可用 · {api2_tauth} 需登录 · {api2_blocked} 被拦截");

    // === 静态/资源端点 ===
    println!("\n======== 静态资源探测 ========");
    let static_urls = &[
        ("avatar.coolapk.com", "http://avatar.coolapk.com/data/000/53/63/81_avatar_middle.jpg"),
        ("image.coolapk.com", "http://image.coolapk.com/feed/2024/0911/23/536381_4121ebe2_9881_0688_971@1080x2160.jpeg"),
        ("static.coolapk.com", "https://static.coolapk.com/hotfix/v11/videoParser_2012040.jar"),
    ];

    for (label, url) in static_urls {
        let res = client
            .client
            .get(*url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            .send()
            .await;
        match res {
            Ok(r) => {
                let status = r.status();
                let ct = r.headers().get("content-type").and_then(|v| v.to_str().ok()).unwrap_or("unknown");
                if status.is_success() {
                    println!("  [  ✓ ] {label:28} HTTP {status} ({ct})");
                } else {
                    println!("  [  ✗ ] {label:28} HTTP {status}");
                }
            }
            Err(e) => println!("  [  ✗ ] {label:28} 网络错误: {}", e),
        }
    }

    // === 登录相关端点(GET方式探测，确认接口是否存在) ===
    println!("\n======== 登录/账号补充探测 ========");
    let auth_cases: &[(&str, &str, &[(&str, String)])] = &[
        ("检查登录信息", "/v6/account/checkLoginInfo", &[]),
        ("加载配置", "/v6/account/loadConfig", &[("key", "my_page_card_config".to_string())]),
    ];

    for (name, path, params) in auth_cases {
        let res = client.api_get(path, params).await;
        match res {
            Ok(json) => {
                let has_data = json.get("data").map_or(false, |v| !v.is_null());
                let msg = json.get("message").and_then(|v| v.as_str()).unwrap_or("");
                if has_data {
                    println!("  [  ✓ ] {name:28} 有数据");
                } else if msg.contains("登录") {
                    println!("  [  ! ] {name:28} 需登录 (接口存在)");
                } else {
                    println!("  [  ? ] {name:28} {}", clip(msg, 50));
                }
            }
            Err(e) => println!("  [  ✗ ] {name:28} 错误: {}", e),
        }
    }
}

/// 探测从 Coolapk-kotlin / CoolApk-UWP 等开源项目中发现的额外端点
/// 包括：设备管理、应用下载、专辑、收藏、发现、头条、图片等
#[tokio::test]
#[ignore]
async fn probe_undocumented_endpoints() {
    let client = CoolapkClient::new();
    let token = client.get_token().unwrap();

    #[allow(clippy::type_complexity)]
    let cases: &[(&str, &str, &[(&str, String)])] = &[
        // === 设备/系统 ===
        ("设备IP", "/v6/device/ip", &[]),
        ("云安装任务", "/v6/cloudInstall/task", &[("id", "1".to_string())]),

        // === 应用下载/更新 ===
        ("下载链接", "/v6/apk/url", &[("id", "com.coolapk.market".to_string())]),
        ("下载版本列表", "/v6/apk/downloadVersionList", &[("id", "com.coolapk.market".to_string())]),
        ("APK二维码", "/v6/apk/qr", &[("id", "com.coolapk.market".to_string())]),
        ("应用发现者", "/v6/apk/discovererList", &[("id", "com.coolapk.market".to_string()), ("page", "1".to_string())]),
        ("推荐应用", "/v6/apk/recommendList", &[("apkType", "1".to_string()), ("title", "推荐".to_string()), ("page", "1".to_string())]),

        // === 黑名单/忽略/限制 ===
        ("黑名单列表", "/v6/user/blackList", &[("page", "1".to_string())]),
        ("忽略列表", "/v6/user/ignoreList", &[("page", "1".to_string())]),
        ("限制列表", "/v6/user/limitList", &[("page", "1".to_string())]),

        // === 收藏管理 ===
        ("收藏列表", "/v6/favorite/list", &[("type", "feed".to_string()), ("page", "1".to_string())]),
        ("收藏应用列表", "/v6/favorite/list", &[("type", "apk".to_string()), ("page", "1".to_string())]),

        // === 专辑（应用集） ===
        ("应用集详情", "/v6/album/detail", &[("id", "1".to_string())]),
        ("应用集列表", "/v6/album/list", &[("page", "1".to_string()), ("listType", "hot".to_string())]),
        ("应用集搜索", "/v6/album/search", &[("q", "工具".to_string()), ("page", "1".to_string())]),
        ("应用集评论", "/v6/album/replyList", &[("id", "1".to_string()), ("page", "1".to_string())]),

        // === 头条 ===
        ("头条列表", "/v6/main/headline", &[("page", "1".to_string())]),
        ("头条数量", "/v6/main/checkHeadlineCount", &[("firstItem", "0".to_string())]),
        ("更新列表", "/v6/main/updateList", &[("page", "1".to_string())]),

        // === 编辑精选 ===
        ("编辑精选", "/v6/feed/editorChoiceList", &[("page", "1".to_string())]),

        // === 用户子类型 ===
        ("用户发现", "/v6/user/discoveryList", &[("uid", "10086".to_string()), ("page", "1".to_string())]),
        ("用户应用集", "/v6/user/albumlist", &[("uid", "10086".to_string()), ("page", "1".to_string())]),
        ("用户关注应用", "/v6/user/apkFollowList", &[("uid", "10086".to_string()), ("page", "1".to_string())]),

        // === 图片 ===
        ("用户图片", "/v6/picture/userPictures", &[("uid", "10086".to_string()), ("page", "1".to_string())]),
        ("图片列表(标签)", "/v6/picture/list", &[("tag", "手机".to_string()), ("page", "1".to_string())]),

        // === APK搜索(开发者) ===
        ("搜索开发者", "/v6/apk/search", &[("searchType", "developer".to_string()), ("developer", "腾讯".to_string()), ("page", "1".to_string())]),
        ("搜索标签", "/v6/apk/search", &[("searchType", "tag".to_string()), ("tag", "社交".to_string()), ("apkType", "1".to_string()), ("page", "1".to_string())]),

        // === OAuth ===
        ("访问令牌", "/v6/account/accessToken", &[("code", "test".to_string())]),

        // === 礼品 ===
        ("应用礼品", "/v6/apk/giftList", &[("apkId", "com.coolapk.market".to_string()), ("page", "1".to_string())]),
        ("全局礼品", "/v6/apk/giftList", &[("page", "1".to_string())]),

        // === 应用更新检查 ===
        ("检查更新", "/v6/apk/checkUpdate", &[("pkgs", "com.coolapk.market".to_string())]),
    ];

    println!("\n======== 未文档化/额外端点探测 ({}) ========", cases.len());
    let mut ok = 0;
    let mut need_auth = 0;
    let mut deprecated = 0;
    let mut blocked = 0;

    for (name, path, params) in cases {
        let url = format!("https://api.coolapk.com{path}");
        // 对于检查更新使用 POST
        let is_update_check = name.contains("检查更新");
        let res = if is_update_check {
            client
                .client
                .post(&url)
                .header("X-App-Token", token.clone())
                .header("X-Requested-With", "com.coolapk.market")
                .form(params)
                .send()
                .await
        } else {
            client
                .client
                .get(&url)
                .header("X-App-Token", token.clone())
                .header("X-Requested-With", "XMLHttpRequest")
                .query(params)
                .send()
                .await
        };

        match res {
            Ok(r) => {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                if !status.is_success() {
                    let body_clip = clip(&body, 60);
                    if body_clip.contains("unsupported") {
                        println!("  [  ✗ ] {name:28} HTTP {status} (已废弃)");
                        deprecated += 1;
                    } else if body_clip.contains("登录") {
                        println!("  [  ! ] {name:28} HTTP {status} (需登录)");
                        need_auth += 1;
                    } else {
                        println!("  [  ✗ ] {name:28} HTTP {status}: {}", body_clip);
                        blocked += 1;
                    }
                    continue;
                }
                match serde_json::from_str::<Value>(&body) {
                    Ok(json) => {
                        let has_data = json.get("data").map_or(false, |v| !v.is_null());
                        let data_empty = json.get("data").and_then(|v| v.as_array()).map_or(true, |a| a.is_empty());
                        let msg = json.get("message").and_then(|v| v.as_str()).unwrap_or("");
                        let sc = json.get("status").and_then(|v| v.as_i64()).unwrap_or(0);

                        let is_unauthed = msg.contains("登录") || sc == 401;
                        let is_notfound = msg.contains("does not exists") || sc == 404;
                        let is_deprecated = msg == "API unsupported." || msg.contains("已下线");

                        if has_data && !data_empty {
                            let count = json.get("data").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(1);
                            println!("  [  ✓ ] {name:28} 有数据 ({count} 条)");
                            ok += 1;
                        } else if has_data && data_empty {
                            println!("  [  ○ ] {name:28} 有响应但无数据");
                            ok += 1;
                        } else if is_deprecated {
                            println!("  [  ✗ ] {name:28} 已废弃");
                            deprecated += 1;
                        } else if is_unauthed {
                            println!("  [  ! ] {name:28} 需登录");
                            need_auth += 1;
                        } else if is_notfound {
                            println!("  [  ✗ ] {name:28} 已废弃");
                            deprecated += 1;
                        } else if !msg.is_empty() {
                            println!("  [  ? ] {name:28} {}", clip(msg, 50));
                            blocked += 1;
                        } else {
                            println!("  [  ? ] {name:28} 响应结构未知");
                            ok += 1;
                        }
                    }
                    Err(e) => {
                        println!("  [  ✗ ] {name:28} JSON解析: {} - {}", e, clip(&body, 40));
                        blocked += 1;
                    }
                }
            }
            Err(e) => {
                println!("  [  ✗ ] {name:28} 网络错误: {}", e);
                blocked += 1;
            }
        }
    }

    let total = cases.len();
    println!("\n未文档化API ({total}):  {ok} 可用 · {need_auth} 需登录 · {blocked} 被拦截 · {deprecated} 已废弃");
    println!("有效接口: {} / {total}", ok + need_auth);
}

/// 验证应用集列表 -> 详情 -> 评论的真实链路，避免使用失效的固定应用集 ID。
#[tokio::test]
#[ignore]
async fn probe_album_reply_chain() {
    let client = CoolapkClient::new();
    let list = client
        .api_get(
            "/v6/album/list",
            &[("listType", "hot".to_string()), ("page", "1".to_string())],
        )
        .await
        .expect("album list request should succeed");

    let albums = list
        .get("data")
        .and_then(|value| value.as_array())
        .expect("album list should contain an array");
    assert!(!albums.is_empty(), "album list should not be empty");

    let first = &albums[0];
    let album_id = first
        .get("id")
        .or_else(|| first.get("entityId"))
        .map(value_to_string)
        .filter(|value| !value.is_empty())
        .expect("album item should contain an id");
    println!("first album={}", clip(&first.to_string(), 800));

    let detail = client
        .api_get("/v6/album/detail", &[("id", album_id.clone())])
        .await
        .expect("album detail request should succeed");
    if let Some(detail_data) = detail.get("data").and_then(|value| value.as_object()) {
        let keys: Vec<&str> = detail_data.keys().map(String::as_str).collect();
        println!("album detail keys={keys:?}");
        for key in ["innerInfo", "topInfo"] {
            if let Some(value) = detail_data.get(key) {
                println!("album detail {key}={}", clip(&value.to_string(), 500));
            }
        }
    }
    println!("album_id={album_id}, detail={}", clip(&detail.to_string(), 500));

    let replies = client
        .api_get(
            "/v6/album/replyList",
            &[("id", album_id.clone()), ("page", "1".to_string())],
        )
        .await
        .expect("album reply request should succeed");
    println!("album replies={}", clip(&replies.to_string(), 1000));
}

/// 验证应用详情页使用的应用讨论接口和清洗结果。
#[tokio::test]
#[ignore]
async fn probe_apk_discussion_chain() {
    let client = CoolapkClient::new();
    let raw = client
        .api_get(
            "/v6/page/dataList",
            &[
                ("url", "#/feed/apkCommentList".to_string()),
                ("id", "tv.danmaku.bili".to_string()),
                ("sort", "lastupdate_desc".to_string()),
                ("page", "1".to_string()),
            ],
        )
        .await
        .expect("apk discussion request should succeed");
    let cleaned = CoolapkClient::extract_cleaned_list(&raw);
    println!("bilibili discussion raw={}", clip(&raw.to_string(), 1000));
    println!("bilibili discussion cleaned={}", cleaned.len());
}

/// 探测 Coolapk-UWP 收集整理的全部未接入接口（收藏单/历史/话题/搜索/问答/投票等）。
/// 未登录时：读接口返回数据 → 可用；返回登录跳转 → 需登录；404 → 已废弃。
#[tokio::test]
#[ignore]
async fn probe_uwp_collected_endpoints() {
    let client = CoolapkClient::new();

    let feed_id = "72652194".to_string();
    let coll_id = "4939783".to_string();
    let tag = "摄影".to_string();

    #[derive(Clone)]
    struct Case(&'static str, &'static str, Vec<(&'static str, String)>);
    let cases: Vec<Case> = vec![
        // === 收藏单 / 合集 ===
        Case("收藏单详情", "/v6/collection/detail", vec![("id", coll_id.clone())]),
        Case("收藏单列表", "/v6/collection/list", vec![("uid", "10086".to_string()), ("page", "1".to_string())]),
        Case("收藏单内容", "/v6/collection/itemList", vec![("id", coll_id.clone()), ("page", "1".to_string())]),
        // === 动态扩展 ===
        Case("修改历史", "/v6/feed/changeHistoryList", vec![("id", feed_id.clone())]),
        Case("转发列表", "/v6/feed/forwardList", vec![("id", feed_id.clone()), ("type", "feed".to_string()), ("page", "1".to_string())]),
        Case("点赞列表", "/v6/feed/likeList", vec![("id", feed_id.clone()), ("listType", "lastupdate_desc".to_string()), ("page", "1".to_string())]),
        Case("话题搜索", "/v6/feed/searchTag", vec![("q", "手机".to_string()), ("page", "1".to_string())]),
        // === 问答 / 投票 ===
        Case("问答列表", "/v6/question/answerList", vec![("id", feed_id.clone()), ("sort", "hot".to_string()), ("page", "1".to_string())]),
        Case("投票评论", "/v6/vote/commentList", vec![("fid", feed_id.clone()), ("page", "1".to_string())]),
        // === 话题 ===
        Case("话题设备动态", "/v6/topic/deviceFeedList", vec![("tag", tag.clone()), ("page", "1".to_string()), ("listType", "lastupdate_desc".to_string())]),
        // === 用户历史 / 搜索 ===
        Case("浏览历史", "/v6/user/hitHistoryList", vec![("page", "1".to_string())]),
        Case("最近历史", "/v6/user/recentHistoryList", vec![("page", "1".to_string())]),
        Case("用户搜索", "/v6/user/search", vec![("q", "小编".to_string()), ("page", "1".to_string())]),
        // === 搜索扩展 ===
        Case("搜索联想(app)", "/v6/search/suggestSearchWordsNew", vec![("searchValue", "小米".to_string()), ("type", "app".to_string())]),
        Case("搜索话题", "/v6/search", vec![("type", "feedTopic".to_string()), ("searchValue", "手机".to_string()), ("page", "1".to_string())]),
        // === 产品 / 配置 ===
        Case("产品详情(name)", "/v6/product/detail", vec![("name", "小米15 Ultra".to_string())]),
        Case("加载配置", "/v6/account/loadConfig", vec![("key", "my_page_card_config".to_string())]),
    ];

    println!("\n======== Coolapk-UWP 补充接口探测 ({}) ========", cases.len());
    let mut ok = 0;
    let mut need_auth = 0;
    let mut deprecated = 0;
    let mut blocked = 0;

    for c in &cases {
        let (name, path, params) = (c.0, c.1, &c.2);
        match client.api_get(path, params).await {
            Ok(res) => {
                let has_data = res.get("data").map_or(false, |v| !v.is_null());
                let message_str = res.get("message").and_then(|v| v.as_str()).unwrap_or("");
                let status_code = res.get("status").and_then(|v| v.as_i64()).unwrap_or(0);
                let error_code = res.get("error").and_then(|v| v.as_i64());
                let forward_url = res.get("forwardUrl").and_then(|v| v.as_str()).unwrap_or("");

                let is_unauthed = message_str.contains("登录") || status_code == 401;
                let is_captcha = message_str.contains("验证码");
                let is_notfound = message_str.contains("does not exists") || status_code == 404;
                let is_redirect = message_str.starts_with("https://")
                    || forward_url.starts_with("/account/login")
                    || error_code == Some(-10001);
                let is_forbidden = message_str.contains("无法访问") || error_code == Some(-3);

                if has_data {
                    println!("  [  ✓ ] {name:16} 有数据");
                    ok += 1;
                } else if is_unauthed || is_redirect {
                    println!("  [  ! ] {name:16} 需登录");
                    need_auth += 1;
                } else if is_captcha || is_forbidden {
                    println!("  [  ! ] {name:16} 被拦截");
                    blocked += 1;
                } else if is_notfound {
                    println!("  [  ✗ ] {name:16} 已废弃");
                    deprecated += 1;
                } else if !message_str.is_empty() {
                    println!("  [  ? ] {name:16} 无数据: {}", clip(message_str, 40));
                    ok += 1;
                } else {
                    println!("  [  ? ] {name:16} 响应结构未知: {}", clip(&res.to_string(), 60));
                    ok += 1;
                }
            }
            Err(e) => {
                println!("  [  ✗ ] {name:16} 网络错误: {}", e);
                blocked += 1;
            }
        }
    }

    println!("\n补充接口 ({total}):  {ok} 可用 · {need_auth} 需登录 · {blocked} 被拦截 · {deprecated} 已废弃", total = cases.len());
    assert!(ok + need_auth >= 14, "可用+需登录接口不足，期望 >= 14，实际 {}", ok + need_auth);
    assert!(deprecated <= 2, "废弃接口过多，期望 <= 2，实际 {}", deprecated);
}

/// 探测新增功能候选接口（删除/编辑/转发/评论删除/APK 收藏等写接口）
/// 未登录 GET 探测：返回 401"你还没有登录"= 接口存在且方法正确；
/// "does not exists" / "API unsupported." = 接口不存在或已废弃。
#[tokio::test]
#[ignore]
async fn probe_new_write_endpoints() {
    let client = CoolapkClient::new();
    let token = client.get_token().unwrap();

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

    #[allow(clippy::type_complexity)]
    let cases: &[(&str, &str, &[(&str, String)])] = &[
        // === 动态删除/编辑 ===
        ("删除动态", "/v6/feed/deleteFeed", &[("id", feed_id.clone())]),
        ("编辑动态", "/v6/feed/updateFeed", &[("id", feed_id.clone()), ("message", "api-probe-test".to_string())]),
        ("编辑动态(备选)", "/v6/feed/editFeed", &[("id", feed_id.clone()), ("message", "api-probe-test".to_string())]),
        ("删除动态(备选)", "/v6/feed/delete", &[("id", feed_id.clone())]),
        ("动态删除回复", "/v6/feed/deleteReply", &[("id", reply_id.clone())]),
        ("回复删除", "/v6/reply/delete", &[("id", reply_id.clone())]),
        ("回复删除(备选)", "/v6/reply/deleteReply", &[("id", reply_id.clone())]),
        ("转发动态", "/v6/feed/forward", &[("id", feed_id.clone()), ("message", "api-probe-test".to_string())]),
        ("转发动态(备选)", "/v6/feed/repost", &[("id", feed_id.clone()), ("message", "api-probe-test".to_string())]),
        ("转发动态(createFeed)", "/v6/feed/createFeed", &[("fid", feed_id.clone()), ("message", "api-probe-test".to_string())]),
        ("收藏应用", "/v6/apk/favorite", &[("id", "com.coolapk.market".to_string())]),
        ("取消收藏应用", "/v6/apk/unFavorite", &[("id", "com.coolapk.market".to_string())]),
        ("收藏应用(targetType)", "/v6/apk/favorite", &[("id", "com.coolapk.market".to_string()), ("targetType", "apk".to_string())]),
        ("回答问题", "/v6/question/answer", &[("id", feed_id.clone()), ("message", "api-probe-test".to_string())]),
        ("点赞回复", "/v6/reply/like", &[("id", reply_id.clone())]),
        ("取消点赞回复", "/v6/reply/unlike", &[("id", reply_id.clone())]),
    ];

    println!("\n======== 新增功能候选写接口探测 ({}) ========", cases.len());
    println!("feed_id={}, reply_id={}\n", feed_id, reply_id);

    let mut exist = 0;
    let mut deprecated = 0;
    let mut unknown = 0;

    for (name, path, params) in cases {
        let url = format!("https://api.coolapk.com{path}");
        let res = client
            .client
            .get(&url)
            .header("X-App-Token", token.clone())
            .header("X-Requested-With", "XMLHttpRequest")
            .query(params)
            .send()
            .await;

        match res {
            Ok(r) => {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                let clip_body = clip(&body, 100);
                if status == 401 || clip_body.contains("你还没有登录") || clip_body.contains("请先登录") {
                    println!("  [  ✓ 需登录 ] {name:24} HTTP {status} (接口存在，方法正确)");
                    exist += 1;
                } else if clip_body.contains("does not exists") || clip_body.contains("API unsupported") || clip_body.contains("已下线") {
                    println!("  [  ✗ 已废弃 ] {name:24} HTTP {status}: {}", clip_body);
                    deprecated += 1;
                } else if status == 200 {
                    let msg = clip_body;
                    println!("  [  ? 返回200 ] {name:24} {msg}");
                    exist += 1;
                } else {
                    println!("  [  ? 其他 ] {name:24} HTTP {status}: {}", clip_body);
                    unknown += 1;
                }
            }
            Err(e) => {
                println!("  [  ✗ 网络错误 ] {name:24} {}", e);
                unknown += 1;
            }
        }
    }

    println!("\n新增候选写接口 ({cases_len}): 存在 {exist} · 废弃 {deprecated} · 其他 {unknown}", cases_len = cases.len());
}

#[tokio::test]
#[ignore]
async fn probe_hot_reply_target_row() {
    let client = CoolapkClient::new();
    let token = client.get_token().unwrap();
    for feed_id in ["73077541", "72984525"] {
        let url = format!(
            "https://api.coolapk.com/v6/feed/hotReplyList?id={}&page=1&discussMode=1",
            feed_id
        );
        let resp = client
            .client
            .get(&url)
            .header("X-App-Token", token.clone())
            .header("X-Requested-With", "XMLHttpRequest")
            .send()
            .await
            .unwrap();
        let body = resp.text().await.unwrap_or_default();
        let json: serde_json::Value =
            serde_json::from_str(&body).unwrap_or(serde_json::Value::Null);
        let arr = json.pointer("/data").and_then(|d| d.as_array());
        if let Some(arr) = arr {
            println!("  [hotReply] {} count={}", feed_id, arr.len());
            if let Some(first) = arr.first() {
                let keys: Vec<String> = first
                    .as_object()
                    .map(|o| o.keys().cloned().collect())
                    .unwrap_or_default();
                println!("  [hotReply] {} first keys: {:?}", feed_id, keys);
                let tr = first
                    .get("targetRow")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);
                let tr_msg = tr
                    .get("message")
                    .map(|m| clip(&m.to_string(), 80))
                    .unwrap_or_default();
                let tr_title = tr
                    .get("message_title")
                    .map(|m| clip(&m.to_string(), 60))
                    .unwrap_or_default();
                println!(
                    "  [hotReply] {} targetRow={} msg={} title={}",
                    feed_id,
                    tr.is_object(),
                    tr_msg,
                    tr_title
                );
            }
        } else {
            println!("  [hotReply] {} no data: {}", feed_id, clip(&body, 150));
        }
    }
}

#[tokio::test]
#[ignore]
async fn probe_dyh_square_endpoints() {
    let client = CoolapkClient::new();
    let token = client.auth.get_app_token().unwrap();
    let cases: &[(&str, &str, &[(&str, String)])] = &[
        ("看看号发现A", "/v6/page/dataList", &[("url", "/user/dyhSubscribe".to_string()), ("page", "1".to_string())]),
        ("看看号发现B", "/v6/page/dataList", &[("url", "#/dyhSquare".to_string()), ("page", "1".to_string())]),
        ("看看号发现C", "/v6/page/dataList", &[("url", "/page?url=/user/dyhSubscribe".to_string()), ("page", "1".to_string())]),
        ("看看号列表D", "/v6/dyh/list", &[("page", "1".to_string())]),
        ("看看号列表E", "/v6/dyhArticle/list", &[("page", "1".to_string())]),
    ];
    for (name, path, params) in cases {
        let url = format!("https://api.coolapk.com{path}");
        let res = client.client.get(&url)
            .header("X-App-Token", token.clone())
            .header("X-Requested-With", "XMLHttpRequest")
            .query(params).send().await;
        match res {
            Ok(r) => {
                let body = r.text().await.unwrap_or_default();
                let clip = body.chars().take(120).collect::<String>();
                if body.contains("does not exists") || body.contains("API unsupported") {
                    println!("  [废弃] {name}: {}", clip);
                } else if body.contains("登录") || r.status() == 401 {
                    println!("  [需登录] {name}");
                } else {
                    println!("  [{status}] {name}: {}", r.status(), clip);
                }
            }
            Err(e) => println!("  [网络错误] {name}: {e}"),
        }
    }
}
