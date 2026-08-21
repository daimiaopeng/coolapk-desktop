<template>
  <div class="product-selector-page page-container custom-scrollbar">
    <header class="selector-header">
      <div>
        <h2 class="page-title"><i class="fas fa-mobile-screen-button icon"></i>机型搜索</h2>
        <p>按评分、芯片、电池、价格和发布时间浏览酷安机型数据</p>
      </div>
      <button type="button" class="system-link" @click="openInSystem">
        <i class="fas fa-external-link-alt"></i> 系统浏览器
      </button>
    </header>

    <section class="selector-toolbar">
      <div class="search-row">
        <i class="fas fa-search"></i>
        <input v-model="searchQuery" type="search" placeholder="请输入你需要搜索的型号" @keyup.enter="applySearch" />
        <button type="button" @click="applySearch">搜索</button>
      </div>
      <div class="sort-row" role="tablist" aria-label="排序方式">
        <button
          v-for="option in sortOptions"
          :key="option.key"
          type="button"
          :class="{ active: sortBy === option.key }"
          @click="sortBy = option.key"
        >
          {{ option.label }}
        </button>
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
        @click="openModel(model.id)"
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
            <span class="model-action">查看详情 <i class="fas fa-chevron-right"></i></span>
          </div>
        </div>
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppImage from '../components/common/AppImage.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import LoadingState from '../components/common/LoadingState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';

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
const loading = ref(false);
const error = ref('');
const searchQuery = ref('');
const appliedQuery = ref('');
const sortBy = ref<'综合' | '热度' | '评分' | '关注数'>('综合');
const models = ref<PhoneModel[]>([]);

const sortOptions = [
  { key: '综合', label: '综合' },
  { key: '热度', label: '热度' },
  { key: '评分', label: '评分' },
  { key: '关注数', label: '关注数' },
] as const;

const sourceUrl = computed(() => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string' && value) query.set(key, value);
  }
  if (!query.has('callFunction')) query.set('callFunction', 'indexSearch');
  return `https://m.coolapk.com/mp/productSelector/configSearch?${query.toString()}`;
});

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

async function loadModels() {
  loading.value = true;
  error.value = '';
  try {
    const response: any = await CoolapkTauriAPI.fetchExternalPage(sourceUrl.value);
    const html = String(response?.data?.html || '');
    const document = new DOMParser().parseFromString(html, 'text/html');
    models.value = Array.from(document.querySelectorAll('.phone-item'))
      .map(parseModel)
      .filter((model) => model.name);
    if (!models.value.length) throw new Error('服务端没有返回机型列表');
  } catch (err: any) {
    error.value = err?.message || '加载机型数据失败，请检查网络';
  } finally {
    loading.value = false;
  }
}

function applySearch() {
  appliedQuery.value = searchQuery.value;
}

function openModel(id: string) {
  if (id) void router.push(`/product/${encodeURIComponent(id)}`);
}

function openInSystem() {
  void CoolapkTauriAPI.openUrl(sourceUrl.value, 'system');
}

onMounted(() => { void loadModels(); });
</script>

<style scoped>
.product-selector-page {
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
.selector-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 18px; }
.page-title { margin: 0; color: var(--text-primary); font-size: var(--font-size-title-lg, 24px); }
.page-title .icon { color: var(--brand-primary, #10b981); margin-right: 10px; }
.selector-header p { margin: 6px 0 0; color: var(--text-secondary); }
.system-link { border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; font: inherit; white-space: nowrap; }
.system-link:hover { color: var(--brand-primary, #10b981); }
.selector-toolbar { display: flex; flex-direction: column; gap: 14px; align-items: stretch; padding: 14px; background: var(--surface); border: 1px solid var(--border-light, rgba(0,0,0,.08)); border-radius: var(--radius-card, 12px); }
.search-row { width: 100%; display: flex; align-items: center; gap: 10px; min-width: 0; padding: 0 12px; box-sizing: border-box; background: var(--surface-hover); border-radius: 9px; }
.search-row input { flex: 1; min-width: 0; height: 40px; border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; }
.search-row button { border: 0; border-radius: 7px; padding: 7px 14px; background: var(--brand-primary, #10b981); color: #fff; cursor: pointer; }
.sort-row { display: flex; gap: 4px; }
.sort-row button { border: 0; border-radius: 7px; padding: 8px 12px; background: transparent; color: var(--text-secondary); cursor: pointer; }
.sort-row button.active { background: var(--brand-soft, rgba(0, 190, 120, .12)); color: var(--brand-primary, #10b981); font-weight: 700; }
.model-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.model-card { display: flex; align-items: center; gap: 16px; min-height: 142px; padding: 16px; border: 1px solid var(--border-light, rgba(0,0,0,.08)); border-radius: var(--radius-card, 12px); background: var(--surface); color: var(--text-primary); text-align: left; cursor: pointer; transition: transform .16s ease, box-shadow .16s ease; }
.model-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md, 0 8px 24px rgba(0,0,0,.08)); }
.model-image, .model-image-fallback { flex: 0 0 86px; width: 86px; height: 106px; object-fit: contain; border-radius: 10px; }
.model-image-fallback { display: grid; place-items: center; background: var(--surface-hover); color: var(--text-tertiary); font-size: 32px; }
.model-info { min-width: 0; flex: 1; }
.model-title-row, .model-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.model-title-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; }
.new-badge { flex: 0 0 auto; border-radius: 4px; padding: 2px 6px; background: #fff1e8; color: #ed7d24; font-size: 11px; }
.model-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; color: var(--primary); font-size: 12px; }
.model-tags span { padding: 2px 6px; border-radius: 4px; background: var(--primary-soft, rgba(0, 190, 120, .1)); }
.model-specs { margin: 8px 0; color: var(--text-secondary); font-size: 13px; line-height: 1.5; }
.model-footer strong { color: #e35b25; font-size: 16px; }
.model-footer > span { color: var(--text-tertiary); font-size: 13px; }
.model-action { color: var(--primary) !important; white-space: nowrap; }
.state-wrapper { min-height: 260px; display: grid; place-items: center; }
@media (max-width: 700px) { .selector-header { align-items: flex-start; flex-direction: column; } .model-list { grid-template-columns: 1fr; } }
</style>
