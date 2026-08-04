# DESIGN.md - 酷安桌面客户端设计系统

本文档是 `coolapk-desktop` 项目设计的唯一权威来源 (Single Source of Truth)。所有新增或修改的 UI 页面与组件必须严格遵循此系统规范。

---

## 1. Visual Theme & Atmosphere (视觉主题与氛围)

酷安桌面端继承酷安（Coolapk）社区绿色基因，融合现代桌面端应用设计范式：
- **桌面效率与高密度**：结构清晰的三栏式信息流，提升单屏信息承载率，同时保持透气性。
- **现代化视觉语言**：采用精致的边框分隔、轻微圆角与极简微阴影，摒弃大面积刺眼对比与厚重阴影。
- **沉浸感深浅模式**：浅色模式清爽明亮，深色模式高对比防眩光。
- **品牌绿的克制运用**：酷安绿仅用于品牌 Header、当前导航高亮、主按钮、选中状态和链接，禁止大面积填充背景。

---

## 2. Color Palette & Roles (色彩系统与角色)

统一通过 CSS 变量在 `src/styles/tokens.css` 和 `src/styles/themes.css` 中声明。

### 浅色主题 (Light Mode)
- `--brand-primary`: `#10b768` (酷安品牌绿)
- `--brand-hover`: `#079e58`
- `--brand-active`: `#05844b`
- `--brand-soft`: `#eaf8f0` (高亮浅绿背景)
- `--brand-soft-hover`: `#ddf4e7`

- `--background`: `#f5f7f8` (系统通用底色)
- `--background-secondary`: `#f0f2f4`
- `--surface`: `#ffffff` (卡片/内容区域)
- `--surface-hover`: `#f7f9fa`
- `--surface-active`: `#eef2f3`
- `--surface-elevated`: `#ffffff` (弹窗/下拉浮层)

- `--text-primary`: `#17191c` (正文/重要标题)
- `--text-secondary`: `#62666d` (次要文本/说明)
- `--text-tertiary`: `#969ba3` (时间/设备信息)
- `--text-disabled`: `#b7bbc1` (不可用)
- `--text-inverse`: `#ffffff`

- `--border`: `#e3e6e8` (标准分隔边框)
- `--border-light`: `#eceeef`
- `--divider`: `#eceef0`

- `--success`: `#10b768`
- `--warning`: `#f59f00`
- `--danger`: `#f04444`
- `--info`: `#2f80ed`

### 深色主题 (Dark Mode) `[data-theme="dark"]`
- `--brand-primary`: `#22c875`
- `--brand-hover`: `#32d984`
- `--brand-active`: `#16af65`
- `--brand-soft`: `#173a29`
- `--brand-soft-hover`: `#1d4933`

- `--background`: `#0f1113`
- `--background-secondary`: `#151719`
- `--surface`: `#191b1e`
- `--surface-hover`: `#202327`
- `--surface-active`: `#272a2f`
- `--surface-elevated`: `#202327`

- `--text-primary`: `#f4f5f6`
- `--text-secondary`: `#b2b6bc`
- `--text-tertiary`: `#747a82`
- `--text-disabled`: `#545960`

- `--border`: `#2a2d31`
- `--border-light`: `#23262a`
- `--divider`: `#25282c`

---

## 3. Typography Rules (排版规范)

### 字体栈 (Font Family)
```css
font-family: Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
```

### 字号与层级 (Font Size & Weight)
- **页面大标题**：`24px` / `Font Weight 650` / `Line Height 1.3`
- **模块标题**：`18px` / `Font Weight 600` / `Line Height 1.4`
- **卡片/组标题**：`16px` / `Font Weight 600` / `Line Height 1.45`
- **动态中文正文**：`15px` / `Font Weight 400` / `Line Height 1.65` (保障阅读体验)
- **辅助正文**：`14px` / `Font Weight 400` / `Line Height 1.55`
- **说明文字/标签**：`12px` / `Font Weight 400` / `Line Height 1.45`
- **按钮文本**：`14px` / `Font Weight 550`

---

## 4. Layout Principles (布局原则)

### 基础尺寸规范
- **默认窗口尺寸**：`1440px × 900px`
- **最小窗口尺寸**：`960px × 640px`
- **三栏宽度**：
  - 左侧导航栏 (`MainSidebar`)：`220px` (折叠状态：`64px`)
  - 中央主内容 (`MainFeed`)：`720px` (最大宽度)
  - 右侧辅助栏 (`RightSidebar`)：`300px`
  - 栏间距 (`Gap`)：`16px`
  - 顶部栏 (`TopBar`)：`72px` (包含全局搜索与操作栏)
  - 评论右侧抽屉 (`CommentDrawer`)：`520px`

---

## 5. Spacing System (间距系统)

基于 4px 递进间距规范：
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-8`: `32px`
- `--space-10`: `40px`

### 圆角规范 (Border Radius)
- `--radius-xs`: `4px`
- `--radius-sm`: `6px`
- `--radius-control`: `8px` (适用于按钮、输入框)
- `--radius-card`: `10px` (适用于动态卡片、设置分组)
- `--radius-dialog`: `14px` (适用于弹窗)
- `--radius-large`: `18px`
- `--radius-pill`: `9999px` (适用于标签、胶囊按钮)

---

## 6. Component Styling (组件风格规范)

- **按钮 (`AppButton`)**：8px 圆角，具备 Default, Primary, Soft, Ghost, Danger 变体。
- **输入框**：8px 圆角，带有 Focus 时的 2px 品牌绿外发光。
- **动态卡片 (`FeedCard`)**：10px 圆角，1px 微细边框，无常规阴影，Hover 时纯轻微对比背景过渡。
- **评论抽屉 (`CommentDrawer`)**：右侧平滑滑入，带有全屏暗色遮罩与独立滚动轴。

---

## 7. Depth & Elevation (层级与阴影)

普通卡片与内容块使用 `1px solid var(--border)`，不加常规阴影。
阴影仅严格用于浮动与弹出层：
- **Dialog 弹窗**：`box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);`
- **Dropdown 下拉菜单**：`box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);`
- **Drawer 抽屉**：`box-shadow: -8px 0 24px rgba(0, 0, 0, 0.15);`

---

## 8. Responsive Behavior (响应式断点)

- **> 1280px**：完整三栏布局 (左导航 + 主内容 + 右辅助栏)。
- **1024px – 1280px**：自动隐藏右侧辅助栏。
- **800px – 1024px**：左侧导航栏自动折叠为图标模式 (64px)。
- **< 800px**：单栏极简自适应模式，不使用移动端底部导航。

---

## 9. Interaction & Motion (微动画与交互)

微动画强调克制与流畅，不使用大幅度弹跳：
- **Hover 过渡**：`120ms ease-out`
- **普通状态切换**：`180ms ease-out`
- **抽屉滑入/滑出**：`220ms cubic-bezier(0.16, 1, 0.3, 1)`
- **Dialog 弹窗显隐**：`180ms cubic-bezier(0.16, 1, 0.3, 1)`
- **点赞微交互**：`160ms ease-in-out`
- 支持 `prefers-reduced-motion` 禁用非必要过渡。

---

## 10. Accessibility (无障碍支持)

- 纯图标按钮必须配置 `aria-label` 描述属性。
- 支持全局键盘快捷键（Ctrl+K 搜索，Ctrl+N 发布，Ctrl+, 设置，Esc 取消/关闭，J/K 上下动态切换）。
- 文本与背景间具备 WCAG 2.1 AA 级对比度。

---

## 11. Do's and Don'ts (禁止事项)

### Do's
- 保持动态正文 15px/1.65 易读性。
- 点击动态按钮评论时，优先展开右侧 520px 评论抽屉。
- 返回首页时恢复滚轴位置。

### Don'ts
- 严禁在大面积背景充斥品牌强绿色。
- 严禁删改已有的 Rust API 与 Token V3 框架。
- 严禁将界面做成纯静态 Mock，必须维持所有真实 API 的连接。

---

## 12. Agent Implementation Guide (Agent 执行指引)

AI Assistant 在新增页面和组件时：
1. 始终引入并引用定义好的 CSS Variables。
2. 保持 Vue 3 Composition API `<script setup lang="ts">` 架构。
3. 组件内 CSS 禁止硬编码颜色、阴影或字号。
