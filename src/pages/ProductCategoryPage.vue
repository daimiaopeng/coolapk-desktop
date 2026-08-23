<template>
  <div class="product-category-page page-container custom-scrollbar">
    <header class="category-header">
      <div>
        <h2 class="page-title"><i class="fas fa-mobile-alt icon"></i>数码分类</h2>
        <p>按品牌或分类浏览酷安数码产品</p>
      </div>
      <router-link to="/product-selector" class="selector-link">
        <i class="fas fa-magnifying-glass"></i> 机型搜索
      </router-link>
    </header>

    <div class="category-toolbar">
      <button
        v-for="mode in modes"
        :key="mode.key"
        type="button"
        :class="['mode-btn', { active: activeMode === mode.key }]"
        @click="switchMode(mode.key)"
      >
        {{ mode.label }}
      </button>
    </div>

    <div class="category-body">
      <aside class="category-side">
        <div v-if="sideLoading" class="side-state">
          <LoadingState text="加载中..." />
        </div>
        <div v-else-if="sideError" class="side-state">
          <ErrorState title="加载失败" message="无法获取列表" @retry="loadSide" />
        </div>
        <div v-else-if="sideItems.length === 0" class="side-state">
          <EmptyState title="暂无数据" />
        </div>
        <div v-else class="side-list">
          <button
            v-for="item in sideItems"
            :key="sideItemKey(item)"
            type="button"
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
import { onMounted, ref } from 'vue';
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
    const url = String(selection.url || '');
    const title = String(selection.title || selection.name || '');
    const subTitle = String(selection.subTitle || '');
    const res = await CoolapkTauriAPI.getProductList(url, title, subTitle, productPage.value);
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
  width: 100%;
  max-width: 1180px;
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  box-sizing: border-box;
  padding: var(--space-5, 20px);
  margin: 0 auto;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 14px;
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 18px;
}

.page-title {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-title-lg, 24px);
}

.page-title .icon {
  color: var(--brand-primary, #10b981);
  margin-right: 10px;
}

.category-header p {
  margin: 6px 0 0;
  color: var(--text-secondary);
}

.selector-link {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
  text-decoration: none;
}

.selector-link:hover {
  color: var(--brand-primary, #10b981);
}

.category-toolbar {
  display: flex;
  gap: 6px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: var(--radius-card, 12px);
}

.mode-btn {
  border: 0;
  border-radius: 7px;
  padding: 8px 16px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
}

.mode-btn.active {
  background: var(--brand-soft, rgba(0, 190, 120, .12));
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.category-body {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.category-side {
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: var(--radius-card, 12px);
  background: var(--surface);
  overflow-y: auto;
  max-height: 100%;
}

.side-list {
  display: flex;
  flex-direction: column;
  padding: 6px;
}

.side-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  padding: 9px 10px;
  border-radius: var(--radius-control, 8px);
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.side-item:hover {
  background: var(--surface-hover);
}

.side-item.active {
  background: var(--brand-soft, rgba(0, 190, 120, .12));
  color: var(--brand-primary, #10b981);
  font-weight: 600;
}

.side-logo,
.side-logo-fallback {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface-hover);
}

.side-logo :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.side-logo-fallback {
  display: grid;
  place-items: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.side-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.side-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.side-state {
  min-height: 200px;
  display: grid;
  place-items: center;
}

.category-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.content-hint {
  flex: 1;
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
  min-height: 300px;
  display: grid;
  place-items: center;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.product-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: var(--radius-card, 12px);
  background: var(--surface);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: transform .16s ease, box-shadow .16s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, .08));
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
  .category-body {
    grid-template-columns: 1fr;
  }
  .category-side {
    max-height: 220px;
  }
  .product-grid {
    grid-template-columns: 1fr;
  }
}
</style>
