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

          <div v-if="searchSuggestions.length > 0 && query" class="suggestion-list custom-scrollbar">
            <div
              v-for="(item, i) in searchSuggestions"
              :key="i"
              class="suggestion-item"
              @mousedown.prevent="selectSuggestion(item.title)"
            >
              <i class="fas fa-search suggestion-icon"></i>
              <span class="suggestion-text">{{ item.title }}</span>
            </div>
          </div>

          <div class="search-results custom-scrollbar">
            <div v-if="loading" class="loading-wrapper">
              <LoadingState text="搜索中..." />
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

            <div v-else-if="results.length === 0" class="empty-wrapper">
              <EmptyState title="未找到相关结果" />
            </div>

            <div v-else class="result-list">
              <div
                v-for="(item, i) in results"
                :key="i"
                :class="['result-item', { 'is-active': activeResultIndex === i }]"
                :aria-selected="activeResultIndex === i"
                @mouseenter="activeResultIndex = i"
                @click="selectResult(item)"
              >
                <i :class="[getIcon(item.type), 'result-icon']"></i>
                <div class="result-info">
                  <span class="result-title">{{ item.title || item.username || item.entityTemplate }}</span>
                  <span class="result-sub">{{ item.subTitle || item.message }}</span>
                </div>
              </div>
            </div>
            <div v-if="query && results.length" class="search-keyboard-hint"><kbd>↑</kbd><kbd>↓</kbd> 选择 <kbd>Enter</kbd> 打开 <kbd>Esc</kbd> 关闭</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { CoolapkTauriAPI } from '../../api/coolapk';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';
import { openFeedDetail } from '../../utils/feedNavigation';
import { addSearchHistory, clearSearchHistory, loadSearchHistory, searchHistory } from '../../utils/searchHistory';

const appStore = useAppStore();
const router = useRouter();

const query = ref('');
const loading = ref(false);
const results = ref<any[]>([]);
const searchSuggestions = ref<{ title: string }[]>([]);
const searchInput = ref<HTMLInputElement | null>(null);
const activeResultIndex = ref(-1);
let searchRequestVersion = 0;

const suggestions = ['小米15', 'RTX 5090', 'iOS 18', '酷安桌面版', '鸿蒙OS'];

watch(() => appStore.isSearchOpen, (open) => {
  if (open) {
    query.value = '';
    results.value = [];
    searchSuggestions.value = [];
    activeResultIndex.value = -1;
    nextTick(() => searchInput.value?.focus());
  }
});

let timer: any = null;
watch(query, (val) => {
  if (timer) clearTimeout(timer);
  if (!val.trim()) {
    results.value = [];
    searchSuggestions.value = [];
    activeResultIndex.value = -1;
    return;
  }
  timer = setTimeout(async () => {
    const requestVersion = ++searchRequestVersion;
    loading.value = true;
    try {
      const [searchRes, suggestRes] = await Promise.all([
        CoolapkTauriAPI.searchAll(val.trim(), 1),
        CoolapkTauriAPI.getSearchSuggestions(val.trim())
      ]);
      if (requestVersion !== searchRequestVersion) return;
      if (searchRes && searchRes.data) {
        results.value = searchRes.data.slice(0, 8);
        activeResultIndex.value = results.value.length ? 0 : -1;
      }
      if (suggestRes?.data && Array.isArray(suggestRes.data)) {
        searchSuggestions.value = suggestRes.data;
      }
    } catch (err) {
      console.error('Search error', err);
    } finally {
      loading.value = false;
    }
  }, 300);
});

function applySearch(tag: string) {
  query.value = tag;
}

function selectSuggestion(title: string) {
  query.value = title;
  searchSuggestions.value = [];
  handleEnterSearch();
}

function handleEnterSearch() {
  if (!query.value.trim()) return;
  addSearchHistory(query.value);
  appStore.closeSearch();
  router.push({ path: '/search', query: { q: query.value.trim() } });
}

function handleInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (activeResultIndex.value >= 0 && results.value[activeResultIndex.value]) selectResult(results.value[activeResultIndex.value]);
    else handleEnterSearch();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!results.value.length) return;
    e.preventDefault();
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    activeResultIndex.value = (activeResultIndex.value + delta + results.value.length) % results.value.length;
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    appStore.closeSearch();
  }
}

function clearHistory() {
  clearSearchHistory();
}

function selectResult(item: any) {
  appStore.closeSearch();
  const type = String(item.type || item.entityTemplate || item.entityType || '').toLowerCase();
  const uid = item.uid || item.userId || item.entityId;
  const packageName = item.packageName || item.package_name || item.pkg;
  const tag = item.tag || item.topicTag;
  if (type.includes('user') && uid) return void router.push(`/user/${uid}`);
  if (type.includes('topic') && tag) return void router.push(`/topic/${encodeURIComponent(tag)}`);
  if ((type.includes('apk') || type.includes('app') || type.includes('game')) && packageName) return void router.push(`/app/${encodeURIComponent(packageName)}`);
  if (item.id) openFeedDetail(router, item.id, item);
}

function getIcon(type?: string) {
  switch (type) {
    case 'user': return 'fas fa-user';
    case 'apk': return 'fas fa-cube';
    case 'topic': return 'fas fa-hashtag';
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

.result-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default);
}

.result-item:hover {
  background-color: var(--surface-hover);
}

.result-item.is-active { background-color: var(--brand-soft); color: var(--brand-primary); }
.search-keyboard-hint { padding: 8px 4px 0; color: var(--text-tertiary); font-size: var(--font-size-caption); text-align: right; }
.search-keyboard-hint kbd { margin: 0 2px; padding: 1px 5px; color: var(--text-secondary); background: var(--surface-hover); border: 1px solid var(--border); border-radius: 4px; font-size: 11px; }

.result-icon {
  font-size: 16px;
  color: var(--text-tertiary);
  width: 24px;
  text-align: center;
}

.result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.result-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-sub {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-list {
  max-height: 200px;
  overflow-y: auto;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--border-light);
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
