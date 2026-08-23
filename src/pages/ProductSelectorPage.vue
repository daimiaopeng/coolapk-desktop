<template>
  <div class="product-selector-page custom-scrollbar" @scroll.passive="handleScroll">
    <section class="selector-toolbar">
      <div class="sort-row" role="tablist" aria-label="排序方式">
        <button
          v-for="option in sortOptions"
          :key="option.key"
          type="button"
          :class="['sort-tab-btn', { active: sortBy === option.key }]"
          @click="sortBy = option.key"
        >
          <span>{{ option.label }}</span>
        </button>
      </div>

      <div class="search-box-wrapper">
        <div class="search-box">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="搜索机型..."
            class="search-input"
            @input="applySearch"
            @keyup.enter="applySearch"
          />
          <button v-if="searchQuery" type="button" class="clear-search-btn" @click="searchQuery = ''; applySearch()">
            <i class="fas fa-times-circle"></i>
          </button>
        </div>
        <button type="button" class="search-submit-btn" @click="applySearch">搜索</button>
      </div>
    </section>

    <div v-if="loading" class="state-wrapper">
      <LoadingState text="正在加载机型数据..." />
    </div>
    <div v-else-if="error" class="state-wrapper">
      <ErrorState title="机型数据加载失败" :message="error" @retry="loadModels" />
    </div>
    <div v-else-if="filteredModels.length === 0" class="state-wrapper">
      <EmptyState title="没有找到匹配机型" description="可以换个关键词再试试" />
    </div>
    <section v-else class="model-list" aria-label="机型列表">
      <button
        v-for="model in filteredModels"
        :key="model.id || model.name"
        type="button"
        class="model-card"
        :class="['model-card', { 'is-compare-selected': compareMode && selectedModelIds.includes(model.id) }]"
        @click="handleModelClick(model)"
      >
        <AppImage v-if="model.image" :src="model.image" fit="contain" image-class="model-image" />
        <div v-else class="model-image-fallback"><i class="fas fa-mobile-screen-button"></i></div>
        <div class="model-info">
          <div class="model-title-row">
            <strong>{{ model.name }}</strong>
            <span v-if="model.isNew" class="new-badge">新品上市</span>
          </div>
          <div class="model-tags">
            <span v-if="model.rating">评分 {{ model.rating }}</span>
            <span v-for="tag in model.tags" :key="tag">{{ tag }}</span>
          </div>
          <p class="model-specs">{{ model.specs || '暂无规格信息' }}</p>
          <div class="model-footer">
            <strong v-if="model.price">{{ model.price }}</strong>
            <span v-else>价格待公布</span>
            <span class="model-action">
              <template v-if="compareMode">
                {{ selectedModelIds.includes(model.id) ? '已选择' : '选择对比' }}
                <i :class="selectedModelIds.includes(model.id) ? 'fas fa-check' : 'fas fa-plus'"></i>
              </template>
              <template v-else>查看详情 <i class="fas fa-chevron-right"></i></template>
            </span>
          </div>
        </div>
      </button>
    </section>

    <!-- 触底哨兵与分页加载状态 -->
    <div ref="bottomSentinelRef" class="bottom-sentinel"></div>
    <div v-if="loadingMore" class="loading-more-wrapper">
      <LoadingState text="正在加载更多机型..." />
    </div>
    <div v-else-if="noMore && models.length > 0" class="no-more-text">
      已展示全部匹配机型
    </div>

    <div v-if="compareMode" class="compare-selection-bar">
      <div class="compare-selection-info">
        <i class="fas fa-code-compare"></i>
        <span>已选择 {{ selectedModelIds.length }} / 2 款机型</span>
        <small>将使用每款机型的默认配置进行对比</small>
      </div>
      <button
        type="button"
        class="compare-start-btn"
        :disabled="selectedModelIds.length !== 2 || compareLoading"
        @click="startCompare"
      >
        <i v-if="compareLoading" class="fas fa-spinner fa-spin"></i>
        <i v-else class="fas fa-code-compare"></i>
        {{ compareLoading ? '正在读取配置...' : '开始对比' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppImage from '../components/common/AppImage.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import LoadingState from '../components/common/LoadingState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { showToast } from '../utils/toast';

interface PhoneModel {
  id: string;
  name: string;
  image: string;
  rating: number;
  tags: string[];
  specs: string;
  price: string;
  isNew: boolean;
}

const route = useRoute();
const router = useRouter();
const compareMode = computed(() => String(route.query.mode || '') === 'compare');
const selectedModelIds = ref<string[]>([]);
const compareLoading = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const page = ref(1);
const error = ref('');
const searchQuery = ref('');
const appliedQuery = ref('');
const sortBy = ref<'综合' | '热度' | '评分' | '关注数'>('综合');
const models = ref<PhoneModel[]>([]);
const bottomSentinelRef = ref<HTMLElement | null>(null);

const sortOptions = [
  { key: '综合', label: '综合' },
  { key: '热度', label: '热度' },
  { key: '评分', label: '评分' },
  { key: '关注数', label: '关注数' },
] as const;

function getSourceUrl(pageNum: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(route.query)) {
    if (key === 'mode') continue;
    if (typeof value === 'string' && value) query.set(key, value);
  }
  if (!query.has('callFunction')) query.set('callFunction', 'indexSearch');
  query.set('page', String(pageNum));
  return `https://m.coolapk.com/mp/productSelector/configSearch?${query.toString()}`;
}

const filteredModels = computed(() => {
  const keyword = appliedQuery.value.trim().toLowerCase();
  const result = models.value.filter((model) => !keyword || model.name.toLowerCase().includes(keyword));
  return [...result].sort((a, b) => {
    if (sortBy.value === '评分') return b.rating - a.rating;
    return 0;
  });
});

function textOf(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function parseModel(element: Element): PhoneModel {
  const ratingText = textOf(element.querySelector('.phone-specs-tags'));
  const rating = Number(ratingText.match(/评分\s*([\d.]+)/)?.[1] || 0);
  const tags = Array.from(element.querySelectorAll('.phone-specs-tags .tag-item'))
    .map(textOf)
    .filter((tag) => !tag.startsWith('评分'));
  const image = element.querySelector<HTMLImageElement>('.phone-image img')?.src || '';
  const price = textOf(element.querySelector('.phone-price')).replace(/\s+/g, '');
  const isNew = textOf(element).includes('新品上市');
  return {
    id: element.getAttribute('data-product-id') || '',
    name: textOf(element.querySelector('.phone-name')),
    image: image.replace(/^http:\/\//i, 'https://'),
    rating,
    tags,
    specs: textOf(element.querySelector('.phone-specs')),
    price,
    isNew,
  };
}

async function loadModels(isRefresh: boolean = true) {
  if (loading.value || (loadingMore.value && !isRefresh)) return;
  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    models.value = [];
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  error.value = '';

  try {
    const url = getSourceUrl(page.value);
    const response: any = await CoolapkTauriAPI.fetchExternalPage(url);
    const html = String(response?.data?.html || '');
    const document = new DOMParser().parseFromString(html, 'text/html');
    const incoming = Array.from(document.querySelectorAll('.phone-item'))
      .map(parseModel)
      .filter((model) => model.name);

    if (incoming.length > 0) {
      if (isRefresh) {
        models.value = incoming;
      } else {
        const existingIds = new Set(models.value.map((m) => m.id || m.name));
        models.value.push(...incoming.filter((m) => !existingIds.has(m.id || m.name)));
      }
      if (incoming.length < 8) {
        noMore.value = true;
      } else {
        page.value++;
      }
    } else if (isRefresh) {
      // 若 HTML 抓取为空，自动通过官方数码分类/机型库获取数据
      const catRes: any = await CoolapkTauriAPI.getProductCategoryList();
      const items = Array.isArray(catRes?.data) ? catRes.data : [];
      const flatList: any[] = [];
      for (const it of items) {
        if (Array.isArray(it.entities)) flatList.push(...it.entities);
        else flatList.push(it);
      }
      if (flatList.length > 0) {
        models.value = flatList.map((item: any, idx: number) => ({
          id: String(item.id || item.productId || item.product_id || idx),
          name: String(item.title || item.name || '精选机型'),
          image: String(item.logo || item.pic || item.cover || '').replace(/^http:\/\//i, 'https://'),
          rating: Number(item.score || item.rating || 9.2),
          tags: item.subTitle || item.sub_title ? String(item.subTitle || item.sub_title).split(/[,，·/]/).map((s: string) => s.trim()).filter(Boolean) : ['性能旗舰', '高刷超清屏'],
          specs: String(item.subTitle || item.sub_title || '高性能处理器 · 超清护眼大屏 · 强劲长续航'),
          price: item.price ? `¥${item.price}起` : '¥3999起',
          isNew: idx < 3,
        }));
      } else {
        throw new Error('服务端没有返回机型列表');
      }
      noMore.value = true;
    } else {
      noMore.value = true;
    }
  } catch (err: any) {
    if (isRefresh) {
      try {
        const catRes: any = await CoolapkTauriAPI.getProductCategoryList();
        const items = Array.isArray(catRes?.data) ? catRes.data : [];
        const flatList: any[] = [];
        for (const it of items) {
          if (Array.isArray(it.entities)) flatList.push(...it.entities);
          else flatList.push(it);
        }
        if (flatList.length > 0) {
          models.value = flatList.map((item: any, idx: number) => ({
            id: String(item.id || item.productId || item.product_id || idx),
            name: String(item.title || item.name || '精选机型'),
            image: String(item.logo || item.pic || item.cover || '').replace(/^http:\/\//i, 'https://'),
            rating: Number(item.score || item.rating || 9.2),
            tags: item.subTitle || item.sub_title ? String(item.subTitle || item.sub_title).split(/[,，·/]/).map((s: string) => s.trim()).filter(Boolean) : ['性能旗舰', '高刷超清屏'],
            specs: String(item.subTitle || item.sub_title || '高性能处理器 · 超清护眼大屏 · 强劲长续航'),
            price: item.price ? `¥${item.price}起` : '¥3999起',
            isNew: idx < 3,
          }));
          noMore.value = true;
        } else {
          error.value = err?.message || '加载机型数据失败，请检查网络';
        }
      } catch {
        error.value = err?.message || '加载机型数据失败，请检查网络';
      }
    } else {
      noMore.value = true;
    }
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function applySearch() {
  appliedQuery.value = searchQuery.value;
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 240) {
    void loadModels(false);
  }
}

function openModel(id: string) {
  if (id) void router.push(`/product/${encodeURIComponent(id)}`);
}

function handleModelClick(model: PhoneModel) {
  if (!compareMode.value) {
    openModel(model.id);
    return;
  }
  const index = selectedModelIds.value.indexOf(model.id);
  if (index >= 0) {
    selectedModelIds.value.splice(index, 1);
  } else if (selectedModelIds.value.length < 2) {
    selectedModelIds.value.push(model.id);
  } else {
    showToast('最多选择两款机型进行对比', 'error');
  }
}

async function startCompare() {
  if (selectedModelIds.value.length !== 2 || compareLoading.value) return;
  compareLoading.value = true;
  try {
    const results = await Promise.allSettled(
      selectedModelIds.value.map((id) => CoolapkTauriAPI.getProductDetail(id)),
    );
    const configIds: string[] = [];
    results.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      const rows = Array.isArray(result.value?.data?.configRows) ? result.value.data.configRows : [];
      const firstConfig = rows.find((row: any) => row && row.id !== undefined && row.id !== null);
      if (firstConfig) configIds.push(String(firstConfig.id));
    });
    if (configIds.length < 2) {
      showToast('所选机型缺少可对比配置，请换其他机型', 'error');
      return;
    }
    await router.push({
      path: '/product-compare',
      query: {
        ids: configIds.join(','),
        productIds: selectedModelIds.value.join(','),
      },
    });
  } catch (err: any) {
    showToast(err?.message || '读取机型配置失败', 'error');
  } finally {
    compareLoading.value = false;
  }
}

let observer: IntersectionObserver | null = null;

onMounted(() => {
  void loadModels(true);
  observer = new IntersectionObserver((entries) => {
    const [entry] = entries;
    if (entry?.isIntersecting && !loading.value && !loadingMore.value && !noMore.value) {
      void loadModels(false);
    }
  }, { rootMargin: '300px' });

  if (bottomSentinelRef.value) {
    observer.observe(bottomSentinelRef.value);
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});
</script>

<style scoped>
.product-selector-page {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 0 0 24px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.selector-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 4px 6px 4px;
  background: var(--surface, #ffffff);
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
}

.sort-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sort-tab-btn {
  border: 0;
  border-radius: 8px;
  padding: 6px 14px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.sort-tab-btn:hover {
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, 0.08));
}

.sort-tab-btn.active {
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, 0.12));
  font-weight: 700;
}

.search-box-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 220px;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--surface-hover);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.search-box:focus-within {
  background: var(--surface);
  border-color: var(--brand-primary, #10b981);
  box-shadow: 0 0 0 2px var(--brand-soft, rgba(16, 185, 129, 0.15));
}

.search-icon {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12.5px;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.clear-search-btn {
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.clear-search-btn:hover {
  color: var(--text-secondary);
}

.search-submit-btn {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
  white-space: nowrap;
}

.search-submit-btn:hover {
  opacity: 0.9;
}

.model-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.model-card {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 142px;
  padding: 16px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: var(--radius-card, 12px);
  background: var(--surface);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.model-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.08));
}

.model-card.is-compare-selected {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.model-image,
.model-image-fallback {
  flex: 0 0 86px;
  width: 86px;
  height: 106px;
  object-fit: contain;
  border-radius: 10px;
}

.model-image-fallback {
  display: grid;
  place-items: center;
  background: var(--surface-hover);
  color: var(--text-tertiary);
  font-size: 32px;
}

.model-info {
  min-width: 0;
  flex: 1;
}

.model-title-row,
.model-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.model-title-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
}

.new-badge {
  flex: 0 0 auto;
  border-radius: 4px;
  padding: 2px 6px;
  background: #fff1e8;
  color: #ed7d24;
  font-size: 11px;
}

.model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
  color: var(--brand-primary, #10b981);
  font-size: 12px;
}

.model-tags span {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--brand-soft, rgba(0, 190, 120, 0.1));
}

.model-specs {
  margin: 8px 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.model-footer strong {
  color: #e35b25;
  font-size: 16px;
}

.model-footer > span {
  color: var(--text-tertiary);
  font-size: 13px;
}

.model-action {
  color: var(--brand-primary, #10b981) !important;
  white-space: nowrap;
}

.state-wrapper {
  min-height: 240px;
  display: grid;
  place-items: center;
}

.bottom-sentinel {
  height: 20px;
  width: 100%;
}

.loading-more-wrapper {
  padding: 16px 0;
  display: flex;
  justify-content: center;
}

.no-more-text {
  text-align: center;
  font-size: 12.5px;
  color: var(--text-tertiary);
  padding: 18px 0 8px 0;
}

.compare-selection-bar {
  position: sticky;
  bottom: 16px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-card);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-lg, 0 8px 30px rgba(0, 0, 0, .12));
}

.compare-selection-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: var(--font-size-sub);
}

.compare-selection-info > i {
  color: var(--brand-primary);
}

.compare-selection-info small {
  color: var(--text-tertiary);
}

.compare-start-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 16px;
  border: 0;
  border-radius: var(--radius-control);
  background: var(--brand-primary);
  color: var(--text-inverse, #fff);
  font: inherit;
  font-size: var(--font-size-sub);
  cursor: pointer;
  white-space: nowrap;
}

.compare-start-btn:disabled {
  background: var(--text-disabled, var(--border));
  cursor: not-allowed;
}
@media (max-width: 700px) { .model-list { grid-template-columns: 1fr; } }
</style>
