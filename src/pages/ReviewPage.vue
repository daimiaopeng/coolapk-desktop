<template>
  <div class="page-container custom-scrollbar">
    <!-- 头部区域 -->
    <div class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title">
            <i class="fas fa-flask icon"></i> 评测区
          </h2>
          <span class="page-subtitle">数码产品深度测评与体验分享</span>
        </div>

        <!-- 搜索框 -->
        <div class="search-box">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索指定测评或数码产品..."
            class="search-input"
            @keyup.enter="handleSearch"
          />
          <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 分类快捷标签栏 -->
      <div class="category-tabs">
        <button
          v-for="tab in reviewTabs"
          :key="tab.key"
          :class="['cat-tab', { active: activeTab === tab.key && !isSearching }]"
          @click="switchTab(tab.key)"
        >
          <i :class="tab.icon"></i> {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading && feeds.length === 0" class="loading-wrapper">
      <LoadingState :text="isSearching ? `正在搜索 &quot;${searchQuery}&quot; 相关测评...` : '正在加载评测动态...'" />
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error && feeds.length === 0" class="error-wrapper">
      <ErrorState title="加载评测动态失败" :message="error" @retry="loadFeeds(true)" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="feeds.length === 0" class="empty-wrapper">
      <EmptyState
        :title="isSearching ? '未找到相关评测' : '该板块暂无动态'"
        :description="isSearching ? '可尝试换个搜索关键词或在下方分类中进行筛选' : '换个板块逛逛，或稍后再来看看吧'"
      />
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
const searchQuery = ref('');
const isSearching = ref(false);
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
    let list: any[] = [];
    if (isSearching.value && searchQuery.value.trim()) {
      const res = await CoolapkTauriAPI.searchFeeds(searchQuery.value.trim(), page.value);
      list = extractList(res).filter(isValidFeed);
    } else {
      const tab = reviewTabs.find(t => t.key === activeTab.value);
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
  activeTab.value = key;
  if (isSearching.value) {
    isSearching.value = false;
    searchQuery.value = '';
  }
  loadFeeds(true);
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    isSearching.value = true;
    loadFeeds(true);
  }
}

function clearSearch() {
  searchQuery.value = '';
  isSearching.value = false;
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
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0;
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-titles {
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
  gap: var(--space-3);
}

.page-title .icon {
  color: var(--brand-primary);
}

.page-subtitle {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 280px;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 32px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  outline: none;
  transition: all var(--duration-fast);
}

.search-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.clear-btn {
  position: absolute;
  right: 10px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
}

.clear-btn:hover {
  color: var(--text-primary);
}

.category-tabs {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.cat-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cat-tab:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.cat-tab.active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

.feed-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 768px) {
  .feed-list {
    grid-template-columns: 1fr;
  }
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
