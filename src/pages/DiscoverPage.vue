<template>
  <div class="discover-page custom-scrollbar" @scroll.passive="handleScroll">
    <div v-if="configError && !tabs.length" class="config-error">
      <strong>发现频道配置加载失败</strong>
      <span>{{ configError }}</span>
      <button type="button" @click="loadConfig">重试</button>
    </div>

    <nav v-if="tabs.length" class="discover-tabs" aria-label="发现栏目">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="['discover-tab', { active: selectedKey === tab.key }]"
        @click="selectTab(tab.key)"
      >
        <span>{{ tab.title }}</span>
        <small v-if="tab.subTitle">{{ tab.subTitle }}</small>
        <i v-if="selectedKey === tab.key" class="tab-indicator"></i>
      </button>
    </nav>

    <section v-if="currentState.webUrl" class="web-route-card">
      <i class="fas fa-globe"></i>
      <div>
        <strong>该栏目由网页内容提供</strong>
        <span>{{ currentState.webUrl }}</span>
      </div>
      <button type="button" @click="openWeb(currentState.webUrl)">打开页面</button>
    </section>

    <!-- 加载中状态：渲染与真实发现页 1:1 对齐的高保真流光骨架屏 -->
    <DiscoverySkeleton v-else-if="isPageLoading && !currentState.items.length" />

    <!-- 错误状态：居中提示并提供重试按钮 -->
    <div v-else-if="currentState.error && !currentState.items.length" class="state-container">
      <ErrorState title="发现内容加载失败" :message="currentState.error" @retry="refresh" />
    </div>

    <!-- 空内容状态：居中提示 -->
    <div v-else-if="!currentState.items.length && !isPageLoading" class="state-container">
      <EmptyState title="暂无发现内容" description="服务端暂时没有返回可展示的内容" />
    </div>

    <!-- 发现内容数据流 -->
    <section v-else :class="['discover-content', { 'has-goods-grid': isGoodsPage, 'has-dyh-grid': isDyhPage }]">
      <DiscoveryEntityCard
        v-for="(entity, index) in currentState.items"
        :key="getEntityKey(entity, index)"
        :entity="entity"
        @open="openEntity"
      />
      <div v-if="currentState.loading" class="loading-more"><LoadingState text="正在加载更多..." /></div>
      <div v-else-if="!currentState.hasMore" class="no-more">没有更多内容了</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import DiscoveryEntityCard from '../components/discovery/DiscoveryEntityCard.vue';
import DiscoverySkeleton from '../components/discovery/DiscoverySkeleton.vue';
import AppImage from '../components/common/AppImage.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import LoadingState from '../components/common/LoadingState.vue';
import type { DiscoveryEntity, DiscoveryPageResult, DiscoveryTab } from '../types/discovery';
import {
  decodeDiscoveryRouteSegment,
  getEntityKey,
  isGoodsEntity,
  parseDiscoveryPage,
  parseDiscoverySelectedKey,
  parseDiscoveryTabs,
  resolveDiscoveryRoute,
} from '../utils/discovery';

interface PageState extends DiscoveryPageResult {
  loading: boolean;
  error: string;
  webUrl: string;
}

const router = useRouter();
const tabs = ref<DiscoveryTab[]>([]);
const selectedKey = ref('');
const configLoading = ref(true);
const configError = ref('');
const states = reactive<Record<string, PageState>>({});

const fallbackTabs: DiscoveryTab[] = [
  fallbackTab('发现', '#/feed/digestList'),
  fallbackTab('最新', '#/feed/newestList'),
  fallbackTab('酷图', 'V11_FIND_COOLPIC'),
  fallbackTab('应用', '#/apk/list'),
  fallbackTab('看看号', '/user/dyhSubscribe'),
];

// 初始化优先读取本地缓存，避免首屏瞬间无 Tab 和闪烁
try {
  const cached = JSON.parse(localStorage.getItem('coolapk.discovery.tabs.v2') || '[]');
  if (Array.isArray(cached) && cached.length) {
    tabs.value = cached;
    const savedSelected = localStorage.getItem('coolapk.discovery.selectedTab.v2');
    selectedKey.value = tabs.value.some((tab) => tab.key === savedSelected)
      ? String(savedSelected)
      : tabs.value[0]?.key || '';
  }
} catch {
  tabs.value = fallbackTabs;
  selectedKey.value = fallbackTabs[0]?.key || '';
}

const selectedTab = computed(() => tabs.value.find((tab) => tab.key === selectedKey.value));
const currentState = computed<PageState>(() => {
  if (!selectedKey.value || !states[selectedKey.value]) return emptyState(false);
  return states[selectedKey.value];
});
const isPageLoading = computed(() => {
  if (configLoading.value && !tabs.value.length) return true;
  if (!selectedTab.value) return true;
  return currentState.value.loading;
});
const isGoodsPage = computed(() => {
  const tab = selectedTab.value;
  if (tab?.nativeKind === 'goods' || tab?.pageName === 'V11_FIND_GOOD_GOODS_HOME') return true;
  return currentState.value.items.length > 1 && currentState.value.items.every(isGoodsEntity);
});
const isDyhPage = computed(() => {
  const tab = selectedTab.value;
  if (tab?.nativeKind === 'dyh' || tab?.pageName === 'V11_FIND_DYH' || tab?.title?.includes('看看号')) return true;
  return currentState.value.items.length > 0 && currentState.value.items.every((item) => {
    const type = String(item.entityType || item.entityTemplate || '').toLowerCase();
    return type.includes('dyh') || type.includes('official');
  });
});

function fallbackTab(title: string, url: string): DiscoveryTab {
  return { key: url, title, url, visible: true, order: 0, raw: { title, url } };
}

function emptyState(loading = false): PageState {
  return { items: [], page: 1, hasMore: true, firstItem: '', lastItem: '', raw: null, loading, error: '', webUrl: '' };
}

function ensureState(tab: DiscoveryTab): PageState {
  if (!states[tab.key]) states[tab.key] = emptyState(false);
  return states[tab.key];
}

async function loadConfig() {
  configLoading.value = true;
  configError.value = '';
  try {
    const response = await CoolapkTauriAPI.getDiscoveryConfig();
    const parsed = parseDiscoveryTabs(response);
    if (parsed.length) {
      tabs.value = parsed;
      localStorage.setItem('coolapk.discovery.tabs.v2', JSON.stringify(parsed));
    }
    const serverSelected = parseDiscoverySelectedKey(response, tabs.value);
    const savedSelected = localStorage.getItem('coolapk.discovery.selectedTab.v2');
    if (!selectedKey.value || !tabs.value.some((t) => t.key === selectedKey.value)) {
      selectedKey.value = tabs.value.some((tab) => tab.key === savedSelected)
        ? String(savedSelected)
        : serverSelected || tabs.value[0]?.key || '';
    }
  } catch (error: any) {
    configError.value = error?.message || '无法获取服务端发现配置';
  } finally {
    configLoading.value = false;
    if (!selectedKey.value && tabs.value.length) {
      selectedKey.value = tabs.value[0].key;
    }
    void loadSelected(false);
  }
}

async function loadSelected(reset = false) {
  const tab = selectedTab.value;
  if (!tab) return;
  const state = ensureState(tab);
  const target = tab.webUrl || tab.raw.webUrl || tab.raw.web_url || tab.url;
  if (/^https?:\/\//i.test(String(target))) {
    state.webUrl = String(target);
    state.loading = false;
    return;
  }
  if (state.loading && !reset) return;
  if (!reset && state.items.length > 0) return;
  if (!reset && !state.hasMore) return;

  if (reset) {
    state.items = [];
    state.page = 1;
    state.hasMore = true;
    state.firstItem = '';
    state.lastItem = '';
    state.raw = null;
    state.error = '';
  }
  state.loading = true;
  state.error = '';
  try {
    const response = tab.nativeKind === 'dyh'
      ? await CoolapkTauriAPI.getDyhList(state.page)
      : await CoolapkTauriAPI.getDiscoveryPageData({
        url: tab.url || tab.pageName || tab.key,
        title: tab.title,
        subTitle: tab.subTitle,
        page: state.page,
        firstItem: state.firstItem,
        lastItem: state.lastItem,
        pageContext: JSON.stringify({ source: 'desktop-discovery', tab: tab.key }),
      });
    const parsed = parseDiscoveryPage(response, state.page);
    const known = new Set(state.items.map((item) => getEntityKey(item, 0)));
    const nextItems = parsed.items.filter((item, index) => !known.has(getEntityKey(item, index)));
    state.items.push(...nextItems);
    state.raw = parsed.raw;
    state.firstItem = parsed.firstItem;
    state.lastItem = parsed.lastItem;
    state.hasMore = parsed.hasMore && nextItems.length > 0;
    state.page += 1;
  } catch (error: any) {
    const detail = error?.message || String(error || '未知错误');
    state.error = `${tab.title}（${tab.url || tab.pageName || tab.key}）：${detail}`;
  } finally {
    state.loading = false;
  }
}

function selectTab(key: string) {
  selectedKey.value = key;
  localStorage.setItem('coolapk.discovery.selectedTab.v2', key);
  const tab = selectedTab.value;
  if (!tab) return;
  if (tab.openNewActivity && tab.nativeKind !== 'dyh') {
    openTab(tab);
    return;
  }
  void loadSelected(false);
}

function openTab(tab: DiscoveryTab) {
  if (tab.nativeKind === 'dyh') {
    selectedKey.value = tab.key;
    void loadSelected(true);
    return;
  }
  const route = resolveDiscoveryRoute(tab.raw);
  if (!route) return;
  if (route.kind === 'web') {
    openWeb(route.target);
    return;
  }
  if (route.kind === 'native') {
    navigateNative(route.target, tab.title);
    return;
  }
  navigateDataList(tab.url || tab.pageName || tab.key, tab.title);
}

function openEntity(entity: DiscoveryEntity) {
  const route = resolveDiscoveryRoute(entity);
  if (!route) return;
  if (route.kind === 'web') {
    openWeb(route.target);
  } else if (route.kind === 'native') {
    navigateNative(route.target, route.title || String(entity.title || ''));
  } else {
    navigateDataList(route.target, route.title || String(entity.title || ''));
  }
}

function navigateDataList(target: string, title: string) {
  const existing = tabs.value.find((tab) => tab.url === target || tab.pageName === target);
  if (existing) {
    selectedKey.value = existing.key;
    void loadSelected(false);
    return;
  }
  const key = `runtime:${target}`;
  if (!tabs.value.some((tab) => tab.key === key)) {
    tabs.value.push({ key, title: title || '内容', url: target, visible: true, order: tabs.value.length, raw: { title, url: target } });
  }
  selectedKey.value = key;
  void loadSelected(true);
}

function navigateNative(target: string, title: string) {
  const clean = target.replace(/^#/, '');
  const user = clean.match(/^\/user\/(\d+)/);
  const feed = clean.match(/^\/feed\/(\d+)/);
  const app = clean.match(/^\/apk\/([^/?#]+)/);
  const product = clean.match(/^\/product\/(\d+)/);
  const topic = clean.match(/^\/topic\/([^/?#]+)/);
  const dyh = clean.match(/^\/dyh\/(\d+)/);
  if (user) void router.push(`/user/${user[1]}`);
  else if (feed) void router.push(`/feed/${feed[1]}`);
  else if (app) void router.push(`/app/${encodeURIComponent(decodeDiscoveryRouteSegment(app[1]))}`);
  else if (product) void router.push(`/product/${product[1]}`);
  else if (topic) void router.push(`/topic/${encodeURIComponent(decodeDiscoveryRouteSegment(topic[1]))}`);
  else if (dyh) void router.push(`/dyh/${dyh[1]}`);
  else navigateDataList(target, title);
}

function openWeb(url: string) {
  void CoolapkTauriAPI.openUrl(url, 'internal');
}

function refresh() {
  if (selectedTab.value) void loadSelected(true);
  else void loadConfig();
}

function handleScroll(event: Event) {
  const element = event.currentTarget as HTMLElement;
  if (element.scrollHeight - element.scrollTop - element.clientHeight < 500) {
    void loadSelected(false);
  }
}

onMounted(() => { void loadConfig(); });
</script>

<style scoped>
.discover-page { flex: 1; width: 100%; min-width: 0; height: 100%; overflow-y: auto; padding: 20px clamp(20px, 3vw, 48px) 48px; background: var(--background); }
.discover-tabs { max-width: 1280px; width: 100%; margin: 0 auto 16px; display: flex; gap: 6px; overflow-x: auto; padding: 4px 2px 8px; scrollbar-width: none; }
.discover-tabs::-webkit-scrollbar { display: none; }
.discover-tab { position: relative; min-width: max-content; display: flex; align-items: center; gap: 7px; border: 0; background: transparent; color: var(--text-secondary); padding: 8px 14px 12px; cursor: pointer; font-size: 15px; font-weight: 500; transition: color .15s ease; }
.discover-tab:hover { color: var(--text-primary); }
.discover-tab.active { color: var(--brand-primary); font-weight: 700; }
.discover-tab small { color: var(--text-tertiary); font-size: 11px; }
.tab-indicator { position: absolute; left: 50%; bottom: 2px; width: 24px; height: 3px; transform: translateX(-50%); border-radius: 4px; background: var(--brand-primary); }
.web-route-card, .config-error { max-width: 1280px; width: 100%; margin: 0 auto 16px; background: var(--surface); border: 1px solid var(--border-light, rgba(0,0,0,.08)); border-radius: var(--radius-card, 12px); }
.web-route-card, .config-error { display: flex; align-items: center; gap: 14px; padding: 18px; }
.web-route-card > i { color: var(--brand-primary); font-size: 24px; }
.web-route-card div, .config-error { min-width: 0; }
.web-route-card div { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.web-route-card span, .config-error span { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.web-route-card button, .config-error button { border: 0; border-radius: 8px; padding: 8px 16px; background: var(--brand-primary); color: white; cursor: pointer; font-weight: 500; }
.config-error { flex-wrap: wrap; color: var(--text-primary); }
.config-error span { flex: 1 1 100%; }
.state-container { max-width: 1280px; width: 100%; margin: 30px auto 0; min-height: 360px; display: flex; justify-content: center; align-items: center; }
.discover-content { max-width: 1280px; width: 100%; margin: 0 auto; display: grid; gap: 16px; }
.discover-content.has-goods-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: stretch; }
.discover-content.has-dyh-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.loading-more, .no-more { padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
@media (max-width: 1250px) {
  .discover-content.has-goods-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 860px) {
  .discover-page { padding-inline: 14px; }
  .discover-content.has-dyh-grid { grid-template-columns: 1fr; }
  .discover-content.has-goods-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
