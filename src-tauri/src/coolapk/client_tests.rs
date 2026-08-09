use super::*;

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

/// 随机设备码：每次调用生成不同结果（游客态/新账号首次生成随机并持久化）
#[test]
fn test_device_code_is_random() {
    let a = generate_random_device_code();
    let b = generate_random_device_code();
    assert_ne!(a, b, "两次生成的设备码不应相同");
    assert!(a.len() >= 100, "设备码应有足够长度");
    assert!(!a.is_empty());
    // 设备码应是合法的 header 值
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

    // 测试 replyList API，打印原始 id/rid/rrid 值
    let url = format!(
        "https://api.coolapk.com/v6/feed/replyList?id={}&rid={}&page=1",
        feed_id, target_cid
    );
    println!("\nTesting URL: {}", url);
    let token = client.get_token().unwrap();
    let res = client
        .client
        .get(&url)
        .header("X-App-Token", token)
        .send()
        .await
        .unwrap();
    let json: Value = res.json().await.unwrap();
    if let Some(arr) = json.get("data").and_then(Value::as_array) {
        println!("Total items returned: {}", arr.len());
        for (idx, item) in arr.iter().take(8).enumerate() {
            let id = item.get("id");
            let rid = item.get("rid");
            let rrid = item.get("rrid");
            let username = item.get("username").and_then(|v| v.as_str()).unwrap_or("");
            println!(
                "  [{}] id={:?}, rid={:?}, rrid={:?}, username={}",
                idx, id, rid, rrid, username
            );
        }
    } else {
        println!("No data array in response");
    }
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
