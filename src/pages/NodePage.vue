<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="top-nav-bar">
      <div class="nav-title-box">
        <span class="nav-title">{{ pageTitle }}</span>
      </div>
      <div class="nav-right-actions">
        <i class="fas fa-search action-btn" @click="focusSearch" title="搜索版块动态"></i>
      </div>
    </div>

    <!-- 节点头部 -->
    <div v-if="headerLoading" class="node-header-card skeleton-header">
      <LoadingState text="正在加载节点信息..." />
    </div>

    <div v-else-if="nodeInfo" class="node-header-card">
      <div class="header-content">
        <div class="node-icon-wrapper">
          <AppImage
            v-if="nodeLogo"
            :src="nodeLogo"
            class="node-icon"
            fit="cover"
            :alt="nodeTitle"
          />
          <div v-else class="node-icon-fallback">
            <i class="fas fa-th"></i>
          </div>
        </div>

        <div class="node-info">
          <h2 class="node-title">{{ nodeTitle }}</h2>
          <div v-if="nodeDescription" class="node-desc-text">
            {{ nodeDescription }}
          </div>
          <div v-if="nodeStatsText" class="node-stats">
            <span>{{ nodeStatsText }}</span>
          </div>
        </div>

        <div class="node-actions">
          <button
            :class="['btn-follow-node', isFollowing ? 'btn-following' : 'btn-follow-primary']"
            :disabled="followLoading"
            @click="toggleFollow"
          >
            <i :class="isFollowing ? 'fas fa-check' : 'fas fa-plus'"></i>
            {{ isFollowing ? '已关注' : '关注' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 动态列表 -->
    <div v-if="feedsLoading && page === 1" class="loading-wrapper">
      <LoadingState text="正在获取节点动态..." />
    </div>

    <div v-else-if="feedsError && feeds.length === 0" class="error-wrapper">
      <ErrorState title="动态加载失败" message="无法获取该节点的动态列表" @retry="retryFeeds" />
    </div>

    <div v-else-if="feeds.length === 0 && !feedsLoading" class="empty-wrapper">
      <EmptyState title="暂无相关动态" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in feeds" :key="item.id || item.ttype + item.uid" :feed="item" @deleted="handleFeedDeleted" />

      <div class="pagination-footer">
        <LoadingState v-if="feedsLoading && page > 1" text="加载更多中..." />
        <button v-else-if="feedsError" class="retry-inline" @click="retryFeeds">加载失败，点击重试</button>
        <div v-else-if="noMore" class="no-more">没有更多动态了</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';
import type { NodeEntity } from '../types/content';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const props = defineProps<{ nodeType?: string; nodeId?: string; title?: string }>();

function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const nodeType = ref(props.nodeType || (route.params.nodeType as string) || 'topic');
const nodeId = ref(decodeParam(props.nodeId || (route.params.nodeId as string) || ''));
const fallbackTitle = ref(props.title || (typeof route.query.title === 'string' ? route.query.title : ''));

const nodeInfo = ref<NodeEntity | null>(null);
const headerLoading = ref(false);
const headerError = ref(false);
const isFollowing = ref(false);
const followLoading = ref(false);

const feeds = ref<any[]>([]);
const feedsLoading = ref(false);
const feedsError = ref(false);
const page = ref(1);
const noMore = ref(false);

const pageTitle = computed(() => nodeTitle.value || '版块节点');

const nodeTitle = computed(() => {
  return nodeInfo.value?.title || fallbackTitle.value || nodeId.value;
});

const nodeLogo = computed(() => {
  const n = nodeInfo.value;
  if (!n) return '';
  return n.logo || n.pic || n.cover || n.icon || '';
});

const nodeDescription = computed(() => {
  const n = nodeInfo.value;
  return (n?.description || n?.subTitle || '').trim();
});

const nodeStatsText = computed(() => {
  const n = nodeInfo.value;
  if (!n) return '';
  const parts: string[] = [];
  if (n.follower_num || n.follownum) {
    parts.push(`${formatCount(n.follower_num || n.follownum)} 关注`);
  }
  if (n.commentnum || n.replynum) {
    parts.push(`${formatCount(n.commentnum || n.replynum)} 讨论`);
  }
  return parts.join(' · ');
});

function formatCount(value: number | string) {
  const count = Number(value);
  if (!Number.isFinite(count)) return '0';
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

async function fetchNodeHeader() {
  if (!nodeId.value) return;
  headerLoading.value = true;
  headerError.value = false;
  nodeInfo.value = null;
  try {
    let res: any = null;
    if (nodeType.value === 'topic') {
      res = await CoolapkTauriAPI.getTopicDetail(nodeId.value);
    } else if (nodeType.value === 'product') {
      res = await CoolapkTauriAPI.getProductDetail(nodeId.value);
    } else if (nodeType.value === 'app') {
      res = await CoolapkTauriAPI.getAppDetail(nodeId.value);
    } else if (nodeType.value === 'event') {
      res = await CoolapkTauriAPI.getEventDetail(nodeId.value);
    }
    if (res?.data && typeof res.data === 'object') {
      nodeInfo.value = res.data;
      isFollowing.value = !!(res.data.isFollow ?? res.data.isFollowed ?? res.data.followed ?? res.data.follow);
    } else {
      nodeInfo.value = { title: fallbackTitle.value || nodeId.value };
    }
  } catch (err) {
    nodeInfo.value = { title: fallbackTitle.value || nodeId.value };
    headerError.value = false;
    console.warn('获取节点信息失败（使用兜底标题）', err);
  } finally {
    headerLoading.value = false;
  }
}

async function fetchFeeds(isLoadMore = false) {
  if (!nodeId.value || feedsLoading.value || noMore.value) return;
  feedsLoading.value = true;
  if (!isLoadMore) feedsError.value = false;
  try {
    const res = await CoolapkTauriAPI.getNodeFeeds(nodeType.value, nodeId.value, page.value);
    const newFeeds = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (newFeeds.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        feeds.value.push(...newFeeds);
      } else {
        feeds.value = newFeeds;
      }
      page.value++;
    }
  } catch (err) {
    feedsError.value = true;
    console.warn('获取节点动态失败', err);
  } finally {
    feedsLoading.value = false;
  }
}

function handleFeedDeleted(id: string | number) {
  feeds.value = feeds.value.filter((f: any) => String(f.id) !== String(id));
}

function retryFeeds() {
  noMore.value = false;
  feedsError.value = false;
  void fetchFeeds(page.value > 1);
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    if (!feedsLoading.value && !noMore.value) {
      void fetchFeeds(true);
    }
  }
}

async function toggleFollow() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (followLoading.value) return;
  const target = !isFollowing.value;
  const prev = isFollowing.value;
  isFollowing.value = target;
  followLoading.value = true;
  try {
    if (nodeType.value === 'topic') {
      if (target) {
        await CoolapkTauriAPI.followTag(nodeId.value);
      } else {
        await CoolapkTauriAPI.unfollowTag(nodeId.value);
      }
    } else {
      throw new Error('该节点类型暂不支持关注');
    }
  } catch (err) {
    isFollowing.value = prev;
    console.warn('关注节点失败', err);
  } finally {
    followLoading.value = false;
  }
}

function focusSearch() {
  router.push({ path: '/search', query: { q: nodeTitle.value } });
}

function resetState() {
  page.value = 1;
  noMore.value = false;
  feedsError.value = false;
  feeds.value = [];
  nodeInfo.value = null;
}

watch(() => [route.params.nodeType, route.params.nodeId], () => {
  resetState();
  nodeType.value = (route.params.nodeType as string) || 'topic';
  nodeId.value = decodeParam((route.params.nodeId as string) || '');
  fallbackTitle.value = typeof route.query.title === 'string' ? route.query.title : '';
  void fetchNodeHeader();
  void fetchFeeds(false);
}, { immediate: true });
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width, 860px);
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.top-nav-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  margin-bottom: 2px;
}

.nav-title-box {
  flex: 1;
  text-align: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--brand-primary, #10b981);
}

.action-btn {
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
}

.node-header-card {
  background-color: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-header {
  padding: 24px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.node-icon-wrapper {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background-color: var(--background);
}

.node-icon-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--brand-soft), var(--brand-soft-hover));
  font-size: 26px;
  color: var(--brand-primary);
}

.node-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.node-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.node-desc-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.node-stats {
  color: var(--text-tertiary);
  font-size: 11px;
}

.node-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.btn-follow-node {
  height: 32px;
  padding: 0 16px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  border: none;
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-follow-primary {
  background: var(--brand-primary, #10b981);
  color: #ffffff;
}

.btn-follow-primary:hover {
  background: var(--brand-hover, #059669);
}

.btn-following {
  background: var(--background-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-follow-node:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-wrapper,
.error-wrapper,
.empty-wrapper {
  padding: var(--space-8) 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}

.retry-inline {
  border: 0;
  background: transparent;
  color: var(--brand-primary, #10b981);
  font-size: 12px;
  cursor: pointer;
}
</style>