<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <h2 class="page-title" v-if="!queryStr">搜索</h2>
      <h2 class="page-title" v-else>搜索结果：{{ queryStr }}</h2>
    </div>

    <div class="search-input-area" ref="searchAreaRef">
      <div class="search-input-wrapper">
        <i class="fas fa-search search-input-icon"></i>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索应用、动态、用户、话题..."
          class="search-field"
          @keydown.enter="doSearch(searchQuery)"
          @focus="onInputFocus"
        />
        <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div v-if="searchSuggestions.length > 0 && showSuggestions" class="suggestions-dropdown custom-scrollbar">
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
    </div>

    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在全局检索内容..." />
    </div>

    <div v-else-if="queryStr && results.length === 0" class="empty-wrapper">
      <EmptyState title="未搜索到任何相关数据" description="请尝试输入其他关键字重新搜索" />
    </div>

    <div v-else-if="results.length > 0" class="search-result-list">
      <FeedCard v-for="item in results" :key="item.id" :feed="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const router = useRouter();
const queryStr = computed(() => (route.query.q as string) || '');
const loading = ref(false);
const results = ref<any[]>([]);
const searchQuery = ref('');
const searchSuggestions = ref<{ title: string }[]>([]);
const showSuggestions = ref(false);
const searchAreaRef = ref<HTMLElement | null>(null);

let suggestTimer: any = null;

function onInputFocus() {
  if (searchSuggestions.value.length > 0) {
    showSuggestions.value = true;
  }
}

function handleClickOutside(e: MouseEvent) {
  if (searchAreaRef.value && !searchAreaRef.value.contains(e.target as Node)) {
    showSuggestions.value = false;
  }
}

function clearSearch() {
  searchQuery.value = '';
  searchSuggestions.value = [];
  showSuggestions.value = false;
}

function selectSuggestion(title: string) {
  searchQuery.value = title;
  showSuggestions.value = false;
  doSearch(title);
}

function doSearch(q: string) {
  const trimmed = q.trim();
  if (!trimmed) return;
  showSuggestions.value = false;
  router.push({ path: '/search', query: { q: trimmed } });
}

async function fetchSearch() {
  if (!queryStr.value) return;
  loading.value = true;
  results.value = [];
  try {
    let res = await CoolapkTauriAPI.searchFeeds(queryStr.value, 1);
    let list = (res && res.data && Array.isArray(res.data)) ? res.data : [];

    if (list.length === 0) {
      res = await CoolapkTauriAPI.searchAll(queryStr.value, 1);
      list = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    }

    results.value = list.filter((item: any) => {
      if (!item || !item.id) return false;
      const isEntity = item.entityType === 'product' || item.entityType === 'dyh';
      const hasContent = item.message || item.description || item.title || item.pic || (item.pics && item.pics.length > 0);
      const isHeaderCard = ['数码', '用户', '话题', '应用', '游戏', '酷图'].includes(item.title) && !item.message && !isEntity;
      return hasContent && !isHeaderCard;
    });
  } catch (err) {
    console.error('Search error', err);
  } finally {
    loading.value = false;
  }
}

async function fetchSuggestions(q: string) {
  if (!q.trim()) {
    searchSuggestions.value = [];
    return;
  }
  try {
    const res = await CoolapkTauriAPI.getSearchSuggestions(q.trim());
    if (res?.data && Array.isArray(res.data)) {
      searchSuggestions.value = res.data;
      showSuggestions.value = true;
    }
  } catch (err) {
    console.error('Suggestions error', err);
  }
}

watch(searchQuery, (val) => {
  if (suggestTimer) clearTimeout(suggestTimer);
  if (!val.trim()) {
    searchSuggestions.value = [];
    showSuggestions.value = false;
    return;
  }
  suggestTimer = setTimeout(() => fetchSuggestions(val), 300);
});

watch(queryStr, () => {
  searchQuery.value = queryStr.value;
  fetchSearch();
});

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  if (queryStr.value) {
    searchQuery.value = queryStr.value;
    fetchSearch();
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-4);
}

.page-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.search-input-area {
  position: relative;
  margin-bottom: var(--space-5);
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  height: 44px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  transition: border-color var(--duration-fast) var(--ease-default);
}

.search-input-wrapper:focus-within {
  border-color: var(--brand-primary);
}

.search-input-icon {
  font-size: 15px;
  color: var(--text-tertiary);
}

.search-field {
  flex: 1;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
}

.search-field::placeholder {
  color: var(--text-tertiary);
}

.clear-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-tertiary);
  transition: all var(--duration-fast) var(--ease-default);
}

.clear-btn:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.suggestions-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 260px;
  overflow-y: auto;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  box-shadow: var(--shadow-dialog);
  z-index: 100;
  padding: var(--space-1);
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
