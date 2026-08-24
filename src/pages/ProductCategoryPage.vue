<template>
  <div class="product-category-page page-container custom-scrollbar">
    <div class="category-toolbar">
      <div class="mode-switch" role="tablist" aria-label="数码分类筛选">
        <button
          v-for="mode in modes"
          :key="mode.key"
          type="button"
          role="tab"
          :aria-selected="activeMode === mode.key"
          :class="['mode-btn', { active: activeMode === mode.key }]"
          @click="switchMode(mode.key)"
        >
          <i :class="mode.key === 'brand' ? 'fas fa-tags' : 'fas fa-layer-group'"></i>
          {{ mode.label }}
        </button>
      </div>
      <label class="category-search">
        <i class="fas fa-search" aria-hidden="true"></i>
        <input v-model="searchQuery" type="search" :placeholder="activeMode === 'brand' ? '搜索品牌' : '搜索分类'" aria-label="搜索品牌或分类" @keydown.esc="searchQuery = ''" />
        <button v-if="searchQuery" type="button" class="category-search-clear" aria-label="清除搜索" @click="searchQuery = ''">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </label>
    </div>

    <div class="category-body">
      <aside class="category-side">
        <div class="side-heading">
          <div>
            <span class="side-heading-kicker">{{ activeMode === 'brand' ? 'BRANDS' : 'CATEGORIES' }}</span>
            <strong>{{ activeMode === 'brand' ? '品牌列表' : '分类列表' }}</strong>
          </div>
          <span class="side-total">{{ searchQuery.trim() ? filteredSideItems.length : sideItems.length }}</span>
        </div>
        <div v-if="sideLoading" class="side-state">
          <LoadingState text="加载中..." />
        </div>
        <div v-else-if="sideError" class="side-state">
          <ErrorState title="加载失败" message="无法获取列表" @retry="loadSide" />
        </div>
        <div v-else-if="filteredSideItems.length === 0" class="side-state">
          <EmptyState :title="searchQuery.trim() ? '未找到匹配项' : '暂无数据'" :description="searchQuery.trim() ? '换个关键词试试' : undefined" />
        </div>
        <div v-else class="side-list">
          <button
            v-for="item in filteredSideItems"
            :key="sideItemKey(item)"
            type="button"
            :aria-label="`查看${item.title || item.name || ''}`"
            :class="['side-item', { active: selectedId === sideItemKey(item) }]"
            @click="selectSide(item)"
          >
            <AppImage v-if="sideLogo(item)" :src="sideLogo(item)" image-class="side-logo" />
            <span v-else class="side-logo-fallback"><i class="fas fa-mobile-screen-button"></i></span>
            <span class="side-name">{{ item.title || item.name }}</span>
            <span v-if="productCount(item)" class="side-count">{{ formatCount(productCount(item)) }}</span>
          </button>
        </div>
      </aside>

      <section class="category-content">
        <div v-if="!selected" class="content-hint">
          <i class="fas fa-arrow-left"></i>
          <span>从左侧选择一个{{ activeMode === 'brand' ? '品牌' : '分类' }}查看产品</span>
        </div>

        <template v-else>
          <div class="category-content-header">
            <div class="content-title-group">
              <span class="content-kicker">{{ activeMode === 'brand' ? '当前品牌' : '当前分类' }}</span>
              <h3>{{ selected.title || selected.name }}</h3>
            </div>
            <span v-if="productCount(selected)" class="content-count">{{ formatCount(productCount(selected)) }} 个产品</span>
          </div>
          <div v-if="productLoading && products.length === 0" class="content-state">
            <LoadingState text="正在加载产品列表..." />
          </div>
          <div v-else-if="productError && products.length === 0" class="content-state">
            <ErrorState title="产品加载失败" message="无法获取该系列的产品列表" @retry="loadProducts" />
          </div>
          <div v-else-if="products.length === 0" class="content-state">
            <EmptyState title="暂无产品" description="该系列还没有收录产品" />
          </div>
          <div v-else class="product-grid">
            <button
              v-for="product in products"
              :key="String(product.id ?? product.entityId ?? product.url)"
              type="button"
              class="product-card"
              @click="openProduct(product)"
            >
              <AppImage v-if="productImage(product)" :src="productImage(product)" fit="contain" image-class="product-image" />
              <div v-else class="product-image-fallback"><i class="fas fa-mobile-screen-button"></i></div>
              <div class="product-card-info">
                <strong class="product-card-title">{{ product.title || product.name }}</strong>
                <div class="product-card-meta">
                  <span v-if="product.rating_average_score || product.star_average_score">
                    <i class="fas fa-star"></i>
                    {{ product.rating_average_score || product.star_average_score }}
                  </span>
                  <span v-if="product.price_min || product.price_max">
                    ¥{{ product.price_min || 0 }} - {{ product.price_max || '?' }}
                  </span>
                </div>
              </div>
            </button>

            <div class="pagination-footer">
              <LoadingState v-if="productLoading" text="加载更多中..." />
              <button v-else-if="productError" class="retry-inline" @click="loadProducts(true)">加载失败，点击重试</button>
              <div v-else-if="productNoMore" class="no-more">没有更多产品了</div>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import type { ProductBrand } from '../types/product';

const router = useRouter();

const modes = [
  { key: 'brand', label: '品牌' },
  { key: 'category', label: '分类' },
] as const;

const activeMode = ref<'brand' | 'category'>('brand');
const sideItems = ref<ProductBrand[]>([]);
const searchQuery = ref('');
const sideLoading = ref(false);
const sideError = ref(false);
const selected = ref<ProductBrand | null>(null);
const selectedId = ref('');

const products = ref<any[]>([]);
const productLoading = ref(false);
const productError = ref(false);
const productNoMore = ref(false);
const productPage = ref(1);
const selectionVersion = ref(0);
let productRequestVersion = 0;
let loadingSelectionVersion = -1;

const filteredSideItems = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return sideItems.value;
  return sideItems.value.filter((item) => `${item.title || ''} ${item.name || ''}`.toLocaleLowerCase().includes(query));
});

function sideItemKey(item: ProductBrand): string {
  return String(item.id ?? item.entityId ?? item.url ?? item.title ?? item.name ?? '');
}

function sideLogo(item: ProductBrand): string {
  return String(item.logo || item.pic || '');
}

function productCount(item: ProductBrand): number {
  const num = Number(item.product_num ?? item.series_num ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function productImage(product: any): string {
  return String(product.logo || product.pic || product.icon || '');
}

async function switchMode(mode: 'brand' | 'category') {
  if (activeMode.value === mode && sideItems.value.length > 0) return;
  activeMode.value = mode;
  searchQuery.value = '';
  selected.value = null;
  selectedId.value = '';
  products.value = [];
  selectionVersion.value++;
  await loadSide();
}

async function loadSide() {
  sideLoading.value = true;
  sideError.value = false;
  try {
    const res = activeMode.value === 'brand'
      ? await CoolapkTauriAPI.getProductBrandList()
      : await CoolapkTauriAPI.getProductCategoryList();
    const list = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    sideItems.value = list.filter((item: ProductBrand) => item && sideItemKey(item));
    const nextSelection = sideItems.value.find((item) => sideItemKey(item) === selectedId.value) || sideItems.value[0];
    if (nextSelection && (!selected.value || selectedId.value !== sideItemKey(nextSelection))) selectSide(nextSelection);
  } catch (err) {
    sideError.value = true;
    console.warn('加载品牌/分类失败', err);
  } finally {
    sideLoading.value = false;
  }
}

function selectSide(item: ProductBrand) {
  selected.value = item;
  selectedId.value = sideItemKey(item);
  productPage.value = 1;
  productNoMore.value = false;
  productError.value = false;
  products.value = [];
  selectionVersion.value++;
  void loadProducts(false, selectionVersion.value);
}

async function loadProducts(isLoadMore = false, expectedSelectionVersion = selectionVersion.value) {
  const selection = selected.value;
  if (!selection || expectedSelectionVersion !== selectionVersion.value) return;
  if (productLoading.value && loadingSelectionVersion === expectedSelectionVersion) return;
  if (productNoMore.value) return;
  productLoading.value = true;
  const requestVersion = ++productRequestVersion;
  loadingSelectionVersion = expectedSelectionVersion;
  if (!isLoadMore) productError.value = false;
  try {
    const res = activeMode.value === 'brand'
      ? await CoolapkTauriAPI.getProductBrandProducts(String(selection.id ?? selection.entityId ?? ''), String(selection.type || 'recommend'), productPage.value)
      : await CoolapkTauriAPI.getProductList(String(selection.url || ''), String(selection.title || selection.name || ''), String(selection.subTitle || ''), productPage.value);
    const newItems = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (expectedSelectionVersion !== selectionVersion.value || selection !== selected.value) return;
    if (newItems.length === 0) {
      productNoMore.value = true;
    } else {
      products.value = isLoadMore ? [...products.value, ...newItems] : newItems;
      productPage.value++;
    }
  } catch (err) {
    if (expectedSelectionVersion !== selectionVersion.value || selection !== selected.value) return;
    productError.value = true;
    console.warn('加载产品列表失败', err);
  } finally {
    if (requestVersion === productRequestVersion) productLoading.value = false;
  }
}

function openProduct(product: any) {
  const id = String(product.id ?? product.entityId ?? '');
  if (id) void router.push(`/product/${encodeURIComponent(id)}`);
}

function formatCount(value: number) {
  const count = Number(value);
  if (!Number.isFinite(count)) return '0';
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return String(count);
}

onMounted(() => {
  void loadSide();
});
</script>

<style scoped>
.product-category-page {
  --category-font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
  width: 100%;
  max-width: none;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  font-family: var(--category-font-family);
}

.category-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 3px;
  flex: 0 0 auto;
  min-height: 64px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, .08));
}

.mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border-radius: 12px;
  background: var(--surface-hover);
}

.category-search {
  display: flex;
  align-items: center;
  gap: 9px;
  width: min(320px, 36vw);
  height: 44px;
  margin-left: auto;
  padding: 0 13px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, .1));
  border-radius: 11px;
  background: var(--surface-hover);
  color: var(--text-tertiary);
  transition: border-color var(--duration-normal, 180ms) var(--ease-default), background var(--duration-normal, 180ms) var(--ease-default), box-shadow var(--duration-normal, 180ms) var(--ease-default);
}

.category-search:focus-within {
  border-color: var(--brand-primary, #10b981);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--brand-soft, rgba(0, 190, 120, .12));
}

.category-search > i {
  flex: 0 0 auto;
  font-size: 15px;
}

.category-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: text;
  font: inherit;
  font-size: 14px;
  user-select: text;
}

.category-search input::placeholder {
  color: var(--text-tertiary);
}

.category-search-clear {
  display: grid;
  flex: 0 0 24px;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--text-tertiary);
  cursor: pointer;
}

.category-search-clear:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 104px;
  height: 44px;
  border: 0;
  border-radius: 9px;
  padding: 0 20px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 16px;
  transition: background var(--duration-normal, 180ms) var(--ease-default), color var(--duration-normal, 180ms) var(--ease-default), box-shadow var(--duration-normal, 180ms) var(--ease-default);
}

.mode-btn.active {
  background: var(--brand-soft, rgba(0, 190, 120, .12));
  color: var(--brand-primary, #10b981);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(16, 183, 104, .12);
}

.mode-btn:not(.active):hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.mode-btn i {
  font-size: 15px;
}

.category-body {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 0;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.category-side {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  border: 0;
  border-right: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: 0;
  background: var(--surface);
  box-shadow: none;
  overflow: hidden;
}

.side-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  min-height: 72px;
  padding: 14px 18px 13px;
  border-bottom: 1px solid var(--divider);
}

.side-heading > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.side-heading-kicker,
.content-kicker {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.side-heading strong {
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1.3;
}

.side-total,
.content-count {
  flex: 0 0 auto;
  padding: 4px 9px;
  border-radius: var(--radius-pill, 9999px);
  background: var(--surface-hover);
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.4;
}

.side-list {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  gap: 1px;
  padding: 8px 0 16px;
  background: #fff;
}

.side-item {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 68px;
  border: 0;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--divider);
  background: #fff;
  color: var(--text-primary);
  font: inherit;
  box-sizing: border-box;
  padding: 12px 20px 12px 22px;
  border-radius: 0;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background var(--duration-normal, 180ms) var(--ease-default), border-color var(--duration-normal, 180ms) var(--ease-default), color var(--duration-normal, 180ms) var(--ease-default);
}

.side-item + .side-item {
  margin-top: 0;
}

.side-item:hover {
  background: #f8faf9;
}

.side-item.active {
  border-left-color: var(--brand-primary);
  background: #fff;
  color: var(--brand-primary, #10b981);
}

.side-logo,
.side-logo-fallback {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.side-logo :deep(img) {
  width: 100%;
  height: 100%;
  padding: 0;
  object-fit: contain;
}

.side-logo-fallback {
  display: grid;
  place-items: center;
  color: var(--text-tertiary);
  font-size: 17px;
}

.side-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--category-font-family);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.35;
}

.side-count {
  font-size: 12px;
  color: var(--text-tertiary);
}

.side-state {
  flex: 1 1 auto;
  min-height: 220px;
  display: grid;
  place-items: center;
}

.category-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--surface);
  box-shadow: none;
}

.category-content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex: 0 0 auto;
  min-height: 72px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--divider);
}

.content-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.content-title-group h3 {
  overflow: hidden;
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-hint {
  flex: 1 1 auto;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.content-hint i {
  font-size: 28px;
}

.content-state {
  flex: 1 1 auto;
  min-height: 300px;
  display: grid;
  place-items: center;
}

.product-grid {
  flex: 1 1 auto;
  align-content: start;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.product-card {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: 12px;
  background: var(--surface-hover);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: transform .16s ease, box-shadow .16s ease;
}

.product-card:hover {
  border-color: var(--brand-green-border, rgba(16, 185, 102, .25));
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(23, 25, 28, .08);
}

.product-image,
.product-image-fallback {
  flex: 0 0 58px;
  width: 58px;
  height: 58px;
  border-radius: 10px;
  overflow: hidden;
}

.product-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.product-image-fallback {
  display: grid;
  place-items: center;
  background: var(--surface-hover);
  color: var(--text-tertiary);
  font-size: 22px;
}

.product-card-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.product-card-title {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.product-card-meta .fa-star {
  color: #f59e0b;
  margin-right: 3px;
}

.pagination-footer {
  grid-column: 1 / -1;
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

@media (max-width: 800px) {
  .category-toolbar {
    flex-wrap: wrap;
  }

  .category-search {
    width: min(320px, 42vw);
  }

  .category-body {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .category-side {
    min-height: 0;
    max-height: 286px;
  }

  .side-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 3px;
  }

  .side-item + .side-item {
    margin-top: 0;
  }

  .product-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .category-toolbar {
    padding: 8px 12px;
  }

  .category-search {
    flex: 1 1 100%;
    width: 100%;
    max-width: none;
    margin-left: 0;
  }

  .mode-btn {
    flex: 1 1 0;
  }

  .side-list {
    grid-template-columns: 1fr;
  }

  .category-content-header {
    padding: 13px 15px;
  }

  .product-grid {
    padding: 12px;
  }
}
</style>
