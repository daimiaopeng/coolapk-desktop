<template>
  <div class="search-page-layout">
    <div class="search-main-column">
      <div class="search-toolbar">
        <div class="search-toolbar-content">
          <div ref="searchAreaRef" class="search-input-area">
            <div class="search-input-wrapper">
              <i class="fas fa-search search-input-icon"></i>
              <input v-model="searchQuery" type="text" class="search-field" :placeholder="searchPlaceholder" @keydown.enter="doSearch(searchQuery)" @focus="onInputFocus" />
              <button v-if="searchQuery" type="button" class="clear-btn" aria-label="清空搜索" @click="clearSearch"><i class="fas fa-times"></i></button>
            </div>
            <div v-if="showHistory && !searchQuery.trim() && searchHistory.length" class="search-history-dropdown">
              <div class="search-history-header"><span>最近搜索</span><button type="button" @mousedown.prevent="clearHistory">清空</button></div>
              <button v-for="item in searchHistory" :key="item" type="button" class="search-history-item" @mousedown.prevent="selectHistory(item)">
                <i class="far fa-clock"></i><span>{{ item }}</span><i class="fas fa-times remove-history" @mousedown.stop.prevent="removeHistory(item)"></i>
              </button>
            </div>
            <div v-if="searchSuggestions.length && showSuggestions" class="suggestions-dropdown custom-scrollbar">
              <button v-for="(item, index) in searchSuggestions" :key="`${getSearchEntityTitle(item)}-${index}`" type="button" class="suggestion-item" @mousedown.prevent="selectSuggestion(item)">
                <i class="fas fa-search suggestion-icon"></i><span class="suggestion-text">{{ getSearchEntityTitle(item) }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="queryStr && !isTopicScopedSearch" class="search-tabs custom-scrollbar">
          <button v-for="tab in searchTabs" :key="tab.key" type="button" :class="['search-tab-item', { active: activeTab === tab.key }]" @click="switchTab(tab.key)">
            <i v-if="tab.icon" :class="tab.icon"></i><span>{{ tab.label }}</span>
          </button>
        </div>

        <div v-if="queryStr && !isTopicScopedSearch && isAskTab" class="search-ask-filter" role="tablist" aria-label="问答类型">
          <button
            v-for="option in askFeedTypeOptions"
            :key="option.key"
            type="button"
            role="tab"
            :class="['search-ask-filter-item', { active: askFeedType === option.key }]"
            :aria-selected="askFeedType === option.key"
            @click="switchAskFeedType(option.key)"
          >
            <i :class="option.icon" aria-hidden="true"></i>
            <span>{{ option.label }}</span>
          </button>
        </div>
      </div>

      <div class="search-scroll-container custom-scrollbar" @scroll="handleScroll">
        <template v-if="queryStr">
          <section class="search-results-section">
            <div v-if="activeState.loading && !activeState.items.length" class="loading-wrapper"><LoadingState text="正在搜索..." /></div>
            <div v-else-if="activeState.error && !activeState.items.length" class="empty-wrapper"><EmptyState title="搜索失败" :description="activeState.error" /><button type="button" class="retry-button" @click="fetchTab(activeTab)">重试</button></div>
            <div v-else-if="!activeState.items.length" class="empty-wrapper"><EmptyState title="未搜索到相关结果" description="请尝试输入其他关键字重新搜索" /></div>
            <div v-else class="search-result-list">
              <SearchResultItem v-for="(item, index) in activeState.items" :key="entityKey(item, index)" :entity="item" :highlight-keyword="queryStr" :show-follow="activeTab === 'user' || activeTab === 'users'" :followed="isUserFollowed(item)" @deleted="removeEntity" @search="doSearch" @toggle-follow="toggleFollow" />
              <div class="pagination-footer">
                <LoadingState v-if="activeState.loadingMore" text="加载更多中..." />
                <div v-else-if="activeState.cursor.noMore" class="no-more">没有更多结果了</div>
              </div>
            </div>
          </section>
        </template>

        <section v-else class="search-welcome">
          <p class="search-welcome-hint">{{ searchWelcomeHint }}</p>
          <template v-if="!isTopicScopedSearch">
            <SearchHotListCard v-for="(item, index) in hotItems" :key="entityKey(item, index)" :entity="item" @search="doSearch" />
            <EmptyState v-if="!hotItems.length" title="开始搜索" description="热门搜索由酷安接口动态提供" />
          </template>
          <EmptyState v-else title="搜索话题帖子" description="输入关键词，搜索当前话题里的帖子" />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, onActivated, onDeactivated, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import EmptyState from '../components/common/EmptyState.vue';
import LoadingState from '../components/common/LoadingState.vue';
import SearchHotListCard from '../components/search/SearchHotListCard.vue';
import SearchResultItem from '../components/search/SearchResultItem.vue';
import { useAuthStore } from '../stores/auth';
import type { SearchEntity, SearchTabDefinition, SearchTabState } from '../types/search';
import { DEFAULT_SEARCH_TABS } from '../types/search';
import { addSearchHistory, clearSearchHistory, loadSearchHistory, removeSearchHistory, searchHistory } from '../utils/searchHistory';
import { extractSearchEntities, extractSearchTabs, getSearchEntityId, getSearchEntitySearchTarget, getSearchEntityTitle, isSponsorSearchEntity, normalizeSearchEntityForTab } from '../utils/searchEntities';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

function readQueryString(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? '').trim() : String(value ?? '').trim();
}

const initialPageType = readQueryString(route.query.pageType);
const initialPageParam = readQueryString(route.query.pageParam);
const initialTopicSearch = initialPageType === 'tag' && initialPageParam ? initialPageParam : '';
const queryStr = ref(readQueryString(route.query.q));
const searchQuery = ref(queryStr.value);
const searchTabs = ref<SearchTabDefinition[]>(DEFAULT_SEARCH_TABS);
const activeTab = ref(initialTopicSearch ? 'feed' : readQueryString(route.query.tab) || 'all');
const askFeedTypeOptions = [
  { key: 'all', label: '全部', icon: 'fas fa-layer-group' },
  { key: 'question', label: '提问', icon: 'fas fa-circle-question' },
  { key: 'answer', label: '回答', icon: 'fas fa-comment-dots' },
];
const askFeedType = ref(normalizeAskFeedType(readQueryString(route.query.feedType)));
const hotItems = ref<SearchEntity[]>([]);
const tabStates = reactive<Record<string, SearchTabState>>({});
const showSuggestions = ref(false);
const showHistory = ref(false);
const searchSuggestions = ref<SearchEntity[]>([]);
const searchAreaRef = ref<HTMLElement | null>(null);
let suggestTimer: ReturnType<typeof setTimeout> | null = null;
let searchSequence = 0;
let configLoaded = false;

const scopedTopicTag = computed(() => {
  return readQueryString(route.query.pageType) === 'tag' ? readQueryString(route.query.pageParam) : '';
});

const isTopicScopedSearch = computed(() => Boolean(scopedTopicTag.value));

const searchPlaceholder = computed(() => {
  return isTopicScopedSearch.value
    ? (scopedTopicTag.value ? `搜索“${scopedTopicTag.value}”话题的内容` : '搜索此话题的内容')
    : '搜索应用、动态、用户、话题...';
});

const searchWelcomeHint = computed(() => {
  return isTopicScopedSearch.value
    ? `输入关键词，搜索“${scopedTopicTag.value}”吧里的帖子`
    : '输入关键词，搜索酷安的应用、游戏、动态、用户和话题';
});

function newTabState(): SearchTabState {
  return { items: [], loading: false, loadingMore: false, error: '', cursor: { page: 1, firstItem: '', lastItem: '', noMore: false }, requestVersion: 0 };
}

function ensureTabState(key: string): SearchTabState {
  if (!tabStates[key]) tabStates[key] = newTabState();
  return tabStates[key];
}

const activeState = computed(() => ensureTabState(activeTab.value));

const isAskTab = computed(() => {
  const tab = searchTabs.value.find((item) => item.key === activeTab.value);
  return tab?.searchType === 'ask' || activeTab.value === 'ask';
});

function normalizeAskFeedType(value: string): string {
  return ['all', 'question', 'answer'].includes(value.toLowerCase()) ? value.toLowerCase() : 'all';
}

function switchAskFeedType(value: string) {
  if (!isAskTab.value) return;
  const nextFeedType = normalizeAskFeedType(value);
  if (askFeedType.value === nextFeedType && readQueryString(route.query.feedType) === nextFeedType) return;
  askFeedType.value = nextFeedType;
  void router.push({
    path: '/search',
    query: { q: queryStr.value, tab: activeTab.value, feedType: nextFeedType },
  });
}

function entityKey(entity: SearchEntity, index: number): string {
  return `${getSearchEntityId(entity) || getSearchEntityTitle(entity) || 'entity'}-${index}`;
}

function resetTabStates() {
  Object.keys(tabStates).forEach((key) => delete tabStates[key]);
  searchTabs.value.forEach((tab) => ensureTabState(tab.key));
}

function syncActiveTab(requested: string) {
  if (isTopicScopedSearch.value) {
    activeTab.value = 'feed';
    return;
  }
  activeTab.value = searchTabs.value.some((tab) => tab.key === requested) ? requested : (searchTabs.value[0]?.key || 'all');
}

async function loadSearchConfig() {
  if (isTopicScopedSearch.value) {
    searchTabs.value = DEFAULT_SEARCH_TABS.filter((tab) => tab.searchType === 'feed');
    configLoaded = true;
    activeTab.value = 'feed';
    resetTabStates();
    if (queryStr.value) void fetchTab('feed');
    return;
  }
  try {
    const response = await CoolapkTauriAPI.getTabConfig();
    searchTabs.value = extractSearchTabs(response);
  } catch (error) {
    console.warn('加载搜索页签配置失败，使用协议默认页签', error);
    searchTabs.value = DEFAULT_SEARCH_TABS;
  } finally {
    configLoaded = true;
    syncActiveTab(String(route.query.tab || activeTab.value || 'all'));
    resetTabStates();
    if (queryStr.value) void fetchTab(activeTab.value);
  }
}

async function loadHotItems() {
  try {
    const response = await CoolapkTauriAPI.getHotSearches(false);
    hotItems.value = extractSearchEntities(response).filter((item) => !isSponsorSearchEntity(item)).filter((item) => item.entities?.length || getSearchEntityTitle(item));
  } catch (error) {
    console.warn('加载热门搜索失败', error);
  }
}

function responseFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

async function fetchTab(tabKey: string, loadMore = false) {
  if (!queryStr.value) return;
  const scoped = isTopicScopedSearch.value;
  const tab = scoped
    ? DEFAULT_SEARCH_TABS.find((item) => item.searchType === 'feed')
    : searchTabs.value.find((item) => item.key === tabKey) || DEFAULT_SEARCH_TABS.find((item) => item.key === tabKey);
  if (!tab) return;
  const state = ensureTabState(tab.key);
  if (loadMore && (state.loading || state.loadingMore || state.cursor.noMore)) return;
  if (!loadMore && state.loading) return;
  const requestVersion = ++state.requestVersion;
  const sequence = ++searchSequence;
  if (loadMore) state.loadingMore = true;
  else { state.loading = true; state.error = ''; }
  try {
    const response: any = await CoolapkTauriAPI.searchByType({
      searchType: tab.searchType,
      query: queryStr.value,
      page: loadMore ? state.cursor.page : 1,
      firstItem: loadMore ? state.cursor.firstItem : '',
      lastItem: loadMore ? state.cursor.lastItem : '',
      pageType: scoped ? 'tag' : tab.searchType === 'feed' ? 'search' : '',
      pageParam: scoped ? scopedTopicTag.value : '',
      feedType: tab.searchType === 'ask' ? askFeedType.value : tab.searchType === 'feed' ? 'all' : '',
      sort: tab.searchType === 'feed' ? 'default' : '',
    });
    if (requestVersion !== state.requestVersion || sequence !== searchSequence) return;
    const rows = extractSearchEntities(response)
      .map((item) => normalizeSearchEntityForTab(item, tab.searchType))
      .filter((item) => !isSponsorSearchEntity(item));
    const existing = new Set(state.items.map((item) => entityKey(item, 0)));
    const uniqueRows = rows.filter((item, index) => {
      const key = entityKey(item, index);
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    if (loadMore) state.items.push(...uniqueRows);
    else state.items = uniqueRows;
    const first = uniqueRows[0] ? getSearchEntityId(uniqueRows[0]) : '';
    const last = uniqueRows[uniqueRows.length - 1] ? getSearchEntityId(uniqueRows[uniqueRows.length - 1]) : '';
    const responseFirst = String(response?.firstItem ?? response?.first_item ?? response?.data?.firstItem ?? response?.data?.first_item ?? '').trim();
    const responseLast = String(response?.lastItem ?? response?.last_item ?? response?.data?.lastItem ?? response?.data?.last_item ?? '').trim();
    state.cursor = {
      page: loadMore ? state.cursor.page + 1 : 2,
      firstItem: responseFirst || first || state.cursor.firstItem,
      lastItem: responseLast || last || state.cursor.lastItem,
      noMore: responseFlag(response?.noMore ?? response?.data?.noMore) || rows.length === 0,
    };
  } catch (error) {
    if (requestVersion === state.requestVersion) state.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (requestVersion === state.requestVersion) { state.loading = false; state.loadingMore = false; }
  }
}

function onInputFocus() {
  showHistory.value = !searchQuery.value.trim();
  showSuggestions.value = searchSuggestions.value.length > 0;
}

function handleClickOutside(event: MouseEvent) {
  if (searchAreaRef.value && !searchAreaRef.value.contains(event.target as Node)) { showSuggestions.value = false; showHistory.value = false; }
}

function clearSearch() {
  searchQuery.value = '';
  searchSuggestions.value = [];
  showSuggestions.value = false;
  showHistory.value = false;
}

function selectHistory(value: string) {
  searchQuery.value = value;
  showHistory.value = false;
  doSearch(value);
}

function removeHistory(value: string) { removeSearchHistory(value); }
function clearHistory() { clearSearchHistory(); showHistory.value = false; }

function selectSuggestion(item: SearchEntity) {
  const searchTarget = getSearchEntitySearchTarget(item);
  if (searchTarget) {
    doSearch(searchTarget.keyword, searchTarget.searchType);
    return;
  }
  const title = getSearchEntityTitle(item);
  if (title) doSearch(title);
}

function doSearch(value: string, requestedSearchType = '') {
  const trimmed = value.trim();
  if (!trimmed) return;
  showSuggestions.value = false;
  showHistory.value = false;
  addSearchHistory(trimmed);
  const query: Record<string, string> = { q: trimmed };
  if (isTopicScopedSearch.value) {
    query.tab = 'feed';
    query.pageType = 'tag';
    query.pageParam = scopedTopicTag.value;
  } else {
    const requestedTab = searchTabs.value.find((tab) => tab.key === requestedSearchType || tab.searchType === requestedSearchType);
    const targetTab = requestedTab?.key || (requestedSearchType && DEFAULT_SEARCH_TABS.some((tab) => tab.key === requestedSearchType) ? requestedSearchType : activeTab.value);
    query.tab = targetTab;
    const targetDefinition = searchTabs.value.find((tab) => tab.key === targetTab);
    if (targetDefinition?.searchType === 'ask' || targetTab === 'ask') query.feedType = askFeedType.value;
  }
  void router.push({ path: '/search', query });
}

function switchTab(key: string) {
  if (isTopicScopedSearch.value) return;
  if (activeTab.value === key) return;
  activeTab.value = key;
  const targetTab = searchTabs.value.find((tab) => tab.key === key);
  const query: Record<string, string> = { q: queryStr.value, tab: key };
  if (targetTab?.searchType === 'ask' || key === 'ask') query.feedType = askFeedType.value;
  void router.push({ path: '/search', query });
}

function removeEntity(id: string | number) {
  const state = ensureTabState(activeTab.value);
  state.items = state.items.filter((item) => String(getSearchEntityId(item)) !== String(id));
}

function isUserFollowed(user: SearchEntity): boolean {
  const value = user.follow ?? user.following;
  return value === true || value === 1 || value === '1' || value === 'true';
}

async function toggleFollow(user: SearchEntity) {
  const uid = String(user.uid ?? user.userId ?? user.user_id ?? '');
  if (!uid) return;
  if (!authStore.isLoggedIn) { authStore.openLoginModal(); return; }
  const followed = isUserFollowed(user);
  try {
    if (followed) await CoolapkTauriAPI.unfollowUser(uid);
    else await CoolapkTauriAPI.followUser(uid);
    user.follow = !followed;
    user.following = !followed;
  } catch (error) {
    console.error('关注操作失败', error);
  }
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) void fetchTab(activeTab.value, true);
}

async function fetchSuggestions(value: string) {
  const trimmed = value.trim();
  if (!trimmed) { searchSuggestions.value = []; return; }
  try {
    let response = await CoolapkTauriAPI.getSearchSuggestionsApp(trimmed);
    let rows = extractSearchEntities(response).filter((item) => getSearchEntityTitle(item));
    if (!rows.length) {
      response = await CoolapkTauriAPI.getSearchSuggestions(trimmed);
      rows = extractSearchEntities(response).filter((item) => getSearchEntityTitle(item));
    }
    searchSuggestions.value = rows.slice(0, 8);
    showSuggestions.value = rows.length > 0;
  } catch (error) {
    console.warn('加载搜索联想失败', error);
  }
}

watch(searchQuery, (value) => {
  showHistory.value = !value.trim();
  if (suggestTimer) clearTimeout(suggestTimer);
  if (!value.trim()) { searchSuggestions.value = []; showSuggestions.value = false; return; }
  suggestTimer = setTimeout(() => void fetchSuggestions(value), 300);
});

watch(() => [
  readQueryString(route.query.q),
  readQueryString(route.query.tab),
  readQueryString(route.query.pageType),
  readQueryString(route.query.pageParam),
  readQueryString(route.query.feedType),
], ([nextQuery, nextTab, , , nextFeedType]) => {
  const normalizedQuery = nextQuery;
  queryStr.value = normalizedQuery;
  searchQuery.value = normalizedQuery;
  askFeedType.value = normalizeAskFeedType(nextFeedType);
  if (isTopicScopedSearch.value) {
    activeTab.value = 'feed';
  } else if (configLoaded) {
    syncActiveTab(nextTab || activeTab.value || 'all');
  }
  resetTabStates();
  if (normalizedQuery) void fetchTab(activeTab.value);
}, { immediate: true });

function bindGlobalListeners() {
  document.addEventListener('click', handleClickOutside);
}

function unbindGlobalListeners() {
  document.removeEventListener('click', handleClickOutside);
}

onMounted(() => {
  void loadSearchHistory();
  void loadHotItems();
  void loadSearchConfig();
});

onActivated(bindGlobalListeners);
onDeactivated(unbindGlobalListeners);
onUnmounted(() => {
  if (suggestTimer) clearTimeout(suggestTimer);
  unbindGlobalListeners();
});
</script>

<style scoped>
.search-page-layout { container-type: inline-size; container-name: search-layout; display: flex; width: 100%; height: 100%; overflow: hidden; }
.search-main-column { display: flex; flex: 1; flex-direction: column; min-width: 0; height: 100%; overflow: hidden; background: var(--surface); }
.search-toolbar { position: relative; z-index: 2; flex: 0 0 auto; background: var(--surface); border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, .06)); }
.search-toolbar-content { padding: 14px 20px 12px; }
.search-input-area { position: relative; margin: 0; }
.search-input-wrapper { display: flex; align-items: center; gap: 12px; height: 46px; box-sizing: border-box; padding: 0 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; transition: border-color var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default); }
.search-input-wrapper:focus-within { border-color: var(--brand-primary); box-shadow: 0 0 0 3px var(--brand-soft); }
.search-input-icon { color: var(--text-secondary); font-size: 15px; }
.search-field { flex: 1; min-width: 0; color: var(--text-primary); font-size: var(--font-size-sub); outline: none; }
.search-field::placeholder { color: var(--text-tertiary); }
.clear-btn { display: grid; place-items: center; width: 26px; height: 26px; color: var(--text-tertiary); background: transparent; border: 0; border-radius: 50%; cursor: pointer; }
.clear-btn:hover { color: var(--text-primary); background: var(--surface-hover); }
.suggestions-dropdown, .search-history-dropdown { position: absolute; top: calc(100% + 4px); right: 0; left: 0; z-index: 20; max-height: 260px; padding: 6px; overflow-y: auto; background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-control); box-shadow: var(--shadow-dialog); }
.suggestion-item, .search-history-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px; color: var(--text-secondary); text-align: left; background: transparent; border: 0; border-radius: var(--radius-xs); cursor: pointer; }
.suggestion-item:hover, .search-history-item:hover { color: var(--text-primary); background: var(--surface-hover); }
.suggestion-text, .search-history-item span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.suggestion-icon, .search-history-item > .far { color: var(--text-tertiary); }
.search-history-header { display: flex; justify-content: space-between; padding: 5px 9px 8px; color: var(--text-tertiary); font-size: var(--font-size-caption); }
.search-history-header button { color: var(--brand-primary); background: transparent; border: 0; cursor: pointer; }
.remove-history { padding: 3px; color: var(--text-tertiary); }
.remove-history:hover { color: var(--danger); }
.search-tabs { display: flex; gap: clamp(8px, 2vw, 24px); min-width: 0; padding: 0 20px; overflow-x: auto; scrollbar-width: none; }
.search-tabs::-webkit-scrollbar { display: none; }
.search-tab-item { display: inline-flex; align-items: center; gap: 7px; position: relative; flex: 0 0 auto; min-height: 44px; padding: 0 8px; color: var(--text-secondary); font-size: var(--font-size-sub); font-weight: var(--font-weight-medium); white-space: nowrap; background: transparent; border: 0; cursor: pointer; }
.search-tab-item.active { color: var(--brand-primary); font-weight: var(--font-weight-bold); }
.search-tab-item.active::after { position: absolute; right: 8px; bottom: 0; left: 8px; height: 3px; content: ''; background: var(--brand-primary); border-radius: 3px 3px 0 0; }
.search-ask-filter { display: flex; gap: 8px; padding: 8px 20px 10px; overflow-x: auto; background: var(--surface); border-top: 1px solid var(--border-light, rgba(0, 0, 0, .06)); scrollbar-width: none; }
.search-ask-filter::-webkit-scrollbar { display: none; }
.search-ask-filter-item { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 12px; color: var(--text-secondary); font-size: var(--font-size-caption); white-space: nowrap; background: transparent; border: 0; border-radius: 999px; cursor: pointer; }
.search-ask-filter-item.active { color: var(--brand-primary); font-weight: var(--font-weight-bold); background: var(--brand-soft); }
.search-scroll-container { flex: 1; min-height: 0; overflow-y: auto; background: var(--background-secondary); }
.search-results-section, .search-welcome { width: 100%; box-sizing: border-box; padding: 16px 20px 28px; }
.search-result-list { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.loading-wrapper, .empty-wrapper { padding: var(--space-6) 0; text-align: center; }
.retry-button { margin-top: 10px; padding: 6px 14px; color: var(--brand-primary); background: var(--brand-soft); border: 0; border-radius: var(--radius-control); cursor: pointer; }
.pagination-footer { padding: var(--space-4) 0; text-align: center; }
.no-more { color: var(--text-tertiary); font-size: var(--font-size-caption); }
.search-welcome { display: flex; flex-direction: column; gap: 12px; }
.search-welcome-hint { margin: 0 0 4px; padding: 0 2px; color: var(--text-secondary); font-size: var(--font-size-sub); }
@container search-layout (max-width: 640px) {
  .search-toolbar-content { padding: 14px 12px 10px; }
  .search-tabs { gap: 4px; padding: 0 12px; }
  .search-tab-item { min-height: 42px; padding: 0 7px; }
  .search-tab-item.active::after { right: 7px; left: 7px; }
  .search-ask-filter { padding: 8px 12px 10px; }
  .search-results-section, .search-welcome { padding: 12px 12px 24px; }
}
</style>
