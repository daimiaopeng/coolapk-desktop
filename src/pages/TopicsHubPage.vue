<template>
  <div class="topics-hub-page">
    <!-- 头部搜索与操作 -->
    <div class="hub-header">
      <div class="header-title">
        <h2># 话题广场</h2>
        <span class="header-subtitle">探索酷安各类热议话题、数码体验与酷友交流圈</span>
      </div>
      <div class="header-actions">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索话题..."
            @keyup.enter="handleSearch"
          />
        </div>
        <button class="btn-refresh" @click="refreshCurrent" :disabled="loading" title="刷新数据">
          <svg class="refresh-icon" :class="{ spinning: loading }" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 20 1 14 7 14"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 主内容区：两栏结构 -->
    <div class="hub-body">
      <!-- 左侧分类侧边栏 -->
      <div class="category-sidebar custom-scrollbar">
        <div class="category-list">
          <button
            v-for="cat in categories"
            :key="cat.url"
            class="category-item"
            :class="{ active: activeCategoryUrl === cat.url }"
            @click="switchCategory(cat)"
          >
            <span class="category-title">{{ cat.title }}</span>
          </button>
        </div>
      </div>

      <!-- 右侧话题网格内容区 -->
      <div class="topics-content custom-scrollbar" @scroll="handleScroll">
        <div v-if="loading && page === 1" class="loading-container">
          <LoadingState text="正在加载话题列表..." />
        </div>

        <div v-else-if="filteredTopics.length === 0" class="empty-container">
          <EmptyState title="暂无话题数据" description="未能从服务器获取到话题，请稍后刷新重试" />
        </div>

        <div v-else class="topics-grid">
          <TopicCard
            v-for="(topic, idx) in filteredTopics"
            :key="topic.id || topic.tag || topic.title || idx"
            :topic="topic"
          />
        </div>

        <!-- 底部翻页/加载状态 -->
        <div class="pagination-footer" v-if="filteredTopics.length > 0">
          <LoadingState v-if="loading && page > 1" text="加载更多话题..." />
          <div v-else-if="noMore" class="no-more">已加载完毕所有话题</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import TopicCard from '../components/topic/TopicCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

interface CategoryItem {
  title: string;
  url: string;
}

const router = useRouter();

// 对应酷安真实有效的 话题 维度分类列表
const categories = ref<CategoryItem[]>([
  { title: '🔥 热门话题', url: '/v6/topic/tagList?sort=hot' },
  { title: '⭐ 最受关注', url: '/v6/topic/tagList?sort=follow' },
  { title: '🆕 最新话题', url: '/v6/topic/tagList?sort=new' },
  { title: '📱 手机数码', url: '/v6/topic/tagList?tagType=1' },
  { title: '💻 电脑外设', url: '/v6/topic/tagList?tagType=2' },
  { title: '🎮 游戏生活', url: '/v6/topic/tagList?tagType=3' },
]);

const activeCategoryUrl = ref<string>('/v6/topic/tagList?sort=hot');

const rawTopicItems = ref<any[]>([]);
const searchQuery = ref('');
const loading = ref(false);
const page = ref(1);
const noMore = ref(false);

const filteredTopics = computed(() => {
  if (!searchQuery.value.trim()) {
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
    const res = await CoolapkTauriAPI.getTopicHubData(url, currentPage);
    const dataList = (res && res.data && Array.isArray(res.data)) ? res.data : [];

    // 解析酷安返回的话题数据
    const extractedTopics: any[] = [];

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

function switchCategory(cat: CategoryItem) {
  if (activeCategoryUrl.value === cat.url) return;
  activeCategoryUrl.value = cat.url;
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
  const name = searchQuery.value.trim().replace(/^#|#$/g, '');
  if (name) {
    router.push(`/topic/${encodeURIComponent(name)}`);
  }
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
.topics-hub-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: var(--background);
}

.hub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4, 16px) var(--space-6, 24px);
  border-bottom: 1px solid var(--border);
  background-color: var(--surface);
  flex-shrink: 0;
}

.header-title h2 {
  font-size: var(--font-size-title-md, 18px);
  font-weight: var(--font-weight-bold, 700);
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.header-subtitle {
  font-size: var(--font-size-xs, 12px);
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill, 9999px);
  padding: 6px 14px;
  transition: all 0.2s ease;
  width: 220px;
}

.search-box:focus-within {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px rgba(var(--brand-primary-rgb, 16, 185, 129), 0.15);
  width: 280px;
}

.search-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.search-box input {
  border: none;
  background: transparent;
  outline: none;
  font-size: var(--font-size-sm, 13px);
  color: var(--text-primary);
  width: 100%;
}

.btn-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-refresh:hover:not(:disabled) {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  background-color: var(--background);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.hub-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.category-sidebar {
  width: 160px;
  border-right: 1px solid var(--border);
  background-color: var(--surface);
  overflow-y: auto;
  flex-shrink: 0;
  padding: var(--space-3, 12px) var(--space-2, 8px);
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-md, 8px);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-sm, 14px);
  font-weight: var(--font-weight-medium, 500);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  position: relative;
}

.category-item:hover {
  background-color: var(--background);
  color: var(--text-primary);
}

.category-item.active {
  background-color: rgba(var(--brand-primary-rgb, 16, 185, 129), 0.1);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold, 600);
}

.category-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 4px 4px 0;
  background-color: var(--brand-primary);
}

.topics-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5, 20px);
}

.loading-container,
.empty-container {
  padding: 60px 0;
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
