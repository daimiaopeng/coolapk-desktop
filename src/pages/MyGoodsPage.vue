<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i class="fas fa-gift icon"></i> 我的好物</h2>
        <span class="page-subtitle">我发布、想买、买过的商品与专辑</span>
      </div>
    </div>

    <div v-if="!authStore.isLoggedIn" class="login-guide">
      <div class="login-guide-icon">
        <i class="fas fa-user-lock"></i>
      </div>
      <h3 class="login-guide-title">登录后查看我的好物</h3>
      <p class="login-guide-desc">登录酷安账号即可同步你发布、想买、买过的好物与商品店铺</p>
      <AppButton variant="primary" icon="fas fa-sign-in-alt" @click="authStore.openLoginModal()">
        立即登录
      </AppButton>
    </div>

    <template v-else>
      <div class="sub-tabs custom-scrollbar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['sub-tab-item', { active: activeTab === tab.key }]"
          @click="selectTab(tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span v-if="activeTab === tab.key" class="tab-line"></span>
        </button>
      </div>

      <div v-if="loading && items.length === 0" class="state-wrapper">
        <LoadingState :text="tabLoadingText" />
      </div>

      <div v-else-if="error && items.length === 0" class="state-wrapper">
        <ErrorState title="加载失败" :message="error" @retry="load(true)" />
      </div>

      <div v-else-if="items.length === 0" class="state-wrapper">
        <EmptyState title="这里还空空的" description="去发现一些好物吧" />
      </div>

      <div v-else class="list-wrapper">
        <div v-if="activeTab === 'store'" class="store-grid">
          <article v-for="item in items" :key="itemKey(item)" class="store-card">
            <div class="store-cover">
              <AppImage
                v-if="storeCover(item)"
                :src="storeCover(item)"
                image-class="store-cover-img"
                fit="cover"
              />
              <div v-else class="store-cover-fallback">
                <i class="fas fa-store"></i>
              </div>
            </div>
            <div class="store-info">
              <h4 class="store-title">{{ storeTitle(item) }}</h4>
              <p class="store-desc">{{ storeDesc(item) }}</p>
            </div>
          </article>
        </div>

        <div v-else-if="activeTab === 'album'" class="album-grid">
          <article v-for="item in items" :key="itemKey(item)" class="album-card" @click="openAlbum(item)">
            <div class="album-cover">
              <AppImage
                v-if="albumCover(item)"
                :src="albumCover(item)"
                image-class="album-cover-img"
                fit="cover"
              />
              <div v-else class="album-cover-fallback">
                <i class="fas fa-images"></i>
              </div>
            </div>
            <div class="album-info">
              <h4 class="album-title">{{ albumTitle(item) }}</h4>
              <div class="album-stats">
                <span v-if="albumItemNum(item) > 0"><i class="fas fa-box-open"></i> {{ albumItemNum(item) }}</span>
                <span v-if="albumFeedNum(item) > 0"><i class="far fa-file-alt"></i> {{ albumFeedNum(item) }}</span>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="product-list">
          <article v-for="item in items" :key="itemKey(item)" class="product-card" @click="openProduct(item)">
            <div class="product-cover">
              <AppImage
                v-if="productCover(item)"
                :src="productCover(item)"
                image-class="product-cover-img"
                fit="cover"
              />
              <div v-else class="product-cover-fallback">
                <i class="fas fa-box"></i>
              </div>
            </div>
            <div class="product-info">
              <h4 class="product-title">{{ productTitle(item) }}</h4>
              <p v-if="productDesc(item)" class="product-desc">{{ productDesc(item) }}</p>
              <div v-if="productPrice(item) !== ''" class="product-price">
                <i class="fas fa-yen-sign"></i> {{ productPrice(item) }}
              </div>
            </div>
          </article>
        </div>

        <div class="pagination-footer">
          <LoadingState v-if="loading && items.length > 0" text="加载更多中..." />
          <button v-else-if="error && items.length > 0" class="retry-inline" @click="load(true)">加载失败，点击重试</button>
          <div v-else-if="noMore" class="no-more">没有更多了</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppButton from '../components/common/AppButton.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();

type GoodsTabKey = 'all' | 'wish' | 'buy' | 'store' | 'album';

const tabs: { key: GoodsTabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'wish', label: '想买' },
  { key: 'buy', label: '买过' },
  { key: 'store', label: '商品店铺' },
  { key: 'album', label: '产品专辑' },
];

const activeTab = ref<GoodsTabKey>('all');
const items = ref<any[]>([]);
const page = ref(1);
const loading = ref(false);
const error = ref('');
const noMore = ref(false);

const currentUid = computed(() => String(authStore.user?.uid || ''));

const tabLoadingText = computed(() => {
  if (activeTab.value === 'store') return '正在加载商品店铺...';
  if (activeTab.value === 'album') return '正在加载产品专辑...';
  return '正在加载我的好物...';
});

function itemKey(item: any): string {
  return String(item?.id ?? item?.entityId ?? `${item?.uid}-${item?.dateline}`);
}

function productCover(item: any): string {
  return item?.logo || item?.pic || item?.icon || '';
}

function productTitle(item: any): string {
  return item?.title || item?.index_title || item?.name || '未知产品';
}

function productDesc(item: any): string {
  return item?.description || item?.sub_title || item?.device_info || '';
}

function productPrice(item: any): string {
  return item?.price || item?.goods_price || '';
}

function storeCover(item: any): string {
  return item?.logo || item?.pic || '';
}

function storeTitle(item: any): string {
  return item?.title || item?.name || '未知店铺';
}

function storeDesc(item: any): string {
  return item?.description || item?.sub_title || item?.mall_title || '';
}

function albumCover(item: any): string {
  return item?.cover || item?.logo || item?.pic || '';
}

function albumTitle(item: any): string {
  return item?.title || item?.name || '未命名专辑';
}

function albumItemNum(item: any): number {
  return Number(item?.item_num || item?.goods_num || 0);
}

function albumFeedNum(item: any): number {
  return Number(item?.feed_num || 0);
}

async function load(isRefresh = false) {
  if (!authStore.isLoggedIn) return;
  if (loading.value) return;
  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    error.value = '';
  } else if (noMore.value) {
    return;
  }
  loading.value = true;
  try {
    const uid = currentUid.value;
    let res: any;
    if (activeTab.value === 'store') {
      res = await CoolapkTauriAPI.getGoodsStoreItems(uid, page.value);
    } else if (activeTab.value === 'album') {
      res = await CoolapkTauriAPI.getProductAlbums(uid, page.value);
    } else {
      const type = activeTab.value === 'all' ? 'all' : activeTab.value;
      res = await CoolapkTauriAPI.getMyGoodsFeeds(uid, type, page.value);
    }
    const list = (res?.data && Array.isArray(res.data)) ? res.data : [];
    if (list.length === 0) {
      noMore.value = true;
    } else {
      if (isRefresh) {
        items.value = list;
      } else {
        const existing = new Set(items.value.map(itemKey));
        items.value.push(...list.filter((i: any) => !existing.has(itemKey(i))));
      }
      page.value++;
    }
  } catch (err: any) {
    error.value = err?.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function selectTab(key: GoodsTabKey) {
  if (activeTab.value === key) return;
  activeTab.value = key;
  items.value = [];
  noMore.value = false;
  error.value = '';
  void load(true);
}

function openProduct(item: any) {
  const id = String(item?.id ?? item?.entityId ?? '');
  if (!id) return;
  router.push(`/product/${id}`);
}

function openAlbum(item: any) {
  const id = String(item?.id ?? item?.entityId ?? '');
  if (!id) return;
  router.push(`/album/${id}`);
}

function handleScroll(e: Event) {
  const el = e.target as HTMLElement;
  const scrollDiff = el && el.scrollHeight
    ? el.scrollHeight - el.scrollTop - el.clientHeight
    : 999;
  if (scrollDiff < 260 && !loading.value && !noMore.value) {
    void load(false);
  }
}

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      void load(true);
    } else {
      items.value = [];
    }
  },
);

onMounted(() => {
  if (authStore.isLoggedIn) {
    void load(true);
  }
  window.addEventListener('scroll', handleScroll, true);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll, true);
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
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
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

.login-guide {
  margin: var(--space-10) auto;
  max-width: 420px;
  width: 100%;
  text-align: center;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-dialog);
  padding: var(--space-8) var(--space-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.login-guide-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
}

.login-guide-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.login-guide-desc {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-2);
}

.sub-tabs {
  display: flex;
  gap: var(--space-5);
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  overflow-x: auto;
}

.sub-tab-item {
  position: relative;
  border: none;
  background: transparent;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 2px;
  white-space: nowrap;
}

.sub-tab-item.active {
  color: var(--brand-primary);
  font-weight: var(--font-weight-bold);
}

.tab-line {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  background: var(--brand-primary);
  border-radius: 2px;
}

.state-wrapper {
  padding: var(--space-10) 0;
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.product-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-3);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-default);
}

.product-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.product-cover {
  width: 60px;
  height: 60px;
  flex: 0 0 60px;
  border-radius: var(--radius-control);
  overflow: hidden;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-light);
}

.product-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 22px;
}

.product-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.product-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-desc {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-price {
  color: var(--danger);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-caption);
}

.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}

.store-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.store-cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: var(--background-secondary);
  overflow: hidden;
}

.store-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.store-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 30px;
}

.store-info {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.store-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.store-desc {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-3);
}

.album-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-default);
}

.album-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.album-cover {
  width: 100%;
  aspect-ratio: 1;
  background-color: var(--background-secondary);
  overflow: hidden;
}

.album-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 28px;
}

.album-info {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.album-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.album-stats {
  display: flex;
  gap: var(--space-2);
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.pagination-footer {
  padding: var(--space-4) 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.retry-inline {
  border: 0;
  background: transparent;
  color: var(--brand-primary);
  font-size: var(--font-size-caption);
  cursor: pointer;
}
</style>