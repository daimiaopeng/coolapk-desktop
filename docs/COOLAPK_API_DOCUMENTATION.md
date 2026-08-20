# 酷安 (Coolapk) 官方原生 API 接口全量文档

> **说明**：本文档基于酷安 Android 客户端全量反编译源码（`com.coolapk.market`、`UriActionUtils`、`ActionManager`、`DataManager`、`AuthUtils`、`HttpClientFactory` 等）逆向分析与梳理整理而成。包含全部网络接口定义、请求方式、Header 鉴权规范、URL 路径、请求参数以及字段含义。

---

## 目录

1. [接口基础规范与鉴权机制](#一接口基础规范与鉴权机制)
   - 1.1 [基本请求信息](#11-基本请求信息)
   - 1.2 [请求头 (Headers) 规范](#12-请求头-headers-规范)
   - 1.3 [X-App-Token 算法解析](#13-x-app-token-算法解析)
   - 1.4 [标准响应结构](#14-标准响应结构)
2. [首页与通用卡片流 (Main & Page API)](#二首页与通用卡片流-main--page-api)
3. [动态与帖子模块 (Feed API)](#三动态与帖子模块-feed-api)
4. [评论与回复模块 (Reply & Comment API)](#四评论与回复模块-reply--comment-api)
5. [用户与社交关系模块 (User API)](#五用户与社交关系模块-user-api)
6. [话题与标签模块 (Topic & Tag API)](#六话题与标签模块-topic--tag-api)
7. [应用与游戏市场模块 (Apk & Game API)](#七应用与游戏市场模块-apk--game-api)
8. [搜索与推荐模块 (Search & Discovery API)](#八搜索与推荐模块-search--discovery-api)
9. [私信与通知模块 (Message & Notification API)](#九私信与通知模块-message--notification-api)
10. [数码产品与评分模块 (Product & Rating API)](#十数码产品与评分模块-product--rating-api)
11. [收藏与历史记录模块 (Collection & History API)](#十一收藏与历史记录模块-collection--history-api)
12. [账号与登录认证模块 (Account & Auth API)](#十二账号与登录认证模块-account--auth-api)
13. [二手好物与交易模块 (Ershou & Goods API)](#十三二手好物与交易模块-ershou--goods-api)

---

## 一、接口基础规范与鉴权机制

### 1.1 基本请求信息

* **API 主机地址 (Base URL)**：`https://api.coolapk.com`
* **Web/H5 主机地址**：`https://m.coolapk.com`
* **用户认证服务**：`https://account.coolapk.com`
* **静态资源/图片 CDN**：`https://image.coolapk.com` / `https://avatar.coolapk.com`
* **数据交换格式**：JSON / UTF-8
* **网络传输协议**：HTTPS (TLS 1.2 / TLS 1.3)

---

### 1.2 请求头 (Headers) 规范

所有发往 `api.coolapk.com` 的请求均需携带以下标准请求头：

| 请求头字段 | 示例值 | 说明 |
| :--- | :--- | :--- |
| `Host` | `api.coolapk.com` | 服务器主机名 |
| `User-Agent` | `Dalvik/2.1.0 (Linux; U; Android 14; 23113RKC6C Build/UKQ1.230804.001) +CoolMarket/14.5.2-2412151-universal` | 客户端 UA（含系统、机型与版本） |
| `X-App-Id` | `com.coolapk.market` | 应用唯一包名标识 |
| `X-App-Token` | `v3.<token_str>` 或 `v2.<token_str>` | 核心签名令牌（包含时间戳与设备指纹加密） |
| `X-App-Version` | `14.5.2` | 客户端展示版本号 |
| `X-App-Code` | `2412151` | 客户端编译 VersionCode |
| `X-Api-Version` | `16` | 当前 API 协议版本（主流为 16） |
| `X-App-Device` | `01234567-89ab-cdef-0123-456789abcdef` | 设备唯一指纹 / UUID / Android ID Base64 |
| `X-Dark-Mode` | `0` | 是否深色模式 (0: 浅色, 1: 深色) |
| `X-App-Mode` | `universal` | 应用运行模式 |
| `X-App-Channel` | `coolapk` | 发布渠道 |
| `X-Sdk-Int` | `34` | Android SDK API 级别 |
| `X-Sdk-Locale` | `zh-CN` | 语言与区域设置 |
| `X-Requested-With` | `XMLHttpRequest` | Ajax 请求标记 |
| `Cookie` | `uid=123456; username=xxx; token=xxx;` | 登录用户的鉴权 Cookie（只读公共接口可不传） |

---

### 1.3 X-App-Token 算法解析

在 `com.coolapk.market.util.AuthUtils` 中定义了 Native JNI 接口：
```java
public final class AuthUtils {
    static {
        System.loadLibrary("auth");
    }
    public final native String getToken(Context context, String deviceId);
}
```

其经典实现逻辑为：
1. 获取当前 UTC 时间戳 $T$（秒级）；
2. 组合原始字符串：`token://com.coolapk.market/c67ef59437ac3d09b1bb...`（Salt）、时间戳 $T$、设备 ID 与 MD5 摘要；
3. 计算 MD5 摘要，格式化生成 `v3` / `v2` 格式的 Token 字符串作为 `X-App-Token`。

---

### 1.4 标准响应结构

API 统一返回 JSON 格式：
```json
{
  "data": [ ... ] 或 { ... },
  "message": "",
  "status": 0
}
```
* `data`：实际业务数据（数组或对象）
* `message`：提示信息或错误原因
* `status`：状态码，`0` 表示成功；非 `0` 表示业务错误。

---

## 二、首页与通用卡片流 (Main & Page API)

酷安客户端大量使用基于 Card / Feed / Entity 的通用数据流，核心接口如下：

### 2.1 客户端初始化配置
* **接口路径**：`GET /v6/main/init`
* **功能说明**：获取客户端启动初始化配置、全局开关、升级提示、敏感词版本号及广告策略。
* **请求参数**：
  * `appVersionCode` (int, 可选): 当前版本号
  * `installTime` (long, 可选): 安装时间戳
* **返回值**：全局配置字典（含升级信息、接口域名列表等）。

---

### 2.2 首页推荐与热门流
* **接口路径**：`GET /v6/main/indexV8`
* **功能说明**：获取首页头条、热点卡片、置顶内容与信息流。
* **请求参数**：
  * `page` (int, 必填): 页码，默认 `1`
  * `firstItem` (string, 可选): 当前流中第一项的 ID（用于分页游标比对）
  * `lastItem` (string, 可选): 当前流中最后一项的 ID

---

### 2.3 首页头条热点流
* **接口路径**：`GET /v6/main/headline`
* **功能说明**：首页头条资讯流。
* **请求参数**：
  * `page` (int, 必填): 页码

---

### 2.4 通用卡片页面数据流 (DataList)
* **接口路径**：`GET /v6/page/dataList`
* **功能说明**：全站通用卡片数据流驱动接口。酷安客户端大部分频道、榜单均通过此接口配合 `url` 参数路由获取。
* **核心请求参数**：
  * `url` (string, 必填): 目标卡片路由标识符，支持以下常用路由：
    * `#/feed/hotList`：全站 24 小时热门动态榜
    * `#/feed/newestList`：全站最新动态流
    * `#/feed/digestList?type=1`：全站精选帖榜单
    * `#/feed/coolPictureRankList`：酷图热榜
    * `#/feed/editorChoiceList`：编辑精选帖
    * `#/feed/myQaFeedList`：我的问答动态流
    * `/page?url={channel_tag}`：指定板块/频道（如 `V11_FIND_GOOD_GOODS_HOME` 二手好物）
  * `title` (string, 可选): 页面标题
  * `page` (int, 必填): 页码，从 `1` 开始
  * `lastItem` (string, 可选): 上一页末尾实体 ID

---

## 三、动态与帖子模块 (Feed API)

### 3.1 获取动态详情
* **接口路径**：`GET /v6/feed/detail`
* **功能说明**：获取指定动态/图文/长文的完整正文、点赞数、评论数、转发数、发布者信息、关联标签、商品卡片、投票卡片等。
* **请求参数**：
  * `id` (int/string, 必填): 动态 ID (`feed_id`)

---

### 3.2 发布新动态 (发帖)
* **接口路径**：`POST /v6/feed/createFeed`
* **功能说明**：发布新动态、图文、长文或转发。
* **Content-Type**：`application/x-www-form-urlencoded` 或 `multipart/form-data`
* **请求 Body 参数**：
  * `message` (string, 必填): 动态正文内容
  * `type` (string, 可选): 动态类型，`feed`（默认动态）、`picture`（酷图）、`article`（头条长文）、`ershou`（二手好物）
  * `pic` (string, 可选): 附带图片 URL，多张用逗号 `,` 分隔
  * `extra_title` (string, 可选): 头条文章/长文标题
  * `location` (string, 可选): 地理位置名称
  * `product_id` (string, 可选): 关联数码产品 ID
  * `tag` (string, 可选): 关联话题标签名称
  * `vote_id` (string, 可选): 关联投票 ID

---

### 3.3 动态点赞 / 取消点赞
* **点赞**：`POST /v6/feed/like?id={feed_id}`
* **取消点赞**：`POST /v6/feed/unlike?id={feed_id}`
* **参数**：`id` (string, 必填): 动态 ID

---

### 3.4 动态收藏 / 取消收藏
* **收藏**：`POST /v6/feed/favorite?id={feed_id}`
* **取消收藏**：`POST /v6/feed/unfavorite?id={feed_id}`

---

### 3.5 转发动态
* **接口路径**：`POST /v6/feed/forward`
* **请求参数**：
  * `id` (string, 必填): 被转发的动态 ID
  * `message` (string, 可选): 转发附带评语

---

### 3.6 删除动态
* **接口路径**：`POST /v6/feed/deleteFeed`
* **请求参数**：
  * `id` (string, 必填): 待删除的动态 ID

---

### 3.7 相关动态推荐
* **接口路径**：`GET /v6/feed/relatedRecommendList`
* **请求参数**：
  * `id` (string, 必填): 当前动态 ID

---

## 四、评论与回复模块 (Reply & Comment API)

### 4.1 获取动态评论列表
* **接口路径**：`GET /v6/feed/replyList`
* **功能说明**：获取指定动态下方的评论/回复列表。
* **APK 对应方法**：`kb1.java` -> `m51919` / `m52086` (`@GET("feed/replyList")`)
* **请求参数**：
  * `id` (string, 必填): 动态 ID
  * `listType` (string, 可选): 排序方式
    * `dateline_desc`：按发表时间最早/时间倒序
    * `lastupdate_desc`：按最后更新时间排序
    * `discussion`：讨论模式
    * `replyRows_desc`：按热门/回复数排序
  * `page` (int, 必填): 页码，从 `1` 开始
  * `discussMode` (int, 可选): 讨论模式，默认 `1`
  * `feedType` (string, 可选): 固定为 `feed`
  * `blockStatus` (int, 可选): 屏蔽状态，默认 `0`
  * `fromFeedAuthor` (int, 可选): `1` 为只看楼主，`0` 为全部评论
  * `firstItem` (string, 可选): 列表首页首项 ID
  * `lastItem` (string, 可选): 列表尾项 ID（游标）

---

### 4.2 获取楼中楼子回复列表
* **接口路径**：`GET /v6/feed/replyList`
* **功能说明**：获取指定楼层评论的所有二级楼中楼回复。
* **APK 对应方法**：`kb1.java` -> `m51787` (`@GET("feed/replyList")`)
* **请求参数**：
  * `id` (string, 必填): 动态 ID
  * `rid` (string, 必填): 目标楼层评论 ID
  * `page` (int, 必填): 页码，从 `1` 开始

---

### 4.3 获取单条评论元数据详情
* **接口路径**：`GET /v6/feed/replyDetail`
* **功能说明**：获取单条评论的完整详细数据（如发布设备型号、ROM、IP 属地、精准楼层等）。
* **APK 对应方法**：`kb1.java` -> `m51911` (`@GET("feed/replyDetail")`)
* **请求参数**：
  * `id` (string, 必填): 评论 ID

---

### 4.4 获取爆评 / 热门评论
* **接口路径**：`GET /v6/feed/hotReplyList`
* **请求参数**：
  * `id` (string, 必填): 动态 ID
  * `page` (int, 必填): 页码
  * `discussMode` (int, 可选): 讨论模式，默认 `1`

---

### 4.5 发表动态评论 / 楼中楼回复
* **接口路径**：`/v6/feed/reply`（APK 为 `POST`，客户端部分网关可使用带有 Query 的 `GET`）
* **APK 对应方法**：`kb1.java` -> `m51858` / `au1.java` -> `m14941` (`@POST("feed/reply")`)
* **请求参数**：
  * `id` (string, 必填): 目标动态 ID（或目标实体 ID）
  * `type` (string, 必填): 固定为 `feed`（或实体类型）
  * `message` (string, 必填): 评论正文（支持酷安原生表情标签 `[doge]`、`[滑稽]` 等）
  * `rid` / `rpid` (string, 可选): 楼中楼回复时被回复的楼层/评论 ID
  * `pic` (string, 可选): 评论附带图片 URL（多张使用英文逗号 `,` 分隔，上传目录为 `feed`）
  * `replyAndForward` (string, 可选): `"1"` 表示发表评论的同时转发该动态

---

### 4.6 评论点赞 / 取消点赞
* **点赞评论**：`POST /v6/feed/likeReply?id={reply_id}`（APK `kb1.java` -> `m52123`）
* **取消点赞**：`POST /v6/feed/unLikeReply?id={reply_id}`（APK `kb1.java` -> `m51886`）
* **参数**：
  * `id` (string, 必填): 评论 ID

---

### 4.7 删除评论 / 回复
* **接口路径**：`POST /v6/feed/deleteReply?id={reply_id}`
* **APK 对应方法**：`kb1.java` -> `m51964` (`@POST("feed/deleteReply")`)
* **请求参数**：
  * `id` (string, 必填): 待删除的评论 ID
  * `notNotify` (int, 可选): 是否不通知
  * `blackType` (string, 可选): 拉黑类型

---

### 4.8 评论通知与用户历史评论
* **我收到的回复与评论通知**：`GET /v6/user/replyToMeList`（APK `kb1.java:1245`）
* **用户发表的评论列表**：`GET /v6/user/replyList?uid={uid}&page={page}`（APK `kb1.java:1545`）

---

## 五、用户与社交关系模块 (User API)

### 5.1 用户个人空间总览
* **接口路径**：`GET /v6/user/space`
* **功能说明**：获取用户主页头部信息、背景图、勋章、认证标识、动态数、关注数、粉丝数等统计数据。
* **请求参数**：
  * `uid` (string/int, 必填): 目标用户 UID（或 `username`）

---

### 5.2 用户基本公开资料
* **接口路径**：`GET /v6/user/profile`
* **请求参数**：
  * `uid` (string/int, 必填): 目标用户 UID

---

### 5.3 用户历史动态列表
* **接口路径**：`GET /v6/user/feedList`
* **请求参数**：
  * `uid` (string/int, 必填): 用户 UID
  * `page` (int, 必填): 页码
  * `isIncludeTop` (int, 可选): 是否包含置顶动态，默认 `1`

---

### 5.4 用户酷图作品列表
* **接口路径**：`GET /v6/user/pictureList`
* **请求参数**：
  * `uid` (string/int, 必填): 用户 UID
  * `page` (int, 必填): 页码

---

### 5.5 用户发表的评论/回复记录
* **接口路径**：`GET /v6/user/replyList`
* **请求参数**：
  * `uid` (string/int, 必填): 用户 UID
  * `page` (int, 必填): 页码

---

### 5.6 关注 / 取消关注用户
* **关注**：`POST /v6/user/follow?uid={uid}`
* **取消关注**：`POST /v6/user/unfollow?uid={uid}`
* **参数**：`uid` (string, 必填): 目标用户 UID

---

### 5.7 关注列表与粉丝列表
* **我的关注列表**：`GET /v6/user/myFollowList?page={page}`
* **我的粉丝列表**：`GET /v6/user/myFansList?page={page}`
* **指定用户的关注列表**：`GET /v6/user/userFollowList?uid={uid}&page={page}`
* **关注的看点/订阅号**：`GET /v6/user/dyhFollowList`

---

### 5.8 拉黑 / 解除拉黑用户
* **拉黑**：`POST /v6/user/block?uid={uid}`
* **解除拉黑**：`POST /v6/user/unblock?uid={uid}`

### 5.9 用户空间 V9 页面与服务端卡片

APK 用户页由 `UserSpaceV9Activity` 加载 `/v6/user/space`，其中 `homeTabCardRows` 是服务端下发的主页卡片，不能由客户端自行拼接替代。列表 Tab 由 `UserSpaceV9TabHelper` 选择接口：

| 页面功能 | 接口 | 说明 |
| - | - | - |
| 主页 | `GET /v6/user/space` | 资料头部、统计数据、`homeTabCardRows`、默认 Tab |
| 动态 | `GET /v6/user/feedList` | 支持 `uid/page/firstItem/lastItem/isIncludeTop` |
| 回复 | `GET /v6/user/replyList` | 用户回复记录 |
| 文章 | `GET /v6/user/htmlFeedList` | 用户文章 |
| 问答 | `GET /v6/user/questionAndAnswerList` | 用户问答 |
| 图集 | `GET /v6/user/albumList` | 用户图集 |
| 收藏 | `GET /v6/collection/list` | 用户收藏单 |
| 好物榜 | `GET /v6/goodsList/list` | 用户好物清单排行 |
| 好物店铺 | `GET /v6/goods/goodsStoreItemList` | 用户店铺商品 |
| 开发者应用 | `GET /v6/apk/developerAppList` | 用户开发的应用 |
| 关注的应用 | `GET /v6/user/apkFollowList` | 用户关注的应用 |
| 发现 | `GET /v6/user/discoveryList` | 用户发现内容 |
| 酷图/评分/好物/二手/回收站 | `GET /v6/page/dataList` | 仅允许用户页固定 URL：`userCoolPictureFeedList`、`nodeRatingList`、`goodsFeedList`、`userErshouList`、`userDeleteFeedList` |

这些列表统一返回 `Entity`，实际展示由 `entityType` / `entityTemplate` 决定。桌面端优先使用动态、评分、图片、应用、商品、收藏等常见卡片模板；未知类型保留完整原始 JSON 并显示标题、图片、描述、类型和跳转入口。

用户页关系接口包括 `follow`、`unfollow`、`specialFollowUser`、`cancelFollower`、`addToBlackList`、`removeFromBlackList` 和 `updateRemark`。其中 APK Retrofit 明确标记 `specialFollowUser`、`cancelFollower` 为 `POST` + query，`updateRemark` 为 `POST` + form；桌面端已按该方法实现。源码确认不等于服务器实时接受结果，仍需通过登录态运行测试确认。

---

## 六、话题与标签模块 (Topic & Tag API)

### 6.1 话题概览与热度信息
* **接口路径**：`GET /v6/topic/newTagDetail`
* **功能说明**：获取话题 Banner、简介、关注数、讨论数、热度趋势。
* **请求参数**：
  * `tag` (string, 必填): 话题名称（如 `MIUI`、`开源项目` 等）

---

### 6.2 话题动态流
* **接口路径**：`GET /v6/topic/tagFeedList`
* **功能说明**：获取话题下的动态列表。
* **请求参数**：
  * `tag` (string, 必填): 话题名称
  * `page` (int, 必填): 页码
  * `listType` (string, 可选): `lastupdate_desc`（最新发布）、`dateline_desc`（最新回复）、`hot`（热门）

---

### 6.3 快捷话题与常用标签
* **接口路径**：`GET /v6/topic/quickList`
* **功能说明**：发布动态时候选推荐的热门标签。

---

### 6.4 我关注的话题列表
* **接口路径**：`GET /v6/topic/myFollowTopicList`
* **请求参数**：
  * `page` (int, 必填): 页码

---

### 6.5 关注 / 取消关注话题
* **关注**：`POST /v6/topic/followTag?tag={tag}`
* **取消关注**：`POST /v6/topic/unfollowTag?tag={tag}`

---

## 七、应用与游戏市场模块 (Apk & Game API)

### 7.1 应用详细信息
* **接口路径**：`GET /v6/apk/detail`
* **功能说明**：获取应用详情（包名、版本、图标、大小、评分、下载链接、更新日志、权限列表、截图等）。
* **请求参数**：
  * `id` (string, 必填): 应用包名（如 `com.coolapk.market`）或数字 ID

---

### 7.2 应用排行榜单
* **接口路径**：`GET /v6/apk/rankList`
* **请求参数**：
  * `type` (string, 必填): 排行榜类型，`download`（下载榜）、`rating`（评分榜）、`hot`（热度榜）
  * `page` (int, 必填): 页码

---

### 7.3 应用分类列表
* **接口路径**：`GET /v6/apk/categoryList`
* **功能说明**：获取系统工具、影音视听、社交通讯等全量分类及分类下热门推荐。

---

### 7.4 最新上架与精选应用
* **最新上架**：`GET /v6/apk/newestList?page={page}`
* **热门推荐**：`GET /v6/apk/hotList?page={page}`
* **精选应用**：`GET /v6/apk/digestList?page={page}`
* **小编推荐**：`GET /v6/apk/recommendList?page={page}`

---

### 7.5 游戏中心与礼包
* **游戏主列表**：`GET /v6/apk/gameList?page={page}`
* **热门游戏榜**：`GET /v6/apk/hotGameList?page={page}`
* **游戏礼包中心**：`GET /v6/apk/giftList?page={page}`

---

### 7.6 应用批量更新检查
* **接口路径**：`POST /v6/apk/updateList`
* **功能说明**：将客户端本地已安装的所有 APK 包名与版本号上报，由服务端比对返回最新可更新的应用列表与增量补丁包。
* **请求 Body 参数**：
  * `pkgs` (string, 必填): 本地包名与版本信息 JSON 字符串

---

## 八、搜索与推荐模块 (Search & Discovery API)

### 8.1 全局综合搜索
* **接口路径**：`GET /v6/search`
* **功能说明**：支持动态、酷友、话题、应用等全站多维度搜索。
* **请求参数**：
  * `type` (string, 必填): 搜索类型
    * `all`：综合搜索（聚合各类结果）
    * `feed`：帖子动态搜索
    * `user`：酷友/用户搜索
    * `apk`：应用/游戏搜索
    * `topic`：话题/标签搜索
  * `searchValue` (string, 必填): 搜索关键词
  * `page` (int, 必填): 页码
  * `sortType` (string, 可选): 排序规则，`default`（默认相关度）、`dateline`（按时间倒序）
  * `show_flag` (int, 可选): 扩展展示标记，默认 `1`

---

### 8.2 搜索热词联想与补全
* **接口路径**：`GET /v6/search/suggest`
* **请求参数**：
  * `key` (string, 必填): 输入的前缀关键词

---

### 8.3 实时热搜榜单
* **接口路径**：`GET /v6/search/hotSearch`
* **功能说明**：获取当前全站热搜关键词及热度指数。

---

## 九、私信与通知模块 (Message & Notification API)

### 9.1 未读消息与通知计数
* **接口路径**：`GET /v6/notification/checkCount`
* **功能说明**：实时轮询未读私信数、@数、评论数、点赞数与系统通知数。

---

### 9.2 分类通知列表
* **@我的通知**：`GET /v6/notification/atMeList?page={page}`
* **收到的评论**：`GET /v6/notification/commentMeList?page={page}`
* **回复与@综合提醒**：`GET /v6/notification/atCommentMeList?page={page}`
* **收到的点赞**：`GET /v6/notification/feedLikeList?page={page}`
* **系统通知**：`GET /v6/notification/list?page={page}`

---

### 9.3 私信会话列表
* **接口路径**：`GET /v6/message/list`
* **功能说明**：获取当前用户的全部私信对话列表与最近一条消息。
* **请求参数**：
  * `page` (int, 必填): 页码

---

### 9.4 单聊私信聊天记录
* **接口路径**：`GET /v6/message/chat`
* **请求参数**：
  * `ukey` (string, 必填): 目标聊天会话唯一标识（或对方 `uid`）
  * `page` (int, 必填): 页码

---

### 9.5 发送私信
* **接口路径**：`POST /v6/message/send`
* **请求参数**：
  * `uid` (string, 必填, Query/Body): 接收方用户 UID
  * `message` (string, 必填, Body): 私信文本内容
  * `pic` (string, 可选, Body): 图片链接

---

### 9.6 删除私信会话
* **接口路径**：`POST /v6/message/delChatSession`
* **请求参数**：
  * `ukey` (string, 必填): 待删除的会话标识

---

## 十、数码产品与评分模块 (Product & Rating API)

### 10.1 数码产品分类与品牌
* **数码品类列表**：`GET /v6/product/categoryList`
* **数码品牌列表**：`GET /v6/product/brandList`

---

### 10.2 数码产品关联动态与评测
* **接口路径**：`GET /v6/product/feedList`
* **请求参数**：
  * `id` (string, 必填): 产品 ID
  * `page` (int, 必填): 页码

---

### 10.3 机主专属动态流
* **接口路径**：`GET /v6/product/productOwnerFeedList`
* **请求参数**：
  * `id` (string, 必填): 产品 ID
  * `page` (int, 必填): 页码

---

### 10.4 数码评分广场
* **接口路径**：`GET /v6/rating/square`
* **功能说明**：获取数码产品评分榜单、好评率排行与机主点评。

---

## 十一、收藏与历史记录模块 (Collection & History API)

### 11.1 我的收藏夹列表
* **接口路径**：`GET /v6/collection/myCollectionList`
* **请求参数**：
  * `page` (int, 必填): 页码

---

### 11.2 创建收藏夹
* **接口路径**：`POST /v6/collection/create`
* **请求 Body 参数**：
  * `title` (string, 必填): 收藏夹标题
  * `description` (string, 可选): 收藏夹描述
  * `is_open` (int, 可选): 是否公开 (1: 公开, 0: 私密)

---

### 11.3 浏览历史记录
* **接口路径**：`GET /v6/member/recentHistoryList`
* **请求参数**：
  * `page` (int, 必填): 页码

---

## 十二、账号与登录认证模块 (Account & Auth API)

### 12.1 校验登录状态与刷新 Session
* **接口路径**：`GET /v6/account/checkLoginInfo`
* **功能说明**：验证客户端本地保存的登录 Token 是否有效，并更新当前会话 ID。

---

### 12.2 第三方开放平台登录
* **微信登录**：`GET https://account.coolapk.com/auth/loginByOpenId?type=weixin`
* **QQ 登录**：`GET https://account.coolapk.com/auth/loginByOpenId?type=qq`
* **微博登录**：`GET https://account.coolapk.com/auth/loginByOpenId?type=weibo`
* **抖音登录**：`GET https://account.coolapk.com/auth/loginByOpenId?type=douyin`

---

### 12.3 账号绑定
* **绑定手机号**：`GET/POST https://account.coolapk.com/account/bind?type=mobile`
* **绑定邮箱**：`GET/POST https://account.coolapk.com/account/bind?type=email`

---

### 12.4 退出登录
* **接口路径**：`GET https://account.coolapk.com/auth/logout`

---

## 十三、二手好物与交易模块 (Ershou & Goods API)

### 13.1 二手产品分类与品牌
* **接口路径**：`GET /v6/ershou/ershouProductBrandList`

---

### 13.2 优惠券与好物搜索
* **接口路径**：`GET /v6/goods/couponSearch`
* **请求参数**：
  * `key` (string, 必填): 搜索商品名称

---

## 附录：Python SDK 快速调用示例

```python
from coolapk_sdk.auth import CoolapkAuth
from coolapk_sdk.client import CoolapkClient

# 初始化 Auth 与客户端
auth = CoolapkAuth()
client = CoolapkClient(auth=auth)

# 1. 获取首页推荐流
index_feeds = client.get_index_v8_feeds(page=1)
print(f"获取到 {len(index_feeds)} 条首页动态")

# 2. 搜索动态
search_results = client.search_feeds(query="小米15", page=1)
for feed in search_results[:5]:
    print(f"[{feed.get('username')}] {feed.get('message')[:30]}...")

# 3. 获取动态详情与评论
feed_detail = client.get_feed_detail(feed_id="12345678")
replies = client.get_feed_replies(feed_id="12345678", page=1)
```
