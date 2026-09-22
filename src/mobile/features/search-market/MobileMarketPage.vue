<template>
  <section class="mobile-market-page" data-mobile-page="market" :aria-label="pageTitle">
    <header class="mobile-market-page__header">
      <div>
        <p class="mobile-market-page__eyebrow">酷安移动市场</p>
        <h1>{{ pageTitle }}</h1>
      </div>
      <button type="button" class="mobile-market-page__refresh" aria-label="刷新" :disabled="loading" @click="load(true)">
        <i :class="loading ? 'fas fa-circle-notch fa-spin' : 'fas fa-rotate-right'" aria-hidden="true"></i>
      </button>
    </header>

    <nav v-if="tabs.length" class="mobile-market-page__tabs" aria-label="市场分类">
      <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" @click="selectTab(tab.key)">
        <i v-if="tab.icon" :class="tab.icon" aria-hidden="true"></i>{{ tab.label }}
      </button>
    </nav>

    <form v-if="showSearch" class="mobile-market-page__search" role="search" @submit.prevent="submitSearch">
      <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
      <input v-model="searchInput" type="search" :placeholder="searchPlaceholder" />
      <button v-if="searchInput" type="button" aria-label="清空搜索" @click="clearSearch"><i class="fas fa-xmark"></i></button>
      <button type="submit">搜索</button>
    </form>
    <nav v-if="mode === 'apps'" class="mobile-market-page__search-modes" aria-label="应用搜索方式">
      <button v-for="option in appSearchModes" :key="option.key" type="button" :class="{ active: searchMode === option.key }" @click="selectSearchMode(option.key)">{{ option.label }}</button>
    </nav>

    <main ref="scrollElement" class="mobile-market-page__scroll" @scroll.passive="onScroll">
      <div v-if="loading && !items.length" class="mobile-market-page__state" role="status"><i class="fas fa-circle-notch fa-spin"></i><strong>正在加载…</strong></div>
      <div v-else-if="error && !items.length" class="mobile-market-page__state is-error" role="alert"><i class="fas fa-triangle-exclamation"></i><strong>{{ error }}</strong><button type="button" @click="load(true)">重试</button></div>
      <div v-else-if="requiresLogin && !authStore.isLoggedIn" class="mobile-market-page__state"><i class="fas fa-lock"></i><strong>登录后查看{{ pageTitle }}</strong><button type="button" @click="authStore.openLoginModal()">立即登录</button></div>
      <div v-else-if="compareMode && !compareItems.length" class="mobile-market-page__state"><i class="fas fa-scale-balanced"></i><strong>请选择至少两个产品进行对比</strong><button type="button" @click="router.push('/my-products')">打开我的数码</button></div>
      <div v-else-if="!items.length && !compareItems.length" class="mobile-market-page__state"><i class="fas fa-box-open"></i><strong>{{ emptyTitle }}</strong><span>{{ emptyDescription }}</span></div>

      <section v-if="compareItems.length" class="mobile-market-page__compare" aria-label="产品对比">
        <div class="mobile-market-page__compare-head"><span>参数</span><strong v-for="item in compareItems" :key="item.id">{{ item.title }}</strong></div>
        <div v-for="field in compareFields" :key="field.key" class="mobile-market-page__compare-row"><span>{{ field.label }}</span><span v-for="item in compareItems" :key="`${field.key}-${item.id}`">{{ fieldValue(item, field.key) || '—' }}</span></div>
      </section>

      <section v-if="items.length" class="mobile-market-page__list" aria-label="列表">
        <button v-for="(item, index) in items" :key="itemKey(item, index)" type="button" class="mobile-market-page__card" @click="openItem(item)">
          <span class="mobile-market-page__thumb"><img v-if="itemImage(item)" :src="itemImage(item)" alt="" referrerpolicy="no-referrer" /><i v-else :class="itemIcon"></i></span>
          <span class="mobile-market-page__copy"><strong>{{ itemTitle(item) }}</strong><small>{{ itemSubtitle(item) }}</small></span>
          <i class="fas fa-chevron-right mobile-market-page__arrow" aria-hidden="true"></i>
        </button>
      </section>

      <footer v-if="items.length" class="mobile-market-page__footer">
        <span v-if="loading">正在加载更多…</span><span v-else-if="noMore">没有更多了</span>
      </footer>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { useAuthStore } from '../../../stores/auth';
import { parseDiscoveryPage, resolveDiscoveryRoute } from '../../../utils/discovery';
import { normalizeCoolapkRoute } from '../../../utils/coolapkRoute';

defineOptions({ name: 'MobileMarketPage' });

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const scrollElement = ref<HTMLElement | null>(null);
const items = ref<any[]>([]);
const compareItems = ref<Array<{ id: string; title: string; value: string }>>([]);
const compareFields = ref<Array<{ key: string; label: string }>>([]);
const loading = ref(false);
const error = ref('');
const noMore = ref(false);
const page = ref(1);
const searchInput = ref('');
const firstItem = ref('');
const lastItem = ref('');
const pageContext = ref('');
let requestId = 0;
const appSearchModes = [{ key: 'name', label: '应用名' }, { key: 'developer', label: '开发者' }, { key: 'tag', label: '标签' }];

const mode = computed(() => {
  if (route.path === '/apps') return 'apps';
  if (route.path === '/games') return 'games';
  if (route.path === '/goods') return 'goods';
  if (/^\/goods\/lists\//.test(route.path)) return 'goods-list';
  if (/^\/goods\/ranking\//.test(route.path)) return 'goods-ranking';
  if (route.path === '/secondhand') return 'secondhand';
  if (route.path === '/secondhand/brands') return 'secondhand-brands';
  if (route.path === '/secondhand/list') return 'secondhand-list';
  if (route.path === '/my-products') return 'my-products';
  return 'product-compare';
});
const compareMode = computed(() => mode.value === 'product-compare');
const pageTitle = computed(() => ({ apps: '应用', games: '游戏', goods: '好物', 'goods-list': '好物清单', 'goods-ranking': '好物榜', secondhand: '闲置', 'secondhand-brands': '闲置品牌', 'secondhand-list': '闲置列表', 'my-products': '我的数码', 'product-compare': '产品对比' }[mode.value]));
const tabs = computed(() => {
  if (mode.value === 'apps') return [{ key: 'recommend', label: '推荐', icon: 'fas fa-fire' }, { key: 'newest', label: '新品', icon: 'fas fa-sparkles' }, { key: 'tools', label: '工具' }, { key: 'social', label: '社交' }];
  if (mode.value === 'games') return [{ key: 'hot', label: '热门', icon: 'fas fa-fire' }, { key: 'single', label: '单机' }, { key: 'online', label: '网游' }, { key: 'casual', label: '休闲' }, { key: 'reviews', label: '游评' }];
  if (mode.value === 'goods') return [{ key: 'search', label: '搜索' }, { key: 'mine', label: '我的好物' }, { key: 'lists', label: '好物清单' }, { key: 'ranking', label: '好物榜' }];
  if (mode.value === 'secondhand-brands') return [{ key: 'all', label: '品牌/型号', icon: 'fas fa-tags' }];
  if (mode.value === 'secondhand-list') return [{ key: 'recommend', label: '推荐', icon: 'fas fa-fire' }, { key: 'latest', label: '最新' }];
  if (mode.value === 'my-products') return [{ key: 'wish', label: '想要' }, { key: 'buy', label: '已购' }, { key: 'owner', label: '拥有' }];
  return [];
});
const activeTab = computed(() => String(route.query.tab || tabs.value[0]?.key || ''));
const searchQuery = computed(() => String(route.query.q || '').trim());
const searchMode = computed(() => String(route.query.mode || 'name'));
const showSearch = computed(() => mode.value === 'apps' || mode.value === 'games' || mode.value === 'goods' || mode.value === 'secondhand-list');
const searchPlaceholder = computed(() => mode.value === 'goods' ? '搜索好物名称' : mode.value === 'games' ? '搜索游戏' : '搜索应用名称、开发者或标签');
const itemIcon = computed(() => mode.value === 'goods' || mode.value === 'goods-list' || mode.value === 'goods-ranking' ? 'fas fa-gift' : mode.value === 'secondhand' || mode.value === 'secondhand-brands' || mode.value === 'secondhand-list' ? 'fas fa-shop' : mode.value === 'product-compare' ? 'fas fa-scale-balanced' : 'fas fa-mobile-screen-button');
const emptyTitle = computed(() => mode.value === 'my-products' ? '暂无产品' : mode.value === 'goods' && !searchQuery.value && activeTab.value === 'search' ? '输入关键词开始搜索' : mode.value === 'secondhand-brands' ? '暂无品牌数据' : '暂无内容');
const emptyDescription = computed(() => mode.value === 'my-products' ? '登录后可以查看想要、已购和拥有的数码产品' : mode.value === 'secondhand-list' ? '可以从闲置首页选择品牌、型号和城市筛选' : '服务端暂时没有返回可展示的内容');
const requiresLogin = computed(() => mode.value === 'my-products' || (mode.value === 'goods' && activeTab.value === 'mine'));

function responseList(response: any): any[] {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  for (const key of ['items', 'rows', 'list', 'entities', 'feeds']) if (Array.isArray(data?.[key])) return data[key];
  return [];
}
function itemKey(item: any, index: number) { return String(item?.id ?? item?.entityId ?? item?.packageName ?? item?.url ?? `${mode.value}-${index}`); }
function itemTitle(item: any) { return String(item?.title ?? item?.name ?? item?.goods_title ?? item?.product_title ?? item?.index_title ?? item?.shorttitle ?? '未命名内容'); }
function itemSubtitle(item: any) { return String(item?.description ?? item?.sub_title ?? item?.device_info ?? item?.mall_title ?? item?.username ?? item?.packageName ?? item?.message ?? '点击查看详情').replace(/<[^>]+>/g, '').slice(0, 80); }
function itemImage(item: any) { return String(item?.icon ?? item?.logo ?? item?.pic ?? item?.cover ?? item?.goods_pic ?? item?.userAvatar ?? item?.user_avatar ?? ''); }
function currentQuery() { return Object.fromEntries(Object.entries(route.query).filter(([, value]) => value !== null).map(([key, value]) => [key, String(value)])); }
function setQuery(query: Record<string, string>) { void router.replace({ path: route.path, query }); }
function selectTab(key: string) { setQuery({ ...currentQuery(), tab: key, q: key === 'search' ? searchQuery.value : '' }); }
function selectSearchMode(key: string) { setQuery({ ...currentQuery(), mode: key }); }
function submitSearch() { setQuery({ ...currentQuery(), tab: mode.value === 'goods' ? 'search' : activeTab.value, q: searchInput.value.trim() }); }
function clearSearch() { searchInput.value = ''; setQuery({ ...currentQuery(), q: '' }); }

function fieldValue(item: any, key: string): string {
  const value = key.includes('.') ? key.split('.').reduce((current, part) => current?.[part], item) : item?.[key];
  if (value === undefined || value === null) return '';
  return String(value).replace(/<[^>]+>/g, '').trim();
}

async function load(refresh = false) {
  if (loading.value || (noMore.value && !refresh)) return;
  if (refresh) { items.value = []; compareItems.value = []; compareFields.value = []; page.value = 1; noMore.value = false; error.value = ''; firstItem.value = ''; lastItem.value = ''; pageContext.value = ''; }
  const currentRequest = ++requestId;
  loading.value = true;
  try {
    if (compareMode.value) {
      const ids = String(route.query.ids || '').split(',').map((id) => id.trim()).filter(Boolean);
      const result = await Promise.allSettled(ids.map((id) => CoolapkTauriAPI.getProductConfig(id)));
      if (currentRequest !== requestId) return;
      compareItems.value = result.flatMap((entry, index) => entry.status === 'fulfilled' && entry.value?.data ? [{ id: ids[index], title: String(entry.value.data.title || `配置 ${index + 1}`), value: String(entry.value.data.cpu || entry.value.data.soc_model || '已加载'), ...entry.value.data }] : []);
      const fields = [{ key: 'release_time', label: '发布时间' }, { key: 'cpu', label: '处理器' }, { key: 'ram', label: '运行内存' }, { key: 'screen_size', label: '屏幕尺寸' }, { key: 'screen_resolution', label: '屏幕分辨率' }, { key: 'battery_capacity', label: '电池容量' }, { key: 'rear_camera', label: '后置摄像头' }];
      compareFields.value = fields.filter((field) => compareItems.value.some((item) => fieldValue(item, field.key)));
      noMore.value = true;
      return;
    }
    const nextPage = page.value;
    let response: any;
    if (mode.value === 'apps') {
      if (!searchQuery.value) response = await CoolapkTauriAPI.getAppList(activeTab.value, nextPage);
      else if (searchMode.value === 'developer') response = await CoolapkTauriAPI.searchApksByDeveloper(searchQuery.value, nextPage);
      else if (searchMode.value === 'tag') response = await CoolapkTauriAPI.searchApksByTag(searchQuery.value, '1', nextPage);
      else response = await CoolapkTauriAPI.searchApks(searchQuery.value, nextPage);
    }
    else if (mode.value === 'games') response = activeTab.value === 'reviews' && !searchQuery.value ? await CoolapkTauriAPI.searchFeeds('游戏评测', nextPage) : searchQuery.value ? await CoolapkTauriAPI.searchGames(searchQuery.value, nextPage) : await CoolapkTauriAPI.getGameList(activeTab.value, nextPage);
    else if (mode.value === 'goods') response = activeTab.value === 'search' && searchQuery.value ? await CoolapkTauriAPI.searchGoods({ keyword: searchQuery.value, page: nextPage }) : activeTab.value === 'mine' ? await CoolapkTauriAPI.getMyGoodsFeeds(String(authStore.user?.uid || ''), 'all', nextPage) : await CoolapkTauriAPI.getGoodsList({ page: nextPage });
    else if (mode.value === 'goods-list' || mode.value === 'goods-ranking') response = await CoolapkTauriAPI.getGoodsListItems(String(authStore.user?.uid || ''), String(route.params.feedId || ''), nextPage);
    else if (mode.value === 'my-products') response = await CoolapkTauriAPI.getMyProductList(String(authStore.user?.uid || ''), activeTab.value, nextPage);
    else if (mode.value === 'secondhand-brands') {
      const brandId = String(route.query.brand || route.query.brandId || route.query.productId || '').trim();
      response = brandId
        ? await CoolapkTauriAPI.getSecondHandProductList(brandId, String(route.query.ershouType || 'recommend'), nextPage, { firstItem: firstItem.value, lastItem: lastItem.value })
        : await CoolapkTauriAPI.getSecondHandBrandList();
    }
    else if (mode.value === 'secondhand-list') {
      const query = new URLSearchParams();
      for (const key of ['brand', 'productId', 'cityId', 'ershouType', 'dataListType']) {
        const value = String(route.query[key] || '').trim();
        if (value || key === 'dataListType') query.set(key, value || 'staggered');
      }
      const target = `#/feed/ershouList?${query.toString()}`;
      const parsed = parseDiscoveryPage(await CoolapkTauriAPI.getDiscoveryPageData({ url: target, title: '闲置交易', page: nextPage, firstItem: firstItem.value, lastItem: lastItem.value, pageContext: pageContext.value || JSON.stringify({ source: 'mobile-secondhand-list', target }) }), nextPage);
      response = { data: parsed.items, hasMore: parsed.hasMore };
      firstItem.value = firstItem.value || parsed.firstItem;
      lastItem.value = parsed.lastItem;
      pageContext.value = parsed.pageContext || pageContext.value;
      noMore.value = !parsed.hasMore;
    }
    else {
      const parsed = parseDiscoveryPage(await CoolapkTauriAPI.getDiscoveryPageData({ url: 'V11_FIND_GOOD_GOODS_HOME', title: '二手市场', page: nextPage, firstItem: firstItem.value, lastItem: lastItem.value, pageContext: pageContext.value || JSON.stringify({ source: 'mobile-secondhand' }) }), nextPage);
      response = { data: parsed.items, hasMore: parsed.hasMore };
      firstItem.value = firstItem.value || parsed.firstItem;
      lastItem.value = parsed.lastItem;
      pageContext.value = parsed.pageContext || pageContext.value;
      noMore.value = !parsed.hasMore;
    }
    const incoming = responseList(response);
    if (currentRequest !== requestId) return;
    const known = new Set(items.value.map((item, index) => itemKey(item, index)));
    items.value.push(...incoming.filter((item, index) => !known.has(itemKey(item, index))));
    noMore.value = noMore.value || incoming.length === 0 || incoming.length < 10;
    page.value += 1;
  } catch (loadError) {
    if (currentRequest === requestId) error.value = loadError instanceof Error ? loadError.message : '加载失败，请稍后重试';
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}
function onScroll(event: Event) { const target = event.currentTarget as HTMLElement; if (target.scrollTop + target.clientHeight >= target.scrollHeight - 180) void load(); }
function openItem(item: any) {
  if (mode.value === 'secondhand' || mode.value === 'secondhand-list' || mode.value === 'secondhand-brands') {
    if (mode.value === 'secondhand-brands' && !route.query.brand && !route.query.brandId && !route.query.productId) {
      const brandId = String(item?.id ?? item?.brandId ?? item?.brand_id ?? item?.productId ?? '').trim();
      if (brandId) { void router.push({ path: '/secondhand/brands', query: { ...currentQuery(), brand: brandId } }); return; }
    }
    const target = resolveDiscoveryRoute(item);
    const local = target ? normalizeCoolapkRoute(target.target) : null;
    if (local) void router.push(local); else if (target?.target) void CoolapkTauriAPI.openUrl(target.target, 'internal');
    return;
  }
  const id = String(item?.packageName ?? item?.productId ?? item?.product_id ?? item?.id ?? item?.entityId ?? '');
  if (mode.value === 'apps' || mode.value === 'games') { if (id) void router.push(`/app/${encodeURIComponent(id)}`); return; }
  if (mode.value === 'my-products') { if (id) void router.push(`/product/${encodeURIComponent(id)}`); return; }
  if (mode.value === 'goods-list' || mode.value === 'goods-ranking') { if (id) void router.push(`/feed/${encodeURIComponent(id)}`); return; }
  if (mode.value === 'goods') {
    if (activeTab.value === 'lists' || activeTab.value === 'ranking') { if (id) void router.push(`/goods/${activeTab.value}/${encodeURIComponent(id)}`); return; }
    const url = String(item?.goods_buy_url ?? item?.goods_url ?? item?.url ?? ''); if (url) void CoolapkTauriAPI.openUrl(url, 'system');
  }
}
watch(() => [authStore.isLoggedIn, authStore.user?.uid], () => { if (requiresLogin.value) void load(true); });
watch(() => route.fullPath, () => { searchInput.value = searchQuery.value; void load(true); });
onMounted(() => { searchInput.value = searchQuery.value; void load(true); });
</script>

<style scoped>
.mobile-market-page{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:#f2f2f6;color:#262629}.mobile-market-page__header{display:flex;align-items:center;gap:12px;padding:14px 14px 10px;background:#fff}.mobile-market-page__header>div{flex:1;min-width:0}.mobile-market-page__eyebrow{margin:0 0 2px;color:#999;font-size:11px}.mobile-market-page h1{margin:0;font-size:22px}.mobile-market-page__refresh{width:38px;height:38px;border:0;border-radius:12px;background:#e7f6ed;color:#0f9d58}.mobile-market-page__tabs{display:flex;gap:4px;padding:0 10px;overflow-x:auto;background:#fff;scrollbar-width:none}.mobile-market-page__tabs::-webkit-scrollbar{display:none}.mobile-market-page__tabs button{flex:0 0 auto;min-height:44px;padding:0 11px;border:0;background:transparent;color:#888;font:inherit;font-size:13px}.mobile-market-page__tabs button.active{color:#0f9d58;font-weight:700;border-bottom:3px solid #0f9d58}.mobile-market-page__search{display:flex;align-items:center;gap:8px;margin:10px 12px 2px;padding:0 11px;min-height:43px;border:1px solid #e1e1e5;border-radius:14px;background:#fff;color:#999}.mobile-market-page__search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit}.mobile-market-page__search button{border:0;background:transparent;color:#0f9d58;font:inherit}.mobile-market-page__scroll{flex:1;min-height:0;overflow-y:auto;padding:10px 10px calc(22px + env(safe-area-inset-bottom,0px))}.mobile-market-page__list{display:grid;gap:8px}.mobile-market-page__card{display:flex;align-items:center;gap:11px;min-width:0;padding:12px;border:0;border-radius:16px;background:#fff;text-align:left}.mobile-market-page__thumb{display:grid;place-items:center;flex:0 0 48px;width:48px;height:48px;overflow:hidden;border-radius:13px;background:#e6f6ed;color:#0f9d58}.mobile-market-page__thumb img{width:100%;height:100%;object-fit:cover}.mobile-market-page__copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:5px}.mobile-market-page__copy strong,.mobile-market-page__copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mobile-market-page__copy strong{font-size:15px}.mobile-market-page__copy small{color:#999;font-size:12px}.mobile-market-page__arrow{color:#c5c5c9}.mobile-market-page__state{display:grid;place-items:center;gap:9px;min-height:240px;padding:24px;color:#999;text-align:center}.mobile-market-page__state i{color:#0f9d58;font-size:30px}.mobile-market-page__state strong{color:#555}.mobile-market-page__state button{min-height:36px;padding:0 15px;border:0;border-radius:999px;background:#0f9d58;color:#fff;font:inherit}.mobile-market-page__state.is-error{color:#d94b42}.mobile-market-page__footer{text-align:center;padding:16px;color:#999;font-size:12px}.mobile-market-page__compare{display:grid;gap:8px}.mobile-market-page__compare-card{display:flex;justify-content:space-between;padding:14px;border-radius:15px;background:#fff}.mobile-market-page__compare-card span{color:#777}
.mobile-market-page__search-modes{display:flex;gap:6px;padding:6px 12px 2px}.mobile-market-page__search-modes button{padding:5px 10px;border:0;border-radius:999px;background:#fff;color:#888;font:inherit;font-size:12px}.mobile-market-page__search-modes button.active{background:#dff4e7;color:#0f9d58;font-weight:700}.mobile-market-page__compare{gap:1px;overflow:hidden;background:#e5e5e8}.mobile-market-page__compare-head,.mobile-market-page__compare-row{display:grid;grid-template-columns:110px repeat(auto-fit,minmax(110px,1fr));gap:1px}.mobile-market-page__compare-head>*,.mobile-market-page__compare-row>*{padding:12px 9px;background:#fff;font-size:12px}.mobile-market-page__compare-row>span:first-child{color:#777}.mobile-market-page__compare-row>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
