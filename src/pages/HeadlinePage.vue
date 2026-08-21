<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="headline-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-item', { active: activeTab === tab.key }]"
        @click="switchTab(tab.key)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="activeTab === tab.key" class="tab-indicator"></span>
      </button>
    </div>

    <div v-if="loading && feeds.length === 0" class="state-wrapper">
      <FeedSkeleton :count="4" />
    </div>

    <div v-else-if="error && feeds.length === 0" class="state-wrapper">
      <ErrorState title="加载失败" :message="error" @retry="loadFeeds(true)" />
    </div>

    <div v-else-if="feeds.length === 0" class="state-wrapper">
      <EmptyState title="暂无内容" />
    </div>

    <div v-else class="feed-list">
      <FeedCard
        v-for="(item, idx) in feeds"
        :key="item.id || idx"
        :feed="item"
        @deleted="handleFeedDeleted"
      />

      <div v-if="loadingMore" class="loading-more">
        <LoadingState text="加载更多..." />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import FeedSkeleton from '../components/feed/FeedSkeleton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useSettingsStore } from '../stores/settings';
import { hasFeedRenderableContent, shouldHideFeed } from '../utils/feedFilter';

const settingsStore = useSettingsStore();

const activeTab = ref('headline');
const tabs = [
  { key: 'headline', label: '头条' },
  { key: 'editor', label: '编辑精选' },
  { key: 'update', label: '更新' },
];

const page = ref(1);
const feeds = ref<any[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const error = ref('');
const headlineCursor = reactive({ firstItem: '', lastItem: '' });

function getFeedEntityId(item: any): string {
  return String(item?.entityId ?? item?.entity_id ?? item?.id ?? '').trim();
}

function resetHeadlineCursor() {
  headlineCursor.firstItem = '';
  headlineCursor.lastItem = '';
}

function updateHeadlineCursor(items: any[]) {
  const ids = items.map(getFeedEntityId).filter(Boolean);
  if (!ids.length) return;
  if (!headlineCursor.firstItem) headlineCursor.firstItem = ids[0];
  headlineCursor.lastItem = ids[ids.length - 1];
}

function fetchTabApi(tab: string, p: number) {
  switch (tab) {
    case 'headline': return CoolapkTauriAPI.getIndexV8FeedsPaged({
      page: p,
      firstItem: headlineCursor.firstItem,
      lastItem: headlineCursor.lastItem,
    });
    case 'editor': return CoolapkTauriAPI.getEditorChoiceFeeds(p);
    case 'update': return CoolapkTauriAPI.getUpdateList(p);
    default: return CoolapkTauriAPI.getHeadlineFeeds(p);
  }
}

async function loadFeeds(isRefresh: boolean = false) {
  if (loading.value || (loadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    feeds.value = [];
    if (activeTab.value === 'headline') resetHeadlineCursor();
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  error.value = '';

  try {
    const res: any = await fetchTabApi(activeTab.value, page.value);
    const rawItems = res && Array.isArray(res.data) ? res.data : [];
    const validItems = rawItems.length > 0
      ? rawItems.filter((item: any) => hasFeedRenderableContent(item) && !shouldHideFeed(item, settingsStore.settings))
      : [];

    if (activeTab.value === 'headline') {
      if (rawItems.length === 0) noMore.value = true;
      else updateHeadlineCursor(rawItems);
    } else if (validItems.length < 3) {
      noMore.value = true;
    }

    page.value++;

    if (isRefresh) {
      feeds.value = validItems;
    } else {
      const existingIds = new Set(feeds.value.map(i => i.id));
      const uniqueNew = validItems.filter((i: any) => !existingIds.has(i.id));
      feeds.value.push(...uniqueNew);
    }
  } catch (err: any) {
    error.value = err?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function switchTab(key: string) {
  if (activeTab.value === key) return;
  activeTab.value = key;
  loadFeeds(true);
}

function handleScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  if (!settingsStore.settings.infiniteScroll) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 250) {
    if (!loading.value && !loadingMore.value && !noMore.value) {
      loadFeeds(false);
    }
  }
}

const onRefreshFeeds = () => {
  if (!loading.value && !loadingMore.value) loadFeeds(true);
};

function handleFeedDeleted(id: string | number) {
  feeds.value = feeds.value.filter((f: any) => String(f.id) !== String(id));
}

onMounted(() => {
  loadFeeds(true);
  window.addEventListener('refresh-feeds', onRefreshFeeds);
});

onUnmounted(() => {
  window.removeEventListener('refresh-feeds', onRefreshFeeds);
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width, 860px);
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.headline-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  margin-bottom: 14px;
  overflow-x: auto;
  flex-shrink: 0;
}

.tab-item {
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 2px;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.tab-item.active {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.tab-item:hover:not(.active) {
  color: var(--text-primary);
}

.tab-indicator {
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  background: var(--brand-primary, #10b981);
  border-radius: 2px;
}

.state-wrapper {
  padding: var(--space-5) 0;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-more {
  padding: var(--space-4) 0;
}
</style>
