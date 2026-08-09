<template>
  <aside :class="['main-sidebar', { 'is-collapsed': isCollapsed }]">
    <!-- 图二同款：吸附在侧边栏右侧分割线边缘的凸起折叠手柄按钮 -->
    <button
      class="sidebar-floating-toggle-btn"
      :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
      @click="settingsStore.toggleSidebar"
    >
      <svg class="dock-toggle-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <path v-if="isCollapsed" d="M13 15l3-3m0 0l-3-3m3 3H11" />
        <path v-else d="M15 15l-3-3m0 0l3-3m-3 3h4" />
      </svg>
    </button>

    <nav class="sidebar-nav custom-scrollbar">
      <div class="nav-group">
        <router-link
          v-for="item in primaryNavs"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="is-active"
          :title="item.label"
        >
          <i :class="[item.icon, 'nav-icon']"></i>
          <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>

      <div class="nav-divider"></div>

      <div class="nav-group">
        <router-link
          v-for="item in secondaryNavs"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="is-active"
          :title="item.label"
        >
          <i :class="[item.icon, 'nav-icon']"></i>
          <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>

      <div class="nav-divider"></div>

      <div class="nav-group">
        <router-link to="/settings" class="nav-item" active-class="is-active" title="设置">
          <i class="fas fa-cog nav-icon"></i>
          <span v-if="!isCollapsed" class="nav-label">设置</span>
        </router-link>

        <button class="nav-item action-item" :title="isDark ? '切换日间模式' : '切换夜间模式'" @click="toggleTheme">
          <i :class="[isDark ? 'fas fa-sun' : 'fas fa-moon', 'nav-icon']"></i>
          <span v-if="!isCollapsed" class="nav-label">
            {{ isDark ? '日间模式' : '夜间模式' }}
          </span>
        </button>

        <button v-if="!authStore.isLoggedIn" class="nav-item action-item primary-item" title="登录账号" @click="authStore.openLoginModal()">
          <i class="fas fa-sign-in-alt nav-icon"></i>
          <span v-if="!isCollapsed" class="nav-label">登录账号</span>
        </button>

        <button v-else class="nav-item action-item danger-item" title="退出登录" @click="handleLogout">
          <i class="fas fa-sign-out-alt nav-icon"></i>
          <span v-if="!isCollapsed" class="nav-label">退出登录</span>
        </button>
      </div>
    </nav>

    <div v-if="!isCollapsed" class="sidebar-footer">
      <div class="app-info">
        <span class="version-text">酷安桌面版 v{{ appVersion }}</span>
        <button class="check-update-btn" @click="requestUpdateCheck">检查更新</button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import { useAuthStore } from '../../stores/auth';
import { APP_VERSION } from '../../constants/version';

const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const appVersion = APP_VERSION;

function requestUpdateCheck() {
  window.dispatchEvent(new Event('check-for-update'));
}

const isCollapsed = computed(() => settingsStore.settings.sidebarCollapsed);

const isDark = computed(() => {
  return settingsStore.settings.theme === 'dark';
});

const allPrimaryNavs = [
  { key: 'home', path: '/', label: '首页', icon: 'fas fa-home' },
  { key: 'feeds', path: '/feeds', label: '动态', icon: 'fas fa-stream' },
  { key: 'topics', path: '/topics', label: '话题', icon: 'fas fa-hashtag' },
  { key: 'discover', path: '/discover', label: '发现', icon: 'fas fa-compass' },
  { key: 'apps', path: '/apps', label: '应用', icon: 'fas fa-cubes' },
  { key: 'games', path: '/games', label: '游戏', icon: 'fas fa-gamepad' },
  { key: 'reviews', path: '/reviews', label: '评测区', icon: 'fas fa-flask' },
  { key: 'secondhand', path: '/secondhand', label: '二手市场', icon: 'fas fa-store' },
];

const allSecondaryNavs = [
  { key: 'notifications', path: '/notifications', label: '通知', icon: 'far fa-bell' },
  { key: 'favorites', path: '/favorites', label: '收藏', icon: 'far fa-bookmark' },
  { key: 'history', path: '/history', label: '历史', icon: 'far fa-clock' },
  { key: 'messages', path: '/messages', label: '消息', icon: 'far fa-comment-alt' },
  { key: 'following', path: '/following', label: '我关注的', icon: 'far fa-user' },
  { key: 'albums', path: '/albums', label: '专辑', icon: 'fas fa-layer-group' },
  { key: 'pictures', path: '/pictures', label: '酷图', icon: 'far fa-image' },
];

const primaryNavs = computed(() => {
  const vis = settingsStore.settings.navVisibility;
  if (!vis) return allPrimaryNavs;
  return allPrimaryNavs.filter((item) => vis[item.key as keyof typeof vis] !== false);
});

const secondaryNavs = computed(() => {
  const vis = settingsStore.settings.navVisibility;
  if (!vis) return allSecondaryNavs;
  return allSecondaryNavs.filter((item) => vis[item.key as keyof typeof vis] !== false);
});


function toggleTheme() {
  const nextTheme = settingsStore.settings.theme === 'dark' ? 'light' : 'dark';
  settingsStore.setTheme(nextTheme);
}

function handleLogout() {
  authStore.logout();
}
</script>

<style scoped>
.main-sidebar {
  position: relative;
  width: var(--sidebar-width);
  background-color: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: width var(--duration-normal) var(--ease-default);
  z-index: 10;
}

.main-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
}

/* 图二同款：吸附在侧边栏右侧分割线边缘的凸起折叠手柄按钮 */
.sidebar-floating-toggle-btn {
  position: absolute;
  top: 20px;
  right: -13px;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm, 8px);
  background-color: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 99;
  transition: all var(--duration-fast) var(--ease-default);
}

.sidebar-floating-toggle-btn:hover {
  background-color: var(--surface-hover);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  transform: scale(1.12);
  box-shadow: 0 3px 10px rgba(16, 185, 129, 0.2);
}

.dock-toggle-icon {
  display: block;
}

.sidebar-panel-icon {
  display: block;
}

.sidebar-nav {
  flex: 1;
  padding: var(--space-3) var(--space-3);
  overflow-y: auto;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 42px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  transition: all var(--duration-fast) var(--ease-default);
  text-decoration: none;
  border: none;
  background: transparent;
  width: 100%;
  box-sizing: border-box;
}

.nav-item:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.nav-item.is-active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.nav-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3.5px;
  height: 18px;
  background-color: var(--brand-primary);
  border-radius: 0 4px 4px 0;
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  margin-right: var(--space-3);
}

.main-sidebar.is-collapsed .nav-icon {
  margin-right: 0;
}

.main-sidebar.is-collapsed .nav-item {
  justify-content: center;
  padding: 0;
}

.nav-divider {
  height: 1px;
  background-color: var(--divider);
  margin: var(--space-3) var(--space-2);
}

.action-item {
  cursor: pointer;
}

.primary-item:hover {
  color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.danger-item:hover {
  color: var(--danger);
  background-color: rgba(240, 68, 68, 0.1);
}

.sidebar-footer {
  padding: var(--space-3) var(--space-3);
  border-top: 1px solid var(--border-light);
}

.app-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background-color: var(--background, #f5f7f9);
  border: 1px solid var(--border-light, #e4e9ef);
  border-radius: var(--radius-control, 8px);
  padding: 8px 12px;
}

.version-text {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.check-update-btn {
  font-size: 11px;
  color: var(--brand-primary);
  text-align: left;
  padding: 0;
  cursor: pointer;
}

.check-update-btn:hover {
  text-decoration: underline;
}

@media (max-width: 1100px) {
  .main-sidebar {
    width: var(--sidebar-collapsed-width);
  }

  .nav-label, .sidebar-footer {
    display: none !important;
  }

  .nav-icon {
    margin-right: 0 !important;
  }

  .nav-item {
    justify-content: center !important;
    padding: 0 !important;
  }
}
</style>
