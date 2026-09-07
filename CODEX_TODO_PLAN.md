# Coolapk Desktop 功能增强 Todo Plan

> 用途：本文件可直接交给 Codex 作为后续开发任务清单。
>
> 依据：当前桌面端源码、Tauri/Rust 实现、README、package 配置，以及 `D:\\code\\github\\coolapk_all_decompiled` 中的 APK 反编译代码和接口扫描文档。
>
> 当前基线：桌面端版本 `1.16.0`。本计划只描述开发任务；生成本文件时未修改业务代码、未构建、未运行测试。

## 0. 给 Codex 的执行规则

- 先阅读仓库内 `AGENTS.md`，再阅读本文件和相关现有代码。
- 开始每个任务前执行只读检查：`git status --short --branch`，确认并保留已有改动。
- 不要覆盖、删除或重置用户已有文件；特别是当前已有的 `CHANGELOG.md` 未跟踪文件。
- 每个任务只改任务范围内的文件，避免顺手重构无关模块。
- APK 反编译代码只能作为功能和接口线索，不能直接假设接口参数、权限和返回结构一定正确。接入前必须在现有 Rust 客户端的请求模式中核对。
- 不要把“存在 API 封装”当成“功能已完成”；必须有页面入口、加载态、空态、错误态、成功反馈和回归测试。
- 所有用户可见文本使用中文；代码保持现有项目风格。
- 新增 Tauri 命令时同步修改 Rust 命令注册、前端 API 封装、类型定义和测试。
- 不要在前端重复实现已有的 Rust 数据处理、图片代理和文件保存逻辑。
- 涉及登录、Cookie、Token、设备指纹和用户隐私的功能，失败时不得静默降级为错误账号或游客状态。
- 当前计划文档生成阶段不构建；实际开发任务完成后再按任务验收标准运行验证。

## 1. 当前能力基线

### 1.1 已经存在，不要重复实现

- 路由和页面：`src/router/index.ts`、`src/pages/`。
- 首页频道、页面实体和产品卡片：`src/pages/HomePage.vue`、`src/components/discovery/`。
- 动态详情、评论、楼中楼和基础操作：`src/pages/FeedDetailPage.vue`、`src/components/feed/`。
- 搜索分类、搜索历史、搜索建议：`src/pages/SearchPage.vue`、`src/types/search.ts`、`src/utils/searchHistory.ts`。
- 应用详情、版本、评论、礼包、相关应用、二维码和更新检查：`src/pages/AppDetailPage.vue`。
- 收藏、收藏夹和浏览历史：`src/pages/FavoritesPage.vue`、`src/pages/HistoryPage.vue`。
- 用户主页、关注、粉丝和黑名单：`src/pages/UserPage.vue`、`src/api/coolapk.ts`。
- 私信文本、图片、表情和草稿：`src/pages/MessagesPage.vue`。
- 通知分类和基础桌面通知：`src/pages/NotificationsPage.vue`、`src/components/layout/TopBar.vue`、`src/utils/desktopNotify.ts`。
- 图片查看、缩放、旋转、原图保存和 Live Photo：`src/components/overlays/ImageViewer.vue`、`src/components/common/AppImage.vue`。
- 设置、主题、导航、缓存、代理、启动、托盘和窗口置顶：`src/stores/settings.ts`、`src/pages/settings/`、`src-tauri/capabilities/main.json`。

### 1.2 明确的当前缺口

- 下载设置中的并发数仍是预留项，见 `src/pages/settings/DownloadSettingsPage.vue:18-27`。
- 应用下载目前是获得 URL 后交给系统，见 `src/pages/AppDetailPage.vue:1021-1040`。
- “隐藏回复”和“我的投票”仍由 `src/pages/MoreDataPage.vue:67-74` 展示占位说明。
- 多个接口已有封装，但未发现对应的非测试页面调用：问答答案、投票评论、转发列表、点赞用户、评分用户、热门回复，重点检查 `src/api/coolapk.ts:508,847-894`。
- 私信会话当前主要做本地排序，需补 APK 的服务端置顶接口 `/message/addTop` 和 `/message/removeTop`。
- 直播页面目前偏详情和播放，需补评论、标签动态、图片互动和可用的管理操作。
- 用户举报仍会打开移动网页，见 `src/pages/UserPage.vue:1262-1266`。
- APK 有动态长图/分享图片能力，桌面端当前只有转发对话框，没有对应长图工作流。

## 2. 总体版本拆分

### Release A：快速收益，建议首先完成

1. `A-01` 动态/文章长图和分享卡片。
2. `A-02` 私信服务端置顶。
3. `A-03` 补齐已有 API 的列表弹窗和详情入口。

目标：优先利用已有数据接口，改善用户立即可感知的桌面体验。

### Release B：核心能力

4. `B-01` APK 下载队列和本地文件管理。
5. `B-02` 问答详情和回答列表。
6. `B-03` 私信动态卡片、应用卡片和长消息。

目标：补齐 APK 中最明显的桌面端功能断层。

### Release C：内容互动

7. `C-01` 直播互动。
8. `C-02` 二手和应用高级搜索筛选。
9. `C-03` 原生内容治理、屏蔽和举报。

目标：从“浏览器式客户端”扩展为完整社区客户端。

### Release D：桌面增强

10. `D-01` 托盘后台通知。
11. `D-02` 图片批量保存、幻灯片和长图导出增强。
12. `D-03` 自定义主题、纯黑模式和主题预设。

目标：形成桌面端区别于 APK 的效率优势。

## 3. 详细任务清单

## A-01 动态/文章长图和分享卡片

### 背景证据

- APK 存在 `D:\\code\\github\\coolapk_all_decompiled\\java_sources\\sources\\com\\coolapk\\market\\view\\feed\\FeedToImageActivity.java`。
- APK 存在 `D:\\code\\github\\coolapk_all_decompiled\\java_sources\\sources\\com\\coolapk\\market\\view\\webview\\share\\LongImageUtils.java`。
- 桌面端目前的动态操作集中在 `src/components/feed/FeedActionBar.vue:13-125`，未发现 `FeedToImage`、`LongImageUtils` 对应实现。

### 实现任务

- [ ] 新增 `src/components/feed/FeedToImageDialog.vue`，提供预览、宽度/缩放、是否包含作者信息、是否包含评论摘要等选项。
- [ ] 新增 `src/utils/feedToImage.ts`，将动态内容、图片、视频封面和必要元数据组合成可截图 DOM。
- [ ] 在 `src/components/feed/FeedActionBar.vue` 增加“生成长图”入口。
- [ ] 复用 `src/components/common/AppImage.vue` 的原始 URL 和图片加载链路，等待全部图片加载完成后再生成。
- [ ] 新增保存路径选择、文件命名、覆盖提示和保存成功通知。
- [ ] 评估使用浏览器截图能力还是新增轻量 DOM 转图片依赖；不要在没有验证的情况下引入大体积依赖。
- [ ] 若系统分享能力不稳定，第一版先交付“生成并保存 PNG/JPG”，分享作为第二阶段。

### 验收标准

- [ ] 普通文字动态、单图、多图、带评论动态均能生成图片。
- [ ] 图片加载失败时显示具体失败项，不生成半截图片。
- [ ] 长图过长时不会阻塞界面，显示进度或明确的处理中状态。
- [ ] 保存结果使用用户选择的路径，不能把 `data:image` 错当成远程 URL 请求后端。
- [ ] 动态内容不被截断；暗色主题下生成结果仍可读。
- [ ] 增加长图工具函数和关键状态的 Vitest 测试。

### 成本和风险

- 成本：中高，约 3-7 个工作日。
- 风险：超长动态、远程图片加载、字体渲染、视频封面和 WebView 截图兼容性。

## A-02 私信服务端置顶

### 背景证据

- 桌面端私信页面：`src/pages/MessagesPage.vue`。
- 当前会话排序和发送后的本地置顶逻辑重点位于 `src/pages/MessagesPage.vue:1452`。
- APK 接口文档存在 `/message/addTop` 和 `/message/removeTop`，见 `D:\\code\\github\\coolapk_all_decompiled\\docs\\coolapk-api-from-decompiled.md:95,128`。

### 实现任务

- [ ] 在 `src/api/coolapk.ts` 增加 `addMessageTop`、`removeMessageTop` 封装。
- [ ] 在 `src-tauri/src/coolapk/client.rs` 增加对应请求方法，并沿用现有 Cookie/Token 和错误处理方式。
- [ ] 在 `src-tauri/src/coolapk/commands.rs` 增加 Tauri 命令。
- [ ] 在 `src-tauri/src/lib.rs` 注册新命令。
- [ ] 在 `src/pages/MessagesPage.vue` 的会话菜单增加“置顶/取消置顶”。
- [ ] 区分服务端置顶状态和临时本地排序，接口失败时恢复原状态。

### 验收标准

- [ ] 重启应用、刷新会话列表后置顶状态仍然存在。
- [ ] 置顶和取消置顶均有加载态、成功提示和失败恢复。
- [ ] 离线或游客状态不会错误显示服务端置顶成功。
- [ ] 至少覆盖 API 参数转换、成功和失败状态测试。

### 成本和风险

- 成本：低中，约 1-3 个工作日。
- 风险：接口可能只允许登录账号；需要确认会话 ID 参数名称。

## A-03 补齐已有 API 的列表和详情闭环

### 背景证据

重点接口位于 `src/api/coolapk.ts`，但本次静态搜索未发现完整页面入口：

- `getHotReplies`：热门回复。
- `getQuestionAnswers`：问答回答列表。
- `getVoteComments`：投票评论。
- `getFeedForwardList`：转发列表。
- `getFeedLikeList`：点赞用户列表。
- `getApkRatingUserList`：应用评分用户列表。

### 实现任务

- [ ] 新增通用 `src/components/common/EntityListDialog.vue`，统一处理分页、空态、错误态和关闭。
- [ ] 在 `src/components/feed/FeedActionBar.vue` 或动态详情区域增加点赞用户、转发列表入口。
- [ ] 在 `src/components/feed/FeedCommentSection.vue` 增加热门回复入口或热门排序。
- [ ] 在 `src/pages/AppDetailPage.vue` 增加评分用户列表入口。
- [ ] 对问答和投票先复用已有搜索结果或动态详情入口，避免创建重复数据模型。
- [ ] 对每个接口先确认 Rust 端命令已经存在；若只有 TypeScript 封装，补齐 Rust client、command 和注册。

### 验收标准

- [ ] 每个入口都能定位到明确的动态、应用或问题 ID。
- [ ] 分页不会重复、跳页或覆盖旧结果。
- [ ] 空列表和权限错误有清晰中文提示。
- [ ] 不把当前用户 ID、动态 ID 和评论 ID 混用。

### 成本和风险

- 成本：中，约 2-5 个工作日。
- 风险：部分 APK 接口可能是内部权限接口，需允许单项功能不可用而不影响详情页。

## B-01 APK 下载队列和本地文件管理

### 背景证据

- 桌面端下载设置明确写着当前下载任务未启用：`src/pages/settings/DownloadSettingsPage.vue:18-27`。
- 应用详情当前只取得下载地址：`src/pages/AppDetailPage.vue:1021-1040`、`src/api/coolapk.ts:1024-1034`。
- APK 使用 WorkManager 下载：
  - `D:\\code\\github\\coolapk_all_decompiled\\java_sources\\sources\\com\\coolapk\\market\\service\\work\\DownloadWorker.java`
  - `D:\\code\\github\\coolapk_all_decompiled\\java_sources\\sources\\com\\coolapk\\market\\view\\appmanager\\DownloadManagerFragment.java`

### 第一阶段范围

只实现“下载并保存 APK”，不实现 Windows 直接安装。后续可增加“打开所在目录”和“传输到手机”。

### 实现任务

- [ ] 新增 Rust 模块 `src-tauri/src/downloads/`，定义下载任务、状态、进度、速度、错误和文件路径。
- [ ] 新增持久化任务清单，优先使用现有 Tauri Store 能力；确认应用退出后任务状态可恢复。
- [ ] 新增 Tauri 命令：`create_download`、`pause_download`、`resume_download`、`cancel_download`、`retry_download`、`remove_download`、`list_downloads`、`open_download_folder`。
- [ ] 使用现有 `reqwest` 能力实现 HTTP Range 断点续传；服务端不支持 Range 时明确降级为重新下载。
- [ ] 校验响应状态、Content-Length、文件扩展名和可选 SHA-256；禁止把错误 HTML 保存成 APK。
- [ ] 控制并发数，接入 `settings.maxConcurrentDownloads`；移除当前设置页面的 disabled 状态。
- [ ] 新增 `src/stores/downloads.ts`、`src/pages/DownloadsPage.vue` 和 `src/components/downloads/DownloadTaskRow.vue`。
- [ ] 从 `AppDetailPage.vue` 下载按钮进入任务队列，而不是直接打开系统浏览器。
- [ ] 增加磁盘空间不足、文件冲突、网络中断、代理失败和权限不足的处理。
- [ ] 下载完成后沿用 `notifyDownloadComplete` 设置发送通知。

### 验收标准

- [ ] 多任务按并发设置执行，任务状态至少包括等待、下载中、暂停、完成、失败、取消。
- [ ] 关闭并重启应用后，已完成文件和失败任务状态可恢复。
- [ ] 暂停后继续不会从头下载，服务器不支持 Range 时显示原因。
- [ ] 同名文件不会静默覆盖。
- [ ] 下载的文件大小和校验结果异常时不会显示为成功。
- [ ] 前端列表不会因为单个任务错误而整体崩溃。
- [ ] Rust 单元测试覆盖状态迁移、路径命名和 Range 响应处理。

### 成本和风险

- 成本：高，约 1-2 周。
- 风险：断点续传兼容性、权限、杀毒软件拦截、长时间任务的 Tauri 生命周期和登录失效。

## B-02 问答详情和回答列表

### 背景证据

- APK 接口文档存在：`/question/answerList`、`/question/follow`、`/question/unFollow`、`/question/inviteAnswer`、`/question/checkAnswerCount`。
- 证据位置：`D:\\code\\github\\coolapk_all_decompiled\\docs\\coolapk-api-from-decompiled.md:86,135,141,188,318,330`。
- 桌面端已有问答搜索分类和 `getQuestionAnswers` 封装，但没有独立问题详情路由。

### 实现任务

- [ ] 先确认 APK 接口的 question ID、分页字段、回答排序字段和登录要求。
- [ ] 在 `src/api/coolapk.ts` 增加问题详情、回答列表、关注/取消关注、回答数封装。
- [ ] 在 `src-tauri/src/coolapk/client.rs`、`commands.rs`、`lib.rs` 补齐 Rust 链路。
- [ ] 新增 `src/pages/QuestionDetailPage.vue`，建议路由为 `/question/:questionId`。
- [ ] 新增 `src/components/question/QuestionHeader.vue`、`AnswerList.vue`、`AnswerCard.vue`。
- [ ] 从 `SearchPage.vue` 的 ask 结果、动态中的问题卡片进入问题详情。
- [ ] 支持回答排序、分页、关注状态、回答数和回答作者主页跳转。
- [ ] 暂不实现 APK 中无法确认的邀请权限和付费能力，先做只读浏览闭环。

### 验收标准

- [ ] 问题标题、描述、标签和回答列表可以独立加载。
- [ ] 未登录状态能浏览公开内容，关注操作给出登录提示。
- [ ] 翻页、重复进入和返回页面不会重复追加回答。
- [ ] 找不到问题、接口权限不足和问题已删除均有独立提示。

### 成本和风险

- 成本：中，约 3-5 个工作日。
- 风险：问答接口可能依赖特定 Feed 类型或登录参数；需避免将问答误当普通动态处理。

## B-03 私信动态卡片、应用卡片和长消息

### 背景证据

- APK：`D:\\code\\github\\coolapk_all_decompiled\\java_sources\\sources\\com\\coolapk\\market\\view\\message\\ChatRepository.java:50-65`。
- APK ViewModel 存在 `sendFeedCardOptimistic`、`loadLongMessageAndAdd` 等逻辑：`ChatViewModel.java:1101-1122,1310-1334`。
- 桌面端当前主要支持文本和图片：`src/pages/MessagesPage.vue:1352-1422`、`src/api/coolapk.ts:632-634,950-952`。

### 实现任务

- [ ] 确认 APK 动态卡片、应用卡片和长消息的 JSON 结构及接口路径。
- [ ] 新增统一消息类型：文本、图片、动态卡片、应用卡片、长消息、未知消息。
- [ ] 新增 `src/components/message/MessageFeedCard.vue`、`MessageAppCard.vue`、`LongMessageBlock.vue`。
- [ ] 消息解析失败时显示“暂不支持的消息类型”，保留原始摘要，不破坏整个会话。
- [ ] 卡片点击进入对应动态或应用详情。
- [ ] 发送失败支持重试，避免乐观插入后产生重复消息。
- [ ] 长消息按需加载，避免打开会话时一次性加载所有正文。

### 验收标准

- [ ] 历史消息和新发送消息使用同一套渲染模型。
- [ ] 卡片中的图片、标题、作者和跳转 ID 缺失时仍有合理空态。
- [ ] 消息重试不会重复发送。
- [ ] 不支持的消息类型不会导致会话渲染异常。

### 成本和风险

- 成本：中，约 3-5 个工作日。
- 风险：APK 消息格式变化较快，需保留版本字段和未知类型兜底。

## C-01 直播互动

### 背景证据

- 桌面端直播路由和页面：`src/router/index.ts:117`、`src/pages/LiveDetailPage.vue`。
- APK 接口：`/live/messageList`、`/live/tagFeedList`、`/live/uploadImage`、`/live/disallowUser`。
- 接口证据：`D:\\code\\github\\coolapk_all_decompiled\\docs\\coolapk-api-from-decompiled.md:148,156,254`。

### 实现任务

- [ ] 先盘点 `LiveDetailPage.vue` 当前已使用的接口，区分播放、预约、关注和互动能力。
- [ ] 新增 `src/components/live/LiveMessageList.vue`，支持分页或增量刷新。
- [ ] 新增 `src/components/live/LiveMessageComposer.vue`，支持文本，图片能力作为第二阶段。
- [ ] 新增直播标签动态区域，复用 Feed 卡片和图片查看器。
- [ ] 对禁言、删除消息等管理操作，只在服务端返回允许时展示。
- [ ] 增加轮询间隔、暂停轮询和窗口不可见时的资源控制。
- [ ] 明确直播结束、直播不存在和无权限状态。

### 验收标准

- [ ] 直播消息不会无限重复追加。
- [ ] 直播结束后停止刷新并保留已加载内容。
- [ ] 发送失败可重试，重复点击不会重复发送。
- [ ] 管理操作有确认提示和失败恢复。

### 成本和风险

- 成本：高，约 1-2 周。
- 风险：接口频率限制、直播状态变化、权限、长时间连接和消息顺序。

## C-02 二手和应用高级搜索筛选

### 背景证据

- 桌面端搜索入口：`src/pages/SearchPage.vue`、`src/types/search.ts`。
- APK 接口文档存在 `search?type=ershou` 和 `search?type=ask`，见 `D:\\code\\github\\coolapk_all_decompiled\\docs\\coolapk-api-from-decompiled.md:113,218`。
- APK 端还存在二手排序、城市、价格、交易状态和标签筛选线索。

### 实现任务

- [ ] 确认当前 Rust 搜索接口是否已经保留排序、城市、价格、状态等参数。
- [ ] 新增 `src/components/search/SearchFilterDrawer.vue`。
- [ ] 在 `src/types/search.ts` 定义按搜索类型区分的筛选模型，不把所有参数塞进一个可选对象。
- [ ] 应用搜索增加开发者、标签、版本和更新时间筛选；复用 `AppsPage.vue` 当前已有搜索模式。
- [ ] 二手搜索增加城市、价格区间、交易方式、上架状态和排序。
- [ ] 筛选条件写入 URL query，使返回和复制链接可恢复。
- [ ] 搜索历史只保存关键词，不保存可能包含隐私的完整账号参数。

### 验收标准

- [ ] 切换搜索类型时不会遗留不适用筛选项。
- [ ] 筛选、清空筛选、翻页和返回结果均稳定。
- [ ] URL 可以恢复相同搜索状态。
- [ ] 接口不支持某筛选项时隐藏或禁用，而不是发送无效参数。

### 成本和风险

- 成本：中，约 3-5 个工作日。
- 风险：APK 接口参数可能过时；需要以当前服务端返回为准。

## C-03 原生内容治理、屏蔽和举报

### 背景证据

- 当前用户举报打开移动网页：`src/pages/UserPage.vue:1262-1266`。
- APK 有 `/feed/block`、`/feed/addReplyTopToFeed`、`/feed/relatedRecommendList`，见 `D:\\code\\github\\coolapk_all_decompiled\\docs\\coolapk-api-from-decompiled.md:93,99,379`。
- 当前桌面端已有黑名单、忽略名单封装，可复用现有账号状态和提示组件。

### 实现任务

- [ ] 先确认举报、屏蔽、拉黑接口的当前权限和参数，禁止根据 APK 路径猜测写操作。
- [ ] 新增 `src/components/common/ReportDialog.vue`，包含原因选择、补充说明和提交状态。
- [ ] 在动态、评论、用户卡片菜单中提供上下文相关的举报/屏蔽入口。
- [ ] 成功后更新当前列表，避免必须整页刷新。
- [ ] 对不可用的接口保留移动网页兜底，但明确告诉用户已跳转外部页面。
- [ ] 热门回复、回复置顶和相关推荐若属于作者权限，只对有权限的动态显示。

### 验收标准

- [ ] 举报提交前有确认，提交后不会重复提交。
- [ ] 屏蔽成功后当前用户/动态按规则从列表移除或标记。
- [ ] 权限错误、频率限制和网络错误均有具体提示。
- [ ] 不会因为举报接口不可用导致动态详情无法打开。

### 成本和风险

- 成本：中高，约 5-8 个工作日。
- 风险：这是写操作，误操作和权限判断风险高，必须先做接口验证。

## D-01 托盘后台通知

### 背景证据

- 当前桌面通知入口：`src/components/layout/TopBar.vue:489-501,793-810`。
- 当前通知轮询主要依赖窗口可见状态。
- APK 有推送管理和多通知频道：
  - `D:\\code\\github\\coolapk_all_decompiled\\java_sources\\sources\\com\\coolapk\\market\\manager\\AppPushManger.java:108-144`
  - `D:\\code\\github\\coolapk_all_decompiled\\java_sources\\com\\coolapk\\market\\manager\\AppPushManger.java:545-570`

### 实现任务

- [ ] 将通知轮询从 TopBar 展示逻辑中拆到 `src/composables/useNotificationPolling.ts` 或独立服务。
- [ ] 托盘运行、窗口最小化和窗口隐藏时继续按设置轮询。
- [ ] 仅在未读数增加时发送桌面通知，避免每次轮询重复提醒。
- [ ] 按回复、@、私信、特别关注和系统通知区分标题和点击路由。
- [ ] 增加通知静音时间段和按类型开关；复用 `src/stores/settings.ts` 中已有设置。
- [ ] 处理多账号切换，账号变化时清空上一账号的未读基线。

### 验收标准

- [ ] 窗口隐藏和托盘状态下仍能收到符合设置的提醒。
- [ ] 同一条未读不会重复通知。
- [ ] 点击通知能进入正确动态、消息或通知分类。
- [ ] 退出登录、切换账号后不串通知。

### 成本和风险

- 成本：中高，约 5-10 个工作日。
- 风险：后台轮询耗电、网络频率、系统通知权限和多账号状态。

## D-02 图片批量保存、幻灯片和长图导出增强

### 实现任务

- [ ] 在 `src/components/overlays/ImageViewer.vue` 增加上一张、下一张和幻灯片播放。
- [ ] 支持当前动态全部图片批量选择和保存。
- [ ] 支持复制图片到剪贴板；无法写入剪贴板时回退为复制图片 URL。
- [ ] Live Photo 保存时区分静态图和视频文件，避免只保存封面。
- [ ] 增加“打开原图所在网页”和“在系统中打开”两个明确动作。
- [ ] 复用 `src/api/coolapk.ts:1096-1113` 的图片保存能力，不重新读取缓存后的 `data:image`。

### 验收标准

- [ ] 多图动态中的顺序与原动态一致。
- [ ] 批量保存中单张失败不会丢失其他成功文件。
- [ ] 文件名包含动态或图片标识，避免批量覆盖。
- [ ] 键盘左右键、Esc 和窗口焦点行为不影响普通页面操作。

### 成本和风险

- 成本：中，约 3-5 个工作日。
- 风险：大量图片并发、剪贴板权限、Live Photo 文件关联。

## D-03 自定义主题和纯黑模式

### 背景证据

- 当前外观设置：`src/pages/settings/AppearanceSettingsPage.vue`。
- 当前设置模型和默认值：`src/types/settings.ts`、`src/stores/settings.ts:75-149`。
- APK 存在主题列表和自定义主题：
  - `D:\\code\\github\\coolapk_all_decompiled\\java_sources\\sources\\com\\coolapk\\market\\view\\theme\\ThemeListActivity.java`
  - `D:\\code\\github\\coolapk_all_decompiled\\java_sources\\sources\\com\\coolapk\\market\\view\\theme\\CustomThemeFragment.java`

### 实现任务

- [ ] 第一阶段只做本地主题：自定义主色、背景色、文字色、纯黑模式。
- [ ] 扩展 `src/types/settings.ts` 和 `src/stores/settings.ts`，增加颜色值、主题模式和版本化迁移。
- [ ] 在 `AppearanceSettingsPage.vue` 增加颜色选择器、预览和恢复默认。
- [ ] 使用 CSS 变量统一注入，先盘点现有硬编码颜色再逐步替换。
- [ ] 云端主题市场暂不纳入第一阶段，除非确认稳定接口和资源安全策略。

### 验收标准

- [ ] 刷新和重启后主题保持。
- [ ] 颜色对比度不足时给出提示或限制保存。
- [ ] 纯黑模式不会影响图片、视频、二维码和代码内容的显示。
- [ ] 旧设置数据可以自动迁移，恢复默认后字段完整。

### 成本和风险

- 成本：中，约 2-4 个工作日。
- 风险：全局 CSS 改动范围大，容易影响页面细节；必须逐页视觉检查。

## 4. 建议的依赖顺序

```text
A-02 私信置顶 ───────────────┐
A-03 已有 API 页面闭环 ──────┼──> B-03 私信卡片/长消息
A-01 长图分享 ───────────────┘

现有 APK URL + Tauri 文件能力 ───> B-01 下载队列

问答 API 验证 ───────────────────> B-02 问答详情

直播接口验证 ───────────────────> C-01 直播互动

搜索参数核对 ───────────────────> C-02 高级搜索

通知状态抽离 ───────────────────> D-01 托盘通知
```

## 5. 建议的 Codex 执行方式

### 第一轮：只做技术核对

- [ ] 核对 APK 接口文档中每个目标接口的路径、HTTP 方法、参数和登录要求。
- [ ] 对照 `src/api/coolapk.ts`、`src-tauri/src/coolapk/client.rs`、`src-tauri/src/coolapk/commands.rs` 和 `src-tauri/src/lib.rs`，列出“已有 Rust 命令 / 只有前端封装 / 完全缺失”。
- [ ] 不改业务代码，输出接口核对结果。

### 第二轮：先实现 A-01、A-02、A-03

- [ ] 每个任务独立提交，避免长图、私信和列表闭环互相污染。
- [ ] 每个任务先补类型和 API，再补页面，再补错误态和测试。
- [ ] 结束后检查 `git diff --stat`、`git diff --check` 和工作区未关联改动。

### 第三轮：实现 B-01、B-02、B-03

- [ ] 下载管理先做本地文件闭环，再增加断点续传和并发控制。
- [ ] 问答先只做浏览和关注，不在接口未验证时实现复杂写操作。
- [ ] 私信消息类型必须有未知类型兜底。

### 第四轮：按资源情况选择 C 或 D

- [ ] 如果接口稳定且有测试账号，优先 C-01 直播互动。
- [ ] 如果更重视桌面效率，优先 D-02 图片批量保存和 D-01 托盘通知。
- [ ] C-03 举报/屏蔽必须在接口权限确认后再做。

## 6. 通用验收清单

- [ ] `git status --short --branch`：没有误改无关文件。
- [ ] 新增路由有页面标题、返回行为、刷新行为和深链接处理。
- [ ] 页面都有加载态、空态、错误态和重试入口。
- [ ] 游客、登录用户、多账号切换分别验证。
- [ ] 网络超时、服务端错误、Cookie 过期和权限不足分别验证。
- [ ] 图片、视频、Live Photo 不使用错误的缓存 URL 作为后端原始资源地址。
- [ ] 所有写操作有防重复提交和成功/失败反馈。
- [ ] 长列表有分页、去重和取消请求处理。
- [ ] 前端类型检查和相关单元测试通过。
- [ ] Rust 代码通过格式检查和相关测试；不要用未验证的接口返回结构强行解包。
- [ ] 用户可见功能完成后，再更新 README 或 CHANGELOG，不要在功能尚未完成时提前宣称支持。

## 7. 推荐第一批任务的最终定义

如果只安排一批开发，执行以下 5 项：

1. `A-02` 私信服务端置顶：低中成本，接口边界清晰。
2. `A-01` 动态/文章长图：桌面端价值明显，APK 有明确参考实现。
3. `A-03` 热门回复、点赞用户、转发列表：最大化利用已有 API。
4. `B-02` 问答详情：补齐搜索结果到内容详情的断层。
5. `B-01` 下载队列：作为独立的大功能立项，不与普通页面改动混做。

完成这 5 项后，再根据接口验证结果选择直播互动或托盘后台通知。
