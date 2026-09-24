<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="appStore.isSearchOpen" class="search-backdrop" @click="appStore.closeSearch"></div>
    </Transition>
    <Transition name="scale-dialog">
      <div v-if="appStore.isSearchOpen" class="search-modal-wrapper">
        <div class="search-modal" @click.stop>
          <div class="search-input-header">
            <i class="fas fa-search search-icon"></i>
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              placeholder="搜索应用、动态、用户、话题..."
              class="search-input"
              @keydown="handleInputKeydown"
            />
            <button class="clear-btn" v-if="query" @click="query = ''"><i class="fas fa-times"></i></button>
            <kbd class="esc-kbd">ESC</kbd>
          </div>

          <button
            v-if="directFeedRoute"
            type="button"
            class="direct-feed-option"
            @mousedown.prevent="openDirectFeed"
          >
            <i class="fas fa-arrow-up-right-from-square direct-feed-icon"></i>
            <span class="direct-feed-info">
              <span class="direct-feed-title">打开酷安动态</span>
              <span class="direct-feed-route">{{ directFeedRoute }}</span>
            </span>
            <kbd>Enter</kbd>
          </button>

          <button
            v-else-if="directCollectionRoute"
            type="button"
            class="direct-feed-option"
            @mousedown.prevent="openDirectCollection"
          >
            <i class="fas fa-arrow-up-right-from-square direct-feed-icon"></i>
            <span class="direct-feed-info">
              <span class="direct-feed-title">打开酷安收藏单</span>
              <span class="direct-feed-route">{{ directCollectionRoute }}</span>
            </span>
            <kbd>Enter</kbd>
          </button>

          <div v-if="searchSuggestions.length > 0 && query" class="suggestion-list custom-scrollbar">
            <div
              v-for="(item, i) in searchSuggestions"
              :key="i"
              :class="['suggestion-item', { 'is-active': activeSuggestionIndex === i }]"
              :aria-selected="activeSuggestionIndex === i"
              @mouseenter="activeSuggestionIndex = i; activeResultIndex = -1"
              @mousedown.prevent="selectSuggestion(item)"
            >
              <i class="fas fa-search suggestion-icon"></i>
              <span class="suggestion-text">{{ getSearchEntityTitle(item) }}</span>
            </div>
          </div>

          <div class="search-results custom-scrollbar">
            <div v-if="loading && query" class="loading-wrapper">
              <LoadingState text="正在获取搜索建议..." />
            </div>

            <div v-else-if="!query" class="quick-suggestions">
              <div v-if="searchHistory.length" class="quick-history">
                <div class="quick-section-header"><span class="group-title">最近搜索</span><button type="button" @click="clearHistory">清空</button></div>
                <div class="recent-search-list">
                  <button v-for="item in searchHistory.slice(0, 8)" :key="item" type="button" class="recent-search-item" @click="applySearch(item)"><i class="far fa-clock"></i>{{ item }}</button>
                </div>
              </div>
              <span class="group-title">热门搜索</span>
              <div class="tag-cloud">
                <span
                  v-for="tag in suggestions"
                  :key="tag"
                  class="suggest-tag"
                  @click="applySearch(tag)"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <div v-else-if="query && results.length === 0 && searchSuggestions.length" class="search-submit-prompt">
              暂无即时搜索结果，按 Enter 查看完整结果
            </div>
            <div v-else-if="query && results.length === 0" class="empty-wrapper">
              <EmptyState title="未找到相关结果" />
            </div>
            <div v-else class="result-list">
              <div
                v-for="(item, i) in results"
                :key="i"
                :class="['result-item', { 'is-active': activeResultIndex === i }]"
                :aria-selected="activeResultIndex === i"
                @mouseenter="activeResultIndex = i; activeSuggestionIndex = -1"
                @click="selectResult(item)"
              >
                <i :class="[getIcon(item), 'result-icon']"></i>
                <div class="result-info">
                  <span class="result-title">{{ getSearchEntityTitle(item) }}</span>
                  <span class="result-sub">{{ getSearchEntitySubtitle(item) }}</span>
                </div>
              </div>
            </div>
            <div v-if="query && searchSuggestions.length" class="search-keyboard-hint"><kbd>↑</kbd><kbd>↓</kbd> 选择联想项 <kbd>Enter</kbd> 搜索或打开 <kbd>Esc</kbd> 关闭</div>
            <div v-else-if="query && results.length" class="search-keyboard-hint"><kbd>↑</kbd><kbd>↓</kbd> 选择结果 <kbd>Enter</kbd> 打开 <kbd>Esc</kbd> 关闭</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAndroidBackButton } from '../../utils/androidBackButton';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';
import { addSearchHistory, clearSearchHistory, loadSearchHistory, searchHistory } from '../../utils/searchHistory';
import type { SearchEntity } from '../../types/search';
import {
  extractHotSearchKeywords,
  extractSearchEntities,
  getSearchEntityKind,
  getSearchEntityRoute,
  getSearchEntitySearchTarget,
  getSearchEntitySubtitle,
  getSearchEntityTitle,
  getSearchEntityUrl,
  isNavigableSearchEntity,
} from '../../utils/searchEntities';
import { normalizeCoolapkCollectionLink, normalizeCoolapkDeepLink, normalizeCoolapkFeedLink, normalizeCoolapkRoute } from '../../utils/coolapkRoute';

const appStore = useAppStore();
const router = useRouter();

const query = ref('');
const loading = ref(false);
const results = ref<SearchEntity[]>([]);
const searchSuggestions = ref<SearchEntity[]>([]);
const searchInput = ref<HTMLInputElement | null>(null);
const activeSuggestionIndex = ref(-1);
const activeResultIndex = ref(-1);
const directFeedRoute = computed(() => normalizeCoolapkFeedLink(query.value.trim()));
const directCollectionRoute = computed(() => normalizeCoolapkCollectionLink(query.value.trim()));
let searchRequestVersion = 0;
const suggestions = ref<string[]>([]);
let hotSearchRequestVersion = 0;

useAndroidBackButton(() => appStore.isSearchOpen, () => appStore.closeSearch());

async function loadHotSearches() {
  const requestVersion = ++hotSearchRequestVersion;
  try {
    const res = await CoolapkTauriAPI.getHotSearches(true);
    if (requestVersion !== hotSearchRequestVersion) return;
    suggestions.value = extractHotSearchKeywords(res).slice(0, 12);
  } catch (err) {
    console.error('加载热门搜索失败', err);
  }
}

watch(() => appStore.isSearchOpen, (open) => {
  if (open) {
    query.value = '';
    results.value = [];
    searchSuggestions.value = [];
    activeSuggestionIndex.value = -1;
    activeResultIndex.value = -1;
    if (!suggestions.value.length) void loadHotSearches();
    void nextTick(async () => {
      if (appStore.isSearchOpen) searchInput.value?.focus();
    });
  }
});

let timer: any = null;
// 保留联想和即时结果两栏，联想项按 APK 返回的跳转地址执行。
watch(query, (val) => {
  if (timer) clearTimeout(timer);
  const requestVersion = ++searchRequestVersion;
  results.value = [];
  searchSuggestions.value = [];
  activeSuggestionIndex.value = -1;
  activeResultIndex.value = -1;
  loading.value = false;
  if (!val.trim()) {
    return;
  }
  timer = setTimeout(async () => {
    if (directFeedRoute.value || directCollectionRoute.value) {
      results.value = [];
      searchSuggestions.value = [];
      loading.value = false;
      return;
    }
    loading.value = true;
    try {
      const [searchRes, suggestRes] = await Promise.all([CoolapkTauriAPI.searchAll(val.trim(), 1), CoolapkTauriAPI.getSearchSuggestions(val.trim())]);
      if (requestVersion !== searchRequestVersion) return;
      results.value = deduplicateSearchResults(searchRes).slice(0, 8);
      searchSuggestions.value = extractSearchEntities(suggestRes).filter((item) => getSearchEntityTitle(item)).slice(0, 8);
    } catch (err) {
      console.error('Search error', err);
    } finally {
      if (requestVersion === searchRequestVersion) loading.value = false;
    }
  }, 300);
});

// 将搜索结果链接归一为桌面路由后去重，同一话题优先保留明确的话题实体。
function getSearchResultRoute(item: SearchEntity): string | null {
  const url = getSearchEntityUrl(item);
  const route = getSearchEntityRoute(item) || normalizeCoolapkDeepLink(url) || normalizeCoolapkRoute(url);
  return route ? normalizeCoolapkDeepLink(route) || normalizeCoolapkRoute(route) || route : null;
}

function isTopicSearchResult(item: SearchEntity): boolean {
  return getSearchEntityKind(item) === 'topic' || /^\/topic\//i.test(getSearchResultRoute(item) || '');
}

function deduplicateSearchResults(response: unknown): SearchEntity[] {
  const unique: SearchEntity[] = [];
  const routeIndexes = new Map<string, number>();
  for (const item of extractSearchEntities(response).filter(isNavigableSearchEntity)) {
    const route = getSearchResultRoute(item);
    if (!route) {
      unique.push(item);
      continue;
    }
    const existingIndex = routeIndexes.get(route);
    if (existingIndex === undefined) {
      routeIndexes.set(route, unique.length);
      unique.push(item);
    } else if (getSearchEntityKind(item) === 'topic' && getSearchEntityKind(unique[existingIndex]) !== 'topic') {
      unique[existingIndex] = item;
    }
  }
  return unique;
}

function applySearch(tag: string) {
  query.value = tag;
}

function selectSuggestion(item: SearchEntity) {
  const searchTarget = getSearchEntitySearchTarget(item);
  const title = getSearchEntityTitle(item);
  const historyValue = searchTarget?.keyword || title || query.value.trim();
  const route = getSearchResultRoute(item);
  searchSuggestions.value = [];
  activeSuggestionIndex.value = -1;
  if (route) {
    if (historyValue) addSearchHistory(historyValue);
    appStore.closeSearch();
    void router.push(route);
    return;
  }
  handleEnterSearch(searchTarget?.keyword || title || query.value, searchTarget?.searchType || '');
}

function handleEnterSearch(value = query.value, searchType = '') {
  const trimmed = value.trim();
  if (!trimmed) return;
  addSearchHistory(trimmed);
  appStore.closeSearch();
  const routeQuery: Record<string, string> = { q: trimmed };
  if (searchType) routeQuery.tab = searchType;
  void router.push({ path: '/search', query: routeQuery });
}

function handleInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (directFeedRoute.value) {
      openDirectFeed();
      return;
    }
    if (directCollectionRoute.value) {
      openDirectCollection();
      return;
    }
    if (activeSuggestionIndex.value >= 0 && searchSuggestions.value[activeSuggestionIndex.value]) selectSuggestion(searchSuggestions.value[activeSuggestionIndex.value]);
    else if (activeResultIndex.value >= 0 && results.value[activeResultIndex.value]) selectResult(results.value[activeResultIndex.value]);
    else handleEnterSearch();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!searchSuggestions.value.length && !results.value.length) return;
    e.preventDefault();
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    if (searchSuggestions.value.length) activeSuggestionIndex.value = activeSuggestionIndex.value < 0 ? (delta > 0 ? 0 : searchSuggestions.value.length - 1) : (activeSuggestionIndex.value + delta + searchSuggestions.value.length) % searchSuggestions.value.length;
    else activeResultIndex.value = activeResultIndex.value < 0 ? (delta > 0 ? 0 : results.value.length - 1) : (activeResultIndex.value + delta + results.value.length) % results.value.length;
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    appStore.closeSearch();
  }
}

function openDirectFeed() {
  const route = directFeedRoute.value;
  if (!route) return;
  appStore.closeSearch();
  void router.push(route);
}

function openDirectCollection() {
  const route = directCollectionRoute.value;
  if (!route) return;
  appStore.closeSearch();
  void router.push(route);
}

function clearHistory() {
  clearSearchHistory();
}

function selectResult(item: SearchEntity) {
  const route = getSearchResultRoute(item);
  appStore.closeSearch();
  if (route) void router.push(route);
  else handleEnterSearch();
}

function getIcon(item: SearchEntity) {
  if (isTopicSearchResult(item)) return 'fas fa-hashtag';
  switch (getSearchEntityKind(item)) {
    case 'user': return 'fas fa-user';
    case 'app': return 'fas fa-cube';
    case 'question': return 'fas fa-circle-question';
    default: return 'fas fa-align-left';
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (appStore.isSearchOpen) appStore.closeSearch();
    else appStore.openSearch();
  }
  if (appStore.isSearchOpen && e.key === 'Escape') {
    appStore.closeSearch();
  }
}

onMounted(() => {
  void loadSearchHistory();
  window.addEventListener('keydown', handleGlobalKeydown);
});
onUnmounted(() => window.removeEventListener('keydown', handleGlobalKeydown));
</script>

<style scoped>
.search-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 2500;
  backdrop-filter: blur(4px);
}

.search-modal-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  padding-top: 100px;
  z-index: 2501;
  pointer-events: none;
}

.search-modal {
  pointer-events: auto;
  width: 640px;
  max-height: 520px;
  background-color: var(--surface);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-dialog);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-input-header {
  height: 56px;
  padding: 0 var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  border-bottom: 1px solid var(--border-light);
}

.search-icon {
  font-size: 16px;
  color: var(--brand-primary);
}

.search-input {
  flex: 1;
  font-size: var(--font-size-title-sm);
  color: var(--text-primary);
}

.esc-kbd {
  font-size: 11px;
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
  color: var(--text-tertiary);
}

.search-results {
  flex: 1;
  padding: var(--space-4);
  overflow-y: auto;
}

.quick-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.quick-section-header button { color: var(--brand-primary); background: transparent; border: 0; cursor: pointer; font-size: var(--font-size-caption); }
.recent-search-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.recent-search-item { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; color: var(--text-secondary); background: var(--surface-hover); border: 1px solid var(--border-light); border-radius: var(--radius-pill); cursor: pointer; font-size: var(--font-size-caption); }
.recent-search-item:hover { color: var(--brand-primary); border-color: var(--brand-primary); background: var(--brand-soft); }

.quick-suggestions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.group-title {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.suggest-tag {
  font-size: var(--font-size-sub);
  padding: 4px 12px;
  background-color: var(--background);
  border-radius: var(--radius-pill);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.suggest-tag:hover {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
}

.search-keyboard-hint { padding: 8px 4px 0; color: var(--text-tertiary); font-size: var(--font-size-caption); text-align: right; }
.search-keyboard-hint kbd { margin: 0 2px; padding: 1px 5px; color: var(--text-secondary); background: var(--surface-hover); border: 1px solid var(--border); border-radius: 4px; font-size: 11px; }

.result-list { display: flex; flex-direction: column; gap: var(--space-1); }
.result-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border-radius: var(--radius-control); cursor: pointer; transition: background var(--duration-fast) var(--ease-default); }
.result-item:hover { background-color: var(--surface-hover); }
.result-item.is-active { background-color: var(--brand-soft); color: var(--brand-primary); }
.result-icon { font-size: 16px; color: var(--text-tertiary); width: 24px; text-align: center; }
.result-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.result-title { font-size: var(--font-size-sub); font-weight: var(--font-weight-medium); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-sub { font-size: var(--font-size-caption); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-submit-prompt { padding: 8px 4px; color: var(--text-tertiary); font-size: var(--font-size-caption); text-align: center; }

.suggestion-list {
  max-height: 200px;
  overflow-y: auto;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--border-light);
}

.direct-feed-option {
  width: calc(100% - var(--space-8));
  margin: var(--space-2) var(--space-4) 0;
  padding: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--brand-primary) 35%, var(--border));
  border-radius: var(--radius-control);
  background: var(--brand-soft);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.direct-feed-option:hover {
  border-color: var(--brand-primary);
  background: var(--brand-soft-hover);
}

.direct-feed-icon {
  color: var(--brand-primary);
  font-size: 16px;
}

.direct-feed-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.direct-feed-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
}

.direct-feed-route {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.direct-feed-option kbd {
  color: var(--text-tertiary);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
  font-size: 11px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default);
}

.suggestion-item:hover {
  background-color: var(--surface-hover);
}

.suggestion-item.is-active { background-color: var(--brand-soft); }

.suggestion-icon {
  font-size: 13px;
  color: var(--text-tertiary);
}

.suggestion-text {
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
