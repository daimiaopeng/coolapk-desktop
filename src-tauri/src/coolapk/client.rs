use crate::coolapk::auth::CoolapkAuth;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use reqwest::header::{COOKIE, HeaderMap, HeaderValue, USER_AGENT};
use reqwest::{Client, Method};
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct CoolapkClient {
    client: Client,
    auth: RwLock<CoolapkAuth>,
    user_cookie: RwLock<Option<String>>,
    cookie_file: RwLock<Option<PathBuf>>,
    device_profile: RwLock<DeviceProfile>,
    device_code: RwLock<String>,
}

/// 设备信息覆盖配置（由设置页"设备信息"下发，作用于所有 API 请求头）。
/// 字段为 None 时使用客户端默认值；全部留空表示恢复默认。
/// 注意：X-App-Device（设备码）与 X-App-Token 属于账号绑定指纹，不允许覆盖。
#[derive(Clone, Debug, Default, serde::Deserialize)]
pub struct DeviceProfile {
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub sdk_int: Option<String>,
    #[serde(default)]
    pub locale: Option<String>,
    #[serde(default)]
    pub app_version: Option<String>,
    #[serde(default)]
    pub app_code: Option<String>,
    #[serde(default)]
    pub api_version: Option<String>,
    #[serde(default)]
    pub dark_mode: Option<String>,
}

/// 移动端 UA：酷安网页（账号安全页/移动版页面）在桌面 UA 下会白屏或重定向
const MOBILE_UA: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

/// 从 HTML 中提取 <title> 文本（大小写不敏感，无正则依赖）
fn extract_html_title(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let start = lower.find("<title>")? + "<title>".len();
    let end = lower[start..].find("</title>")? + start;
    let title = html[start..end].trim().to_string();
    if title.is_empty() { None } else { Some(title) }
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
        &[
            "script", "style", "nav", "header", "footer", "aside", "iframe", "form", "noscript",
        ],
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

fn first_value_by_keys<'a>(obj: &'a serde_json::Map<String, Value>, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().find_map(|key| obj.get(*key))
}

fn has_non_empty_json_value(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(_) | Value::Number(_) => true,
        Value::String(value) => !value.trim().is_empty(),
        Value::Array(values) => values.iter().any(has_non_empty_json_value),
        Value::Object(values) => values.values().any(has_non_empty_json_value),
    }
}

fn has_any_non_empty_field(obj: &serde_json::Map<String, Value>, keys: &[&str]) -> bool {
    first_value_by_keys(obj, keys).map_or(false, has_non_empty_json_value)
}

fn copy_first_field(cleaned: &mut Value, obj: &serde_json::Map<String, Value>, output_key: &str, keys: &[&str]) {
    let Some(value) = first_value_by_keys(obj, keys) else {
        return;
    };
    if let Some(cleaned_obj) = cleaned.as_object_mut() {
        cleaned_obj.insert(output_key.to_string(), value.clone());
    }
}

impl CoolapkClient {
    /// 设备码策略：
    /// - 未登录（游客态）：每台电脑首次启动随机生成一次并持久化，之后固定
    /// - 已登录：使用账号绑定的固定设备码（首次登录生成随机并持久化，之后固定）
    /// 设备码与 Token V3 绑定，切换时 auth 签名同步切换。
    pub fn new() -> Self {
        let device_code = generate_random_device_code();
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Dalvik/2.1.0 (Linux; U; Android 16; 23113RKC6C Build/AQ3A.250226.002) +CoolMarket/16.2.0-2604201-universal"),
        );
        headers.insert("X-Sdk-Int", HeaderValue::from_static("35"));
        headers.insert("X-Sdk-Locale", HeaderValue::from_static("zh-CN"));
        headers.insert("X-App-Mode", HeaderValue::from_static("universal"));
        headers.insert("X-App-Channel", HeaderValue::from_static("coolapk"));
        headers.insert("X-App-Id", HeaderValue::from_static("com.coolapk.market"));
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
            auth: RwLock::new(CoolapkAuth::new(device_code.clone())),
            user_cookie: RwLock::new(None),
            cookie_file: RwLock::new(None),
            device_profile: RwLock::new(DeviceProfile::default()),
            device_code: RwLock::new(device_code),
        }
    }

    /// 获取当前设备码签名（Token V3 与设备码绑定，切换设备码后自动换签名）
    fn get_token(&self) -> Result<String, String> {
        self.auth
            .read()
            .map_err(|_| "failed to lock auth state".to_string())?
            .get_app_token()
    }

    /// 同步设备码：已登录使用该账号绑定的固定设备码，
    /// 未登录使用本机持久化的游客设备码（每台电脑首次生成后固定）。
    /// 两者都会持久化，重启后保持不变。
    pub fn sync_device_code(&self) {
        let uid = self.current_uid();
        let code = if let Some(uid) = uid {
            self.account_device_code(&uid)
        } else {
            self.guest_device_code()
        };
        if let Ok(mut auth) = self.auth.write() {
            auth.set_device_code(code.clone());
        }
        if let Ok(mut guard) = self.device_code.write() {
            *guard = code;
        }
    }

    fn current_uid(&self) -> Option<String> {
        self.get_user_cookie()?.split(';').find_map(|kv| {
            let mut parts = kv.trim().splitn(2, '=');
            match (parts.next(), parts.next()) {
                (Some("uid"), Some(v)) => {
                    let uid = v.trim().to_string();
                    if uid.is_empty() { None } else { Some(uid) }
                }
                _ => None,
            }
        })
    }

    /// 账号绑定的固定设备码：按官方规范算法生成并绑定到当前账号。
    /// - 账号已有且格式有效的 deviceCode：沿用记录值
    /// - 无记录或历史旧格式：自动迁移生成符合官方规范的标准设备码并持久化。
    fn account_device_code(&self, uid: &str) -> String {
        let mut accounts = self.load_accounts();
        if let Some(pos) = accounts
            .iter()
            .position(|a| a.get("uid").and_then(|v| v.as_str()) == Some(uid))
        {
            if let Some(code) = accounts[pos]
                .get("deviceCode")
                .and_then(|v| v.as_str())
                .filter(|c| is_valid_device_code(c))
            {
                return code.to_string();
            }
            let code = generate_device_code_for_id(uid);
            if let Some(obj) = accounts[pos].as_object_mut() {
                obj.insert("deviceCode".to_string(), json!(code.clone()));
            }
            self.save_accounts(&accounts);
            return code;
        }
        let code = generate_device_code_for_id(uid);
        accounts.push(json!({ "uid": uid, "cookie": "", "deviceCode": code.clone() }));
        self.save_accounts(&accounts);
        code
    }

    /// 游客设备码：首次生成符合官方规范的标准设备码后固定持久化
    fn guest_device_code(&self) -> String {
        let mut root = self.load_accounts_root();
        if let Some(code) = root
            .get("guestDeviceCode")
            .and_then(|v| v.as_str())
            .filter(|c| is_valid_device_code(c))
        {
            return code.to_string();
        }
        let code = generate_random_device_code();
        root["guestDeviceCode"] = json!(code.clone());
        self.save_accounts_root(&root);
        code
    }

    /// 将用户自定义设备信息覆盖到请求头（None 字段保留默认值）。
    /// X-App-Device 由当前生效设备码决定（游客随机/账号固定），此处统一写入。
    fn apply_device_profile(
        &self,
        request: reqwest::RequestBuilder,
    ) -> Result<reqwest::RequestBuilder, String> {
        let profile = self
            .device_profile
            .read()
            .map_err(|_| "failed to read device profile".to_string())?;
        let device_code = self
            .device_code
            .read()
            .map_err(|_| "failed to read device code".to_string())?
            .clone();
        let mut request = request;
        if let Ok(header_value) = HeaderValue::from_str(&device_code) {
            request = request.header("X-App-Device", header_value);
        }
        for (header_name, value) in [
            ("X-Sdk-Int", profile.sdk_int.as_ref()),
            ("X-Sdk-Locale", profile.locale.as_ref()),
            ("X-App-Version", profile.app_version.as_ref()),
            ("X-App-Code", profile.app_code.as_ref()),
            ("X-Api-Version", profile.api_version.as_ref()),
            ("X-Dark-Mode", profile.dark_mode.as_ref()),
        ] {
            if let Some(value) = value.filter(|s| !s.trim().is_empty()) {
                if let Ok(header_value) = HeaderValue::from_str(value) {
                    request = request.header(header_name, header_value);
                }
            }
        }
        if let Some(app_code) = profile.app_code.as_ref().filter(|s| !s.trim().is_empty()) {
            if let Ok(header_value) = HeaderValue::from_str(app_code) {
                request = request.header("X-App-Supported", header_value);
            }
        }
        if let Some(ua) = profile.user_agent.as_ref().filter(|s| !s.trim().is_empty()) {
            if let Ok(header_value) = HeaderValue::from_str(ua) {
                request = request.header(USER_AGENT, header_value);
            }
        }
        Ok(request)
    }

    /// 更新设备信息覆盖配置（由设置页调用；传空字段即恢复默认）
    pub fn update_device_profile(&self, profile: DeviceProfile) {
        if let Ok(mut guard) = self.device_profile.write() {
            *guard = profile;
        }
    }

    /// 当前设备信息（设置页展示用）：登录态 + 生效设备码
    pub fn get_device_info(&self) -> Result<Value, String> {
        let code = self
            .device_code
            .read()
            .map_err(|_| "failed to read device code".to_string())?
            .clone();
        let logged_in = self
            .user_cookie
            .read()
            .map_err(|_| "failed to read login state".to_string())?
            .is_some();
        Ok(json!({ "code": 200, "data": { "loggedIn": logged_in, "deviceCode": code } }))
    }

    /// 绑定 Cookie 持久化文件路径，并载入上次保存的登录凭据
    /// 凭据统一存 JSON（accounts.json，含全部账户与当前登录 uid），
    /// 兼容迁移旧版 session_cookie.txt。
    pub fn persist_cookie_to(&self, path: PathBuf) {
        {
            let mut guard = match self.cookie_file.write() {
                Ok(g) => g,
                Err(_) => return,
            };
            *guard = Some(path.clone());
        }

        let dir = path.parent().map(|p| p.to_path_buf());
        let accounts_path = dir.as_ref().map(|d| d.join("accounts.json"));
        if let Some(ap) = accounts_path {
            if let Ok(content) = std::fs::read_to_string(&ap) {
                if let Ok(root) = serde_json::from_str::<Value>(&content) {
                    let last_uid = root
                        .get("lastLoginUid")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let cookie = root
                        .get("accounts")
                        .and_then(|a| a.as_array())
                        .and_then(|arr| {
                            arr.iter().find(|a| {
                                a.get("uid").and_then(|v| v.as_str()) == Some(last_uid.as_str())
                            })
                        })
                        .and_then(|a| a.get("cookie"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    if !cookie.is_empty() {
                        if let Ok(mut stored) = self.user_cookie.write() {
                            *stored = Some(cookie);
                        }
                        self.sync_device_code();
                        return;
                    }
                }
            }
        }

        // 旧版 txt 迁移：首次升级时把 txt 中的 cookie 转为 JSON 账户
        if let Ok(content) = std::fs::read_to_string(&path) {
            let content = content.trim().to_string();
            if !content.is_empty() {
                let uid = content
                    .split(';')
                    .find_map(|kv| {
                        let mut parts = kv.trim().splitn(2, '=');
                        match (parts.next(), parts.next()) {
                            (Some("uid"), Some(v)) => Some(v.trim().to_string()),
                            _ => None,
                        }
                    })
                    .unwrap_or_default();
                if !uid.is_empty() {
                    let entry = json!({
                        "uid": uid,
                        "username": "",
                        "userAvatar": "",
                        "cookie": content,
                    });
                    let root = json!({
                        "lastLoginUid": uid,
                        "accounts": [entry],
                    });
                    if let Some(dir) = dir {
                        if let Ok(json_str) = serde_json::to_string_pretty(&root) {
                            let _ = std::fs::write(dir.join("accounts.json"), json_str);
                        }
                    }
                    if let Ok(mut stored) = self.user_cookie.write() {
                        *stored = Some(content);
                    }
                }
                let _ = std::fs::remove_file(&path);
            }
        }
        self.sync_device_code();
    }

    #[allow(dead_code)]
    fn save_cookie_file(&self, _cookie: &str) {
        // 凭据统一由 accounts.json 管理，旧 txt 文件不再写入
    }

    /// 读取当前登录凭据（可能为 None）
    pub fn get_user_cookie(&self) -> Option<String> {
        self.user_cookie.read().ok().and_then(|g| g.clone())
    }

    /// 账户库文件路径（与 session_cookie.txt 同目录，统一 JSON 存储）
    fn accounts_file_path(&self) -> Option<std::path::PathBuf> {
        let path = self.cookie_file.read().ok()?.clone()?;
        let dir = path.parent()?.to_path_buf();
        Some(dir.join("accounts.json"))
    }

    /// 读取账户库根对象（{ lastLoginUid, accounts: [...] }）
    fn load_accounts_root(&self) -> Value {
        let Some(path) = self.accounts_file_path() else {
            return json!({ "lastLoginUid": "", "accounts": [] });
        };
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|c| serde_json::from_str::<Value>(&c).ok())
            .unwrap_or_else(|| json!({ "lastLoginUid": "", "accounts": [] }))
    }

    fn save_accounts_root(&self, root: &Value) {
        if let Some(path) = self.accounts_file_path() {
            if let Ok(json) = serde_json::to_string_pretty(root) {
                let _ = std::fs::write(&path, json);
            }
        }
    }

    /// 读取全部已保存账户（uid/username/userAvatar/cookie）
    fn load_accounts(&self) -> Vec<Value> {
        self.load_accounts_root()
            .get("accounts")
            .and_then(|a| a.as_array().cloned())
            .unwrap_or_default()
    }

    fn save_accounts(&self, accounts: &[Value]) {
        // 保留 root 上的其他字段（如 guestDeviceCode 游客设备码）
        let mut root = self.load_accounts_root();
        root["accounts"] = Value::Array(accounts.to_vec());
        self.save_accounts_root(&root);
    }

    fn set_last_login_uid(&self, uid: &str) {
        let mut root = self.load_accounts_root();
        root["lastLoginUid"] = json!(uid);
        self.save_accounts_root(&root);
    }

    /// 列出已保存的账户（不含 Cookie 原文，仅展示信息）
    pub async fn list_accounts(&self) -> Result<Value, String> {
        let accounts = self.load_accounts();
        let list: Vec<Value> = accounts
            .iter()
            .map(|a| {
                json!({
                    "uid": a.get("uid").cloned().unwrap_or_default(),
                    "username": a.get("username").cloned().unwrap_or_default(),
                    "userAvatar": a.get("userAvatar").cloned().unwrap_or_default(),
                })
            })
            .collect();
        Ok(json!({ "code": 200, "data": list }))
    }

    /// 切换登录到已保存的账户
    pub async fn login_as(&self, uid: &str) -> Result<Value, String> {
        let accounts = self.load_accounts();
        let target = accounts
            .iter()
            .find(|a| a.get("uid").and_then(|v| v.as_str()) == Some(uid))
            .cloned()
            .ok_or_else(|| "未找到该账户的已保存凭据".to_string())?;
        let cookie = target
            .get("cookie")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if cookie.is_empty() {
            return Err("该账户凭据为空".to_string());
        }

        let previous_cookie = self.get_user_cookie();
        let previous_uid = self
            .load_accounts_root()
            .get("lastLoginUid")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        self.set_user_cookie(cookie.clone())?;
        match self.check_login_info().await {
            Ok(result) => {
                let data = result.get("data").unwrap_or(&result);
                let validated_uid = data
                    .get("uid")
                    .or_else(|| data.get("id"))
                    .map(value_to_string)
                    .unwrap_or_default();
                if validated_uid != uid {
                    self.restore_login_state(previous_cookie, &previous_uid)?;
                    return Err("保存的账户凭据与目标 UID 不一致，请重新登录该账户".to_string());
                }

                let username = data
                    .get("username")
                    .and_then(Value::as_str)
                    .or_else(|| target.get("username").and_then(Value::as_str))
                    .unwrap_or("");
                let avatar = data
                    .get("userAvatar")
                    .or_else(|| data.get("avatar"))
                    .and_then(Value::as_str)
                    .or_else(|| target.get("userAvatar").and_then(Value::as_str))
                    .unwrap_or("");
                self.save_account(uid, username, avatar, &cookie).await
            }
            Err(error) => {
                self.restore_login_state(previous_cookie, &previous_uid)?;
                Err(format!("切换账户失败，凭据无效或已过期: {error}"))
            }
        }
    }

    fn restore_login_state(
        &self,
        previous_cookie: Option<String>,
        previous_uid: &str,
    ) -> Result<(), String> {
        if let Some(cookie) = previous_cookie {
            self.set_user_cookie(cookie)?;
            self.set_last_login_uid(previous_uid);
        } else {
            self.clear_user_cookie()?;
        }
        Ok(())
    }

    /// 保存（或更新）一个账户并切换为当前登录
    pub async fn save_account(
        &self,
        uid: &str,
        username: &str,
        user_avatar: &str,
        cookie: &str,
    ) -> Result<Value, String> {
        if uid.trim().is_empty() || uid == "0" || uid == "10000" {
            return Err("账户 UID 无效".to_string());
        }
        let safe_cookie = Self::sanitize_cookie(cookie);
        if !Self::has_valid_session_cookie(&safe_cookie) {
            return Err("账户凭据缺少有效的 SESSID".to_string());
        }
        let mut accounts = self.load_accounts();
        let entry = json!({
            "uid": uid,
            "username": username,
            "userAvatar": user_avatar,
            "cookie": safe_cookie.clone(),
        });
        if let Some(pos) = accounts
            .iter()
            .position(|a| a.get("uid").and_then(|v| v.as_str()) == Some(uid))
        {
            accounts[pos] = entry;
        } else {
            accounts.push(entry);
        }
        self.save_accounts(&accounts);
        self.set_user_cookie(safe_cookie)?;
        self.set_last_login_uid(uid);
        Ok(json!({
            "code": 200,
            "data": { "uid": uid, "username": username, "userAvatar": user_avatar }
        }))
    }

    /// 将已经通过服务端校验的当前内存会话写入账户库。
    pub async fn persist_current_account(
        &self,
        uid: &str,
        username: &str,
        user_avatar: &str,
    ) -> Result<Value, String> {
        let cookie = self
            .get_user_cookie()
            .ok_or_else(|| "当前没有可持久化的登录凭据".to_string())?;
        self.save_account(uid, username, user_avatar, &cookie).await
    }

    /// 删除一个已保存的账户；若删除的是当前登录账户则同时清空登录态
    pub async fn remove_account(&self, uid: &str) -> Result<Value, String> {
        let last_login_uid = self
            .load_accounts_root()
            .get("lastLoginUid")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let mut accounts = self.load_accounts();
        accounts.retain(|a| a.get("uid").and_then(|v| v.as_str()) != Some(uid));
        self.save_accounts(&accounts);

        let current = self.get_user_cookie().unwrap_or_default();
        let current_uid = current
            .split(';')
            .find_map(|kv| {
                let mut parts = kv.trim().splitn(2, '=');
                match (parts.next(), parts.next()) {
                    (Some("uid"), Some(v)) => Some(v.trim().to_string()),
                    _ => None,
                }
            })
            .unwrap_or_default();
        if current_uid == uid || last_login_uid == uid {
            self.clear_user_cookie()?;
        }
        Ok(json!({ "code": 200, "data": true }))
    }

    pub fn set_user_cookie(&self, cookie: String) -> Result<(), String> {
        let safe_ascii = Self::sanitize_cookie(&cookie);

        let mut stored = self
            .user_cookie
            .write()
            .map_err(|_| "failed to lock login state".to_string())?;
        *stored = if safe_ascii.is_empty() {
            None
        } else {
            Some(safe_ascii)
        };
        drop(stored);
        // 登录态变化（登录/登出/切换账号）后同步设备码
        self.sync_device_code();
        Ok(())
    }

    fn sanitize_cookie(cookie: &str) -> String {
        let clean = cookie
            .replace('\r', "")
            .replace('\n', " ")
            .trim()
            .to_string();
        // 转换非 ASCII 字符，防止 reqwest 构造 HeaderValue 出现 builder error
        clean
            .chars()
            .map(|c| {
                if c.is_ascii() && c != '\r' && c != '\n' {
                    c.to_string()
                } else {
                    format!("%{:02X}", c as u32)
                }
            })
            .collect()
    }

    /// 校验 Cookie 是否包含真实有效的 SESSID 会话
    /// （"deleted"/"expired" 等占位值视为无效）
    pub fn has_valid_session_cookie(cookie: &str) -> bool {
        cookie.split(';').any(|item| {
            let mut parts = item.trim().splitn(2, '=');
            matches!(
                (parts.next(), parts.next()),
                (Some("SESSID"), Some(value))
                    if !value.trim().is_empty()
                        && !value.eq_ignore_ascii_case("deleted")
                        && !value.eq_ignore_ascii_case("expired")
            )
        })
    }

    async fn request_api(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        form: Option<&[(&str, String)]>,
    ) -> Result<Value, String> {
        self.request_api_from("https://api.coolapk.com", method, path, query, form)
            .await
    }

    async fn request_api_from(
        &self,
        api_origin: &str,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        form: Option<&[(&str, String)]>,
    ) -> Result<Value, String> {
        // 该方法只供内部固定 API 主机调用，禁止把登录凭据发送到其他域名。
        if api_origin != "https://api.coolapk.com" && api_origin != "https://api2.coolapk.com" {
            return Err("不受信任的酷安 API 主机".to_string());
        }
        let token = self.get_token()?;
        let url = format!("{api_origin}{path}");
        let requested_with = "XMLHttpRequest";
        let mut request = self.apply_device_profile(
            self.client
                .request(method, url)
                .header("X-App-Token", token)
                .header("X-Requested-With", requested_with)
                .query(query),
        )?;

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

    async fn public_api_get_from(
        &self,
        api_origin: &str,
        path: &str,
        query: &[(&str, String)],
    ) -> Result<Value, String> {
        if api_origin != "https://api.coolapk.com" && api_origin != "https://api2.coolapk.com" {
            return Err("不受信任的酷安 API 主机".to_string());
        }

        // 公开内容只读回退使用本机持久化的游客设备码，不携带账号 Cookie。
        // 这样既能避开登录设备触发的 -415，也不会改变已绑定账号的写操作指纹。
        let public_device_code = self.guest_device_code();
        let public_token = CoolapkAuth::new(public_device_code.clone()).get_app_token()?;
        let device_header = HeaderValue::from_str(&public_device_code)
            .map_err(|_| "公开读取设备码格式无效".to_string())?;
        let response = self
            .client
            .get(format!("{api_origin}{path}"))
            .header("X-App-Token", public_token)
            .header("X-App-Device", device_header)
            .header("X-Requested-With", "XMLHttpRequest")
            .query(query)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        response_json(response).await
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
        if entity_type == "card"
            || entity_type == "header"
            || entity_type == "card_title"
            || entity_type == "banner"
        {
            return None;
        }

        let is_news_type =
            entity_type == "dyh" || entity_type == "article" || entity_type == "news";

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
        let has_video = has_any_non_empty_field(
            obj,
            &[
                "videoUrl",
                "video_url",
                "videoURL",
                "videoSrc",
                "video_src",
                "videoPic",
                "video_pic",
                "videoCover",
                "video_cover",
                "videoThumbnail",
                "video_thumbnail",
                "videoDuration",
                "video_duration",
                "mediaUrl",
                "media_url",
                "mediaURL",
                "mediaPic",
                "media_pic",
                "mediaInfo",
                "media_info",
                "mediaType",
                "media_type",
                "video",
                "videoInfo",
                "video_info",
                "media",
            ],
        );
        let has_relation = has_any_non_empty_field(
            obj,
            &[
                "targetRow",
                "target_row",
                "relationRows",
                "relation_rows",
                "extraRows",
                "extra_rows",
                "productRows",
                "product_rows",
            ],
        );

        if message.is_empty() && title.is_empty() && !has_pics && !single_pic && !has_video && !has_relation {
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
        let replynum = get_u64_by_keys(
            obj,
            &[
                "replynum",
                "reply_num",
                "replyNum",
                "commentnum",
                "comment_num",
                "replynum_count",
            ],
        );
        let fav_num = get_u64_by_keys(obj, &["favnum", "fav_num", "favorite_num"]);
        let share_num = get_u64_by_keys(obj, &["sharenum", "share_num"]);
        let hit_num = get_u64_by_keys(
            obj,
            &["hitnum", "clicknum", "read_num", "view_num", "hit_num"],
        );
        let is_modified = get_u64_by_keys(obj, &["isModified", "is_modified"]);
        let change_count = get_u64_by_keys(obj, &["change_count", "changeCount"]);
        let last_change_time = get_u64_by_keys(obj, &["last_change_time", "lastChangeTime"]);

        let user_level =
            get_str_by_keys(obj, &["userLevel", "level", "user_level"]).unwrap_or_default();

        let target_type = first_value_by_keys(obj, &["targetRow", "target_row"])
            .and_then(|v| v.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let trace = obj
            .get("trace")
            .or_else(|| obj.get("extra_key"))
            .or_else(|| obj.get("extraKey"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let user_action = obj
            .get("userAction")
            .or_else(|| obj.get("user_action"))
            .cloned()
            .unwrap_or_else(|| json!({}));

        let mut cleaned = json!({
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
            "isModified": is_modified,
            "changeCount": change_count,
            "lastChangeTime": last_change_time,
            "userAction": user_action,
            "entityType": if entity_type.is_empty() { "feed" } else { entity_type },
            "trace": trace,
            "targetType": target_type,
            "uid": raw_uid,
            "dateline": get_u64_by_keys(obj, &["dateline", "create_time", "lastupdate", "createTime"])
        });

        // 列表接口会把关联标的和视频字段放在这些扩展字段中，必须在归一化时保留下来。
        copy_first_field(&mut cleaned, obj, "targetRow", &["targetRow", "target_row"]);
        copy_first_field(&mut cleaned, obj, "relationRows", &["relationRows", "relation_rows"]);
        copy_first_field(&mut cleaned, obj, "extraRows", &["extraRows", "extra_rows"]);
        copy_first_field(&mut cleaned, obj, "productRows", &["productRows", "product_rows"]);
        copy_first_field(&mut cleaned, obj, "videoUrl", &["videoUrl", "video_url", "videoURL", "videoSrc", "video_src"]);
        copy_first_field(&mut cleaned, obj, "videoPic", &["videoPic", "video_pic", "videoCover", "video_cover", "videoThumbnail", "video_thumbnail"]);
        copy_first_field(&mut cleaned, obj, "videoDuration", &["videoDuration", "video_duration"]);
        copy_first_field(&mut cleaned, obj, "mediaUrl", &["mediaUrl", "media_url", "mediaURL"]);
        copy_first_field(&mut cleaned, obj, "mediaPic", &["mediaPic", "media_pic"]);
        copy_first_field(&mut cleaned, obj, "mediaInfo", &["mediaInfo", "media_info"]);
        copy_first_field(&mut cleaned, obj, "mediaType", &["mediaType", "media_type"]);
        copy_first_field(&mut cleaned, obj, "feedType", &["feedType", "feed_type"]);
        copy_first_field(&mut cleaned, obj, "feedTypeName", &["feedTypeName", "feed_type_name"]);
        copy_first_field(&mut cleaned, obj, "video", &["video"]);
        copy_first_field(&mut cleaned, obj, "videoInfo", &["videoInfo", "video_info"]);
        copy_first_field(&mut cleaned, obj, "media", &["media"]);

        Some(cleaned)
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
                let Some(obj) = item.as_object() else {
                    continue;
                };

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
        let title = get_str_by_keys(
            obj,
            &["title", "shorttitle", "apkname", "label", "entityTitle"],
        )?;
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
            format!(
                "https://image.coolapk.com/{}",
                raw_icon.trim_start_matches('/')
            )
        } else {
            String::new()
        };

        let sub_title = get_str_by_keys(
            obj,
            &["subTitle", "description", "target_row_title", "comment"],
        )
        .unwrap_or_default();
        let score =
            get_str_by_keys(obj, &["score", "star", "rating"]).unwrap_or_else(|| "9.0".to_string());
        let apk_size = get_str_by_keys(obj, &["apksize", "apkSizeFormatted", "size", "apk_size"])
            .unwrap_or_default();
        let down_num = get_str_by_keys(
            obj,
            &[
                "downCount",
                "downCountFormatted",
                "downnum",
                "download_count",
            ],
        )
        .unwrap_or_default();
        let category = get_str_by_keys(
            obj,
            &[
                "catName",
                "category_title",
                "category_name",
                "category",
                "tag",
                "apkTypeName",
            ],
        )
        .unwrap_or_else(|| "应用".to_string());
        let version = get_str_by_keys(
            obj,
            &["apkversionname", "apkVersionName", "version", "versionName"],
        )
        .unwrap_or_default();

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
                    let is_explicit_game = clean_apk
                        .get("isExplicitGame")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let is_utility_tool = clean_apk
                        .get("isUtilityTool")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);

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
                            let is_explicit_game = clean_apk
                                .get("isExplicitGame")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false);
                            let is_utility_tool = clean_apk
                                .get("isUtilityTool")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false);

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
        let token = self.get_token()?;

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

    // 2. 热榜
    // 实测定位：官方热榜 tab（V9_HOME_TAB_RANKING）→ 总榜（V15_DONGTAI_TOP）
    // → 7天总榜 #/feed/statList。sortField 对比实测：
    //   detailnum（详情数）→ 6659/946/1545...
    //   likenum（点赞数）  → 6659/3630/1586/1545/1256... ← 点赞热榜，采用此排序
    // #/feed/hotList 与 V9_HOME_TAB_RANKING 主列表点赞仅个位数/千位以下。
    pub async fn get_hot_feeds(&self, page: u32) -> Result<Value, String> {
        let res = self
            .api_get(
                "/v6/page/dataList",
                &[
                    (
                        "url",
                        "#/feed/statList?statType=7days&sortField=likenum".to_string(),
                    ),
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

    /// 热榜页内的五种榜单。周榜沿用带降级的主热榜，其余榜单使用官方统计页参数。
    pub async fn get_rank_feeds(&self, rank_type: &str, page: u32) -> Result<Value, String> {
        if rank_type == "week" {
            return self.get_hot_feeds(page).await;
        }
        if rank_type == "picture" {
            return self.get_cool_picture_rank(page).await;
        }

        let rank_url =
            rank_feed_url(rank_type).ok_or_else(|| format!("不支持的热榜类型：{rank_type}"))?;
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[("url", rank_url.to_string()), ("page", page.to_string())],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
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
    // 实测：digestList?type=8 返回的动态点赞全为 0（数据异常），
    // 官方酷图榜入口为 statList?statType=30days&sortField=likenum&type=8（点赞 256/169/124）
    pub async fn get_cool_picture_rank(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    (
                        "url",
                        "#/feed/statList?statType=30days&sortField=likenum&type=8".to_string(),
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

    pub async fn get_sub_replies(
        &self,
        feed_id: &str,
        reply_id: &str,
        page: u32,
    ) -> Result<Value, String> {
        let full_url = format!(
            "https://api.coolapk.com/v6/feed/replyList?id={}&rid={}&page={}",
            feed_id, reply_id, page
        );
        let token = self.get_token()?;

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
                        .or_else(|| obj.get("deviceTitle").and_then(|v| v.as_str()))
                        .or_else(|| obj.get("device_name").and_then(|v| v.as_str()))
                        .or_else(|| obj.get("device").and_then(|v| v.as_str()))
                        .unwrap_or("");

                    let user_level = user_info
                        .and_then(|u| u.get("level"))
                        .or_else(|| obj.get("level"))
                        .map(value_to_string)
                        .unwrap_or_default();

                    let item_id = obj
                        .get("id")
                        .and_then(|v| {
                            v.as_str()
                                .map(|s| s.to_string())
                                .or_else(|| v.as_u64().map(|n| n.to_string()))
                        })
                        .unwrap_or_default();
                    let item_rid = obj.get("rid").map(value_to_string).unwrap_or_default();
                    let item_rrid = obj.get("rrid").map(value_to_string).unwrap_or_default();

                    // 严格过滤：只有当 rid 或 rrid 属于 reply_id 时才是该楼层的子回复，排除无关的主楼层评论
                    if item_id == reply_id || (item_rid != reply_id && item_rrid != reply_id) {
                        continue;
                    }

                    let user_action_like = obj
                        .get("userAction")
                        .and_then(|ua| ua.get("like"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);

                    cleaned_replies.push(json!({
                        "id": item_id,
                        "rid": item_rid,
                        "rrid": item_rrid,
                        "uid": obj.get("uid").map(value_to_string).or_else(|| user_info.and_then(|u| u.get("uid")).map(value_to_string)).unwrap_or_default(),
                        "username": username,
                        "rusername": obj.get("rusername").and_then(|v| v.as_str()).unwrap_or(""),
                        "userAvatar": avatar,
                        "userLevel": user_level,
                        "verifyTitle": user_info.and_then(|u| u.get("verify_title")).and_then(|v| v.as_str()).or_else(|| obj.get("verify_title").and_then(|v| v.as_str())).unwrap_or(""),
                        "deviceTitle": device_title,
                        "message": message,
                        "pic": obj.get("pic").and_then(|v| v.as_str()).unwrap_or(""),
                        "picArr": obj.get("picArr").cloned().unwrap_or(json!([])),
                        "images": obj.get("images").cloned().unwrap_or(json!([])),
                        "dateline": obj.get("dateline").cloned().unwrap_or(json!(0)),
                        "infoHtml": obj.get("dateline_text").and_then(|v| v.as_str()).or_else(|| obj.get("infoHtml").and_then(|v| v.as_str())).unwrap_or(""),
                        "floor": obj.get("floor").map(value_to_string).or_else(|| obj.get("rank").map(value_to_string)).unwrap_or_default(),
                        "ipLocation": obj.get("ipLocation").and_then(|v| v.as_str()).or_else(|| obj.get("ip_location").and_then(|v| v.as_str())).or_else(|| obj.get("location").and_then(|v| v.as_str())).unwrap_or(""),
                        "isFeedAuthor": obj.get("isFeedAuthor").cloned().unwrap_or(json!(0)),
                        "feedUid": obj.get("feedUid").map(value_to_string).unwrap_or_default(),
                        "likenum": obj.get("likenum").and_then(|v| v.as_u64()).unwrap_or(0),
                        "userAction": { "like": user_action_like },
                        "replyRowsCount": obj.get("replynum").and_then(|v| v.as_u64()).or_else(|| obj.get("replyRowsCount").and_then(|v| v.as_u64())).unwrap_or(0)
                    }));
                }
            }
        }

        Ok(json!({ "code": 200, "data": cleaned_replies }))
    }

    // 8. 楼层评论：按扩展实测参数获取完整评论，热门评论仅作最后兜底。
    pub async fn get_feed_replies(&self, feed_id: &str, page: u32) -> Result<Value, String> {
        let query = [
            ("id", feed_id.to_string()),
            ("listType", "dateline_desc".to_string()),
            ("page", page.to_string()),
            ("discussMode", "1".to_string()),
            ("feedType", "feed".to_string()),
            ("blockStatus", "0".to_string()),
            ("fromFeedAuthor", "0".to_string()),
        ];

        let login_result = self.api_get("/v6/feed/replyList", &query).await;
        let public_result = match &login_result {
            Ok(value)
                if value
                    .get("data")
                    .and_then(Value::as_array)
                    .is_some_and(|items| !items.is_empty()) =>
            {
                None
            }
            _ => Some(
                self.public_api_get_from("https://api.coolapk.com", "/v6/feed/replyList", &query)
                    .await,
            ),
        };

        let full_result = match public_result {
            None => login_result,
            Some(Ok(value))
                if value
                    .get("data")
                    .and_then(Value::as_array)
                    .is_some_and(|items| !items.is_empty()) =>
            {
                Ok(value)
            }
            Some(_) => {
                self.public_api_get_from("https://api2.coolapk.com", "/v6/feed/replyList", &query)
                    .await
            }
        };

        let raw = match full_result {
            Ok(value)
                if value
                    .get("data")
                    .and_then(Value::as_array)
                    .is_some_and(|items| !items.is_empty()) =>
            {
                value
            }
            full_empty_or_error => {
                let hot_result = self
                    .api_get(
                        "/v6/feed/hotReplyList",
                        &[
                            ("id", feed_id.to_string()),
                            ("page", page.to_string()),
                            ("discussMode", "1".to_string()),
                        ],
                    )
                    .await;

                match hot_result {
                    Ok(value) => value,
                    Err(hot_error) => match full_empty_or_error {
                        Ok(value) => value,
                        Err(full_error) => {
                            return Err(format!(
                                "完整评论加载失败：{full_error}；热门评论加载失败：{hot_error}"
                            ));
                        }
                    },
                }
            }
        };

        let mut cleaned_replies = Vec::new();
        if let Some(data_arr) = raw.get("data").and_then(|v| v.as_array()) {
            for r in data_arr {
                if let Some(obj) = r.as_object() {
                    let reply_id = obj
                        .get("id")
                        .and_then(|value| {
                            value
                                .as_str()
                                .map(ToString::to_string)
                                .or_else(|| value.as_u64().map(|number| number.to_string()))
                        })
                        .unwrap_or_default();
                    // replyList 会夹带没有评论 ID 的分隔卡，不能计入一级评论数量。
                    if reply_id.is_empty() {
                        continue;
                    }
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
                        .or_else(|| obj.get("deviceTitle").and_then(|v| v.as_str()))
                        .or_else(|| obj.get("device_name").and_then(|v| v.as_str()))
                        .or_else(|| obj.get("device").and_then(|v| v.as_str()))
                        .unwrap_or("");

                    let user_level = user_info
                        .and_then(|u| u.get("level"))
                        .or_else(|| obj.get("level"))
                        .map(value_to_string)
                        .unwrap_or_default();

                    let reply_rows = obj.get("replyRows").cloned().unwrap_or(json!([]));
                    let reply_rows_count = obj
                        .get("replyRowsCount")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);

                    let user_action_like = obj
                        .get("userAction")
                        .and_then(|ua| ua.get("like"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);

                    cleaned_replies.push(json!({
            "id": reply_id,
            "fid": obj.get("fid").map(value_to_string).unwrap_or_default(),
            "rid": obj.get("rid").map(value_to_string).unwrap_or_default(),
            "rrid": obj.get("rrid").map(value_to_string).unwrap_or_default(),
            "uid": obj.get("uid").map(value_to_string).or_else(|| user_info.and_then(|u| u.get("uid")).map(value_to_string)).unwrap_or_default(),
            "username": username,
            "rusername": obj.get("rusername").and_then(|v| v.as_str()).unwrap_or(""),
            "userAvatar": avatar,
            "userLevel": user_level,
            "verifyTitle": user_info.and_then(|u| u.get("verify_title")).and_then(|v| v.as_str()).or_else(|| obj.get("verify_title").and_then(|v| v.as_str())).unwrap_or(""),
            "deviceTitle": device_title,
            "message": message,
            "pic": obj.get("pic").and_then(|v| v.as_str()).unwrap_or(""),
            "picArr": obj.get("picArr").cloned().unwrap_or(json!([])),
            "images": obj.get("images").cloned().unwrap_or(json!([])),
            "dateline": obj.get("dateline").cloned().unwrap_or(json!(0)),
            "infoHtml": obj.get("dateline_text").and_then(|v| v.as_str()).or_else(|| obj.get("infoHtml").and_then(|v| v.as_str())).unwrap_or(""),
            "floor": obj.get("floor").map(value_to_string).or_else(|| obj.get("rank").map(value_to_string)).unwrap_or_default(),
            "ipLocation": obj.get("ipLocation").and_then(|v| v.as_str()).or_else(|| obj.get("ip_location").and_then(|v| v.as_str())).or_else(|| obj.get("location").and_then(|v| v.as_str())).unwrap_or(""),
            "isFeedAuthor": obj.get("isFeedAuthor").cloned().unwrap_or(json!(0)),
            "feedUid": obj.get("feedUid").map(value_to_string).unwrap_or_default(),
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
        let tag = board_tag.trim();
        if tag == "/main/headline" || tag == "headline" || tag == "V9_HOME_TAB_HEADLINE" {
            return self.get_headline_feeds(page).await;
        }
        if tag == "/main/indexV8" || tag == "index_v8" {
            return self.get_index_v8_feeds(page).await;
        }

        let url_param = if tag.starts_with("/page?url=") {
            tag.to_string()
        } else if tag.starts_with('/') || tag.starts_with('#') {
            tag.to_string()
        } else {
            format!("/page?url={tag}")
        };

        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", url_param),
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
                    &[("url", page_url.to_string()), ("page", page.to_string())],
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
            // 私信图片接口与普通 API 一样校验设备码和自定义设备信息，
            // 不能只带 Token，否则持久缓存改为原生代理加载后会出现空白图片。
            let token = self.get_token()?;
            self.apply_device_profile(
                self.client
                    .get(url)
                    .timeout(std::time::Duration::from_secs(20))
                    .header(
                        "Accept",
                        "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    )
                    .header("X-Requested-With", "XMLHttpRequest")
                    .header("X-App-Token", token),
            )?
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
        let is_coolapk_target = parsed_url.host_str().map(is_coolapk_host).unwrap_or(false);

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
        // 动态接口在 XHR 模式下返回 JSON，必须保留原文，否则正文里的 HTML 可能被网页清洗器误删。
        let content = if is_coolapk_target
            && url.contains("coolapk.com/feed/")
            && serde_json::from_str::<Value>(&body).is_ok()
        {
            body.clone()
        } else {
            extract_readable_content(&body)
        };

        Ok(json!({
            "code": 200,
            "data": { "title": title, "html": content, "status": status }
        }))
    }

    pub async fn get_feed_detail(&self, feed_id: &str) -> Result<Value, String> {
        let query = [("id", feed_id.to_string())];
        let primary_error = match self.api_get("/v6/feed/detail", &query).await {
            Ok(value) => match wrap_api_data(value) {
                Ok(detail) => return Ok(detail),
                Err(error) => error,
            },
            Err(error) => error,
        };

        // 动态属于公开内容：登录请求不可用时改用独立游客设备码，并且明确不携带账号 Cookie。
        let mut public_errors = Vec::new();
        for api_origin in ["https://api.coolapk.com", "https://api2.coolapk.com"] {
            match self
                .public_api_get_from(api_origin, "/v6/feed/detail", &query)
                .await
            {
                Ok(value) => match wrap_api_data(value) {
                    Ok(detail) => return Ok(detail),
                    Err(error) => public_errors.push(format!("{api_origin}: {error}")),
                },
                Err(error) => public_errors.push(format!("{api_origin}: {error}")),
            }
        }

        Err(format!(
            "动态详情加载失败：{primary_error}；游客接口：{}",
            public_errors.join("；")
        ))
    }

    /// 按 APK 的回退链路，把 Video.requestParams 交给酷安播放器接口解析。
    ///
    /// APK 的 `CoolApkDataProvider` 先尝试本地 videoParser；解析失败时调用
    /// `POST /v6/player/getUrl`，唯一表单字段为 `params`，值是 provider-specific
    /// requestParams，而不是整个 Feed、mediaInfo 或 mediaUrl。
    pub async fn resolve_video_url(&self, request_params: &str) -> Result<Value, String> {
        let params = request_params.trim();
        if params.is_empty() {
            return Err("视频解析参数为空".to_string());
        }

        let raw = self
            .api_post(
                "/v6/player/getUrl",
                &[],
                &[("params", params.to_string())],
            )
            .await?;
        wrap_api_data(raw)
    }

    /// 获取单条评论的完整元数据。
    /// 评论列表接口会省略设备型号等字段，详情接口用于后台补齐，不影响列表首屏显示。
    pub async fn get_reply_detail(&self, reply_id: &str) -> Result<Value, String> {
        let raw = self
            .public_api_get_from(
                "https://api.coolapk.com",
                "/v6/feed/replyDetail",
                &[("id", reply_id.to_string())],
            )
            .await?;
        let obj = raw
            .get("data")
            .and_then(Value::as_object)
            .ok_or_else(|| "评论详情数据为空".to_string())?;
        let user_info = obj.get("userInfo").and_then(Value::as_object);
        let user_agent = obj.get("useragent").and_then(Value::as_str).unwrap_or("");
        let (ua_device_title, ua_device_build, ua_device_rom) = parse_reply_user_agent(user_agent);
        let device_title = obj
            .get("device_title")
            .and_then(Value::as_str)
            .or_else(|| obj.get("deviceTitle").and_then(Value::as_str))
            .or_else(|| obj.get("device_name").and_then(Value::as_str))
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(&ua_device_title);
        let device_build = obj
            .get("device_build")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(&ua_device_build);
        let device_rom = obj
            .get("device_rom")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(&ua_device_rom);

        Ok(json!({
            "code": 200,
            "data": {
                "id": obj.get("id").map(value_to_string).unwrap_or_default(),
                "deviceTitle": device_title,
                "deviceName": obj.get("device_name").and_then(Value::as_str).unwrap_or(""),
                "deviceBuild": device_build,
                "deviceRom": device_rom,
                "userAgent": user_agent,
                "userLevel": user_info.and_then(|user| user.get("level")).map(value_to_string).unwrap_or_default(),
                "verifyTitle": user_info.and_then(|user| user.get("verify_title")).and_then(Value::as_str).unwrap_or(""),
                "pic": obj.get("pic").cloned().unwrap_or(Value::Null),
                "dateline": obj.get("dateline").cloned().unwrap_or(json!(0)),
                "isFeedAuthor": obj.get("isFeedAuthor").cloned().unwrap_or(json!(0)),
                "ipLocation": obj.get("ipLocation").and_then(Value::as_str).or_else(|| obj.get("ip_location").and_then(Value::as_str)).unwrap_or("")
            }
        }))
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

    /// APK UserQRCodeFragment 使用 `/user/qrImage?uid=...`，这是图片响应而不是 JSON。
    /// 复用带设备指纹和 Cookie 的图片加载器，返回前端可直接展示的 data URL。
    pub async fn get_user_qr_image(&self, uid: &str) -> Result<Value, String> {
        if uid.trim().is_empty() || !uid.chars().all(|ch| ch.is_ascii_digit()) {
            return Err("用户 UID 格式无效".to_string());
        }
        let image = self
            .get_image_data_url(&format!(
                "https://api.coolapk.com/v6/user/qrImage?uid={}",
                uid.trim()
            ))
            .await?;
        Ok(json!({ "code": 200, "data": image }))
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

    /// 用户空间的服务端驱动 Tab 数据。
    ///
    /// 用户页并不是所有 Tab 都返回普通 Feed；APK 会根据 Tab 选择不同的
    /// endpoint，且 `/page/dataList` 返回的 Entity 还可能包含未知模板。因此
    /// 这里保留服务端 Entity 原文，不复用会过滤 card/banner 的 feed 清洗器。
    pub async fn get_user_tab_data(
        &self,
        uid: &str,
        tab: &str,
        page: u32,
        first_item: &str,
        last_item: &str,
        rating_target: &str,
    ) -> Result<Value, String> {
        let page_string = page.to_string();
        let mut query: Vec<(&str, String)> = vec![
            ("uid", uid.to_string()),
            ("page", page_string.clone()),
        ];
        if !first_item.is_empty() {
            query.push(("firstItem", first_item.to_string()));
        }
        if !last_item.is_empty() {
            query.push(("lastItem", last_item.to_string()));
        }

        let raw = match tab {
            "feed" => {
                query.extend([
                    ("showAnonymous", "0".to_string()),
                    ("isIncludeTop", "1".to_string()),
                    ("showDoing", "1".to_string()),
                ]);
                self.api_get("/v6/user/feedList", &query).await?
            }
            "reply" => self.api_get("/v6/user/replyList", &query).await?,
            "collection" => self.api_get("/v6/collection/list", &query).await?,
            "goods_store" => self.api_get("/v6/goods/goodsStoreItemList", &query).await?,
            "goods_rank" => self.api_get("/v6/goodsList/list", &query).await?,
            "developer_apps" => self.api_get("/v6/apk/developerAppList", &query).await?,
            "apk_follow" => self.api_get("/v6/user/apkFollowList", &query).await?,
            "article" => self.api_get("/v6/user/htmlFeedList", &query).await?,
            "qa" => self.api_get("/v6/user/questionAndAnswerList", &query).await?,
            "album" => self.api_get("/v6/user/albumList", &query).await?,
            "discovery" => self.api_get("/v6/user/discoveryList", &query).await?,
            "coolpic" => self
                .get_user_page_data(
                    uid,
                    "#/feed/userCoolPictureFeedList?fragmentTemplate=flex",
                    page,
                    first_item,
                    last_item,
                    "酷图",
                    "",
                )
                .await?,
            "rating" => self
                .get_user_page_data(
                    uid,
                    &format!(
                        "#/feed/nodeRatingList?uid={}&targetType={}&parseRatingToFeed=1",
                        uid, rating_target
                    ),
                    page,
                    first_item,
                    last_item,
                    "评分",
                    "",
                )
                .await?,
            "goods" => self
                .get_user_page_data(
                    uid,
                    "#/goods/goodsFeedList?type=default&fragmentTemplate=flex",
                    page,
                    first_item,
                    last_item,
                    "好物",
                    "",
                )
                .await?,
            "ershou" => self
                .get_user_page_data(
                    uid,
                    "#/feed/userErshouList?fragmentTemplate=flex&ershouStatus=userAll",
                    page,
                    first_item,
                    last_item,
                    "二手",
                    "",
                )
                .await?,
            "recycle" => self
                .get_user_page_data(
                    uid,
                    "#/feed/userDeleteFeedList",
                    page,
                    first_item,
                    last_item,
                    "回收站",
                    "",
                )
                .await?,
            "blacklist" => self.get_black_list(page).await?,
            _ => return Err(format!("不支持的用户页 Tab: {tab}")),
        };

        if raw.get("code").and_then(Value::as_i64) == Some(200) {
            return Ok(raw);
        }
        Ok(json!({ "code": 200, "data": Self::extract_entity_rows(&raw) }))
    }

    /// `/page/dataList` 用户页白名单分发器。调用方只能传入已确认的固定路径，
    /// 不接受任意 URL，避免把带设备指纹和 Cookie 的请求变成开放代理。
    async fn get_user_page_data(
        &self,
        uid: &str,
        page_url: &str,
        page: u32,
        first_item: &str,
        last_item: &str,
        title: &str,
        sub_title: &str,
    ) -> Result<Value, String> {
        if !Self::is_allowed_user_page_url(page_url) {
            return Err("不受信任的用户页 page/dataList 路径".to_string());
        }

        let page_url_with_uid = if page_url.contains("uid=") {
            page_url.to_string()
        } else {
            format!("{}&uid={}", page_url, uid)
        };
        let mut query = vec![
            ("url", page_url_with_uid),
            ("title", title.to_string()),
            ("subTitle", sub_title.to_string()),
            ("page", page.to_string()),
            ("pageContext", "user_space".to_string()),
        ];
        if !first_item.is_empty() {
            query.push(("firstItem", first_item.to_string()));
        }
        if !last_item.is_empty() {
            query.push(("lastItem", last_item.to_string()));
        }
        self.api_get("/v6/page/dataList", &query).await
    }

    fn is_allowed_user_page_url(page_url: &str) -> bool {
        if page_url == "#/feed/userCoolPictureFeedList?fragmentTemplate=flex"
            || page_url == "#/goods/goodsFeedList?type=default&fragmentTemplate=flex"
            || page_url == "#/feed/userErshouList?fragmentTemplate=flex&ershouStatus=userAll"
            || page_url == "#/feed/userDeleteFeedList"
        {
            return true;
        }
        let rating_prefix = "#/feed/nodeRatingList?uid=";
        let Some(remainder) = page_url.strip_prefix(rating_prefix) else {
            return false;
        };
        let parts: Vec<&str> = remainder.split('&').collect();
        parts.len() == 3
            && !parts[0].is_empty()
            && matches!(parts[1], "targetType=all" | "targetType=apk" | "targetType=product")
            && parts[2] == "parseRatingToFeed=1"
    }

    /// 保留 server-driven Entity 的原始字段，仅展开常见的 entities 包装。
    fn extract_entity_rows(json_data: &Value) -> Vec<Value> {
        let Some(data) = json_data.get("data") else {
            return Vec::new();
        };
        if let Some(items) = data.as_array() {
            let mut result = Vec::new();
            for item in items {
                if let Some(entities) = item.get("entities").and_then(Value::as_array) {
                    result.extend(entities.iter().cloned());
                } else {
                    result.push(item.clone());
                }
            }
            return result;
        }
        if let Some(items) = data.get("entities").and_then(Value::as_array) {
            return items.clone();
        }
        Vec::new()
    }

    /// 收藏列表（需登录）
    /// 数据来源: GET /v6/favorite/list，type 支持 feed/apk/album
    pub async fn get_favorite_list(
        &self,
        fav_type: &str,
        page: u32,
        first_item: &str,
        last_item: &str,
    ) -> Result<Value, String> {
        let mut query = vec![("type", fav_type.to_string()), ("page", page.to_string())];
        if !first_item.is_empty() {
            query.push(("firstItem", first_item.to_string()));
        }
        if !last_item.is_empty() {
            query.push(("lastItem", last_item.to_string()));
        }
        let raw = self
            .api_get("/v6/favorite/list", &query)
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 查询动态所在的收藏单，供云端收藏/取消收藏使用。
    /// 数据来源: GET /v6/collection/list?uid=&id={feedId}&type=feed&showDefault=1
    pub async fn get_feed_collection_status(&self, feed_id: &str) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/collection/list",
                &[
                    ("uid", String::new()),
                    ("id", feed_id.to_string()),
                    ("type", "feed".to_string()),
                    ("showDefault", "1".to_string()),
                    ("page", "1".to_string()),
                    ("firstItem", String::new()),
                    ("lastItem", String::new()),
                ],
            )
            .await?;
        wrap_api_data(raw)
    }

    /// 把动态加入或移出收藏单。
    /// 数据来源: POST /v6/collection/addItem
    pub async fn update_collection_item(
        &self,
        collection_ids: &str,
        cancel_ids: &str,
        target_id: &str,
        feed_type: &str,
        trace: &str,
    ) -> Result<Value, String> {
        let form = [
            ("id", collection_ids.to_string()),
            ("cancelId", cancel_ids.to_string()),
            ("targetId", target_id.to_string()),
            ("type", feed_type.to_string()),
            ("trace", trace.to_string()),
        ];
        wrap_api_data(self.api_post("/v6/collection/addItem", &[], &form).await?)
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
    pub async fn get_collection_item_list(
        &self,
        collection_id: &str,
        page: u32,
    ) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/collection/itemlist",
                &[
                    ("id", collection_id.to_string()),
                    ("page", page.to_string()),
                    ("firstItem", String::new()),
                    ("lastItem", String::new()),
                    ("listType", "allFeedType".to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 收藏单详情
    /// 数据来源: GET /v6/collection/detail?id={collectionId}
    pub async fn get_collection_detail(&self, collection_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/collection/detail",
                &[("id", collection_id.to_string())],
            )
            .await?,
        )
    }

    /// 关注/点赞收藏单（酷安 v6 写接口统一使用 GET）
    async fn collection_action(&self, path: &str, collection_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(path, &[("id", collection_id.to_string())])
                .await?,
        )
    }

    pub async fn follow_collection(&self, collection_id: &str) -> Result<Value, String> {
        self.collection_action("/v6/collection/follow", collection_id)
            .await
    }

    pub async fn unfollow_collection(&self, collection_id: &str) -> Result<Value, String> {
        self.collection_action("/v6/collection/unFollow", collection_id)
            .await
    }

    pub async fn like_collection(&self, collection_id: &str) -> Result<Value, String> {
        self.collection_action("/v6/collection/like", collection_id)
            .await
    }

    pub async fn unlike_collection(&self, collection_id: &str) -> Result<Value, String> {
        self.collection_action("/v6/collection/unLike", collection_id)
            .await
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
                &[
                    ("searchValue", query.to_string()),
                    ("type", "app".to_string()),
                ],
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
            Ok(val)
                if val
                    .get("data")
                    .and_then(|d| d.as_array())
                    .map_or(false, |arr| !arr.is_empty()) =>
            {
                val
            }
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
                    let f_a = a
                        .get("follower_num")
                        .and_then(|v| v.as_u64())
                        .or_else(|| a.get("follownum").and_then(|v| v.as_u64()))
                        .unwrap_or(0);
                    let f_b = b
                        .get("follower_num")
                        .and_then(|v| v.as_u64())
                        .or_else(|| b.get("follownum").and_then(|v| v.as_u64()))
                        .unwrap_or(0);
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

    /// 应用评论列表（应用评价，不是动态讨论）
    /// 数据来源: GET /v6/apk/commentList?id={id}&listType={list_type}&page={page}
    pub async fn get_apk_comments(
        &self,
        app_id: &str,
        list_type: &str,
        page: u32,
    ) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/apk/commentList",
                &[
                    ("id", app_id.to_string()),
                    ("listType", list_type.to_string()),
                    ("page", page.to_string()),
                ],
            )
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
        let token = self.get_token()?;
        let url = format!("https://api.coolapk.com/v6/message/send?uid={}", uid);
        let form = reqwest::multipart::Form::new().text("message", message.to_string());

        let mut request = self.apply_device_profile(
            self.client
                .request(reqwest::Method::POST, url)
                .header("X-App-Token", token)
                .header("X-Requested-With", "XMLHttpRequest")
                .multipart(form),
        )?;

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
        let token = self.get_token()?;
        let url = format!("https://api.coolapk.com/v6/message/send?uid={}", uid);
        let form = reqwest::multipart::Form::new().text("message_pic", message_pic.to_string());

        let mut request = self.apply_device_profile(
            self.client
                .request(reqwest::Method::POST, url)
                .header("X-App-Token", token)
                .header("X-Requested-With", "XMLHttpRequest")
                .multipart(form),
        )?;

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

    /// 收藏/取消收藏应用（需登录，GET 写接口）
    /// 数据来源: GET /v6/apk/favorite?id={packageName} / /v6/apk/unFavorite?id={packageName}
    pub async fn favorite_apk(&self, package_name: &str) -> Result<Value, String> {
        self.favorite_action("/v6/apk/favorite", package_name).await
    }

    pub async fn unfavorite_apk(&self, package_name: &str) -> Result<Value, String> {
        self.favorite_action("/v6/apk/unFavorite", package_name)
            .await
    }

    /// 删除自己发布的动态（需登录）
    /// 实测：必须 POST + id 放 URL query + X-Requested-With: XMLHttpRequest
    /// （GET 返回 status=-1"请求方式错误"）
    pub async fn delete_feed(&self, feed_id: &str) -> Result<Value, String> {
        self.delete_action("/v6/feed/deleteFeed", feed_id).await
    }

    /// 删除自己的评论/回复（需登录）
    /// 实测：必须 POST + id 放 URL query + X-Requested-With: XMLHttpRequest
    pub async fn delete_reply(&self, reply_id: &str) -> Result<Value, String> {
        self.delete_action("/v6/feed/deleteReply", reply_id).await
    }

    /// 删除类接口通用实现：POST + query + XMLHttpRequest（与实测成功组合一致）
    async fn delete_action(&self, path: &str, id: &str) -> Result<Value, String> {
        let token = self.get_token()?;
        let url = format!("https://api.coolapk.com{path}?id={}", id);
        let mut request = self.apply_device_profile(
            self.client
                .request(reqwest::Method::POST, url)
                .header("X-App-Token", token)
                .header("X-Requested-With", "XMLHttpRequest"),
        )?;

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
                c.split(';').find_map(|kv| {
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

        // 发动态/评论配图用 image/feed，私信图片用 message/message
        let upload_bucket = if dir == "feed" { "image" } else { dir }.to_string();
        let feed_type = if dir == "feed" { "feed" } else { "" }.to_string();

        let prepare_params = [
            ("uploadBucket", upload_bucket),
            ("uploadDir", dir.to_string()),
            ("is_anonymous", "0".to_string()),
            ("uploadFileList", file_list),
            ("toUid", target_uid),
            ("feed_type", feed_type),
        ];

        let prepare_json = self
            .api_post("/v6/upload/ossUploadPrepare", &[], &prepare_params)
            .await?;

        if let Some(msg) = prepare_json
            .get("message")
            .or_else(|| prepare_json.get("error"))
            .and_then(Value::as_str)
        {
            if !msg.is_empty()
                && (prepare_json.get("data").is_none()
                    || prepare_json.get("data") == Some(&Value::Null))
            {
                return Err(format!("上传凭证获取失败（{msg}）"));
            }
        }

        let data = prepare_json
            .get("data")
            .filter(|d| !d.is_null())
            .ok_or_else(|| {
                let msg = prepare_json
                    .get("message")
                    .or_else(|| prepare_json.get("error"))
                    .and_then(Value::as_str)
                    .unwrap_or("服务端未返回凭证数据");
                format!("上传凭证获取失败（{msg}）")
            })?;

        let file_info = data
            .get("fileInfo")
            .and_then(|f| f.as_array())
            .and_then(|arr| arr.first())
            .ok_or_else(|| {
                let msg = prepare_json
                    .get("message")
                    .or_else(|| prepare_json.get("error"))
                    .and_then(Value::as_str)
                    .unwrap_or("fileInfo 缺失");
                format!("上传凭证获取失败（{msg}）")
            })?;
        let prepare_info = data
            .get("uploadPrepareInfo")
            .ok_or_else(|| {
                let msg = prepare_json
                    .get("message")
                    .or_else(|| prepare_json.get("error"))
                    .and_then(Value::as_str)
                    .unwrap_or("uploadPrepareInfo 缺失");
                format!("上传凭证获取失败（{msg}）")
            })?;

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
                prepare_json
                    .get("data")
                    .map(|d| d.to_string())
                    .unwrap_or_default()
            ));
        }

        // 2. 直传 OSS（PUT Object，OSS V1 签名）
        let content_md5_b64 = {
            use base64::Engine;
            use md5::{Digest, Md5};
            let mut hasher = Md5::new();
            hasher.update(image_bytes);
            base64::engine::general_purpose::STANDARD.encode(hasher.finalize())
        };
        let now = chrono::Utc::now()
            .format("%a, %d %b %Y %H:%M:%S GMT")
            .to_string();

        // 上传成功回调（与官方客户端一致）
        let callback = "eyJjYWxsYmFja0JvZHlUeXBlIjoiYXBwbGljYXRpb25cL2pzb24iLCJjYWxsYmFja0hvc3QiOiJhcGkuY29vbGFway5jb20iLCJjYWxsYmFja1VybCI6Imh0dHBzOlwvXC9hcGkuY29vbGFway5jb21cL3Y2XC9jYWxsYmFja1wvbW9iaWxlT3NzVXBsb2FkU3VjY2Vzc0NhbGxiYWNrP2NoZWNrQXJ0aWNsZUNvdmVyUmVzb2x1dGlvbj0wJnZlcnNpb25Db2RlPTIxMDIwMzEiLCJjYWxsYmFja0JvZHkiOiJ7XCJidWNrZXRcIjoke2J1Y2tldH0sXCJvYmplY3RcIjoke29iamVjdH0sXCJoYXNQcm9jZXNzXCI6JHt4OnZhcjF9fSJ9";
        let callback_var = "eyJ4OnZhcjEiOiJmYWxzZSJ9";

        let resource = format!("/{}/{}", bucket, upload_file_name);
        let string_to_sign = format!(
            "PUT\n{}\n{}\n{}\nx-oss-callback:{}\nx-oss-callback-var:{}\nx-oss-security-token:{}\n{}",
            content_md5_b64, content_type, now, callback, callback_var, security_token, resource
        );

        use base64::Engine;
        use hmac::{Hmac, Mac};
        use sha1::Sha1;
        type HmacSha1 = Hmac<Sha1>;
        let mut mac =
            HmacSha1::new_from_slice(access_key_secret.as_bytes()).map_err(|e| e.to_string())?;
        mac.update(string_to_sign.as_bytes());
        let signature =
            base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
        let authorization = format!("OSS {}:{}", access_key_id, signature);

        let oss_host = if end_point.starts_with("http") {
            end_point
        } else {
            format!("https://{}", end_point)
        };
        let oss_host = oss_host.replace("https://", "").replace("http://", "");
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
        let oss_body = oss_res.text().await.unwrap_or_default();

        if !oss_status.is_success() {
            return Err(format!("OSS 直传失败 (HTTP {}): {}", oss_status, &oss_body));
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
        self.blacklist_action("/v6/user/removeFromBlackList", uid)
            .await
    }

    /// 屏蔽/取消屏蔽用户（需登录，GET 写接口）
    pub async fn add_to_ignore_list(&self, uid: &str) -> Result<Value, String> {
        self.blacklist_action("/v6/user/addToIgnoreList", uid).await
    }

    pub async fn remove_from_ignore_list(&self, uid: &str) -> Result<Value, String> {
        self.blacklist_action("/v6/user/removeFromIgnoreList", uid)
            .await
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

    /// 点赞/取消点赞通用实现（对应官方 APK kb1.java）
    async fn like_action(&self, path: &str, id: &str) -> Result<Value, String> {
        let res = self
            .api_post(
                path,
                &[("id", id.to_string()), ("detail", "0".to_string())],
                &[("trace", "".to_string())],
            )
            .await?;
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

    /// 点赞评论（对应 APK /v6/feed/likeReply）
    pub async fn like_reply(&self, reply_id: &str) -> Result<Value, String> {
        self.like_action("/v6/feed/likeReply", reply_id).await
    }

    /// 取消点赞评论（对应 APK /v6/feed/unLikeReply）
    pub async fn unlike_reply(&self, reply_id: &str) -> Result<Value, String> {
        self.like_action("/v6/feed/unLikeReply", reply_id).await
    }

    /// 发表评论；rid 非空时表示回复楼中楼（某条评论），pic 非空时表示评论图片，post_token 为网易易盾滑块验证 Token
    /// 对应官方 APK kb1.java:496 (@POST("feed/reply") @Query("id") @Query("type") @Body FormBody) 与 ExtraPostFieldInterceptor.java
    pub async fn reply_feed(
        &self,
        feed_id: &str,
        message: &str,
        rid: Option<&str>,
        pic: Option<&str>,
        post_token: Option<&str>,
    ) -> Result<Value, String> {
        let query = [
            ("id", feed_id.to_string()),
            ("type", "feed".to_string()),
        ];
        let mut form = vec![
            ("message", message.to_string()),
        ];
        if let Some(rid) = rid {
            if !rid.is_empty() {
                form.push(("rid", rid.to_string()));
            }
        }
        if let Some(pic) = pic {
            if !pic.is_empty() {
                form.push(("pic", pic.to_string()));
            }
        }
        if let Some(token) = post_token {
            if !token.is_empty() {
                form.push(("_v2_post_token", token.to_string()));
            }
        }
        wrap_api_data(self.api_post("/v6/feed/reply", &query, &form).await?)
    }

    /// 发表评论到应用评价区；此接口与动态评论 /v6/feed/reply 的语义不同。
    /// 对应公开 V6 接口资料中的 POST /v6/apk/comment?id={id}，正文使用 message 表单字段。
    pub async fn comment_apk(&self, app_id: &str, message: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_post(
                "/v6/apk/comment",
                &[("id", app_id.to_string())],
                &[("message", message.to_string())],
            )
            .await?,
        )
    }

    pub async fn follow_user(&self, uid: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/user/follow", &[("uid", uid.to_string())])
                .await?,
        )
    }

    pub async fn unfollow_user(&self, uid: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/user/unfollow", &[("uid", uid.to_string())])
                .await?,
        )
    }

    pub async fn special_follow_user(&self, uid: &str, special: bool) -> Result<Value, String> {
        wrap_api_data(
            self.api_post(
                "/v6/user/specialFollowUser",
                &[
                    ("uid", uid.to_string()),
                    ("special", if special { "1" } else { "0" }.to_string()),
                ],
                &[],
            )
            .await?,
        )
    }

    pub async fn cancel_follower(&self, uid: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_post("/v6/user/cancelFollower", &[("uid", uid.to_string())], &[])
                .await?,
        )
    }

    pub async fn update_user_remark(&self, uid: &str, name: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_post(
                "/v6/user/updateRemark",
                &[],
                &[("uid", uid.to_string()), ("name", name.to_string())],
            )
            .await?,
        )
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
            .api_get("/v6/feed/followFeedList", &[("page", page.to_string())])
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
        let mut clean_list = Vec::new();
        if let Some(arr) = list.as_array() {
            let self_uid = uid.trim().to_string();
            for item in arr {
                let user_info = item.get("fUserInfo").or_else(|| item.get("userInfo"));
                let real_uid = user_info
                    .and_then(|info| info.get("uid"))
                    .and_then(|v| value_to_string_opt(v))
                    .or_else(|| item.get("fuid").and_then(|v| value_to_string_opt(v)))
                    .unwrap_or_default();

                if real_uid.is_empty() || real_uid == self_uid {
                    continue;
                }

                let username = user_info
                    .and_then(|info| info.get("username").or_else(|| info.get("displayUserName")))
                    .and_then(|v| v.as_str())
                    .or_else(|| item.get("fusername").and_then(|v| v.as_str()))
                    .unwrap_or("酷友");

                let avatar = user_info
                    .and_then(|info| info.get("userAvatar").or_else(|| info.get("avatar")))
                    .and_then(|v| v.as_str())
                    .or_else(|| item.get("fUserAvatar").and_then(|v| v.as_str()))
                    .unwrap_or("");

                let bio = user_info
                    .and_then(|info| info.get("bio").or_else(|| info.get("signature")))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                let is_follow = user_info
                    .and_then(|info| info.get("isFollow"))
                    .or_else(|| item.get("isFollow"))
                    .cloned()
                    .unwrap_or(json!(1));

                let is_special_follow = user_info
                    .and_then(|info| info.get("isSpecialFollow"))
                    .or_else(|| item.get("isSpecialFollow"))
                    .cloned()
                    .unwrap_or(json!(0));

                let level = user_info
                    .and_then(|info| info.get("level"))
                    .or_else(|| item.get("level"))
                    .cloned()
                    .unwrap_or(json!(0));

                let mut new_item = item.clone();
                if let Some(obj) = new_item.as_object_mut() {
                    obj.insert("uid".to_string(), json!(real_uid));
                    obj.insert("fuid".to_string(), json!(real_uid));
                    obj.insert("username".to_string(), json!(username));
                    obj.insert("fusername".to_string(), json!(username));
                    obj.insert("userAvatar".to_string(), json!(avatar));
                    obj.insert("fUserAvatar".to_string(), json!(avatar));
                    obj.insert("bio".to_string(), json!(bio));
                    obj.insert("signature".to_string(), json!(bio));
                    obj.insert("isFollow".to_string(), is_follow);
                    obj.insert("isSpecialFollow".to_string(), is_special_follow);
                    obj.insert("level".to_string(), level);
                }
                clean_list.push(new_item);
            }
        }

        Ok(json!({ "code": 200, "data": clean_list }))
    }

    /// 获取粉丝列表。
    /// 注意：酷安 /v6/user/fansList 返回数据中，真实粉丝信息在 `userInfo` 字段，
    /// 而 `fUserInfo`/`fuid`/`fusername` 是"自己"的占位数据。
    /// 这里用 userInfo 重写顶层字段并剔除占位，保证前端渲染的是真实粉丝。
    pub async fn get_fans_user_list(&self, uid: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/user/fansList",
                &[
                    ("uid", uid.to_string()),
                    ("page", page.to_string()),
                    ("isIncludeTop", "1".to_string()),
                ],
            )
            .await?;

        let list = raw.get("data").cloned().unwrap_or(Value::Array(Vec::new()));
        let mut clean_list = Vec::new();
        if let Some(arr) = list.as_array() {
            let self_uid = uid.trim().to_string();
            for item in arr {
                let user_info = item.get("userInfo").or_else(|| item.get("fUserInfo"));
                let real_uid = user_info
                    .and_then(|info| info.get("uid"))
                    .and_then(|v| value_to_string_opt(v))
                    .or_else(|| item.get("uid").and_then(|v| value_to_string_opt(v)))
                    .unwrap_or_default();

                // 剔除占位数据：真实 uid 为空 或 等于请求者自己
                if real_uid.is_empty() || real_uid == self_uid {
                    continue;
                }

                // 用 userInfo 重写顶层字段，前端可直接读取
                let username = user_info
                    .and_then(|info| info.get("username").or_else(|| info.get("displayUserName")))
                    .and_then(|v| v.as_str())
                    .or_else(|| item.get("username").and_then(|v| v.as_str()))
                    .unwrap_or("酷友");
                let avatar = user_info
                    .and_then(|info| info.get("userAvatar").or_else(|| info.get("avatar")))
                    .and_then(|v| v.as_str())
                    .or_else(|| item.get("userAvatar").and_then(|v| v.as_str()))
                    .unwrap_or("");

                let bio = user_info
                    .and_then(|info| info.get("bio").or_else(|| info.get("signature")))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                let is_follow = user_info
                    .and_then(|info| info.get("isFollow"))
                    .or_else(|| item.get("isFollow"))
                    .cloned()
                    .unwrap_or(json!(0));

                let is_special_follow = user_info
                    .and_then(|info| info.get("isSpecialFollow"))
                    .or_else(|| item.get("isSpecialFollow"))
                    .cloned()
                    .unwrap_or(json!(0));

                let level = user_info
                    .and_then(|info| info.get("level"))
                    .or_else(|| item.get("level"))
                    .cloned()
                    .unwrap_or(json!(0));

                let mut new_item = item.clone();
                if let Some(obj) = new_item.as_object_mut() {
                    obj.insert("uid".to_string(), json!(real_uid));
                    obj.insert("fuid".to_string(), json!(real_uid));
                    obj.insert("username".to_string(), json!(username));
                    obj.insert("fusername".to_string(), json!(username));
                    obj.insert("userAvatar".to_string(), json!(avatar));
                    obj.insert("fUserAvatar".to_string(), json!(avatar));
                    obj.insert("bio".to_string(), json!(bio));
                    obj.insert("signature".to_string(), json!(bio));
                    obj.insert("isFollow".to_string(), is_follow);
                    obj.insert("isSpecialFollow".to_string(), is_special_follow);
                    obj.insert("level".to_string(), level);
                }
                clean_list.push(new_item);
            }
        }

        Ok(json!({ "code": 200, "data": clean_list }))
    }

    /// 发布动态（需登录）
    /// 官方客户端要求 POST multipart：message / type=feed / is_html_article=0 / pic / _v2_post_token
    pub async fn create_feed(
        &self,
        message: &str,
        pic: Option<&str>,
        post_token: Option<&str>,
    ) -> Result<Value, String> {
        let token = self.get_token()?;
        let mut form = reqwest::multipart::Form::new()
            .text("message", message.to_string())
            .text("type", "feed".to_string())
            .text("is_html_article", "0".to_string());
        if let Some(pic) = pic {
            if !pic.is_empty() {
                form = form.text("pic", pic.to_string());
            }
        }
        if let Some(token) = post_token {
            if !token.is_empty() {
                form = form.text("_v2_post_token", token.to_string());
            }
        }

        let mut request = self.apply_device_profile(
            self.client
                .request(
                    reqwest::Method::POST,
                    "https://api.coolapk.com/v6/feed/createFeed",
                )
                .header("X-App-Token", token)
                .header("X-Requested-With", "XMLHttpRequest")
                .multipart(form),
        )?;

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
        let wrapped = wrap_api_data(response_json(response).await?)?;
        // 发布成功时服务端必须返回新建动态对象（含 id）；data 缺失/为空说明
        // 服务端虽然返回了 200 信封但并未真正创建动态，必须视为失败
        let created = wrapped
            .get("data")
            .and_then(|d| d.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .or_else(|| {
                wrapped
                    .get("data")
                    .and_then(|d| d.get("id").and_then(|v| v.as_u64()))
                    .map(|n| n.to_string())
            });
        if created.is_none() {
            return Err("发布动态失败：服务端未返回发布结果，请重试".to_string());
        }
        Ok(wrapped)
    }

    /// 转发动态（需登录）
    /// 官方无独立转发接口（/v6/feed/forward、/v6/feed/repost 均不存在），
    /// 通过 createFeed 携带 fid 实现：POST multipart /v6/feed/createFeed。
    /// 实测：参数名必须是 fid（forward_id 会被服务端当成普通动态发布，fid=0）
    pub async fn create_forward(
        &self,
        feed_id: &str,
        message: &str,
        pic: Option<&str>,
    ) -> Result<Value, String> {
        let token = self.get_token()?;
        let mut form = reqwest::multipart::Form::new()
            .text("message", message.to_string())
            .text("type", "feed".to_string())
            .text("is_html_article", "0".to_string())
            .text("fid", feed_id.to_string());
        if let Some(pic) = pic {
            if !pic.is_empty() {
                form = form.text("pic", pic.to_string());
            }
        }

        let mut request = self.apply_device_profile(
            self.client
                .request(
                    reqwest::Method::POST,
                    "https://api.coolapk.com/v6/feed/createFeed",
                )
                .header("X-App-Token", token)
                .header("X-Requested-With", "XMLHttpRequest")
                .multipart(form),
        )?;

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
        let wrapped = wrap_api_data(response_json(response).await?)?;
        let created = wrapped
            .get("data")
            .and_then(|d| d.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .or_else(|| {
                wrapped
                    .get("data")
                    .and_then(|d| d.get("id").and_then(|v| v.as_u64()))
                    .map(|n| n.to_string())
            });
        if created.is_none() {
            return Err("转发失败：服务端未返回转发结果，请重试".to_string());
        }
        Ok(wrapped)
    }

    pub async fn check_login_status(&self) -> Result<Value, String> {
        // 先验证当前会话，避免 /user/space 把任意公开用户资料误当成当前登录用户。
        let login_info = self.check_login_info().await?;
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

        let query_refs: Vec<(&str, String)> =
            query_params.iter().map(|(k, v)| (*k, v.clone())).collect();
        if query_params.is_empty() {
            return Ok(login_info);
        }
        let res = self.api_get("/v6/user/space", &query_refs).await?;
        if let Some(data) = res.get("data") {
            return Ok(json!({ "code": 200, "data": data }));
        }
        Ok(login_info)
    }

    pub fn clear_user_cookie(&self) -> Result<(), String> {
        let mut stored = self
            .user_cookie
            .write()
            .map_err(|_| "failed to lock login state".to_string())?;
        *stored = None;
        drop(stored);
        // 清空当前登录标记（保留账户记录，便于下次快速切换）
        let mut root = self.load_accounts_root();
        root["lastLoginUid"] = json!("");
        self.save_accounts_root(&root);
        // 清理旧版 txt 遗留文件
        if let Some(path) = self.cookie_file.read().ok().and_then(|g| g.clone()) {
            if path.exists() {
                let _ = std::fs::remove_file(&path);
            }
        }
        // 登出后回到游客态，同步游客设备码
        self.sync_device_code();
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
            if msg.contains("unsupported") || res.get("status").and_then(Value::as_i64) == Some(403)
            {
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
                    if msg.contains("unsupported")
                        || res.get("status").and_then(Value::as_i64) == Some(403)
                    {
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
            if msg.contains("unsupported") || res.get("status").and_then(Value::as_i64) == Some(403)
            {
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

    /// 更新/同步用户自定义首页频道顺序与显隐状态到酷安云端账号
    /// 数据来源: POST /v6/account/updateConfig
    pub async fn update_home_tab_config(&self, home_tab_config_json: &str) -> Result<Value, String> {
        let is_logged_in = self
            .user_cookie
            .read()
            .map(|c| c.as_ref().map(|s| !s.is_empty()).unwrap_or(false))
            .unwrap_or(false);

        if !is_logged_in {
            return Ok(json!({ "code": 200, "message": "未登录，已保存至本地" }));
        }

        match self
            .api_post(
                "/v6/account/updateConfig",
                &[],
                &[("home_tab_config", home_tab_config_json.to_string())],
            )
            .await
        {
            Ok(raw) => Ok(json!({ "code": 200, "data": raw })),
            Err(err) => {
                eprintln!("[update_home_tab_config] 云端配置同步提示: {err}");
                Ok(json!({ "code": 200, "warning": err }))
            }
        }
    }

    /// 获取发现频道的服务端配置。
    /// 数据来源: GET /v6/main/init，前端从 entity id=20131 的卡片中解析 ConfigPage。
    pub async fn get_discovery_config(&self) -> Result<Value, String> {
        wrap_api_data(self.api_get("/v6/main/init", &[]).await?)
    }

    /// APK 动态频道统一列表接口。
    /// 数据来源: GET /v6/page/dataList
    pub async fn get_discovery_page_data(
        &self,
        url: &str,
        title: &str,
        sub_title: &str,
        page: u32,
        first_item: &str,
        last_item: &str,
        page_context: &str,
    ) -> Result<Value, String> {
        if !is_safe_discovery_page_url(url) {
            return Err("发现页地址不受信任，已拒绝请求".to_string());
        }

        let mut query = vec![("url", url.to_string()), ("page", page.max(1).to_string())];
        if !title.trim().is_empty() {
            query.push(("title", title.to_string()));
        }
        if !sub_title.trim().is_empty() {
            query.push(("subTitle", sub_title.to_string()));
        }
        if !first_item.trim().is_empty() {
            query.push(("firstItem", first_item.to_string()));
        }
        if !last_item.trim().is_empty() {
            query.push(("lastItem", last_item.to_string()));
        }
        if !page_context.trim().is_empty() {
            query.push(("pageContext", page_context.to_string()));
        }

        wrap_api_data(self.api_get("/v6/page/dataList", &query).await?)
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
    pub async fn get_product_feeds(
        &self,
        product_id: &str,
        feed_type: &str,
        page: u32,
    ) -> Result<Value, String> {
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

    /// 看看号（官方号）列表
    /// 数据来源: GET /v6/dyh/list
    pub async fn get_dyh_list(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/dyh/list", &[("page", page.to_string())])
            .await?;
        Ok(json!({ "code": 200, "data": raw.get("data").cloned().unwrap_or(json!([])) }))
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
    pub async fn get_apk_feeds(
        &self,
        package_name: &str,
        sort_type: &str,
        page: u32,
    ) -> Result<Value, String> {
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
        let cookie = self
            .user_cookie
            .read()
            .map_err(|_| "failed to read login state".to_string())?
            .clone()
            .ok_or_else(|| "当前没有登录凭据".to_string())?;
        let has_session = Self::has_valid_session_cookie(&cookie);
        if !has_session {
            return Err("当前 Cookie 不包含有效会话".to_string());
        }

        let result = wrap_api_data(self.api_get("/v6/account/checkLoginInfo", &[]).await?)?;
        let data = result.get("data").unwrap_or(&result);
        let uid = data
            .get("uid")
            .or_else(|| data.get("id"))
            .map(value_to_string)
            .unwrap_or_default();
        if uid.is_empty() || uid == "0" || uid == "10000" {
            return Err("酷安账号尚未登录".to_string());
        }
        Ok(result)
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
        let raw = self
            .api_get(
                "/v6/album/list",
                &[
                    ("listType", list_type.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": raw.get("data").cloned().unwrap_or(json!([])) }))
    }

    /// 搜索应用集
    /// 数据来源: GET /v6/album/search
    pub async fn search_albums(&self, query: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/album/search",
                &[("q", query.to_string()), ("page", page.to_string())],
            )
            .await?;
        Ok(json!({ "code": 200, "data": raw.get("data").cloned().unwrap_or(json!([])) }))
    }

    /// 应用集详情
    /// 数据来源: GET /v6/album/detail
    pub async fn get_album_detail(&self, album_id: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_get("/v6/album/detail", &[("id", album_id.to_string())])
                .await?,
        )
    }

    /// 应用集评论
    /// 数据来源: GET /v6/album/replyList
    pub async fn get_album_replies(&self, album_id: &str, page: u32) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/album/replyList",
                &[("id", album_id.to_string()), ("page", page.to_string())],
            )
            .await?,
        )
    }

    /// 头条列表
    /// 数据来源: GET /v6/main/headline
    pub async fn get_headline_feeds(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/main/headline", &[("page", page.to_string())])
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 更新列表
    /// 数据来源: GET /v6/main/updateList
    pub async fn get_update_list(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/main/updateList", &[("page", page.to_string())])
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 编辑精选
    /// 数据来源: GET /v6/feed/editorChoiceList
    pub async fn get_editor_choice_feeds(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get("/v6/feed/editorChoiceList", &[("page", page.to_string())])
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 应用发现者列表
    /// 数据来源: GET /v6/apk/discovererList
    pub async fn get_apk_discoverers(
        &self,
        package_name: &str,
        page: u32,
    ) -> Result<Value, String> {
        wrap_api_data(
            self.api_get(
                "/v6/apk/discovererList",
                &[("id", package_name.to_string()), ("page", page.to_string())],
            )
            .await?,
        )
    }

    /// 推荐应用列表
    /// 数据来源: GET /v6/apk/recommendList
    pub async fn get_apk_recommend_list(
        &self,
        apk_type: &str,
        title: &str,
        page: u32,
    ) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/apk/recommendList",
                &[
                    ("apkType", apk_type.to_string()),
                    ("title", title.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        let apks = Self::extract_apk_list(&raw, "all");
        Ok(json!({ "code": 200, "data": apks }))
    }

    /// 应用礼品列表
    /// 数据来源: GET /v6/apk/giftList
    pub async fn get_apk_gift_list(
        &self,
        apk_id: Option<&str>,
        page: u32,
    ) -> Result<Value, String> {
        let mut params: Vec<(&str, String)> = vec![("page", page.to_string())];
        if let Some(apk_id) = apk_id {
            params.push(("apkId", apk_id.to_string()));
        }
        wrap_api_data(self.api_get("/v6/apk/giftList", &params).await?)
    }

    /// 下载版本列表
    /// 数据来源: GET /v6/apk/detail（取应用数字 ID）→ GET /v6/apk/downloadVersionList?id={数字ID}
    /// 注意：downloadVersionList 的 id 参数是应用数字 ID，传包名会恒返回"没有历史版本"
    pub async fn get_download_version_list(&self, package_name: &str) -> Result<Value, String> {
        let detail = wrap_api_data(
            self.api_get("/v6/apk/detail", &[("id", package_name.to_string())])
                .await?,
        )?;
        let apk_id = detail
            .get("data")
            .and_then(|d| d.get("id"))
            .map(value_to_string)
            .unwrap_or_default();
        if apk_id.is_empty() {
            return Ok(json!({ "code": 200, "data": [] }));
        }
        let raw = self
            .api_get(
                "/v6/apk/downloadVersionList",
                &[("id", apk_id), ("page", "1".to_string())],
            )
            .await?;
        Ok(json!({ "code": 200, "data": raw.get("data").cloned().unwrap_or(json!([])) }))
    }

    /// 图片列表(按标签)
    /// 数据来源: GET /v6/picture/list
    pub async fn get_picture_list(&self, tag: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/picture/list",
                &[("tag", tag.to_string()), ("page", page.to_string())],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 用户评分列表
    /// 数据来源: GET /v6/user/apkRatingList
    pub async fn get_user_rating_list(&self, uid: &str, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/user/apkRatingList",
                &[("uid", uid.to_string()), ("page", page.to_string())],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    /// 按开发者搜索应用
    /// 数据来源: GET /v6/apk/search?searchType=developer
    pub async fn search_apks_by_developer(
        &self,
        developer: &str,
        page: u32,
    ) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/apk/search",
                &[
                    ("searchType", "developer".to_string()),
                    ("developer", developer.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        let apks = Self::extract_apk_list(&raw, "all");
        Ok(json!({ "code": 200, "data": apks }))
    }

    /// 按标签搜索应用
    /// 数据来源: GET /v6/apk/search?searchType=tag
    pub async fn search_apks_by_tag(
        &self,
        tag: &str,
        apk_type: &str,
        page: u32,
    ) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/apk/search",
                &[
                    ("searchType", "tag".to_string()),
                    ("tag", tag.to_string()),
                    ("apkType", apk_type.to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        let apks = Self::extract_apk_list(&raw, "all");
        Ok(json!({ "code": 200, "data": apks }))
    }
}

/// 检查设备码是否符合官方结构（Base64 逆序解码后包含设备信息字段分号分隔符）
fn is_valid_device_code(code: &str) -> bool {
    if code.is_empty() {
        return false;
    }
    let mut rev: String = code.chars().rev().collect();
    let pad = (4 - (rev.len() % 4)) % 4;
    rev.push_str(&"=".repeat(pad));
    if let Ok(bytes) = BASE64.decode(rev.as_bytes()) {
        if let Ok(s) = std::str::from_utf8(&bytes) {
            return s.contains("; ");
        }
    }
    false
}

/// 按照官方客户端 C11918.java:248 规则生成标准设备码：
/// byte[] bytes = (android_id + "; ; ; ; " + manufacturer + "; " + brand + "; " + model + "; " + build_display + "; " + oaid).getBytes(Charsets.UTF_8);
/// String strReplace = new Regex("\\r\\n|\\r|\\n|=").replace(new StringBuilder(strEncodeToString).reverse().toString(), "");
fn generate_device_code_for_id(id: &str) -> String {
    use md5::{Digest, Md5};
    let mut hasher = Md5::new();
    hasher.update(id.as_bytes());
    let digest = hasher.finalize();
    let android_id = format!("{:016x}", u64::from_le_bytes(digest[..8].try_into().unwrap_or_default()));
    let raw = format!("{android_id}; ; ; ; Xiaomi; Xiaomi; 23113RKC6C; UKQ1.230804.001; ");
    let b64 = BASE64.encode(raw.as_bytes());
    let mut rev: String = b64.chars().rev().collect();
    rev.retain(|c| c != '=' && c != '\r' && c != '\n');
    rev
}

/// 生成随机设备码（官方标准逆序 Base64 格式）
fn generate_random_device_code() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let mut seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    seed ^= COUNTER
        .fetch_add(1, Ordering::Relaxed)
        .wrapping_mul(0x9E3779B97F4A7C15);
    seed ^= std::process::id() as u64;

    generate_device_code_for_id(&seed.to_string())
}

fn value_to_string(value: &Value) -> String {
    value
        .as_str()
        .map(str::to_owned)
        .or_else(|| value.as_u64().map(|number| number.to_string()))
        .or_else(|| value.as_i64().map(|number| number.to_string()))
        .unwrap_or_default()
}

fn value_to_string_opt(value: &Value) -> Option<String> {
    let s = value_to_string(value);
    if s.is_empty() { None } else { Some(s) }
}

/// 从评论详情的酷安 UA 中提取真实设备代号、系统版本与构建号。
/// 接口经常保留 useragent，却把 device_title 等便捷字段返回为空。
fn parse_reply_user_agent(user_agent: &str) -> (String, String, String) {
    let android_version = user_agent
        .split("Android ")
        .nth(1)
        .and_then(|value| value.split(';').next())
        .map(str::trim)
        .unwrap_or("");
    let build = user_agent
        .split(" Build/")
        .nth(1)
        .and_then(|value| value.split([')', ' ']).next())
        .map(str::trim)
        .unwrap_or("");

    let fallback_model = user_agent
        .split(" Build/")
        .next()
        .and_then(|value| value.rsplit("; ").next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("");

    let build_metadata = user_agent
        .split("(#Build; ")
        .nth(1)
        .and_then(|value| value.split(')').next())
        .map(|value| value.split(';').map(str::trim).collect::<Vec<_>>())
        .unwrap_or_default();
    let manufacturer = build_metadata.first().copied().unwrap_or("");
    let model = build_metadata
        .get(1)
        .copied()
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback_model);
    let device_title = [manufacturer, model]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    let rom_family = build_metadata
        .get(3)
        .copied()
        .unwrap_or("")
        .split('_')
        .next()
        .unwrap_or("");
    let rom_version = build_metadata.get(4).copied().unwrap_or("");
    let rom_label = [rom_family, rom_version]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    let device_rom = [
        (!android_version.is_empty()).then(|| format!("Android {android_version}")),
        (!rom_label.is_empty()).then_some(rom_label),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join(" · ");

    (device_title, build.to_string(), device_rom)
}

fn rank_feed_url(rank_type: &str) -> Option<&'static str> {
    match rank_type {
        // 实测：月榜 statType=30days 有效（6659/3676/3630），statType=month 返回空
        "month" => Some("#/feed/statList?statType=30days&sortField=likenum"),
        // 实测：收藏榜必须 statType=7days（favnum 排序），statType=all 返回空
        "favorite" => Some("#/feed/statList?statType=7days&sortField=favnum"),
        "index" => Some("#/feed/statList?statType=7days&sortField=detailnum"),
        _ => None,
    }
}

fn wrap_api_data(response: Value) -> Result<Value, String> {
    if let Some(err_msg) = response.get("error").and_then(Value::as_str) {
        if !err_msg.is_empty() && err_msg != "0" {
            return Err(err_msg.to_string());
        }
    }

    if let Some(message) = response.get("message").and_then(Value::as_str) {
        let code = response
            .get("code")
            .and_then(|v| {
                v.as_i64()
                    .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            })
            .unwrap_or(200);
        let status = response.get("status").and_then(|v| v.as_i64()).unwrap_or(1);
        let msg_status = response
            .get("messageStatus")
            .and_then(Value::as_str)
            .unwrap_or("");

        if msg_status == "err_request_captcha_v2" || response.get("messageExtra").is_some() {
            return Err(serde_json::to_string(&response).unwrap_or_else(|_| message.to_string()));
        }

        // 酷安成功信封：code 为 200/0/1 且 status 为 0/1（status=1004/500 等均属失败，
        // 例如"网络环境异常"会以 HTTP 200 + status=1004/500 的形式返回）
        if (code != 200 && code != 0 && code != 1)
            || !(status == 0 || status == 1)
            || msg_status.starts_with("err_")
        {
            return Err(message.to_string());
        }
    }

    if let Some(status) = response.get("status").and_then(|v| v.as_i64()) {
        if status < 0 {
            let msg = response
                .get("message")
                .or_else(|| response.get("error"))
                .and_then(Value::as_str)
                .unwrap_or("酷安服务端拒绝请求");
            return Err(msg.to_string());
        }
    }

    let data = response.get("data").cloned().unwrap_or(response);
    Ok(json!({ "code": 200, "data": data }))
}

fn is_safe_discovery_page_url(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > 2048 {
        return false;
    }
    if trimmed.chars().any(|ch| ch.is_control()) {
        return false;
    }
    let lower = trimmed.to_ascii_lowercase();
    !lower.starts_with("http://")
        && !lower.starts_with("https://")
        && !lower.starts_with("javascript:")
        && !lower.starts_with("file:")
        && !lower.starts_with("data:")
}

#[cfg(test)]
mod discovery_url_tests {
    use super::is_safe_discovery_page_url;

    #[test]
    fn accepts_server_page_routes() {
        assert!(is_safe_discovery_page_url("V11_FIND_COOLPIC"));
        assert!(is_safe_discovery_page_url("#/feed/digestList?page=1"));
        assert!(is_safe_discovery_page_url("/page?url=/product/feedList"));
    }

    #[test]
    fn rejects_external_and_script_urls() {
        assert!(!is_safe_discovery_page_url("https://example.com"));
        assert!(!is_safe_discovery_page_url("javascript:alert(1)"));
        assert!(!is_safe_discovery_page_url("file:///C:/secret"));
        assert!(!is_safe_discovery_page_url("bad\nroute"));
    }
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
