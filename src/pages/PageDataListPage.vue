<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="page-header page-data-header">
      <div class="header-titles">
        <h2 class="page-title"><i class="fas fa-list-ul icon"></i>{{ pageTitle }}</h2>
        <span class="page-subtitle">酷安服务端页面动态</span>
      </div>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import FeedSkeleton from '../components/feed/FeedSkeleton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useSettingsStore } from '../stores/settings';
import { hasFeedRenderableContent, shouldHideFeed } from '../utils/feedFilter';

const route = useRoute();
const settingsStore = useSettingsStore();
const pageUrl = computed(() => typeof route.query.url === 'string' ? route.query.url : '');
const pageTitle = computed(() => typeof route.query.title === 'string' && route.query.title.trim()
  ? route.query.title
  : '酷安内容');

const page = ref(1);
const feeds = ref<any[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const error = ref('');

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

function handleScroll(event: Event) {
  const element = event.currentTarget as HTMLElement;
  if (element.scrollHeight - element.scrollTop - element.clientHeight < 500) {
    void loadFeeds(false);
  }
}

watch(pageUrl, () => { void loadFeeds(true); });
onMounted(() => { void loadFeeds(true); });
</script>

<style scoped>
.page-data-header { display: flex; align-items: center; padding-bottom: 18px; }
.loading-more { padding: 16px; text-align: center; }
</style>
