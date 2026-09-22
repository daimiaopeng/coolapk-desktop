<template>
  <section class="mobile-search-page" data-mobile-page="search" aria-label="搜索">
    <form class="mobile-search-input-row" @submit.prevent="submitSearch">
      <button v-if="route.path !== '/search'" type="button" aria-label="返回" @click="router.back()"><i class="fas fa-arrow-left"></i></button>
      <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
      <input v-model="inputValue" type="search" placeholder="搜索酷安内容" autocomplete="off" @keydown.esc="inputValue = ''" />
      <button v-if="inputValue" type="button" aria-label="清除" @click="inputValue = ''"><i class="fas fa-xmark"></i></button>
      <button class="mobile-search-submit" type="submit">搜索</button>
    </form>

    <nav class="mobile-search-tabs" aria-label="搜索分类">
      <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" @click="selectTab(tab.key)">{{ tab.label }}</button>
    </nav>

    <main class="mobile-search-scroll" @scroll.passive="handleScroll">
      <section v-if="!query" class="mobile-search-welcome">
        <div class="mobile-search-welcome-icon"><i class="fas fa-magnifying-glass"></i></div>
        <h1>搜索你感兴趣的内容</h1>
        <p>应用、数码、动态、用户和话题都可以搜索</p>
        <div v-if="hotWords.length" class="mobile-search-hot">
          <strong>热门搜索</strong>
          <button v-for="word in hotWords" :key="word" type="button" @click="useWord(word)">{{ word }}</button>
        </div>
      </section>

      <div v-else-if="loading && !items.length" class="mobile-search-state"><i class="fas fa-circle-notch fa-spin"></i><span>正在搜索…</span></div>
      <div v-else-if="error && !items.length" class="mobile-search-state is-error"><i class="fas fa-triangle-exclamation"></i><span>{{ error }}</span><button type="button" @click="loadResults(false)">重试</button></div>
      <section v-else class="mobile-search-results">
        <div v-if="!items.length" class="mobile-search-state"><i class="fas fa-box-open"></i><span>没有找到相关内容</span></div>
        <button v-for="(item, index) in items" :key="resultKey(item, index)" type="button" class="mobile-search-result" @click="openResult(item)">
          <span class="mobile-search-result-image">
            <img v-if="resultImage(item)" :src="resultImage(item)" alt="" referrerpolicy="no-referrer" />
            <i v-else :class="resultIcon(item)"></i>
          </span>
          <span class="mobile-search-result-copy">
            <strong>{{ resultTitle(item) }}</strong>
            <small>{{ resultSubtitle(item) }}</small>
          </span>
          <i class="fas fa-chevron-right mobile-search-result-arrow"></i>
        </button>
        <div class="mobile-search-footer"><span v-if="loading">正在加载更多…</span><span v-else-if="!hasMore">没有更多结果了</span></div>
      </section>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { DEFAULT_SEARCH_TABS, type SearchEntity } from '../../../types/search';
import { extractHotSearchKeywords, extractSearchEntities, getSearchEntityImage, getSearchEntityKind, getSearchEntityRoute, getSearchEntitySubtitle, getSearchEntityTitle, isSponsorSearchEntity } from '../../../utils/searchEntities';

defineOptions({ name: 'MobileSearchPage' });

const route = useRoute();
const router = useRouter();
const inputValue = ref(String(route.query.q || ''));
const query = ref(String(route.query.q || '').trim());
const activeTab = ref(String(route.query.tab || 'all'));
const items = ref<SearchEntity[]>([]);
const hotWords = ref<string[]>([]);
const loading = ref(false);
const error = ref('');
const page = ref(1);
const firstItem = ref('');
const lastItem = ref('');
const hasMore = ref(true);
const requestVersion = ref(0);
const tabs = DEFAULT_SEARCH_TABS;

function resultKey(item: SearchEntity, index: number): string { return String(item.id || item.entityId || item.uid || item.packageName || `${index}`); }
function resultTitle(item: SearchEntity): string { return getSearchEntityTitle(item) || '搜索结果'; }
function resultSubtitle(item: SearchEntity): string { return getSearchEntitySubtitle(item) || getSearchEntityKind(item); }
function resultImage(item: SearchEntity): string { return getSearchEntityImage(item); }
function resultIcon(item: SearchEntity): string {
  const kind = getSearchEntityKind(item);
  if (kind === 'user') return 'fas fa-user';
  if (kind === 'topic') return 'fas fa-hashtag';
  if (kind === 'app') return 'fas fa-cube';
  if (kind === 'product') return 'fas fa-mobile-screen-button';
  return 'fas fa-align-left';
}

async function loadHotWords() {
  try {
    const response = await CoolapkTauriAPI.getHotSearches(false);
    hotWords.value = extractHotSearchKeywords(response).slice(0, 12);
  } catch { hotWords.value = []; }
}

async function loadResults(loadMore: boolean) {
  if (!query.value || loading.value || (loadMore && !hasMore.value)) return;
  loading.value = true;
  error.value = '';
  const version = ++requestVersion.value;
  try {
    const response = await CoolapkTauriAPI.searchByType({ searchType: activeTab.value, query: query.value, page: page.value, firstItem: firstItem.value, lastItem: lastItem.value, pageType: 'search', feedType: activeTab.value === 'ask' ? 'all' : '', sort: activeTab.value === 'feed' ? 'default' : '' });
    if (version !== requestVersion.value) return;
    const rows = extractSearchEntities(response).filter((item) => !isSponsorSearchEntity(item));
    const known = new Set(items.value.map((item, index) => resultKey(item, index)));
    const fresh = rows.filter((item, index) => !known.has(resultKey(item, index)));
    items.value.push(...fresh);
    firstItem.value = String((response as any)?.firstItem || (fresh[0] && resultKey(fresh[0], 0)) || firstItem.value);
    lastItem.value = String((response as any)?.lastItem || (fresh[fresh.length - 1] && resultKey(fresh[fresh.length - 1], fresh.length - 1)) || lastItem.value);
    hasMore.value = rows.length > 0 && rows.length >= 10;
    page.value += 1;
  } catch (loadError) {
    if (version === requestVersion.value) error.value = loadError instanceof Error ? loadError.message : String(loadError);
  } finally {
    if (version === requestVersion.value) loading.value = false;
  }
}

function submitSearch() {
  const value = inputValue.value.trim();
  if (!value) return;
  void router.push({ path: '/search', query: { q: value, tab: activeTab.value } });
}
function useWord(word: string) { inputValue.value = word; submitSearch(); }
function selectTab(key: string) {
  activeTab.value = key;
  if (query.value) void router.push({ path: '/search', query: { q: query.value, tab: key } });
}
function openResult(item: SearchEntity) {
  const target = getSearchEntityRoute(item);
  if (target) void router.push(target);
}
function handleScroll(event: Event) {
  const target = event.currentTarget as HTMLElement;
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 180) void loadResults(true);
}
function resetFromRoute() {
  inputValue.value = String(route.query.q || '');
  query.value = inputValue.value.trim();
  activeTab.value = String(route.query.tab || 'all');
  items.value = [];
  page.value = 1;
  firstItem.value = '';
  lastItem.value = '';
  hasMore.value = true;
  void loadResults(false);
}

watch(() => `${route.query.q || ''}|${route.query.tab || ''}`, resetFromRoute);
onMounted(() => { void loadHotWords(); void loadResults(false); });
</script>

<style scoped>
.mobile-search-page { display: flex; flex: 1; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; background: #f2f2f6; color: #262629; }.mobile-search-input-row { display: flex; align-items: center; gap: 8px; margin: 10px 12px; padding: 0 10px; min-height: 46px; border-radius: 16px; background: #fff; }.mobile-search-input-row > i { color: #8e8e93; }.mobile-search-input-row input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-size: 15px; }.mobile-search-input-row button { border: 0; background: transparent; color: #888; font: inherit; }.mobile-search-input-row button:first-child { min-width: 34px; font-size: 18px; }.mobile-search-submit { color: #0f9d58 !important; font-size: 13px !important; }.mobile-search-tabs { display: flex; gap: 18px; flex: 0 0 auto; padding: 0 14px; overflow-x: auto; background: #fff; scrollbar-width: none; }.mobile-search-tabs::-webkit-scrollbar { display: none; }.mobile-search-tabs button { position: relative; flex: 0 0 auto; min-height: 46px; border: 0; background: transparent; color: #888; font: inherit; font-size: 14px; }.mobile-search-tabs button.active { color: #222; font-weight: 700; }.mobile-search-tabs button.active::after { position: absolute; right: 2px; bottom: 3px; left: 2px; height: 3px; content: ''; border-radius: 999px; background: #0f9d58; }.mobile-search-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px)); }.mobile-search-welcome { display: grid; place-items: center; gap: 8px; padding: 64px 22px; text-align: center; }.mobile-search-welcome-icon { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 24px; background: #e2f5eb; color: #0f9d58; font-size: 32px; }.mobile-search-welcome h1 { margin: 8px 0 0; font-size: 19px; }.mobile-search-welcome p { margin: 0; color: #999; font-size: 13px; }.mobile-search-hot { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 18px; }.mobile-search-hot strong { width: 100%; color: #666; font-size: 13px; }.mobile-search-hot button { padding: 7px 11px; border: 0; border-radius: 999px; background: #fff; color: #555; font: inherit; font-size: 12px; }.mobile-search-state { display: grid; place-items: center; gap: 10px; min-height: 220px; padding: 24px; color: #888; text-align: center; }.mobile-search-state.is-error { color: #d94b42; }.mobile-search-state button { min-height: 34px; padding: 0 15px; border: 0; border-radius: 999px; background: #0f9d58; color: #fff; font: inherit; }.mobile-search-results { display: grid; gap: 8px; padding: 10px 10px 0; }.mobile-search-result { display: flex; align-items: center; gap: 11px; min-width: 0; padding: 12px; border: 0; border-radius: 16px; background: #fff; text-align: left; }.mobile-search-result-image { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; overflow: hidden; border-radius: 12px; background: #e9f4ef; color: #0f9d58; }.mobile-search-result-image img { width: 100%; height: 100%; object-fit: cover; }.mobile-search-result-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px; }.mobile-search-result-copy strong { overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }.mobile-search-result-copy small { overflow: hidden; color: #999; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.mobile-search-result-arrow { color: #c3c3c6; }.mobile-search-footer { min-height: 44px; padding-top: 14px; color: #999; text-align: center; font-size: 12px; }
</style>
