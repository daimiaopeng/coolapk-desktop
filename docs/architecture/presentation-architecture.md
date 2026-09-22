# Desktop / Mobile Presentation 架构

本文记录当前代码已经落地的 Presentation 边界，不把未来设想写成已完成能力。

## 决策

- 应用只有一个 Vue App、一个 Vue Router、一个 Pinia 实例和一套 API/domain/store。
- `src/presentation/DesktopPresentation.vue` 与 `src/presentation/MobilePresentation.vue` 是唯一的根级 Presentation 接线。
- `App.vue` 根据 `usePresentationStore()` 的统一结果用 `v-if` 只挂载一套 Presentation；不会同时渲染两套完整页面再用 `v-show` 隐藏。
- `DesktopPresentation` 保留现有 `AppShell`、TopBar、Sidebar、PageTabBar；`AppShell` 不再挂载 Mobile 栏。
- `MobilePresentation` 使用 `src/mobile/shell/MobileShell.vue`、独立 App Bar、底部导航或 Tablet Navigation Rail，并通过 `MobileRouteOutlet` 选择 feature surface。
- `src/presentation/RouteOutlet.vue` 是唯一实际挂载 `router-view` 的出口。它用一个常驻 `KeepAlive` 保存当前 route page，再用 `Teleport defer` 把页面 DOM 挂到当前 Presentation 的唯一 target；`defer` 避免 Android WebView 在“先禁用、再移动 Teleport DOM”时触发 Vue `insertBefore` 崩溃。切换 Desktop/Mobile 不会重新创建当前页面实例，也不会制造第二份页面 DOM。
- Desktop 页面和 Mobile feature page/adapter 共享 API、Pinia、模型、分页、业务 action；Mobile page 可以完全拥有自己的 DOM、导航和触控交互，adapter 只用于尚未需要独立信息架构的受控 surface。

## Presentation Policy

唯一策略位于 `src/utils/presentationPolicy.ts`，状态由 `src/stores/presentation.ts` 管理：

- Desktop 状态宽度 `<= 720 CSS px` 切到 Mobile。
- Mobile 状态宽度 `>= 760 CSS px` 切回 Desktop。
- `721..759` 保持当前 Presentation，避免拖动窗口时抖动。
- Android/iOS runtime 始终是 Mobile；Windows 小窗口仍是 Windows runtime，只改变 Presentation。
- Mobile layout 由同一 Mobile Presentation 分为 `compact`（`<=600`）、`medium`（`601..959`）、`expanded`（`>=960`）。Tablet 不建立第三套产品；expanded 使用 Navigation Rail 和更宽的内容约束。
- QA 可以通过 `usePresentationStore().setMode('auto' | 'force-desktop' | 'force-mobile')` 或 `presentation` 查询参数覆盖策略。默认是 `auto`。

Feature 不得自行读取 `innerWidth`、`matchMedia` 或复制 720/760 阈值来决定 Presentation。局部卡片/栅格的 CSS 响应式不等同于 Presentation Policy。

## Runtime 与 capability

`src/utils/platform.ts` 负责 runtime 识别，`src/utils/platformCapabilities.ts` 提供统一 capability 入口。Presentation 与 runtime 独立：

| 场景 | Presentation | Runtime / capability |
| --- | --- | --- |
| Windows 大窗口 | Desktop | Windows desktop |
| Windows 缩小窗口 | Mobile | Windows desktop capability 仍可用 |
| Android Phone / Tablet | Mobile | Android + mobile lifecycle |
| iPhone / iPad | Mobile | iOS + mobile lifecycle |

Desktop window control、tray、startup、shell 等能力不能由 `presentation === 'mobile'` 推断；移动端必须通过 capability 入口决定是否显示或执行。

## 状态连续性

- Router 不因 Presentation 改写路径，不产生 `/desktop/*` 或 `/mobile/*`。
- `RouteOutlet` 保留页面缓存和 page-tab generation；切换 Presentation 不 push/replace 路由。Teleported page instance 在切换时持续存在，当前 shell 只替换承载 target。
- `useViewStateStore` 在切换前捕获当前 route surface 中的非密码输入/可编辑内容，在新 surface 完成后恢复；密码和文件输入不会被捕获。
- `routeScroll.ts` 保存带 key 的滚动容器位置；切换后按 semantic key/容器序号恢复，不依赖旧 Presentation 的 DOM 引用。
- API/store/auth/download 等业务状态仍由根 App 和 Pinia 持有；当前 route page 由常驻 Router/KeepAlive 出口持有，Presentation 壳卸载不会重建页面 loader、订阅或表单组件。
- Presentation policy 监听器只由根 App 启动/停止；Mobile shell 的窗口/导航监听属于自身生命周期。

## Feature capability

`src/config/featureCapabilities.ts` 是 Desktop/Mobile parity manifest。每个实际功能组列出 route、action、Desktop/Mobile 支持状态、来源类别和 Mobile 入口。当前 Mobile route surface 使用稳定的 route frame；`src/mobile/features/**` 按功能组提供独立移动 page、受控 adapter 和测试契约，业务 action 仍只有一份；`not-supported` 只用于有明确能力缺口的功能，不用来掩盖未盘点的页面。

实际路由以 `src/router/index.ts` 为准，主要覆盖首页/动态、详情、搜索、用户关系、话题/论坛、收藏/历史、下载、通知/私信、应用/产品/好物、活动/闲置、登录/设置、外链和媒体等页面。评论、登录和媒体查看器是 inline/overlay 能力，不凭空增加第二套 router identity。

## APK mapping

指定 APK 的 mapping 记录在 `docs/apk/mapping/16.6.2-2609151.json`，包含版本、versionCode、SHA-256、Activity/runtime 证据、Phone/Tablet 结论、资源来源、Mobile target 和 confidence。静态资源解包只在本地分析目录进行，仓库不提交原始 APK；可复用的小体积资源若确实需要，才复制到 `src/assets` 并在 mapping 中保留来源。

运行时观察记录：目标包在 root 雷电设备上以 1080×1920、480dpi、`sw360dp` 竖屏运行；官方页面展示顶部系统 inset、自绘底部导航、搜索框和频道/关注 tabs；横屏尝试仍锁定竖屏。截图和 UIAutomator 原始证据位于本机临时目录，mapping 不把签名/安装成功当作 UI 证据。

APK 更新时沿用同一流程：保留旧版 mapping 与 SHA-256，先对新 APK 做 manifest/AAPT2/resource-map/dex 描述符差异，再在 root 模拟器上确认启动 Activity、关键页面和 UI XML；只有证据等级变化的 Mobile feature 才更新对应 mapping 和 adapter。广告/推送 SDK、保护壳 native 库、用户内容和远程图片不复制到仓库。

## Desktop Freeze 与 guardrails

Desktop protected surface 见 `docs/architecture/desktop-protected.json`。`npm run check:architecture` 检查：

- 根节点是否只通过 `v-if` 接线一套 Presentation；
- Desktop AppShell 是否误挂 Mobile 栏；
- Mobile/Shared 是否跨边界 import；
- Presentation Policy 是否唯一声明阈值；
- Feature manifest 和 protected path 是否存在。
- Mobile Feature 基本测试、listener cleanup、真实 route/feature inventory 和 APK mapping target 是否存在。

`npm run check:apk-mapping` 检查 mapping target 是否存在；传入 `--apk` 时还会核对本地 APK SHA-256。

## 验证范围

最终阶段执行 hysteresis policy 单测、feature manifest 单测、现有 Vitest、TypeScript、Vite、Rust check、`git diff --check`，再通过本地桌面运行和雷电 adb 做 Phone/Tablet/窗口缩放观察。未运行 test/build 前，不把静态代码结果写成运行时通过。
