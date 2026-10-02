//! Windows 10 动态磁贴支持。
//!
//! 磁贴由系统外壳渲染，驱动它需要包标识（MSIX 打包）。未打包时调用会失败。
//!
//! 磁贴展示真实酷安内容（`TileItem`），XML 形状约束来自同机实测
//! （Coolapk-Lite UWP 推送到本机通知库的 payload，经 wpndatabase.db 取出比对）：
//! 自适应子元素**直接**位于 `<binding>` 之下，不使用 `<adaptive>` 包裹层，
//! `<visual>` 也不带 `version` 属性。实测加上 `<adaptive>` 时外壳会静默丢弃
//! binding 内容，磁贴只剩品牌名。

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
    let mut pushed = 0usize;

    for item in items.iter().take(limit).rev() {
        let xml = XmlDocument::new().map_err(|e| format!("创建 XmlDocument 失败: {e}"))?;
        xml.LoadXml(&windows::core::HSTRING::from(build_tile_xml(item)))
            .map_err(|e| format!("解析磁贴 XML 失败: {e}"))?;
        let notification = TileNotification::CreateTileNotification(&xml)
            .map_err(|e| format!("构造 TileNotification 失败: {e}"))?;
        updater
            .Update(&notification)
            .map_err(|e| format!("更新磁贴失败: {e}"))?;
        pushed += 1;
    }

    if pushed == 0 {
        return Err("没有可推送的条目".to_string());
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn push_tile(_items: &[TileItem]) -> Result<(), String> {
    Err("动态磁贴仅在 Windows 上可用".to_string())
}

/// 读设置 → 取数 → 生成 → 推送。任一环节失败都**保留现有磁贴不清空**。
///
/// `override_source` 由设置变更命令直接传入：持久化是异步的，若此刻读
/// 进程内缓存可能拿到旧值，磁贴会与界面不一致。启动与定时刷新传 `None`，
/// 走持久化值。
pub async fn refresh_tile(
    app: &tauri::AppHandle,
    override_source: Option<LiveTileSource>,
) -> Result<(), String> {
    // 未打包时磁贴 API 必然失败，此时连取数都不该做 —— 那只是白白发一次网络请求。
    if !has_package_identity() {
        return Err("当前未以 MSIX 打包形式运行，动态磁贴不可用".to_string());
    }

    let source = override_source.unwrap_or_else(|| read_live_tile_source(app));
    let items = fetch_items(app, source).await?;

    if items.is_empty() {
        // 宁可磁贴是旧的，也不要清空它。
        return Err("取到的条目为空，保留现有磁贴".to_string());
    }

    push_tile(&items)
}

/// 判断当前进程是否具有包标识（即是否以 MSIX 打包形式运行）。
///
/// 磁贴由系统外壳渲染，驱动它的 `TileUpdateManager` **要求调用方具有包标识**：
/// 未打包的 Win32 进程调用只会得到 `0x80070490`（Element not found）。
///
/// 因此未打包时必须**整体跳过**磁贴刷新，否则 NSIS 版与便携版用户每次启动
/// 都会白白发一次真实网络请求，还会记下一条无意义的警告。对这个项目而言，
/// 主力发行形态正是 exe —— 磁贴功能对它们必须是完全无感的。
#[cfg(target_os = "windows")]
pub fn has_package_identity() -> bool {
    use windows::Win32::Foundation::APPMODEL_ERROR_NO_PACKAGE;
    use windows::Win32::Storage::Packaging::Appx::GetCurrentPackageFullName;

    let mut length = 0u32;
    // 第一次调用只取所需长度；未打包时直接返回 APPMODEL_ERROR_NO_PACKAGE。
    let status = unsafe { GetCurrentPackageFullName(&mut length, None) };
    status != APPMODEL_ERROR_NO_PACKAGE
}

#[cfg(not(target_os = "windows"))]
pub fn has_package_identity() -> bool {
    false
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
            let message = row.get("message").and_then(|v| v.as_str())?.trim();
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
                message: message.to_string(),
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
