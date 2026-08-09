<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <!-- 头部区域 -->
    <div class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title"><i class="fas fa-history icon"></i> 浏览历史与足迹</h2>
          <span class="page-subtitle">左侧历史浏览时间轴，右侧常逛酷友与最近访问记录</span>
        </div>

        <div v-if="authStore.isLoggedIn" class="header-actions">
          <AppButton
            variant="secondary"
            size="sm"
            icon="fas fa-sync-alt"
            :loading="loading || recentLoading"
            @click="refreshAll"
          >
            刷新
          </AppButton>
        </div>
      </div>
    </div>

    <!-- 未登录引导 -->
    <div v-if="!authStore.isLoggedIn" class="empty-wrapper">
      <EmptyState title="登录后查看浏览历史" description="登录酷安账号后，此处将同步展示您在酷安上真实的浏览历史与最近访问记录" />
      <div class="login-hint">
        <AppButton variant="primary" size="sm" @click="authStore.openLoginModal()">立即登录</AppButton>
      </div>
    </div>

    <!-- 登录后：左侧主历史时间轴 + 右侧边栏（常逛酷友） -->
    <div v-else class="history-two-columns">
      <!-- 左侧：历史时间轴 (Main Timeline Stream) -->
      <main class="history-main-timeline">
        <div class="section-title-row">
          <span class="section-title"><i class="far fa-clock icon"></i> 浏览历史记录</span>

          <!-- 筛选胶囊按钮组 -->
          <div class="filter-pills">
            <button
              :class="['filter-btn', { active: selectedFilter === 'all' }]"
              @click="selectedFilter = 'all'"
            >
              全部
            </button>
            <button
              :class="['filter-btn', { active: selectedFilter === 'feed' }]"
              @click="selectedFilter = 'feed'"
            >
              <i class="far fa-comment-alt"></i> 动态
            </button>
            <button
              :class="['filter-btn', { active: selectedFilter === 'user' }]"
              @click="selectedFilter = 'user'"
            >
              <i class="far fa-user"></i> 用户
            </button>
            <button
              :class="['filter-btn', { active: selectedFilter === 'topic' }]"
              @click="selectedFilter = 'topic'"
            >
              <i class="fas fa-hashtag"></i> 话题
            </button>
            <button
              :class="['filter-btn', { active: selectedFilter === 'apk' }]"
              @click="selectedFilter = 'apk'"
            >
              <i class="fas fa-cubes"></i> 应用
            </button>
          </div>
        </div>

        <div v-if="loading && filteredMainTimelineItems.length === 0" class="loading-wrapper">
          <LoadingState text="正在读取历史记录..." />
        </div>
        <div v-else-if="error && filteredMainTimelineItems.length === 0" class="error-wrapper">
          <ErrorState title="加载历史失败" :message="error" @retry="fetchHistory(true)" />
        </div>
        <div v-else-if="filteredMainTimelineItems.length === 0" class="empty-wrapper">
          <EmptyState title="暂无相关历史记录" description="在酷安上浏览过的记录会按筛选展示在此处" />
        </div>

        <div v-else class="timeline-tree">
          <div class="timeline-stem"></div>

          <div
            v-for="group in groupedFilteredTimeline"
            :key="group.dateLabel"
            class="timeline-group"
          >
            <div class="timeline-date-header">
              <div class="date-dot"></div>
              <span class="date-title">{{ group.dateLabel }}</span>
              <span class="group-count">{{ group.items.length }} 记录</span>
            </div>

            <div class="feed-posts-list">
              <div
                v-for="item in group.items"
                :key="item.id"
                class="feed-history-card history-item"
                @click="openItem(item)"
              >
                <div class="feed-card-top">
                  <AppAvatar :src="item.logo" size="md" :alt="item.title" />
                  <div class="feed-author-meta">
                    <div class="card-name-line">
                      <span class="feed-author-name">{{ item.title || '历史记录' }}</span>
                      <span v-if="typeLabel(item)" class="type-badge">{{ typeLabel(item) }}</span>
                    </div>
                    <span class="feed-time-text"><i class="far fa-clock"></i> {{ formatTimeExact(item.dateline) }}</span>
                  </div>
                  <i class="fas fa-chevron-right arrow-icon"></i>
                </div>

                <div
                  v-if="richDescription(item)"
                  class="feed-text-content history-desc"
                  v-html="richDescription(item)"
                  @click.stop="handleDescClick($event, item)"
                ></div>
              </div>
            </div>
          </div>

          <div class="pagination-footer">
            <LoadingState v-if="loadingMore" text="正在读取更多历史足迹..." />
            <div v-else-if="noMore" class="no-more">已加载全部历史记录</div>
          </div>
        </div>
      </main>

      <!-- 右侧：吸顶侧边栏 (Right Sidebar) -->
      <aside class="history-sidebar">
        <!-- 整合唯一侧边栏卡片：除了动态外的常逛用户、话题与应用 -->
        <div v-if="sidebarItems.length > 0" class="sidebar-card">
          <div class="sidebar-header">
            <span class="sidebar-title"><i class="fas fa-fire icon"></i> 最近常逛与访问</span>
            <span class="sidebar-count">{{ sidebarItems.length }}</span>
          </div>

          <div class="sidebar-list">
            <div
              v-for="item in sidebarItems"
              :key="item._uniqueKey"
              class="sidebar-row-item"
              @click="openItem(item)"
            >
              <AppAvatar :src="item.logo" size="sm" :alt="item.title" />
              <div class="row-info">
                <div class="row-title-line">
                  <span class="row-name">{{ item.title || '快捷访问' }}</span>
                  <span v-if="typeLabel(item)" class="row-type-tag">{{ typeLabel(item) }}</span>
                </div>
                <span class="row-count"><i class="fas fa-chart-line"></i> {{ item._count || 1 }}次</span>
              </div>
              <i class="fas fa-chevron-right row-arrow"></i>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppButton from '../components/common/AppButton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import AppAvatar from '../components/common/AppAvatar.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import { handleAnchorClick } from '../utils/anchorClick';
import { openFeedDetail } from '../utils/feedNavigation';

const router = useRouter();
const authStore = useAuthStore();

const selectedFilter = ref<'all' | 'feed' | 'user' | 'topic' | 'apk'>('all');

const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const feeds = ref<any[]>([]);
const page = ref(1);
const error = ref('');

const recentLoading = ref(false);
const recentLoadingMore = ref(false);
const recentNoMore = ref(false);
const recentItems = ref<any[]>([]);
const recentPage = ref(1);
const recentError = ref('');

function refreshAll() {
  void fetchHistory(true);
  void fetchRecent(true);
}

function recentKey(item: any): string {
  return `${item.id || item.entityId || ''}-${item.type || item.entityType || ''}`;
}

function getItemType(item: any): 'feed' | 'user' | 'topic' | 'apk' {
  if (!item) return 'feed';
  const type = (item?.type || item?.entityType || item?.entity_type || item?.target_type || item?.entityTemplate || '').toLowerCase();
  const url = (item?.url || item?.targetUrl || '').toLowerCase();
  const title = item?.title || '';

  // URL 前缀优先判定（历史条目 url 形如 /u/xxx、/feed/xxx、/t/xxx、/apk/xxx）
  if (type === 'user' || url.startsWith('/u/')) return 'user';
  if (type === 'topic' || type === 'dyh' || url.startsWith('/t/') || url.includes('/topic/')) return 'topic';
  if (type === 'apk' || type === 'game' || type === 'product' || url.startsWith('/apk/') || url.includes('/product/') || item?.apkname || item?.packageName) return 'apk';
  if (type === 'feed' || url.startsWith('/feed/')) return 'feed';

  // 无 URL 时的兜底判断
  if (title.endsWith('的动态')) return 'user';

  return 'feed';
}

function typeLabel(item: any): string {
  const t = getItemType(item);
  if (t === 'user') return '用户';
  if (t === 'topic') return '话题';
  if (t === 'apk') return '应用';
  if (t === 'feed') return '动态';
  return '';
}

function richDescription(item: any): string {
  const desc = item?.description || item?.entityTemplate || '';
  if (typeof desc === 'string' && desc.trim() && desc.trim() !== 'feed') return desc.trim();
  return '';
}

function getDateLabel(timestamp: number | string): string {
  if (!timestamp) return '更早之前';
  const ts = typeof timestamp === 'string' && /^\d+$/.test(timestamp)
    ? parseInt(timestamp, 10)
    : typeof timestamp === 'number'
      ? timestamp
      : 0;

  if (!ts) return '更早之前';
  const date = new Date(ts > 9999999999 ? ts : ts * 1000);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) return '今天';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return '昨天';

  const beforeYesterday = new Date(now);
  beforeYesterday.setDate(now.getDate() - 2);
  const isBeforeYesterday =
    date.getFullYear() === beforeYesterday.getFullYear() &&
    date.getMonth() === beforeYesterday.getMonth() &&
    date.getDate() === beforeYesterday.getDate();

  if (isBeforeYesterday) return '前天';

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatTimeExact(dateline: any): string {
  if (!dateline) return '';
  const ts = typeof dateline === 'string' && /^\d+$/.test(dateline)
    ? parseInt(dateline, 10)
    : typeof dateline === 'number'
      ? dateline
      : 0;

  if (ts > 0) {
    const date = new Date(ts > 9999999999 ? ts : ts * 1000);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return String(dateline);
}

function visitCountNumber(item: any): number {
  // 真实字段：count（访问次数）；兼容历史遗留命名
  const n = item?.count ?? item?.visitNum ?? item?.num ?? item?.hitNum;
  if (typeof n === 'number') return n;
  if (typeof n === 'string' && /^\d+$/.test(n)) return parseInt(n, 10);
  return 1;
}

// 统一历史条目身份 key（用目标 id + 类型，而非每次访问都不同的历史记录 id）
function historyItemKey(item: any): string {
  const rawId = item?.target_id ?? item?.id ?? item?.entityId ?? item?.uid ?? '';
  let idStr = String(rawId);
  if (idStr.includes(':')) idStr = idStr.split(':').pop() || '';
  return `${idStr}-${getItemType(item)}`;
}

// 侧边栏列表：除了动态以外的用户、话题与应用 (基于频次降序)
const sidebarItems = computed(() => {
  const map = new Map<string, any>();

  for (const item of recentItems.value) {
    const t = getItemType(item);
    if (t !== 'feed') {
      const key = historyItemKey(item);
      const count = visitCountNumber(item);
      if (!map.has(key)) {
        map.set(key, { ...item, _count: count, _uniqueKey: `sb-${key}` });
      } else {
        const existing = map.get(key);
        existing._count = Math.max(existing._count, count);
      }
    }
  }

  for (const item of feeds.value) {
    const t = getItemType(item);
    if (t !== 'feed') {
      const key = historyItemKey(item);
      if (map.has(key)) {
        const existing = map.get(key);
        existing._count += 1;
      } else {
        map.set(key, { ...item, _count: 1, _uniqueKey: `sb-${key}` });
      }
    }
  }

  const list = Array.from(map.values());
  list.sort((a, b) => b._count - a._count);
  return list;
});

// 左侧主列表精准筛选算法
const filteredMainTimelineItems = computed(() => {
  if (selectedFilter.value === 'all') return feeds.value;
  return feeds.value.filter(item => getItemType(item) === selectedFilter.value);
});

const groupedFilteredTimeline = computed(() => {
  const map: Map<string, any[]> = new Map();
  for (const item of filteredMainTimelineItems.value) {
    const label = getDateLabel(item.dateline);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(item);
  }
  const result: { dateLabel: string; items: any[] }[] = [];
  for (const [dateLabel, items] of map.entries()) {
    result.push({ dateLabel, items });
  }
  return result;
});

function openItem(item: any) {
  const type = (item?.type || item?.entityType || '').toLowerCase();
  const url = item?.url || item?.targetUrl || '';
  const id = item?.id || item?.target_id || item?.entityId;

  if (type === 'feed' || url.includes('/feed/')) {
    const feedId = url.match(/\/feed\/(\d+)/)?.[1] || id;
    if (feedId) {
      openFeedDetail(router, feedId, item);
      return;
    }
  }

  if (url && url.startsWith('/')) {
    if (url.startsWith('/u/')) {
      const uid = url.replace('/u/', '').split('?')[0];
      router.push(`/user/${uid}`);
      return;
    }
    if (url.startsWith('/topic/') || url.startsWith('/t/')) {
      const tag = url.replace(/^\/(topic|t)\//, '').split('?')[0];
      router.push(`/topic/${encodeURIComponent(tag)}`);
      return;
    }
    if (url.startsWith('/feed/')) {
      const feedId = url.replace('/feed/', '').split('?')[0];
      openFeedDetail(router, feedId, item);
      return;
    }
  }

  if (id) {
    switch (type) {
      case 'user':
        router.push(`/user/${id}`);
        return;
      case 'topic':
      case 'dyh':
        router.push(`/topic/${encodeURIComponent(item.title || id)}`);
        return;
      case 'apk':
      case 'game':
        router.push(`/product/${id}`);
        return;
      case 'album':
      case 'appCollection':
        router.push(`/album/${id}`);
        return;
    }
  }

  const full = url.startsWith('http') ? url : `https://www.coolapk.com${url}`;
  CoolapkTauriAPI.openUrl(full, 'internal');
}

function handleDescClick(e: Event, item: any) {
  const anchor = (e.target as HTMLElement).closest('a');
  if (!anchor?.href) {
    openItem(item);
    return;
  }
  e.preventDefault();
  const feedMatch = (anchor.getAttribute('href') || '').match(/^\/feed\/(\d+)/);
  if (feedMatch?.[1]) {
    openFeedDetail(router, feedMatch[1], item);
    return;
  }
  handleAnchorClick(e);
}

async function fetchHistory(isRefresh = false) {
  if (loading.value || (loadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    feeds.value = [];
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  error.value = '';

  try {
    const res = await CoolapkTauriAPI.getHitHistory(page.value);
    const newFeeds = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (newFeeds.length === 0) {
      noMore.value = true;
    } else {
      if (isRefresh) {
        feeds.value = newFeeds;
      } else {
        const existingIds = new Set(feeds.value.map(i => i.id));
        feeds.value.push(...newFeeds.filter((i: any) => !existingIds.has(i.id)));
      }
      page.value++;
    }
  } catch (err: any) {
    error.value = err?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function fetchRecent(isRefresh = false) {
  if (recentLoading.value || (recentLoadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    recentPage.value = 1;
    recentNoMore.value = false;
    recentItems.value = [];
    recentLoading.value = true;
  } else {
    if (recentNoMore.value) return;
    recentLoadingMore.value = true;
  }
  recentError.value = '';

  try {
    const res = await CoolapkTauriAPI.getRecentHistory(recentPage.value);
    const newItems = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (newItems.length === 0) {
      recentNoMore.value = true;
    } else {
      if (isRefresh) {
        recentItems.value = newItems;
      } else {
        const existingKeys = new Set(recentItems.value.map(i => `${i.id || i.entityId}-${i.type || i.entityType}`));
        recentItems.value.push(...newItems.filter((i: any) => !existingKeys.has(`${i.id || i.entityId}-${i.type || i.entityType}`)));
      }
      recentPage.value++;
    }
  } catch (err: any) {
    recentError.value = err?.message || '加载失败，请检查网络';
  } finally {
    recentLoading.value = false;
    recentLoadingMore.value = false;
  }
}

function handleScroll(e: Event) {
  if (!authStore.isLoggedIn) return;
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    if (!loading.value && !loadingMore.value && !noMore.value) {
      void fetchHistory(false);
    }
    if (!recentLoading.value && !recentLoadingMore.value && !recentNoMore.value) {
      void fetchRecent(false);
    }
  }
}

watch(
  () => authStore.user?.uid,
  () => {
    if (!authStore.isLoggedIn) return;
    if (feeds.value.length === 0) void fetchHistory(true);
    if (recentItems.value.length === 0) void fetchRecent(true);
  }
);

onMounted(() => {
  if (authStore.isLoggedIn) {
    void fetchHistory(true);
    void fetchRecent(true);
  }
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

.history-two-columns {
  display: flex;
  gap: var(--space-5);
  align-items: flex-start;
  width: 100%;
}

.history-main-timeline {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.filter-pills {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.filter-btn:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.filter-btn.active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  font-weight: 600;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title .icon {
  color: var(--brand-primary);
}

.history-sidebar {
  width: 320px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sidebar-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.sidebar-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-title .icon {
  color: var(--brand-primary);
}

.sidebar-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  padding: 1px 7px;
  border-radius: var(--radius-pill);
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-row-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.sidebar-row-item:hover {
  background-color: var(--surface-hover);
}

.row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.row-title-line {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.row-type-tag {
  font-size: 10px;
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  padding: 0 4px;
  border-radius: 4px;
  flex-shrink: 0;
}

.row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-count {
  font-size: 11px;
  font-weight: 600;
  color: #f59e0b;
  flex-shrink: 0;
}

.row-time {
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.row-arrow {
  font-size: 11px;
  color: var(--text-tertiary);
  opacity: 0.4;
}

/* 动态专属时间轴 */
.timeline-tree {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-left: 14px;
}

.timeline-stem {
  position: absolute;
  top: 14px;
  bottom: 20px;
  left: 6px;
  width: 2px;
  background: linear-gradient(to bottom, var(--brand-primary), var(--border));
  z-index: 1;
}

.timeline-group {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 2;
}

.timeline-date-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: var(--brand-primary);
  border: 3px solid var(--surface);
  box-shadow: 0 0 0 3px var(--brand-soft);
  flex-shrink: 0;
  z-index: 3;
}

.date-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.group-count {
  font-size: 11px;
  color: var(--text-tertiary);
  background-color: var(--background);
  padding: 1px 7px;
  border-radius: var(--radius-pill);
}

.feed-posts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 24px;
}

.feed-history-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.feed-history-card:hover {
  border-color: var(--brand-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
}

.feed-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.feed-author-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-name-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.type-badge {
  font-size: 10px;
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  padding: 0 5px;
  border-radius: 4px;
  flex-shrink: 0;
}

.feed-author-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-time-text {
  font-size: 11px;
  color: var(--text-tertiary);
}

.arrow-icon {
  font-size: 12px;
  color: var(--text-tertiary);
  opacity: 0.5;
  transition: transform 0.15s ease;
}

.feed-history-card:hover .arrow-icon {
  transform: translateX(2px);
  opacity: 1;
  color: var(--brand-primary);
}

.feed-text-content {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  background-color: var(--background);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.feed-text-content :deep(a) {
  color: var(--brand-primary);
}

.login-hint {
  margin-top: var(--space-3);
  text-align: center;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 900px) {
  .history-two-columns {
    flex-direction: column;
  }
  .history-sidebar {
    width: 100%;
    position: static;
  }
}
</style>
