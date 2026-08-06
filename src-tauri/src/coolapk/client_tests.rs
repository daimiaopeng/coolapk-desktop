use super::*;

/// 设备码必须跨调用稳定（同一机器同一结果），酷安据此识别设备；
/// 若每次生成不同码，写接口（点赞/评论）会被判定为网络环境异常
#[test]
fn test_device_code_is_stable() {
    let a = load_or_create_device_code();
    let b = load_or_create_device_code();
    assert_eq!(a, b, "同一台机器上设备码应保持稳定");
    assert!(!a.is_empty());
    // 设备码应是合法的 header 值
    assert!(HeaderValue::from_str(&a).is_ok(), "设备码必须是合法 HTTP header 值");
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
        .and_then(|arr| arr.iter().find(|f| f.get("replynum").and_then(|v| v.as_u64()).unwrap_or(0) > 0))
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
        let rrc = r.get("replyRowsCount").and_then(|v| v.as_u64()).unwrap_or(0);
        if rrc > 2 {
            target_cid = r.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_default();
            println!("Found comment with {} sub-replies: id={}, author={}", rrc, target_cid, r.get("username").and_then(|v| v.as_str()).unwrap_or(""));
            break;
        }
    }
    if target_cid.is_empty() {
        println!("No comment with >2 sub-replies found, skipping");
        return;
    }

    // 测试 replyList API，打印原始 id/rid/rrid 值
    let url = format!("https://api.coolapk.com/v6/feed/replyList?id={}&rid={}&page=1", feed_id, target_cid);
    println!("\nTesting URL: {}", url);
    let token = client.auth.get_app_token().unwrap();
    let res = client.client.get(&url).header("X-App-Token", token).send().await.unwrap();
    let json: Value = res.json().await.unwrap();
    if let Some(arr) = json.get("data").and_then(Value::as_array) {
        println!("Total items returned: {}", arr.len());
        for (idx, item) in arr.iter().take(8).enumerate() {
            let id = item.get("id");
            let rid = item.get("rid");
            let rrid = item.get("rrid");
            let username = item.get("username").and_then(|v| v.as_str()).unwrap_or("");
            println!("  [{}] id={:?}, rid={:?}, rrid={:?}, username={}", idx, id, rid, rrid, username);
        }
    } else {
        println!("No data array in response");
    }
}

/// 模拟「登录 → 保存 Cookie → 落盘 → 重启恢复 → 登出删除」完整链路（不依赖网络）
#[test]
fn test_login_cookie_persistence_flow() {
    use std::path::PathBuf;

    let dir = std::env::temp_dir().join(format!(
        "coolapk_desktop_login_test_{}",
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let cookie_file: PathBuf = dir.join("session_cookie.txt");

    // 1. 首次启动：无持久化凭据
    let client = CoolapkClient::new();
    client.persist_cookie_to(cookie_file.clone());
    assert_eq!(client.get_user_cookie(), None, "首次启动不应有 cookie");

    // 2. 模拟 Webview 授权登录：save_cookie_securely 内部调用 set_user_cookie
    let fake_cookie = "SESSID=abc123def456; uid=10086; Hm_lvt_xxx=1";
    client.set_user_cookie(fake_cookie.to_string()).unwrap();
    assert_eq!(client.get_user_cookie(), Some(fake_cookie.to_string()));
    assert!(
        cookie_file.exists(),
        "登录后凭据应已写入持久化文件"
    );
    let on_disk = std::fs::read_to_string(&cookie_file).unwrap();
    assert_eq!(on_disk, fake_cookie, "落盘内容应与登录凭据一致");

    // 3. 模拟应用重启：新实例通过 persist_cookie_to 自动恢复
    let restarted = CoolapkClient::new();
    restarted.persist_cookie_to(cookie_file.clone());
    assert_eq!(
        restarted.get_user_cookie(),
        Some(fake_cookie.to_string()),
        "重启后应自动恢复登录凭据"
    );

    // 4. 模拟退出登录：clear_user_cookie 清空内存并删除文件
    restarted.clear_user_cookie().unwrap();
    assert_eq!(restarted.get_user_cookie(), None);
    assert!(
        !cookie_file.exists(),
        "退出登录后持久化文件应被删除"
    );

    // 5. 清理：再次 set 后再 clear，验证空串路径不残留文件
    restarted.set_user_cookie("SESSID=tmp".to_string()).unwrap();
    assert!(cookie_file.exists());
    restarted.set_user_cookie(String::new()).unwrap();
    assert_eq!(restarted.get_user_cookie(), None);
    assert!(!cookie_file.exists(), "空凭据也应删除持久化文件");

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
        history["logo"],
        "https://avatar.coolapk.com/data/001/45/12/66_avatar_middle.jpg",
        "http 图片应升级为 https"
    );

    let recent = &list[1];
    assert_eq!(recent["entityType"], "recentHistory");
    assert_eq!(recent["url"], "/apk/tv.danmaku.bili", "已有前导斜杠的 url 不应被改动");
    assert_eq!(
        recent["logo"],
        "https://pp.myapp.com/ma_icon/0/icon/256",
        "// 开头图片应补全 https"
    );
}

/// 模拟 Webview 登录脚本捕获到的真实 Cookie 形态（含中文/换行等脏字符），
/// 验证 set_user_cookie 的 ASCII 清洗与落盘逻辑不会崩坏
#[test]
fn test_login_cookie_dirty_input_sanitized() {
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

    let stored = client.get_user_cookie().unwrap();
    assert!(!stored.contains('\r') && !stored.contains('\n'), "不应包含换行");
    assert!(stored.contains("SESSID=abc") && stored.contains("uid=10086"));
    // 落盘文件也必须是无换行的安全形态
    let on_disk = std::fs::read_to_string(&cookie_file).unwrap();
    assert!(!on_disk.contains('\r') && !on_disk.contains('\n'));

    let _ = std::fs::remove_dir_all(&dir);
}
