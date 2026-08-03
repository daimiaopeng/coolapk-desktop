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

impl CoolapkClient {
    pub fn new() -> Self {
        let device_code = ephemeral_device_code();
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Dalvik/2.1.0 (Linux; U; Android 16; 23113RKC6C Build/AQ3A.250226.002) +CoolMarket/16.2.0-2604201-universal"),
        );
        headers.insert(
            "X-Requested-With",
            HeaderValue::from_static("XMLHttpRequest"),
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
        let mut request = self
            .client
            .request(method, url)
            .header("X-App-Token", token)
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
        let is_top = obj.get("is_top").and_then(|v| v.as_u64()).unwrap_or(0);
        let likenum = obj.get("likenum").and_then(|v| v.as_u64()).unwrap_or(0);
        let replynum = obj.get("replynum").and_then(|v| v.as_u64()).unwrap_or(0);
        let fav_num = obj.get("favnum").and_then(|v| v.as_u64()).unwrap_or(0);
        let share_num = obj.get("sharenum").and_then(|v| v.as_u64()).unwrap_or(0);

        let hit_num = obj
            .get("hitnum")
            .or_else(|| obj.get("clicknum"))
            .or_else(|| obj.get("read_num"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let target_type = obj
            .get("target_row")
            .and_then(|v| v.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        Some(json!({
            "id": feed_id,
            "username": raw_username,
            "userAvatar": avatar,
            "userLevel": obj.get("level").and_then(|v| v.as_str()).unwrap_or(""),
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

    // 2. 24H 热榜
    pub async fn get_hot_feeds(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/hotList".to_string()),
                    ("title", "热门".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
    }

    // 3. 全站最新
    pub async fn get_latest_feeds(&self, page: u32) -> Result<Value, String> {
        let raw = self
            .api_get(
                "/v6/page/dataList",
                &[
                    ("url", "#/feed/newestList".to_string()),
                    ("title", "最新".to_string()),
                    ("page", page.to_string()),
                ],
            )
            .await?;
        Ok(json!({ "code": 200, "data": Self::extract_cleaned_list(&raw) }))
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

    // 8. 楼层评论（lastupdate_desc 返回完整最新评论，hotReplyList 只返回热门评论）
    pub async fn get_feed_replies(&self, feed_id: &str, page: u32) -> Result<Value, String> {
        let full_url = format!(
            "https://api.coolapk.com/v6/feed/replyList?id={}&listType=lastupdate_desc&page={}",
            feed_id, page
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

                    cleaned_replies.push(json!({
                        "id": obj.get("id").and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_u64().map(|n| n.to_string()))).unwrap_or_default(),
                        "rid": obj.get("rid").map(value_to_string).unwrap_or_default(),
                        "rrid": obj.get("rrid").map(value_to_string).unwrap_or_default(),
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

    pub async fn get_image_data_url(&self, source_url: &str) -> Result<String, String> {
        let mut url =
            reqwest::Url::parse(source_url).map_err(|e| format!("invalid image URL: {e}"))?;
        let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
        if !host.ends_with("coolapk.com") {
            return Err("only Coolapk image hosts are allowed".to_string());
        }
        if url.scheme() == "http" {
            url.set_scheme("https")
                .map_err(|_| "failed to upgrade image URL to HTTPS".to_string())?;
        }

        let response = self
            .client
            .get(url)
            .header("X-App-Token", self.auth.get_app_token()?)
            .header("Referer", "https://www.coolapk.com/")
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
    if let Some(message) = response.get("message").and_then(Value::as_str) {
        let code = response.get("code").and_then(Value::as_i64).unwrap_or(0);
        if code != 0 && code != 200 {
            return Err(message.to_string());
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
