<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
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
          @mousedown.prevent="selectSuggestion(item)"
        >
          <i class="fas fa-search suggestion-icon"></i>
          <span class="suggestion-text">{{ item.title || item.searchValue }}</span>
        </div>
      </div>
    </div>

    <div v-if="queryStr" class="search-tabs custom-scrollbar">
      <button
        v-for="tab in resultTabs"
        :key="tab.key"
        :class="['search-tab-item', { active: activeTab === tab.key }]"
        @click="switchTab(tab.key)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="activeTab === tab.key" class="tab-line"></span>
      </button>
    </div>

    <template v-if="activeTab === 'all'">
      <div v-if="loading" class="loading-wrapper">
        <LoadingState text="正在全局检索内容..." />
      </div>

      <div v-else-if="queryStr && results.length === 0" class="empty-wrapper">
        <EmptyState title="未搜索到任何相关数据" description="请尝试输入其他关键字重新搜索" />
      </div>

      <div v-else-if="results.length > 0" class="search-result-list">
        <FeedCard v-for="item in results" :key="item.id" :feed="item" @deleted="handleFeedDeleted" />
      </div>
    </template>

    <template v-else-if="activeTab === 'users'">
      <div v-if="usersLoading && usersPage === 1" class="loading-wrapper">
        <LoadingState text="正在搜索用户..." />
      </div>

      <div v-else-if="users.length === 0" class="empty-wrapper">
        <EmptyState title="未找到相关用户" description="请尝试输入其他关键字重新搜索" />
      </div>

      <div v-else class="search-user-list">
        <div
          v-for="user in users"
          :key="user.uid"
          class="search-user-item"
          @click="openUser(user)"
        >
          <AppAvatar :src="user.avatar" size="md" :alt="user.username" />
          <div class="user-info">
            <div class="user-info-top">
              <span class="user-name">{{ user.username }}</span>
              <span v-if="user.verifyTitle" class="user-verify">{{ user.verifyTitle }}</span>
            </div>
            <span class="user-bio">{{ user.bio || '暂无个性签名' }}</span>
            <span class="user-fans">{{ formatNumber(user.fans) }} 粉丝</span>
          </div>
          <AppButton variant="soft" size="sm" @click.stop="toggleFollow(user)">
            {{ isUserFollowed(user) ? '已关注' : '关注' }}
          </AppButton>
        </div>

        <div class="pagination-footer">
          <LoadingState v-if="usersLoading && usersPage > 1" text="加载更多用户中..." />
          <div v-else-if="usersNoMore" class="no-more">没有更多用户了</div>
        </div>
      </div>
    </template>

    <template v-else>
      <div v-if="topicsLoading && topicsPage === 1" class="loading-wrapper">
        <LoadingState text="正在搜索话题..." />
      </div>

      <div v-else-if="topics.length === 0" class="empty-wrapper">
        <EmptyState title="未找到相关话题" description="请尝试输入其他关键字重新搜索" />
      </div>

      <div v-else class="search-topic-list">
        <div
          v-for="topic in topics"
          :key="topic.tag || topic.title"
          class="search-topic-item"
          @click="openTopic(topic)"
        >
          <i class="fas fa-hashtag topic-icon"></i>
          <div class="topic-info">
            <span class="topic-tag">#{{ topic.tag || topic.title }}</span>
            <span class="topic-commentnum">{{ formatNumber(topic.commentnum) }} 讨论</span>
          </div>
          <i class="fas fa-chevron-right topic-arrow"></i>
        </div>

        <div class="pagination-footer">
          <LoadingState v-if="topicsLoading && topicsPage > 1" text="加载更多话题中..." />
          <div v-else-if="topicsNoMore" class="no-more">没有更多话题了</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import AppAvatar from '../components/common/AppAvatar.vue';
import AppButton from '../components/common/AppButton.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
// 每个查询地址拥有独立缓存实例，固定本实例的查询词。
const queryStr = ref((route.query.q as string) || '');
const loading = ref(false);
const results = ref<any[]>([]);

function handleFeedDeleted(id: string | number) {
  results.value = results.value.filter((f: any) => String(f.id) !== String(id));
}
const searchQuery = ref('');
const searchSuggestions = ref<any[]>([]);
const showSuggestions = ref(false);
const searchAreaRef = ref<HTMLElement | null>(null);

const activeTab = ref<'all' | 'users' | 'topics'>('all');
const resultTabs: { key: 'all' | 'users' | 'topics'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'users', label: '用户' },
  { key: 'topics', label: '话题' },
];

const users = ref<any[]>([]);
const usersLoading = ref(false);
const usersPage = ref(1);
const usersNoMore = ref(false);

const topics = ref<any[]>([]);
const topicsLoading = ref(false);
const topicsPage = ref(1);
const topicsNoMore = ref(false);

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

function selectSuggestion(item: any) {
  const title = item.searchValue || item.title || '';
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

function switchTab(key: 'all' | 'users' | 'topics') {
  if (activeTab.value === key) return;
  activeTab.value = key;
  if (key === 'users' && users.value.length === 0) {
    fetchUsers(false);
  } else if (key === 'topics' && topics.value.length === 0) {
    fetchTopics(false);
  }
}

function formatNumber(num: number | string) {
  const n = Number(num);
  if (isNaN(n)) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function openUser(user: any) {
  if (user.uid) {
    router.push(`/user/${user.uid}`);
  }
}

function openTopic(topic: any) {
  const tag = topic.tag || topic.title;
  if (tag) {
    router.push(`/topic/${tag}`);
  }
}

function isUserFollowed(user: any): boolean {
  const f = user.follow;
  const g = user.following;
  if (typeof f === 'boolean') return f;
  if (typeof f === 'number') return f === 1;
  if (typeof f === 'string') return f === '1' || f === 'true';
  if (typeof g === 'boolean') return g;
  return false;
}

async function toggleFollow(user: any) {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const followed = isUserFollowed(user);
  try {
    if (followed) {
      await CoolapkTauriAPI.unfollowUser(String(user.uid));
    } else {
      await CoolapkTauriAPI.followUser(String(user.uid));
    }
    user.follow = !followed;
    if (user.following !== undefined) user.following = !followed;
  } catch (err) {
    console.error('关注操作失败', err);
  }
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

async function fetchUsers(isLoadMore = false) {
  if (!queryStr.value || usersLoading.value || usersNoMore.value) return;
  usersLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.searchUsers(queryStr.value, usersPage.value);
    const list = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (list.length === 0) {
      usersNoMore.value = true;
    } else {
      if (isLoadMore) {
        users.value.push(...list);
      } else {
        users.value = list;
      }
      usersPage.value++;
    }
  } catch (err) {
    console.error('Search users error', err);
  } finally {
    usersLoading.value = false;
  }
}

async function fetchTopics(isLoadMore = false) {
  if (!queryStr.value || topicsLoading.value || topicsNoMore.value) return;
  topicsLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.searchFeedTopics(queryStr.value, topicsPage.value);
    const list = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (list.length === 0) {
      topicsNoMore.value = true;
    } else {
      if (isLoadMore) {
        topics.value.push(...list);
      } else {
        topics.value = list;
      }
      topicsPage.value++;
    }
  } catch (err) {
    console.error('Search topics error', err);
  } finally {
    topicsLoading.value = false;
  }
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    if (activeTab.value === 'users') {
      fetchUsers(true);
    } else if (activeTab.value === 'topics') {
      fetchTopics(true);
    }
  }
}

function extractSuggestions(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (res.data && Array.isArray(res.data)) return res.data;
  return [];
}

async function fetchSuggestions(q: string) {
  if (!q.trim()) {
    searchSuggestions.value = [];
    return;
  }
  try {
    let res = await CoolapkTauriAPI.getSearchSuggestionsApp(q.trim());
    let list = extractSuggestions(res);
    if (list.length === 0) {
      res = await CoolapkTauriAPI.getSearchSuggestions(q.trim());
      list = extractSuggestions(res);
    }
    searchSuggestions.value = list.filter((item: any) => item && (item.title || item.searchValue));
    showSuggestions.value = searchSuggestions.value.length > 0;
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
  activeTab.value = 'all';
  users.value = [];
  usersPage.value = 1;
  usersNoMore.value = false;
  topics.value = [];
  topicsPage.value = 1;
  topicsNoMore.value = false;
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
  margin-bottom: var(--space-4);
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

.search-tabs {
  display: flex;
  gap: var(--space-5);
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  overflow-x: auto;
  margin-bottom: var(--space-4);
}

.search-tab-item {
  position: relative;
  border: none;
  background: transparent;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 2px;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-default);
}

.search-tab-item.active {
  color: var(--brand-primary);
  font-weight: var(--font-weight-bold);
}

.tab-line {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  background: var(--brand-primary);
  border-radius: 2px;
}

.loading-wrapper, .empty-wrapper {
  padding: var(--space-6) 0;
}

.search-result-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.search-user-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.search-user-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.search-user-item:hover {
  border-color: var(--brand-primary);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  min-width: 0;
}

.user-info-top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  overflow: hidden;
}

.user-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-verify {
  flex-shrink: 0;
  font-size: var(--font-size-caption);
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  border-radius: var(--radius-pill);
  padding: 1px 8px;
}

.user-bio {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-fans {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.search-topic-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.search-topic-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.search-topic-item:hover {
  border-color: var(--brand-primary);
}

.topic-icon {
  font-size: 14px;
  color: var(--brand-primary);
}

.topic-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  overflow: hidden;
  min-width: 0;
}

.topic-tag {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-commentnum {
  flex-shrink: 0;
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.topic-arrow {
  font-size: 12px;
  color: var(--text-tertiary);
}

.pagination-footer {
  padding: var(--space-4) 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}
</style>
