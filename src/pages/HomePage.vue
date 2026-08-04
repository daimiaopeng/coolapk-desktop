<template>
  <div class="home-page-layout">
    <div class="main-feed-column">
      <FeedTabs v-model:active-key="activeTab" />

      <div class="feed-scroll-container custom-scrollbar" @scroll="handleScroll">
        <div v-if="loading && feeds.length === 0" class="skeleton-padding">
          <FeedSkeleton :count="4" />
        </div>

        <div v-else-if="error && feeds.length === 0" class="error-padding">
          <ErrorState title="加载动态失败" :message="error" @retry="loadFeeds(true)" />
        </div>

        <div v-else-if="feeds.length === 0" class="empty-padding">
          <EmptyState title="暂无动态内容" />
        </div>

        <div v-else class="feed-list-padding">
          <FeedCard
            v-for="item in feeds"
            :key="item.id"
            :feed="item"
          />

          <div v-if="loadingMore" class="loading-more">
            <LoadingState text="加载更多动态..." />
          </div>
        </div>
      </div>
    </div>

    <RightSidebar />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import FeedTabs from '../components/feed/FeedTabs.vue';
import FeedCard from '../components/feed/FeedCard.vue';
import FeedSkeleton from '../components/feed/FeedSkeleton.vue';
import RightSidebar from '../components/layout/RightSidebar.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';

const route = useRoute();
const activeTab = ref('index_v8');
const page = ref(1);
const feeds = ref<any[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');

function syncTabFromRoute() {
  const path = route.path;
  switch (path) {
    case '/feeds':
      activeTab.value = 'latest';
      break;
    case '/discover':
      activeTab.value = 'digest';
      break;
    case '/apps':
      activeTab.value = 'secondhand';
      break;
    case '/games':
      activeTab.value = 'hot';
      break;
    case '/topics':
      activeTab.value = 'digest';
      break;
    case '/favorites':
      activeTab.value = 'cool_picture';
      break;
    case '/history':
      activeTab.value = 'latest';
      break;
    case '/following':
      activeTab.value = 'index_v8';
      break;
    default:
      if (!['hot', 'latest', 'digest', 'cool_picture', 'secondhand'].includes(activeTab.value)) {
        activeTab.value = 'index_v8';
      }
      break;
  }
}

async function loadFeeds(isRefresh: boolean = false) {
  if (isRefresh) {
    page.value = 1;
    feeds.value = [];
    loading.value = true;
  } else {
    loadingMore.value = true;
  }
  error.value = '';

  try {
    let res: any;
    const p = page.value;

    switch (activeTab.value) {
      case 'hot':
        res = await CoolapkTauriAPI.getHotFeeds(p);
        break;
      case 'latest':
        res = await CoolapkTauriAPI.getLatestFeeds(p);
        break;
      case 'digest':
        res = await CoolapkTauriAPI.getDigestFeeds(p);
        break;
      case 'cool_picture':
        res = await CoolapkTauriAPI.getCoolPictureRank(p);
        break;
      case 'secondhand':
        res = await CoolapkTauriAPI.getSecondHandFeeds(p);
        break;
      default:
        res = await CoolapkTauriAPI.getIndexV8Feeds(p);
        break;
    }

    if (res && res.data && Array.isArray(res.data)) {
      const validItems = res.data.filter((item: any) => item.id && (item.message || item.title || item.pic));
      if (isRefresh) {
        feeds.value = validItems;
      } else {
        feeds.value.push(...validItems);
      }
    }
  } catch (err: any) {
    error.value = err.message || '网络连接失败';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

watch(
  () => route.path,
  () => {
    syncTabFromRoute();
    loadFeeds(true);
  }
);

watch(activeTab, () => {
  loadFeeds(true);
});

function handleScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
    if (!loading.value && !loadingMore.value) {
      page.value++;
      loadFeeds(false);
    }
  }
}

onMounted(() => {
  syncTabFromRoute();
  loadFeeds(true);
});
</script>

<style scoped>
.home-page-layout {
  container-type: inline-size;
  container-name: layout;
  display: flex;
  width: 100%;
  height: 100%;
  gap: var(--space-4);
  padding: var(--space-4);
  box-sizing: border-box;
  overflow: hidden;
}

@container layout (max-width: 960px) {
  :deep(.right-sidebar) {
    display: none !important;
  }
}

.main-feed-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  overflow: hidden;
}

.feed-scroll-container {
  flex: 1;
  overflow-y: auto;
}

.skeleton-padding, .error-padding, .empty-padding, .feed-list-padding {
  padding: var(--space-4);
}

.loading-more {
  padding: var(--space-4) 0;
}
</style>
