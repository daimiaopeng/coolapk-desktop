# 酷安（CoolAPK）API 总览与可用性测试报告

> 文档数据来源：
> - [Coolapk-UWP/Coolapk-API-Collect](https://github.com/Coolapk-UWP/Coolapk-API-Collect)（酷安-API收集整理）
> - [Coolapk-kotlin](https://github.com/bjzhou/Coolapk-kotlin) 等第三方开源客户端
> - 本项目 `src-tauri/src/coolapk/client.rs` 实际接入的接口
>
> 可用性数据为 **2026-08-06 实测**（见 `src-tauri/src/coolapk/api_tests.rs` 中
> `probe_all_documented_endpoints_from_collect` 测试，测试通过即代表接口当前可用）。
>
> 免责声明：本文档仅用于学习与测试，请勿滥用酷安官方接口。

## 目录

1. [通用说明](#通用说明)
   - [基础 URL 与请求头](#基础-url-与请求头)
   - [Token 认证机制](#token-认证机制)
   - [响应结构](#响应结构)
   - [状态标记说明](#状态标记说明)
2. [信息流 / 主页](#信息流--主页)
3. [搜索](#搜索)
4. [动态与评论](#动态与评论)
5. [用户](#用户)
6. [话题](#话题)
7. [应用（APK）](#应用apk)
8. [数码（产品）](#数码产品)
9. [看看号（官方号）](#看看号官方号)
10. [通知与私信](#通知与私信)
11. [登录鉴权](#登录鉴权)
12. [写接口（点赞/关注/评论/发帖/发私信）](#写接口点赞关注评论发帖发私信)
13. [已废弃接口汇总](#已废弃接口汇总)
14. [测试方法](#测试方法)

---

## 通用说明

### 基础 URL 与请求头

所有接口基础 URL：`https://api.coolapk.com`

| 请求头 | 必要性 | 说明 |
| - | - | - |
| `User-Agent` | 推荐 | 需带 `+CoolMarket/<版本号>`，如 `Dalvik/2.1.0 (Linux; U; Android 16; ...) +CoolMarket/16.2.0-2604201-universal` |
| `X-App-Token` | **必要** | 动态生成的 v3 Token，见下节 |
| `X-Requested-With` | **必要** | `XMLHttpRequest` 返回 JSON；`com.coolapk.market` 会返回 HTML |
| `X-Sdk-Int` | 必要 | Android SDK 版本，如 `36` |
| `X-Sdk-Locale` | 必要 | `zh-CN` |
| `X-App-Id` | 必要 | `com.coolapk.market` |
| `X-App-Version` | 必要 | `16.2.0` |
| `X-App-Code` | 必要 | `2604201` |
| `X-Api-Version` | 必要 | `16` |
| `X-App-Device` | 非必要 | 设备码，本项目每次启动随机生成 |
| `X-Dark-Mode` | 非必要 | `0` / `1` |
| `Cookie` | 需登录接口 | 由 `token`/`username`/`uid`/`SESSID` 组成 |

本项目在 `CoolapkClient::new()`（`src-tauri/src/coolapk/client.rs`）中统一构造了上述请求头。

### Token 认证机制

酷安 V6 API 的 `X-App-Token` 采用**时间戳 + 设备码 + 内置密钥片段**动态签名：

- 版本：`v3`（`v1` 已废弃，`v2` 部分废弃）
- 算法：按当前时间从内置 auth blob 取片段 → 拼接 `com.coolapk.market & 片段 & 设备码MD5 & 时间戳 & AppCode` → Base64 → MD5 → 取 22 位盐 → **bcrypt（cost=10）** → 得到 token
- 由于 bcrypt 盐存在无效位，时间点前 15 秒内自动向前探测重试

本项目实现见 `src-tauri/src/coolapk/auth.rs`（`CoolapkAuth::get_app_token`），Token 由服务端时间 + 设备码唯一决定，无需登录即可调用公开接口。

### 响应结构

成功响应统一为：

```json
{
  "code": 200,
  "message": "",
  "data": [ ... ]   // 或单个对象
}
```

- `status < 0` / `code != 200` 表示失败
- 常见错误：
  - `401` → 未登录或登录失效
  - `-10001` + `forwardUrl=/account/login` → 未登录跳转
  - `"验证码"` 消息 → 触发反爬验证码
  - `"API unsupported."` → 接口已废弃
  - `"does not exists"` → 接口不存在

### 状态标记说明

| 标记 | 含义 |
| - | - |
| ✅ 可用 | 实测返回数据，无需登录 |
| 🔒 需登录 | 接口可达（返回 401 / 登录跳转），带 Cookie 后可用 |
| ❌ 已废弃 | 接口下线（`API unsupported` / `does not exists`） |
| 🚫 被拦截 | 接口存在但触发反爬（验证码）或权限拦截 |
| 🔌 已接入 | 本项目 `CoolapkTauriAPI` 已封装（`src/api/coolapk.ts`） |
| 🆕 新接入 | 本次调研后新封装（client.rs + commands.rs + coolapk.ts） |

---

## 信息流 / 主页

### GET `/v6/main/indexV8` — 首页推荐（V8）✅ 可用 · 🔌 已接入

| 参数 | 类型 | 必要性 | 说明 |
| - | - | - | - |
| page | num | 必要 | 页数，从 1 起 |
| firstItem / lastItem | num | 非必要 | 分页游标 |

Rust 方法：`get_index_v8_feeds(page)`
TS 方法：`getIndexV8Feeds(page)`

### GET `/v6/main/init` — 首页 Tab 配置 / 热门搜索 ✅ 可用 · 🆕 新接入

无参数。返回首页各 Tab（关注/头条/热榜/快讯/话题等）的频道配置，以及热门搜索词。

Rust 方法：`get_tab_config()`
TS 方法：`getTabConfig()`

### GET `/v6/main/index` — 主页（V7）✅ 可用（未接入，V8 已取代）

| 参数 | 类型 | 必要性 | 说明 |
| - | - | - | - |
| page | num | 必要 | 页数，从 1 起 |

### GET `/v6/apk/index` — 应用 & 游戏（V7）✅ 可用（未接入）

| 参数 | 类型 | 必要性 | 说明 |
| - | - | - | - |
| apkType | num | 必要 | `1`=应用，`2`=游戏 |
| page | num | 必要 | 页数，从 1 起 |

### GET `/v6/page/dataList` — 通用列表页 ✅ 可用 · 🔌 已接入

通过 `url` 参数加载各频道动态，是项目信息流的主干接口。

| 参数 | 类型 | 必要性 | 说明 |
| - | - | - | - |
| url | str | 必要 | 频道标识（见下表） |
| page | num | 必要 | 页数，从 1 起 |
| title | str | 非必要 | 页面标题 |

常用 `url` 取值与项目集成：

| url | 含义 | 集成 |
| - | - | - |
| `#/feed/hotList` | 24H 热榜 | `getHotFeeds` |
| `#/feed/digestList` | 精选热帖 | `getDigestFeeds` |
| `#/feed/digestList?type=1` | 科技快讯 | `getLatestFeeds` |
| `#/feed/digestList?type=8&message_status=all` | 酷图热榜 | `getCoolPictureRank` |
| `#/feed/newestList` | 全站最新 | `getLatestFeeds` 兜底 |
| `#/apk/rankList` | 应用榜单 | `getAppList` |
| `#/apk/newestList` | 应用最新 | `getAppList` |
| `#/feed/apkCommentList` | 应用所属动态 | `getApkFeeds` 🆕 |
| `/page?url=/product/feedList` | 产品所属动态 | `getProductFeeds` 🆕 |
| `/page?url=V11_FIND_GOOD_GOODS_HOME` | 好物/二手 | `getSecondhandFeeds` |
| `/user/followFeedList` | 关注动态 | `getFollowingFeeds` |
| 其他 `V9_HOME_TAB_*` / `V10_CHANNEL_*` 等 | 各频道 | `getBoardFeeds` |

### ❌ 已废弃的 V7 主页接口（实测返回 `API unsupported.`）

| 接口 | 原用途 |
| - | - |
| `/album/index` | 应用集 |
| `/apk/realRankList` | 排行 |
| `/apk/categoryList` | 分类 |
| `/appForum/list` | 应用吧 |
| `/discovery/index` | 发现频道 |
| `/picture/list` | 酷图 |
| `/topic/feedList` | 应用圈 |
| `/topic/recentFeedList` | 全站 |
| `/topic/hotFeedList` | 热门 |

---

## 搜索

### GET `/v6/search` — 全站搜索 ✅ 可用 · 🔌 已接入

| 参数 | 类型 | 必要性 | 说明 |
| - | - | - | - |
| type | str | 必要 | `all`=全部，`feed`=动态，`apk`=应用，`game`=游戏，`topic`=话题，`user`=用户，`product`=数码，`dyh`=看看号 |
| searchValue | str | 必要 | 搜索关键词 |
| page | num | 必要 | 页数，从 1 起 |
| show_flag | num | 非必要 | `1` |
| sortType | str | 非必要 | 动态搜索排序 |

项目集成：
- `searchAll` / `searchFeeds` / `searchApks` / `searchGames` / `getGameList`
- `getTopicHubData`（分类话题）底层亦使用本接口（type=topic）

### GET `/v6/search/suggestSearchWordsNew` — 搜索候选词 ✅ 可用 · 🆕 新接入

| 参数 | 类型 | 必要性 | 说明 |
| - | - | - | - |
| searchValue | str | 必要 | 输入前缀，返回联想词 |

Rust 方法：`get_search_suggestions(query)`
TS 方法：`getSearchSuggestions(query)`

---

## 动态与评论

### GET `/v6/feed/detail` — 动态详情 🚫 未登录时被验证码拦截 · 🔌 已接入

| 参数 | 类型 | 必要性 | 说明 |
| - | - | - | - |
| id | num | 必要 | 动态 ID |

未登录访问会触发验证码；带有效 Cookie 后正常。项目已接入（`getFeedDetail`）。

### GET `/v6/feed/hotReplyList` — 热门回复 ✅ 可用 · 🔌 已接入

| 参数 | 类型 | 必要性 | 说明 |
| - | - | - | - |
| id | num | 必要 | 动态 ID |
| page | num | 必要 | 页数 |
| discussMode | num | 非必要 | `1` |

Rust 方法：`get_hot_replies(feed_id, page)` / `get_feed_replies` 首选路

### GET `/v6/feed/replyList` — 评论列表（含楼中楼） ✅ 可用 · 🔌 已接入

| 参数 | 类型 | 必要性 | 说明 |
| - | - | - | - |
| id | num | 必要 | 动态 ID |
| rid | num | 非必要 | 楼中楼目标回复 ID |
| listType | str | 非必要 | `lastupdate`=最近回复 |
| page | num | 必要 | 页数 |

Rust 方法：`get_feed_replies` / `get_sub_replies(feed_id, reply_id, page)`

---

## 用户

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/user/space` | 🔒 需登录 | 🔌 `getUserSpace` | uid |
| `GET /v6/user/profile` | 🔒 需登录 | 🔌 `getUserProfile` | uid |
| `GET /v6/user/feedList` | ✅ 可用 | 🔌 `getUserFeeds` | uid, page, isIncludeTop |
| `GET /v6/user/pictureList` | ❌ 已废弃 | 🔌 `getUserFeeds(type=picture)` | uid, page |
| `GET /v6/user/replyList` | 🚫 被拦截 | 🔌 `getUserFeeds(type=reply)` | uid, page |
| `GET /v6/user/apkRatingList` | ✅ 可用（空数据） | 🔌 `getUserFeeds(type=rating)` | uid, page |
| `GET /v6/user/ershouList` | ❌ 已废弃 | 🔌 `getUserFeeds(type=ershou)` | uid, page |
| `GET /v6/user/favList` | ❌ 已废弃 | 🔌 `getUserFeeds(type=fav)` | uid, page |
| `GET /v6/user/followList` | ✅ 可用 | 🔌 `getFollowUserList` | uid, page |
| `GET /v6/user/customNodeList` | ❌ 已废弃 | 🔌 `getUserFollowNodes` | uid |
| `GET /v6/account/loadConfig` | 🔒 需登录 | 未接入 | key=`my_page_card_config` |
| `GET /v6/account/checkLoginInfo` | 🔒 需登录 | 🆕 `checkLoginInfo` | 无参数 |

`checkLoginInfo` 是比 `user/space` 更轻量的登录态检测接口。

**注意：** `user/replyList` 返回 `"使用非官方版可能会导致你号没了"` 安全警告而非数据，接口存在但被安全策略拦截。
`user/pictureList`/`user/ershouList`/`user/favList` 均返回 `"does not exists"` 已废弃。

---

## 话题

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/topic/newTagDetail` | ✅ 可用 | 🔌 `getTopicDetail` | tag（名称或 ID） |
| `GET /v6/topic/tagDetail` | ✅ 可用 | 🆕 `getTopicDetailV7` | tag（名称或 ID） |
| `GET /v6/topic/tagFeedList` | ✅ 可用 | 🔌 `getTopicFeeds` | tag, page, listType |
| `GET /v6/topic/tagList` | ✅ 可用 | 🔌 `getTopicHubData` | sort=hot/follow/new, page |

---

## 应用（APK）

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/apk/detail` | ✅ 可用 | 🔌 `getAppDetail` | id（包名） |
| `GET /v6/page/dataList#/apk/rankList` | ✅ 可用 | 🔌 `getAppList` | page |
| `GET /v6/page/dataList#/feed/apkCommentList` | ✅ 可用 | 🆕 `getApkFeeds` | id（包名）, sort, page |

`getApkFeeds` 参数：sort 取 `lastupdate_desc`（最近回复）/ `dateline_desc`（最近发布）/ `popular`（热门）。

### V8 页面频道列表

以下页面通过 `GET /v6/page/dataList?url=<page_name>` 访问，均为实测可用（**提示：`/v6/page` 直连已废弃，必须用 `/v6/page/dataList`**）：

**首页 Tab：**

| 页面名称 | 标题 | 实测 |
| - | - | - |
| `V9_HOME_TAB_FOLLOW` | 关注 | ✅ |
| `V9_HOME_TAB_HEADLINE` | 头条 | ✅ |
| `V9_HOME_TAB_RANKING` | 热榜 | ✅ |
| `V11_HOME_TAB_NEWS` | 快讯 | ✅ |
| `V8_HUODONG_XIANLIAO_20210523` | 闲聊 | ✅ |
| `V9_HOME_TAB_TOPIC` | 话题 | ✅ |
| `V11_HOME_NEW` | 新机 | ✅ |
| `V13_IOSHOME_OPENSHOW` | 开箱 | ✅ |
| `V13_HOME_SHEYING` | 摄影 | ✅ |
| `V11_HOME_TABJC` | 教程 | ✅ |
| `V11_HOME_CAR` | 汽车 | ✅ |
| `V14_WAISHE` | 外设 | ✅ |
| `V9_HOME_TAB_LIVE` | 直播 | ✅ |
| `V9_HOME_TAB_SHIPIN` | 视频 | ✅ |
| `V9_HOME_TAB_WENDA` | 问答 | ✅ |
| `V11_HOME_MEIHUA` | 美化 | ✅ |
| `V12_HOME_KUBANG` | 好物榜 | ✅（空数据） |

**发现 Tab：**

| 页面名称 | 标题 | 实测 |
| - | - | - |
| `V11_FIND_COOLPIC` | 酷图 | ✅ |
| `V11_FIND_GOODS` | 酷品 | ✅ |
| `V8_ZHUANTI_HOT_20201215` | 热议 | ✅（偶尔 EOF） |
| `V11_FIND_GOOD_GOODS_HOME` | 好物 | ✅ |
| `V11_DISCOVERY_SECOND_HAND` | 二手 | ✅ |
| `V13_PINGFEN` | 评分 | ✅（偶尔 EOF） |
| `V12_FIND_KUBANG` | 好物榜 | ✅（空数据） |

**数码 Tab：**

| 页面名称 | 标题 | 实测 |
| - | - | - |
| `V10_DIGITAL_HOME` | 数码首页 | ✅ |
| `V10_CHANNEL_SJB` | 手机 | ✅ |
| `V8_ZHUANTI_COMPUTER_20230413` | 电脑 | ✅ |
| `V11_ZHUANTI_EARPHONE` | 耳机 | ✅（空数据） |
| `V10_CHANNEL_SMB_TOP` | 排行榜 | ✅ |
| `V13_DIGITAL_ROM` | ROM/系统 | ✅ |

**市场/应用游戏 Tab：**

| 页面名称 | 标题 | 实测 |
| - | - | - |
| `V10_MARKET_HOME` | 精选 | ✅ |
| `V8_MARKET_APP` | 应用 | ✅ |
| `V8_MARKET_GAME` | 游戏 | ✅ |
| `V8_MARKET_ALBUM` | 应用集 | ✅ |
| `V10_MARKET_RANK` | 排行 | ✅ |

**关注分组（`V9_HOME_TAB_FOLLOW` 的 `type` 子维度）：**

| type 参数 | 含义 | 实测 |
| - | - | - |
| （无） | 全部关注 | ✅ |
| `circle` | 好友关注 | ✅ |
| `apk` | 应用关注 | ✅ |
| `topic` | 话题关注 | ✅ |
| `question` | 问题关注 | ✅ |
| `product` | 数码关注 | ✅ |

---

## 数码（产品）

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/product/detail` | ✅ 可用 | 🆕 `getProductDetail` | id（产品 ID） |
| `GET /v6/page/dataList?url=/page?url=/product/feedList` | ✅ 可用 | 🆕 `getProductFeeds` | id, type, page |

`getProductFeeds` 参数：type 取 `feed`（讨论）/ `answer`（问答）/ `article`（图文）/ `video`（视频）/ `trade`（交易）。
测试用真实产品 ID：`5573`（三星 Galaxy Z Fold8）。

---

## 看看号（官方号）

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/dyh/detail` | ✅ 可用 | 🆕 `getDyhDetail` | dyhId |
| `GET /v6/dyhArticle/list` | ✅ 可用 | 🆕 `getDyhFeeds` | dyhId, type=`all`/`square`, page |

测试用真实看看号 ID：`1429`（酷安瞎扯）。

---

## 通知与私信

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/notification/checkCount` | ✅ 可用 | 🔌 `getNotificationCount` | 无 |
| `GET /v6/notification/atme` | ❌ 已废弃 | 🔌 `getNotifications` | page |
| `GET /v6/notification/comment` | ❌ 已废弃 | 🔌 `getNotifications` | page |
| `GET /v6/notification/like` | ❌ 已废弃 | 🔌 `getNotifications` | page |
| `GET /v6/notification/feedlike` | ❌ 已废弃 | 🔌 `getNotifications` | page |
| `GET /v6/message/list` | 🔒 需登录 | 🔌 `listMessages` | page |
| `GET /v6/message/chat` | 🔒 需登录 | 🔌 `listChatHistory` | ukey, page |
| `GET /v6/message/send` | 🔒 需登录（GET） | 🔌 `sendPrivateMessage` | uid, message |

---

## 登录鉴权

| 接口 | 实测状态 | 说明 |
| - | - | - |
| `POST /v6/account/login` | ❌ 已废弃（403 Unsupported） | 官方已停用第三方账号密码登录 |
| `POST /v6/account/sendVcode` | ❌ 已废弃 | 短信验证码下发已停用 |
| `POST /v6/account/loginByMobile` | ❌ 已废弃 | 手机验证码登录已停用 |
| 网页授权 `account.coolapk.com/auth/loginByCoolapk` | ✅ 可用 | 项目采用 Webview 官方授权，回跳捕获 Cookie（`SESSID`/`uid`/`token`） |

建议登录方式：Webview 官方授权 → 捕获 Cookie → 通过 `save_cookie_securely` 持久化。

---

## 写接口（点赞/关注/评论/发帖/发私信）

> **重要**：酷安 V6 写接口全部使用 **GET** 方法（POST 返回 404「请求方式错误」）。

| 接口 | 方法 | 实测状态 | 集成 | 参数 |
| - | - | - | - | - |
| `GET /v6/feed/like` | GET | 🔒 需登录 | 🔌 `likeFeed` | id |
| `GET /v6/feed/unlike` | GET | 🔒 需登录 | 🔌 `unlikeFeed` | id |
| `GET /v6/feed/reply` | GET | 🔒 需登录 | 🔌 `replyFeed` | id, type=feed, message, rid |
| `GET /v6/feed/createFeed` | GET | 🔒 需登录 | 🔌 `createFeed` | message |
| `GET /v6/user/follow` | GET | 🔒 需登录 | 🔌 `followUser` | uid |
| `GET /v6/user/unfollow` | GET | 🔒 需登录 | 🔌 `unfollowUser` | uid |
| `GET /v6/message/send` | GET | 🔒 需登录 | 🔌 `sendPrivateMessage` | uid, message |

---

## 应用（APK）补充

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/apk/discovererList` | ✅ 可用 | 未接入 | id（包名）, page |
| `GET /v6/apk/recommendList` | ✅ 可用 | 未接入 | apkType, title, subTitle, page |
| `GET /v6/apk/qr` | ✅ 可用（空数据） | 未接入 | id（包名） |
| `GET /v6/apk/url` | ✅ 可用（空数据） | 未接入 | id（包名） |
| `GET /v6/apk/downloadVersionList` | ✅ 可用 | 未接入 | id（包名） |
| `GET /v6/apk/search?searchType=tag` | ✅ 可用 | 未接入 | tag, apkType, rankType, page |
| `GET /v6/apk/search?searchType=developer` | ✅ 可用（空数据） | 未接入 | developer, page |
| `GET /v6/apk/giftList` | ✅ 可用 | 未接入 | apkId（非必须）, page |
| `POST /v6/apk/checkUpdate` | 🚫 GET 可用 | 未接入 | pkgs（包名列表，multipart） |

## 专辑（应用集）

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/album/list` | ✅ 可用 | 未接入 | listType, page |
| `GET /v6/album/search` | ✅ 可用 | 未接入 | q, page |
| `GET /v6/album/detail` | ✅ 可用 | 未接入 | id |
| `GET /v6/album/replyList` | ✅ 可用（空数据） | 未接入 | id, page |

## 头条 / 编辑精选 / 更新列表

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/main/headline` | ✅ 可用 | 未接入 | page |
| `GET /v6/main/updateList` | ✅ 可用 | 未接入 | page |
| `GET /v6/main/checkHeadlineCount` | ✅ 可用（空数据） | 未接入 | firstItem |
| `GET /v6/feed/editorChoiceList` | ✅ 可用 | 未接入 | page |

## 收藏管理

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/favorite/list` | 🔒 需登录 | 未接入 | type（feed/apk/album）, page |
| `POST /v6/feed/favorite` | 🔒 需登录 | 未接入 | id |
| `POST /v6/feed/unFavorite` | 🔒 需登录 | 未接入 | id, targetType |
| `POST /v6/apk/favorite` | 🔒 需登录 | 未接入 | id |
| `POST /v6/apk/unFavorite` | 🔒 需登录 | 未接入 | id, targetType |

## 黑名单 / 忽略 / 限制

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/user/blackList` | 🔒 需登录 | 未接入 | page |
| `GET /v6/user/ignoreList` | 🔒 需登录 | 未接入 | page |
| `GET /v6/user/limitList` | 🔒 需登录 | 未接入 | page |
| `POST /v6/user/addToBlackList` | 🔒 需登录 | 未接入 | uid |
| `POST /v6/user/removeFromBlackList` | 🔒 需登录 | 未接入 | uid |
| `POST /v6/user/addToIgnoreList` | 🔒 需登录 | 未接入 | uid |
| `POST /v6/user/removeFromIgnoreList` | 🔒 需登录 | 未接入 | uid |

## 图片

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/picture/list` | ✅ 可用 | 未接入 | tag, type, page |
| `GET /v6/picture/userPictures` | ✅ 可用（空数据） | 未接入 | uid, page |

## 设备 / OAuth

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/device/ip` | ✅ 可用（特殊返回） | 未接入 | 无 |
| `GET /v6/account/accessToken` | 🔒 需登录 | 未接入 | code |

## 用户补充端点

| 接口 | 实测状态 | 集成 | 参数 |
| - | - | - | - |
| `GET /v6/user/apkRatingList` | ✅ 可用（空数据） | 未接入 | uid, page |
| `GET /v6/user/discoveryList` | ✅ 可用（空数据） | 未接入 | uid, page |
| `GET /v6/user/albumlist` | ✅ 可用（空数据） | 未接入 | uid, page |
| `GET /v6/user/apkFollowList` | ✅ 可用（空数据） | 未接入 | uid, page |

---

## 已废弃接口汇总

| 接口 | 原因 |
| - | - |
| `/album/index`, `/apk/realRankList`, `/apk/categoryList`, `/appForum/list`, `/discovery/index`, `/picture/list`, `/topic/feedList`, `/topic/recentFeedList`, `/topic/hotFeedList` | V7 主页接口，返回 `API unsupported.` |
| `/v6/page`（直连） | V8 页面直连已废弃，改用 `/v6/page/dataList` |
| `/v6/user/customNodeList` | 用户关注节点已下线 |
| `/v6/user/pictureList` | 用户酷图列表已下线 |
| `/v6/user/ershouList` | 用户二手列表已下线 |
| `/v6/user/favList` | 用户收藏列表已下线 |
| `/v6/feed/followFeedList` | 关注动态专用端点已下线，改用 dataList |
| `/v6/notification/{atme,comment,like,feedlike}` | 通知列表接口已下线（`checkCount` 仍可用） |
| `/v6/account/login`, `/v6/account/sendVcode`, `/v6/account/loginByMobile` | 官方停用第三方登录 API（403 Unsupported） |

---

## 测试方法

完整可用性测试位于 `src-tauri/src/coolapk/api_tests.rs`，均为 `#[ignore]` 联网测试（共 6 个测试函数，覆盖 155+ 个探测用例）：

```bash
# 全部文档化 API 探测（40 个端点，含可登录检测）
cargo test --lib probe_all_documented_endpoints_from_collect -- --ignored --nocapture

# 只读接口冒烟测试（32 个）
cargo test --lib probe_readonly_endpoints_smoke -- --ignored --nocapture

# 写接口 HTTP 方法探测（确认 GET/POST 可用性）
cargo test --lib probe_all_write_endpoints_http_method -- --ignored --nocapture

# 补充额外端点（58 个：V8页面/用户子类型/搜索/通知等）
cargo test --lib probe_extra_endpoints_from_web -- --ignored --nocapture

# 深度探测（25 个：api2路由/V8直连/更多排序类型等）
cargo test --lib probe_more_endpoints_deep -- --ignored --nocapture

# api2 主机 + 静态资源探测
cargo test --lib probe_api2_and_static_endpoints -- --ignored --nocapture

# 未文档化端点探测（31 个：album/headline/favorite/blacklist/gift 等）
cargo test --lib probe_undocumented_endpoints -- --ignored --nocapture

# 一键运行全部 API 测试（7 个测试函数）
cargo test --lib coolapk::client::api_tests:: -- --ignored --nocapture
```

### 2026-08-06 实测汇总

**总览：7 个测试函数，191+ 个探测用例，覆盖 100+ 个不同接口端点**

| 分类 | 数量 | 可用 | 需登录 | 已废弃 | 被拦截 |
| - | - | - | - | - | - |
| 基础文档化 API | 40 | 24 | 5 | 10 | 1 |
| 只读接口冒烟 | 32 | 22 | 3 | 5 | 2 |
| 补充端点（V8页面/用户/通知等） | 58 | 45 | 1 | 7 | 5 |
| 深度探测（api2/直连/排序等） | 25 | 11 | 1 | 10 | 3 |
| 写接口方法探测 | 20 | 7（GET） | - | 3 | 10（POST） |
| 未文档化端点 | 31 | 21 | 6 | 0 | 4 |

**核心发现（更新）：**

| 发现 | 说明 |
| - | - |
| **V8 页面访问** | 必须通过 `/v6/page/dataList`；`/v6/page` 直连已废弃 |
| **api2.coolapk.com** | 作为专用路由主机可用，但 `user/profile` 在 api2 上会重定向到 HTML |
| **写接口方法** | 所有写接口**只能用 GET**，POST 全部返回 404「请求方式错误」 |
| **用户子端点** | `pictureList`/`ershouList`/`favList` 已废弃，`replyList` 被安全策略拦截 |
| **通知端点** | `atme`/`comment`/`like`/`feedlike` 全部已废弃，仅 `checkCount` 仍可用 |
| **登录接口** | `account/login`/`sendVcode`/`loginByMobile` 全部 403 废弃，仅 Webview OAuth 可用 |
| **动态详情** | 未登录触发验证码拦截，需带 Cookie |
| **静态资源** | `avatar.coolapk.com` ✅ / `static.coolapk.com` ✅ / `image.coolapk.com` ❌ 问题（HTTP 567） |
| **新发现可用接口** | `album/list`、`album/search`、`main/headline`、`main/updateList`、`feed/editorChoiceList`、`apk/discovererList`、`apk/recommendList`、`apk/giftList`、`apk/search?searchType=tag`、`picture/list?tag=` 等 20+ 个 |
| **需登录新接口** | `favorite/list`、`user/blackList`、`user/ignoreList`、`user/limitList`、`account/accessToken` 等 |
