<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <!-- 话题头部 -->
    <div v-if="topicDetail" class="topic-header-card">
      <div class="header-content">
        <div class="topic-icon-wrapper" v-if="topicDetail.logo || topicDetail.cover">
          <img :src="topicDetail.logo || topicDetail.cover" class="topic-icon" alt="topic icon" />
        </div>
        <div class="topic-info">
          <h2 class="topic-title"># {{ tag }} #</h2>
          <div class="topic-stats">
            <span class="stat-badge">
              <span class="stat-value">{{ formatNumber(topicDetail.follower_num || 0) }}</span>
              <span class="stat-label">关注</span>
            </span>
            <span class="stat-badge">
              <span class="stat-value">{{ formatNumber(topicDetail.commentnum || topicDetail.discuss_num || 0) }}</span>
              <span class="stat-label">讨论</span>
            </span>
            <span class="stat-badge">
              <span class="stat-value">{{ formatNumber(topicDetail.view_num || 0) }}</span>
              <span class="stat-label">阅读</span>
            </span>
          </div>
        </div>
        <div class="topic-actions">
          <button class="btn-follow" @click="toggleFollow">
            {{ isFollowed ? '已关注' : '关注话题' }}
          </button>
        </div>
      </div>
      <div v-if="topicDetail.description || topicDetail.intro" class="topic-description">
        {{ topicDetail.description || topicDetail.intro }}
      </div>
    </div>
    <div v-else-if="headerLoading" class="topic-header-card skeleton-header">
      <LoadingState text="正在加载话题信息..." />
    </div>

    <!-- Feed 列表 -->
    <div v-if="feedsLoading && page === 1" class="loading-wrapper">
      <LoadingState text="正在获取话题动态..." />
    </div>

    <div v-else-if="topicFeeds.length === 0" class="empty-wrapper">
      <EmptyState title="暂无话题动态" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in topicFeeds" :key="item.id || item.ttype + item.uid" :feed="item" />
      
      <div class="pagination-footer">
        <LoadingState v-if="feedsLoading && page > 1" text="加载更多中..." />
        <div v-else-if="noMore" class="no-more">没有更多动态了</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const tag = (route.params.tag as string) || '';

const topicDetail = ref<any>(null);
const headerLoading = ref(false);

const topicFeeds = ref<any[]>([]);
const feedsLoading = ref(false);
const page = ref(1);
const noMore = ref(false);

const isFollowed = ref(false); // 模拟关注状态

// 格式化数字，例如将 10000 转换为 1.0w
function formatNumber(num: number | string) {
  const n = Number(num);
  if (isNaN(n)) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

async function fetchTopicHeader() {
  if (!tag) return;
  headerLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getTopicDetail(tag);
    if (res && res.data) {
      topicDetail.value = res.data;
    }
  } catch (err) {
    console.warn('获取话题详情失败', err);
  } finally {
    headerLoading.value = false;
  }
}

async function fetchFeeds(isLoadMore = false) {
  if (!tag || feedsLoading.value || noMore.value) return;
  
  feedsLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getTopicFeeds(tag, page.value);
    const newFeeds = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    
    if (newFeeds.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        topicFeeds.value.push(...newFeeds);
      } else {
        topicFeeds.value = newFeeds;
      }
      page.value++;
    }
  } catch (err) {
    console.warn('获取话题动态失败', err);
  } finally {
    feedsLoading.value = false;
  }
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  // 距离底部 100px 时触发加载更多
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    if (!feedsLoading.value && !noMore.value) {
      fetchFeeds(true);
    }
  }
}

function toggleFollow() {
  isFollowed.value = !isFollowed.value;
}

onMounted(() => {
  // 同时调用话题详情和动态列表
  Promise.all([
    fetchTopicHeader(),
    fetchFeeds(false)
  ]);
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
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.topic-header-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  transition: all 0.3s ease;
}

.topic-header-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.skeleton-header {
  min-height: 120px;
  justify-content: center;
  align-items: center;
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.topic-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background-color: var(--background);
}

.topic-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.topic-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.topic-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.topic-stats {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background-color: var(--background);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
}

.stat-value {
  font-weight: var(--font-weight-semibold);
  color: var(--brand-primary);
}

.stat-label {
  color: var(--text-secondary);
}

.topic-actions {
  flex-shrink: 0;
}

.btn-follow {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-pill);
  background: var(--brand-primary);
  color: #ffffff;
  border: none;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-follow:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-follow:active {
  transform: translateY(1px);
}

.topic-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.5;
  background-color: var(--background);
  padding: var(--space-3);
  border-radius: var(--radius-md);
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.pagination-footer {
  padding: var(--space-4) 0;
  text-align: center;
  min-height: 50px;
}

.no-more {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}
</style>
