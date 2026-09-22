<template>
  <section class="mobile-digital-page" data-mobile-page="digital" aria-label="数码">
    <header class="mobile-digital-header">
      <button class="mobile-digital-profile" type="button" aria-label="个人主页" @click="router.push('/more')">
        <i class="fas fa-signal" aria-hidden="true"></i>
      </button>

      <form class="mobile-digital-search" role="search" @submit.prevent="submitSearch">
        <i class="fas fa-search" aria-hidden="true"></i>
        <input v-model="searchQuery" type="search" placeholder="酷安优惠券" aria-label="搜索酷安内容" />
        <button v-if="searchQuery" type="button" aria-label="清空搜索" @click="searchQuery = ''">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </form>

      <div class="mobile-digital-actions" aria-label="快捷入口">
        <button type="button" aria-label="应用游戏" @click="router.push('/apps')">
          <span class="mobile-digital-app-icon">APP</span>
        </button>
        <button type="button" aria-label="通知" @click="router.push('/notifications')">
          <i class="far fa-envelope" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <nav class="mobile-digital-tabs" aria-label="数码栏目">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="{ active: tab.key === selectedKey }"
        :aria-current="tab.key === selectedKey ? 'page' : undefined"
        @click="selectTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <main ref="scrollElement" class="mobile-digital-scroll" @scroll.passive="handleScroll">
      <div v-if="configError" class="mobile-digital-inline-error" role="status">
        <span>数码栏目配置暂时不可用，正在使用默认栏目</span>
        <button type="button" @click="loadConfig">重试</button>
      </div>

      <div v-if="configLoading && !products.length" class="mobile-digital-state" role="status" aria-live="polite">
        <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
        <span>正在获取数码栏目…</span>
      </div>

      <div v-else-if="contentError && !products.length" class="mobile-digital-state is-error" role="alert">
        <i class="fas fa-cloud-exclamation" aria-hidden="true"></i>
        <span>{{ contentError }}</span>
        <button type="button" @click="loadContent(false)">重试</button>
      </div>

      <div v-else-if="!filteredProducts.length" class="mobile-digital-state" role="status">
        <i class="fas fa-mobile-screen-button" aria-hidden="true"></i>
        <strong>{{ searchQuery ? '没有匹配的产品' : '暂无数码内容' }}</strong>
        <span>{{ searchQuery ? '换个关键词试试' : '服务端暂时没有返回可展示的产品' }}</span>
        <button v-if="searchQuery" type="button" @click="searchQuery = ''">清除搜索</button>
      </div>

      <template v-else>
        <section class="mobile-digital-products" aria-labelledby="digital-products-title">
          <header class="mobile-digital-section-header mobile-digital-products-header">
            <div>
              <h1 id="digital-products-title">{{ selectedTab?.label || '数码' }}</h1>
              <span>{{ filteredProducts.length }} 个产品</span>
            </div>
            <div class="mobile-digital-view-toggle" role="tablist" aria-label="产品展示方式">
              <button
                type="button"
                role="tab"
                :class="{ active: viewMode === 'grid' }"
                :aria-selected="viewMode === 'grid'"
                @click="viewMode = 'grid'"
              >
                <i class="fas fa-grid-2" aria-hidden="true"></i>
                <span>网格</span>
              </button>
              <button
                type="button"
                role="tab"
                :class="{ active: viewMode === 'list' }"
                :aria-selected="viewMode === 'list'"
                @click="viewMode = 'list'"
              >
                <i class="fas fa-list" aria-hidden="true"></i>
                <span>列表</span>
              </button>
            </div>
          </header>

          <div :class="['mobile-digital-product-list', `is-${viewMode}`]">
            <article
              v-for="(product, index) in filteredProducts"
              :key="`product-${productKey(product, index)}`"
              class="mobile-digital-product-card"
              tabindex="0"
              role="button"
              @click="openProduct(product)"
              @keydown.enter="openProduct(product)"
            >
              <span class="mobile-digital-product-image">
                <img v-if="productImage(product)" :src="productImage(product)" :alt="productTitle(product)" referrerpolicy="no-referrer" />
                <i v-else class="fas fa-mobile-screen-button" aria-hidden="true"></i>
                <span v-if="productRating(product)" class="mobile-digital-rating">
                  <i class="fas fa-star" aria-hidden="true"></i>{{ productRating(product) }}
                </span>
              </span>
              <span class="mobile-digital-product-copy">
                <strong>{{ productTitle(product) }}</strong>
                <small v-if="productSubtitle(product)">{{ productSubtitle(product) }}</small>
                <span v-if="productSpecs(product).length" class="mobile-digital-specs">
                  <span v-for="spec in productSpecs(product).slice(0, 4)" :key="spec">{{ spec }}</span>
                </span>
                <footer>
                  <span v-if="productPrice(product)" class="price">{{ productPrice(product) }}</span>
                  <span v-if="productHot(product)" class="mobile-digital-hot"><i class="fas fa-fire" aria-hidden="true"></i>{{ productHot(product) }}</span>
                  <span v-if="!productPrice(product) && !productHot(product)" class="muted">查看详情</span>
                </footer>
              </span>
            </article>
          </div>
        </section>

        <div v-if="contentError" class="mobile-digital-inline-error" role="alert">
          <span>{{ contentError }}</span>
          <button type="button" @click="loadContent(Boolean(rawItems.length))">重试</button>
        </div>
        <button v-if="hasMore && !contentLoading" class="mobile-digital-load-more" type="button" @click="loadContent(true)">加载更多</button>
        <div v-else-if="contentLoading" class="mobile-digital-loading-more" role="status" aria-live="polite">正在加载更多…</div>
        <div v-else class="mobile-digital-loading-more">没有更多内容了</div>
      </template>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import type { DiscoveryEntity } from '../../../types/discovery';
import {
  getEntityKey,
  parseDiscoveryPage,
  resolveDiscoveryRoute,
} from '../../../utils/discovery';
import {
  getDigitalProductHot,
  getDigitalProductImage,
  getDigitalProductPrice,
  getDigitalProductRating,
  getDigitalProductRelease,
  getDigitalProductSpecs,
  getDigitalProductSubtitle,
  getDigitalProductTitle,
  isDigitalProduct,
} from '../../../utils/digitalProduct';
import {
  getFallbackDigitalTabs,
  parseDigitalConfig,
  type DigitalTab,
} from '../../../utils/digitalTabs';

defineOptions({ name: 'MobileDigitalPage' });

type MobileDigitalTab = {
  key: string;
  label: string;
  target: string;
  webUrl?: string;
  source?: DigitalTab;
};

const REQUIRED_TABS = [
  { key: 'library', label: '数码库', target: '#/product/categoryList' },
  { key: 'digital', label: '数码', target: 'V10_DIGITAL_HOME' },
  { key: 'phone', label: '手机', target: 'V10_DIGITAL_PHONE' },
  { key: 'ranking', label: '排行榜', target: 'V10_CHANNEL_SMB_TOP' },
  { key: 'system', label: '系统', target: 'V13_DIGITAL_ROM' },
  { key: 'tablet', label: '平板', target: '#/product/categoryList?type=tablet' },
] as const;

const router = useRouter();
const scrollElement = ref<HTMLElement | null>(null);
const tabs = ref<MobileDigitalTab[]>(fallbackTabs());
const selectedKey = ref('digital');
const searchQuery = ref('');
const rawItems = ref<DiscoveryEntity[]>([]);
// The first load is started from onMounted; keep the guard available for
// retries and tab changes without making the initial request a no-op.
const configLoading = ref(false);
const configError = ref('');
const contentLoading = ref(false);
const contentError = ref('');
const hasMore = ref(true);
const viewMode = ref<'grid' | 'list'>('grid');
const page = ref(1);
const firstItem = ref('');
const lastItem = ref('');
let requestVersion = 0;

const selectedTab = computed(() => tabs.value.find((tab) => tab.key === selectedKey.value) || tabs.value[1] || tabs.value[0]);

const products = computed(() => {
  const rows: DiscoveryEntity[] = [];
  const seen = new Set<string>();

  function visit(entity: DiscoveryEntity, index: number) {
    const children = Array.isArray(entity.entities) ? entity.entities : [];
    if (children.length) children.forEach((child, childIndex) => visit(child, childIndex));

    const title = getDigitalProductTitle(entity);
    const productLike = isDigitalProduct(entity)
      || Boolean(entity.productId ?? entity.product_id)
      || Boolean(title && (getDigitalProductImage(entity) || getDigitalProductRelease(entity)));
    if (!productLike || !title) return;

    const key = getEntityKey(entity, index);
    if (!seen.has(key)) {
      seen.add(key);
      rows.push(entity);
    }
  }

  rawItems.value.forEach((entity, index) => visit(entity, index));
  return rows;
});

const filteredProducts = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  if (!keyword) return products.value;
  return products.value.filter((product) => {
    const text = [
      getDigitalProductTitle(product),
      getDigitalProductSubtitle(product),
      ...getDigitalProductSpecs(product),
    ].join(' ').toLowerCase();
    return text.includes(keyword);
  });
});

function fallbackTabs(): MobileDigitalTab[] {
  return REQUIRED_TABS.map((tab) => ({ ...tab }));
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
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
  const requestArgs = entity.requestArgs
    ?? entity.request_args
    ?? entity.requestParams
    ?? entity.request_params
    ?? entity.params
    ?? entity.queryParams
    ?? entity.query_params
    ?? extra.requestArgs
    ?? extra.request_args
    ?? extra.requestParams
    ?? extra.request_params
    ?? extra.params
    ?? extra.queryParams
    ?? extra.query_params;
  const parsed = parseRecord(requestArgs);
  if (Object.keys(parsed).length > 0) return parsed;
  const pageParam = entity.pageParam ?? entity.page_param ?? extra.pageParam ?? extra.page_param;
  return pageParam === undefined || pageParam === null || pageParam === '' ? {} : { pageParam };
}

function configuredTabFor(label: string, configured: DigitalTab[]): DigitalTab | undefined {
  const matches = configured.filter((tab) => {
    const haystack = normalize(`${tab.title} ${tab.key} ${tab.pageName || ''} ${tab.url}`);
    if (label === '数码库') return haystack.includes('数码库') || haystack.includes('categorylist') || haystack.includes('library');
    if (label === '数码') return normalize(tab.title) === '数码' || haystack.includes('v10_digital_home');
    if (label === '手机') return haystack.includes('手机') || haystack.includes('v10_channel_sjb') || haystack.includes('v10_digital_phone');
    if (label === '排行榜') return haystack.includes('排行') || haystack.includes('top');
    if (label === '系统') return haystack.includes('系统') || haystack.includes('rom');
    if (label === '平板') return haystack.includes('平板') || haystack.includes('tablet');
    return false;
  });
  return matches[0];
}

function buildTabs(configured: DigitalTab[]): MobileDigitalTab[] {
  return REQUIRED_TABS.map((tab) => {
    const source = configuredTabFor(tab.label, configured);
    const target = source?.url || source?.pageName || source?.key || tab.target;
    return {
      key: tab.key,
      label: tab.label,
      target,
      webUrl: source?.webUrl,
      source,
    };
  });
}

function resetContent() {
  requestVersion += 1;
  // 让 tab 切换可以立即启动新请求；旧请求仍会被 requestVersion 丢弃。
  contentLoading.value = false;
  rawItems.value = [];
  contentError.value = '';
  hasMore.value = true;
  page.value = 1;
  firstItem.value = '';
  lastItem.value = '';
}

async function loadConfig() {
  if (configLoading.value) return;
  configLoading.value = true;
  configError.value = '';
  try {
    const response = await CoolapkTauriAPI.getTabConfig();
    const parsed = parseDigitalConfig(response);
    tabs.value = buildTabs(parsed.tabs.length ? parsed.tabs : getFallbackDigitalTabs());
  } catch (error) {
    configError.value = error instanceof Error ? error.message : '无法获取服务端数码栏目';
    tabs.value = fallbackTabs();
  } finally {
    configLoading.value = false;
  }

  if (!tabs.value.some((tab) => tab.key === selectedKey.value)) selectedKey.value = 'digital';
  resetContent();
  await loadContent(false);
}

async function loadContent(loadMore: boolean) {
  const tab = selectedTab.value;
  if (!tab || contentLoading.value || (loadMore && !hasMore.value)) return;
  const currentVersion = ++requestVersion;
  contentLoading.value = true;
  contentError.value = '';

  try {
    const response = await CoolapkTauriAPI.getDiscoveryPageData({
      url: tab.target,
      title: tab.label,
      subTitle: tab.source?.subTitle || '',
      page: page.value,
      firstItem: firstItem.value,
      lastItem: lastItem.value,
      pageContext: JSON.stringify({ source: 'mobile-digital', tab: tab.key, target: tab.target }),
      requestArgs: getDigitalRequestArgs(tab.source?.raw),
    });
    if (currentVersion !== requestVersion) return;

    const parsed = parseDiscoveryPage(response, page.value);
    const existing = new Set(rawItems.value.map((item, index) => getEntityKey(item, index)));
    const incoming = parsed.items.filter((item, index) => !existing.has(getEntityKey(item, index)));
    rawItems.value = loadMore ? [...rawItems.value, ...incoming] : parsed.items;
    firstItem.value = parsed.firstItem;
    lastItem.value = parsed.lastItem;
    hasMore.value = parsed.hasMore && parsed.items.length > 0;
    page.value += 1;
  } catch (error) {
    if (currentVersion === requestVersion) contentError.value = error instanceof Error ? error.message : '无法获取服务端数码内容';
  } finally {
    if (currentVersion === requestVersion) contentLoading.value = false;
  }
}

function selectTab(key: string) {
  if (key === selectedKey.value) return;
  selectedKey.value = key;
  resetContent();
  void loadContent(false);
}

function handleScroll(event: Event) {
  const target = event.currentTarget as HTMLElement | null;
  if (!target || target.scrollHeight - target.scrollTop - target.clientHeight > 260) return;
  void loadContent(true);
}

function submitSearch() {
  const query = searchQuery.value.trim();
  if (query) void router.push({ path: '/search', query: { q: query } });
}

function productKey(product: DiscoveryEntity, index: number): string {
  return getEntityKey(product, index);
}

function productTitle(product: DiscoveryEntity): string {
  return getDigitalProductTitle(product) || '未命名产品';
}

function productImage(product: DiscoveryEntity): string {
  return getDigitalProductImage(product);
}

function productSubtitle(product: DiscoveryEntity): string {
  return getDigitalProductSubtitle(product) || getDigitalProductSpecs(product).slice(0, 2).join(' · ');
}

function productSpecs(product: DiscoveryEntity): string[] {
  return getDigitalProductSpecs(product);
}

function productHot(product: DiscoveryEntity): string {
  return getDigitalProductHot(product);
}

function productRating(product: DiscoveryEntity): string {
  return getDigitalProductRating(product);
}

function productPrice(product: DiscoveryEntity): string {
  return getDigitalProductPrice(product);
}

function openProduct(product: DiscoveryEntity) {
  const route = resolveDiscoveryRoute(product);
  if (!route) return;
  if (route.kind === 'web') {
    void CoolapkTauriAPI.openUrl(route.target, 'internal');
    return;
  }
  if (route.kind === 'native' && /^\/(app|feed|live|product|user|dyh)\//.test(route.target)) {
    void router.push(route.target);
    return;
  }
  void router.push({ path: '/page', query: { url: route.target, title: route.title || productTitle(product), renderer: 'discovery' } });
}

onMounted(() => {
  void loadConfig();
});

onBeforeUnmount(() => {
  requestVersion += 1;
  scrollElement.value = null;
});
</script>

<style scoped>
.mobile-digital-page { display: flex; flex: 1; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; background: #f2f2f6; color: #252525; }
.mobile-digital-header { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: calc(8px + env(safe-area-inset-top, 0px)) 16px 10px; background: #fff; }
.mobile-digital-profile, .mobile-digital-actions button { display: grid; place-items: center; min-width: 42px; min-height: 42px; padding: 0; border: 0; background: transparent; color: #76767a; font: inherit; }
.mobile-digital-profile { font-size: 22px; }
.mobile-digital-search { display: flex; align-items: center; min-width: 0; min-height: 52px; gap: 9px; padding: 0 14px; border-radius: 18px; background: #f2f2f6; color: #7b7b80; }
.mobile-digital-search > i { flex: 0 0 auto; font-size: 18px; }
.mobile-digital-search input { min-width: 0; flex: 1; padding: 0; border: 0; outline: 0; background: transparent; color: #252525; font: inherit; font-size: 17px; }
.mobile-digital-search input::placeholder { color: #77777b; opacity: 1; }
.mobile-digital-search button { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #8c8c90; }
.mobile-digital-actions { display: flex; align-items: center; gap: 2px; }
.mobile-digital-actions button { min-width: 44px; font-size: 24px; }
.mobile-digital-app-icon { display: grid; place-items: center; width: 31px; height: 31px; border: 3px solid currentColor; border-radius: 5px; font-size: 10px; font-weight: 800; line-height: 1; }
.mobile-digital-tabs { display: flex; flex: 0 0 auto; gap: 25px; min-width: 0; padding: 4px 16px 0; overflow-x: auto; background: #fff; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.mobile-digital-tabs::-webkit-scrollbar { display: none; }
.mobile-digital-tabs button { position: relative; flex: 0 0 auto; min-height: 58px; padding: 0 2px 8px; border: 0; background: transparent; color: #77777b; font: inherit; font-size: 18px; white-space: nowrap; touch-action: manipulation; }
.mobile-digital-tabs button.active { color: #242426; font-weight: 700; }
.mobile-digital-tabs button.active::after { position: absolute; right: 7px; bottom: 4px; left: 7px; height: 4px; content: ''; border-radius: 999px; background: #0f9d58; box-shadow: 0 2px 8px rgba(15, 157, 88, .25); }
.mobile-digital-scroll { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; padding: 10px 0 calc(22px + env(safe-area-inset-bottom, 0px)); overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; }
.mobile-digital-inline-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 8px 10px; padding: 10px 14px; border-radius: 14px; background: #fff0ee; color: #bf4b42; font-size: 12px; }
.mobile-digital-inline-error button, .mobile-digital-state button, .mobile-digital-load-more { min-height: 40px; padding: 0 16px; border: 0; border-radius: 999px; background: #0f9d58; color: #fff; font: inherit; touch-action: manipulation; }
.mobile-digital-inline-error button { min-height: 32px; padding-inline: 12px; background: transparent; color: #bf4b42; font-size: 12px; font-weight: 700; }
.mobile-digital-state { display: grid; place-items: center; gap: 9px; min-height: 280px; padding: 24px; color: #89898e; text-align: center; }
.mobile-digital-state > i { color: #0f9d58; font-size: 28px; }
.mobile-digital-state strong { color: #363638; font-size: 17px; }
.mobile-digital-state span { font-size: 13px; }
.mobile-digital-state.is-error > i, .mobile-digital-state.is-error strong { color: #c94f45; }
.mobile-digital-section, .mobile-digital-products { margin: 0 8px 12px; padding: 19px 14px 15px; border-radius: 22px; background: #fff; }
.mobile-digital-section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.mobile-digital-section-header h2 { margin: 0; color: #242426; font-size: 23px; line-height: 1.25; }
.mobile-digital-section-header button { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0; border: 0; background: transparent; color: #b7b7bb; font: inherit; font-size: 15px; touch-action: manipulation; }
.mobile-digital-section-header button i { font-size: 17px; }
.mobile-digital-section-header > span { color: #99999e; font-size: 13px; }
.mobile-digital-timeline { position: relative; display: grid; gap: 3px; }
.mobile-digital-timeline::before { position: absolute; top: 24px; bottom: 24px; left: 91px; width: 2px; content: ''; background: #f0f0f4; }
.mobile-digital-product-card { position: relative; z-index: 1; display: grid; grid-template-columns: 66px 18px 48px minmax(0, 1fr) auto; align-items: center; min-width: 0; min-height: 88px; gap: 7px; padding: 8px 0; border: 0; border-radius: 14px; background: transparent; color: inherit; text-align: left; touch-action: manipulation; }
.mobile-digital-product-card:active, .mobile-digital-product-card:focus-visible { outline: 0; background: #f7faf8; }
.mobile-digital-date { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; color: #2a2a2c; text-align: right; }
.mobile-digital-date strong { font-size: 19px; font-weight: 500; line-height: 1.1; }
.mobile-digital-date small { min-height: 16px; color: #333337; font-size: 13px; line-height: 1.1; }
.mobile-digital-rail { position: relative; display: grid; place-items: center; align-self: stretch; }
.mobile-digital-rail i { display: block; width: 14px; height: 14px; border-radius: 50%; background: #0f9d58; box-shadow: 0 0 0 5px #fff; }
.mobile-digital-timeline:not(.is-calendar) .mobile-digital-rail i { background: #f0f0f4; }
.mobile-digital-product-image, .mobile-digital-grid-image { display: grid; place-items: center; overflow: hidden; background: #f7f7f9; color: #a4a4a9; }
.mobile-digital-product-image { width: 48px; height: 48px; border-radius: 10px; }
.mobile-digital-product-image img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.mobile-digital-product-image i { font-size: 21px; }
.mobile-digital-product-copy { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.mobile-digital-product-copy strong { overflow: hidden; color: #2a2a2c; font-size: 17px; font-weight: 500; line-height: 1.3; text-overflow: ellipsis; }
.mobile-digital-product-copy small { overflow: hidden; color: #99999f; font-size: 12px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.mobile-digital-hot { display: inline-flex; align-items: center; gap: 4px; color: #77777b; font-size: 13px; white-space: nowrap; }
.mobile-digital-hot i { color: #77777b; }
.mobile-digital-product-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.mobile-digital-grid-card { display: flex; min-width: 0; min-height: 188px; flex-direction: column; gap: 7px; padding: 10px; border: 1px solid #eeeeF1; border-radius: 15px; background: #fff; color: #2a2a2c; text-align: left; touch-action: manipulation; }
.mobile-digital-grid-card:active, .mobile-digital-grid-card:focus-visible { outline: 2px solid rgba(15, 157, 88, .28); outline-offset: 1px; }
.mobile-digital-grid-image { width: 100%; height: 104px; border-radius: 11px; }
.mobile-digital-grid-image img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.mobile-digital-grid-image i { color: #a4a4a9; font-size: 28px; }
.mobile-digital-grid-card strong { overflow: hidden; font-size: 14px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.mobile-digital-grid-card small { overflow: hidden; min-height: 17px; color: #9a9a9f; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-digital-grid-card footer { display: flex; align-items: center; justify-content: space-between; gap: 5px; margin-top: auto; color: #d37b09; font-size: 12px; }
.mobile-digital-grid-card footer .price { color: #0f9d58; font-weight: 700; }
.mobile-digital-grid-card footer .muted { color: #a0a0a4; }
.mobile-digital-load-more { display: block; margin: 4px auto 10px; }
.mobile-digital-loading-more { min-height: 46px; padding-top: 6px; color: #99999e; text-align: center; font-size: 12px; }
@media (min-width: 720px) {
  .mobile-digital-scroll { width: min(100%, 720px); margin: 0 auto; }
  .mobile-digital-section, .mobile-digital-products { margin-inline: 0; }
  .mobile-digital-product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 390px) {
  .mobile-digital-header { grid-template-columns: 34px minmax(0, 1fr) auto; gap: 5px; padding-inline: 10px; }
  .mobile-digital-actions button { min-width: 35px; }
  .mobile-digital-tabs { gap: 19px; padding-inline: 12px; }
  .mobile-digital-tabs button { font-size: 16px; }
  .mobile-digital-product-card { grid-template-columns: 57px 14px 42px minmax(0, 1fr); gap: 5px; }
  .mobile-digital-product-image { width: 42px; height: 42px; }
  .mobile-digital-hot { grid-column: 4; }
  .mobile-digital-timeline::before { left: 76px; }
}

.mobile-digital-products { padding: 16px 12px 14px; }
.mobile-digital-products-header { align-items: center; margin-bottom: 15px; }
.mobile-digital-products-header > div:first-child { min-width: 0; }
.mobile-digital-products-header h1 { margin: 0; color: #242426; font-size: 23px; line-height: 1.25; }
.mobile-digital-products-header > div:first-child > span { display: block; margin-top: 4px; color: #99999e; font-size: 12px; }
.mobile-digital-view-toggle { display: inline-flex; align-items: center; gap: 2px; padding: 3px; border-radius: 15px; background: #f3f4f6; }
.mobile-digital-view-toggle button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 74px; min-height: 38px; padding: 0 10px; border: 0; border-radius: 12px; background: transparent; color: #77777d; font: inherit; font-size: 14px; touch-action: manipulation; }
.mobile-digital-view-toggle button.active { background: #fff; color: #0f9d58; box-shadow: 0 2px 7px rgba(38, 50, 56, .12); font-weight: 700; }
.mobile-digital-view-toggle button:focus-visible { outline: 2px solid rgba(15, 157, 88, .35); outline-offset: 1px; }
.mobile-digital-product-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.mobile-digital-product-list.is-list { grid-template-columns: minmax(0, 1fr); gap: 8px; }
.mobile-digital-product-list .mobile-digital-product-card { display: flex; min-width: 0; min-height: 245px; flex-direction: column; gap: 10px; padding: 10px; border: 1px solid #ececef; border-radius: 17px; background: #fff; color: #2a2a2c; text-align: left; touch-action: manipulation; }
.mobile-digital-product-list .mobile-digital-product-card:active, .mobile-digital-product-list .mobile-digital-product-card:focus-visible { outline: 2px solid rgba(15, 157, 88, .28); outline-offset: 1px; }
.mobile-digital-product-list .mobile-digital-product-image { position: relative; width: 100%; height: 135px; flex: 0 0 auto; border-radius: 12px; background: #f7f7f9; }
.mobile-digital-product-list .mobile-digital-product-image img { width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.mobile-digital-product-list .mobile-digital-product-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 6px; }
.mobile-digital-product-list .mobile-digital-product-copy > strong { overflow: hidden; color: #202124; font-size: 16px; font-weight: 700; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.mobile-digital-product-list .mobile-digital-product-copy > small { overflow: hidden; min-height: 17px; color: #929298; font-size: 12px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.mobile-digital-rating { position: absolute; top: 8px; right: 8px; display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 8px; border-radius: 10px; background: rgba(255, 255, 255, .94); color: #dc8209; font-size: 14px; font-weight: 700; box-shadow: 0 3px 10px rgba(40, 40, 45, .12); }
.mobile-digital-rating i { font-size: 13px; }
.mobile-digital-specs { display: flex; min-width: 0; flex-wrap: wrap; gap: 5px; }
.mobile-digital-specs span { max-width: 100%; overflow: hidden; padding: 4px 8px; border-radius: 7px; background: #f5f6f7; color: #777980; font-size: 11px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.mobile-digital-product-list .mobile-digital-product-copy footer { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 24px; margin-top: auto; color: #929298; font-size: 12px; }
.mobile-digital-product-list .mobile-digital-product-copy footer .price { color: #0f9d58; font-size: 16px; font-weight: 800; }
.mobile-digital-product-list .mobile-digital-product-copy footer .muted { color: #a0a0a4; }
.mobile-digital-product-list .mobile-digital-hot { display: inline-flex; align-items: center; gap: 4px; color: #ef711a; font-size: 12px; white-space: nowrap; }
.mobile-digital-product-list .mobile-digital-hot i { color: #ef711a; }
.mobile-digital-product-list.is-list .mobile-digital-product-card { min-height: 116px; flex-direction: row; gap: 12px; padding: 10px; }
.mobile-digital-product-list.is-list .mobile-digital-product-image { width: 106px; height: 106px; flex-basis: 106px; }
.mobile-digital-product-list.is-list .mobile-digital-product-copy { padding: 3px 0 1px; }
.mobile-digital-product-list.is-list .mobile-digital-product-copy > strong { font-size: 17px; }
.mobile-digital-product-list.is-list .mobile-digital-product-copy > small { max-width: 100%; }
.mobile-digital-product-list.is-list .mobile-digital-specs { flex-wrap: nowrap; overflow: hidden; }
.mobile-digital-product-list.is-list .mobile-digital-specs span { flex: 0 0 auto; }
@media (max-width: 390px) {
  .mobile-digital-view-toggle button { min-width: 62px; padding-inline: 7px; }
  .mobile-digital-view-toggle button span { font-size: 12px; }
  .mobile-digital-product-list .mobile-digital-product-card { min-height: 222px; padding: 8px; }
  .mobile-digital-product-list .mobile-digital-product-image { height: 115px; }
  .mobile-digital-product-list.is-list .mobile-digital-product-card { min-height: 100px; gap: 9px; }
  .mobile-digital-product-list.is-list .mobile-digital-product-image { width: 88px; height: 88px; flex-basis: 88px; }
}
</style>
