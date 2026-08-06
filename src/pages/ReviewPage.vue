<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i class="fas fa-flask icon"></i> 评测区</h2>
        <span class="page-subtitle">数码产品深度测评与体验分享</span>
      </div>

      <div class="tab-subnav">
        <button
          v-for="tab in reviewTabs"
          :key="tab.key"
          :class="['subnav-btn', { active: activeTab === tab.key }]"
          @click="switchTab(tab.key)"
        >
          <i :class="[tab.icon, 'subnav-icon']"></i>
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading && feeds.length === 0" class="loading-wrapper">
      <LoadingState text="正在加载评测动态..." />
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error && feeds.length === 0" class="error-wrapper">
      <ErrorState title="加载评测动态失败" :message="error" @retry="loadFeeds(true)" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="feeds.length === 0" class="empty-wrapper">
      <EmptyState title="该板块暂无动态" description="换个板块逛逛，或稍后再来看看吧" />
    </div>

    <!-- 动态列表 -->
    <div v-else class="feed-list-wrapper">
      <div class="feed-list">
        <FeedCard v-for="item in feeds" :key="item.id" :feed="item" />
      </div>
      <div v-if="loadingMore" class="loading-more-footer">
        <i class="fas fa-circle-notch fa-spin"></i> 正在加载更多评测...
      </div>
      <div v-else-if="noMore && feeds.length > 5" class="no-more-footer">
        已加载全部评测动态
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const reviewTabs = [
  { key: 'review', label: '数码测评', icon: 'fas fa-flask', boardTag: '#/board/数码测评' },
  { key: 'digital', label: '数码', icon: 'fas fa-microchip', boardTag: '#/board/数码' },
  { key: 'phone', label: '手机', icon: 'fas fa-mobile-alt', boardTag: '#/board/手机' },
  { key: 'computer', label: '电脑', icon: 'fas fa-laptop', boardTag: '#/board/电脑' },
  { key: 'tablet', label: '平板', icon: 'fas fa-tablet-alt', boardTag: '#/board/平板' },
  { key: 'system', label: '系统', icon: 'fas fa-cogs', boardTag: '#/board/系统' },
];

const activeTab = ref('review');
const feeds = ref<any[]>([]);
const page = ref(1);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const error = ref('');

function extractList(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.rows)) return res.rows;
  if (Array.isArray(res.data?.rows)) return res.data.rows;
  return [];
}

function isValidFeed(item: any): boolean {
  return !!(item && item.id && (item.message || item.title || item.pic || item.username));
}

async function loadFeeds(isRefresh: boolean = false) {
  if (loading.value || (loadingMore.value && !isRefresh)) return;

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
    const tab = reviewTabs.find(t => t.key === activeTab.value);
    let list: any[] = [];
    if (tab) {
      try {
        const res = await CoolapkTauriAPI.getBoardFeeds(tab.boardTag, page.value);
        list = extractList(res).filter(isValidFeed);
      } catch (e) {
        console.warn(`获取板块(${tab.label})动态失败:`, e);
      }
    }
    if (list.length === 0 && page.value === 1) {
      try {
        const fallback = await CoolapkTauriAPI.getHotFeeds(1);
        list = extractList(fallback).filter(isValidFeed);
      } catch (e) {
        console.warn('回退热榜失败:', e);
      }
    }

    if (list.length < 3) {
      noMore.value = true;
    }

    if (isRefresh) {
      feeds.value = list;
    } else {
      const existingIds = new Set(feeds.value.map((i: any) => i.id));
      const uniqueNew = list.filter((i: any) => !existingIds.has(i.id));
      feeds.value.push(...uniqueNew);
    }
    page.value++;
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

function onScrollEvent(e: Event) {
  const el = e.target as HTMLElement;
  let scrollDiff = 999;
  if (el && el.scrollHeight) {
    scrollDiff = el.scrollHeight - el.scrollTop - el.clientHeight;
  } else {
    const docEl = document.documentElement;
    scrollDiff = docEl.scrollHeight - window.scrollY - window.innerHeight;
  }

  if (scrollDiff < 260) {
    if (!loading.value && !loadingMore.value && !noMore.value) {
      loadFeeds(false);
    }
  }
}

onMounted(() => {
  loadFeeds(true);
  window.addEventListener('scroll', onScrollEvent, true);
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScrollEvent, true);
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.page-title .icon {
  color: var(--brand-primary);
}

.page-subtitle {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.tab-subnav {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.subnav-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: var(--radius-control);
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  transition: all var(--duration-fast) var(--ease-default);
}

.subnav-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.subnav-btn.active {
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  border-color: var(--brand-primary);
  font-weight: var(--font-weight-medium);
}

.subnav-icon {
  font-size: var(--font-size-caption);
}

.loading-wrapper,
.error-wrapper,
.empty-wrapper {
  padding: var(--space-10) 0;
}

.loading-more-footer,
.no-more-footer {
  padding: var(--space-4);
  text-align: center;
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}
</style>
