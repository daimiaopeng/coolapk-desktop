<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="top-nav-bar">
      <div class="nav-title-box">
        <span class="nav-title">{{ productTitle }}</span>
      </div>
      <div class="nav-right-actions">
        <i class="fas fa-search action-btn" @click="focusSearch" title="搜索产品动态"></i>
      </div>
    </div>

    <div v-if="headerLoading" class="product-header-card skeleton-header">
      <LoadingState text="正在加载产品信息..." />
    </div>

    <div v-else-if="headerError" class="product-header-card skeleton-header">
      <ErrorState title="加载失败" message="无法获取产品信息" @retry="fetchProductHeader" />
    </div>

    <div v-else-if="productDetail" class="product-header-card">
      <div class="header-content">
        <div class="product-icon-wrapper">
          <AppImage
            v-if="productLogo"
            :src="productLogo"
            class="product-icon"
            fit="cover"
            :alt="productTitle"
          />
          <div v-else class="product-icon-fallback">
            <i class="fas fa-microchip"></i>
          </div>
        </div>

        <div class="product-info">
          <h2 class="product-title">{{ productTitle }}</h2>
          <div v-if="productDescription" class="product-desc-text">
            {{ productDescription }}
          </div>
          <div class="product-stats">
            <span v-if="productDetail.follow_num">{{ formatCount(productDetail.follow_num) }} 关注</span>
            <span v-if="productDetail.feed_comment_num">{{ formatCount(productDetail.feed_comment_num) }} 讨论</span>
            <span v-if="productDetail.rating_average_score">评分 {{ productDetail.rating_average_score }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="product-header-card skeleton-header">
      <EmptyState title="未找到该产品信息" description="该产品可能已下架或ID不正确" />
    </div>

    <div class="product-sub-tabs custom-scrollbar">
      <button
        v-for="tab in feedTabs"
        :key="tab.key"
        :class="['product-tab-item', { active: activeFeedTab === tab.key }]"
        @click="selectFeedTab(tab.key)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="activeFeedTab === tab.key" class="tab-line"></span>
      </button>
    </div>

    <div v-if="feedsLoading && page === 1" class="loading-wrapper">
      <LoadingState text="正在获取产品动态..." />
    </div>

    <div v-else-if="feedsError && productFeeds.length === 0" class="error-wrapper">
      <ErrorState title="动态加载失败" message="无法获取该产品的动态，请检查网络后重试" @retry="retryFeeds" />
    </div>

    <div v-else-if="productFeeds.length === 0 && !feedsLoading" class="empty-wrapper">
      <EmptyState title="暂无相关动态" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in productFeeds" :key="item.id || item.ttype + item.uid" :feed="item" @deleted="handleFeedDeleted" />

      <div class="pagination-footer">
        <LoadingState v-if="feedsLoading && page > 1" text="加载更多中..." />
        <button v-else-if="feedsError" class="retry-inline" @click="retryFeeds">加载失败，点击重试</button>
        <div v-else-if="noMore" class="no-more">没有更多动态了</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const router = useRouter();
// 固定当前缓存页面的参数，避免隐藏后跟随全局路由变化重新加载。
const productId = ref(route.params.productId as string);

const productDetail = ref<any>(null);
const headerLoading = ref(false);
const headerError = ref(false);

const productFeeds = ref<any[]>([]);

function handleFeedDeleted(id: string | number) {
  productFeeds.value = productFeeds.value.filter((f: any) => String(f.id) !== String(id));
}
const feedsLoading = ref(false);
const feedsError = ref(false);
const page = ref(1);
const noMore = ref(false);

const activeFeedTab = ref('feed');
const feedTabs = [
  { key: 'feed', label: '讨论' },
  { key: 'answer', label: '问答' },
  { key: 'article', label: '图文' },
  { key: 'video', label: '视频' },
  { key: 'trade', label: '交易' },
];

const productLogo = computed(() => {
  if (!productDetail.value) return '';
  return productDetail.value.logo
    || productDetail.value.product_logo
    || productDetail.value.pic
    || productDetail.value.icon
    || '';
});

const productTitle = computed(() => {
  if (!productDetail.value) return productId.value;
  return productDetail.value.title
    || productDetail.value.index_title
    || productDetail.value.alias_title
    || productDetail.value.name
    || productId.value;
});

const productDescription = computed(() => {
  if (!productDetail.value) return '';
  return productDetail.value.description
    || productDetail.value.device_info
    || productDetail.value.subTitle
    || '';
});

async function fetchProductHeader() {
  if (!productId.value) return;
  headerLoading.value = true;
  headerError.value = false;
  productDetail.value = null;
  try {
    const res = await CoolapkTauriAPI.getProductDetail(productId.value);
    if (res?.data && typeof res.data === 'object') {
      productDetail.value = res.data;
    } else {
      headerError.value = true;
    }
  } catch (err) {
    headerError.value = true;
    console.warn('获取产品详情失败', err);
  } finally {
    headerLoading.value = false;
  }
}

async function fetchFeeds(isLoadMore = false) {
  if (!productId.value || feedsLoading.value || noMore.value) return;

  feedsLoading.value = true;
  if (!isLoadMore) feedsError.value = false;
  try {
    const res = await CoolapkTauriAPI.getProductFeeds(productId.value, activeFeedTab.value, page.value);
    const newFeeds = (res && res.data && Array.isArray(res.data)) ? res.data : [];

    if (newFeeds.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        productFeeds.value.push(...newFeeds);
      } else {
        productFeeds.value = newFeeds;
      }
      page.value++;
    }
  } catch (err) {
    feedsError.value = true;
    console.warn('获取产品动态失败', err);
  } finally {
    feedsLoading.value = false;
  }
}

function selectFeedTab(key: string) {
  activeFeedTab.value = key;
  page.value = 1;
  noMore.value = false;
  feedsError.value = false;
  productFeeds.value = [];
  void fetchFeeds(false);
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    if (!feedsLoading.value && !noMore.value) {
      fetchFeeds(true);
    }
  }
}

function focusSearch() {
  router.push({ path: '/search', query: { q: productTitle.value } });
}

function retryFeeds() {
  noMore.value = false;
  feedsError.value = false;
  void fetchFeeds(page.value > 1);
}

function formatCount(value: number | string) {
  const count = Number(value);
  if (!Number.isFinite(count)) return '0';
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function resetFeeds() {
  page.value = 1;
  noMore.value = false;
  feedsError.value = false;
  productFeeds.value = [];
}

watch(productId, () => {
  resetFeeds();
  void fetchProductHeader();
  void fetchFeeds(false);
}, { immediate: true });
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
  gap: 12px;
}

.top-nav-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  margin-bottom: 2px;
}

.nav-title-box {
  flex: 1;
  text-align: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--brand-primary, #10b981);
}

.action-btn {
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
}

.product-header-card {
  background-color: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.product-icon-wrapper {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background-color: var(--background);
}

.product-icon-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.25));
  font-size: 26px;
  color: #3b82f6;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.product-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.product-desc-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.product-sub-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  overflow-x: auto;
}

.product-tab-item {
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 2px;
  white-space: nowrap;
}

.product-tab-item.active {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.tab-line {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  background: var(--brand-primary, #10b981);
  border-radius: 2px;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}

.retry-inline {
  border: 0;
  background: transparent;
  color: var(--brand-primary, #10b981);
  font-size: 12px;
  cursor: pointer;
}
</style>
