<template>
  <header class="mobile-top-bar">
    <button
      v-if="route.path !== '/'"
      type="button"
      class="mobile-icon-button"
      aria-label="返回"
      @click="goBack"
    >
      <i class="fas fa-arrow-left"></i>
    </button>
    <div v-else class="mobile-brand" aria-label="酷安首页">
      <img src="../../assets/coolapk-logo-rounded.png" alt="" />
    </div>

    <strong class="mobile-page-title">{{ pageTitle }}</strong>

    <div class="mobile-top-actions">
      <button type="button" class="mobile-icon-button" aria-label="搜索" @click="appStore.openSearch">
        <i class="fas fa-magnifying-glass"></i>
      </button>
      <button type="button" class="mobile-icon-button has-badge" aria-label="通知" @click="router.push('/notifications')">
        <i class="fas fa-bell"></i>
        <span v-if="notificationStore.notificationCount" class="mobile-badge">
          {{ notificationStore.notificationCount > 99 ? '99+' : notificationStore.notificationCount }}
        </span>
      </button>
      <button
        v-if="!route.path.startsWith('/settings')"
        type="button"
        class="mobile-icon-button"
        aria-label="设置"
        @click="router.push('/settings')"
      >
        <i class="fas fa-gear"></i>
      </button>
      <button
        type="button"
        class="mobile-icon-button"
        :aria-label="navigationOpen ? '关闭快捷入口' : '打开快捷入口'"
        :aria-expanded="navigationOpen"
        @click="emit('toggleNavigation')"
      >
        <i :class="navigationOpen ? 'fas fa-xmark' : 'fas fa-grip'"></i>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { useNotificationStore } from '../../stores/notifications';

defineProps<{ navigationOpen: boolean }>();
const emit = defineEmits<{ toggleNavigation: [] }>();

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const notificationStore = useNotificationStore();

const routeTitles: Record<string, string> = {
  '/': '酷安',
  '/apps': '应用',
  '/discover': '发现',
  '/topics': '话题',
  '/notifications': '通知',
  '/messages': '私信',
  '/more': '我的',
  '/my': '我的',
  '/settings': '设置',
};

const pageTitle = computed(() => {
  const exact = routeTitles[route.path];
  if (exact) return exact;
  const prefix = Object.keys(routeTitles)
    .filter((path) => path !== '/' && route.path.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? routeTitles[prefix] : String(route.meta.title || '酷安');
});

function goBack() {
  if (window.history.length > 1) router.back();
  else void router.push('/');
}
</script>

<style scoped>
.mobile-top-bar {
  display: none;
}

@media (max-width: 720px) {
  .mobile-top-bar {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 10px;
    min-height: var(--mobile-topbar-height);
    padding: env(safe-area-inset-top) 10px 0;
    border-bottom: 1px solid var(--border-light);
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    backdrop-filter: blur(14px);
    z-index: 30;
  }

  .mobile-brand,
  .mobile-icon-button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
  }

  .mobile-brand img {
    width: 28px;
    height: 28px;
    border-radius: 8px;
  }

  .mobile-icon-button {
    position: relative;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-size: 17px;
  }

  .mobile-icon-button:active {
    background: var(--surface-hover);
  }

  .mobile-page-title {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    color: var(--text-primary);
    font-size: 17px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-top-actions {
    display: flex;
    align-items: center;
  }

  .mobile-badge {
    position: absolute;
    top: 2px;
    right: 0;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border: 2px solid var(--surface);
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    line-height: 12px;
  }
}
</style>
