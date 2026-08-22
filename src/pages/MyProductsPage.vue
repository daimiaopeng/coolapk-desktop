<template>
  <div class="my-products-page page-container custom-scrollbar" @scroll="handleScroll">
    <header class="page-header">
      <div>
        <h2 class="page-title"><i class="fas fa-mobile-alt icon"></i>我的数码</h2>
        <p>查看想看、已购和拥有的数码产品</p>
      </div>
    </header>

    <div v-if="!authStore.isLoggedIn" class="login-state">
      <EmptyState title="需要登录" description="登录酷安账号后可以查看你的数码产品清单">
        <button type="button" class="login-btn" @click="authStore.openLoginModal()">
          <i class="fas fa-sign-in-alt"></i> 立即登录
        </button>
      </EmptyState>
    </div>

    <template v-else>
      <div class="type-tabs">
        <button
          v-for="tab in typeTabs"
          :key="tab.key"
          type="button"
          :class="['type-tab', { active: activeType === tab.key }]"
          @click="switchType(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="loading && items.length === 0" class="state-wrapper">
        <LoadingState text="正在加载产品列表..." />
      </div>
      <div v-else-if="error && items.length === 0" class="state-wrapper">
        <ErrorState title="加载失败" message="无法获取你的产品列表" @retry="loadItems" />
      </div>
      <div v-else-if="items.length === 0" class="state-wrapper">
        <EmptyState title="暂无产品" :description="`你还没有${activeTypeLabel}的数码产品`" />
      </div>

      <div v-else class="product-grid">
        <button
          v-for="product in items"
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
          <LoadingState v-if="loading" text="加载更多中..." />
          <button v-else-if="error" class="retry-inline" @click="loadItems(true)">加载失败，点击重试</button>
          <div v-else-if="noMore" class="no-more">没有更多产品了</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const typeTabs = [
  { key: 'wish', label: '想要' },
  { key: 'buy', label: '已购' },
  { key: 'owner', label: '拥有' },
];

const activeType = ref('wish');
const activeTypeLabel = computed(() => {
  return typeTabs.find((tab) => tab.key === activeType.value)?.label || '相关';
});
const items = ref<any[]>([]);
const loading = ref(false);
const error = ref(false);
const noMore = ref(false);
const page = ref(1);

function productImage(product: any): string {
  return String(product.logo || product.pic || product.icon || '');
}

async function switchType(key: string) {
  if (activeType.value === key) return;
  activeType.value = key;
  page.value = 1;
  noMore.value = false;
  error.value = false;
  items.value = [];
  await loadItems();
}

async function loadItems(isLoadMore = false) {
  const uid = String(authStore.user?.uid || '');
  if (!uid || loading.value || noMore.value) return;
  loading.value = true;
  if (!isLoadMore) error.value = false;
  try {
    const res = await CoolapkTauriAPI.getMyProductList(uid, activeType.value, page.value);
    const newItems = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (newItems.length === 0) {
      noMore.value = true;
    } else {
      items.value = isLoadMore ? [...items.value, ...newItems] : newItems;
      page.value++;
    }
  } catch (err) {
    error.value = true;
    console.warn('加载我的产品列表失败', err);
  } finally {
    loading.value = false;
  }
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    if (!loading.value && !noMore.value) {
      void loadItems(true);
    }
  }
}

function openProduct(product: any) {
  const id = String(product.id ?? product.entityId ?? '');
  if (id) void router.push(`/product/${encodeURIComponent(id)}`);
}
</script>

<style scoped>
.my-products-page {
  width: 100%;
  max-width: 1000px;
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  box-sizing: border-box;
  padding: var(--space-5, 20px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 12px;
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

.page-header p {
  margin: 6px 0 0;
  color: var(--text-secondary);
}

.login-state {
  min-height: 320px;
  display: grid;
  place-items: center;
}

.login-btn {
  border: 0;
  background-color: var(--brand-primary);
  color: #ffffff;
  font-size: 13px;
  padding: 9px 20px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.type-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.type-tab {
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  background-color: var(--surface);
  color: var(--text-secondary);
  font-size: 13px;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  cursor: pointer;
}

.type-tab.active {
  background-color: var(--brand-soft, rgba(0, 190, 120, .12));
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: 700;
}

.state-wrapper {
  min-height: 260px;
  display: grid;
  place-items: center;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
  flex: 0 0 62px;
  width: 62px;
  height: 62px;
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
  font-size: 24px;
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

@media (max-width: 700px) {
  .product-grid {
    grid-template-columns: 1fr;
  }
}
</style>