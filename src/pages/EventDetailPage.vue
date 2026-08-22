<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="top-nav-bar">
      <div class="nav-title-box">
        <span class="nav-title">活动详情</span>
      </div>
    </div>

    <!-- 活动头部 -->
    <div v-if="headerLoading" class="event-header-card skeleton-header">
      <LoadingState text="正在加载活动详情..." />
    </div>

    <div v-else-if="headerError" class="event-header-card skeleton-header">
      <ErrorState title="加载失败" message="无法获取活动详情，该活动可能已关闭" @retry="fetchEventDetail" />
    </div>

    <template v-else-if="eventDetail">
      <div class="event-header-card">
        <AppImage
          v-if="coverUrl"
          :src="coverUrl"
          class="event-hero-cover"
          fit="cover"
          :alt="eventTitle"
        />
        <div v-else class="event-hero-cover event-hero-fallback">
          <i class="fas fa-trophy"></i>
        </div>

        <div class="event-header-body">
          <div class="event-title-row">
            <span class="event-status" :class="statusClass">{{ statusText }}</span>
            <h2 class="event-title">{{ eventTitle }}</h2>
          </div>
          <div class="event-meta">
            <span v-if="eventDetail.username">
              <i class="fas fa-user"></i> {{ eventDetail.username }}
            </span>
            <span v-if="regNumText">
              <i class="fas fa-users"></i> {{ regNumText }}
            </span>
            <span v-if="timeRange">
              <i class="fas fa-clock"></i> {{ timeRange }}
            </span>
          </div>

          <button
            v-if="actionUrl"
            :class="['btn-join', { 'is-joined': isJoined }]"
            @click="openAction"
          >
            <i :class="isJoined ? 'fas fa-check' : 'fas fa-user-plus'"></i>
            {{ actionText }}
          </button>
        </div>
      </div>

      <!-- 活动说明 -->
      <div v-if="eventContent" class="event-section-card">
        <h3 class="section-title">活动说明</h3>
        <p class="event-content">{{ eventContent }}</p>
        <p v-if="noticeRule" class="event-notice">{{ noticeRule }}</p>
      </div>

      <!-- 主办方 / 奖品 / 商品 -->
      <div v-if="sponsorUsers.length" class="event-section-card">
        <h3 class="section-title">主办方</h3>
        <div class="sponsor-user-list">
          <div v-for="user in sponsorUsers" :key="getKey(user)" class="sponsor-user" @click="openUser(user)">
            <AppImage
              v-if="getUserAvatar(user)"
              :src="getUserAvatar(user)"
              class="sponsor-avatar"
              fit="cover"
              :alt="getUserName(user)"
            />
            <div v-else class="sponsor-avatar sponsor-avatar-fallback">
              <i class="fas fa-user"></i>
            </div>
            <span class="sponsor-name">{{ getUserName(user) }}</span>
          </div>
        </div>
      </div>

      <div v-if="sponsorPrizes.length" class="event-section-card">
        <h3 class="section-title">活动奖品</h3>
        <div class="prize-grid">
          <div v-for="prize in sponsorPrizes" :key="getKey(prize)" class="prize-item">
            <AppImage
              v-if="getPrizeImage(prize)"
              :src="getPrizeImage(prize)"
              class="prize-cover"
              fit="cover"
              :alt="getPrizeTitle(prize)"
            />
            <div v-else class="prize-cover prize-cover-fallback">
              <i class="fas fa-gift"></i>
            </div>
            <span class="prize-title">{{ getPrizeTitle(prize) }}</span>
          </div>
        </div>
      </div>

      <!-- 活动动态 Tab -->
      <div v-if="eventTabs.length" class="event-sub-tabs custom-scrollbar">
        <button
          v-for="tab in eventTabs"
          :key="tab.url"
          :class="['event-tab-item', { active: activeTabUrl === tab.url }]"
          @click="selectTab(tab.url)"
        >
          <span>{{ tab.title || '动态' }}</span>
          <span v-if="activeTabUrl === tab.url" class="tab-line"></span>
        </button>
      </div>

      <div v-if="feedsLoading && page === 1" class="loading-wrapper">
        <LoadingState text="正在加载活动动态..." />
      </div>

      <div v-else-if="feedsError && feeds.length === 0" class="error-wrapper">
        <ErrorState title="动态加载失败" message="无法获取该活动的动态列表" @retry="retryFeeds" />
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
    </template>

    <div v-else class="empty-wrapper">
      <EmptyState title="未找到该活动" description="该活动可能已被删除或ID不正确" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import type { CoolEvent, CoolEventTab } from '../types/coolevent';

const route = useRoute();
const eventId = ref(route.params.eventId as string);

const eventDetail = ref<CoolEvent | null>(null);
const headerLoading = ref(false);
const headerError = ref(false);
const isJoined = ref(false);

const feeds = ref<any[]>([]);
const feedsLoading = ref(false);
const feedsError = ref(false);
const page = ref(1);
const noMore = ref(false);
const activeTabUrl = ref('');

const coverUrl = computed(() => {
  const ev = eventDetail.value;
  if (!ev) return '';
  return ev.pic || ev.logo || ev.picArr?.[0] || '';
});

const eventTitle = computed(() => eventDetail.value?.title || eventId.value);

const eventContent = computed(() => {
  const ev = eventDetail.value;
  return (ev?.content || ev?.description || '').trim();
});

const noticeRule = computed(() => {
  const rule = eventDetail.value?.noticeRule || eventDetail.value?.notice_rule || '';
  return String(rule).trim();
});

const statusText = computed(() => {
  const stage = Number(eventDetail.value?.stageStatus ?? eventDetail.value?.stage_status ?? -1);
  if (stage === 2) return '已结束';
  if (stage === 1) return '进行中';
  return '报名中';
});

const statusClass = computed(() => {
  const stage = Number(eventDetail.value?.stageStatus ?? eventDetail.value?.stage_status ?? -1);
  if (stage === 2) return 'is-ended';
  if (stage === 1) return 'is-running';
  return 'is-open';
});

const regNumText = computed(() => {
  const reg = eventDetail.value?.regNum ?? eventDetail.value?.reg_num;
  return reg ? `${reg} 人报名` : '';
});

const timeRange = computed(() => {
  const ev = eventDetail.value;
  if (!ev) return '';
  const start = ev.timeRegStart ?? ev.time_reg_start;
  if (!start) return '';
  const startText = formatStamp(start);
  const end = ev.timeEnd ?? ev.time_end ?? ev.timeRegEnd ?? ev.time_reg_end;
  const endText = end ? formatStamp(end) : '';
  return endText && endText !== startText ? `${startText} ~ ${endText}` : startText;
});

const actionUrl = computed(() => {
  const ev = eventDetail.value;
  return ev?.actionUrl || ev?.action_url || '';
});

const actionText = computed(() => {
  const joined = isJoined.value;
  const stage = Number(eventDetail.value?.stageStatus ?? eventDetail.value?.stage_status ?? -1);
  if (stage === 2) return '活动已结束';
  return joined ? '已报名' : '立即报名';
});

const sponsorUsers = computed(() => Array.isArray(eventDetail.value?.sponsorUser) ? eventDetail.value!.sponsorUser! : []);
const sponsorPrizes = computed(() => {
  const ev = eventDetail.value;
  if (Array.isArray(ev?.sponsorPrize)) return ev!.sponsorPrize!;
  if (Array.isArray(ev?.list)) return ev!.list!.filter((item: any) => item?.entityType === 'sponsorPrize');
  return [];
});

const eventTabs = computed<CoolEventTab[]>(() => {
  const ev = eventDetail.value;
  const raw = ev?.tabList || ev?.tabApiList;
  if (!Array.isArray(raw)) return [];
  return raw.filter((tab: any) => tab && tab.url);
});

function formatStamp(value: number | string | undefined): string {
  if (!value) return '';
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  const date = new Date(num * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getKey(item: any): string {
  return item?.id || item?.entityId || item?.title || JSON.stringify(item);
}

function getUserAvatar(user: any): string {
  return user?.userAvatar || user?.avatar || user?.pic || '';
}

function getUserName(user: any): string {
  return user?.username || user?.user_name || user?.name || '酷友';
}

function openUser(user: any) {
  const uid = user?.uid;
  if (!uid) return;
  void CoolapkTauriAPI.openUrl(`/user/${uid}`, 'internal');
}

function getPrizeImage(prize: any): string {
  return prize?.pic || prize?.logo || prize?.picArr?.[0] || prize?.pic_url || '';
}

function getPrizeTitle(prize: any): string {
  return prize?.title || prize?.entityTitle || prize?.subTitle || '奖品';
}

async function fetchEventDetail() {
  if (!eventId.value) return;
  headerLoading.value = true;
  headerError.value = false;
  eventDetail.value = null;
  try {
    const res = await CoolapkTauriAPI.getEventDetail(eventId.value);
    if (res?.data && typeof res.data === 'object') {
      eventDetail.value = res.data;
      isJoined.value = !!(res.data.isJoinStatus ?? res.data.is_join_status ?? res.data.isJoin);
      const tabs = eventTabs.value;
      if (tabs.length > 0) {
        selectTab(tabs[0].url || '');
      } else {
        void fetchFeeds(false);
      }
    } else {
      headerError.value = true;
    }
  } catch (err) {
    headerError.value = true;
    console.warn('获取活动详情失败', err);
  } finally {
    headerLoading.value = false;
  }
}

function openAction() {
  if (!actionUrl.value) return;
  void CoolapkTauriAPI.openUrl(actionUrl.value, 'internal');
}

async function fetchFeeds(isLoadMore = false) {
  if (!eventId.value || feedsLoading.value || noMore.value) return;
  if (!activeTabUrl.value) return;
  feedsLoading.value = true;
  if (!isLoadMore) feedsError.value = false;
  try {
    const res = await CoolapkTauriAPI.getBoardFeeds(activeTabUrl.value, page.value);
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
    console.warn('获取活动动态失败', err);
  } finally {
    feedsLoading.value = false;
  }
}

function selectTab(url: string) {
  if (activeTabUrl.value === url) return;
  activeTabUrl.value = url;
  page.value = 1;
  noMore.value = false;
  feedsError.value = false;
  feeds.value = [];
  void fetchFeeds(false);
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

watch(eventId, () => {
  page.value = 1;
  noMore.value = false;
  feeds.value = [];
  activeTabUrl.value = '';
  void fetchEventDetail();
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

.event-header-card {
  background-color: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.skeleton-header {
  padding: 24px;
}

.event-hero-cover {
  width: 100%;
  height: 180px;
  background-color: var(--background-secondary);
}

.event-hero-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: var(--brand-primary);
  background: linear-gradient(135deg, var(--brand-soft), var(--brand-soft-hover));
}

.event-header-body {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.event-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.event-status {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  margin-top: 3px;
}

.event-status.is-open,
.event-status.is-running {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
}

.event-status.is-ended {
  background-color: var(--background-secondary);
  color: var(--text-tertiary);
}

.event-title {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.4;
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.event-meta i {
  margin-right: 4px;
}

.btn-join {
  align-self: flex-start;
  height: 34px;
  padding: 0 20px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-join:hover {
  background: var(--brand-hover, #059669);
}

.btn-join.is-joined {
  background: var(--background-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.event-section-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.event-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.65;
  margin: 0;
  white-space: pre-wrap;
}

.event-notice {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.55;
  margin: 0;
  background-color: var(--background);
  border-radius: 8px;
  padding: 8px 10px;
}

.sponsor-user-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.sponsor-user {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  background-color: var(--background-secondary);
}

.sponsor-user:hover {
  background-color: var(--surface-hover);
}

.sponsor-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--background);
}

.sponsor-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

.sponsor-name {
  font-size: 12px;
  color: var(--text-primary);
}

.prize-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.prize-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prize-cover {
  width: 100%;
  height: 84px;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--background-secondary);
}

.prize-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--text-tertiary);
}

.prize-title {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-sub-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  overflow-x: auto;
}

.event-tab-item {
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

.event-tab-item.active {
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