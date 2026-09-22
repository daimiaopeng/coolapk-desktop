# 路由与功能清单

清单以 `src/router/index.ts` 的实际路由为准。Presentation 切换不新增 `/desktop/*` 或 `/mobile/*` 路径；Mobile 页面可以拥有与 Desktop 完全不同的 DOM，但继续使用现有 API、Pinia、模型和 action。

| 功能组 | 实际路由 | Mobile adapter | APK/实现备注 |
| --- | --- | --- | --- |
| 首页与动态流 | `/`, `/feeds`（重定向）, `/discover` | `MobileFeedPage` / `MobileDiscoverPage` | APK `layout/home`、`layout/app_home`、`layout/item_feed_layout_v8` |
| 应用与游戏 | `/apps`, `/games`, `/app/:packageName` | `MobileMarketPage` / `MobileProductDetailPage` | APK `layout/search_result` 与应用详情资源；复用下载/收藏 action |
| 动态详情 | `/feed/:feedId`, `/question/:questionId`, `/live/:liveId` | `MobileFeedPage`（detail） | 保留评论、回复、点赞、收藏、分享入口 |
| 搜索与选择 | `/search`, `/product-selector` | `MobileSearchPage` | 搜索查询和历史继续走共享 API/store |
| 用户与关系 | `/user/:uid`, `/user/:uid/relations/:relation`, `/my` | `MobileUserPage` / `MobileProfilePage` / `MobileAccountPage` | 用户资料、关注、粉丝和动态均为独立移动 DOM |
| 话题与频道 | `/topics`, `/topic/:tag`, `/node/:nodeType/:nodeId`, `/dyh/:dyhId`, `/my-dyh` | `MobileCommunityPage` | 话题、论坛、频道列表/详情/搜索/分页 |
| 收藏与媒体 | `/favorites`, `/my-likes`, `/history`, `/albums`, `/album/:albumId`, `/my-albums`, `/pictures` | `MobileLibraryPage` / `MobileCommunityPage` | 收藏、历史、专辑和酷图均有移动列表 surface |
| 通知与私信 | `/notifications`, `/messages` | `MobileNotificationsPage` / `MobileMessagePage` | 未读数、已读、会话、历史消息和发送 action |
| 下载 | `/downloads` | `MobileDownloadsPage` | 复用 `downloads` store 和现有队列生命周期 |
| 好物与数码 | `/goods`, `/goods/lists/:feedId`, `/goods/ranking/:feedId`, `/digital`, `/my-products`, `/product-compare` | `MobileMarketPage` / `MobileDigitalPage` / `MobileProductDetailPage` | APK mapping 记录 `collection_select`、产品/数码资源线索 |
| 活动与闲置 | `/events`, `/event/:eventId`, `/secondhand`, `/secondhand/list`, `/secondhand/brands`, `/reviews` | `MobileCommunityPage` / `MobileMarketPage` | 活动、点评和闲置子页面均独立渲染 |
| 账号与设置 | `/following`, `/blacklist`, `/followed-nodes`, `/followed-topics`, `/recent-contacts`, `/recycle-bin`, `/hidden-replies`, `/my-devices`, `/my-votes`, `/settings/*` | `MobileAccountPage` / `MobileSettingsPage` | 登录引导、分页、关系操作和设置 action |
| 更多与外部内容 | `/auth_callback`, `/more`, `/center`, `/external`, `/anylist`, `/anylist/create`, `/anylist/:listId` | `MobileMoreServicesPage` / `MobileUtilityPage` / `MobileCommunityPage` | 外部链接和列表业务保持共享页面，能力通过 platform capability 判断 |

## 不单独增加 Router 的能力

发布、登录弹窗、图片查看器、搜索命令、确认框、上下文菜单和更新提示属于 App 根部的 overlay；它们不应通过第二套路由复制。评论、收藏选择器和分享面板同样属于 feature/page 内联能力，使用当前页面的 route identity。

## 适配器边界

`src/mobile/features/**` 不导入 `src/components/layout/**`，不自行读取 viewport 来决定 Presentation，也不复制 API/store。Desktop 页面目录仍由 `DesktopPresentation -> AppShell -> RouteOutlet` 挂载；Mobile 页面目录由 `MobilePresentation -> MobileShell -> MobileRouteOutlet -> MobileRoutePresentation` 挂载。`MobileRoutePresentation` 对已迁移路由直接选择独立 Mobile page；只有没有专属页面的能力才使用受控 adapter。
