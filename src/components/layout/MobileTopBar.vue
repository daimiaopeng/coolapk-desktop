<template>
  <header class="mobile-top-bar" :class="{ 'is-macos': macOverlay }">
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

defineProps<{ navigationOpen: boolean; macOverlay: boolean }>();
const emit = defineEmits<{ toggleNavigation: [] }>();

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const notificationStore = useNotificationStore();

const routeTitles: Record<string, string> = {
  '/': '酷安',
  '/auth_callback': '登录验证',
  '/digital': '数码',
  '/apps': '应用',
  '/discover': '发现',
  '/games': '游戏',
  '/downloads': '下载管理',
  '/topics': '话题',
  '/favorites': '收藏',
  '/my-likes': '我的赞',
  '/followed-nodes': '我关注的论坛',
  '/followed-topics': '我关注的话题',
  '/recent-contacts': '最近联系人',
  '/recycle-bin': '内容回收站',
  '/hidden-replies': '隐藏的回复',
  '/my-devices': '我的设备',
  '/my-albums': '我的专辑',
  '/my-votes': '我的投票',
  '/history': '浏览历史',
  '/following': '我关注的',
  '/reviews': '评测',
  '/secondhand': '二手市场',
  '/secondhand/brands': '二手品牌',
  '/secondhand/list': '二手列表',
  '/events': '活动',
  '/anylist': '收藏单',
  '/my-dyh': '我的看看号',
  '/center': '酷安中心',
  '/external': '外部页面',
  '/product-selector': '选机中心',
  '/goods': '好物推荐',
  '/my-products': '我的数码',
  '/product-compare': '机型对比',
  '/search': '搜索',
  '/notifications': '通知',
  '/messages': '私信',
  '/blacklist': '黑名单',
  '/albums': '专辑',
  '/pictures': '酷图',
  '/headline': '头条',
  '/page': '内容列表',
  '/more': '更多服务',
  '/my': '我的',
  '/settings': '设置',
  '/user': '个人主页',
  '/feed': '动态详情',
  '/question': '问题详情',
  '/live': '直播详情',
  '/event': '活动详情',
  '/node': '论坛',
  '/topic': '话题详情',
  '/app': '应用详情',
  '/product': '数码详情',
  '/dyh': '看看号',
  '/album': '专辑详情',
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

  .mobile-top-bar.is-macos {
    padding-left: max(86px, env(safe-area-inset-left));
  }

  .mobile-top-bar.is-macos .mobile-brand {
    display: none;
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
