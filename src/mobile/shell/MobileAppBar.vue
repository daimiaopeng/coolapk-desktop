<template>
  <header v-if="!hideForCustomPage || showOfficialTopbar" class="mobile-app-bar" :data-mobile-top-route="route.path">
    <template v-if="showOfficialTopbar">
      <button type="button" class="mobile-icon-button mobile-personal-button" aria-label="个人主页" @click="openPersonalPage">
        <i class="fas fa-user-circle" aria-hidden="true"></i>
      </button>

      <button type="button" class="mobile-search-pill" :aria-label="primarySearchLabel" @click="openPrimarySearch">
        <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
        <span>{{ primarySearchLabel }}</span>
      </button>

      <div class="mobile-app-actions" aria-label="快捷入口">
        <button type="button" class="mobile-icon-button mobile-app-button" aria-label="应用游戏" @click="openApps">
          <span class="mobile-app-glyph" aria-hidden="true">APP</span>
        </button>
        <button type="button" class="mobile-icon-button has-badge" :aria-label="messageLabel" @click="openMessageCenter">
          <i :class="messageIcon" aria-hidden="true"></i>
          <span v-if="notificationStore.notificationCount" class="mobile-badge">
            {{ notificationStore.notificationCount > 99 ? '99+' : notificationStore.notificationCount }}
          </span>
        </button>
        <button type="button" class="mobile-icon-button mobile-more-button" :aria-label="moreLabel" @click="openMore">
          <i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>
        </button>
      </div>
    </template>

    <template v-else>
      <button
        v-if="showBackButton"
        type="button"
        class="mobile-icon-button"
        aria-label="返回"
        @click="goBack"
      >
        <i class="fas fa-arrow-left"></i>
      </button>
      <div v-else class="mobile-brand" aria-label="酷安">
        <img src="../../assets/coolapk-logo-rounded.png" alt="" />
      </div>

      <button v-if="showChannelSearch" type="button" class="mobile-search-pill" @click="appStore.openSearch">
        <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
        <span>{{ searchPlaceholder }}</span>
      </button>
      <strong v-else class="mobile-page-title">{{ pageTitle }}</strong>

      <div class="mobile-app-actions">
        <button v-if="!showChannelSearch" type="button" class="mobile-icon-button" aria-label="搜索" @click="appStore.openSearch">
          <i class="fas fa-magnifying-glass"></i>
        </button>
        <button v-else type="button" class="mobile-icon-button" aria-label="应用" @click="router.push('/apps')">
          <i class="fas fa-box"></i>
        </button>
        <button v-if="showChannelSearch" type="button" class="mobile-icon-button has-badge" aria-label="私信" @click="router.push('/messages')">
          <i class="fas fa-envelope"></i>
          <span v-if="notificationStore.notificationCount" class="mobile-badge">
            {{ notificationStore.notificationCount > 99 ? '99+' : notificationStore.notificationCount }}
          </span>
        </button>
        <button v-else type="button" class="mobile-icon-button has-badge" aria-label="通知" @click="router.push('/notifications')">
          <i class="fas fa-bell"></i>
          <span v-if="notificationStore.notificationCount" class="mobile-badge">
            {{ notificationStore.notificationCount > 99 ? '99+' : notificationStore.notificationCount }}
          </span>
        </button>
      </div>
    </template>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { useNotificationStore } from '../../stores/notifications';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const notificationStore = useNotificationStore();

const showOfficialTopbar = computed(() => route.path === '/' || route.path === '/discover');
const hideForCustomPage = computed(() => (
  route.path === '/my'
  || route.path === '/more'
  || route.path === '/digital'
  || route.path === '/search'
  || route.path === '/downloads'
  || /^\/(feed|question|live)\//.test(route.path)
  || /^\/settings(?:\/|$)/.test(route.path)
  || /^\/(?:product-selector|messages|notifications|user|app|product|apps|games|goods|secondhand|my-products|product-compare|favorites|history|albums|album|pictures|my-albums|my-likes|following|blacklist|followed-nodes|followed-topics|recent-contacts|recycle-bin|hidden-replies|my-devices|my-votes|topics|topic|node|dyh|headline|page|events|event|reviews|anylist|my-dyh|center|external|auth_callback)(?:\/|$)/.test(route.path)
  || /^\/goods\/(?:lists|ranking)(?:\/|$)/.test(route.path)
  || /^\/secondhand\/(?:brands|list)(?:\/|$)/.test(route.path)
  || /^\/digital-library(?:\/|$)/.test(route.path)
  || /^\/collection\//.test(route.path)
));
const showChannelSearch = computed(() => route.path === '/' || route.path === '/discover');
const showBackButton = computed(() => !showChannelSearch.value && route.path !== '/');
const searchPlaceholder = computed(() => route.path === '/discover' ? '选机中心' : '酷安优惠券');
const primarySearchLabel = computed(() => route.path === '/digital' ? '选机中心' : '搜索酷安内容');
const messageLabel = computed(() => route.path === '/' ? '消息' : '通知');
const messageIcon = computed(() => route.path === '/' ? 'fas fa-envelope' : 'fas fa-bell');
const moreLabel = computed(() => route.path === '/' ? '频道与更多' : '更多服务');

const routeTitles: Record<string, string> = {
  '/': '酷安',
  '/apps': '应用',
  '/digital': '数码',
  '/games': '游戏',
  '/discover': '发现',
  '/topics': '话题',
  '/following': '关注',
  '/notifications': '通知',
  '/messages': '私信',
  '/more': '更多服务',
  '/my': '我的',
  '/settings': '设置',
  '/search': '搜索',
  '/downloads': '下载',
  '/favorites': '收藏',
  '/history': '历史',
  '/albums': '相册',
  '/pictures': '酷图',
  '/goods': '好物',
  '/secondhand': '闲置',
  '/reviews': '点评',
  '/events': '活动',
  '/app': '应用详情',
  '/product': '产品详情',
  '/product-compare': '产品对比',
  '/topic': '话题',
  '/node': '论坛',
  '/user': '用户',
  '/event': '活动详情',
  '/question': '问题详情',
  '/live': '直播详情',
};

const pageTitle = computed(() => {
  const exact = routeTitles[route.path];
  if (exact) return exact;
  const prefix = Object.keys(routeTitles)
    .filter((path) => path !== '/' && route.path.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? routeTitles[prefix] : String(route.meta.title || '酷安');
});

function openPersonalPage() {
  void router.push('/my');
}

function openPrimarySearch() {
  if (route.path === '/digital') void router.push('/product-selector');
  else appStore.openSearch();
}

function openApps() {
  void router.push('/apps');
}

function openMessageCenter() {
  void router.push(route.path === '/' ? '/messages' : '/notifications');
}

function openMore() {
  void router.push('/more');
}

function goBack() {
  if (window.history.length > 1) router.back();
  else void router.push('/');
}
</script>

<style scoped>
.mobile-app-bar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  min-height: calc(var(--mobile-topbar-height) + env(safe-area-inset-top, 0px));
  padding: env(safe-area-inset-top, 0px) 10px 0;
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

.mobile-personal-button {
  color: var(--text-secondary, #666);
  font-size: 22px;
}

.mobile-app-glyph {
  display: grid;
  place-items: center;
  width: 28px;
  height: 24px;
  border: 2px solid currentColor;
  border-radius: 5px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1;
}

.mobile-more-button {
  font-size: 20px;
}

.mobile-icon-button {
  position: relative;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 17px;
  -webkit-tap-highlight-color: transparent;
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

.mobile-search-pill {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 0;
  min-height: 40px;
  gap: 8px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--background-secondary, #f2f2f6);
  color: var(--text-tertiary, rgba(0, 0, 0, 0.54));
  font: inherit;
  font-size: 13px;
  text-align: left;
  touch-action: manipulation;
}

.mobile-search-pill i {
  flex: 0 0 auto;
  font-size: 13px;
}

.mobile-search-pill span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-app-actions {
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

/* The digital page used to own a duplicate copy of this official top bar. */
:global(.mobile-digital-page > .mobile-digital-header) {
  display: none;
}
</style>
