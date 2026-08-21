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

        <!-- 搜索区 -->
        <div class="search-area">
          <div class="search-mode-toggle" role="group" aria-label="搜索模式">
            <button
              class="mode-btn"
              :class="{ active: searchMode === 'feed' }"
              @click="switchSearchMode('feed')"
            >
              动态
            </button>
            <button
              class="mode-btn"
              :class="{ active: searchMode === 'product' }"
              @click="switchSearchMode('product')"
            >
              产品
            </button>
          </div>
          <div class="search-box">
            <i class="fas fa-search search-icon"></i>
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="searchMode === 'product' ? '输入产品名称直达产品页...' : '搜索指定测评或数码产品...'"
              class="search-input"
              @keyup.enter="handleSearch"
            />
            <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
              <i class="fas fa-times"></i>
            </button>
          </div>
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

    <!-- 产品搜索中状态 -->
    <div v-if="searchMode === 'product' && searchingProduct" class="loading-wrapper">
      <LoadingState text="正在查找产品..." />
    </div>

    <!-- 产品搜索状态 -->
    <div v-else-if="searchMode === 'product'" class="empty-wrapper">
      <EmptyState
        v-if="productError"
        icon="fas fa-box-open"
        title="未找到该产品"
        :description="productError"
      />
      <EmptyState
        v-else
        icon="fas fa-box-open"
        title="产品直达"
        description="输入产品名称并回车，将直接跳转到产品详情页"
      />
    </div>

    <!-- 加载中状态 -->
    <div v-else-if="loading && feeds.length === 0" class="loading-wrapper">
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
        <FeedCard v-for="item in feeds" :key="item.id" :feed="item" @deleted="handleFeedDeleted" />
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
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { hasFeedRenderableContent } from '../utils/feedFilter';

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
const searchMode = ref<'feed' | 'product'>('feed');
const isSearching = ref(false);
const searchingProduct = ref(false);
const productError = ref('');
const feeds = ref<any[]>([]);

function handleFeedDeleted(id: string | number) {
  feeds.value = feeds.value.filter((f: any) => String(f.id) !== String(id));
}
const page = ref(1);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const error = ref('');

const router = useRouter();

function extractList(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.rows)) return res.rows;
  if (Array.isArray(res.data?.rows)) return res.data.rows;
  return [];
}

function isValidFeed(item: any): boolean {
  return hasFeedRenderableContent(item);
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
  if (isSearching.value || searchMode.value === 'product') {
    isSearching.value = false;
    searchMode.value = 'feed';
    productError.value = '';
    searchQuery.value = '';
  }
  loadFeeds(true);
}

function switchSearchMode(mode: 'feed' | 'product') {
  if (searchMode.value === mode) return;
  searchMode.value = mode;
  productError.value = '';
  if (mode === 'feed') {
    isSearching.value = false;
    loadFeeds(true);
  }
}

async function searchProduct(name: string) {
  searchingProduct.value = true;
  productError.value = '';
  const notFoundMsg = `未找到“${name}”相关产品，可尝试更换关键词`;
  try {
    const res: any = await CoolapkTauriAPI.getProductDetailByName(name);
    const product = res && res.data ? res.data : res;
    if (product && product.id) {
      router.push(`/product/${product.id}`);
      return;
    }
    productError.value = notFoundMsg;
  } catch (err: any) {
    console.warn('搜索产品失败:', err);
    productError.value = notFoundMsg;
  } finally {
    searchingProduct.value = false;
  }
}

function handleSearch() {
  const query = searchQuery.value.trim();
  if (!query) return;
  if (searchMode.value === 'product') {
    searchProduct(query);
  } else {
    isSearching.value = true;
    productError.value = '';
    loadFeeds(true);
  }
}

function clearSearch() {
  searchQuery.value = '';
  isSearching.value = false;
  searchMode.value = 'feed';
  productError.value = '';
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

.search-area {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.search-mode-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--background-secondary);
  flex-shrink: 0;
}

.mode-btn {
  padding: 5px var(--space-3);
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.mode-btn:hover {
  color: var(--text-primary);
}

.mode-btn.active {
  background-color: var(--surface);
  color: var(--brand-primary);
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
