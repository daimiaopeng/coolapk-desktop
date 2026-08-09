<template>
  <div class="settings-section">
    <h3 class="section-title">外观设置</h3>

    <div class="setting-group">
      <h4 class="group-title">主题模式</h4>
      <div class="theme-options">
        <div
          :class="['theme-card', { 'is-active': settingsStore.settings.theme === 'light' }]"
          @click="settingsStore.setTheme('light')"
        >
          <div class="preview-box light-preview"></div>
          <span>浅色模式</span>
        </div>

        <div
          :class="['theme-card', { 'is-active': settingsStore.settings.theme === 'dark' }]"
          @click="settingsStore.setTheme('dark')"
        >
          <div class="preview-box dark-preview"></div>
          <span>深色模式</span>
        </div>

        <div
          :class="['theme-card', { 'is-active': settingsStore.settings.theme === 'system' }]"
          @click="settingsStore.setTheme('system')"
        >
          <div class="preview-box system-preview"></div>
          <span>跟随系统</span>
        </div>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">主题强调色</h4>
      <p class="group-sub">全局品牌主色调，侧边栏、按钮与链接等统一换色</p>
      <div class="accent-options">
        <div
          v-for="c in accentColors"
          :key="c.key"
          :class="['accent-swatch', { 'is-active': settingsStore.settings.accentColor === c.key }]"
          :style="{ '--swatch-color': c.color }"
          @click="settingsStore.setAccent(c.key)"
        >
          <span class="swatch-dot"></span>
          <span>{{ c.label }}</span>
        </div>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">页面缩放与字号</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">界面缩放比例 (Ctrl + / -)</span>
          <span class="row-sub">
            {{ settingsStore.settings.zoomManuallySet ? `手动缩放 ${settingsStore.settings.zoom}%` : '默认 100%：系统显示缩放已自动适配，无需额外放大' }}
          </span>
        </div>
        <div class="zoom-controls">
          <button class="zoom-btn" @click="settingsStore.setZoom(settingsStore.settings.zoom - 10)">-</button>
          <span class="zoom-value">{{ settingsStore.settings.zoom }}%</span>
          <button class="zoom-btn" @click="settingsStore.setZoom(settingsStore.settings.zoom + 10)">+</button>
        </div>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">正文字号</span>
          <span class="row-sub">动态正文与标题的显示字号</span>
        </div>
        <div class="zoom-controls">
          <button class="zoom-btn" @click="adjustFontSize(-1)">-</button>
          <span class="zoom-value">{{ settingsStore.settings.fontSize }}px</span>
          <button class="zoom-btn" @click="adjustFontSize(1)">+</button>
        </div>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">列表密度</h4>
      <p class="group-sub">信息流卡片的留白与间距紧凑程度</p>
      <div class="density-options">
        <div
          v-for="d in densityOptions"
          :key="d.key"
          :class="['density-card', { 'is-active': settingsStore.settings.density === d.key }]"
          @click="settingsStore.settings.density = d.key"
        >
          <span class="density-icon">{{ d.icon }}</span>
          <span>{{ d.label }}</span>
        </div>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">微动画与视觉效果</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">减少动态过渡效果</span>
          <span class="row-sub">禁用界面显隐动画与微交互</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.reduceMotion" />
      </div>
    </div>

    <!-- 页面栏目显隐设置区域 -->
    <div class="setting-group">
      <h4 class="group-title">侧边栏页面栏目显隐设置</h4>
      <p class="group-sub">根据个人使用习惯自由开启或关闭左侧侧边栏对应的功能栏目</p>

      <div class="nav-grid">
        <div v-for="nav in navItems" :key="nav.key" class="nav-toggle-card">
          <div class="nav-item-meta">
            <i :class="[nav.icon, 'nav-item-icon']"></i>
            <span class="nav-item-name">{{ nav.label }}</span>
          </div>
          <AppSwitch
            :model-value="getNavVisible(nav.key)"
            @update:model-value="toggleNav(nav.key)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../../stores/settings';
import type { AccentColor, FeedDensity } from '../../types/settings';
import AppSwitch from '../../components/common/AppSwitch.vue';

const settingsStore = useSettingsStore();

const accentColors: { key: AccentColor; label: string; color: string }[] = [
  { key: 'green', label: '酷安绿', color: '#10b768' },
  { key: 'blue', label: '活力蓝', color: '#2f7bff' },
  { key: 'violet', label: '优雅紫', color: '#7c5cff' },
  { key: 'orange', label: '暖橙', color: '#f58220' },
];

const densityOptions: { key: FeedDensity; label: string; icon: string }[] = [
  { key: 'comfortable', label: '舒适', icon: '▨' },
  { key: 'standard', label: '标准', icon: '▦' },
  { key: 'compact', label: '紧凑', icon: '▤' },
];

function adjustFontSize(delta: number) {
  const next = Math.min(Math.max(settingsStore.settings.fontSize + delta, 12), 20);
  settingsStore.settings.fontSize = next;
}

const navItems = [
  { key: 'home', label: '首页', icon: 'fas fa-home' },
  { key: 'topics', label: '话题广场', icon: 'fas fa-hashtag' },
  { key: 'discover', label: '发现中心', icon: 'fas fa-compass' },
  { key: 'apps', label: '应用中心', icon: 'fas fa-cubes' },
  { key: 'games', label: '游戏中心', icon: 'fas fa-gamepad' },
  { key: 'reviews', label: '评测区', icon: 'fas fa-flask' },
  { key: 'secondhand', label: '二手市场', icon: 'fas fa-store' },
  { key: 'notifications', label: '通知中心', icon: 'far fa-bell' },
  { key: 'favorites', label: '收藏夹', icon: 'far fa-bookmark' },
  { key: 'history', label: '历史记录', icon: 'far fa-clock' },
  { key: 'messages', label: '消息通知', icon: 'far fa-comment-alt' },
  { key: 'following', label: '我关注的', icon: 'far fa-user' },
  { key: 'albums', label: '专辑广场', icon: 'fas fa-layer-group' },
  { key: 'pictures', label: '酷图广场', icon: 'far fa-image' },
];

function getNavVisible(key: string): boolean {
  const vis = settingsStore.settings.navVisibility;
  if (!vis) return true;
  return vis[key as keyof typeof vis] !== false;
}

function toggleNav(key: string) {
  settingsStore.toggleNavVisibility(key as any);
}
</script>


<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 720px;
}

.section-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-3);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.group-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.group-sub {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
  margin-top: -4px;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.nav-toggle-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
}

.nav-item-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.nav-item-icon {
  color: var(--brand-primary);
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.nav-item-name {
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}


.theme-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 180px));
  gap: var(--space-4);
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background-color: var(--background);
  border: 2px solid var(--border);
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.theme-card.is-active {
  border-color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.preview-box {
  width: 100%;
  height: 64px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.light-preview { background-color: #ffffff; }
.dark-preview { background-color: #0f1113; }
.system-preview { background: linear-gradient(135deg, #ffffff 50%, #0f1113 50%); }

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-light);
}

.row-info {
  display: flex;
  flex-direction: column;
}

.row-label {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.row-sub {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.accent-options {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}

.accent-swatch {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
  user-select: none;
}

.accent-swatch:hover {
  border-color: var(--swatch-color);
  color: var(--text-primary);
}

.accent-swatch.is-active {
  border-color: var(--swatch-color);
  background-color: var(--brand-soft);
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.swatch-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--swatch-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.density-options {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.density-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border: 2px solid var(--border);
  border-radius: var(--radius-card);
  cursor: pointer;
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
  user-select: none;
}

.density-card:hover {
  border-color: var(--brand-primary);
  color: var(--text-primary);
}

.density-card.is-active {
  border-color: var(--brand-primary);
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.density-icon {
  font-size: 18px;
  letter-spacing: -1px;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-control);
  background-color: var(--background);
  border: 1px solid var(--border);
  font-size: 16px;
  font-weight: bold;
}

.zoom-value {
  font-size: var(--font-size-sub);
  min-width: 44px;
  text-align: center;
}
</style>
