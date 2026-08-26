<template>
  <div class="digital-page page-container">
    <FeedTabs v-if="digitalTabs.length" :active-key="selectedTabKey" :tabs="digitalTabNavItems" :show-manage="false" @update:active-key="selectDigitalTabByKey" />

    <nav v-if="visibleDigitalSubtabs.length" class="digital-subtabs" aria-label="数码服务端子栏目">
      <button v-for="item in visibleDigitalSubtabs" :key="subtabKey(item)" type="button" :class="['digital-subtab', { active: selectedSubtabKey === subtabKey(item) }]" @click="selectDigitalSubtab(item)">
        <span>{{ entityTitle(item) || '子栏目' }}</span>
      </button>
    </nav>

    <div v-if="configLoading && !selectedTab" class="digital-config-state"><LoadingState text="正在获取数码服务端栏目..." /></div>
    <div v-else-if="configError && !selectedTab" class="digital-config-state"><ErrorState title="数码栏目加载失败" :message="configError" @retry="loadDigitalConfig" /></div>
    <section v-else-if="selectedTabWebUrl" class="digital-web-route">
      <i class="fas fa-globe"></i>
      <div>
        <strong>该数码栏目由网页内容提供</strong>
        <span>{{ selectedTabWebUrl }}</span>
      </div>
      <button type="button" @click="openWeb(selectedTabWebUrl)">打开页面</button>
    </section>

    <template v-else-if="isCategoryTab || isDynamicCategoryView">
      <div class="digital-body">
      <aside class="digital-sidebar">
        <div class="sidebar-toolbar">
          <div v-if="isCategoryTab" class="mode-switch" role="tablist" aria-label="数码服务端分类模式">
            <button v-for="mode in modes" :key="mode.key" type="button" role="tab" :aria-selected="activeMode === mode.key" :class="['mode-button', { active: activeMode === mode.key }]" @click="switchMode(mode.key)">
              <i :class="mode.icon"></i>
              {{ mode.label }}
            </button>
          </div>
          <div v-else class="dynamic-mode-label"><i class="fas fa-layer-group"></i><span>数码栏目</span><button type="button" aria-label="返回数码首页" title="返回数码首页" @click="clearDynamicCategoryView"><i class="fas fa-arrow-left"></i></button></div>
          <label class="digital-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input v-model="searchQuery" type="search" :placeholder="isCategoryTab ? activeMode === 'brand' ? '搜索品牌' : '搜索分类' : '搜索数码栏目'" :aria-label="isCategoryTab ? activeMode === 'brand' ? '搜索品牌' : '搜索分类' : '搜索数码栏目'" @keydown.esc="searchQuery = ''" />
            <button v-if="searchQuery" type="button" aria-label="清除搜索" @click="searchQuery = ''"><i class="fas fa-times"></i></button>
          </label>
        </div>

        <template v-if="isCategoryTab">
          <div v-if="sideLoading" class="digital-state"><LoadingState text="正在获取服务端列表..." /></div>
          <div v-else-if="sideError" class="digital-state"><ErrorState title="列表加载失败" message="无法获取服务端数码列表" @retry="loadSide" /></div>
          <div v-else-if="filteredSideItems.length === 0" class="digital-state"><EmptyState title="暂无服务端数据" description="当前模式没有可展示的品牌或分类" /></div>
          <nav v-else class="digital-side-list" aria-label="数码品牌或分类">
            <button v-for="item in filteredSideItems" :key="sideItemKey(item)" type="button" :class="['digital-side-item', { active: selectedId === sideItemKey(item) }]" @click="selectSide(item)">
              <span v-if="isHotSideItem(item)" class="digital-side-logo-fallback digital-side-hot-logo"><i class="fas fa-fire" aria-hidden="true"></i></span>
              <AppImage v-else-if="sideLogo(item)" :src="sideLogo(item)" fit="contain" image-class="digital-side-logo" />
              <span v-else class="digital-side-logo-fallback"><i class="fas fa-microchip"></i></span>
              <span class="digital-side-name">{{ item.title || item.name || '未命名' }}</span>
              <span v-if="productCount(item)" class="digital-side-count">{{ formatCount(productCount(item)) }}</span>
            </button>
          </nav>
        </template>
        <template v-else>
          <div v-if="filteredDynamicCategoryItems.length === 0" class="digital-state"><EmptyState title="暂无数码栏目" description="当前数码页面没有可展示的分类入口" /></div>
          <nav v-else class="digital-side-list" aria-label="数码服务端栏目">
            <button v-for="(item, index) in filteredDynamicCategoryItems" :key="dynamicCategoryItemKey(item, index)" type="button" :class="['digital-side-item', { active: dynamicCategorySelectedKey === dynamicCategoryItemKey(item, index) }]" @click="selectDynamicCategory(item)">
              <AppImage v-if="getEntityImage(item)" :src="getEntityImage(item)" fit="contain" image-class="digital-side-logo" />
              <span v-else class="digital-side-logo-fallback"><i :class="getEntityFallbackIcon(item)"></i></span>
              <span class="digital-side-name">{{ entityTitle(item) || '未命名栏目' }}</span>
            </button>
          </nav>
        </template>
      </aside>

      <main ref="productScrollContainer" class="digital-content" @scroll.passive="handleScroll">
        <template v-if="isCategoryTab">
          <div v-if="!selected" class="digital-content-empty"><i class="fas fa-arrow-left"></i><span>从左侧选择服务端品牌或分类</span></div>
          <template v-else>
            <div v-if="productLoading && products.length === 0" class="digital-result-state"><DiscoverySkeleton /></div>
            <div v-else-if="productError && products.length === 0" class="digital-result-state"><ErrorState title="数码页面加载失败" :message="productError" @retry="loadProducts" /></div>
            <div v-else-if="products.length === 0" class="digital-result-state"><EmptyState title="服务端暂未返回内容" description="该品牌或分类当前没有可展示的数码内容" /></div>
            <div v-else class="digital-result-list">
              <template v-for="(block, index) in displayBlocks" :key="blockKey(block, index)">
                <DigitalSeriesTitle v-if="block.kind === 'title'" :title="block.title || ''" />
                <DigitalSeriesMore v-else-if="block.kind === 'more' && block.entity" :label="entityTitle(block.entity)" @open="openEntity(block.entity)" />
                <div v-else-if="block.kind === 'products'" :class="['series-products', displayMode === 'horizontal' ? 'horizontal' : 'vertical']">
                  <template v-if="displayMode === 'vertical'">
                    <DigitalProductCard v-for="(product, productIndex) in block.items" :key="getEntityKey(product, productIndex)" :product="product" layout="vertical" @open="openEntity" />
                  </template>
                  <DigitalProductRow v-else :products="block.items" :more="block.more" @open="openEntity" />
                </div>
                <DiscoveryEntityCard v-else-if="block.entity" :entity="block.entity" @open="openEntity" />
              </template>
              <div ref="productBottomSentinel" class="digital-pagination">
                <LoadingState v-if="productLoading" text="正在加载更多服务端内容..." />
                <button v-else-if="productError" type="button" class="inline-retry" @click="loadProducts(true)">加载失败，点击重试</button>
                <span v-else-if="productNoMore">没有更多服务端内容了</span>
              </div>
            </div>
          </template>
        </template>
        <template v-else>
          <div v-if="dynamicCategoryLoading && dynamicCategoryItems.length === 0" class="digital-result-state"><DiscoverySkeleton /></div>
          <div v-else-if="dynamicCategoryError && dynamicCategoryItems.length === 0" class="digital-result-state"><ErrorState title="数码栏目加载失败" :message="dynamicCategoryError" @retry="loadDynamicCategory" /></div>
          <div v-else-if="dynamicCategoryItems.length === 0" class="digital-result-state"><EmptyState title="服务端暂未返回内容" description="该数码栏目当前没有可展示的内容" /></div>
          <div v-else class="digital-result-list">
            <template v-for="(block, index) in dynamicCategoryBlocks" :key="`dynamic-category-${blockKey(block, index)}`">
              <DigitalSeriesTitle v-if="block.kind === 'title'" :title="block.title || ''" />
              <DigitalSeriesMore v-else-if="block.kind === 'more' && block.entity" :label="entityTitle(block.entity)" @open="openEntity(block.entity)" />
              <div v-else-if="block.kind === 'products'" class="series-products vertical">
                <DigitalProductCard v-for="(product, productIndex) in block.items" :key="getEntityKey(product, productIndex)" :product="product" layout="vertical" @open="openEntity" />
              </div>
              <DiscoveryEntityCard v-else-if="block.entity" :entity="block.entity" @open="openEntity" />
            </template>
            <div ref="dynamicCategoryBottomSentinel" class="digital-pagination">
              <LoadingState v-if="dynamicCategoryLoading" text="正在加载更多服务端内容..." />
              <button v-else-if="dynamicCategoryError" type="button" class="inline-retry" @click="loadDynamicCategory(true)">加载失败，点击重试</button>
              <span v-else-if="dynamicCategoryNoMore">没有更多服务端内容了</span>
            </div>
          </div>
        </template>
      </main>
      </div>
    </template>

    <main ref="tabScrollContainer" v-else class="digital-server-content" @scroll.passive="handleTabScroll">
      <div v-if="tabLoading && tabItems.length === 0" class="digital-result-state"><DiscoverySkeleton /></div>
      <div v-else-if="tabError && tabItems.length === 0" class="digital-result-state"><ErrorState title="数码页面加载失败" :message="tabError" @retry="loadTabItems" /></div>
      <div v-else-if="tabItems.length === 0" class="digital-result-state"><EmptyState title="服务端暂未返回内容" description="该数码栏目当前没有可展示的内容" /></div>
      <div v-else class="digital-server-list">
        <template v-for="(block, index) in tabDisplayBlocks" :key="`tab-${blockKey(block, index)}`">
          <DigitalSeriesTitle v-if="block.kind === 'title'" :title="block.title || ''" />
          <DigitalSeriesMore v-else-if="block.kind === 'more' && block.entity" :label="entityTitle(block.entity)" @open="openEntity(block.entity)" />
          <div v-else-if="block.kind === 'products'" class="digital-server-products">
            <DigitalProductCard v-for="(product, productIndex) in block.items" :key="getEntityKey(product, productIndex)" :product="product" layout="vertical" @open="openEntity" />
          </div>
          <DiscoveryEntityCard v-else-if="block.entity" :entity="block.entity" @open="openEntity" />
        </template>
        <div ref="tabBottomSentinel" class="digital-pagination">
          <LoadingState v-if="tabLoading" text="正在加载更多服务端内容..." />
          <button v-else-if="tabError" type="button" class="inline-retry" @click="loadTabItems(true)">加载失败，点击重试</button>
          <span v-else-if="tabNoMore">没有更多服务端内容了</span>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import LoadingState from '../components/common/LoadingState.vue';
import DiscoveryEntityCard from '../components/discovery/DiscoveryEntityCard.vue';
import DiscoverySkeleton from '../components/discovery/DiscoverySkeleton.vue';
import FeedTabs from '../components/feed/FeedTabs.vue';
import DigitalProductCard from '../components/digital/DigitalProductCard.vue';
import DigitalProductRow from '../components/digital/DigitalProductRow.vue';
import DigitalSeriesMore from '../components/digital/DigitalSeriesMore.vue';
import DigitalSeriesTitle from '../components/digital/DigitalSeriesTitle.vue';
import type { DiscoveryEntity, DiscoveryPageResult } from '../types/discovery';
import type { ProductBrand } from '../types/product';
import type { ConfigPageTab } from '../types/settings';
import { decodeDiscoveryRouteSegment, getEntityFallbackIcon, getEntityImage, getEntityKey, parseDiscoveryPage, resolveDiscoveryRoute } from '../utils/discovery';
import { getDigitalEntityTitle, isDigitalProduct, isDigitalSeriesMore, isDigitalSeriesTitle } from '../utils/digitalProduct';
import { getFallbackDigitalTabs, parseDigitalConfig, removeRedundantFirstDigitalTab, resolveDefaultDigitalTabKey } from '../utils/digitalTabs';
import type { DigitalTab } from '../utils/digitalTabs';

type DigitalMode = 'brand' | 'category';
type DisplayMode = 'vertical' | 'horizontal';
type DigitalBlock = { kind: 'title' | 'more' | 'products' | 'entity'; title?: string; items: DiscoveryEntity[]; entity?: DiscoveryEntity; more?: DiscoveryEntity };

const router = useRouter();
const modes: Array<{ key: DigitalMode; label: string; icon: string }> = [
  { key: 'brand', label: '品牌', icon: 'fas fa-tags' },
  { key: 'category', label: '分类', icon: 'fas fa-layer-group' },
];
const activeMode = ref<DigitalMode>('brand');
const displayMode = ref<DisplayMode>('vertical');
const digitalTabs = ref<DigitalTab[]>([]);
const selectedTabKey = ref('');
const selectedSubtabKey = ref('');
const configLoading = ref(false);
const configError = ref('');
const sideItems = ref<ProductBrand[]>([]);
const selected = ref<ProductBrand | null>(null);
const selectedId = ref('');
const searchQuery = ref('');
const sideLoading = ref(false);
const sideError = ref(false);
const products = ref<DiscoveryEntity[]>([]);
const productLoading = ref(false);
const productError = ref('');
const productNoMore = ref(false);
const productPage = ref(1);
const firstItem = ref('');
const lastItem = ref('');
const selectionVersion = ref(0);
const tabItems = ref<DiscoveryEntity[]>([]);
const tabLoading = ref(false);
const tabError = ref('');
const tabNoMore = ref(false);
const tabPage = ref(1);
const tabFirstItem = ref('');
const tabLastItem = ref('');
const tabSelectionVersion = ref(0);
const dynamicCategorySelected = ref<DiscoveryEntity | null>(null);
const dynamicCategoryItems = ref<DiscoveryEntity[]>([]);
const dynamicCategoryLoading = ref(false);
const dynamicCategoryError = ref('');
const dynamicCategoryNoMore = ref(false);
const dynamicCategoryPage = ref(1);
const dynamicCategoryFirstItem = ref('');
const dynamicCategoryLastItem = ref('');
const dynamicCategorySelectionVersion = ref(0);
const productScrollContainer = ref<HTMLElement | null>(null);
const productBottomSentinel = ref<HTMLElement | null>(null);
const dynamicCategoryBottomSentinel = ref<HTMLElement | null>(null);
const tabScrollContainer = ref<HTMLElement | null>(null);
const tabBottomSentinel = ref<HTMLElement | null>(null);
let requestVersion = 0;
let loadingSelectionVersion = -1;
let tabRequestVersion = 0;
let loadingTabSelectionVersion = -1;
let dynamicCategoryRequestVersion = 0;
let loadingDynamicCategorySelectionVersion = -1;
let productObserver: IntersectionObserver | null = null;
let dynamicCategoryObserver: IntersectionObserver | null = null;
let tabObserver: IntersectionObserver | null = null;

const selectedTab = computed(() => digitalTabs.value.find((tab) => tab.key === selectedTabKey.value) || null);
const digitalTabNavItems = computed<ConfigPageTab[]>(() => digitalTabs.value.map((tab) => ({ title: tab.title, page_name: tab.key, url: tab.url || tab.key })));
const isCategoryTab = computed(() => selectedTab.value?.category === true);
const isDynamicCategoryView = computed(() => !isCategoryTab.value && Boolean(dynamicCategorySelected.value));
const digitalSubtabs = computed(() => selectedTab.value?.rawEntities.filter((entity) => String(entity.url || entity.pageName || entity.page_name || entity.webUrl || entity.web_url || '').trim()) || []);
const digitalTabTargets = computed(() => new Set(digitalTabs.value.flatMap((tab) => [tab.key, tab.pageName, tab.url, tab.webUrl].map(normalizeDigitalTarget).filter(Boolean))));
const visibleDigitalSubtabs = computed(() => digitalSubtabs.value.filter((entity) => {
  const target = normalizeDigitalTarget(entity.url || entity.pageName || entity.page_name || entity.webUrl || entity.web_url);
  return target && (!digitalTabTargets.value.has(target) || Object.keys(getDigitalRequestArgs(entity)).length > 0);
}));
const selectedSubtab = computed(() => digitalSubtabs.value.find((entity) => subtabKey(entity) === selectedSubtabKey.value) || null);
const selectedTabTitle = computed(() => String(selectedSubtab.value?.title || selectedTab.value?.title || '数码'));
const selectedTabSubTitle = computed(() => String(selectedSubtab.value?.subTitle || selectedSubtab.value?.sub_title || selectedTab.value?.subTitle || ''));
const selectedTabTarget = computed(() => {
  const entityUrl = normalizeDigitalTarget(selectedSubtab.value?.url || selectedSubtab.value?.pageName || selectedSubtab.value?.page_name);
  if (entityUrl && !isWebUrl(entityUrl)) return entityUrl;
  return normalizeDigitalTarget(selectedTab.value?.url || selectedTab.value?.pageName || selectedTab.value?.key);
});
const selectedTabWebUrl = computed(() => {
  const entityUrl = normalizeDigitalTarget(selectedSubtab.value?.webUrl || selectedSubtab.value?.web_url || selectedSubtab.value?.url);
  if (isWebUrl(entityUrl)) return entityUrl;
  return normalizeDigitalTarget(selectedTab.value?.webUrl);
});
const selectedRequestArgs = computed<Record<string, unknown>>(() => getDigitalRequestArgs(selectedSubtab.value || selectedTab.value?.raw));

const filteredSideItems = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return sideItems.value;
  return sideItems.value.filter((item) => `${item.title || ''} ${item.name || ''}`.toLocaleLowerCase().includes(query));
});

const dynamicCategorySourceItems = computed(() => {
  if (!selectedTab.value || selectedTab.value.category) return [];
  const grid = tabItems.value.find((item) => isDynamicCategoryGrid(item));
  return (grid?.entities || []).filter((item) => Boolean(dynamicCategoryTarget(item)));
});
const filteredDynamicCategoryItems = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return dynamicCategorySourceItems.value;
  return dynamicCategorySourceItems.value.filter((item) => entityTitle(item).toLocaleLowerCase().includes(query));
});
const dynamicCategorySelectedKey = computed(() => dynamicCategorySelected.value ? dynamicCategoryItemKey(dynamicCategorySelected.value) : '');

function asResponseList(response: unknown): ProductBrand[] {
  if (Array.isArray(response)) return response.filter(Boolean) as ProductBrand[];
  if (response && typeof response === 'object' && Array.isArray((response as { data?: unknown }).data)) return (response as { data: unknown[] }).data.filter(Boolean) as ProductBrand[];
  return [];
}

function sideItemKey(item: ProductBrand): string {
  return String(item.id ?? item.entityId ?? item.url ?? item.title ?? item.name ?? '');
}

function sideLogo(item: ProductBrand): string {
  return String(item.logo || item.pic || '');
}

function isHotSideItem(item: ProductBrand): boolean {
  return String(item.title || item.name || '').trim() === '热门';
}

function productCount(item: ProductBrand): number {
  const value = Number(item.product_num ?? item.series_num ?? 0);
  return Number.isFinite(value) ? value : 0;
}

const entityTitle = getDigitalEntityTitle;

function dynamicCategoryItemKey(item: DiscoveryEntity, index = 0): string {
  return getEntityKey(item, index);
}

function isDynamicCategoryGrid(item: DiscoveryEntity): boolean {
  const template = `${String(item.entityTemplate || '').toLowerCase()} ${String(item.entityType || '').toLowerCase()}`;
  return Array.isArray(item.entities) && (template.includes('iconlinkgrid') || template.includes('icontablinkgrid') || template.includes('tablinkgrid'));
}

function dynamicCategoryTarget(item: DiscoveryEntity): string {
  const route = resolveDiscoveryRoute(item);
  return route?.kind === 'data-list' && isDigitalCategoryRoute(route.target) ? normalizeDigitalTarget(route.target) : '';
}

function dynamicCategoryContentTarget(item: DiscoveryEntity): string {
  const target = dynamicCategoryTarget(item);
  if (!target) return '';
  const [path, query = ''] = target.split('?', 2);
  if (!/^\/product\/categoryList$/i.test(path)) return target;
  const id = new URLSearchParams(query).get('id')?.trim();
  if (!id) return target;
  // 数码首页下发的分类链接指向分类目录，详情内容需要沿用同一个分类 ID 请求服务端详情页。
  return `/page?url=${encodeURIComponent(`/product/categoryDetailList?type=category&id=${id}&showMode=0`)}`;
}

function isWebUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function subtabKey(entity: DiscoveryEntity, index = 0): string {
  return String(entity.entityId ?? entity.entity_id ?? entity.id ?? entity.url ?? entity.webUrl ?? entity.web_url ?? entity.title ?? `subtab-${index}`);
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function getDigitalRequestArgs(entity: DiscoveryEntity | undefined): Record<string, unknown> {
  if (!entity) return {};
  const extra = parseRecord(entity.extraData ?? entity.extra_data);
  const requestArgs = entity.requestArgs ?? entity.request_args ?? entity.requestParams ?? entity.request_params ?? entity.params ?? entity.queryParams ?? entity.query_params ?? extra.requestArgs ?? extra.request_args ?? extra.requestParams ?? extra.request_params ?? extra.params ?? extra.queryParams ?? extra.query_params;
  const parsed = parseRecord(requestArgs);
  if (Object.keys(parsed).length > 0) return parsed;
  const pageParam = entity.pageParam ?? entity.page_param ?? extra.pageParam ?? extra.page_param;
  return pageParam === undefined || pageParam === null || pageParam === '' ? {} : { pageParam };
}

function selectDigitalSubtab(entity: DiscoveryEntity) {
  const key = subtabKey(entity);
  if (selectedSubtabKey.value === key) return;
  selectedSubtabKey.value = key;
  if (selectedTab.value) localStorage.setItem(`coolapk.digital.subtab.${selectedTab.value.key}`, key);
  resetTabItems();
  if (!selectedTabWebUrl.value) void loadTabItems(false, tabSelectionVersion.value);
}

function buildPageContext(kind: string, tab: DigitalTab | null, entity: DiscoveryEntity | null = null): string {
  return JSON.stringify({ source: 'desktop-digital', kind, tab: tab?.key || '', pageName: tab?.pageName || '', subTab: entity ? subtabKey(entity) : '', entityId: entity?.entityId ?? entity?.id ?? '' });
}

function buildBlocks(items: DiscoveryEntity[], mode: DisplayMode): DigitalBlock[] {
  const blocks: DigitalBlock[] = [];
  const pending: DiscoveryEntity[] = [];
  const flushProducts = (more?: DiscoveryEntity) => {
    if (pending.length === 0) return;
    blocks.push({ kind: 'products', items: pending.splice(0), more });
  };
  for (const item of items) {
    if (isDigitalSeriesTitle(item)) {
      flushProducts();
      blocks.push({ kind: 'title', title: entityTitle(item), items: [] });
    } else if (isDigitalProduct(item)) {
      if (mode === 'vertical') {
        flushProducts();
        blocks.push({ kind: 'products', items: [item] });
      } else {
        pending.push(item);
        if (pending.length === 3) flushProducts();
      }
    } else if (isDigitalSeriesMore(item)) {
      if (mode === 'horizontal') {
        if (pending.length > 0) flushProducts(item);
        else blocks.push({ kind: 'products', items: [], more: item });
      } else {
        flushProducts();
        blocks.push({ kind: 'more', items: [], entity: item });
      }
    } else {
      flushProducts();
      blocks.push({ kind: 'entity', items: [], entity: item });
    }
  }
  flushProducts();
  return blocks;
}

const displayBlocks = computed(() => buildBlocks(products.value, displayMode.value));
const tabDisplayBlocks = computed(() => buildBlocks(tabItems.value, 'vertical'));
const dynamicCategoryBlocks = computed(() => buildBlocks(dynamicCategoryItems.value, 'vertical'));

function blockKey(block: DigitalBlock, index: number): string {
  if (block.entity) return `entity-${getEntityKey(block.entity, index)}`;
  if (block.kind === 'products' && block.items[0]) return `products-${getEntityKey(block.items[0], index)}`;
  return `${block.kind}-${index}`;
}

function resetTabItems() {
  tabSelectionVersion.value += 1;
  tabItems.value = [];
  tabError.value = '';
  tabNoMore.value = false;
  tabPage.value = 1;
  tabFirstItem.value = '';
  tabLastItem.value = '';
}

async function loadDigitalConfig() {
  configLoading.value = true;
  configError.value = '';
  try {
    const response = await CoolapkTauriAPI.getTabConfig();
    const parsed = parseDigitalConfig(response);
    const normalizedTabs = removeRedundantFirstDigitalTab(parsed.tabs.length ? parsed.tabs : getFallbackDigitalTabs());
    digitalTabs.value = normalizedTabs.tabs;
    const defaultTabKey = resolveDefaultDigitalTabKey(digitalTabs.value, parsed.selectedKey, normalizedTabs.removedKey);
    if (!selectedTabKey.value || !digitalTabs.value.some((tab) => tab.key === selectedTabKey.value)) selectedTabKey.value = defaultTabKey;
  } catch (error) {
    configError.value = error instanceof Error ? error.message : '无法获取服务端数码栏目';
    digitalTabs.value = getFallbackDigitalTabs();
    console.warn('加载数码服务端栏目失败，使用协议默认栏目', error);
  } finally {
    configLoading.value = false;
  }
  const nextTab = digitalTabs.value.find((tab) => tab.key === selectedTabKey.value) || digitalTabs.value[0];
  if (!nextTab) return;
  selectedTabKey.value = nextTab.key;
  selectedSubtabKey.value = '';
  searchQuery.value = '';
  clearDynamicCategoryView();
  if (nextTab.category) activeMode.value = 'category';
  else displayMode.value = 'vertical';
  resetProducts();
  resetTabItems();
  if (nextTab.category) await loadSide(true);
  else await loadTabItems(false, tabSelectionVersion.value);
}

function selectDigitalTab(tab: DigitalTab) {
  if (selectedTabKey.value === tab.key && !tab.category && isDynamicCategoryView.value) {
    clearDynamicCategoryView();
    return;
  }
  if (selectedTabKey.value === tab.key && ((tab.category && activeMode.value === 'category' && sideItems.value.length > 0) || (!tab.category && tabItems.value.length > 0))) return;
  selectedTabKey.value = tab.key;
  selectedSubtabKey.value = '';
  searchQuery.value = '';
  clearDynamicCategoryView();
  if (tab.category) activeMode.value = 'category';
  else displayMode.value = 'vertical';
  resetProducts();
  resetTabItems();
  if (tab.category) void loadSide(true);
  else void loadTabItems(false, tabSelectionVersion.value);
}

function selectDigitalTabByKey(key: string) {
  const tab = digitalTabs.value.find((item) => item.key === key);
  if (tab) selectDigitalTab(tab);
}

async function loadTabItems(isLoadMore = false, expectedSelectionVersion = tabSelectionVersion.value) {
  const tab = selectedTab.value;
  if (!tab || tab.category || selectedTabWebUrl.value || expectedSelectionVersion !== tabSelectionVersion.value) return;
  if (tabLoading.value && loadingTabSelectionVersion === expectedSelectionVersion) return;
  if (tabNoMore.value) return;
  tabLoading.value = true;
  tabError.value = '';
  const currentRequest = ++tabRequestVersion;
  const tabKey = tab.key;
  loadingTabSelectionVersion = expectedSelectionVersion;
  try {
    const response = await CoolapkTauriAPI.getDiscoveryPageData({ url: selectedTabTarget.value || tab.pageName || tab.key, title: selectedTabTitle.value, subTitle: selectedTabSubTitle.value, page: tabPage.value, firstItem: tabFirstItem.value, lastItem: tabLastItem.value, pageContext: buildPageContext('digital-tab', tab, selectedSubtab.value), requestArgs: selectedRequestArgs.value });
    const parsed = parseDiscoveryPage(response, tabPage.value);
    if (expectedSelectionVersion !== tabSelectionVersion.value || tabKey !== selectedTabKey.value) return;
    const incoming = parsed.items;
    if (isLoadMore) {
      const existingKeys = new Set(tabItems.value.map((item, index) => getEntityKey(item, index)));
      tabItems.value = [...tabItems.value, ...incoming.filter((item, index) => !existingKeys.has(getEntityKey(item, tabItems.value.length + index)))];
    } else {
      tabItems.value = incoming;
    }
    tabFirstItem.value = parsed.firstItem;
    tabLastItem.value = parsed.lastItem;
    tabPage.value += 1;
    tabNoMore.value = incoming.length === 0 || !parsed.hasMore;
  } catch (error) {
    if (expectedSelectionVersion !== tabSelectionVersion.value || tabKey !== selectedTabKey.value) return;
    tabError.value = error instanceof Error ? error.message : '无法获取服务端数码栏目';
    console.warn('加载服务端数码栏目内容失败', error);
  } finally {
    if (currentRequest === tabRequestVersion) {
      tabLoading.value = false;
      loadingTabSelectionVersion = -1;
    }
  }
}

async function switchMode(mode: DigitalMode) {
  if (!isCategoryTab.value) return;
  if (activeMode.value === mode && sideItems.value.length > 0) return;
  activeMode.value = mode;
  searchQuery.value = '';
  sideItems.value = [];
  selected.value = null;
  selectedId.value = '';
  resetProducts();
  await loadSide();
}

async function loadSide(forceReload = false) {
  sideLoading.value = true;
  sideError.value = false;
  try {
    const response = activeMode.value === 'brand' ? await CoolapkTauriAPI.getProductBrandList() : await CoolapkTauriAPI.getProductCategoryList();
    sideItems.value = asResponseList(response).filter((item) => sideItemKey(item));
    const nextSelection = sideItems.value.find((item) => sideItemKey(item) === selectedId.value) || sideItems.value[0];
    if (nextSelection && (forceReload || !selected.value || sideItemKey(nextSelection) !== selectedId.value)) selectSide(nextSelection);
    if (!nextSelection) {
      selected.value = null;
      selectedId.value = '';
      resetProducts();
    }
  } catch (error) {
    sideError.value = true;
    console.warn('加载数码品牌/分类失败', error);
  } finally {
    sideLoading.value = false;
  }
}

function isDigitalCategoryRoute(target: string): boolean {
  return /^\/product\/categoryList(?:\?|$)/i.test(normalizeDigitalTarget(target));
}

function openDigitalCategory(entity: DiscoveryEntity, target: string): boolean {
  if (!selectedTab.value || selectedTab.value.category || dynamicCategorySourceItems.value.length === 0) return false;
  if (!dynamicCategoryTarget(entity) || normalizeDigitalTarget(target) !== dynamicCategoryTarget(entity)) return false;
  selectDynamicCategory(entity);
  return true;
}

function resetDynamicCategoryContent() {
  dynamicCategorySelectionVersion.value += 1;
  dynamicCategoryItems.value = [];
  dynamicCategoryError.value = '';
  dynamicCategoryNoMore.value = false;
  dynamicCategoryPage.value = 1;
  dynamicCategoryFirstItem.value = '';
  dynamicCategoryLastItem.value = '';
}

function clearDynamicCategoryView() {
  dynamicCategorySelected.value = null;
  searchQuery.value = '';
  resetDynamicCategoryContent();
}

function selectDynamicCategory(item: DiscoveryEntity) {
  if (!dynamicCategoryTarget(item)) return;
  if (dynamicCategorySelected.value && dynamicCategoryItemKey(dynamicCategorySelected.value) === dynamicCategoryItemKey(item) && dynamicCategoryItems.value.length > 0) return;
  dynamicCategorySelected.value = item;
  searchQuery.value = '';
  resetDynamicCategoryContent();
  void loadDynamicCategory(false, dynamicCategorySelectionVersion.value);
}

async function loadDynamicCategory(isLoadMore = false, expectedSelectionVersion = dynamicCategorySelectionVersion.value) {
  const selection = dynamicCategorySelected.value;
  const url = selection ? dynamicCategoryContentTarget(selection) : '';
  if (!selection || !url || expectedSelectionVersion !== dynamicCategorySelectionVersion.value) return;
  if (dynamicCategoryLoading.value && loadingDynamicCategorySelectionVersion === expectedSelectionVersion) return;
  if (dynamicCategoryNoMore.value) return;
  dynamicCategoryLoading.value = true;
  dynamicCategoryError.value = '';
  const currentRequest = ++dynamicCategoryRequestVersion;
  loadingDynamicCategorySelectionVersion = expectedSelectionVersion;
  try {
    const response = await CoolapkTauriAPI.getDiscoveryPageData({ url, title: entityTitle(selection), subTitle: String(selection.subTitle || selection.sub_title || ''), page: dynamicCategoryPage.value, firstItem: dynamicCategoryFirstItem.value, lastItem: dynamicCategoryLastItem.value, pageContext: buildPageContext('digital-category-page', selectedTab.value, selection), requestArgs: getDigitalRequestArgs(selection) });
    const parsed = parseDiscoveryPage(response, dynamicCategoryPage.value);
    if (expectedSelectionVersion !== dynamicCategorySelectionVersion.value || selection !== dynamicCategorySelected.value) return;
    const incoming = parsed.items;
    if (isLoadMore) {
      const existingKeys = new Set(dynamicCategoryItems.value.map((item, index) => getEntityKey(item, index)));
      dynamicCategoryItems.value = [...dynamicCategoryItems.value, ...incoming.filter((item, index) => !existingKeys.has(getEntityKey(item, dynamicCategoryItems.value.length + index)))];
    } else {
      dynamicCategoryItems.value = incoming;
    }
    dynamicCategoryFirstItem.value = parsed.firstItem;
    dynamicCategoryLastItem.value = parsed.lastItem;
    dynamicCategoryPage.value += 1;
    dynamicCategoryNoMore.value = incoming.length === 0 || !parsed.hasMore;
  } catch (error) {
    if (expectedSelectionVersion !== dynamicCategorySelectionVersion.value || selection !== dynamicCategorySelected.value) return;
    dynamicCategoryError.value = error instanceof Error ? error.message : '无法获取服务端数码栏目';
    console.warn('加载服务端数码分类内容失败', error);
  } finally {
    if (currentRequest === dynamicCategoryRequestVersion) {
      dynamicCategoryLoading.value = false;
      loadingDynamicCategorySelectionVersion = -1;
    }
  }
}

function resetProducts() {
  selectionVersion.value += 1;
  products.value = [];
  productError.value = '';
  productNoMore.value = false;
  productPage.value = 1;
  firstItem.value = '';
  lastItem.value = '';
}

function selectSide(item: ProductBrand) {
  selected.value = item;
  selectedId.value = sideItemKey(item);
  resetProducts();
  void loadProducts(false, selectionVersion.value);
}

function parseLegacyProducts(response: unknown, page: number): DiscoveryPageResult {
  const parsed = parseDiscoveryPage(response, page);
  if (response && typeof response === 'object' && !Array.isArray(response) && Array.isArray((response as { data?: unknown }).data)) return parsed;
  const items = asResponseList(response) as DiscoveryEntity[];
  return { items, page, hasMore: items.length >= 20, firstItem: String(items[0]?.entityId ?? items[0]?.id ?? ''), lastItem: String(items[items.length - 1]?.entityId ?? items[items.length - 1]?.id ?? ''), raw: response };
}

async function loadProducts(isLoadMore = false, expectedSelectionVersion = selectionVersion.value) {
  const selection = selected.value;
  if (!selection || expectedSelectionVersion !== selectionVersion.value) return;
  if (productLoading.value && loadingSelectionVersion === expectedSelectionVersion) return;
  if (productNoMore.value) return;
  productLoading.value = true;
  productError.value = '';
  const currentRequest = ++requestVersion;
  loadingSelectionVersion = expectedSelectionVersion;
  try {
    const url = String(selection.url || '').trim();
    if (!url && activeMode.value === 'category') throw new Error('服务端分类缺少数据地址');
    const response = url
      ? await CoolapkTauriAPI.getDiscoveryPageData({ url, title: String(selection.title || selection.name || ''), subTitle: String(selection.subTitle || ''), page: productPage.value, firstItem: firstItem.value, lastItem: lastItem.value, pageContext: buildPageContext(activeMode.value === 'brand' ? 'digital-brand' : 'digital-category', selectedTab.value, selection), requestArgs: getDigitalRequestArgs(selection) })
        : activeMode.value === 'brand'
        ? await CoolapkTauriAPI.getProductBrandProducts(String(selection.id ?? selection.entityId ?? ''), String(selection.type || 'recommend'), productPage.value, { firstItem: firstItem.value, lastItem: lastItem.value })
        : await CoolapkTauriAPI.getProductList(String(selection.pageName || ''), String(selection.title || selection.name || ''), String(selection.subTitle || ''), productPage.value, { firstItem: firstItem.value, lastItem: lastItem.value });
    const parsed = url ? parseDiscoveryPage(response, productPage.value) : parseLegacyProducts(response, productPage.value);
    if (expectedSelectionVersion !== selectionVersion.value || selection !== selected.value) return;
    const incoming = parsed.items;
    if (isLoadMore) {
      const existingKeys = new Set(products.value.map((item, index) => getEntityKey(item, index)));
      products.value = [...products.value, ...incoming.filter((item, index) => !existingKeys.has(getEntityKey(item, products.value.length + index)))];
    } else {
      products.value = incoming;
    }
    firstItem.value = parsed.firstItem;
    lastItem.value = parsed.lastItem;
    productPage.value += 1;
    productNoMore.value = incoming.length === 0 || !parsed.hasMore;
  } catch (error) {
    if (expectedSelectionVersion !== selectionVersion.value || selection !== selected.value) return;
    productError.value = error instanceof Error ? error.message : '无法获取服务端数码页面';
    console.warn('加载服务端数码页面失败', error);
  } finally {
    if (currentRequest === requestVersion) {
      productLoading.value = false;
      loadingSelectionVersion = -1;
    }
  }
}

function normalizeDigitalTarget(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const queryIndex = raw.indexOf('?');
  if (queryIndex >= 0) {
    const nested = new URLSearchParams(raw.slice(queryIndex + 1)).get('url');
    if (nested) return normalizeDigitalTarget(nested);
  }
  const clean = raw.replace(/^#/, '').trim();
  try {
    return decodeURIComponent(clean);
  } catch {
    return clean;
  }
}

function findDigitalTabForEntity(entity: DiscoveryEntity): DigitalTab | null {
  const entityTargets = [entity.url, entity.pageName, entity.page_name, entity.webUrl, entity.web_url].map(normalizeDigitalTarget).filter(Boolean);
  if (entityTargets.length === 0) return null;
  return digitalTabs.value.find((tab) => {
    const tabTargets = [tab.key, tab.pageName, tab.url, tab.webUrl].map(normalizeDigitalTarget).filter(Boolean);
    return entityTargets.some((target) => tabTargets.includes(target));
  }) || null;
}

function openEntity(entity: DiscoveryEntity) {
  const route = resolveDiscoveryRoute(entity);
  if (!route) return;
  if (isDigitalCategoryRoute(route.target) && openDigitalCategory(entity, route.target)) return;
  const digitalTab = findDigitalTabForEntity(entity);
  if (digitalTab) {
    selectDigitalTab(digitalTab);
    return;
  }
  if (route.kind === 'web') {
    void CoolapkTauriAPI.openUrl(route.target, 'internal');
  } else if (route.kind === 'native') {
    navigateNative(route.target, route.title || entityTitle(entity));
  } else {
    navigateDataList(route.target, route.title || entityTitle(entity));
  }
}

function openWeb(url: string) {
  if (isWebUrl(url)) void CoolapkTauriAPI.openUrl(url, 'internal');
}

function navigateDataList(target: string, title: string) {
  void router.push({ path: '/page', query: { url: target, title, renderer: 'discovery' } });
}

function navigateNative(target: string, title: string) {
  const clean = target.replace(/^#/, '');
  const user = clean.match(/^\/user\/([^/?#]+)/);
  const feed = clean.match(/^\/feed\/([^/?#]+)/);
  const app = clean.match(/^\/apk\/([^/?#]+)/);
  const product = clean.match(/^\/product\/([^/?#]+)/);
  const topic = clean.match(/^\/topic\/([^/?#]+)/);
  const dyh = clean.match(/^\/dyh\/([^/?#]+)/);
  if (user) void router.push(`/user/${user[1]}`);
  else if (feed) void router.push(`/feed/${feed[1]}`);
  else if (app) void router.push(`/app/${encodeURIComponent(decodeDiscoveryRouteSegment(app[1]))}`);
  else if (product) void router.push(`/product/${product[1]}`);
  else if (topic) void router.push(`/topic/${encodeURIComponent(decodeDiscoveryRouteSegment(topic[1]))}`);
  else if (dyh) void router.push(`/dyh/${dyh[1]}`);
  else navigateDataList(target, title);
}

function handleScroll(event: Event) {
  const element = event.target as HTMLElement;
  if (element && element.scrollHeight - element.scrollTop - element.clientHeight < 480) {
    if (isDynamicCategoryView.value) void loadDynamicCategory(true);
    else void loadProducts(true);
  }
}

function handleTabScroll(event: Event) {
  const element = event.target as HTMLElement;
  if (!selectedTabWebUrl.value && element && element.scrollHeight - element.scrollTop - element.clientHeight < 480) void loadTabItems(true);
}

function observePaginationSentinels() {
  productObserver?.disconnect();
  dynamicCategoryObserver?.disconnect();
  tabObserver?.disconnect();
  productObserver = null;
  dynamicCategoryObserver = null;
  tabObserver = null;
  if (typeof IntersectionObserver === 'undefined') return;
  if (productBottomSentinel.value) {
    productObserver = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) void loadProducts(true); }, { root: productScrollContainer.value, rootMargin: '480px 0px' });
    productObserver.observe(productBottomSentinel.value);
  }
  if (dynamicCategoryBottomSentinel.value) {
    dynamicCategoryObserver = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) void loadDynamicCategory(true); }, { root: productScrollContainer.value, rootMargin: '480px 0px' });
    dynamicCategoryObserver.observe(dynamicCategoryBottomSentinel.value);
  }
  if (tabBottomSentinel.value) {
    tabObserver = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) void loadTabItems(true); }, { root: tabScrollContainer.value, rootMargin: '480px 0px' });
    tabObserver.observe(tabBottomSentinel.value);
  }
}

function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}

watch([productBottomSentinel, dynamicCategoryBottomSentinel, tabBottomSentinel, productScrollContainer, tabScrollContainer], () => { void nextTick(observePaginationSentinels); }, { flush: 'post' });

onMounted(() => { void loadDigitalConfig(); });

onBeforeUnmount(() => { productObserver?.disconnect(); dynamicCategoryObserver?.disconnect(); tabObserver?.disconnect(); productObserver = null; dynamicCategoryObserver = null; tabObserver = null; });
</script>

<style scoped>
.digital-page { display: flex; flex: 1 1 auto; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; background: var(--surface); color: var(--text-primary); }
.digital-subtabs { display: flex; flex: 0 0 auto; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 24px; border-bottom: 1px solid var(--divider); background: var(--surface); }
.digital-subtab { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 0 16px; border: 1px solid transparent; border-radius: 18px; background: var(--surface-hover); color: var(--text-secondary); cursor: pointer; font: inherit; font-size: 12px; white-space: nowrap; }
.digital-subtab:hover, .digital-subtab.active { border-color: var(--brand-green-border, rgba(16, 185, 102, .22)); background: var(--brand-soft, rgba(16, 185, 129, .1)); color: var(--brand-primary); }
.digital-config-state { display: grid; place-items: center; flex: 1 1 auto; min-height: 300px; }
.digital-web-route { display: flex; align-items: center; gap: 14px; max-width: 960px; width: calc(100% - 44px); padding: 18px; margin: 24px auto; border: 1px solid var(--border-light, rgba(0, 0, 0, .08)); border-radius: 12px; background: var(--surface); }
.digital-web-route > i { color: var(--brand-primary); font-size: 24px; }
.digital-web-route > div { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 5px; }
.digital-web-route span { overflow: hidden; color: var(--text-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.digital-web-route button { border: 0; border-radius: 8px; padding: 8px 14px; background: var(--brand-primary); color: #fff; cursor: pointer; font: inherit; font-size: 12px; }
.mode-button, .digital-search button { border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; font: inherit; }
.digital-search button:hover { background: var(--surface-hover); color: var(--brand-primary); }
.digital-body { display: grid; grid-template-columns: minmax(250px, 300px) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); flex: 1 1 0; min-width: 0; min-height: 0; overflow: hidden; }
.digital-sidebar { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--divider); background: var(--surface); }
.sidebar-toolbar { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-bottom: 1px solid var(--divider); }
.mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; border-radius: 9px; background: var(--surface-hover); }
.mode-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; border-radius: 7px; font-size: 13px; }
.mode-button.active { background: var(--surface); color: var(--brand-primary); font-weight: 700; box-shadow: 0 2px 8px rgba(0, 0, 0, .06); }
.dynamic-mode-label { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 9px; border-radius: 9px; background: var(--brand-soft, rgba(16, 185, 129, .1)); color: var(--brand-primary); font-size: 13px; font-weight: 700; }
.dynamic-mode-label > span { flex: 1; }
.dynamic-mode-label button { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 7px; background: transparent; color: inherit; cursor: pointer; }
.dynamic-mode-label button:hover { background: var(--surface); }
.digital-search { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px; border: 1px solid var(--border-light); border-radius: 8px; background: var(--surface-hover); color: var(--text-tertiary); }
.digital-search:focus-within { border-color: var(--brand-primary); background: var(--surface); box-shadow: 0 0 0 3px var(--brand-soft, rgba(16, 185, 129, .12)); }
.digital-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: 13px; }
.digital-side-list { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; gap: 1px; overflow-y: auto; padding: 0 8px 16px; }
.digital-side-item { display: flex; align-items: center; gap: 11px; min-height: 58px; width: 100%; padding: 8px 10px; border: 0; border-left: 3px solid transparent; border-radius: 8px; background: transparent; color: var(--text-primary); cursor: pointer; font: inherit; text-align: left; }
.digital-side-item:hover { background: var(--surface-hover); }
.digital-side-item.active { border-left-color: var(--brand-primary); background: var(--brand-soft, rgba(16, 185, 129, .1)); color: var(--brand-primary); }
.digital-side-logo, .digital-side-logo-fallback { flex: 0 0 38px; width: 38px; height: 38px; border-radius: 8px; overflow: hidden; }
.digital-side-logo :deep(img) { width: 100%; height: 100%; object-fit: contain; }
.digital-side-logo-fallback { display: grid; place-items: center; background: var(--surface-hover); color: var(--text-tertiary); }
.digital-side-hot-logo { color: var(--warning, #f59e0b); font-size: 20px; }
.digital-side-item.active .digital-side-hot-logo { color: var(--brand-primary); }
.digital-side-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.digital-side-count { color: var(--text-tertiary); font-size: 11px; }
.digital-state, .digital-result-state { display: grid; place-items: center; flex: 1 1 auto; min-height: 220px; }
.digital-content, .digital-server-content { min-width: 0; min-height: 0; height: 100%; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; background: var(--surface-hover); }
.digital-server-content { flex: 1 1 0; }
.digital-server-list { display: flex; flex-direction: column; gap: 14px; max-width: 1280px; padding: 16px 22px 28px; margin: 0 auto; }
.digital-server-products { display: grid; gap: 12px; }
.digital-result-list { display: flex; flex-direction: column; gap: 14px; max-width: 1280px; padding: 16px 22px 28px; margin: 0 auto; }
.series-title { padding: 4px 3px 0; }
.series-title h3 { margin: 0; color: var(--text-primary); font-size: 17px; }
.series-more { display: inline-flex; align-items: center; justify-content: space-between; gap: 9px; min-height: 34px; align-self: flex-start; padding: 0 3px; border: 0; background: transparent; color: var(--brand-primary); cursor: pointer; font: inherit; font-size: 12px; }
.series-more.inline { align-self: center; padding: 0 10px; }
.series-products { display: grid; gap: 12px; }
.series-products.vertical { grid-template-columns: minmax(0, 1fr); }
.series-products.horizontal { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; }
.series-products.horizontal .series-more { grid-column: 1 / -1; justify-self: end; }
.digital-pagination { min-height: 44px; display: grid; place-items: center; color: var(--text-tertiary); font-size: 12px; }
.inline-retry { border: 0; background: transparent; color: var(--brand-primary); cursor: pointer; font: inherit; }
.digital-content-empty { display: grid; place-items: center; gap: 9px; min-height: 360px; color: var(--text-tertiary); font-size: 13px; }
.digital-content-empty i { font-size: 25px; }
@media (max-width: 980px) { .digital-body { grid-template-columns: minmax(220px, 250px) minmax(0, 1fr); } .series-products.horizontal { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) { .digital-subtabs { padding-inline: 16px; } .digital-web-route { align-items: flex-start; flex-wrap: wrap; width: calc(100% - 32px); margin: 16px auto; } .digital-web-route button { margin-left: 38px; } .digital-body { display: flex; flex-direction: column; overflow: hidden; } .digital-sidebar { flex: 0 0 auto; max-height: 285px; border-right: 0; border-bottom: 1px solid var(--divider); } .digital-content, .digital-server-content { flex: 1 1 0; height: auto; } .digital-side-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow-y: auto; } .digital-side-item { min-height: 50px; } .digital-side-logo, .digital-side-logo-fallback { flex-basis: 32px; width: 32px; height: 32px; } .digital-result-list, .digital-server-list { padding: 14px 16px 24px; } .series-products.horizontal { grid-template-columns: 1fr; } }
</style>
