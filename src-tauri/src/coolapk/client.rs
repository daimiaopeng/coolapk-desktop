use crate::coolapk::auth::CoolapkAuth;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use md5::{Digest, Md5};
use reqwest::header::{HeaderMap, HeaderValue, COOKIE, USER_AGENT};
use reqwest::{Client, Method};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct CoolapkClient {
    client: Client,
    auth: CoolapkAuth,
    user_cookie: RwLock<Option<String>>,
    cookie_file: RwLock<Option<PathBuf>>,
}

/// 移动端 UA：酷安网页（账号安全页/移动版页面）在桌面 UA 下会白屏或重定向
const MOBILE_UA: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

/// 从 HTML 中提取 <title> 文本（大小写不敏感，无正则依赖）
fn extract_html_title(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let start = lower.find("<title>")? + "<title>".len();
    let end = lower[start..].find("</title>")? + start;
    let title = html[start..end].trim().to_string();
    if title.is_empty() {
        None
    } else {
        Some(title)
    }
}

/// 剔除网页外壳噪音标签（导航/页脚/脚本/样式等），保留正文骨架。
/// 轻量实现：逐标签扫描跳过指定块，未闭合时跳到下一个标签处兜底。
fn strip_noise_tags(html: &str, tags: &[&str]) -> String {
    let lower = html.to_lowercase();
    let mut result = String::with_capacity(html.len());
    let mut pos = 0;
    let n = lower.len();
    while pos < n {
        let Some(rel) = lower[pos..].find('<') else {
            result.push_str(&html[pos..]);
            break;
        };
        let start = pos + rel;
        // 先拷贝 '<' 之前的纯文本
        result.push_str(&html[pos..start]);
        let rest = &lower[start + 1..];
        let name_end = rest
            .find(|c: char| !(c.is_ascii_alphanumeric() || c == '-' || c == ':'))
            .unwrap_or(rest.len());
        let name = &rest[..name_end];

        // 注释/声明等空名标签（<!--、<!DOCTYPE>）：仅保留 '<' 字符
        if name.is_empty() {
            result.push('<');
            pos = start + 1;
            continue;
        }

        if tags.contains(&name) {
            let close_tag = format!("</{name}");
            let after_open = start + 1 + name_end;
            let block_end = if let Some(relc) = lower[after_open..].find(&close_tag) {
                let mut end = after_open + relc + close_tag.len();
                if let Some(gt) = lower[end..].find('>') {
                    end += gt + 1;
                }
                end
            } else {
                // 自闭合或无闭合标签：直接跳过该标签，继续找下一个 <
                after_open
            };
            pos = block_end;
        } else {
            // 普通标签原样保留
            result.push('<');
            pos = start + 1;
        }
    }
    result
}

/// 提取单个标签内部的 HTML（取第一个匹配的开闭标签对）
fn extract_tag_content(html: &str, tag: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let open = format!("<{tag}");
    let start = lower.find(&open)?;
    let open_end = lower[start..].find('>')? + start + 1;
    let close = format!("</{tag}>");
    let rel = lower[open_end..].find(&close)?;
    Some(html[open_end..open_end + rel].to_string())
}

/// 对外部网页做可读性提取：先剥外壳噪音，再优先取 <article>/<main> 正文容器
fn extract_readable_content(html: &str) -> String {
    let cleaned = strip_noise_tags(
        html,
        &["script", "style", "nav", "header", "footer", "aside", "iframe", "form", "noscript"],
    );
    for tag in ["article", "main"] {
        if let Some(inner) = extract_tag_content(&cleaned, tag) {
            return inner;
        }
    }
    cleaned
}

/// 是否属于酷安官方域名：登录 Cookie / App 指纹头等凭据只允许发送给酷安域，
/// 严禁携带到任意第三方域名（防止凭据经外部链接/图片地址泄露）。
fn is_coolapk_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    host == "coolapk.com" || host.ends_with(".coolapk.com")
}

fn parse_u64_val(val: &Value) -> Option<u64> {
    if let Some(n) = val.as_u64() {
        return Some(n);
    }
    if let Some(i) = val.as_i64() {
        if i >= 0 {
            return Some(i as u64);
        }
    }
    if let Some(s) = val.as_str() {
        return s.trim().parse::<u64>().ok();
    }
    None
}

fn get_u64_by_keys(obj: &serde_json::Map<String, Value>, keys: &[&str]) -> u64 {
    for k in keys {
        if let Some(val) = obj.get(*k) {
            if let Some(n) = parse_u64_val(val) {
                return n;
            }
        }
    }
    0
}

fn get_str_by_keys(obj: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(val) = obj.get(*k) {
            if let Some(s) = val.as_str() {
                if !s.is_empty() {
                    return Some(s.to_string());
                }
            } else if let Some(n) = parse_u64_val(val) {
                return Some(n.to_string());
            }
        }
    }
    None
}

impl CoolapkClient {
    /// 生成或复用持久化设备码。
    /// 酷安对写操作（点赞/评论/关注等）会校验设备指纹一致性，
    /// 每次启动更换设备码会导致写请求被判为"网络环境异常"。
    /// 首次启动生成随机码并保存到文件，之后启动复用同一设备码。
    pub fn new() -> Self {
        let device_code = load_or_create_device_code();
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Dalvik/2.1.0 (Linux; U; Android 16; 23113RKC6C Build/AQ3A.250226.002) +CoolMarket/16.2.0-2604201-universal"),
        );
        headers.insert("X-Sdk-Int", HeaderValue::from_static("36"));
        headers.insert("X-Sdk-Locale", HeaderValue::from_static("zh-CN"));
        headers.insert("X-App-Mode", HeaderValue::from_static("universal"));
        headers.insert("X-App-Channel", HeaderValue::from_static("coolapk"));
        headers.insert("X-App-Id", HeaderValue::from_static("com.coolapk.market"));
        headers.insert(
            "X-App-Device",
            HeaderValue::from_str(&device_code)
                .expect("generated desktop device code must be a valid header"),
        );
        headers.insert("X-App-Version", HeaderValue::from_static("16.2.0"));
        headers.insert("X-App-Code", HeaderValue::from_static("2604201"));
        headers.insert("X-Api-Version", HeaderValue::from_static("16"));
        headers.insert("X-App-Supported", HeaderValue::from_static("2604201"));
        headers.insert("X-Dark-Mode", HeaderValue::from_static("0"));

        let client = Client::builder()
            .default_headers(headers)
            .build()
            .unwrap_or_default();

        Self {
            client,
            auth: CoolapkAuth::new(device_code),
            user_cookie: RwLock::new(None),
            cookie_file: RwLock::new(None),
        }
    }

    /// 绑定 Cookie 持久化文件路径，并载入上次保存的登录凭据
    pub fn persist_cookie_to(&self, path: PathBuf) {
        {
            let mut guard = match self.cookie_file.write() {
                Ok(g) => g,
                Err(_) => return,
            };
            *guard = Some(path.clone());
        }
        if let Ok(content) = std::fs::read_to_string(&path) {
            let content = content.trim().to_string();
            if !content.is_empty() {
                if let Ok(mut stored) = self.user_cookie.write() {
                    *stored = Some(content);
                }
            }
        }
    }

    fn save_cookie_file(&self, cookie: &str) {
        let path = match self.cookie_file.read() {
            Ok(guard) => guard.clone(),
            Err(_) => return,
        };
        if let Some(path) = path {
            if cookie.is_empty() {
                let _ = std::fs::remove_file(&path);
            } else {
                let _ = std::fs::write(&path, cookie);
            }
        }
    }

    /// 读取当前登录凭据（可能为 None）
    pub fn get_user_cookie(&self) -> Option<String> {
        self.user_cookie.read().ok().and_then(|g| g.clone())
    }

    pub fn set_user_cookie(&self, cookie: String) -> Result<(), String> {
        let clean = cookie.replace('\r', "").replace('\n', " ").trim().to_string();
        // 转换非 ASCII 字符，防止 reqwest 构造 HeaderValue 出现 builder error
        let safe_ascii: String = clean
            .chars()
            .map(|c| {
                if c.is_ascii() && c != '\r' && c != '\n' {
                    c.to_string()
                } else {
                    format!("%{:02X}", c as u32)
                }
            })
            .collect();

        let mut stored = self
            .user_cookie
            .write()
            .map_err(|_| "failed to lock login state".to_string())?;
        *stored = if safe_ascii.is_empty() {
            None
        } else {
            Some(safe_ascii.clone())
        };
        self.save_cookie_file(&safe_ascii);
        Ok(())
    }

    async fn request_api(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        form: Option<&[(&str, String)]>,
    ) -> Result<Value, String> {
        let token = self.auth.get_app_token()?;
        let url = format!("https://api.coolapk.com{path}");
        let requested_with = if method == Method::POST {
            "com.coolapk.market"
        } else {
            "XMLHttpRequest"
        };
        let mut request = self
            .client
            .request(method, url)
            .header("X-App-Token", token)
            .header("X-Requested-With", requested_with)
            .query(query);

        let cookie = self
            .user_cookie
            .read()
            .map_err(|_| "failed to read login state".to_string())?
            .clone();
        if let Some(cookie) = cookie {
            if let Ok(header_val) = reqwest::header::HeaderValue::from_str(&cookie) {
                request = request.header(COOKIE, header_val);
            }
        }
        if let Some(form) = form {
            request = request.form(form);
        }

        let response = request.send().await.map_err(|e| e.to_string())?;
        response_json(response).await
    }

    async fn api_get(&self, path: &str, query: &[(&str, String)]) -> Result<Value, String> {
        self.request_api(Method::GET, path, query, None).await
    }

    async fn api_post(
        &self,
        path: &str,
        query: &[(&str, String)],
        form: &[(&str, String)],
    ) -> Result<Value, String> {
        self.request_api(Method::POST, path, query, Some(form))
            .await
    }

    fn clean_single_feed(item: &Value, idx: usize) -> Option<Value> {
        let obj = item.as_object()?;

        let user_info = obj.get("userInfo").or_else(|| obj.get("user"));
        let username = obj
            .get("username")
            .and_then(|v| v.as_str())
            .or_else(|| {
                user_info
                    .and_then(|u| u.get("username"))
                    .and_then(|v| v.as_str())
            })
            .or_else(|| {
                user_info
                    .and_then(|u| u.get("name"))
                    .and_then(|v| v.as_str())
            })
            .or_else(|| obj.get("user_name").and_then(|v| v.as_str()));

        let uid = obj
            .get("uid")
            .and_then(|v| {
                v.as_str()
                    .map(|s| s.to_string())
                    .or_else(|| v.as_u64().map(|n| n.to_string()))
            })
            .or_else(|| {
                user_info.and_then(|u| u.get("uid")).and_then(|v| {
                    v.as_str()
                        .map(|s| s.to_string())
                        .or_else(|| v.as_u64().map(|n| n.to_string()))
                })
            });

        let entity_type = obj.get("entityType").and_then(|v| v.as_str()).unwrap_or("");

        // 过滤 Banner、Card 广告与结构占位卡 (如 "今日酷安" Banner 广告卡、搜索分组头)
        if entity_type == "card" || entity_type == "header" || entity_type == "card_title" || entity_type == "banner" {
            return None;
        }

        let is_news_type = entity_type == "dyh" || entity_type == "article" || entity_type == "news";

        let raw_username = match username {
            Some(u) if !u.is_empty() => u.to_string(),
            _ => {
                let dyh = obj.get("dyh_name").and_then(|v| v.as_str());
                let author = obj.get("author").and_then(|v| v.as_str());
                let source = obj.get("source").and_then(|v| v.as_str());

                if let Some(name) = dyh.or(author).or(source) {
                    name.to_string()
                } else if is_news_type {
                    "酷安快讯".to_string()
                } else {
                    // 普通 Feed 贴文必须有真实发帖人 Username，禁止向推荐流注入盲目“酷安快讯”
                    return None;
                }
            }
        };

        let raw_uid = match uid {
            Some(u) if !u.is_empty() => u,
            _ => "0".to_string(),
        };

        let message = obj
            .get("message")
            .and_then(|v| v.as_str())
            .or_else(|| obj.get("description").and_then(|v| v.as_str()))
            .or_else(|| obj.get("subTitle").and_then(|v| v.as_str()))
            .unwrap_or("");

        let title = obj
            .get("title")
            .and_then(|v| v.as_str())
            .or_else(|| obj.get("entityTitle").and_then(|v| v.as_str()))
            .unwrap_or("");

        let has_pics = obj
            .get("picArr")
            .and_then(|v| v.as_array())
            .map_or(false, |a| !a.is_empty());
        let single_pic = obj
            .get("pic")
            .and_then(|v| v.as_str())
            .map_or(false, |p| !p.is_empty());

        if message.is_empty() && title.is_empty() && !has_pics && !single_pic {
            return None;
        }

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let feed_id = obj
            .get("id")
            .and_then(|v| {
                v.as_str()
                    .map(|s| s.to_string())
                    .or_else(|| v.as_u64().map(|n| n.to_string()))
            })
            .or_else(|| {
                obj.get("entityId").and_then(|v| {
                    v.as_str()
                        .map(|s| s.to_string())
                        .or_else(|| v.as_u64().map(|n| n.to_string()))
                })
            })
            .unwrap_or_else(|| format!("feed_{}_{}", idx, timestamp));

        let raw_avatar = obj
            .get("userAvatar")
            .and_then(|v| v.as_str())
            .or_else(|| {
                user_info
                    .and_then(|u| u.get("userAvatar"))
                    .and_then(|v| v.as_str())
            })
            .unwrap_or("");

        let avatar = if raw_avatar.starts_with("http") {
            raw_avatar.to_string()
        } else if !raw_avatar.is_empty() {
            format!(
                "https://image.coolapk.com/{}",
                raw_avatar.trim_start_matches('/')
            )
        } else {
            String::new()
        };

        let mut pics = Vec::new();
        if let Some(arr) = obj.get("picArr").and_then(|v| v.as_array()) {
            for p in arr {
                if let Some(p_str) = p.as_str() {
                    if p_str.starts_with("http") {
                        pics.push(p_str.to_string());
                    } else {
                        pics.push(format!(
                            "https://image.coolapk.com/{}",
                            p_str.trim_start_matches('/')
                        ));
                    }
                }
            }
        } else if let Some(p_str) = obj.get("pic").and_then(|v| v.as_str()) {
            if p_str.starts_with("http") {
                pics.push(p_str.to_string());
            } else {
                pics.push(format!(
                    "https://image.coolapk.com/{}",
                    p_str.trim_start_matches('/')
                ));
            }
        }

        let device_title = obj
            .get("device_title")
            .and_then(|v| v.as_str())
            .or_else(|| obj.get("device_name").and_then(|v| v.as_str()))
            .unwrap_or("");

        let verify_title = user_info
            .and_then(|u| u.get("verify_title"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let is_top = get_u64_by_keys(obj, &["is_top", "isTop", "top"]);
        let likenum = get_u64_by_keys(obj, &["likenum", "like_num", "likeNum", "likenum_count"]);
        let replynum = get_u64_by_keys(obj, &["replynum", "reply_num", "replyNum", "commentnum", "comment_num", "replynum_count"]);
        let fav_num = get_u64_by_keys(obj, &["favnum", "fav_num", "favorite_num"]);
        let share_num = get_u64_by_keys(obj, &["sharenum", "share_num"]);
        let hit_num = get_u64_by_keys(obj, &["hitnum", "clicknum", "read_num", "view_num", "hit_num"]);

        let user_level = get_str_by_keys(obj, &["userLevel", "level", "user_level"]).unwrap_or_default();

        let target_type = obj
            .get("target_row")
            .and_then(|v| v.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        Some(json!({
            "id": feed_id,
            "username": raw_username,
            "userAvatar": avatar,
            "userLevel": user_level,
            "verifyTitle": verify_title,
            "deviceTitle": device_title,
            "title": title,
            "message": message,
            "pics": pics,
            "infoHtml": obj.get("infoHtml").and_then(|v| v.as_str()).unwrap_or(""),
            "likenum": likenum,
            "replynum": replynum,
            "hitnum": hit_num,
            "favnum": fav_num,
            "sharenum": share_num,
            "isTop": is_top,
            "targetType": target_type,
            "uid": raw_uid,
            "dateline": get_u64_by_keys(obj, &["dateline", "create_time", "lastupdate", "createTime"])
        }))
    }

    fn extract_cleaned_list(json_data: &Value) -> Vec<Value> {
        let mut cleaned_list = Vec::new();
        if let Some(data_arr) = json_data.get("data").and_then(|v| v.as_array()) {
            for (idx, item) in data_arr.iter().enumerate() {
                if let Some(single) = Self::clean_single_feed(item, idx) {
                    cleaned_list.push(single);
                }
                if let Some(entities) = item.get("entities").and_then(|v| v.as_array()) {
                    for (sub_idx, sub) in entities.iter().enumerate() {
                        if let Some(sub_single) = Self::clean_single_feed(sub, sub_idx) {
                            cleaned_list.push(sub_single);
                        }
                    }
                }
            }
        }
        cleaned_list
    }

    /// 用户浏览历史 / 最近访问专用提取：保留 history / recentHistory 实体原始结构，
    /// 仅统一 url（补全前导斜杠）与 logo（http -> https / 相对路径补全），供前端直接渲染跳转。
    /// 不能用 clean_single_feed，因为历史实体没有 username/userInfo，会被当作无效动态丢弃。
    fn extract_history_list(json_data: &Value) -> Vec<Value> {
        let mut list = Vec::new();
        if let Some(data_arr) = json_data.get("data").and_then(|v| v.as_array()) {
            for item in data_arr.iter() {
                let Some(obj) = item.as_object() else { continue };

                let mut cleaned = obj.clone();

                if let Some(url) = obj.get("url").and_then(|v| v.as_str()) {
                    let url = url.trim();
                    if !url.is_empty() && !url.starts_with('/') {
                        cleaned.insert("url".to_string(), json!(format!("/{url}")));
                    }
                }

                if let Some(logo) = obj.get("logo").and_then(|v| v.as_str()) {
                    let logo = logo.trim();
                    let normalized = if logo.starts_with("//") {
                        format!("https:{logo}")
                    } else if logo.starts_with("http://") {
                        logo.replacen("http://", "https://", 1)
                    } else if !logo.is_empty() && !logo.starts_with('/') {
                        format!("https://image.coolapk.com/{}", logo.trim_start_matches('/'))
                    } else {
                        logo.to_string()
                    };
                    cleaned.insert("logo".to_string(), json!(normalized));
                }

                list.push(Value::Object(cleaned));
            }
        }
        list
    }

    // 提取并清洗单个 APK/游戏 实体
    fn clean_single_apk(item: &Value) -> Option<Value> {
        let obj = item.as_object()?;

        // 提取标题与包名，若两者皆无则非合规应用实体
        let title = get_str_by_keys(obj, &["title", "shorttitle", "apkname", "label", "entityTitle"])?;
        let package_name = get_str_by_keys(obj, &["packageName", "apkname", "package_name", "id"])?;

        let raw_icon = get_str_by_keys(
            obj,
            &[
                "apkRomIcon",
                "logo",
                "icon",
                "pic",
                "cover",
                "apkIcon",
                "apkLogo",
                "appIcon",
                "bigIcon",
            ],
        )
        .unwrap_or_default();
        let icon = if raw_icon.starts_with("http") {
            raw_icon
        } else if raw_icon.starts_with("//") {
            format!("https:{}", raw_icon)
        } else if !raw_icon.is_empty() {
            format!("https://image.coolapk.com/{}", raw_icon.trim_start_matches('/'))
        } else {
            String::new()
        };


        let sub_title = get_str_by_keys(obj, &["subTitle", "description", "target_row_title", "comment"]).unwrap_or_default();
        let score = get_str_by_keys(obj, &["score", "star", "rating"]).unwrap_or_else(|| "9.0".to_string());
        let apk_size = get_str_by_keys(obj, &["apksize", "apkSizeFormatted", "size", "apk_size"]).unwrap_or_default();
        let down_num = get_str_by_keys(obj, &["downCount", "downCountFormatted", "downnum", "download_count"]).unwrap_or_default();
        let category = get_str_by_keys(obj, &["catName", "category_title", "category_name", "category", "tag", "apkTypeName"]).unwrap_or_else(|| "应用".to_string());
        let version = get_str_by_keys(obj, &["apkversionname", "apkVersionName", "version", "versionName"]).unwrap_or_default();

        // 酷安 APK 实体 apktype 字段：1=应用，2=游戏
        let apk_type = get_u64_by_keys(obj, &["apktype", "apkType", "apk_type", "type"]);
        let title_lower = title.to_lowercase();
        let cat_lower = category.to_lowercase();

        // 明确的游戏类型判定
        let is_explicit_game = apk_type == 2
            || cat_lower.contains("游戏")
            || cat_lower.contains("手游")
            || cat_lower.contains("动作")
            || cat_lower.contains("射击")
            || cat_lower.contains("角色")
            || cat_lower.contains("策略")
            || cat_lower.contains("卡牌")
            || cat_lower.contains("赛车")
            || cat_lower.contains("竞技")
            || cat_lower.contains("二次元")
            || cat_lower.contains("模拟器");

        // 明确的辅助工具/盒子黑名单判定
        let is_utility_tool = title_lower.contains("游戏盒")
            || title_lower.contains("游戏大厅")
            || title_lower.contains("游戏交易")
            || title_lower.contains("游戏翻译")
            || title_lower.contains("游戏串")
            || title_lower.contains("游戏助手")
            || title_lower.contains("单反相机")
            || cat_lower.contains("相机");

        Some(json!({
            "id": obj.get("id").map(value_to_string).unwrap_or_else(|| package_name.clone()),
            "title": title,
            "packageName": package_name,
            "icon": icon,
            "apkRomIcon": icon,
            "logo": icon,
            "subTitle": sub_title,
            "description": sub_title,
            "score": score,
            "version": version,
            "apkSizeFormatted": apk_size,
            "downCountFormatted": down_num,
            "category": category,
            "isExplicitGame": is_explicit_game,
            "isUtilityTool": is_utility_tool,
            "entityType": obj.get("entityType").and_then(|v| v.as_str()).unwrap_or("apk")
        }))
    }

    // 从酷安响应 JSON 中解构合规 APK/Game 实体列表，支持指定类型模式 (game/app/all)
    fn extract_apk_list(json_data: &Value, filter_mode: &str) -> Vec<Value> {
        let mut apk_list = Vec::new();
        let items = if let Some(arr) = json_data.get("data").and_then(|v| v.as_array()) {
            arr
        } else if let Some(arr) = json_data.as_array() {
            arr
        } else {
            return apk_list;
        };

        for item in items {
            if let Some(obj) = item.as_object() {
                if let Some(clean_apk) = Self::clean_single_apk(item) {
                    let is_explicit_game = clean_apk.get("isExplicitGame").and_then(|v| v.as_bool()).unwrap_or(false);
                    let is_utility_tool = clean_apk.get("isUtilityTool").and_then(|v| v.as_bool()).unwrap_or(false);

                    let should_keep = match filter_mode {
                        "game" => !is_utility_tool,
                        "app" => !is_explicit_game,
                        _ => true,
                    };
                    if should_keep {
                        apk_list.push(clean_apk);
                    }
                }
                if let Some(entities) = obj.get("entities").and_then(|v| v.as_array()) {
                    for entity in entities {
                        if let Some(clean_apk) = Self::clean_single_apk(entity) {
                            let is_explicit_game = clean_apk.get("isExplicitGame").and_then(|v| v.as_bool()).unwrap_or(false);
                            let is_utility_tool = clean_apk.get("isUtilityTool").and_then(|v| v.as_bool()).unwrap_or(false);

                            let should_keep = match filter_mode {
                                "game" => !is_utility_tool,
                                "app" => !is_explicit_game,
                                _ => true,
                            };
                            if should_keep {
                                apk_list.push(clean_apk);
                            }
                        }
                    }
                }
            }
        }
        apk_list
    }




    pub async fn get_by_full_url(&self, full_url: &str) -> Result<Value, String> {
        let token = self.auth.get_app_token()?;

        // 防御性校验：带 App 指纹头 + Token + 登录 Cookie 的请求仅允许发往酷安 API 域
        let parsed = reqwest::Url::parse(full_url).map_err(|e| format!("invalid URL: {e}"))?;
        let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
        if !is_coolapk_host(&host) {
            return Err(format!("disallowed non-Coolapk host: {host}"));
        }

        let res = self
            .client
            .get(full_url)
            .header("X-App-Token", token)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let json_data = response_json(res).await?;
        let cleaned_list = Self::extract_cleaned_list(&json_data);

        Ok(json!({ "code": 200, "data": cleaned_list }))
    }

    pub async fn get(&self, endpoint: &str, page: u32) -> Result<Value, String> {
        let url = format!("https://api.coolapk.com/v6{}?page={}", endpoint, page);
        self.get_by_full_url(&url).await
    }

    // 1. 首页推荐
    pub async fn get_index_v8_feeds(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/main/indexV8", &[("page", page.to_string())])
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    // 2. 24H 热榜 (带有备用降级 API)
    pub async fn get_hot_feeds(&self, page: u32) -> Result<Value, String> {
        let res = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/hotList".to_string()),
                    ("title", "热门".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await;

        let cleaned = match res {
            Ok(ref raw) => Self::extract_cleaned_list(raw),
            Err(_) => Vec::new(),
        };

        if !cleaned.is_empty() {
            return Ok(json!({ "code": 200, "data": cleaned }));
        }

        // 备用热榜 API: /v6/page/dataList?url=%23%2Ffeed%2FstatHotList%3Fperiod%3D24h
        let fallback = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/statHotList?period=24h".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&fallback) }))
    }

    // 3. 科技快讯 (对接官方快讯页 V11_HOME_TAB_NEWS，含平滑降级)
    pub async fn get_latest_feeds(&self, page: u32) -> Result<Value, String> {
        let res = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "V11_HOME_TAB_NEWS".to_string()),
                    ("title", "快讯".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await;

        let cleaned = match res {
            Ok(ref raw) => Self::extract_cleaned_list(raw),
            Err(_) => Vec::new(),
        };

        if !cleaned.is_empty() {
            return Ok(json!({ "code": 200, "data": cleaned }));
        }

        // 备用快讯 API: /v6/page/dataList?url=%23%2Ffeed%2FdigestList%3Ftype%3D1
        let fallback = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/digestList?type=1".to_string()),
                    ("title", "快讯".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await;

        let cleaned = match fallback {
            Ok(ref raw) => Self::extract_cleaned_list(raw),
            Err(_) => Vec::new(),
        };

        if !cleaned.is_empty() {
            return Ok(json!({ "code": 200, "data": cleaned }));
        }

        // 备用最新动态 API: /v6/page/dataList?url=%23%2Ffeed%2FnewestList
        let fallback2 = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/newestList".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&fallback2) }))
    }

    // 右侧栏：热门话题 (话题广场 V9_HOME_TAB_TOPIC)
    pub async fn get_hot_topics(&self) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "V9_HOME_TAB_TOPIC".to_string()),
                    ("page", "1".to_string()),
                ],
            )
            .await?;

        let mut topics = Vec::new();
        if let Some(arr) = raw.get("data").and_then(|v| v.as_array()) {
            for item in arr {
                let obj = match item.as_object() {
                    Some(o) => o,
                    None => continue,
                };
                if obj.get("entityType").and_then(|v| v.as_str()) != Some("topic") {
                    continue;
                }
                let tag = get_str_by_keys(obj, &["title"]).unwrap_or_default();
                if tag.is_empty() {
                    continue;
                }
                let count = get_u64_by_keys(obj, &["hot_num", "commentnum", "comment_num"]);
                topics.push(json!({ "tag": tag, "count": count }));
                if topics.len() >= 5 {
                    break;
                }
            }
        }
        Ok(json!({ "code": 200, "data": topics }))
    }

    // 右侧栏：推荐酷友 (关注页 V9_HOME_TAB_FOLLOW 的"热门酷友"卡片)
    pub async fn get_recommend_users(&self) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "V9_HOME_TAB_FOLLOW".to_string()),
                    ("page", "1".to_string()),
                ],
            )
            .await?;

        let mut users = Vec::new();
        if let Some(arr) = raw.get("data").and_then(|v| v.as_array()) {
            for item in arr {
                let obj = match item.as_object() {
                    Some(o) => o,
                    None => continue,
                };
                if obj.get("entityType").and_then(|v| v.as_str()) != Some("card")
                    || obj.get("entityTemplate").and_then(|v| v.as_str()) != Some("iconGridCard")
                {
                    continue;
                }
                let entities = obj.get("entities").and_then(|v| v.as_array());
                let is_user_card = entities
                    .and_then(|es| es.first())
                    .and_then(|e| e.get("entityType"))
                    .and_then(|v| v.as_str())
                    == Some("user");
                if !is_user_card {
                    continue;
                }
                if let Some(es) = entities {
                    for e in es {
                        let eobj = match e.as_object() {
                            Some(o) => o,
                            None => continue,
                        };
                        if eobj.get("entityType").and_then(|v| v.as_str()) != Some("user") {
                            continue;
                        }
                        let username = get_str_by_keys(eobj, &["username"]).unwrap_or_default();
                        if username.is_empty() {
                            continue;
                        }
                        let uid = get_str_by_keys(eobj, &["uid"]).unwrap_or_default();
                        let raw_avatar =
                            get_str_by_keys(eobj, &["userAvatar"]).unwrap_or_default();
                        let avatar = if raw_avatar.starts_with("http") {
                            raw_avatar
                        } else if !raw_avatar.is_empty() {
                            format!(
                                "https://avatar.coolapk.com/{}",
                                raw_avatar.trim_start_matches('/')
                            )
                        } else {
                            String::new()
                        };
                        let verify_title =
                            get_str_by_keys(eobj, &["verify_title"]).unwrap_or_default();
                        users.push(json!({
                            "uid": uid,
                            "username": username,
                            "avatar": avatar,
                            "verifyTitle": verify_title
                        }));
                    }
                }
                break;
            }
        }
        Ok(json!({ "code": 200, "data": users }))
    }

    // 4. 精选热帖
    pub async fn get_digest_feeds(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/digestList".to_string()),
                    ("title", "精选".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    // 5. 酷图热榜
    pub async fn get_cool_picture_rank(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    (
                        "url",
                        "#/feed/digestList?type=8&message_status=all".to_string(),
                    ),
                    ("title", "酷图热榜".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    // 6. 酷品二手
    pub async fn get_secondhand_feeds(&self, page: u32) -> Result<Value, String> {
        self.get_board_feeds("V11_FIND_GOOD_GOODS_HOME", page).await
    }

    // 7. 全站搜索
    pub async fn search_all(&self, query: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/search",
                &[
                    ("type", "all".to_string()),
                    ("searchValue", query.to_string()),
                    ("page", page.to_string()),
                    ("show_flag", "1".to_string()),
                ],
            )
            .await?;
        wrap_api_data(raw)
    }

    pub async fn get_sub_replies(&self, feed_id: &str, reply_id: &str, page: u32) -> Result<Value, String> {
        let full_url = format!(
            "https://api.coolapk.com/v6/feed/replyList?id={}&rid={}&page={}",
            feed_id, reply_id, page
        );
        let token = self.auth.get_app_token()?;

        let res = self
            .client
            .get(&full_url)
            .header("X-App-Token", token)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let json_data = response_json(res).await?;

        let mut cleaned_replies = Vec::new();
        if let Some(data_arr) = json_data.get("data").and_then(|v| v.as_array()) {
            for r in data_arr {
                if let Some(obj) = r.as_object() {
                    let user_info = obj.get("userInfo").or_else(|| obj.get("user"));
                    let username = obj
                        .get("username")
                        .and_then(|v| v.as_str())
                        .or_else(|| {
                            user_info
                                .and_then(|u| u.get("username"))
                                .and_then(|v| v.as_str())
                        })
                        .unwrap_or("");

                    if username.is_empty() {
                        continue;
                    }

                    let raw_avatar = obj
                        .get("userAvatar")
                        .and_then(|v| v.as_str())
                        .or_else(|| {
                            user_info
                                .and_then(|u| u.get("userAvatar"))
                                .and_then(|v| v.as_str())
                        })
                        .unwrap_or("");

                    let avatar = if raw_avatar.starts_with("http") {
                        raw_avatar.to_string()
                    } else if !raw_avatar.is_empty() {
                        format!(
                            "https://image.coolapk.com/{}",
                            raw_avatar.trim_start_matches('/')
                        )
                    } else {
                        String::new()
                    };

                    let message = obj
                        .get("message")
                        .and_then(|v| v.as_str())
                        .or_else(|| obj.get("description").and_then(|v| v.as_str()))
                        .unwrap_or("");

                    let device_title = obj
                        .get("device_title")
                        .and_then(|v| v.as_str())
                        .or_else(|| obj.get("device_name").and_then(|v| v.as_str()))
                        .unwrap_or("");

                    let user_level = user_info
                        .and_then(|u| u.get("level"))
                        .or_else(|| obj.get("level"))
                        .map(value_to_string)
                        .unwrap_or_default();

                    let item_id = obj.get("id").and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_u64().map(|n| n.to_string()))).unwrap_or_default();
                    let item_rid = obj.get("rid").map(value_to_string).unwrap_or_default();
                    let item_rrid = obj.get("rrid").map(value_to_string).unwrap_or_default();

                    // 严格过滤：只有当 rid 或 rrid 属于 reply_id 时才是该楼层的子回复，排除无关的主楼层评论
                    if item_id == reply_id || (item_rid != reply_id && item_rrid != reply_id) {
                        continue;
                    }

                    let user_action_like = obj.get("userAction").and_then(|ua| ua.get("like")).and_then(|v| v.as_i64()).unwrap_or(0);

                    cleaned_replies.push(json!({
                        "id": item_id,
                        "rid": item_rid,
                        "rrid": item_rrid,
                        "username": username,
                        "rusername": obj.get("rusername").and_then(|v| v.as_str()).unwrap_or(""),
                        "userAvatar": avatar,
                        "userLevel": user_level,
                        "verifyTitle": user_info.and_then(|u| u.get("verify_title")).and_then(|v| v.as_str()).unwrap_or(""),
                        "deviceTitle": device_title,
                        "message": message,
                        "pic": obj.get("pic").and_then(|v| v.as_str()).unwrap_or(""),
                        "infoHtml": obj.get("dateline_text").and_then(|v| v.as_str()).or_else(|| obj.get("infoHtml").and_then(|v| v.as_str())).unwrap_or(""),
                        "likenum": obj.get("likenum").and_then(|v| v.as_u64()).unwrap_or(0),
                        "userAction": { "like": user_action_like },
                        "replyRowsCount": obj.get("replynum").and_then(|v| v.as_u64()).or_else(|| obj.get("replyRowsCount").and_then(|v| v.as_u64())).unwrap_or(0)
                    }));
                }
            }
        }

        Ok(json!({ "code": 200, "data": cleaned_replies }))
    }

    // 8. 楼层评论（具备 hotReplyList 与 replyList 双路自动平滑兜底，彻底解决 403 / 无评论响应问题）
    pub async fn get_feed_replies(&self, feed_id: &str, page: u32) -> Result<Value, String> {
        let hot_res = self
            .api_get(
                "/v6/feed/hotReplyList",
                &[
                    ("id", feed_id.to_string()),
                    ("page", page.to_string()),
                    ("discussMode", "1".to_string()),
                ],
            )
            .await;

        let raw = match hot_res {
            Ok(ref json) if json.get("data").and_then(|v| v.as_array()).map_or(false, |a| !a.is_empty()) => json.clone(),
            _ => {
                // 酷安 replyList 要求 listType=lastupdate_desc（lastupdate 已不返回数据）
                self.api_get(
                    "/v6/feed/replyList",
                    &[
                        ("id", feed_id.to_string()),
                        ("listType", "lastupdate_desc".to_string()),
                        ("page", page.to_string()),
                        ("discussMode", "1".to_string()),
                        ("feedType", "feed".to_string()),
                        ("blockStatus", "0".to_string()),
                        ("fromFeedAuthor", "0".to_string()),
                    ],
                )
                .await
                .unwrap_or(json!({ "code": 200, "data": [] }))
            }
        };

        let mut cleaned_replies = Vec::new();
        if let Some(data_arr) = raw.get("data").and_then(|v| v.as_array()) {
            for r in data_arr {
                if let Some(obj) = r.as_object() {
                    let user_info = obj.get("userInfo").or_else(|| obj.get("user"));
                    let username = obj
                        .get("username")
                        .and_then(|v| v.as_str())
                        .or_else(|| {
                            user_info
                                .and_then(|u| u.get("username"))
                                .and_then(|v| v.as_str())
                        })
                        .unwrap_or("酷友");

                    let raw_avatar = obj
                        .get("userAvatar")
                        .and_then(|v| v.as_str())
                        .or_else(|| {
                            user_info
                                .and_then(|u| u.get("userAvatar"))
                                .and_then(|v| v.as_str())
                        })
                        .unwrap_or("");

                    let avatar = if raw_avatar.starts_with("http") {
                        raw_avatar.to_string()
                    } else if !raw_avatar.is_empty() {
                        format!(
                            "https://image.coolapk.com/{}",
                            raw_avatar.trim_start_matches('/')
                        )
                    } else {
                        String::new()
                    };

                    let message = obj
                        .get("message")
                        .and_then(|v| v.as_str())
                        .or_else(|| obj.get("description").and_then(|v| v.as_str()))
                        .unwrap_or("");

                    let device_title = obj
                        .get("device_title")
                        .and_then(|v| v.as_str())
                        .or_else(|| obj.get("device_name").and_then(|v| v.as_str()))
                        .unwrap_or("");

                    let user_level = user_info
                        .and_then(|u| u.get("level"))
                        .or_else(|| obj.get("level"))
                        .map(value_to_string)
                        .unwrap_or_default();

        let reply_rows = obj.get("replyRows").cloned().unwrap_or(json!([]));
        let reply_rows_count = obj.get("replyRowsCount").and_then(|v| v.as_u64()).unwrap_or(0);

        let user_action_like = obj.get("userAction").and_then(|ua| ua.get("like")).and_then(|v| v.as_i64()).unwrap_or(0);

        cleaned_replies.push(json!({
            "id": obj.get("id").and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_u64().map(|n| n.to_string()))).unwrap_or_default(),
            "fid": obj.get("fid").map(value_to_string).unwrap_or_default(),
            "rid": obj.get("rid").map(value_to_string).unwrap_or_default(),
            "rrid": obj.get("rrid").map(value_to_string).unwrap_or_default(),
            "uid": obj.get("uid").map(value_to_string).or_else(|| user_info.and_then(|u| u.get("uid")).map(value_to_string)).unwrap_or_default(),
            "username": username,
            "rusername": obj.get("rusername").and_then(|v| v.as_str()).unwrap_or(""),
            "userAvatar": avatar,
            "userLevel": user_level,
            "verifyTitle": user_info.and_then(|u| u.get("verify_title")).and_then(|v| v.as_str()).unwrap_or(""),
            "deviceTitle": device_title,
            "message": message,
            "pic": obj.get("pic").and_then(|v| v.as_str()).unwrap_or(""),
            "infoHtml": obj.get("dateline_text").and_then(|v| v.as_str()).or_else(|| obj.get("infoHtml").and_then(|v| v.as_str())).unwrap_or(""),
            "likenum": obj.get("likenum").and_then(|v| v.as_u64()).unwrap_or(0),
            "userAction": { "like": user_action_like },
            "replyRows": reply_rows,
            "replyRowsCount": reply_rows_count,
            "targetRow": obj.get("targetRow").cloned().unwrap_or(json!(null))
        }));
                }
            }
        }

        Ok(json!({ "code": 200, "data": cleaned_replies }))
    }

    pub async fn get_board_feeds(&self, board_tag: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", format!("/page?url={board_tag}")),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    // 获取酷安游戏中心列表/热门与分类榜单
    //
    // 实测确认：酷安已废弃 #/game/* 系列 dataList 路由（返回空数据），
    // 官方接口中唯一可用的游戏数据源是「游戏专项搜索」 GET /v6/search?type=game
    // （返回实体 apktype=2 / apkTypeName=游戏），按分类关键词拉取。
    pub async fn get_game_list(&self, page: u32, game_type: &str) -> Result<Value, String> {
        let query = match game_type {
            "hot" => "手游",
            "new" => "新游戏",
            "single" => "单机游戏",
            "online" => "网游",
            "casual" => "休闲游戏",
            "indie" => "独立游戏",
            _ => "手游",
        };

        let search_raw = self
            .api_get(
                "/v6/search",
                &[
                    ("type", "game".to_string()),
                    ("searchValue", query.to_string()),
                    ("page", page.to_string()),
                    ("show_flag", "1".to_string()),
                ],
            )
            .await?;

        let search_apks = Self::extract_apk_list(&search_raw, "game");
        Ok(json!({ "code": 200, "data": search_apks }))
    }

    // 专项搜索游戏与 APK 软件实体
    pub async fn search_apks(&self, query: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/search",
                &[
                    ("type", "apk".to_string()),
                    ("searchValue", query.to_string()),
                    ("page", page.to_string()),
                    ("show_flag", "1".to_string()),
                ],
            )
            .await?;

        let apks = Self::extract_apk_list(&raw, "all");
        Ok(json!({ "code": 200, "data": apks }))
    }

    // 游戏专项搜索（仅返回游戏实体，type=game）
    pub async fn search_games(&self, query: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/search",
                &[
                    ("type", "game".to_string()),
                    ("searchValue", query.to_string()),
                    ("page", page.to_string()),
                    ("show_flag", "1".to_string()),
                ],
            )
            .await?;

        let apks = Self::extract_apk_list(&raw, "game");
        Ok(json!({ "code": 200, "data": apks }))
    }

    // 获取酷安应用中心列表/热门与分类榜单
    //
    // 实测确认：/v6/page/dataList?url=#/apk/rankList 与 #/apk/newestList 有效，
    // 但 url 上的 type= 参数被服务端忽略（tools/social/media/theme 等均返回默认推荐榜），
    // #/apk/category?catId=... 已废弃（返回空）。分类榜单改用应用搜索 type=apk 拉取。
    pub async fn get_app_list(&self, page: u32, cat: &str) -> Result<Value, String> {
        let page_url = match cat {
            "recommend" => "#/apk/rankList",
            "newest" => "#/apk/newestList",
            _ => "",
        };

        if !page_url.is_empty() {
            let raw = self
                .api_get(
                    "/v6/page/dataList",
                    &[
                        ("url", page_url.to_string()),
                        ("page", page.to_string()),
                    ],
                )
                .await;

            let apks = match raw {
                Ok(ref json_val) => Self::extract_apk_list(json_val, "app"),
                Err(_) => Vec::new(),
            };

            if !apks.is_empty() {
                return Ok(json!({ "code": 200, "data": apks }));
            }
        }

        let query = match cat {
            "tools" => "系统工具",
            "social" => "社交聊天",
            "media" => "影音播放",
            "beauty" => "主题美化",
            "newest" => "应用",
            _ => "常用应用",
        };

        let search_raw = self
            .api_get(
                "/v6/search",
                &[
                    ("type", "apk".to_string()),
                    ("searchValue", query.to_string()),
                    ("page", page.to_string()),
                    ("show_flag", "1".to_string()),
                ],
            )
            .await?;

        let search_apks = Self::extract_apk_list(&search_raw, "app");
        Ok(json!({ "code": 200, "data": search_apks }))
    }

    pub async fn get_image_data_url(&self, source_url: &str) -> Result<String, String> {

        let mut url =
            reqwest::Url::parse(source_url).map_err(|e| format!("invalid image URL: {e}"))?;
        let scheme = url.scheme().to_ascii_lowercase();
        if scheme != "http" && scheme != "https" {
            return Err("only HTTP/HTTPS image schemes are allowed".to_string());
        }

        let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
        if host.is_empty()
            || host == "localhost"
            || host == "127.0.0.1"
            || host == "0.0.0.0"
            || host.starts_with("192.168.")
            || host.starts_with("10.")
            || host.starts_with("172.16.")
            || host.starts_with("172.17.")
            || host.starts_with("172.18.")
            || host.starts_with("172.19.")
            || host.starts_with("172.20.")
            || host.starts_with("172.30.")
            || host.starts_with("172.31.")
        {
            return Err(format!("disallowed private or local host: {host}"));
        }

        if url.scheme() == "http" {
            url.set_scheme("https")
                .map_err(|_| "failed to upgrade image URL to HTTPS".to_string())?;
        }


        let img_client = Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .build()
            .unwrap_or_default();

        // 酷安 API 域下的图片接口（如 /v6/message/showImage）需要完整的 App 指纹头
        // （X-Sdk-Int/X-App-Id/X-App-Version 等）+ Token 认证，必须复用主 client；
        // 其余 CDN 图片用独立浏览器 UA 客户端（浏览器 UA 访问 image.coolapk.com 会被 CDN 放行）
        let mut req = if host == "api.coolapk.com" || host == "api2.coolapk.com" {
            let mut r = self
                .client
                .get(url)
                .header("X-Requested-With", "XMLHttpRequest");
            if let Ok(token) = self.auth.get_app_token() {
                r = r.header("X-App-Token", token);
            }
            r
        } else {
            img_client
                .get(url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .header("Referer", "https://www.coolapk.com/")
        };

        if let Ok(guard) = self.user_cookie.read() {
            if let Some(cookie_str) = guard.as_ref() {
                // 登录 Cookie 只允许发送给酷安官方域；第三方 CDN/图片地址不得携带，
                // 否则发帖人可控的图片链接会把登录凭据送到攻击者服务器
                if is_coolapk_host(&host) {
                    req = req.header("Cookie", cookie_str);
                }
            }
        }

        let response = req
            .send()
            .await
            .map_err(|e| format!("failed to fetch image: {e}"))?;
        let status = response.status();
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("image/jpeg")
            .to_string();
        if !status.is_success() {
            return Err(format!("Coolapk image CDN returned HTTP {status}"));
        }
        if !content_type.starts_with("image/") {
            return Err(format!("unexpected image content type: {content_type}"));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("failed to read image: {e}"))?;
        if bytes.len() > 50 * 1024 * 1024 {
            return Err("image exceeds the 50 MB desktop limit".to_string());
        }
        Ok(format!(
            "data:{content_type};base64,{}",
            BASE64.encode(bytes)
        ))
    }

    /// 抓取外部网页（内置浏览器阅读模式用）：带移动 UA 与已登录 Cookie（仅限酷安官方域），
    /// 返回页面标题与 HTML 正文，由前端安全化渲染。
    /// 注意：必须用独立干净 Client——主 client 携带酷安 App 指纹头（Dalvik UA/X-App-Token），
    /// 网页版服务器遇到这些头会返回空响应。
    pub async fn fetch_external_page(&self, url: &str) -> Result<Value, String> {
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err("仅支持 http(s) 链接".to_string());
        }

        let page_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let parsed_url = reqwest::Url::parse(url).map_err(|e| format!("invalid URL: {e}"))?;
        let is_coolapk_target = parsed_url
            .host_str()
            .map(is_coolapk_host)
            .unwrap_or(false);

        let mut request = page_client
            .get(url)
            .header("User-Agent", MOBILE_UA)
            .header("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");

        // 酷安网页版动态页（www.coolapk.com/feed/xxx）带 X- 系列头时会直接返回 JSON 动态详情
        // （绕过 api.coolapk.com/v6/feed/detail 的验证码风控），其他页面保持 HTML 渲染；
        // 指纹头只允许发给酷安官方域（不能仅靠字符串 contains 判断，防止第三方域伪造路径）
        if is_coolapk_target && url.contains("coolapk.com/feed/") {
            request = request
                .header("X-Requested-With", "XMLHttpRequest")
                .header("X-App-Id", "com.coolapk.market");
        }

        let cookie = self
            .user_cookie
            .read()
            .map_err(|_| "failed to read login state".to_string())?
            .clone();
        if let Some(cookie) = cookie {
            // 仅当目标是酷安官方域时才附带登录 Cookie；
            // 抓取任意第三方网页时绝不携带凭据，防止恶意链接窃取登录态
            if is_coolapk_target {
                if let Ok(header_val) = reqwest::header::HeaderValue::from_str(&cookie) {
                    request = request.header(COOKIE, header_val);
                }
            }
        }

        let resp = request.send().await.map_err(|e| e.to_string())?;
        let status = resp.status().as_u16();
        let body = resp.text().await.map_err(|e| e.to_string())?;
        let title = extract_html_title(&body).unwrap_or_else(|| "外部链接".to_string());
        // 只取正文：剥离导航/页脚/脚本等外壳噪音（酷安 /feed/ 分享页即为纯扫码落地页）
        let content = extract_readable_content(&body);

        Ok(json!({
            "code": 200,
            "data": { "title": title, "html": content, "status": status }
        }))
    }

    pub async fn get_feed_detail(&self, feed_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/feed/detail", &[("id", feed_id.to_string())])
                .await?,
        )
    }

    pub async fn get_hot_replies(&self, feed_id: &str, page: u32) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/feed/hotReplyList",
                &[
                    ("id", feed_id.to_string()),
                    ("page", page.to_string()),
                    ("discussMode", "1".to_string()),
                ],
            )
            .await?,
        )
    }

    pub async fn search_feeds(
        &self,
        query: &str,
        page: u32,
        sort_type: &str,
    ) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/search",
                &[
                    ("type", "feed".to_string()),
                    ("searchValue", query.to_string()),
                    ("page", page.to_string()),
                    ("sortType", sort_type.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    pub async fn get_user_space(&self, uid: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/user/space", &[("uid", uid.to_string())])
                .await?,
        )
    }

    pub async fn get_user_profile(&self, uid: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/user/profile", &[("uid", uid.to_string())])
                .await?,
        )
    }

    pub async fn get_user_follow_nodes(&self, uid: &str) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/user/customNodeList", &[("uid", uid.to_string())])
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    pub async fn get_user_feeds(
        &self,
        uid: &str,
        page: u32,
        feed_type: &str,
    ) -> Result<Value, String> {
        let feed_endpoint = match feed_type {
            "picture" | "coolpic" => "pictureList",
            "reply" => "replyList",
            "rating" => "apkRatingList",
            "ershou" => "ershouList",
            "fav" | "favorite" => "favList",
            _ => "feedList",
        };
        let raw = self
            .api_get(
                &format!("/v6/user/{feed_endpoint}"),
                &[
                    ("uid", uid.to_string()),
                    ("page", page.to_string()),
                    ("isIncludeTop", "1".to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 收藏列表（需登录）
    /// 数据来源: GET /v6/favorite/list，type 支持 feed/apk/album
    pub async fn get_favorite_list(&self, fav_type: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/favorite/list",
                &[
                    ("type", fav_type.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 收藏单（收藏夹）列表
    /// 数据来源: GET /v6/collection/list?uid={uid}
    pub async fn get_collection_list(&self, uid: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/collection/list",
                &[("uid", uid.to_string()), ("page", page.to_string())],
            )
            .await?;
        let mut collections = Vec::new();
        if let Some(arr) = raw.get("data").and_then(|v| v.as_array()) {
            for item in arr {
                let obj = match item.as_object() {
                    Some(o) => o,
                    None => continue,
                };
                if obj.get("entityType").and_then(|v| v.as_str()) != Some("collection") {
                    continue;
                }
                let id = get_str_by_keys(obj, &["id", "collectionId"]).unwrap_or_default();
                let title = get_str_by_keys(obj, &["title", "name"]).unwrap_or_default();
                if id.is_empty() || title.is_empty() {
                    continue;
                }
                let raw_cover = get_str_by_keys(obj, &["cover", "pic", "logo"]).unwrap_or_default();
                let cover = if raw_cover.starts_with("http") {
                    raw_cover
                } else if !raw_cover.is_empty() {
                    format!(
                        "https://image.coolapk.com/{}",
                        raw_cover.trim_start_matches('/')
                    )
                } else {
                    String::new()
                };
                collections.push(json!({
                    "id": id,
                    "title": title,
                    "cover": cover,
                    "description": get_str_by_keys(obj, &["description", "summary"]).unwrap_or_default(),
                    "itemNum": get_u64_by_keys(obj, &["itemNum", "itemnum", "count"]),
                    "favnum": get_u64_by_keys(obj, &["favnum", "fav_num"]),
                    "follownum": get_u64_by_keys(obj, &["follownum", "follow_num"])
                }));
            }
        }
        Ok(json!({ "code": 200, "data": collections }))
    }

    /// 收藏单内容列表
    /// 数据来源: GET /v6/collection/itemList?id={collectionId}
    pub async fn get_collection_item_list(&self, collection_id: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/collection/itemList",
                &[("id", collection_id.to_string()), ("page", page.to_string())],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 收藏单详情
    /// 数据来源: GET /v6/collection/detail?id={collectionId}
    pub async fn get_collection_detail(&self, collection_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/collection/detail", &[("id", collection_id.to_string())])
                .await?,
        )
    }

    /// 关注/点赞收藏单（酷安 v6 写接口统一使用 GET）
    async fn collection_action(&self, path: &str, collection_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(path, &[("id", collection_id.to_string())]).await?,
        )
    }

    pub async fn follow_collection(&self, collection_id: &str) -> Result<Value, String> {
        self.collection_action("/v6/collection/follow", collection_id).await
    }

    pub async fn unfollow_collection(&self, collection_id: &str) -> Result<Value, String> {
        self.collection_action("/v6/collection/unFollow", collection_id).await
    }

    pub async fn like_collection(&self, collection_id: &str) -> Result<Value, String> {
        self.collection_action("/v6/collection/like", collection_id).await
    }

    pub async fn unlike_collection(&self, collection_id: &str) -> Result<Value, String> {
        self.collection_action("/v6/collection/unLike", collection_id).await
    }

    /// 关注/取消关注看看号
    /// 数据来源: GET /v6/dyh/follow?dyhId={dyhId}
    pub async fn follow_dyh(&self, dyh_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/dyh/follow", &[("dyhId", dyh_id.to_string())])
                .await?,
        )
    }

    pub async fn unfollow_dyh(&self, dyh_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/dyh/unFollow", &[("dyhId", dyh_id.to_string())])
                .await?,
        )
    }

    /// 动态转发列表
    /// 数据来源: GET /v6/feed/forwardList?id={feedId}&type={feedType}&page={page}
    pub async fn get_feed_forward_list(
        &self,
        feed_id: &str,
        feed_type: &str,
        page: u32,
    ) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/feed/forwardList",
                &[
                    ("id", feed_id.to_string()),
                    ("type", feed_type.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 动态点赞列表
    /// 数据来源: GET /v6/feed/likeList?id={feedId}&listType=lastupdate_desc&page={page}
    pub async fn get_feed_like_list(&self, feed_id: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/feed/likeList",
                &[
                    ("id", feed_id.to_string()),
                    ("listType", "lastupdate_desc".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 动态修改历史
    /// 数据来源: GET /v6/feed/changeHistoryList?id={feedId}
    pub async fn get_feed_change_history(&self, feed_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/feed/changeHistoryList", &[("id", feed_id.to_string())])
                .await?,
        )
    }

    /// 话题搜索
    /// 数据来源: GET /v6/feed/searchTag?q={query}&page={page}
    pub async fn search_tags(&self, query: &str, page: u32) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/feed/searchTag",
                &[("q", query.to_string()), ("page", page.to_string())],
            )
            .await?,
        )
    }

    /// 关注/取消关注话题
    /// 数据来源: GET /v6/feed/followTag?tag={tag}
    pub async fn follow_tag(&self, tag: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/feed/followTag", &[("tag", tag.to_string())])
                .await?,
        )
    }

    pub async fn unfollow_tag(&self, tag: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/feed/unFollowTag", &[("tag", tag.to_string())])
                .await?,
        )
    }

    /// 话题设备（数码）动态列表
    /// 数据来源: GET /v6/topic/deviceFeedList?tag={tag}&page={page}&listType=lastupdate_desc
    pub async fn get_device_feed_list(&self, tag: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/topic/deviceFeedList",
                &[
                    ("tag", tag.to_string()),
                    ("page", page.to_string()),
                    ("listType", "lastupdate_desc".to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 问答（Q&A）列表
    /// 数据来源: GET /v6/question/answerList?id={feedId}&sort={sort}&page={page}
    pub async fn get_question_answers(
        &self,
        feed_id: &str,
        sort: &str,
        page: u32,
    ) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/question/answerList",
                &[
                    ("id", feed_id.to_string()),
                    ("sort", sort.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 投票评论列表
    /// 数据来源: GET /v6/vote/commentList?fid={feedId}&page={page}
    pub async fn get_vote_comments(&self, feed_id: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/vote/commentList",
                &[("fid", feed_id.to_string()), ("page", page.to_string())],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 用户浏览历史
    /// 数据来源: GET /v6/user/hitHistoryList?page={page}
    pub async fn get_hit_history(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/user/hitHistoryList", &[("page", page.to_string())])
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_history_list(&raw) }))
    }

    /// 用户最近历史（访问过的用户/话题等）
    /// 数据来源: GET /v6/user/recentHistoryList?page={page}
    pub async fn get_recent_history(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/user/recentHistoryList", &[("page", page.to_string())])
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_history_list(&raw) }))
    }

    /// 用户搜索
    /// 数据来源: GET /v6/user/search?q={query}&page={page}
    pub async fn search_users(&self, query: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/user/search",
                &[("q", query.to_string()), ("page", page.to_string())],
            )
            .await?;
        let mut users = Vec::new();
        if let Some(arr) = raw.get("data").and_then(|v| v.as_array()) {
            for item in arr {
                let obj = match item.as_object() {
                    Some(o) => o,
                    None => continue,
                };
                if obj.get("entityType").and_then(|v| v.as_str()) != Some("user") {
                    continue;
                }
                let uid = get_str_by_keys(obj, &["uid"]).unwrap_or_default();
                let username = get_str_by_keys(obj, &["username"]).unwrap_or_default();
                if uid.is_empty() || username.is_empty() {
                    continue;
                }
                let raw_avatar = get_str_by_keys(obj, &["userAvatar"]).unwrap_or_default();
                let avatar = if raw_avatar.starts_with("http") {
                    raw_avatar
                } else if !raw_avatar.is_empty() {
                    format!(
                        "https://avatar.coolapk.com/{}",
                        raw_avatar.trim_start_matches('/')
                    )
                } else {
                    String::new()
                };
                users.push(json!({
                    "uid": uid,
                    "username": username,
                    "avatar": avatar,
                    "verifyTitle": get_str_by_keys(obj, &["verify_title"]).unwrap_or_default(),
                    "level": get_u64_by_keys(obj, &["level"]),
                    "bio": get_str_by_keys(obj, &["bio", "sign"]).unwrap_or_default(),
                    "fans": get_u64_by_keys(obj, &["fans", "fansnum"]),
                    "follow": get_u64_by_keys(obj, &["follow", "follownum"])
                }));
            }
        }
        Ok(json!({ "code": 200, "data": users }))
    }

    /// 搜索联想（应用类）
    /// 数据来源: GET /v6/search/suggestSearchWordsNew?searchValue={query}&type=app
    pub async fn get_search_suggestions_app(&self, query: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/search/suggestSearchWordsNew",
                &[("searchValue", query.to_string()), ("type", "app".to_string())],
            )
            .await?,
        )
    }

    /// 搜索话题
    /// 数据来源: GET /v6/search?type=feedTopic&searchValue={query}&page={page}
    pub async fn search_feed_topics(&self, query: &str, page: u32) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/search",
                &[
                    ("type", "feedTopic".to_string()),
                    ("searchValue", query.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?,
        )
    }

    /// 产品详情（按名称）
    /// 数据来源: GET /v6/product/detail?name={name}
    pub async fn get_product_detail_by_name(&self, name: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/product/detail", &[("name", name.to_string())])
                .await?,
        )
    }

    /// 加载个人页卡片配置
    /// 数据来源: GET /v6/account/loadConfig?key=my_page_card_config
    pub async fn get_load_config(&self) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/account/loadConfig",
                &[("key", "my_page_card_config".to_string())],
            )
            .await?,
        )
    }

    pub async fn get_topic_detail(&self, tag: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/topic/newTagDetail", &[("tag", tag.to_string())])
                .await?,
        )
    }

    pub async fn get_topic_feeds(&self, tag: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/topic/tagFeedList",
                &[("tag", tag.to_string()), ("page", page.to_string())],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    pub async fn get_topic_hub_data(&self, sub_url: &str, page: u32) -> Result<Value, String> {
        let clean_sub_url = sub_url.trim_start_matches('#');
        
        // 识别分类 Tag 维度 (1: 手机数码, 2: 电脑外设, 3: 游戏生活)
        let tag_type = if clean_sub_url.contains("tagType=1") || clean_sub_url.contains("type=1") {
            Some(1)
        } else if clean_sub_url.contains("tagType=2") || clean_sub_url.contains("type=2") {
            Some(2)
        } else if clean_sub_url.contains("tagType=3") || clean_sub_url.contains("type=3") {
            Some(3)
        } else {
            None
        };

        // 如果选择具体领域维度分类，使用酷安原生 /v6/search?type=topic 接口精准拉取专属话题
        if let Some(tt) = tag_type {
            let search_term = match tt {
                1 => "手机",
                2 => "电脑",
                3 => "游戏",
                _ => "数码",
            };

            let search_raw = self
                .api_get(
                    "/v6/search",
                    &[
                        ("type", "topic".to_string()),
                        ("searchValue", search_term.to_string()),
                        ("page", page.to_string()),
                        ("show_flag", "1".to_string()),
                    ],
                )
                .await?;

            let data = search_raw.get("data").cloned().unwrap_or(json!([]));
            return Ok(json!({ "code": 200, "data": data }));
        }

        // 基础排行榜维度：热门/最受关注/最新
        let mut query = vec![("page", page.to_string())];
        if clean_sub_url.contains("sort=follow") {
            query.push(("sort", "follow".to_string()));
        } else if clean_sub_url.contains("sort=new") {
            query.push(("sort", "new".to_string()));
        } else {
            query.push(("sort", "hot".to_string()));
        }

        let raw = self.api_get("/v6/topic/tagList", &query).await;

        let res = match raw {
            Ok(val) if val.get("data").and_then(|d| d.as_array()).map_or(false, |arr| !arr.is_empty()) => val,
            _ => {
                let page_url = if clean_sub_url.is_empty() || clean_sub_url == "/main/tagList" {
                    "/topic/tagList".to_string()
                } else {
                    clean_sub_url.to_string()
                };
                self.api_get(
                    "/v6/page/dataList",
                    &[("url", page_url), ("page", page.to_string())],
                )
                .await?
            }
        };

        let mut data = res.get("data").cloned().unwrap_or(json!([]));

        // 对最受关注维度按照关注人数 follower_num 进行二次精准倒序重排
        if clean_sub_url.contains("sort=follow") {
            if let Some(arr) = data.as_array_mut() {
                arr.sort_by(|a, b| {
                    let f_a = a.get("follower_num").and_then(|v| v.as_u64())
                        .or_else(|| a.get("follownum").and_then(|v| v.as_u64())).unwrap_or(0);
                    let f_b = b.get("follower_num").and_then(|v| v.as_u64())
                        .or_else(|| b.get("follownum").and_then(|v| v.as_u64())).unwrap_or(0);
                    f_b.cmp(&f_a)
                });
            }
        }

        Ok(json!({ "code": 200, "data": data }))
    }

    pub async fn get_app_detail(&self, package_name: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/apk/detail", &[("id", package_name.to_string())])
                .await?,
        )
    }

    pub async fn get_notification_count(&self) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/notification/checkCount", &[]).await?)
    }

    pub async fn get_notifications(
        &self,
        notification_type: &str,
        page: u32,
    ) -> Result<Value, String> {
        // 酷安官方已下线旧通知路径（atme/comment/like/feedlike，返回 404），
        // 现行有效路径以官方 UWP 客户端 UriHelper 为准：
        //   list=评论回复、atMeList=@我、atCommentMeList=评论@我、
        //   feedLikeList=动态点赞、contactsFollowList=新关注
        let notification_type = match notification_type {
            "atMeList" | "list" | "atCommentMeList" | "feedLikeList" | "contactsFollowList" => {
                notification_type
            }
            "atme" => "atMeList",
            "comment" => "list",
            "like" | "feedlike" => "feedLikeList",
            _ => "atMeList",
        };
        wrap_api_data(
            self.api_get(
                &format!("/v6/notification/{notification_type}"),
                &[("page", page.to_string())],
            )
            .await?,
        )
    }

    pub async fn list_messages(&self, page: u32) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/message/list", &[("page", page.to_string())])
                .await?,
        )
    }

    pub async fn list_chat_history(&self, ukey: &str, page: u32) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/message/chat",
                &[("ukey", ukey.to_string()), ("page", page.to_string())],
            )
            .await?,
        )
    }

    /// 发送私信（需登录）
    /// 酷安 v6 私信接口要求：POST + multipart/form-data（字段 message）+ X-Requested-With: XMLHttpRequest。
    /// GET + query 方式服务端无法识别内容（报"私信内容不能为空"）。
    pub async fn send_private_message(&self, uid: &str, message: &str) -> Result<Value, String> {
        let token = self.auth.get_app_token()?;
        let url = format!(
            "https://api.coolapk.com/v6/message/send?uid={}",
            uid
        );
        let form = reqwest::multipart::Form::new().text("message", message.to_string());

        let mut request = self
            .client
            .request(reqwest::Method::POST, url)
            .header("X-App-Token", token)
            .header("X-Requested-With", "XMLHttpRequest")
            .multipart(form);

        let cookie = self
            .user_cookie
            .read()
            .map_err(|_| "failed to read login state".to_string())?
            .clone();
        if let Some(cookie) = cookie {
            if let Ok(header_val) = reqwest::header::HeaderValue::from_str(&cookie) {
                request = request.header(COOKIE, header_val);
            }
        }

        let response = request.send().await.map_err(|e| e.to_string())?;
        wrap_api_data(response_json(response).await?)
    }

    /// 发送图片私信（需登录）
    /// 与 send_private_message 相同接口，multipart 字段为 message_pic
    pub async fn send_private_image(&self, uid: &str, message_pic: &str) -> Result<Value, String> {
        let token = self.auth.get_app_token()?;
        let url = format!(
            "https://api.coolapk.com/v6/message/send?uid={}",
            uid
        );
        let form = reqwest::multipart::Form::new().text("message_pic", message_pic.to_string());

        let mut request = self
            .client
            .request(reqwest::Method::POST, url)
            .header("X-App-Token", token)
            .header("X-Requested-With", "XMLHttpRequest")
            .multipart(form);

        let cookie = self
            .user_cookie
            .read()
            .map_err(|_| "failed to read login state".to_string())?
            .clone();
        if let Some(cookie) = cookie {
            if let Ok(header_val) = reqwest::header::HeaderValue::from_str(&cookie) {
                request = request.header(COOKIE, header_val);
            }
        }

        let response = request.send().await.map_err(|e| e.to_string())?;
        wrap_api_data(response_json(response).await?)
    }

    /// 标记私信会话已读（需登录）
    /// 数据来源: GET /v6/message/read?ukey={ukey}
    pub async fn read_message(&self, ukey: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/message/read", &[("ukey", ukey.to_string())])
                .await?,
        )
    }

    /// 收藏/取消收藏动态（需登录，酷安 v6 写接口使用 GET）
    async fn favorite_action(&self, path: &str, id: &str) -> Result<Value, String> {
        wrap_api_data(self.api_get(path, &[("id", id.to_string())]).await?)
    }

    pub async fn favorite_feed(&self, feed_id: &str) -> Result<Value, String> {
        self.favorite_action("/v6/feed/favorite", feed_id).await
    }

    pub async fn unfavorite_feed(&self, feed_id: &str) -> Result<Value, String> {
        self.favorite_action("/v6/feed/unFavorite", feed_id).await
    }

    /// 上传图片（发动态/发私信配图），返回图片 URL（需登录）
    /// 旧接口 /v6/feed/uploadImage 已被酷安服务端下线（旧版本不再支持图片上传），
    /// 改走新版 OSS 直传链路：ossUploadPrepare 获取凭证 → 直传阿里云 OSS → 返回图片地址。
    /// to_uid：私信场景需传对方 uid（dir=message），发动态（dir=feed）可不传。
    pub async fn upload_image(
        &self,
        image_bytes: &[u8],
        file_name: &str,
        content_type: &str,
        dir: &str,
        to_uid: Option<&str>,
    ) -> Result<Value, String> {
        let my_uid = self
            .user_cookie
            .read()
            .ok()
            .and_then(|g| g.clone())
            .and_then(|c| {
                c.split(';')
                    .find_map(|kv| {
                        let mut parts = kv.trim().splitn(2, '=');
                        match (parts.next(), parts.next()) {
                            (Some("uid"), Some(v)) => Some(v.trim().to_string()),
                            _ => None,
                        }
                    })
            })
            .ok_or_else(|| "未登录，无法上传图片".to_string())?;
        let target_uid = match to_uid {
            Some(u) => u.to_string(),
            None => my_uid,
        };

        // 1. 计算文件 MD5 并请求上传凭证
        let md5_hex = {
            use md5::{Digest, Md5};
            let mut hasher = Md5::new();
            hasher.update(image_bytes);
            format!("{:x}", hasher.finalize())
        };
        let resolution = "0x0".to_string();
        let file_list = json!([{
            "name": file_name,
            "resolution": resolution,
            "md5": md5_hex
        }])
        .to_string();

        // 发动态配图用 image/feed，私信图片用 message/message
        let upload_bucket = if dir == "feed" { "image" } else { dir }.to_string();

        let prepare_form = reqwest::multipart::Form::new()
            .text("uploadBucket", upload_bucket)
            .text("uploadDir", dir.to_string())
            .text("is_anonymous", "0")
            .text("uploadFileList", file_list)
            .text("toUid", target_uid);

        let mut prepare_request = self
            .client
            .request(
                reqwest::Method::POST,
                "https://api.coolapk.com/v6/upload/ossUploadPrepare",
            )
            .header("X-Requested-With", "XMLHttpRequest")
            .multipart(prepare_form);
        if let Ok(token) = self.auth.get_app_token() {
            prepare_request = prepare_request.header("X-App-Token", token);
        }
        if let Ok(guard) = self.user_cookie.read() {
            if let Some(cookie) = guard.as_ref() {
                if let Ok(header_val) = reqwest::header::HeaderValue::from_str(cookie) {
                    prepare_request = prepare_request.header(COOKIE, header_val);
                }
            }
        }
        let prepare_res = prepare_request.send().await.map_err(|e| e.to_string())?;
        let prepare_json = response_json(prepare_res).await?;
        

        let file_info = prepare_json
            .get("data")
            .and_then(|d| d.get("fileInfo"))
            .and_then(|f| f.as_array())
            .and_then(|arr| arr.first())
            .ok_or_else(|| "上传凭证获取失败（fileInfo 缺失）".to_string())?;
        let prepare_info = prepare_json
            .get("data")
            .and_then(|d| d.get("uploadPrepareInfo"))
            .ok_or_else(|| "上传凭证获取失败（uploadPrepareInfo 缺失）".to_string())?;

        let upload_file_name = file_info
            .get("uploadFileName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let bucket = prepare_info
            .get("bucket")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let end_point = prepare_info
            .get("endPoint")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let access_key_id = prepare_info
            .get("accessKeyId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let access_key_secret = prepare_info
            .get("accessKeySecret")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let security_token = prepare_info
            .get("securityToken")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if upload_file_name.is_empty()
            || bucket.is_empty()
            || end_point.is_empty()
            || access_key_id.is_empty()
            || access_key_secret.is_empty()
        {
            return Err(format!(
                "上传凭证不完整: {:?}",
                prepare_json.get("data").map(|d| d.to_string()).unwrap_or_default()
            ));
        }

        // 2. 直传 OSS（PUT Object，OSS V1 签名）
        let content_md5_b64 = {
            use md5::{Digest, Md5};
            use base64::Engine;
            let mut hasher = Md5::new();
            hasher.update(image_bytes);
            base64::engine::general_purpose::STANDARD.encode(hasher.finalize())
        };
        let now = chrono::Utc::now().format("%a, %d %b %Y %H:%M:%S GMT").to_string();

        // 上传成功回调（与官方客户端一致）
        let callback = "eyJjYWxsYmFja0JvZHlUeXBlIjoiYXBwbGljYXRpb25cL2pzb24iLCJjYWxsYmFja0hvc3QiOiJhcGkuY29vbGFway5jb20iLCJjYWxsYmFja1VybCI6Imh0dHBzOlwvXC9hcGkuY29vbGFway5jb21cL3Y2XC9jYWxsYmFja1wvbW9iaWxlT3NzVXBsb2FkU3VjY2Vzc0NhbGxiYWNrP2NoZWNrQXJ0aWNsZUNvdmVyUmVzb2x1dGlvbj0wJnZlcnNpb25Db2RlPTIxMDIwMzEiLCJjYWxsYmFja0JvZHkiOiJ7XCJidWNrZXRcIjoke2J1Y2tldH0sXCJvYmplY3RcIjoke29iamVjdH0sXCJoYXNQcm9jZXNzXCI6JHt4OnZhcjF9fSJ9";
        let callback_var = "eyJ4OnZhcjEiOiJmYWxzZSJ9";

        let resource = format!("/{}/{}", bucket, upload_file_name);
        let string_to_sign = format!(
            "PUT\n{}\n{}\n{}\nx-oss-callback:{}\nx-oss-callback-var:{}\nx-oss-security-token:{}\n{}",
            content_md5_b64,
            content_type,
            now,
            callback,
            callback_var,
            security_token,
            resource
        );

        use base64::Engine;
        use hmac::{Hmac, Mac};
        use sha1::Sha1;
        type HmacSha1 = Hmac<Sha1>;
        let mut mac = HmacSha1::new_from_slice(access_key_secret.as_bytes())
            .map_err(|e| e.to_string())?;
        mac.update(string_to_sign.as_bytes());
        let signature = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
        let authorization = format!("OSS {}:{}", access_key_id, signature);

        let oss_host = if end_point.starts_with("http") {
            end_point
        } else {
            format!("https://{}", end_point)
        };
        let oss_host = oss_host
            .replace("https://", "")
            .replace("http://", "");
        let oss_url = format!("https://{}.{}/{}", bucket, oss_host, upload_file_name);

        let mut oss_request = self
            .client
            .request(reqwest::Method::PUT, &oss_url)
            .header("Authorization", &authorization)
            .header("Content-MD5", &content_md5_b64)
            .header("Content-Type", content_type)
            .header("Date", &now)
            .header("x-oss-callback", callback)
            .header("x-oss-callback-var", callback_var)
            .header("x-oss-security-token", &security_token)
            .body(image_bytes.to_vec());

        let _ = &mut oss_request;

        let oss_res = oss_request.send().await.map_err(|e| e.to_string())?;
        let oss_status = oss_res.status();
        let oss_body = oss_res
            .text()
            .await
            .unwrap_or_default();

        if !oss_status.is_success() {
            return Err(format!(
                "OSS 直传失败 (HTTP {}): {}",
                oss_status,
                &oss_body
            ));
        }

        // 3. 解析 OSS 回调返回的图片地址
        if let Ok(v) = serde_json::from_str::<Value>(&oss_body) {
            let url = v
                .get("data")
                .and_then(|d| d.get("url"))
                .and_then(|u| u.as_str())
                .unwrap_or("")
                .to_string();
            if !url.is_empty() {
                return Ok(json!({ "code": 200, "data": url }));
            }
        }
        // 部分场景 OSS 直接返回 URL 字符串
        let trimmed = oss_body.trim().trim_matches('"').to_string();
        if !trimmed.is_empty() && !trimmed.contains("Error") {
            return Ok(json!({ "code": 200, "data": trimmed }));
        }
        Err(format!("OSS 直传响应异常: {}", &oss_body))
    }

    /// 用户黑名单（需登录）
    /// 数据来源: GET /v6/user/blackList?page={page}
    pub async fn get_black_list(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/user/blackList", &[("page", page.to_string())])
            .await?;
        Self::wrap_user_list_result(raw, "获取黑名单失败")
    }

    /// 用户屏蔽列表（需登录）
    /// 数据来源: GET /v6/user/ignoreList?page={page}
    pub async fn get_ignore_list(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/user/ignoreList", &[("page", page.to_string())])
            .await?;
        Self::wrap_user_list_result(raw, "获取屏蔽列表失败")
    }

    /// 受限用户列表（需登录）
    /// 数据来源: GET /v6/user/limitList?page={page}
    pub async fn get_limit_list(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/user/limitList", &[("page", page.to_string())])
            .await?;
        Self::wrap_user_list_result(raw, "获取受限列表失败")
    }

    /// 黑名单/屏蔽列表数据为「用户实体」而非 Feed，不能走 clean_single_feed
    ///（该函数会因缺少 message/title/pic 把所有用户卡片丢弃，导致列表恒为空）。
    /// 这里仅解包外层 data 并展开可能的 card 包装实体，保留用户卡片原始字段。
    fn extract_user_list(json_data: &Value) -> Vec<Value> {
        let mut users = Vec::new();
        if let Some(data_arr) = json_data.get("data").and_then(|v| v.as_array()) {
            for item in data_arr.iter() {
                if let Some(entities) = item.get("entities").and_then(|v| v.as_array()) {
                    users.extend(entities.iter().cloned());
                } else {
                    users.push(item.clone());
                }
            }
        }
        users
    }

    fn wrap_user_list_result(raw: Value, fail_msg: &str) -> Result<Value, String> {
        if let Some(status) = raw.get("status").and_then(|v| v.as_i64()) {
            if status < 0 {
                let msg = raw
                    .get("message")
                    .or_else(|| raw.get("error"))
                    .and_then(Value::as_str)
                    .unwrap_or(fail_msg);
                return Err(msg.to_string());
            }
        }
        Ok(json!({ "code": 200, "data": Self::extract_user_list(&raw) }))
    }

    /// 拉黑/移出黑名单（需登录，GET 写接口）
    /// 实测：POST 返回 404 请求方式错误，v6 写接口一律 GET + uid 查询参数。
    async fn blacklist_action(&self, path: &str, uid: &str) -> Result<Value, String> {
        wrap_api_data(self.api_get(path, &[("uid", uid.to_string())]).await?)
    }

    pub async fn add_to_black_list(&self, uid: &str) -> Result<Value, String> {
        self.blacklist_action("/v6/user/addToBlackList", uid).await
    }

    pub async fn remove_from_black_list(&self, uid: &str) -> Result<Value, String> {
        self.blacklist_action("/v6/user/removeFromBlackList", uid).await
    }

    /// 屏蔽/取消屏蔽用户（需登录，GET 写接口）
    pub async fn add_to_ignore_list(&self, uid: &str) -> Result<Value, String> {
        self.blacklist_action("/v6/user/addToIgnoreList", uid).await
    }

    pub async fn remove_from_ignore_list(&self, uid: &str) -> Result<Value, String> {
        self.blacklist_action("/v6/user/removeFromIgnoreList", uid).await
    }

    /// 应用下载链接
    /// 数据来源: GET /v6/apk/url?id={packageName}
    pub async fn get_apk_url(&self, package_name: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/apk/url", &[("id", package_name.to_string())])
                .await?,
        )
    }

    /// 应用二维码
    /// 数据来源: GET /v6/apk/qr?id={packageName}
    pub async fn get_apk_qr(&self, package_name: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/apk/qr", &[("id", package_name.to_string())])
                .await?,
        )
    }

    /// 应用更新检查
    /// 数据来源: GET /v6/apk/checkUpdate?pkgs={packageNames}
    pub async fn check_update(&self, pkgs: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/apk/checkUpdate", &[("pkgs", pkgs.to_string())])
                .await?,
        )
    }

    /// 点赞/取消点赞通用实现：酷安 v6 API 点赞必须使用 GET（POST 返回"请求方式错误"），
    /// 且未登录时返回 status=401，这里显式转成错误以便前端回滚乐观更新。
    async fn like_action(&self, path: &str, id: &str) -> Result<Value, String> {
        let res = self.api_get(path, &[("id", id.to_string())]).await?;
        if let Some(status) = res.get("status").and_then(|v| v.as_i64()) {
            if status == 401 || status == 403 {
                let msg = res
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("请先登录后再点赞")
                    .to_string();
                return Err(format!("{msg}（当前未登录或登录已失效）"));
            }
            if status < 0 {
                let msg = res
                    .get("message")
                    .or_else(|| res.get("error"))
                    .and_then(Value::as_str)
                    .unwrap_or("点赞失败")
                    .to_string();
                return Err(msg);
            }
        }
        wrap_api_data(res)
    }

    pub async fn like_feed(&self, feed_id: &str) -> Result<Value, String> {
        self.like_action("/v6/feed/like", feed_id).await
    }

    pub async fn unlike_feed(&self, feed_id: &str) -> Result<Value, String> {
        self.like_action("/v6/feed/unlike", feed_id).await
    }

    /// 发表评论；rid 非空时表示回复楼中楼（某条评论）
    /// 注意：酷安 v6 写接口统一使用 GET（POST 返回"请求方式错误"）
    pub async fn reply_feed(
        &self,
        feed_id: &str,
        message: &str,
        rid: Option<&str>,
    ) -> Result<Value, String> {
        let mut query: Vec<(&str, String)> = vec![
            ("id", feed_id.to_string()),
            ("type", "feed".to_string()),
            ("message", message.to_string()),
        ];
        if let Some(rid) = rid {
            query.push(("rid", rid.to_string()));
        }
        wrap_api_data(self.api_get("/v6/feed/reply", &query).await?)
    }

    pub async fn follow_user(&self, uid: &str) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/user/follow", &[("uid", uid.to_string())]).await?)
    }

    pub async fn unfollow_user(&self, uid: &str) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/user/unfollow", &[("uid", uid.to_string())]).await?)
    }

    pub async fn get_following_feeds(&self, page: u32) -> Result<Value, String> {
        // 1. 优先尝试 page/dataList 关注流接口（全量关注 Feed）
        if let Ok(raw) = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "/user/followFeedList".to_string()),
                    ("title", "关注".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await
        {
            let cleaned = Self::extract_cleaned_list(&raw);
            if !cleaned.is_empty() {
                return Ok(json!({ "code": 200, "data": cleaned }));
            }
        }

        // 2. 备用尝试 /v6/feed/followFeedList 关注流接口
        if let Ok(raw) = self
            .api_get(
                "/v6/feed/followFeedList",
                &[("page", page.to_string())],
            )
            .await
        {
            let cleaned = Self::extract_cleaned_list(&raw);
            if !cleaned.is_empty() {
                return Ok(json!({ "code": 200, "data": cleaned }));
            }
        }

        // 3. 备用尝试主页关注页接口 /v6/main/indexV8?type=follow
        let raw = self
            .api_get(
                "/v6/main/indexV8",
                &[("type", "follow".to_string()), ("page", page.to_string())],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    pub async fn get_follow_user_list(&self, uid: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/user/followList",
                &[("uid", uid.to_string()), ("page", page.to_string())],
            )
            .await?;

        let list = raw.get("data").cloned().unwrap_or(Value::Array(Vec::new()));
        Ok(json!({ "code": 200, "data": list }))
    }

    pub async fn create_feed(&self, message: &str, pic: Option<&str>) -> Result<Value, String> {
        let mut query: Vec<(&str, String)> = vec![("message", message.to_string())];
        if let Some(pic) = pic {
            if !pic.is_empty() {
                query.push(("pic", pic.to_string()));
            }
        }
        wrap_api_data(self.api_get("/v6/feed/createFeed", &query).await?)
    }

    pub async fn check_login_status(&self) -> Result<Value, String> {
        let mut query_params: Vec<(&str, String)> = Vec::new();
        if let Ok(guard) = self.user_cookie.read() {
            if let Some(cookie_str) = guard.as_ref() {
                for item in cookie_str.split(';') {
                    let parts: Vec<&str> = item.trim().split('=').collect();
                    if parts.len() == 2 && parts[0] == "uid" {
                        query_params.push(("uid", parts[1].to_string()));
                        break;
                    }
                }
            }
        }

        let query_refs: Vec<(&str, String)> = query_params.iter().map(|(k, v)| (*k, v.clone())).collect();
        let res = self.api_get("/v6/user/space", &query_refs).await?;
        if let Some(data) = res.get("data") {
            return Ok(json!({ "code": 200, "data": data }));
        }
        Ok(res)
    }

    pub fn clear_user_cookie(&self) -> Result<(), String> {
        let mut stored = self
            .user_cookie
            .write()
            .map_err(|_| "failed to lock login state".to_string())?;
        *stored = None;
        self.save_cookie_file("");
        Ok(())
    }

    pub async fn login_by_account(&self, account: &str, password: &str) -> Result<Value, String> {
        use md5::{Digest, Md5};
        let mut hasher = Md5::new();
        hasher.update(password.as_bytes());
        let md5_pwd = format!("{:x}", hasher.finalize());

        let res = self
            .api_post(
                "/v6/account/login",
                &[],
                &[
                    ("login", account.to_string()),
                    ("password", password.to_string()),
                    ("md5_pass", md5_pwd.clone()),
                    ("md5_password", md5_pwd),
                ],
            )
            .await?;

        if let Some(msg) = res.get("message").and_then(Value::as_str) {
            if msg.contains("unsupported") || res.get("status").and_then(Value::as_i64) == Some(403) {
                return Err("酷安官方现已停用第三方原生账号密码 API (403 Unsupported)，请切换至【SESSID 凭据】标签导入凭据登录。".to_string());
            }
        }

        self.extract_and_set_session(&res);
        wrap_api_data(res)
    }

    pub async fn send_sms_vcode(&self, mobile: &str) -> Result<Value, String> {
        let first_try = self
            .api_post(
                "/v6/account/sendVcode",
                &[],
                &[
                    ("mobile", mobile.to_string()),
                    ("type", "login".to_string()),
                ],
            )
            .await;

        match first_try {
            Ok(res) => {
                if let Some(msg) = res.get("message").and_then(Value::as_str) {
                    if msg.contains("unsupported") || res.get("status").and_then(Value::as_i64) == Some(403) {
                        return Err("酷安官方已停用第三方纯验证码直连 API (403 API Unsupported)，请使用【SESSID 凭据】快捷登录。".to_string());
                    }
                }
                wrap_api_data(res)
            }
            Err(err1) => Err(format!("验证码下发失败: {err1}")),
        }
    }

    pub async fn login_by_mobile(&self, mobile: &str, vcode: &str) -> Result<Value, String> {
        let res = self
            .api_post(
                "/v6/account/loginByMobile",
                &[],
                &[
                    ("mobile", mobile.to_string()),
                    ("vcode", vcode.to_string()),
                    ("code", vcode.to_string()),
                ],
            )
            .await?;

        if let Some(msg) = res.get("message").and_then(Value::as_str) {
            if msg.contains("unsupported") || res.get("status").and_then(Value::as_i64) == Some(403) {
                return Err("酷安官方已停用第三方手机号登录 API (403 API Unsupported)，请使用【SESSID 凭据】快捷登录。".to_string());
            }
        }

        self.extract_and_set_session(&res);
        wrap_api_data(res)
    }

    fn extract_and_set_session(&self, response: &Value) {
        if let Some(data) = response.get("data") {
            let sessid = data
                .get("sessid")
                .or_else(|| data.get("token"))
                .and_then(|v| v.as_str());
            let uid = data
                .get("uid")
                .or_else(|| data.get("id"))
                .and_then(|v| v.as_str());

            if let (Some(s), Some(u)) = (sessid, uid) {
                let cookie_str = format!("SESSID={}; uid={}", s, u);
                let _ = self.set_user_cookie(cookie_str);
            } else if let Some(s) = sessid {
                let cookie_str = format!("SESSID={}", s);
                let _ = self.set_user_cookie(cookie_str);
            }
        }
    }

    /// 获取首页 Tab 配置（关注/头条/热榜/快讯/话题等频道 + 热门搜索）
    /// 数据来源: GET /v6/main/init
    pub async fn get_tab_config(&self) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/main/init", &[]).await?)
    }

    /// 搜索候选词（输入联想）
    /// 数据来源: GET /v6/search/suggestSearchWordsNew
    pub async fn get_search_suggestions(&self, query: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/search/suggestSearchWordsNew",
                &[("searchValue", query.to_string())],
            )
            .await?,
        )
    }

    /// 话题详情（旧版 tagDetail，仍可用，部分场景返回字段与 newTagDetail 互补）
    /// 数据来源: GET /v6/topic/tagDetail
    pub async fn get_topic_detail_v7(&self, tag: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/topic/tagDetail", &[("tag", tag.to_string())])
                .await?,
        )
    }

    /// 产品（数码）详情
    /// 数据来源: GET /v6/product/detail
    pub async fn get_product_detail(&self, product_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/product/detail", &[("id", product_id.to_string())])
                .await?,
        )
    }

    /// 产品（数码）所属动态列表（讨论/问答/图文/视频/交易）
    /// 数据来源: GET /v6/page/dataList?url=/page?url=/product/feedList
    pub async fn get_product_feeds(&self, product_id: &str, feed_type: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "/page?url=/product/feedList".to_string()),
                    ("id", product_id.to_string()),
                    ("type", feed_type.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 看看号（官方号）详情
    /// 数据来源: GET /v6/dyh/detail
    pub async fn get_dyh_detail(&self, dyh_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/dyh/detail", &[("dyhId", dyh_id.to_string())])
                .await?,
        )
    }

    /// 看看号（官方号）动态列表
    /// 数据来源: GET /v6/dyhArticle/list
    pub async fn get_dyh_feeds(
        &self,
        dyh_id: &str,
        feed_type: &str,
        page: u32,
    ) -> Result<Value, String> {
        let feed_type = match feed_type {
            "square" => "square",
            _ => "all",
        };
        let raw = self
            .api_get(
                "/v6/dyhArticle/list",
                &[
                    ("dyhId", dyh_id.to_string()),
                    ("type", feed_type.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 应用所属动态列表（点评/讨论）
    /// 数据来源: GET /v6/page/dataList?url=#/feed/apkCommentList
    pub async fn get_apk_feeds(&self, package_name: &str, sort_type: &str, page: u32) -> Result<Value, String> {
        let sort = match sort_type {
            "lastupdate_desc" | "dateline_desc" | "popular" => sort_type,
            _ => "lastupdate_desc",
        };
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/apkCommentList".to_string()),
                    ("id", package_name.to_string()),
                    ("sort", sort.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 检查登录态（比 user/space 更轻量的专用接口）
    /// 数据来源: GET /v6/account/checkLoginInfo
    pub async fn check_login_info(&self) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/account/checkLoginInfo", &[]).await?)
    }

    #[allow(dead_code)]
    async fn post_id_action(&self, path: &str, field: &str, value: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_post(path, &[], &[(field, value.to_string())])
                .await?,
        )
    }

    /// 应用集列表
    /// 数据来源: GET /v6/album/list
    pub async fn get_album_list(&self, list_type: &str, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/album/list", &[("listType", list_type.to_string()), ("page", page.to_string())]).await?;
        Ok(json!({ "code": 200, "data": raw.get("data").cloned().unwrap_or(json!([])) }))
    }

    /// 搜索应用集
    /// 数据来源: GET /v6/album/search
    pub async fn search_albums(&self, query: &str, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/album/search", &[("q", query.to_string()), ("page", page.to_string())]).await?;
        Ok(json!({ "code": 200, "data": raw.get("data").cloned().unwrap_or(json!([])) }))
    }

    /// 应用集详情
    /// 数据来源: GET /v6/album/detail
    pub async fn get_album_detail(&self, album_id: &str) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/album/detail", &[("id", album_id.to_string())]).await?)
    }

    /// 应用集评论
    /// 数据来源: GET /v6/album/replyList
    pub async fn get_album_replies(&self, album_id: &str, page: u32) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/album/replyList", &[("id", album_id.to_string()), ("page", page.to_string())]).await?)
    }

    /// 头条列表
    /// 数据来源: GET /v6/main/headline
    pub async fn get_headline_feeds(&self, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/main/headline", &[("page", page.to_string())]).await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 更新列表
    /// 数据来源: GET /v6/main/updateList
    pub async fn get_update_list(&self, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/main/updateList", &[("page", page.to_string())]).await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 编辑精选
    /// 数据来源: GET /v6/feed/editorChoiceList
    pub async fn get_editor_choice_feeds(&self, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/feed/editorChoiceList", &[("page", page.to_string())]).await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 应用发现者列表
    /// 数据来源: GET /v6/apk/discovererList
    pub async fn get_apk_discoverers(&self, package_name: &str, page: u32) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/apk/discovererList", &[("id", package_name.to_string()), ("page", page.to_string())]).await?)
    }

    /// 推荐应用列表
    /// 数据来源: GET /v6/apk/recommendList
    pub async fn get_apk_recommend_list(&self, apk_type: &str, title: &str, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/apk/recommendList", &[("apkType", apk_type.to_string()), ("title", title.to_string()), ("page", page.to_string())]).await?;
        let apks = Self::extract_apk_list(&raw, "all");
        Ok(json!({ "code": 200, "data": apks }))
    }

    /// 应用礼品列表
    /// 数据来源: GET /v6/apk/giftList
    pub async fn get_apk_gift_list(&self, apk_id: Option<&str>, page: u32) -> Result<Value, String> {
        let mut params: Vec<(&str, String)> = vec![("page", page.to_string())];
        if let Some(apk_id) = apk_id {
            params.push(("apkId", apk_id.to_string()));
        }
        wrap_api_data(self.api_get("/v6/apk/giftList", &params).await?)
    }

    /// 下载版本列表
    /// 数据来源: GET /v6/apk/downloadVersionList
    pub async fn get_download_version_list(&self, package_name: &str) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/apk/downloadVersionList", &[("id", package_name.to_string())]).await?)
    }

    /// 图片列表(按标签)
    /// 数据来源: GET /v6/picture/list
    pub async fn get_picture_list(&self, tag: &str, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/picture/list", &[("tag", tag.to_string()), ("page", page.to_string())]).await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 用户评分列表
    /// 数据来源: GET /v6/user/apkRatingList
    pub async fn get_user_rating_list(&self, uid: &str, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/user/apkRatingList", &[("uid", uid.to_string()), ("page", page.to_string())]).await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 按开发者搜索应用
    /// 数据来源: GET /v6/apk/search?searchType=developer
    pub async fn search_apks_by_developer(&self, developer: &str, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/apk/search", &[("searchType", "developer".to_string()), ("developer", developer.to_string()), ("page", page.to_string())]).await?;
        let apks = Self::extract_apk_list(&raw, "all");
        Ok(json!({ "code": 200, "data": apks }))
    }

    /// 按标签搜索应用
    /// 数据来源: GET /v6/apk/search?searchType=tag
    pub async fn search_apks_by_tag(&self, tag: &str, apk_type: &str, page: u32) -> Result<Value, String> {
        let raw = self.api_get("/v6/apk/search", &[("searchType", "tag".to_string()), ("tag", tag.to_string()), ("apkType", apk_type.to_string()), ("page", page.to_string())]).await?;
        let apks = Self::extract_apk_list(&raw, "all");
        Ok(json!({ "code": 200, "data": apks }))
    }
}

/// 生成稳定的设备码：基于机器身份（主机名 + 用户名 + 固定盐）派生，
/// 同一台机器上每次启动结果一致，避免酷安把频繁变更的设备指纹
/// 判定为"网络环境异常"而拒绝点赞/评论等写操作。
fn load_or_create_device_code() -> String {
    let identity = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .or_else(|_| std::env::var("HOST"))
        .unwrap_or_else(|_| "unknown-host".to_string());
    let user = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "unknown-user".to_string());
    let salt = "coolapk-desktop:v1";

    let mut hasher = Md5::new();
    hasher.update(format!("{salt}|{identity}|{user}").as_bytes());
    let digest = hasher.finalize();

    // 仿照官方 Android 设备码格式（字母数字），保持稳定
    let b64 = BASE64.encode(digest);
    let code = format!(
        "coolapk-desktop:{}:{}",
        b64.trim_end_matches('=').chars().take(24).collect::<String>(),
        user.chars().take(8).collect::<String>()
    );
    code
}

fn value_to_string(value: &Value) -> String {
    value
        .as_str()
        .map(str::to_owned)
        .or_else(|| value.as_u64().map(|number| number.to_string()))
        .or_else(|| value.as_i64().map(|number| number.to_string()))
        .unwrap_or_default()
}

fn wrap_api_data(response: Value) -> Result<Value, String> {
    if let Some(err_msg) = response.get("error").and_then(Value::as_str) {
        if !err_msg.is_empty() {
            return Err(err_msg.to_string());
        }
    }
    
    if let Some(message) = response.get("message").and_then(Value::as_str) {
        let code = response.get("code").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(200);
        let status = response.get("status").and_then(|v| v.as_i64()).unwrap_or(1);

        if (code != 200 && code != 0 && code != 1) || status < 0 {
            return Err(message.to_string());
        }
    }

    if let Some(status) = response.get("status").and_then(|v| v.as_i64()) {
        if status < 0 {
            let msg = response.get("message").or_else(|| response.get("error")).and_then(Value::as_str).unwrap_or("酷安服务端拒绝请求");
            return Err(msg.to_string());
        }
    }

    let data = response.get("data").cloned().unwrap_or(response);
    Ok(json!({ "code": 200, "data": data }))
}

async fn response_json(response: reqwest::Response) -> Result<Value, String> {
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("failed to read Coolapk response: {e}"))?;

    if !status.is_success() {
        let detail = if body.trim().is_empty() {
            "empty response body".to_string()
        } else {
            body.chars().take(300).collect()
        };
        return Err(format!("Coolapk API returned HTTP {status}: {detail}"));
    }

    serde_json::from_str(&body).map_err(|e| format!("invalid Coolapk JSON response: {e}"))
}

#[cfg(test)]
#[path = "client_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "api_tests.rs"]
mod api_tests;
