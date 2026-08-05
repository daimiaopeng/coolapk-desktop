use crate::coolapk::auth::CoolapkAuth;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::header::{HeaderMap, HeaderValue, COOKIE, USER_AGENT};
use reqwest::{Client, Method};
use serde_json::{json, Value};
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct CoolapkClient {
    client: Client,
    auth: CoolapkAuth,
    user_cookie: RwLock<Option<String>>,
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
    pub fn new() -> Self {
        let device_code = ephemeral_device_code();
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
        }
    }

    pub fn set_user_cookie(&self, cookie: String) -> Result<(), String> {
        let normalized = cookie.trim().to_string();
        let mut stored = self
            .user_cookie
            .write()
            .map_err(|_| "failed to lock login state".to_string())?;
        *stored = if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        };
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
            request = request.header(COOKIE, cookie);
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

        // 100% 严格拦截：必须有真实发帖人 Username & UID
        let raw_username = match username {
            Some(u) if !u.is_empty() => u,
            _ => return None,
        };

        let raw_uid = match uid {
            Some(u) if !u.is_empty() => u,
            _ => return None,
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
            "uid": raw_uid
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
        let apk_size = get_str_by_keys(obj, &["apkSizeFormatted", "size", "apk_size"]).unwrap_or_default();
        let down_num = get_str_by_keys(obj, &["downCountFormatted", "downnum", "download_count"]).unwrap_or_default();
        let category = get_str_by_keys(obj, &["category_title", "category_name", "category", "tag"]).unwrap_or_else(|| "应用".to_string());
        let version = get_str_by_keys(obj, &["apkVersionName", "version", "versionName"]).unwrap_or_default();

        let apk_type = get_u64_by_keys(obj, &["apkType", "apk_type", "type"]);
        let title_lower = title.to_lowercase();
        let cat_lower = category.to_lowercase();

        // 明确的游戏类型判定
        let is_explicit_game = apk_type == 1
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

    // 3. 科技快讯 (对接官方快讯专栏 #/feed/digestList?type=1，含平滑降级)
    pub async fn get_latest_feeds(&self, page: u32) -> Result<Value, String> {
        let res = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/digestList?type=1".to_string()),
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

        // 备用快讯/最新 API: /v6/page/dataList?url=%23%2Ffeed%2FnewestList
        let fallback = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/newestList".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&fallback) }))
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
                self.api_get(
                    "/v6/feed/replyList",
                    &[
                        ("id", feed_id.to_string()),
                        ("listType", "lastupdate".to_string()),
                        ("page", page.to_string()),
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
                        "replyRows": reply_rows,
                        "replyRowsCount": reply_rows_count
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
    pub async fn get_game_list(&self, page: u32, game_type: &str) -> Result<Value, String> {

        let page_url = match game_type {
            "hot" => "#/game/gameRankList",
            "new" => "#/game/newestList",
            "single" => "#/game/singleGameRankList",
            "online" => "#/game/onlineGameRankList",
            _ => "#/game/gameRankList",
        };

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
            Ok(ref json_val) => Self::extract_apk_list(json_val, "game"),
            Err(_) => Vec::new(),
        };

        if !apks.is_empty() {
            return Ok(json!({ "code": 200, "data": apks }));
        }

        // 如果榜单抓取为空，回退到对应的分类精准手游搜索（结合 isGame 强过滤）
        let query = match game_type {
            "single" => "单机手游",
            "online" => "网游手游",
            "casual" => "休闲游戏",
            "indie" => "独立游戏",
            _ => "手游",
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

    // 获取酷安应用中心列表/热门与分类榜单
    pub async fn get_app_list(&self, page: u32, cat: &str) -> Result<Value, String> {
        let page_url = match cat {
            "recommend" => "#/apk/rankList",
            "newest" => "#/apk/newestList",
            "tools" => "#/apk/rankList?type=tools",
            "social" => "#/apk/rankList?type=social",
            "media" => "#/apk/rankList?type=media",
            "beauty" => "#/apk/rankList?type=theme",
            _ => "#/apk/rankList",
        };

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

        let query = match cat {
            "tools" => "系统工具",
            "social" => "微信 社交",
            "media" => "播放器 影音",
            "beauty" => "壁纸 主题",
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

        let mut req = img_client
            .get(url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Referer", "https://www.coolapk.com/");

        if let Ok(guard) = self.user_cookie.read() {
            if let Some(cookie_str) = guard.as_ref() {
                req = req.header("Cookie", cookie_str);
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
        if bytes.len() > 20 * 1024 * 1024 {
            return Err("image exceeds the 20 MB desktop limit".to_string());
        }
        Ok(format!(
            "data:{content_type};base64,{}",
            BASE64.encode(bytes)
        ))
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

    pub async fn get_user_feeds(
        &self,
        uid: &str,
        page: u32,
        feed_type: &str,
    ) -> Result<Value, String> {
        let feed_type = match feed_type {
            "picture" => "picture",
            _ => "feed",
        };
        let raw = self
            .api_get(
                &format!("/v6/user/{feed_type}List"),
                &[
                    ("uid", uid.to_string()),
                    ("page", page.to_string()),
                    ("isIncludeTop", "1".to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
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
        let notification_type = match notification_type {
            "comment" | "like" | "feedlike" => notification_type,
            _ => "atme",
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

    pub async fn send_private_message(&self, uid: &str, message: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_post(
                "/v6/message/send",
                &[("uid", uid.to_string())],
                &[("message", message.to_string())],
            )
            .await?,
        )
    }

    pub async fn like_feed(&self, feed_id: &str) -> Result<Value, String> {
        self.post_id_action("/v6/feed/like", "id", feed_id).await
    }

    pub async fn unlike_feed(&self, feed_id: &str) -> Result<Value, String> {
        self.post_id_action("/v6/feed/unlike", "id", feed_id).await
    }

    pub async fn reply_feed(&self, feed_id: &str, message: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_post(
                "/v6/feed/reply",
                &[("id", feed_id.to_string()), ("type", "feed".to_string())],
                &[("message", message.to_string())],
            )
            .await?,
        )
    }

    pub async fn follow_user(&self, uid: &str) -> Result<Value, String> {
        self.post_id_action("/v6/user/follow", "uid", uid).await
    }

    pub async fn unfollow_user(&self, uid: &str) -> Result<Value, String> {
        self.post_id_action("/v6/user/unfollow", "uid", uid).await
    }

    pub async fn get_following_feeds(&self, page: u32) -> Result<Value, String> {
        self.api_get(
            "/v6/page/dataList",
            &[
                ("url", "/user/followFeedList".to_string()),
                ("page", page.to_string()),
            ],
        )
        .await
    }

    pub async fn get_follow_user_list(&self, uid: &str, page: u32) -> Result<Value, String> {
        self.api_get(
            "/v6/user/followList",
            &[
                ("uid", uid.to_string()),
                ("page", page.to_string()),
            ],
        )
        .await
    }

    pub async fn create_feed(&self, message: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_post(
                "/v6/feed/createFeed",
                &[],
                &[("message", message.to_string())],
            )
            .await?,
        )
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

    async fn post_id_action(&self, path: &str, field: &str, value: &str) -> Result<Value, String> {
        wrap_api_data(
            self.api_post(path, &[], &[(field, value.to_string())])
                .await?,
        )
    }
}

fn ephemeral_device_code() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    BASE64.encode(format!("coolapk-desktop:{nanos}:{}", std::process::id()))
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
mod tests {
    use super::*;

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
}

