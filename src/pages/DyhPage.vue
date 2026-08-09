<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="top-nav-bar">
      <button class="btn-back" @click="goBack" title="返回上一页">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div class="nav-title-box">
        <span class="nav-title">{{ dyhTitle }}</span>
      </div>
      <div class="nav-right-actions">
        <i class="fas fa-search action-btn" @click="focusSearch" title="搜索看看号动态"></i>
      </div>
    </div>

    <div v-if="headerLoading" class="dyh-header-card skeleton-header">
      <LoadingState text="正在加载看看号信息..." />
    </div>

    <div v-else-if="headerError" class="dyh-header-card skeleton-header">
      <ErrorState title="加载失败" message="无法获取看看号信息" @retry="fetchDyhHeader" />
    </div>

    <div v-else-if="dyhDetail" class="dyh-header-card">
      <div class="header-content">
        <div class="dyh-avatar-wrapper">
          <AppImage
            v-if="dyhAvatar"
            :src="dyhAvatar"
            class="dyh-avatar"
            fit="cover"
            :alt="dyhTitle"
          />
          <div v-else class="dyh-avatar-fallback">
            <i class="fas fa-building-columns"></i>
          </div>
        </div>

        <div class="dyh-info">
          <h2 class="dyh-title">{{ dyhTitle }}</h2>
          <div v-if="dyhDescription" class="dyh-desc-text">
            {{ dyhDescription }}
          </div>
          <div class="dyh-stats">
            <span v-if="dyhDetail.follownum">{{ formatCount(dyhDetail.follownum) }} 关注</span>
            <span v-if="dyhDetail.likenum">{{ formatCount(dyhDetail.likenum) }} 获赞</span>
          </div>
        </div>

        <div class="dyh-actions">
          <button
            :class="['btn-follow-dyh', isFollowing ? 'btn-following' : 'btn-follow-primary']"
            :disabled="followLoading"
            @click="toggleFollow"
          >
            <i :class="isFollowing ? 'fas fa-check' : 'fas fa-plus'"></i>
            {{ isFollowing ? '已关注' : '关注' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="dyh-header-card skeleton-header">
      <EmptyState title="未找到该看看号" description="该看看号可能已被删除或ID不正确" />
    </div>

    <div class="dyh-sub-tabs custom-scrollbar">
      <button
        v-for="tab in feedTabs"
        :key="tab.key"
        :class="['dyh-tab-item', { active: activeFeedTab === tab.key }]"
        @click="selectFeedTab(tab.key)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="activeFeedTab === tab.key" class="tab-line"></span>
      </button>
    </div>

    <div v-if="feedsLoading && page === 1" class="loading-wrapper">
      <LoadingState text="正在获取看看号动态..." />
    </div>

    <div v-else-if="feedsError && dyhFeeds.length === 0" class="error-wrapper">
      <ErrorState title="动态加载失败" message="无法获取看看号动态，请检查网络后重试" @retry="retryFeeds" />
    </div>

    <div v-else-if="dyhFeeds.length === 0 && !feedsLoading" class="empty-wrapper">
      <EmptyState title="暂无相关动态" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in dyhFeeds" :key="item.id || item.ttype + item.uid" :feed="item" @deleted="handleFeedDeleted" />

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
import { navigateBack } from '../utils/navigation';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
// 固定当前缓存页面的参数，避免隐藏后跟随全局路由变化重新加载。
const dyhId = ref(route.params.dyhId as string);

const dyhDetail = ref<any>(null);
const headerLoading = ref(false);
const headerError = ref(false);
const isFollowing = ref(false);
const followLoading = ref(false);

const dyhFeeds = ref<any[]>([]);

function handleFeedDeleted(id: string | number) {
  dyhFeeds.value = dyhFeeds.value.filter((f: any) => String(f.id) !== String(id));
}
const feedsLoading = ref(false);
const feedsError = ref(false);
const page = ref(1);
const noMore = ref(false);

const activeFeedTab = ref('all');
const feedTabs = [
  { key: 'all', label: '精选' },
  { key: 'square', label: '广场' },
];

const dyhAvatar = computed(() => {
  if (!dyhDetail.value) return '';
  return dyhDetail.value.dyhAvatar
    || dyhDetail.value.avatar
    || dyhDetail.value.userAvatar
    || dyhDetail.value.logo
    || dyhDetail.value.pic
    || '';
});

const dyhTitle = computed(() => {
  if (!dyhDetail.value) return dyhId.value;
  return dyhDetail.value.dyhName
    || dyhDetail.value.dyhTitle
    || dyhDetail.value.name
    || dyhDetail.value.title
    || dyhId.value;
});

const dyhDescription = computed(() => {
  if (!dyhDetail.value) return '';
  return dyhDetail.value.description || dyhDetail.value.dyhDescription || '';
});

function goBack() {
  navigateBack(router, '/discover');
}

async function fetchDyhHeader() {
  if (!dyhId.value) return;
  headerLoading.value = true;
  headerError.value = false;
  dyhDetail.value = null;
  try {
    const res = await CoolapkTauriAPI.getDyhDetail(dyhId.value);
    if (res?.data && typeof res.data === 'object') {
      dyhDetail.value = res.data;
      isFollowing.value = !!(res.data.isFollow ?? res.data.isFollowed ?? res.data.followed ?? res.data.is_follow ?? res.data.follow);
    } else {
      headerError.value = true;
    }
  } catch (err) {
    headerError.value = true;
    console.warn('获取看看号详情失败', err);
  } finally {
    headerLoading.value = false;
  }
}

async function toggleFollow() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (!dyhDetail.value || followLoading.value) return;
  const target = !isFollowing.value;
  const prevFollowing = isFollowing.value;
  const prevFollowNum = Number(dyhDetail.value.follownum) || 0;
  isFollowing.value = target;
  followLoading.value = true;
  dyhDetail.value.follownum = Math.max(0, prevFollowNum + (target ? 1 : -1));
  try {
    if (target) {
      await CoolapkTauriAPI.followDyh(dyhId.value);
    } else {
      await CoolapkTauriAPI.unfollowDyh(dyhId.value);
    }
  } catch (err) {
    isFollowing.value = prevFollowing;
    dyhDetail.value.follownum = prevFollowNum;
    console.warn(target ? '关注看看号失败' : '取消关注看看号失败', err);
  } finally {
    followLoading.value = false;
  }
}

async function fetchFeeds(isLoadMore = false) {
  if (!dyhId.value || feedsLoading.value || noMore.value) return;

  feedsLoading.value = true;
  if (!isLoadMore) feedsError.value = false;
  try {
    const res = await CoolapkTauriAPI.getDyhFeeds(dyhId.value, activeFeedTab.value, page.value);
    const newFeeds = (res && res.data && Array.isArray(res.data)) ? res.data : [];

    if (newFeeds.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        dyhFeeds.value.push(...newFeeds);
      } else {
        dyhFeeds.value = newFeeds;
      }
      page.value++;
    }
  } catch (err) {
    feedsError.value = true;
    console.warn('获取看看号动态失败', err);
  } finally {
    feedsLoading.value = false;
  }
}

function selectFeedTab(key: string) {
  activeFeedTab.value = key;
  page.value = 1;
  noMore.value = false;
  feedsError.value = false;
  dyhFeeds.value = [];
  void fetchFeeds(false);
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    if (!feedsLoading.value && !noMore.value) {
      fetchFeeds(true);
    }
  }
}

function focusSearch() {
  router.push({ path: '/search', query: { q: dyhTitle.value } });
}

function retryFeeds() {
  noMore.value = false;
  feedsError.value = false;
  void fetchFeeds(page.value > 1);
}

function formatCount(value: number | string) {
  const count = Number(value);
  if (!Number.isFinite(count)) return '0';
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function resetFeeds() {
  page.value = 1;
  noMore.value = false;
  feedsError.value = false;
  dyhFeeds.value = [];
}

watch(dyhId, () => {
  resetFeeds();
  void fetchDyhHeader();
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

.btn-back {
  border: none;
  background: transparent;
  font-size: 18px;
  color: var(--text-primary);
  cursor: pointer;
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

.dyh-header-card {
  background-color: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.dyh-avatar-wrapper {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background-color: var(--background);
}

.dyh-avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.25));
  font-size: 26px;
  color: #8b5cf6;
}

.dyh-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dyh-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.btn-follow-dyh {
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

.btn-following:hover {
  color: var(--text-primary);
}

.btn-follow-dyh:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.dyh-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.dyh-desc-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dyh-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.dyh-sub-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  overflow-x: auto;
}

.dyh-tab-item {
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 2px;
  white-space: nowrap;
}

.dyh-tab-item.active {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.tab-line {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  background: var(--brand-primary, #10b981);
  border-radius: 2px;
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
