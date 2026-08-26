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

        <router-link
          v-if="moreVisible"
          to="/more"
          class="nav-item"
          :class="{ 'is-active': isMoreActive }"
          title="更多服务与专区"
        >
          <i class="fas fa-shapes nav-icon"></i>
          <span v-if="!isCollapsed" class="nav-label">更多</span>
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
          :title="getNavTitle(item)"
        >
          <i :class="[item.icon, 'nav-icon']"></i>
          <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
          <span
            v-if="getNavBadge(item.key) > 0"
            :class="['nav-badge', { 'is-wide': getNavBadge(item.key) > 9 }]"
          >
            {{ getNavBadge(item.key) > 99 ? '99+' : getNavBadge(item.key) }}
          </span>
        </router-link>
      </div>

      <router-link
        v-if="myVisible"
        to="/my"
        class="nav-item"
        :class="{ 'is-active': isMyActive }"
        active-class="is-active"
        title="我的"
      >
        <i class="fas fa-user nav-icon"></i>
        <span v-if="!isCollapsed" class="nav-label">我的</span>
      </router-link>

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
      <div class="app-info-card">
        <div class="app-info-left">
          <span class="app-name">酷安桌面版</span>
          <span class="version-badge">v{{ appVersion }}</span>
        </div>
        <button class="check-update-btn" title="检查更新" @click="requestUpdateCheck">
          <i class="fas fa-sync-alt update-icon"></i>
          <span>更新</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsStore } from '../../stores/settings';
import { useAuthStore } from '../../stores/auth';
import { useNotificationStore } from '../../stores/notifications';
import { APP_VERSION } from '../../constants/version';

const route = useRoute();
const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const appVersion = APP_VERSION;

function requestUpdateCheck() {
  window.dispatchEvent(new Event('check-for-update'));
}

const isCollapsed = computed(() => settingsStore.settings.sidebarCollapsed);

const isDark = computed(() => {
  return settingsStore.settings.theme === 'dark';
});

// 主侧边栏精简保留核心主干
const allPrimaryNavs = [
  { key: 'home', path: '/', label: '首页', icon: 'fas fa-home' },
  { key: 'digital', path: '/digital', label: '数码', icon: 'fas fa-microchip' },
  { key: 'discover', path: '/discover', label: '发现', icon: 'fas fa-compass' },
  { key: 'topics', path: '/topics', label: '话题', icon: 'fas fa-hashtag' },
  { key: 'pictures', path: '/pictures', label: '酷图', icon: 'far fa-images' },
  { key: 'apps', path: '/apps', label: '应用', icon: 'fas fa-cubes' },
];

const allSecondaryNavs = [
  { key: 'notifications', path: '/notifications', label: '通知', icon: 'far fa-bell' },
  { key: 'messages', path: '/messages', label: '消息', icon: 'far fa-comment-alt' },
  { key: 'history', path: '/history', label: '历史', icon: 'far fa-clock' },
  { key: 'favorites', path: '/favorites', label: '收藏', icon: 'far fa-bookmark' },
  { key: 'following', path: '/following', label: '我关注的', icon: 'fas fa-user-group' },
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

// 属于“更多专区”的下属路由集合
const moreSubPaths = [
  '/more',
  '/my-products',
  '/goods',
  '/center',
  '/albums',
  '/pictures',
  '/secondhand',
  '/reviews',
  '/digital',
  '/digital-library',
  '/games',
  '/events',
  '/event',
  '/anylist',
  '/my-dyh',
  '/product-compare',
  '/product-selector',
  '/headline',
  '/blacklist',
];

// 当处于 /more 或下属未在侧边栏独立展示的专区时，“更多”保持高亮
const isMoreActive = computed(() => {
  const currentPath = route.path;
  if (currentPath === '/more') return true;

  const currentVisiblePaths = [
    ...primaryNavs.value.map((n) => n.path),
    ...secondaryNavs.value.map((n) => n.path),
  ];

  // 如果当前路由已经在主侧边栏独立显示，则不重复高亮“更多”
  if (currentVisiblePaths.some((p) => p === currentPath || (p !== '/' && currentPath.startsWith(p)))) {
    return false;
  }

  // 属于更多子路由集合时高亮
  return moreSubPaths.some((sub) => currentPath === sub || (sub !== '/' && currentPath.startsWith(sub)));
});

const isMyActive = computed(() => {
  const currentPath = route.path;
  return currentPath === '/my'
    || currentPath === '/my-likes'
    || currentPath === '/followed-nodes'
    || currentPath === '/followed-topics'
    || currentPath === '/recent-contacts'
    || currentPath === '/recycle-bin'
    || currentPath === '/hidden-replies'
    || currentPath === '/my-devices'
    || currentPath === '/my-albums'
    || currentPath === '/my-votes';
});

const moreVisible = computed(() => settingsStore.settings.navVisibility?.more !== false);
const myVisible = computed(() => settingsStore.settings.navVisibility?.my !== false);
function getNavBadge(key: string): number {
  if (key === 'notifications') return notificationStore.notificationCount;
  if (key === 'messages') return notificationStore.messageCount;
  return 0;
}

function getNavTitle(item: { key: string; label: string }): string {
  const count = getNavBadge(item.key);
  return count > 0 ? `${item.label}（${count} 条未读）` : item.label;
}

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

.nav-badge {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0;
  border-radius: 50%;
  background-color: var(--danger);
  color: #ffffff;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  line-height: 20px;
  text-align: center;
}

.nav-badge.is-wide {
  flex-basis: auto;
  width: auto;
  min-width: 20px;
  padding: 0 5px;
  border-radius: var(--radius-full);
}

.main-sidebar.is-collapsed .nav-badge {
  position: absolute;
  top: 4px;
  right: 5px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  line-height: 14px;
  border-radius: 50%;
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

.nav-more-container {
  position: relative;
}

.more-toggle-item {
  cursor: pointer;
}

.more-chevron {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-tertiary);
}

.more-inline-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.nav-sub-item {
  height: 36px;
  padding-left: calc(var(--space-4) + 20px + var(--space-3));
  font-size: var(--font-size-caption);
}

.nav-sub-item .nav-icon {
  font-size: 13px;
}

.more-popover {
  position: absolute;
  left: calc(100% + var(--space-3));
  top: 0;
  width: 190px;
  padding: var(--space-2);
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-lg);
  z-index: 120;
}

.more-popover-title {
  padding: var(--space-2) var(--space-3);
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.more-popover-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 36px;
  padding: 0 var(--space-3);
  color: var(--text-secondary);
  border-radius: var(--radius-control);
  text-decoration: none;
  font-size: var(--font-size-sub);
}

.more-popover-item:hover,
.more-popover-item.router-link-active {
  color: var(--brand-primary);
  background: var(--brand-soft);
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
  padding: 6px 8px;
  border-top: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
}

.app-info-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  background-color: var(--surface-elevated, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--border-light, #e4e9ef);
  border-radius: var(--radius-control, 8px);
  padding: 5px 8px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
  overflow: hidden;
}

.app-info-card:hover {
  border-color: var(--border, rgba(0, 0, 0, 0.12));
}

.app-info-left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex-shrink: 1;
}

.app-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

.version-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  background-color: var(--bg-hover, rgba(0, 0, 0, 0.04));
  padding: 1px 3px;
  border-radius: 4px;
  line-height: 1.2;
  white-space: nowrap;
}

.check-update-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 500;
  color: var(--brand-primary);
  background-color: var(--brand-soft, rgba(16, 185, 129, 0.1));
  border: none;
  border-radius: 5px;
  padding: 3px 6px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease;
  line-height: 1;
}

.check-update-btn .update-icon {
  font-size: 10px;
  transition: transform 0.3s ease;
}

.check-update-btn:hover {
  color: #fff;
  background-color: var(--brand-primary);
}

.check-update-btn:hover .update-icon {
  transform: rotate(180deg);
}

.check-update-btn:active {
  transform: scale(0.96);
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

  .nav-badge {
    position: absolute;
    top: 4px;
    right: 5px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    line-height: 14px;
  }
}
</style>
