<template>
  <header class="top-bar">
    <div class="top-bar-left" :class="{ 'is-collapsed': settingsStore.settings.sidebarCollapsed }">
      <img src="../../assets/coolapk-logo-rounded.png" alt="Coolapk Logo" class="brand-logo" />
      <span v-if="!settingsStore.settings.sidebarCollapsed" class="brand-name">酷安</span>
    </div>

    <div class="top-bar-center">
      <div class="global-navigation" aria-label="页面导航">
        <AppIconButton
          icon="fas fa-arrow-left"
          title="后退"
          aria-label="后退"
          size="sm"
          :disabled="!canGoBack"
          @click="goBack"
        />
        <AppIconButton
          icon="fas fa-arrow-right"
          title="前进"
          aria-label="前进"
          size="sm"
          :disabled="!canGoForward"
          @click="goForward"
        />
        <AppIconButton
          icon="fas fa-rotate-right"
          title="刷新当前页面"
          aria-label="刷新当前页面"
          size="sm"
          @click="refreshPage"
        />
      </div>
      <div class="search-input-wrapper" @click="appStore.openSearch">
        <i class="fas fa-search search-icon"></i>
        <span class="placeholder-text">搜索应用、动态、用户、话题</span>
        <kbd class="shortcut-kbd">Ctrl K</kbd>
      </div>
    </div>

    <div class="top-bar-right">
      <AppButton variant="primary" size="sm" icon="fas fa-pen" @click="appStore.openPublish">
        发布动态
      </AppButton>

      <AppIconButton
        icon="fas fa-bell"
        title="通知"
        aria-label="通知"
        :badge="unreadNotificationCount"
        @click="navigateTo('/notifications')"
      />

      <AppIconButton
        icon="fas fa-envelope"
        title="私信"
        aria-label="私信"
        @click="navigateTo('/messages')"
      />

      <div
        class="user-profile-wrapper"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <div
          class="user-profile-trigger"
          :title="authStore.isLoggedIn ? '个人中心' : '点击登录酷安'"
          @click="handleUserClick"
        >
          <AppAvatar :src="authStore.user?.userAvatar" size="sm" />
        </div>

        <Transition name="popover-fade">
          <div
            v-if="isPopoverVisible"
            class="user-profile-popover"
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
          >
            <!-- 已登录状态浮层 -->
            <template v-if="authStore.isLoggedIn && authStore.user">
              <div class="popover-header">
                <div class="popover-user-row">
                  <AppAvatar :src="authStore.user.userAvatar" size="md" class="popover-avatar" />
                  <div class="popover-user-info">
                    <div class="popover-username-row">
                      <span class="popover-username">{{ authStore.user.username }}</span>
                      <span class="popover-level">Lv.{{ authStore.user.level || 1 }}</span>
                    </div>

                    <!-- 经验升级进度条 + 30/100 实际数字 -->
                    <div class="exp-row">
                      <div class="exp-progress-bar">
                        <div class="exp-progress-fill" :style="{ width: `${getExpPercent(authStore.user)}%` }"></div>
                      </div>
                      <span class="exp-num-text">{{ getExpCurrent(authStore.user) }}/{{ getExpMax(authStore.user) }}</span>
                    </div>

                    <!-- 签名 (取消活跃时间) -->
                    <p class="popover-bio" :title="authStore.user.bio">
                      <i class="fas fa-pen bio-icon"></i>
                      <span class="bio-text">{{ authStore.user.bio || '点击设置我的签名' }}</span>
                    </p>
                  </div>
                </div>

                <!-- 获赞 · 关注 · 粉丝 核心数据列 (关注 & 粉丝均支持定向精准跳转) -->
                <div class="popover-stats-row">
                  <div class="stat-col">
                    <span class="stat-num">{{ formatNum(authStore.user.likenum) }}</span>
                    <span class="stat-text">获赞</span>
                  </div>
                  <div class="stat-col clickable" title="查看我关注的人" @click="handleMenuClick('/following?tab=users')">
                    <span class="stat-num">{{ formatNum(authStore.user.follow) }}</span>
                    <span class="stat-text">关注</span>
                  </div>
                  <div class="stat-col clickable" title="查看我的粉丝" @click="handleMenuClick('/following?tab=fans')">
                    <span class="stat-num">{{ formatNum(authStore.user.fans) }}</span>
                    <span class="stat-text">粉丝</span>
                  </div>
                </div>
              </div>

              <div class="popover-divider"></div>

              <div class="popover-menu">
                <button class="popover-menu-item" @click="handleMenuClick('/user/me')">
                  <i class="fas fa-user-circle menu-icon"></i>
                  <span>个人主页</span>
                </button>
                <button class="popover-menu-item" @click="handleMenuClick('/favorites')">
                  <i class="far fa-bookmark menu-icon"></i>
                  <span>我的收藏</span>
                </button>
                <button class="popover-menu-item" @click="handleMenuClick('/history')">
                  <i class="far fa-clock menu-icon"></i>
                  <span>浏览历史</span>
                </button>
                <button class="popover-menu-item" @click="handleMenuClick('/settings')">
                  <i class="fas fa-cog menu-icon"></i>
                  <span>应用设置</span>
                </button>
              </div>

              <div class="popover-divider"></div>

              <div class="popover-footer">
                <button class="popover-logout-btn" @click="handleLogout">
                  <i class="fas fa-sign-out-alt"></i>
                  <span>退出当前账号</span>
                </button>
              </div>
            </template>

            <!-- 未登录状态浮层 -->
            <template v-else>
              <div class="popover-guest">
                <div class="guest-icon-box">
                  <i class="fas fa-user-shield"></i>
                </div>
                <span class="guest-title">未登录酷安账号</span>
                <span class="guest-desc">登录后即可发表动态、参与评论互动</span>
                <AppButton variant="primary" size="sm" class="guest-login-btn" @click="handleGuestLogin">
                  <i class="fas fa-sign-in-alt"></i> 登录账号
                </AppButton>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { desktopNotify } from '../../utils/desktopNotify';
import {
  canNavigateBack,
  canNavigateForward,
  navigateBack,
  navigateForward,
  reloadCurrentPage,
} from '../../utils/navigation';
import AppButton from '../common/AppButton.vue';
import AppIconButton from '../common/AppIconButton.vue';
import AppAvatar from '../common/AppAvatar.vue';

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

// 由路由器维护桌面端页面栈。
// 通过当前路由的变化触发计算，保证页面进入、替换和返回后按钮状态同步更新。
const canGoBack = computed(() => Boolean(route.fullPath && canNavigateBack(router)));
const canGoForward = computed(() => Boolean(route.fullPath && canNavigateForward(router)));

function goBack() {
  navigateBack(router);
}

function goForward() {
  navigateForward(router);
}

function refreshPage() {
  reloadCurrentPage();
}

const unreadNotificationCount = ref(0);
let notifTimer: any = null;
let lastNotifiedCount = 0;

async function fetchNotificationCount() {
  if (!authStore.isLoggedIn) {
    unreadNotificationCount.value = 0;
    return;
  }
  try {
    const res: any = await CoolapkTauriAPI.getNotificationCount();
    const data = res?.data || res || {};
    const count = Number(data?.count ?? data?.fcount ?? data ?? 0);
    const safeCount = Number.isFinite(count) && count > 0 ? count : 0;
    // 未读数增加时发送桌面通知（跳过首次加载，避免启动即打扰）
    if (
      safeCount > 0 &&
      lastNotifiedCount > 0 &&
      safeCount > lastNotifiedCount &&
      settingsStore.settings.desktopNotifications &&
      (settingsStore.settings.notifyReplies || settingsStore.settings.notifyAt || settingsStore.settings.notifyPm)
    ) {
      void desktopNotify(
        {
          title: '酷安新通知',
          body: `你有 ${safeCount} 条未读通知，点击查看详情。`,
        },
        settingsStore.settings.notificationSound
      );
    }
    lastNotifiedCount = safeCount;
    unreadNotificationCount.value = safeCount;
  } catch (e) {
    console.warn('获取通知未读数失败:', e);
  }
}

function startPolling() {
  if (notifTimer) clearInterval(notifTimer);
  if (!settingsStore.settings.desktopNotifications) {
    // 未开启桌面通知时仍按最小频率刷新角标，避免完全失去未读提示
    notifTimer = setInterval(fetchNotificationCount, 60000);
    return;
  }
  const minutes = Math.max(1, Math.min(settingsStore.settings.notificationPollInterval || 1, 60));
  notifTimer = setInterval(fetchNotificationCount, minutes * 60 * 1000);
}

onMounted(() => {
  fetchNotificationCount();
  startPolling();
});

onUnmounted(() => {
  if (notifTimer) clearInterval(notifTimer);
});

watch(
  () => authStore.isLoggedIn,
  () => fetchNotificationCount()
);

watch(
  () => settingsStore.settings.notificationPollInterval,
  () => startPolling()
);

const isPopoverVisible = ref(false);
let popoverHideTimer: any = null;

async function fetchUserDetailStats() {
  if (!authStore.isLoggedIn || !authStore.user?.uid) return;
  try {
    const res: any = await CoolapkTauriAPI.getUserSpace(String(authStore.user.uid));
    const data = res?.data || res || {};
    authStore.updateProfileStats({
      ...data,
      ...(data.userInfo || {})
    });
  } catch (e) {
    console.warn('获取用户详细统计数据失败:', e);
  }
}

function formatNum(n?: number): string {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  return String(n);
}

function getExpCurrent(u: any): number {
  if (!u) return 0;
  return Number(u.exp ?? u.experience ?? u.userExperience ?? 0);
}

function getExpMax(u: any): number {
  if (!u) return 100;
  const level = Number(u.level || 1);
  const max = Number(u.maxExp ?? u.nextLevelExperience ?? u.next_level_experience ?? 0);
  if (max > 0) return max;
  const levelMap = [0, 50, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  return levelMap[level] || (level * 100);
}

function getExpPercent(u: any): number {
  const current = getExpCurrent(u);
  const max = getExpMax(u);
  if (max <= 0) return 0;
  const pct = Math.round((current / max) * 100);
  return Math.min(100, Math.max(0, pct));
}

function handleMouseEnter() {
  if (popoverHideTimer) clearTimeout(popoverHideTimer);
  isPopoverVisible.value = true;
  void fetchUserDetailStats();
}

function handleMouseLeave() {
  if (popoverHideTimer) clearTimeout(popoverHideTimer);
  popoverHideTimer = setTimeout(() => {
    isPopoverVisible.value = false;
  }, 220);
}

function handleMenuClick(path: string) {
  isPopoverVisible.value = false;
  router.push(path);
}

function handleGuestLogin() {
  isPopoverVisible.value = false;
  authStore.openLoginModal();
}

function handleLogout() {
  isPopoverVisible.value = false;
  authStore.logout();
}

function navigateTo(path: string) {
  router.push(path);
}

function handleUserClick() {
  if (authStore.isLoggedIn) {
    router.push('/user/me');
  } else {
    authStore.openLoginModal();
  }
}
</script>

<style scoped>
.top-bar {
  height: var(--topbar-height);
  background-color: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  z-index: 800;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: var(--sidebar-width);
  flex-shrink: 0;
  transition: width var(--duration-normal) var(--ease-default);
}



.top-bar-left.is-collapsed {
  width: var(--sidebar-collapsed-width);
}

.brand-logo {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.brand-name {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--brand-primary);
  letter-spacing: -0.5px;
  white-space: nowrap;
}

.top-bar-center {
  flex: 1;
  max-width: 560px;
  margin: 0 var(--space-3);
  min-width: 120px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.global-navigation {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  padding: 2px;
  border-radius: var(--radius-control);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  height: 40px;
  background-color: var(--background);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-pill);
  padding: 0 var(--space-4);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  overflow: hidden;
}

.top-bar-right .app-button {
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
  transition: transform var(--duration-fast) var(--ease-default),
              box-shadow var(--duration-fast) var(--ease-default),
              background-color var(--duration-fast) var(--ease-default);
}

.top-bar-right .app-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(16, 185, 129, 0.38);
}

.search-input-wrapper:hover {
  border-color: var(--brand-primary);
  background-color: var(--surface);
}

.search-input-wrapper:hover .search-icon {
  color: var(--brand-primary);
  transform: scale(1.1);
}

.search-input-wrapper:hover .shortcut-kbd {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.search-icon {
  color: var(--text-tertiary);
  margin-right: var(--space-3);
  font-size: 14px;
  flex-shrink: 0;
  transition: transform var(--duration-fast), color var(--duration-fast);
}

.placeholder-text {
  flex: 1;
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shortcut-kbd {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-tertiary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--duration-fast);
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

@media (max-width: 1100px) {
  .top-bar-left {
    width: var(--sidebar-collapsed-width);
  }
  .brand-name {
    display: none !important;
  }
}

@media (max-width: 800px) {
  .shortcut-kbd {
    display: none;
  }
}

.user-profile-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.user-profile-trigger {
  cursor: pointer;
  margin-left: var(--space-2);
  transition: transform var(--duration-fast);
}

.user-profile-trigger:hover {
  transform: scale(1.06);
}

.user-profile-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 270px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-dropdown, 0 10px 30px rgba(0, 0, 0, 0.15));
  padding: 16px;
  z-index: 1000;
  cursor: default;
}

.popover-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.popover-user-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.popover-avatar {
  flex-shrink: 0;
}

.popover-user-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 4px;
}

.popover-username-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.popover-username {
  font-size: 16px;
  font-weight: 750;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover-level {
  font-size: 10px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  font-weight: 800;
  font-style: italic;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
}

.exp-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.exp-progress-bar {
  width: 68px;
  height: 4px;
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.08));
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.exp-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%);
  border-radius: 4px;
  transition: width var(--duration-normal) var(--ease-default);
}

.exp-num-text {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: Inter, system-ui, sans-serif;
  font-weight: 550;
  white-space: nowrap;
}

.popover-bio {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
  margin-bottom: 0;
}

.bio-icon {
  font-size: 10px;
  opacity: 0.7;
  flex-shrink: 0;
}

.bio-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 获赞 · 关注 · 粉丝 核心统计栏 (清爽 3 列式) */
.popover-stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px 0;
}

.stat-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: default;
}

.stat-col.clickable {
  cursor: pointer;
}

.stat-col.clickable:hover .stat-num,
.stat-col.clickable:hover .stat-text {
  color: var(--brand-primary);
}

.stat-num {
  font-size: 16px;
  font-weight: 750;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-text {
  font-size: 11px;
  color: var(--text-tertiary);
}

.popover-divider {
  height: 1px;
  background-color: var(--border-light);
  margin: 10px 0;
}

.popover-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.popover-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color var(--duration-fast), color var(--duration-fast);
  width: 100%;
}

.popover-menu-item:hover {
  background-color: var(--surface-hover);
  color: var(--brand-primary);
}

.menu-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
  color: var(--text-tertiary);
  transition: color var(--duration-fast);
}

.popover-menu-item:hover .menu-icon {
  color: var(--brand-primary);
}

.popover-footer {
  display: flex;
}

.popover-logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--danger);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  transition: background-color var(--duration-fast);
}

.popover-logout-btn:hover {
  background-color: rgba(240, 68, 68, 0.1);
}

.popover-guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 6px 0;
}

.guest-icon-box {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-bottom: 8px;
}

.guest-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.guest-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
  margin-bottom: 12px;
}

.guest-login-btn {
  width: 100%;
}

/* 浮层淡入微位移动画 */
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
