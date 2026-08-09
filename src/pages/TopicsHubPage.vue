<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <!-- 头部区域 -->
    <div class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title">
            <i class="fas fa-hashtag icon"></i> 话题广场
          </h2>
          <span class="page-subtitle">探索酷安各类热议话题、数码体验与酷友交流圈</span>
        </div>

        <!-- 话题搜索与刷新 -->
        <div class="header-actions">
          <div class="search-box">
            <i class="fas fa-search search-icon"></i>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索话题..."
              class="search-input"
              @keyup.enter="handleSearch"
            />
            <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <button class="btn-refresh" @click="refreshCurrent" :disabled="loading" title="刷新数据">
            <i class="fas fa-sync-alt refresh-icon" :class="{ spinning: loading }"></i>
          </button>
        </div>
      </div>

      <!-- 分类快捷标签栏 -->
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.url"
          :class="['cat-tab', { active: activeCategoryUrl === cat.url && !searchQuery.trim() }]"
          @click="switchCategory(cat)"
        >
          <i :class="cat.icon"></i> {{ cat.title }}
        </button>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading && page === 1" class="loading-wrapper">
      <LoadingState :text="searchMode ? '正在搜索话题...' : '正在加载话题列表...'" />
    </div>

    <!-- 空数据状态 -->
    <div v-else-if="filteredTopics.length === 0" class="empty-wrapper">
      <EmptyState
        :title="searchMode ? '未找到相关话题' : '暂无相关话题'"
        :description="searchMode ? '未找到相关话题，可尝试更换关键词重新搜索' : '未能找到相关话题，可尝试切换上方分类标签或重新搜索'"
      />
    </div>

    <!-- 话题网格展示 -->
    <div v-else class="topics-grid">
      <TopicCard
        v-for="(topic, idx) in filteredTopics"
        :key="topic.id || topic.tag || topic.title || idx"
        :topic="topic"
      />
    </div>

    <!-- 底部加载状态 -->
    <div class="pagination-footer" v-if="filteredTopics.length > 0">
      <div v-if="loading && page > 1" class="loading-more-footer">
        <i class="fas fa-circle-notch fa-spin"></i> 加载更多话题...
      </div>
      <div v-else-if="noMore" class="no-more-footer">已加载完毕所有话题</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import TopicCard from '../components/topic/TopicCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

interface CategoryItem {
  title: string;
  icon: string;
  url: string;
}

const categories = ref<CategoryItem[]>([
  { title: '热门话题', icon: 'fas fa-fire', url: '/v6/topic/tagList?sort=hot' },
  { title: '最受关注', icon: 'fas fa-star', url: '/v6/topic/tagList?sort=follow' },
  { title: '最新话题', icon: 'fas fa-clock', url: '/v6/topic/tagList?sort=new' },
  { title: '手机数码', icon: 'fas fa-mobile-alt', url: '/v6/topic/tagList?tagType=1' },
  { title: '电脑外设', icon: 'fas fa-laptop', url: '/v6/topic/tagList?tagType=2' },
  { title: '游戏生活', icon: 'fas fa-gamepad', url: '/v6/topic/tagList?tagType=3' },
]);

const activeCategoryUrl = ref<string>('/v6/topic/tagList?sort=hot');
const rawTopicItems = ref<any[]>([]);
const searchQuery = ref('');
const searchMode = ref(false);
const loading = ref(false);
const page = ref(1);
const noMore = ref(false);

const filteredTopics = computed(() => {
  if (searchMode.value || !searchQuery.value.trim()) {
    return rawTopicItems.value;
  }
  const q = searchQuery.value.trim().toLowerCase();
  return rawTopicItems.value.filter((item) => {
    const title = (item.title || item.tag || item.title_format || '').toLowerCase();
    const desc = (item.description || item.sub_title || '').toLowerCase();
    return title.includes(q) || desc.includes(q);
  });
});

async function fetchTopicData(url: string = '/v6/topic/tagList?sort=hot', isLoadMore = false) {
  if (loading.value) return;
  loading.value = true;

  try {
    const currentPage = isLoadMore ? page.value : 1;
    let extractedTopics: any[];

    if (searchMode.value && searchQuery.value.trim()) {
      extractedTopics = await fetchSearchTopics(searchQuery.value.trim(), currentPage);
    } else {
      const res = await CoolapkTauriAPI.getTopicHubData(url, currentPage);
      const dataList = (res && res.data && Array.isArray(res.data)) ? res.data : [];
      extractedTopics = [];

      dataList.forEach((item: any) => {
        if (item.entityType === 'card' && Array.isArray(item.entities)) {
          item.entities.forEach((sub: any) => {
            if (isTopicEntity(sub)) {
              extractedTopics.push(sub);
            }
          });
        } else if (isTopicEntity(item)) {
          extractedTopics.push(item);
        }
      });
    }

    if (extractedTopics.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        rawTopicItems.value.push(...extractedTopics);
      } else {
        rawTopicItems.value = extractedTopics;
      }
      page.value = currentPage + 1;
    }
  } catch (err) {
    console.warn('获取话题数据失败:', err);
  } finally {
    loading.value = false;
  }
}

function isTopicEntity(item: any): boolean {
  if (!item) return false;
  const type = item.entityType || '';
  if (type === 'topic' || type === 'tag') return true;
  if (item.title && (item.logo || item.pic || item.cover || item.follower_num || item.follownum || item.commentnum || item.hot_num)) {
    return true;
  }
  return false;
}

function extractItems(res: any): any[] {
  if (!res) return [];
  const raw = Array.isArray(res)
    ? res
    : Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.rows)
        ? res.data.rows
        : Array.isArray(res.rows)
          ? res.rows
          : [];
  const out: any[] = [];
  raw.forEach((item: any) => {
    if (item && item.entityType === 'card' && Array.isArray(item.entities)) {
      out.push(...item.entities);
    } else if (item) {
      out.push(item);
    }
  });
  return out;
}

function isTagEntity(item: any): boolean {
  if (!item) return false;
  const type = item.entityType || '';
  if (type === 'topic' || type === 'tag') return true;
  return !!item.tag && !item.message;
}

function topicKey(item: any): string {
  const raw = item?.tag || item?.title || item?.title_format || item?.entityTemplate || '';
  return String(raw).replace(/^#|#$/g, '').trim().toLowerCase();
}

async function fetchSearchTopics(query: string, currentPage: number): Promise<any[]> {
  const [tagsRes, feedTopicsRes] = await Promise.all([
    CoolapkTauriAPI.searchTags(query, currentPage).catch(() => null),
    CoolapkTauriAPI.searchFeedTopics(query, currentPage).catch(() => null),
  ]);
  const merged: any[] = [];
  const seen = new Set<string>();
  [...extractItems(tagsRes).filter(isTagEntity), ...extractItems(feedTopicsRes).filter(isTopicEntity)]
    .forEach((item: any) => {
      const key = topicKey(item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });
  return merged;
}

function switchCategory(cat: CategoryItem) {
  activeCategoryUrl.value = cat.url;
  searchQuery.value = '';
  searchMode.value = false;
  page.value = 1;
  noMore.value = false;
  rawTopicItems.value = [];
  fetchTopicData(cat.url, false);
}

function refreshCurrent() {
  page.value = 1;
  noMore.value = false;
  rawTopicItems.value = [];
  fetchTopicData(activeCategoryUrl.value, false);
}

function handleSearch() {
  const query = searchQuery.value.trim().replace(/^#|#$/g, '');
  if (!query) return;
  searchMode.value = true;
  page.value = 1;
  noMore.value = false;
  rawTopicItems.value = [];
  fetchTopicData(activeCategoryUrl.value, false);
}

function clearSearch() {
  if (!searchQuery.value.trim()) return;
  searchQuery.value = '';
  if (!searchMode.value) return;
  searchMode.value = false;
  page.value = 1;
  noMore.value = false;
  rawTopicItems.value = [];
  fetchTopicData(activeCategoryUrl.value, false);
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    if (!loading.value && !noMore.value) {
      fetchTopicData(activeCategoryUrl.value, true);
    }
  }
}

onMounted(() => {
  fetchTopicData(activeCategoryUrl.value, false);
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0;
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title .icon {
  color: var(--brand-primary);
}

.page-subtitle {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 260px;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 32px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  outline: none;
  transition: all var(--duration-fast);
}

.search-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.clear-btn {
  position: absolute;
  right: 10px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
}

.clear-btn:hover {
  color: var(--text-primary);
}

.btn-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.btn-refresh:hover:not(:disabled) {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  background-color: var(--surface-hover);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.category-tabs {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.cat-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cat-tab:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.cat-tab.active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

.loading-wrapper,
.empty-wrapper {
  padding: var(--space-10) 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.topics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-4, 16px);
}

.pagination-footer {
  padding: var(--space-6, 24px) 0;
  text-align: center;
}

.no-more {
  font-size: var(--font-size-xs, 12px);
  color: var(--text-secondary);
}
</style>
