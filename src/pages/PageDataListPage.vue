<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div v-if="!isDynamicPage" class="page-header page-data-header">
      <div class="header-titles">
        <h2 class="page-title"><i class="fas fa-list-ul icon"></i>{{ pageTitle }}</h2>
      </div>
    </div>

    <template v-if="isDynamicPage">
      <div v-if="loading && dynamicItems.length === 0" class="state-wrapper">
        <FeedSkeleton :count="4" />
      </div>
      <div v-else-if="error && dynamicItems.length === 0" class="state-wrapper">
        <ErrorState title="加载页面内容失败" :message="error" @retry="loadCurrentPage(true)" />
      </div>
      <div v-else-if="dynamicItems.length === 0" class="state-wrapper">
        <EmptyState title="暂无内容" />
      </div>
      <div v-else class="feed-list discovery-page-list">
        <DiscoveryEntityCard v-for="(item, index) in dynamicItems" :key="getEntityKey(item, index)" :entity="item" @open="openEntity" />
        <div v-if="loadingMore" class="loading-more"><LoadingState text="加载更多..." /></div>
      </div>
    </template>
    <template v-else>
      <div v-if="loading && feeds.length === 0" class="state-wrapper">
        <FeedSkeleton :count="4" />
      </div>
      <div v-else-if="error && feeds.length === 0" class="state-wrapper">
        <ErrorState title="加载页面内容失败" :message="error" @retry="loadFeeds(true)" />
      </div>
      <div v-else-if="feeds.length === 0" class="state-wrapper">
        <EmptyState title="暂无内容" />
      </div>
      <div v-else class="feed-list">
        <FeedCard
          v-for="(item, index) in feeds"
          :key="item.id || index"
          :feed="item"
          @deleted="handleFeedDeleted"
        />
        <div v-if="loadingMore" class="loading-more"><LoadingState text="加载更多..." /></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import DiscoveryEntityCard from '../components/discovery/DiscoveryEntityCard.vue';
import FeedCard from '../components/feed/FeedCard.vue';
import FeedSkeleton from '../components/feed/FeedSkeleton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useSettingsStore } from '../stores/settings';
import { hasFeedRenderableContent, shouldHideFeed } from '../utils/feedFilter';
import { decodeDiscoveryRouteSegment, getEntityKey, parseDiscoveryPage, resolveDiscoveryRoute } from '../utils/discovery';
import type { DiscoveryEntity } from '../types/discovery';

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const pageUrl = computed(() => typeof route.query.url === 'string' ? route.query.url : '');
const pageTitle = computed(() => typeof route.query.title === 'string' && route.query.title.trim()
  ? route.query.title
  : '酷安内容');

const page = ref(1);
const feeds = ref<any[]>([]);
const dynamicItems = ref<DiscoveryEntity[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const dynamicNoMore = ref(false);
const dynamicFirstItem = ref('');
const dynamicLastItem = ref('');
const error = ref('');

function extractServerPageTarget(value: string): string {
  const raw = value.trim().replace(/^#/, '');
  const queryIndex = raw.indexOf('?');
  if (queryIndex < 0 || raw.slice(0, queryIndex).toLowerCase() !== '/page') return '';
  return new URLSearchParams(raw.slice(queryIndex + 1)).get('url')?.trim() || '';
}

const dynamicPageTarget = computed(() => extractServerPageTarget(pageUrl.value) || (route.query.renderer === 'discovery' ? pageUrl.value.trim() : ''));
const isDynamicPage = computed(() => Boolean(dynamicPageTarget.value) && (route.query.renderer === 'discovery' || Boolean(extractServerPageTarget(pageUrl.value))));

function extractList(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function handleFeedDeleted(id: string | number) {
  feeds.value = feeds.value.filter((feed) => String(feed.id) !== String(id));
}

async function loadFeeds(isRefresh = false) {
  if (!pageUrl.value || loading.value || (loadingMore.value && !isRefresh)) return;
  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    feeds.value = [];
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  error.value = '';

  try {
    const response = await CoolapkTauriAPI.getBoardFeeds(pageUrl.value, page.value);
    const nextFeeds = extractList(response)
      .filter((item) => hasFeedRenderableContent(item) && !shouldHideFeed(item, settingsStore.settings));
    if (nextFeeds.length < 3) noMore.value = true;

    if (isRefresh) {
      feeds.value = nextFeeds;
    } else {
      const existingIds = new Set(feeds.value.map((item) => item.id));
      feeds.value.push(...nextFeeds.filter((item) => !existingIds.has(item.id)));
    }
    page.value += 1;
  } catch (loadError: any) {
    error.value = loadError?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadDynamicPage(isRefresh = false) {
  if (!dynamicPageTarget.value || loading.value || (loadingMore.value && !isRefresh)) return;
  if (!isRefresh && dynamicNoMore.value) return;
  if (isRefresh) {
    page.value = 1;
    dynamicNoMore.value = false;
    dynamicFirstItem.value = '';
    dynamicLastItem.value = '';
    dynamicItems.value = [];
    loading.value = true;
  } else {
    loadingMore.value = true;
  }
  error.value = '';

  try {
    const response = await CoolapkTauriAPI.getDiscoveryPageData({ url: dynamicPageTarget.value, title: pageTitle.value, page: page.value, firstItem: dynamicFirstItem.value, lastItem: dynamicLastItem.value, pageContext: JSON.stringify({ source: 'desktop-page-data-list', url: dynamicPageTarget.value }) });
    const parsed = parseDiscoveryPage(response, page.value);
    const incoming = parsed.items;
    dynamicFirstItem.value = parsed.firstItem;
    dynamicLastItem.value = parsed.lastItem;
    dynamicNoMore.value = incoming.length === 0 || !parsed.hasMore;
    if (isRefresh) {
      dynamicItems.value = incoming;
    } else {
      const existingKeys = new Set(dynamicItems.value.map((item, index) => getEntityKey(item, index)));
      dynamicItems.value = [...dynamicItems.value, ...incoming.filter((item, index) => !existingKeys.has(getEntityKey(item, dynamicItems.value.length + index)))];
    }
    page.value += 1;
  } catch (loadError: any) {
    error.value = loadError?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function loadCurrentPage(isRefresh = false) {
  if (isDynamicPage.value) void loadDynamicPage(isRefresh);
  else void loadFeeds(isRefresh);
}

function handleScroll(event: Event) {
  if (!isDynamicPage.value) return;
  const element = event.currentTarget as HTMLElement;
  if (element.scrollHeight - element.scrollTop - element.clientHeight < 480) void loadDynamicPage(false);
}

function navigateDataList(target: string, title: string) {
  void router.push({ path: '/page', query: { url: target, title, renderer: 'discovery' } });
}

function navigateNative(target: string, title: string) {
  const clean = target.replace(/^#/, '');
  const user = clean.match(/^\/user\/([^/?#]+)/);
  const feed = clean.match(/^\/feed\/([^/?#]+)/);
  const app = clean.match(/^\/apk\/([^/?#]+)/);
  const product = clean.match(/^\/product\/([^/?#]+)/);
  const topic = clean.match(/^\/topic\/([^/?#]+)/);
  const dyh = clean.match(/^\/dyh\/([^/?#]+)/);
  const live = clean.match(/^\/live\/([^/?#]+)/);
  if (user) void router.push(`/user/${user[1]}`);
  else if (feed) void router.push(`/feed/${feed[1]}`);
  else if (app) void router.push(`/app/${encodeURIComponent(decodeDiscoveryRouteSegment(app[1]))}`);
  else if (product) void router.push(`/product/${product[1]}`);
  else if (topic) void router.push(`/topic/${encodeURIComponent(decodeDiscoveryRouteSegment(topic[1]))}`);
  else if (dyh) void router.push(`/dyh/${dyh[1]}`);
  else if (live && !/^detail$/i.test(live[1])) void router.push(`/live/${live[1]}`);
  else navigateDataList(target, title);
}

function openEntity(entity: DiscoveryEntity) {
  const routeInfo = resolveDiscoveryRoute(entity);
  if (!routeInfo) return;
  if (routeInfo.kind === 'web') void CoolapkTauriAPI.openUrl(routeInfo.target, 'internal');
  else if (routeInfo.kind === 'native') navigateNative(routeInfo.target, routeInfo.title || String(entity.title || ''));
  else navigateDataList(routeInfo.target, routeInfo.title || String(entity.title || ''));
}

watch([pageUrl, dynamicPageTarget, isDynamicPage], () => { loadCurrentPage(true); });
onMounted(() => { loadCurrentPage(true); });
</script>

<style scoped>
.page-container { width: 100%; max-width: 100%; flex: 1 1 auto; min-width: 0; height: 100%; min-height: 0; box-sizing: border-box; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; }
.page-data-header { display: flex; align-items: center; padding-bottom: 18px; }
.loading-more { padding: 16px; text-align: center; }
</style>
