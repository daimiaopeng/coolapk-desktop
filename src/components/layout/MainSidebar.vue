<template>
  <aside :class="['main-sidebar', { 'is-collapsed': isCollapsed }]">
    <!-- 侧边栏折叠/展开控制按钮 (带标题与精致图标) -->
    <div class="collapse-header">
      <span v-if="!isCollapsed" class="collapse-header-title">菜单</span>
      <button
        class="collapse-toggle-btn"
        :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="settingsStore.toggleSidebar"
      >
        <svg class="sidebar-panel-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <path v-if="isCollapsed" d="M13 12l3-3m0 0l-3-3m3 3H12" />
          <path v-else d="M15 12l-3-3m0 0l3-3m-3 3h4" />
        </svg>
      </button>
    </div>

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

const primaryNavs = [
  { path: '/', label: '首页', icon: 'fas fa-home' },
  { path: '/feeds', label: '动态', icon: 'fas fa-stream' },
  { path: '/discover', label: '发现', icon: 'fas fa-compass' },
  { path: '/apps', label: '应用', icon: 'fas fa-cubes' },
  { path: '/games', label: '游戏', icon: 'fas fa-gamepad' },
  { path: '/topics', label: '话题', icon: 'fas fa-hashtag' },
];

const secondaryNavs = [
  { path: '/favorites', label: '收藏', icon: 'far fa-bookmark' },
  { path: '/history', label: '历史', icon: 'far fa-clock' },
  { path: '/messages', label: '消息', icon: 'far fa-comment-alt' },
  { path: '/following', label: '我关注的', icon: 'far fa-user' },
];

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
  width: var(--sidebar-width);
  background-color: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: width var(--duration-normal) var(--ease-default);
}

.main-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
}

.collapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  height: 40px;
  box-sizing: border-box;
}

.collapse-header-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-bold);
  color: var(--text-tertiary);
  letter-spacing: 0.5px;
}

.main-sidebar.is-collapsed .collapse-header {
  justify-content: center;
  padding: var(--space-3) 0;
}

.collapse-toggle-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm, 6px);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--background, #f5f7f9);
  border: 1px solid var(--border, #e4e9ef);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.collapse-toggle-btn:hover {
  background-color: var(--surface-hover);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  transform: scale(1.06);
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
  padding: var(--space-4);
  border-top: 1px solid var(--border-light);
}

.app-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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
