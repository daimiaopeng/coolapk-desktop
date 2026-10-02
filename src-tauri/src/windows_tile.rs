//! Windows 10 动态磁贴支持。
//!
//! 磁贴由系统外壳渲染，驱动它需要包标识（MSIX 打包）。未打包时调用会失败。
//!
//! 磁贴展示真实酷安内容（`TileItem`），XML 形状约束来自同机实测
//! （Coolapk-Lite UWP 推送到本机通知库的 payload，经 wpndatabase.db 取出比对）：
//! 自适应子元素**直接**位于 `<binding>` 之下，不使用 `<adaptive>` 包裹层，
//! `<visual>` 也不带 `version` 属性。实测加上 `<adaptive>` 时外壳会静默丢弃
//! binding 内容，磁贴只剩品牌名。

use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(test)]
mod tests {
    use super::*;

    /// 逐块遍历每个 `<binding>`，把块内容与序号交给断言闭包；返回块数。
    fn for_each_binding<F: FnMut(&str, usize)>(xml: &str, mut f: F) -> usize {
        let mut search_from = 0;
        let mut count = 0;
        while let Some(offset) = xml[search_from..].find("<binding ") {
            let start = search_from + offset;
            let end = start
                + xml[start..]
                    .find("</binding>")
                    .expect("<binding> 未闭合");
            count += 1;
            f(&xml[start..end], count);
            search_from = end;
        }
        count
    }

    // ---- Task 2: TileItem 驱动的磁贴 XML ----

    fn sample() -> TileItem {
        TileItem {
            user_name: "测试用户".to_string(),
            message: "这是一条测试动态正文".to_string(),
            avatar_url: Some("https://avatar.coolapk.com/a.jpg".to_string()),
        }
    }

    #[test]
    fn tile_xml_omits_adaptive_wrapper() {
        let xml = build_tile_xml(&sample());
        assert!(
            !xml.contains("<adaptive>"),
            "<adaptive> 包裹层会导致外壳丢弃 binding 内容、磁贴空白（已实测）"
        );
        assert!(!xml.contains("</adaptive>"));
    }

    #[test]
    fn xml_omits_visual_version_attribute() {
        let xml = build_tile_xml(&sample());
        // 拒绝 version= 出现在任意位置：仅拒绝 `<visual version=` 会漏掉
        // 属性顺序不同的写法（如 `<visual branding="x" version="3">`）。
        assert!(!xml.contains("version="), "参考实现不带 version 属性");
    }

    #[test]
    fn tile_every_binding_carries_text_directly() {
        let xml = build_tile_xml(&sample());
        let n = for_each_binding(&xml, |block, i| {
            assert!(block.contains("<text"), "第 {i} 个 <binding> 内没有直接子 <text>，磁贴会空白");
            assert!(!block.contains("<adaptive>"), "第 {i} 个 <binding> 内混入了 <adaptive>");
        });
        assert!(n >= 3, "应至少有 Small/Medium/Wide 三个绑定，实际 {n}");
    }

    #[test]
    fn text_is_escaped_so_output_stays_valid_xml() {
        let item = TileItem {
            user_name: "A&B<C>".to_string(),
            message: "5 > 3 && \"引号\" '撇号'".to_string(),
            avatar_url: None,
        };
        let xml = build_tile_xml(&item);
        assert!(!xml.contains("A&B<C>"), "用户名未转义");
        assert!(xml.contains("A&amp;B&lt;C&gt;"), "用户名转义结果不符");
        assert!(xml.contains("&amp;&amp;"), "正文中的 & 未转义");
        assert!(!xml.contains("5 > 3"), "正文中的 > 未转义");
    }

    #[test]
    fn long_message_is_truncated_to_limit() {
        let long = "字".repeat(MAX_MESSAGE_CHARS + 50);
        let out = truncate_message(&long);
        assert_eq!(out.chars().count(), MAX_MESSAGE_CHARS + 1, "应为 160 字 + 省略号");
        assert!(out.ends_with('…'), "截断后应追加省略号");
    }

    #[test]
    fn short_message_is_not_truncated() {
        assert_eq!(truncate_message("短正文"), "短正文");
    }

    /// 截断按 Unicode 字符计，不是字节 —— 中文每字 3 字节，按字节截会截出半个字符。
    #[test]
    fn truncation_counts_unicode_chars_not_bytes() {
        let cjk = "中".repeat(MAX_MESSAGE_CHARS);
        let out = truncate_message(&cjk);
        assert_eq!(out, cjk, "恰好 160 个中文字符不应被截断");
    }

    #[test]
    fn missing_avatar_omits_image_element() {
        let item = TileItem { avatar_url: None, ..sample() };
        let xml = build_tile_xml(&item);
        assert!(!xml.contains("<image"), "无头像时不应输出 <image>");
    }

    // ---- Task 3: feed 响应 → TileItem 映射 ----

    fn feed_json() -> serde_json::Value {
        serde_json::json!({
            "code": 200,
            "data": [
                {
                    "username": "甲",
                    "message": "第一条",
                    "userAvatar": "https://avatar.coolapk.com/a.jpg"
                },
                {
                    "username": "乙",
                    "message": "第二条",
                    "userAvatar": ""
                },
                {
                    "username": "丙",
                    "message": "第三条"
                }
            ]
        })
    }

    #[test]
    fn maps_each_feed_to_an_item() {
        let items = tile_items_from_response(&feed_json());
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].user_name, "甲");
        assert_eq!(items[0].message, "第一条");
    }

    #[test]
    fn empty_or_missing_avatar_becomes_none() {
        let items = tile_items_from_response(&feed_json());
        assert_eq!(items[0].avatar_url.as_deref(), Some("https://avatar.coolapk.com/a.jpg"));
        assert_eq!(items[1].avatar_url, None, "空字符串头像应归一为 None");
        assert_eq!(items[2].avatar_url, None, "缺字段头像应归一为 None");
    }

    #[test]
    fn items_without_username_or_message_are_skipped() {
        let raw = serde_json::json!({
            "code": 200,
            "data": [
                { "message": "没有用户名" },
                { "username": "只有用户名" },
                { "username": "完整", "message": "有正文" }
            ]
        });
        let items = tile_items_from_response(&raw);
        assert_eq!(items.len(), 1, "缺关键字段的条目应被跳过而不是产出空磁贴");
        assert_eq!(items[0].user_name, "完整");
    }

    #[test]
    fn result_is_capped_at_max_tile_items() {
        let data: Vec<serde_json::Value> = (0..20)
            .map(|i| serde_json::json!({ "username": format!("u{i}"), "message": format!("m{i}") }))
            .collect();
        let raw = serde_json::json!({ "code": 200, "data": data });
        assert_eq!(tile_items_from_response(&raw).len(), MAX_TILE_ITEMS);
    }

    // ---- html_to_plain_text ----

    #[test]
    fn strips_tags_but_keeps_their_text() {
        // 实测样本：酷安正文里的话题链接
        let input = r#"<a class="feed-link-tag" href="/t/%E9%85%B7%E5%85%A5" target="_blank">酷入</a>今天聊聊"#;
        assert_eq!(html_to_plain_text(input), "酷入今天聊聊");
    }

    #[test]
    fn decodes_common_entities() {
        assert_eq!(html_to_plain_text("a &amp; b"), "a & b");
        assert_eq!(html_to_plain_text("&lt;tag&gt;"), "<tag>");
        assert_eq!(html_to_plain_text("&quot;q&quot;"), "\"q\"");
        assert_eq!(html_to_plain_text("&nbsp;x"), "x");
    }

    /// &amp; 必须最后解码，否则 "&amp;lt;" 会被二次解码成 "<"。
    #[test]
    fn amp_is_decoded_last() {
        assert_eq!(html_to_plain_text("&amp;lt;"), "&lt;");
    }

    #[test]
    fn br_becomes_newline() {
        assert_eq!(html_to_plain_text("第一行<br>第二行"), "第一行\n第二行");
        assert_eq!(html_to_plain_text("第一行<br/>第二行"), "第一行\n第二行");
    }

    /// 危险容器连内容一起丢弃 —— 与前端 sanitizeHtml 的语义一致。
    #[test]
    fn dangerous_containers_are_dropped_with_their_content() {
        assert_eq!(html_to_plain_text("前<script>alert(1)</script>后"), "前后");
        assert_eq!(html_to_plain_text("前<style>.a{color:red}</style>后"), "前后");
        assert_eq!(html_to_plain_text("前<iframe src=x></iframe>后"), "前后");
    }

    /// 嵌套标签视为透明容器，只去标签、保留文本。
    #[test]
    fn nested_transparent_containers_keep_inner_text() {
        assert_eq!(html_to_plain_text("<font color='red'><b>加粗</b></font>"), "加粗");
    }

    #[test]
    fn unterminated_tag_is_treated_as_text() {
        assert_eq!(html_to_plain_text("正常<a href=x"), "正常<a href=x");
    }

    #[test]
    fn plain_text_passes_through_unchanged() {
        assert_eq!(html_to_plain_text("没有任何标签"), "没有任何标签");
    }

    #[test]
    fn result_is_trimmed() {
        assert_eq!(html_to_plain_text("  <b>  文本  </b>  "), "文本");
    }

    /// 映射层必须应用去标签 —— 真实数据里话题链接标签会直接出现。
    #[test]
    fn mapping_strips_html_from_message() {
        let raw = serde_json::json!({
            "code": 200,
            "data": [{
                "username": "甲",
                "message": "<a class=\"feed-link-tag\" href=\"/t/%E9%85%B7\" target=\"_blank\">酷入</a>今天聊聊这个"
            }]
        });
        let items = tile_items_from_response(&raw);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].message, "酷入今天聊聊这个");
        assert!(!items[0].message.contains('<'), "标签必须已被去除");
    }

    /// 纯标签无文本的条目应被跳过，而不是产出空磁贴。
    #[test]
    fn mapping_skips_item_whose_message_is_only_markup() {
        let raw = serde_json::json!({
            "code": 200,
            "data": [{ "username": "甲", "message": "<br/><br/>" }]
        });
        assert!(tile_items_from_response(&raw).is_empty());
    }

    /// 打包形态的 AUMID 必须是 `<PackageFamilyName>!<ApplicationId>`，
    /// 且 Application Id 与 manifest 一致。
    #[test]
    fn packaged_aumid_joins_family_name_and_application_id() {
        assert_eq!(
            packaged_aumid("com.coolapk.desktop_1k5x5tky3azf6"),
            "com.coolapk.desktop_1k5x5tky3azf6!CoolapkDesktop"
        );
        assert_eq!(PACKAGE_APPLICATION_ID, "CoolapkDesktop", "须与 AppxManifest 的 Application/@Id 一致");
    }

    /// Windows 10 / 11 的分界 —— 22000 起属于 Windows 11，而 Win11 没有动态磁贴。
    #[test]
    fn windows_10_build_boundary_excludes_windows_11() {
        assert!(is_windows_10_build(19041), "Win10 2004 应判为 Windows 10");
        assert!(is_windows_10_build(19045), "Win10 22H2 应判为 Windows 10");
        assert!(!is_windows_10_build(22000), "22000 是 Windows 11 起点，不应判为 10");
        assert!(!is_windows_10_build(26100), "Win11 24H2 不应判为 Windows 10");
    }

    #[test]
    fn malformed_response_yields_empty_vec_not_panic() {
        assert!(tile_items_from_response(&serde_json::json!({ "code": 500 })).is_empty());
        assert!(tile_items_from_response(&serde_json::json!({ "data": "not an array" })).is_empty());
        assert!(tile_items_from_response(&serde_json::json!({ "data": [1, 2, 3] })).is_empty());
    }

    // ---- Task 4: 数据源枚举与设置键注册表 ----

    #[test]
    fn known_setting_keys_map_to_their_source() {
        assert!(matches!(LiveTileSource::from_setting(Some("index_v8")), LiveTileSource::IndexV8));
        assert!(matches!(LiveTileSource::from_setting(Some("hot")), LiveTileSource::Hot));
        assert!(matches!(LiveTileSource::from_setting(Some("news")), LiveTileSource::News));
        assert!(matches!(LiveTileSource::from_setting(Some("digest")), LiveTileSource::Digest));
    }

    #[test]
    fn unknown_or_absent_setting_falls_back_to_default() {
        assert!(matches!(LiveTileSource::from_setting(None), LiveTileSource::IndexV8));
        assert!(matches!(LiveTileSource::from_setting(Some("garbage")), LiveTileSource::IndexV8));
        assert!(matches!(LiveTileSource::from_setting(Some("")), LiveTileSource::IndexV8));
    }

    #[test]
    fn setting_keys_round_trip() {
        for s in [
            LiveTileSource::IndexV8,
            LiveTileSource::Hot,
            LiveTileSource::News,
            LiveTileSource::Digest,
        ] {
            let key = s.setting_key();
            assert!(matches!(LiveTileSource::from_setting(Some(key)), x if x.setting_key() == key));
        }
    }
}

/// 把若干条目推入磁贴通知队列。
///
/// 倒序推送：最后推送的显示在最前，因此最新一条最先被看到。
/// 启用队列后 Windows 会在最多 5 条之间自动轮播。
#[cfg(target_os = "windows")]
fn push_tile(items: &[TileItem]) -> Result<(), String> {
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::UI::Notifications::{TileNotification, TileUpdateManager};

    let updater = TileUpdateManager::CreateTileUpdaterForApplication()
        .map_err(|e| format!("获取 TileUpdater 失败（未打包时常见）: {e}"))?;

    // 队列不被支持时降级为单条，而不是整体失败。
    let queued = updater.EnableNotificationQueue(true).is_ok();

    let limit = if queued { MAX_TILE_ITEMS } else { 1 };

    // 先把本轮全部通知构造并校验完毕，再动队列。
    // 这样"清空之后才发现构造失败"的窗口最小。
    let mut notifications = Vec::new();
    for item in items.iter().take(limit) {
        let xml = XmlDocument::new().map_err(|e| format!("创建 XmlDocument 失败: {e}"))?;
        xml.LoadXml(&windows::core::HSTRING::from(build_tile_xml(item)))
            .map_err(|e| format!("解析磁贴 XML 失败: {e}"))?;
        notifications.push(
            TileNotification::CreateTileNotification(&xml)
                .map_err(|e| format!("构造 TileNotification 失败: {e}"))?,
        );
    }

    if notifications.is_empty() {
        return Err("没有可推送的条目".to_string());
    }

    // **必须先清空队列。** 队列是 5 槽 FIFO，只在写满时才挤掉最旧的：
    // 本轮条目少于 5 条时，若只追加，上一轮的条目会残留在队首继续轮播 ——
    // 例如从「推荐」切到「快讯」而本轮只取到 2 条，队列会变成 C D E F G，
    // 用户明明选了快讯却仍看到 3 条旧的推荐。
    //
    // 注意这**不违反**"宁可旧也不要空"的原则：该原则约束的是失败路径
    // （取数失败 / 条目为空时直接返回、不 Clear）。这里已经拿到一组完整
    // 的新数据，语义是一次**整体替换**而不是追加。
    updater
        .Clear()
        .map_err(|e| format!("清空磁贴队列失败: {e}"))?;

    // 倒序推送：最后推送的显示在最前。
    for notification in notifications.iter().rev() {
        updater
            .Update(notification)
            .map_err(|e| format!("更新磁贴失败: {e}"))?;
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn push_tile(_items: &[TileItem]) -> Result<(), String> {
    Err("动态磁贴仅在 Windows 上可用".to_string())
}

/// 刷新代次计数器，用于让"最新发起的刷新"胜出。
///
/// 三个触发源（启动、30 分钟定时、设置变更）都可能并发发起刷新，而网络请求
/// 的完成顺序无法保证。每次刷新在取数前领一个递增的代次，返回后比对：
/// 若已有更新的刷新发起，本次结果直接丢弃。
static REFRESH_GENERATION: AtomicU64 = AtomicU64::new(0);

/// 读设置 → 取数 → 生成 → 推送。任一环节失败都**保留现有磁贴不清空**。
///
/// `override_source` 由设置变更命令直接传入：持久化是异步的，若此刻读
/// 进程内缓存可能拿到旧值，磁贴会与界面不一致。启动与定时刷新传 `None`，
/// 走持久化值。
pub async fn refresh_tile(
    app: &tauri::AppHandle,
    override_source: Option<LiveTileSource>,
) -> Result<(), String> {
    // 本机不支持磁贴时（非 Windows / Windows 11 无磁贴 / 未打包），
    // 连取数都不该做 —— 那只是白白发一次网络请求。
    if !supports_live_tile() {
        return Err("当前环境不支持动态磁贴（需 Windows 10 且已注册稀疏身份包）".to_string());
    }

    // 记下代次。取数期间若又发起了更新的刷新，本次结果作废。
    let generation = REFRESH_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;

    let source = override_source.unwrap_or_else(|| read_live_tile_source(app));
    let items = fetch_items(app, source).await?;

    // 网络请求的完成顺序无法保证：启动刷新（旧源、较慢）可能在用户已切到新源
    // 并完成刷新之后才返回，把旧数据覆盖上去。这里做"最新发起的胜出"判定 ——
    // 只是在返回后丢弃过期结果，比用 Mutex 串行化更合适：后者让用户连续切换时
    // 白白等待前几个已经无意义的网络请求。
    if generation != REFRESH_GENERATION.load(Ordering::SeqCst) {
        return Ok(());
    }

    if items.is_empty() {
        // 宁可磁贴是旧的，也不要清空它。
        return Err("取到的条目为空，保留现有磁贴".to_string());
    }

    push_tile(&items)
}

/// 判断当前进程是否具有包标识（即是否以 MSIX / 稀疏包形式运行）。
///
/// 探测方式遵循微软给出的标准流程：第一次传空缓冲区，
/// **有包标识**时 API 需要缓冲区，返回 `ERROR_INSUFFICIENT_BUFFER`（122）；
/// **无包标识**时返回 `APPMODEL_ERROR_NO_PACKAGE`（15700）。
///
/// 必须精确判定 `ERROR_INSUFFICIENT_BUFFER`，不能写成
/// `status != APPMODEL_ERROR_NO_PACKAGE` —— 那样任何**其他**错误
/// （参数错误、API 异常等）都会被误判为"有包标识"，
/// 进而误启动网络请求与定时刷新。
#[cfg(target_os = "windows")]
pub fn has_package_identity() -> bool {
    use windows::Win32::Foundation::ERROR_INSUFFICIENT_BUFFER;
    use windows::Win32::Storage::Packaging::Appx::GetCurrentPackageFullName;

    let mut length = 0u32;
    let status = unsafe { GetCurrentPackageFullName(&mut length, None) };
    status == ERROR_INSUFFICIENT_BUFFER
}

#[cfg(not(target_os = "windows"))]
pub fn has_package_identity() -> bool {
    false
}

/// Windows 11 的内部版本起点。低于它即为 Windows 10。
const WINDOWS_11_FIRST_BUILD: u32 = 22000;

/// 内部版本号是否属于 Windows 10。
///
/// 单列成函数是为了让边界可以被单元测试钉住 —— 直接查系统的那一层无法在
/// CI 上断言，因为 Windows runner 的版本会随镜像变化。
fn is_windows_10_build(build: u32) -> bool {
    build < WINDOWS_11_FIRST_BUILD
}

/// 当前系统是否为 Windows 10（而非 Windows 11 或更高）。
///
/// 判断依据是内部版本号：Windows 10 为 10240–19045，Windows 11 自 22000 起。
///
/// 用注册表而不 `GetVersionEx`：后者在清单未声明 `supportedOS` 时会谎报 6.2。
/// `winreg` 已是本项目的 Windows 依赖。
#[cfg(target_os = "windows")]
fn is_windows_10() -> bool {
    use winreg::RegKey;
    use winreg::enums::HKEY_LOCAL_MACHINE;

    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .and_then(|key| key.get_value::<String, _>("CurrentBuildNumber"))
        .ok()
        .and_then(|build| build.trim().parse::<u32>().ok())
        .is_some_and(is_windows_10_build)
}

/// 本机是否**真正可以显示动态磁贴**。
///
/// 三个条件缺一不可：
///
/// 1. **Windows** —— 磁贴是 Windows Shell 的功能
/// 2. **Windows 10** —— Windows 11 已移除动态磁贴。仅有包标识并不够：
///    Win11 上即使注册了稀疏包、`TileUpdateManager` 调用成功，
///    也不会有任何磁贴被显示 —— 只会白白产生网络请求和永不停止的定时刷新
/// 3. **具有包标识** —— 磁贴 API 的硬性要求（未打包进程只会得到 `0x80070490`）
///
/// 所有与磁贴相关的分支 —— 启动刷新、30 分钟定时器、前端设置项显隐 ——
/// 都统一走这一个判断，不要各自去判子条件，否则很容易漏掉第 2 条。
pub fn supports_live_tile() -> bool {
    #[cfg(target_os = "windows")]
    {
        is_windows_10() && has_package_identity()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

/// 打包形态下本应用的 Application Id。
///
/// **必须与 `msix/AppxManifest.xml` 的 `Application/@Id` 逐字一致** ——
/// AUMID 的组成是 `<PackageFamilyName>!<ApplicationId>`，写错就落到一个
/// 清单里不存在的身份上。
const PACKAGE_APPLICATION_ID: &str = "CoolapkDesktop";

/// 组装打包形态的 AUMID。
fn packaged_aumid(package_family_name: &str) -> String {
    format!("{package_family_name}!{PACKAGE_APPLICATION_ID}")
}

/// 当前进程的包族名（PackageFamilyName）。未打包时返回 `None`。
#[cfg(target_os = "windows")]
fn current_package_family_name() -> Option<String> {
    use windows::Win32::Foundation::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS};
    use windows::Win32::Storage::Packaging::Appx::GetCurrentPackageFamilyName;
    use windows::core::PWSTR;

    let mut length = 0u32;
    let status = unsafe { GetCurrentPackageFamilyName(&mut length, None) };
    if status != ERROR_INSUFFICIENT_BUFFER || length == 0 {
        return None;
    }

    let mut buffer = vec![0u16; length as usize];
    let status = unsafe {
        GetCurrentPackageFamilyName(&mut length, Some(PWSTR(buffer.as_mut_ptr())))
    };
    if status != ERROR_SUCCESS {
        return None;
    }

    let end = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
    Some(String::from_utf16_lossy(&buffer[..end]))
}

/// 发起桌面通知应当使用的 AUMID。
///
/// **两种形态不能混用：**
///
/// - **有包标识**：必须是 `<PackageFamilyName>!<ApplicationId>`
/// - **未打包**：用注册在 HKCU 的那个 BareId，即 `tauri.conf.json` 的 identifier
///
/// 有包标识时传未打包的 BareId，通知**仍会投递**（已实测确认），但系统会把它
/// 解析成 `<PackageFamilyName>!<BareId>` —— 一个**清单里并不存在的 Application Id**。
/// 结果是通知的归属身份不对：它挂在那个幻影身份下，而不是本应用声明的应用上。
pub fn notification_aumid(bare_id: &str) -> String {
    #[cfg(target_os = "windows")]
    if let Some(package_family_name) = current_package_family_name() {
        return packaged_aumid(&package_family_name);
    }
    bare_id.to_string()
}

/// 磁贴条目上限：Windows 通知队列最多容纳 5 条。
pub const MAX_TILE_ITEMS: usize = 5;

/// 正文截断上限，按 Unicode 字符计（非字节）。
pub const MAX_MESSAGE_CHARS: usize = 160;

/// 供磁贴渲染的一条内容。
pub struct TileItem {
    pub user_name: String,
    pub message: String,
    pub avatar_url: Option<String>,
}

/// 截断过长正文，超出上限时追加省略号。
///
/// 按 `char` 计数而非字节：中文每字 3 字节，按字节截会切出半个字符。
pub fn truncate_message(input: &str) -> String {
    let mut out: String = input.chars().take(MAX_MESSAGE_CHARS).collect();
    if input.chars().count() > MAX_MESSAGE_CHARS {
        out.push('…');
    }
    out
}

/// 为单个条目生成磁贴 XML。
///
/// 形状约束（同机实测得来，见模块文档注释）：**不使用 `<adaptive>` 包裹层**，
/// 自适应子元素直接位于 `<binding>` 之下；`<visual>` 不带 `version` 属性。
pub fn build_tile_xml(item: &TileItem) -> String {
    let user = crate::escape_notification_xml(&item.user_name);
    let message = crate::escape_notification_xml(&truncate_message(&item.message));

    let wide_left = match item.avatar_url.as_deref() {
        Some(url) if !url.is_empty() => format!(
            r#"<subgroup hint-weight="33"><image src="{}" hint-crop="circle"/></subgroup>"#,
            crate::escape_notification_xml(url)
        ),
        _ => String::new(),
    };

    format!(
        r#"<tile>
  <visual branding="nameAndLogo" displayName="酷安">
    <binding template="TileSmall">
      <text hint-style="caption">酷安</text>
    </binding>
    <binding template="TileMedium">
      <text hint-style="caption">{user}</text>
      <text hint-style="captionSubtle" hint-wrap="true" hint-maxLines="3">{message}</text>
    </binding>
    <binding template="TileWide">
      <group>
        {wide_left}
        <subgroup>
          <text hint-style="caption">{user}</text>
          <text hint-style="captionSubtle" hint-wrap="true" hint-maxLines="3">{message}</text>
        </subgroup>
      </group>
    </binding>
  </visual>
</tile>"#
    )
}

/// 危险容器：连内容一起丢弃，其余标签只去标签、保留文本。
const HTML_DROPPED_ELEMENTS: [&str; 5] = ["script", "style", "iframe", "object", "embed"];

/// 取标签名（`<a class="x">` → `a`，`</a>` → `a`）。
fn html_tag_name(inner: &str) -> &str {
    inner
        .trim_start()
        .trim_start_matches('/')
        .trim_start()
        .split(|c: char| c.is_ascii_whitespace() || c == '/')
        .next()
        .unwrap_or("")
}

/// 大小写不敏感地查找子串，返回字节偏移。
///
/// `to_ascii_lowercase` 只改动 ASCII，因此不会改变字节长度，偏移可直接使用。
fn find_ignore_ascii_case(haystack: &str, needle: &str) -> Option<usize> {
    haystack
        .to_ascii_lowercase()
        .find(&needle.to_ascii_lowercase())
}

/// 解码酷安正文中常见的 HTML 实体。
///
/// `&amp;` **必须最后**解码，否则 `&amp;lt;` 会被二次解码成 `<`。
fn decode_html_entities(input: &str) -> String {
    input
        .replace("&nbsp;", " ")
        .replace("&emsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

/// 把酷安富文本正文转为纯文本。
///
/// 酷安的 `message` 字段是富文本 HTML（应用内用 `v-html` 渲染），而磁贴没有
/// webview —— 直接渲染会把 `<a class="feed-link-tag" href="/t/...">` 这类标签
/// 原样显示出来。本函数复刻前端 `coolapkHtmlToPlainText`
/// （`src/utils/sanitizeHtml.ts`）的语义：去标签、解码实体、保留换行；
/// `script`/`style`/`iframe`/`object`/`embed` 连内容一起丢弃，其余标签一律
/// 视为透明容器（只去标签、保留其文本）。
///
/// 这不是安全边界 —— 输出最终仍会经 `escape_notification_xml` 转义。
/// 本函数只负责让磁贴显示可读文本而非标签。
///
/// 局限：属性值内含 `>` 的标签会被提前截断。酷安正文的标签形态固定，
/// 不涉及该情况；若将来遇到，应改用完整的 HTML 解析器而非在此堆特例。
pub fn html_to_plain_text(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut idx = 0usize;

    while let Some(lt_rel) = input[idx..].find('<') {
        let lt = idx + lt_rel;
        out.push_str(&input[idx..lt]);

        let Some(gt_rel) = input[lt..].find('>') else {
            // 未闭合的 '<'，按普通文本处理
            out.push_str(&input[lt..]);
            idx = input.len();
            break;
        };
        let gt = lt + gt_rel;
        let name = html_tag_name(&input[lt + 1..gt]);

        if name.eq_ignore_ascii_case("br") {
            out.push('\n');
            idx = gt + 1;
            continue;
        }

        if HTML_DROPPED_ELEMENTS
            .iter()
            .any(|d| name.eq_ignore_ascii_case(d))
        {
            let close = format!("</{name}");
            match find_ignore_ascii_case(&input[gt + 1..], &close) {
                Some(pos) => {
                    let after = gt + 1 + pos + close.len();
                    idx = input[after..]
                        .find('>')
                        .map_or(input.len(), |g| after + g + 1);
                }
                // 没有闭合标签：丢弃到结尾
                None => idx = input.len(),
            }
            continue;
        }

        // 普通标签：只丢标签本身，保留其文本
        idx = gt + 1;
    }

    if idx < input.len() {
        out.push_str(&input[idx..]);
    }

    decode_html_entities(&out)
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .trim()
        .to_string()
}

/// 把客户端返回的 feed 响应映射为磁贴条目。
///
/// 容错设计：任何字段缺失或类型不符的条目都**跳过**，不影响其余条目；
/// 整体结构不符时返回空 Vec，由调用方决定保留旧磁贴。
/// 最多返回 [`MAX_TILE_ITEMS`] 条。
pub fn tile_items_from_response(response: &serde_json::Value) -> Vec<TileItem> {
    let Some(rows) = response.get("data").and_then(|v| v.as_array()) else {
        return Vec::new();
    };

    rows.iter()
        .filter_map(|row| {
            let user_name = row.get("username").and_then(|v| v.as_str())?.trim();
            if user_name.is_empty() {
                return None;
            }
            // 酷安的 message 是富文本 HTML（应用内用 v-html 渲染）。
            // 磁贴没有 webview，必须先转纯文本，否则会把
            // <a class="feed-link-tag" href="/t/..."> 这类标签原样显示出来。
            let message = html_to_plain_text(row.get("message").and_then(|v| v.as_str())?);
            if message.is_empty() {
                return None;
            }
            let avatar_url = row
                .get("userAvatar")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| s.starts_with("http"))
                .map(str::to_string);

            Some(TileItem {
                user_name: user_name.to_string(),
                message,
                avatar_url,
            })
        })
        .take(MAX_TILE_ITEMS)
        .collect()
}

/// 磁贴数据源。取值与前端设置 `liveTileSource` 一一对应。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LiveTileSource {
    IndexV8,
    Hot,
    News,
    Digest,
}

impl LiveTileSource {
    /// 设置值 → 数据源。无法识别或缺失时回落到 `IndexV8`（推荐）。
    pub fn from_setting(raw: Option<&str>) -> Self {
        match raw.map(str::trim) {
            Some("hot") => Self::Hot,
            Some("news") => Self::News,
            Some("digest") => Self::Digest,
            _ => Self::IndexV8,
        }
    }

    pub fn setting_key(self) -> &'static str {
        match self {
            Self::IndexV8 => "index_v8",
            Self::Hot => "hot",
            Self::News => "news",
            Self::Digest => "digest",
        }
    }
}

/// 设置文件中承载磁贴数据源的键名。
const LIVE_TILE_SOURCE_KEY: &str = "liveTileSource";

/// 从 settings.json 读取磁贴数据源。
///
/// 注意：这里读的是 tauri-plugin-store 的**进程级内存缓存**（与前端共享），
/// 不是直读磁盘文件 —— 未保存的变更可能已反映在缓存里，而前端刚修改
/// 设置、尚未写入缓存时读到的仍是旧值。因此设置变更时由前端把新值
/// 直接传入 `refresh_tile`，不能依赖这里读到最新值。
/// 读取失败一律回落到默认源，不视为错误。
pub fn read_live_tile_source(app: &tauri::AppHandle) -> LiveTileSource {
    use tauri_plugin_store::StoreExt;

    let raw = app
        .store("settings.json")
        .ok()
        .and_then(|store| store.get(LIVE_TILE_SOURCE_KEY))
        .and_then(|value| value.as_str().map(str::to_string));

    LiveTileSource::from_setting(raw.as_deref())
}

/// 按数据源取数并映射为磁贴条目。
///
/// **命名陷阱**：`News`（快讯）走的是 `coolapk::client` 的 `get_latest_feeds` ——
/// 该方法名字里带 latest，但取的是快讯而非"最新"，不要按名字误映射。
/// 参数依据 `src-tauri/src/coolapk/api_tests.rs::probe_readonly_endpoints_smoke`
/// （已实测无登录可用）。
pub async fn fetch_items(
    app: &tauri::AppHandle,
    source: LiveTileSource,
) -> Result<Vec<TileItem>, String> {
    use tauri::Manager;

    let state = app.state::<crate::coolapk::commands::AppState>();
    let response = match source {
        LiveTileSource::IndexV8 => state.client.get_index_v8_feeds(1).await?,
        LiveTileSource::Hot => state.client.get_hot_feeds(1).await?,
        LiveTileSource::News => state.client.get_latest_feeds(1).await?,
        LiveTileSource::Digest => state.client.get_digest_feeds(1).await?,
    };

    Ok(tile_items_from_response(&response))
}
