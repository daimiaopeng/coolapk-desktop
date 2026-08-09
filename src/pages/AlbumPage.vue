<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="top-nav-bar">
      <div class="nav-title-box">
        <span class="nav-title">{{ albumTitle }}</span>
      </div>
      <div class="nav-right-actions">
        <i class="fas fa-search action-btn" @click="focusSearch" title="搜索专辑内容"></i>
      </div>
    </div>

    <div v-if="headerLoading" class="album-header-card skeleton-header">
      <LoadingState text="正在加载专辑信息..." />
    </div>

    <div v-else-if="headerError" class="album-header-card skeleton-header">
      <ErrorState title="加载失败" message="无法获取专辑信息" @retry="fetchAlbumHeader" />
    </div>

    <div v-else-if="albumDetail" class="album-header-card">
      <div class="header-content">
        <div class="album-cover-wrapper">
          <AppImage
            v-if="albumCover"
            :src="albumCover"
            class="album-cover"
            fit="cover"
            :alt="albumTitle"
          />
          <div v-else class="album-cover-fallback">
            <i class="fas fa-layer-group"></i>
          </div>
        </div>

        <div class="album-info">
          <h2 class="album-title">{{ albumTitle }}</h2>
          <div v-if="albumDetail.description || albumDetail.intro" class="album-desc-text">
            {{ albumDetail.description || albumDetail.intro }}
          </div>
        </div>

        <div class="album-actions">
          <button :class="['btn-follow', { followed: isFollowed }]" @click="toggleFollow">
            {{ isFollowed ? '已关注' : '关注' }}
          </button>
        </div>
      </div>

      <div class="album-stats-row">
        <div class="stat-item">
          <span class="stat-value">{{ formatNumber(apkCount) }}</span>
          <span class="stat-label">应用</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{{ formatNumber(subCount) }}</span>
          <span class="stat-label">订阅</span>
        </div>
      </div>
    </div>

    <div v-else class="album-header-card skeleton-header">
      <EmptyState title="未找到该专辑" description="该专辑可能已被删除或ID不正确" />
    </div>

    <div class="album-sub-tabs custom-scrollbar">
      <button
        v-for="tab in feedTabs"
        :key="tab.key"
        :class="['album-tab-item', { active: activeFeedTab === tab.key }]"
        @click="selectFeedTab(tab.key)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="activeFeedTab === tab.key" class="tab-line"></span>
      </button>
    </div>

    <div v-if="activeFeedTab === 'discuss'" class="album-comments-section">
      <div class="section-heading">
        <i class="fa-regular fa-comments"></i>
        <span>评论</span>
        <span v-if="albumDetail?.commentnum || albumDetail?.replynum" class="section-count">
          {{ albumDetail.commentnum || albumDetail.replynum }}
        </span>
      </div>

      <div v-if="feedsLoading && page === 1" class="loading-wrapper">
        <LoadingState text="正在获取评论..." />
      </div>

      <ErrorState
        v-else-if="feedsError && albumComments.length === 0"
        title="评论加载失败"
        message="无法获取应用集评论，请稍后重试"
        @retry="retryComments"
      />

      <FeedCommentSection
        v-else
        :feed-uid="albumId"
        :feed-username="albumDetail?.username"
        :comments="albumComments"
        :loading="false"
        :normalize-img="normalizeImg"
        :format-rich-text="formatRichText"
        @send-comment="sendComment"
      />

      <div class="pagination-footer">
        <LoadingState v-if="feedsLoading && page > 1" text="加载更多评论..." />
        <button v-else-if="feedsError" class="retry-inline" @click="retryComments">加载失败，点击重试</button>
        <div v-else-if="noMore && albumComments.length > 0" class="no-more">没有更多评论了</div>
      </div>
    </div>

    <div v-else class="album-apps-section">
      <EmptyState title="应用列表暂不可用" description="当前应用集详情接口未返回应用明细" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import FeedCommentSection from '../components/feed/FeedCommentSection.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { renderCoolapkRichText } from '../utils/richText';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
// 固定当前缓存页面的参数，返回该页面时直接恢复原实例。
const albumId = ref(route.params.albumId as string);

const albumDetail = ref<any>(null);
const headerLoading = ref(false);
const headerError = ref(false);

const albumComments = ref<any[]>([]);
const feedsLoading = ref(false);
const feedsError = ref(false);
const page = ref(1);
const noMore = ref(false);
const isFollowed = ref(false);

const activeFeedTab = ref('discuss');
const feedTabs = [
  { key: 'discuss', label: '讨论' },
  { key: 'applist', label: '应用列表' },
];

const albumCover = computed(() => {
  if (!albumDetail.value) return '';
  return albumDetail.value.pic || albumDetail.value.cover || albumDetail.value.logo || albumDetail.value.icon || '';
});

const albumTitle = computed(() => {
  if (!albumDetail.value) return albumId.value;
  return albumDetail.value.title || albumDetail.value.name || albumDetail.value.albumName || albumId.value;
});

const apkCount = computed(() => {
  if (!albumDetail.value) return 0;
  return albumDetail.value.apkCount || albumDetail.value.apk_count || albumDetail.value.apknum || 0;
});

const subCount = computed(() => {
  if (!albumDetail.value) return 0;
  return albumDetail.value.subCount || albumDetail.value.sub_count || albumDetail.value.subscriberCount || 0;
});

function formatNumber(num: number | string) {
  const n = Number(num);
  if (isNaN(n)) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

async function fetchAlbumHeader() {
  if (!albumId.value) return;
  headerLoading.value = true;
  headerError.value = false;
  try {
    const res = await CoolapkTauriAPI.getAlbumDetail(albumId.value);
    if (res && res.data) {
      albumDetail.value = res.data;
    }
  } catch (err) {
    headerError.value = true;
    console.warn('获取专辑详情失败', err);
  } finally {
    headerLoading.value = false;
  }
}

async function fetchFeeds(isLoadMore = false) {
  if (!albumId.value || feedsLoading.value || noMore.value) return;

  feedsLoading.value = true;
  if (!isLoadMore) feedsError.value = false;
  try {
    const res = await CoolapkTauriAPI.getAlbumReplies(albumId.value, page.value);
    const newComments = (res && Array.isArray(res.data)) ? res.data : [];

    if (newComments.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        albumComments.value.push(...newComments);
      } else {
        albumComments.value = newComments;
      }
      page.value++;
    }
  } catch (err) {
    feedsError.value = true;
    console.warn('获取专辑回复失败', err);
  } finally {
    feedsLoading.value = false;
  }
}

function selectFeedTab(key: string) {
  activeFeedTab.value = key;
  page.value = 1;
  noMore.value = false;
  feedsError.value = false;
  albumComments.value = [];
  if (key === 'discuss') {
    void fetchFeeds(false);
  }
}

function handleScroll(e: Event) {
  if (activeFeedTab.value !== 'discuss') return;
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    if (!feedsLoading.value && !noMore.value) {
      fetchFeeds(true);
    }
  }
}

function toggleFollow() {
  isFollowed.value = !isFollowed.value;
}

function retryComments() {
  noMore.value = false;
  feedsError.value = false;
  void fetchFeeds(page.value > 1);
}

async function sendComment(message: string) {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }

  try {
    await CoolapkTauriAPI.replyFeed(albumId.value, message);
    page.value = 1;
    noMore.value = false;
    albumComments.value = [];
    await fetchFeeds(false);
  } catch (err) {
    feedsError.value = true;
    console.warn('发表评论失败', err);
  }
}

function normalizeImg(url: string, _type: 'avatar' | 'feed') {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url.replace(/^http:/, 'https:');
}

function formatRichText(text: string) {
  if (!text) return '';
  return renderCoolapkRichText(text);
}

function focusSearch() {
  router.push({ path: '/search', query: { q: albumTitle.value } });
}

onMounted(() => {
  fetchAlbumHeader();
  fetchFeeds(false);
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

.album-header-card {
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

.album-cover-wrapper {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background-color: var(--background);
}

.album-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.25));
  font-size: 26px;
  color: #3b82f6;
}

.album-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.album-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.album-desc-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

.album-stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 8px 0;
  background-color: var(--background);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.stat-divider {
  width: 1px;
  height: 28px;
  background-color: var(--border);
}

.album-sub-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  overflow-x: auto;
}

.album-tab-item {
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

.album-tab-item.active {
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

.album-comments-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.section-heading i {
  color: var(--brand-primary, #10b981);
}

.section-count {
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 500;
}

.album-apps-section {
  padding: 24px 0;
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
  cursor: pointer;
  font-size: 12px;
}
</style>
