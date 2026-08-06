<template>
  <header class="top-bar">
    <div class="top-bar-left" :class="{ 'is-collapsed': settingsStore.settings.sidebarCollapsed }">
      <img src="../../assets/coolapk-logo-rounded.png" alt="Coolapk Logo" class="brand-logo" />
      <span v-if="!settingsStore.settings.sidebarCollapsed" class="brand-name">酷安</span>
    </div>

    <div class="top-bar-center">

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

      <div class="user-profile-trigger" :title="authStore.isLoggedIn ? '个人中心' : '点击登录酷安'" @click="handleUserClick">
        <AppAvatar :src="authStore.user?.userAvatar" size="sm" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppButton from '../common/AppButton.vue';
import AppIconButton from '../common/AppIconButton.vue';
import AppAvatar from '../common/AppAvatar.vue';

const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const unreadNotificationCount = ref(0);
let notifTimer: any = null;

async function fetchNotificationCount() {
  if (!authStore.isLoggedIn) {
    unreadNotificationCount.value = 0;
    return;
  }
  try {
    const res: any = await CoolapkTauriAPI.getNotificationCount();
    const data = res?.data || res || {};
    const count = Number(data?.count ?? data?.fcount ?? data ?? 0);
    unreadNotificationCount.value = Number.isFinite(count) && count > 0 ? count : 0;
  } catch (e) {
    console.warn('获取通知未读数失败:', e);
  }
}

onMounted(() => {
  fetchNotificationCount();
  notifTimer = setInterval(fetchNotificationCount, 60000);
});

onUnmounted(() => {
  if (notifTimer) clearInterval(notifTimer);
});

watch(
  () => authStore.isLoggedIn,
  () => fetchNotificationCount()
);

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
}

.search-input-wrapper {
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

.search-input-wrapper:hover {
  border-color: var(--brand-primary);
  background-color: var(--surface);
}

.search-icon {
  color: var(--text-tertiary);
  margin-right: var(--space-3);
  font-size: 14px;
  flex-shrink: 0;
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

.user-profile-trigger {
  cursor: pointer;
  margin-left: var(--space-2);
}
</style>
