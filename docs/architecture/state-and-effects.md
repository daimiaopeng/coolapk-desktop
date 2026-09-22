# 状态与副作用清单

这份清单用于约束 Presentation 切换，不把页面的局部状态误当成业务状态。

## 状态归属

| 层级 | 当前承载 | 切换规则 |
| --- | --- | --- |
| Business State | `auth`、`settings`、`downloads`、`notifications`、`topicHub` Pinia store；API/domain 返回值；`requestCenter` 与资源缓存 | Desktop/Mobile 共用，不随壳切换重建 |
| Route State | Vue Router 的同一 hash URL、query、params、`pageTabs` generation | Presentation 切换不 push/replace，不增加 history |
| View State | 常驻 `src/presentation/RouteOutlet.vue` 的 route page + `KeepAlive`；`viewState` 捕获输入/textarea/contenteditable；`routeScroll` 的 key 和 semantic entity anchor | 当前页面实例持续挂载；若未来 route page 被重建，输入和滚动有恢复兜底 |
| Ephemeral UI State | hover、tooltip、ripple、临时侧边栏动画、移动导航当前展开态 | 可以随当前 Presentation 重建 |

## 网络与副作用边界

- 当前 route page 只由一个 `router-view` 和一个 `KeepAlive` 实例挂载；Desktop/Mobile 只是使用 `Teleport defer` 的 target，不会在切换时各自执行一次 `onMounted` loader。
- `requestCenter` 统一处理请求中的数量、超时和重试；页面继续使用现有业务 action，不在 Mobile adapter 中复制请求。
- Presentation resize/visualViewport listener 只在 `usePresentationStore.start()` 注册，并在 `App.vue` 的 `onUnmounted` 调用 `stop()`。
- App 级热键、selection-clear、设置自动缩放、更新事件监听仍由 `App.vue` 集中注册并清理。
- 页面自身的 timer、IntersectionObserver、Tauri event 和 window listener 继续由页面已有的 `onUnmounted` / `onBeforeUnmount` 清理；Mobile feature adapter 不新增这些副作用。

## 输入和滚动

- 表单、评论、搜索和设置输入在 Presentation 切换前由 `useViewStateStore` 记录，密码和文件输入明确排除。
- 滚动优先保存 `data-feed-id`、`data-entity-id` 或 `data-id` 对应实体相对容器顶部的 offset；找不到实体时退回到带语义 key 的 `scrollTop/scrollLeft`。
- 这两种兜底均按 route fullPath 保存，不能把不同实体或不同 query 的页面位置混用。
