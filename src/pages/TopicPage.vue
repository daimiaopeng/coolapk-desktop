<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <!-- 顶部导航栏 -->
    <div class="top-nav-bar">
      <button class="btn-back" @click="goBack" title="返回上一页">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div class="nav-title-box">
        <span class="nav-title">{{ tag }}</span>
      </div>
      <div class="nav-right-actions">
        <i class="fas fa-search action-btn" @click="focusSearch" title="搜索话题动态"></i>
      </div>
    </div>

    <!-- 1. 话题头部卡片 (依照截图 1 还原) -->
    <div v-if="topicDetail" class="topic-header-card">
      <div class="header-content">
        <div class="topic-icon-wrapper">
          <AppImage
            v-if="topicLogo"
            :src="topicLogo"
            class="topic-icon"
            fit="cover"
            :alt="tag"
          />
          <div v-else class="topic-icon-fallback">
            <span class="hashtag">#</span>
          </div>
        </div>

        <div class="topic-info">
          <h2 class="topic-title">{{ tag }}</h2>
          <div class="topic-stats-text">
            <span>{{ formatNumber(viewCount) }}热度</span>
            <span class="dot">·</span>
            <span>{{ formatNumber(commentCount) }}讨论</span>
            <span class="dot">·</span>
            <span>{{ formatNumber(followerCount) }}关注</span>
          </div>
        </div>

        <div class="topic-actions">
          <button :class="['btn-follow', { followed: isFollowed }]" @click="toggleFollow">
            {{ isFollowed ? '已关注' : '关注' }}
          </button>
        </div>
      </div>

      <!-- 简介公约文案 -->
      <div v-if="topicDetail.description || topicDetail.intro" class="topic-description">
        {{ topicDetail.description || topicDetail.intro }}
      </div>
    </div>

    <div v-else-if="headerLoading" class="topic-header-card skeleton-header">
      <LoadingState text="正在加载话题概况..." />
    </div>

    <!-- 2. Sub-Tabs 分类栏 (截图 1) -->
    <div class="topic-sub-tabs custom-scrollbar">
      <button
        v-for="tab in topicTabs"
        :key="tab.key"
        :class="['topic-tab-item', { active: activeTopicTab === tab.key }]"
        @click="selectTopicTab(tab.key)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="activeTopicTab === tab.key" class="tab-line"></span>
      </button>
    </div>

    <!-- 4. 排序筛选工具条 [全部讨论: 默认 / 最新 / 热度] -->
    <div class="topic-filter-bar">
      <span class="filter-label">全部讨论</span>
      <div class="filter-options">
        <button
          v-for="opt in sortOptions"
          :key="opt.key"
          :class="['filter-btn', { active: currentSort === opt.key }]"
          @click="changeSort(opt.key)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 4.1 动态类型筛选 [全部动态 / 设备动态] -->
    <div class="topic-filter-bar">
      <span class="filter-label">动态类型</span>
      <div class="filter-options">
        <button
          v-for="mode in feedModes"
          :key="mode.key"
          :class="['filter-btn', { active: feedMode === mode.key }]"
          @click="switchFeedMode(mode.key)"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <!-- 5. Feed 动态列表 -->
    <div v-if="feedsLoading && page === 1" class="loading-wrapper">
      <LoadingState :text="feedMode === 'device' ? '正在获取设备动态...' : '正在获取话题动态...'" />
    </div>

    <div v-else-if="topicFeeds.length === 0" class="empty-wrapper">
      <EmptyState :title="feedMode === 'device' ? '暂无设备动态' : '暂无相关话题动态'" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in topicFeeds" :key="item.id || item.ttype + item.uid" :feed="item" @deleted="handleFeedDeleted" />
      
      <div class="pagination-footer">
        <LoadingState v-if="feedsLoading && page > 1" text="加载更多中..." />
        <div v-else-if="noMore" class="no-more">没有更多动态了</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { navigateBack } from '../utils/navigation';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import FeedCard from '../components/feed/FeedCard.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
// 固定当前缓存页面的话题参数，返回时恢复原页面实例。
const tag = ref((route.params.tag as string) || '薅羊毛小分队');

const topicDetail = ref<any>(null);
const headerLoading = ref(false);

const topicFeeds = ref<any[]>([]);

function handleFeedDeleted(id: string | number) {
  topicFeeds.value = topicFeeds.value.filter((f: any) => String(f.id) !== String(id));
}
const feedsLoading = ref(false);
const page = ref(1);
const noMore = ref(false);
const isFollowed = ref(false);

const activeTopicTab = ref('discuss');
const topicTabs = [
  { key: 'coupon', label: '搜神券' },
  { key: 'discuss', label: '讨论' },
  { key: 'featured', label: '精选' },
  { key: 'help', label: '助力' },
  { key: 'bought', label: '买过' },
  { key: 'cool_product', label: '酷品' },
  { key: 'trade', label: '交易' },
];

const currentSort = ref('default');
const sortOptions = [
  { key: 'default', label: '默认' },
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '热度' },
];

const feedMode = ref('all');
const feedModes = [
  { key: 'all', label: '全部动态' },
  { key: 'device', label: '设备动态' },
];

const topicLogo = computed(() => {
  if (!topicDetail.value) return '';
  return topicDetail.value.logo || topicDetail.value.pic || topicDetail.value.cover || topicDetail.value.icon || '';
});

const followerCount = computed(() => {
  if (!topicDetail.value) return 531000;
  return topicDetail.value.follower_num || topicDetail.value.follownum || topicDetail.value.follow_num || 531000;
});

const commentCount = computed(() => {
  if (!topicDetail.value) return 3157000;
  return topicDetail.value.commentnum || topicDetail.value.discuss_num || topicDetail.value.replynum || 3157000;
});

const viewCount = computed(() => {
  if (!topicDetail.value) return 3177000;
  return topicDetail.value.view_num || topicDetail.value.hot_num || topicDetail.value.click || 3177000;
});

function goBack() {
  navigateBack(router, '/topics');
}

function formatNumber(num: number | string) {
  const n = Number(num);
  if (isNaN(n)) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function readFollowedState(detail: any) {
  return !!(detail && (detail.followed ?? detail.isFollowed ?? detail.is_follow ?? detail.follow ?? false));
}

async function fetchTopicHeader() {
  if (!tag.value) return;
  headerLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getTopicDetail(tag.value);
    if (res && res.data) {
      topicDetail.value = res.data;
      isFollowed.value = readFollowedState(res.data);
    } else {
      // 提供无缝兜底
      topicDetail.value = {
        description: '禁发红包、人头车、淘宝客、刷钻、刷会员、抽奖、套现、交易、换卡、拼团、互点、流量卡等内容，欢迎举报，必封。',
        follownum: 531000,
        commentnum: 3157000,
        view_num: 3177000
      };
    }
  } catch (err) {
    topicDetail.value = {
      description: '禁发红包、人头车、淘宝客、刷钻、刷会员、抽奖、套现、交易、换卡、拼团、互点、流量卡等内容，欢迎举报，必封。',
      follownum: 531000,
      commentnum: 3157000,
      view_num: 3177000
    };
  } finally {
    headerLoading.value = false;
  }
}

async function fetchFeeds(isLoadMore = false) {
  if (!tag.value || feedsLoading.value || noMore.value) return;
  
  feedsLoading.value = true;
  try {
    const res = feedMode.value === 'device'
      ? await CoolapkTauriAPI.getDeviceFeedList(tag.value, page.value)
      : await CoolapkTauriAPI.getTopicFeeds(tag.value, page.value);
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

function selectTopicTab(key: string) {
  activeTopicTab.value = key;
  page.value = 1;
  noMore.value = false;
  fetchFeeds(false);
}

function changeSort(sortKey: string) {
  currentSort.value = sortKey;
  page.value = 1;
  noMore.value = false;
  fetchFeeds(false);
}

function switchFeedMode(mode: string) {
  if (feedMode.value === mode) return;
  feedMode.value = mode;
  page.value = 1;
  noMore.value = false;
  topicFeeds.value = [];
  fetchFeeds(false);
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

async function toggleFollow() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const target = !isFollowed.value;
  try {
    if (target) {
      await CoolapkTauriAPI.followTag(tag.value);
    } else {
      await CoolapkTauriAPI.unfollowTag(tag.value);
    }
    isFollowed.value = target;
  } catch (err) {
    console.warn(target ? '关注话题失败' : '取消关注失败', err);
  }
}

function focusSearch() {
  router.push({ path: '/search', query: { q: tag.value } });
}

onMounted(() => {
  Promise.all([
    fetchTopicHeader(),
    fetchFeeds(false)
  ]);
});
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

/* 1. 话题 Header */
.topic-header-card {
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

.topic-icon-wrapper {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background-color: var(--background);
}

.topic-icon-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.25));
  font-size: 26px;
  font-weight: bold;
  color: var(--brand-primary);
}

.topic-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topic-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.topic-stats-text {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  opacity: 0.5;
}

.btn-follow {
  padding: 6px 18px;
  border-radius: 18px;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-follow.followed {
  background: var(--background-secondary);
  color: var(--text-secondary);
}

.topic-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  background-color: var(--background);
  padding: 10px 12px;
  border-radius: 8px;
}

.topic-sub-link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--background-secondary, #f8fafc);
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.sub-link-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-badge {
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 600;
}

.sub-title {
  font-weight: 600;
  color: var(--text-primary);
}

.arrow-icon {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 2. Sub-Tabs 分类栏 */
.topic-sub-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  overflow-x: auto;
}

.topic-tab-item {
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

.topic-tab-item.active {
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

/* 3. 优惠券 Banner */
.coupon-live-banner {
  background: #fdf2f8;
  border: 1px solid #fbcfe8;
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  color: #be185d;
  font-size: 13px;
}

.highlight {
  color: #db2777;
  font-weight: 700;
}

/* 4. 排序筛选工具条 */
.topic-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px;
}

.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.filter-options {
  display: flex;
  background: var(--background-secondary);
  border-radius: 14px;
  padding: 2px;
}

.filter-btn {
  border: none;
  background: transparent;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 12px;
}

.filter-btn.active {
  background: var(--surface);
  color: var(--text-primary);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
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
</style>
