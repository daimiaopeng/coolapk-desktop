<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i class="far fa-clock icon"></i> 浏览历史</h2>
        <span class="page-subtitle">酷安账号的浏览历史与最近访问记录</span>
      </div>
    </div>

    <div class="source-tabs">
      <button
        :class="['source-tab', { active: activeTab === 'history' }]"
        @click="switchTab('history')"
      >
        浏览历史
      </button>
      <button
        :class="['source-tab', { active: activeTab === 'recent' }]"
        @click="switchTab('recent')"
      >
        最近访问
      </button>
    </div>

    <!-- 未登录：两个 Tab 都展示登录引导 -->
    <div v-if="!authStore.isLoggedIn" class="empty-wrapper">
      <EmptyState title="登录后查看浏览历史" description="登录酷安账号后，此处将展示您真实的浏览历史与最近访问记录" />
      <div class="login-hint">
        <AppButton variant="primary" size="sm" @click="authStore.openLoginModal()">立即登录</AppButton>
      </div>
    </div>

    <!-- 浏览历史：动态列表 -->
    <template v-else-if="activeTab === 'history'">
      <div v-if="loading && feeds.length === 0" class="loading-wrapper">
        <LoadingState text="正在获取浏览历史..." />
      </div>

      <div v-else-if="error && feeds.length === 0" class="error-wrapper">
        <ErrorState title="浏览历史加载失败" :message="error" @retry="fetchHistory(true)" />
      </div>

      <div v-else-if="feeds.length === 0 && !loading" class="empty-wrapper">
        <EmptyState title="暂无浏览历史" description="在酷安上浏览过的内容会显示在这里" />
      </div>

      <div v-else class="history-list">
        <div
          v-for="item in feeds"
          :key="item.id"
          class="history-item"
          role="button"
          tabindex="0"
          @click="openItem(item)"
          @keydown.enter="openItem(item)"
        >
          <AppAvatar :src="item.logo" size="sm" :alt="item.title" />
          <div class="history-info">
            <div class="history-title-row">
              <span class="history-title">{{ item.title || '未命名' }}</span>
              <span v-if="typeLabel(item)" class="history-type">{{ typeLabel(item) }}</span>
            </div>
            <div class="history-meta">
              <div
                v-if="richDescription(item)"
                class="history-desc"
                v-html="richDescription(item)"
                @click.stop="handleDescClick($event, item)"
              ></div>
              <span class="history-time">{{ formatTime(item.dateline) }}</span>
            </div>
          </div>
          <i class="fas fa-chevron-right history-arrow"></i>
        </div>
        <div class="pagination-footer">
          <LoadingState v-if="loadingMore" text="加载更多中..." />
          <div v-else-if="noMore" class="no-more">没有更多内容了</div>
        </div>
      </div>
    </template>

    <!-- 最近访问：动态 + 用户混合列表 -->
    <template v-else>
      <div v-if="recentLoading && recentItems.length === 0" class="loading-wrapper">
        <LoadingState text="正在获取最近访问..." />
      </div>

      <div v-else-if="recentError && recentItems.length === 0" class="error-wrapper">
        <ErrorState title="最近访问加载失败" :message="recentError" @retry="fetchRecent(true)" />
      </div>

      <div v-else-if="recentItems.length === 0 && !recentLoading" class="empty-wrapper">
        <EmptyState title="暂无最近访问" description="最近访问过的内容会显示在这里" />
      </div>

      <div v-else class="history-list">
        <div
          v-for="item in recentItems"
          :key="recentKey(item)"
          class="history-item"
          role="button"
          tabindex="0"
          @click="openItem(item)"
          @keydown.enter="openItem(item)"
        >
          <AppAvatar :src="item.logo" size="sm" :alt="item.title" />
          <div class="history-info">
            <div class="history-title-row">
              <span class="history-title">{{ item.title || '未命名' }}</span>
              <span v-if="typeLabel(item)" class="history-type">{{ typeLabel(item) }}</span>
            </div>
            <div class="history-meta">
              <div
                v-if="richDescription(item)"
                class="history-desc"
                v-html="richDescription(item)"
                @click.stop="handleDescClick($event, item)"
              ></div>
              <span v-else-if="visitCount(item)" class="history-desc">{{ visitCount(item) }}</span>
              <span class="history-time">{{ formatTime(item.lastupdate || item.dateline) }}</span>
            </div>
          </div>
          <i class="fas fa-chevron-right history-arrow"></i>
        </div>
        <div class="pagination-footer">
          <LoadingState v-if="recentLoadingMore" text="加载更多中..." />
          <div v-else-if="recentNoMore" class="no-more">没有更多内容了</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppButton from '../components/common/AppButton.vue';
import AppAvatar from '../components/common/AppAvatar.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { useAppStore } from '../stores/app';
import { renderCoolapkRichText } from '../utils/richText';
import { handleAnchorClick } from '../utils/anchorClick';

const router = useRouter();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const appStore = useAppStore();

const activeTab = ref<'history' | 'recent'>('history');

const feeds = ref<any[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const page = ref(1);
const noMore = ref(false);

const recentItems = ref<any[]>([]);
const recentLoading = ref(false);
const recentLoadingMore = ref(false);
const recentError = ref('');
const recentPage = ref(1);
const recentNoMore = ref(false);

function switchTab(tab: 'history' | 'recent') {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  if (!authStore.isLoggedIn) return;
  if (tab === 'history' && feeds.value.length === 0) {
    void fetchHistory(true);
  } else if (tab === 'recent' && recentItems.value.length === 0) {
    void fetchRecent(true);
  }
}

function typeLabel(item: any): string {
  return item.typeName || item.target_type_title || '';
}

function visitCount(item: any): string {
  const count = Number(item.count || 0);
  return count > 1 ? `访问 ${count} 次` : '';
}

/** description 是酷安转义富文本（feed-link-tag 话题链接 + [表情] 代码），走统一渲染管线 */
function richDescription(item: any): string {
  return renderCoolapkRichText(item.description || '');
}

function recentKey(item: any): string {
  return String(item.id ?? item.entityId ?? `${item.entityType || 'item'}-${item.title || item.url || 'unknown'}`);
}

function formatTime(time?: number | string): string {
  if (!time) return '';
  if (typeof time === 'string') return time;
  if (settingsStore.settings.timeDisplay === 'absolute') {
    const d = new Date(time * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const now = Math.floor(Date.now() / 1000);
  const diff = now - time;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  const date = new Date(time * 1000);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

/** 将酷安站内 url (如 /u/123、/apk/com.xxx) 映射到应用内路由，未知类型走外部链接页 */
function openItem(item: any) {
  let url: string = item.url || '';
  if (!url) return;
  if (url.startsWith('//')) url = `https:${url}`;
  if (!url.startsWith('/')) url = `/${url}`;

  const match = url.match(/^\/([a-zA-Z]+)\/(.*)$/);
  if (match && match[2]) {
    const [, kind, id] = match;
    switch (kind) {
      case 'feed':
        // 动态直接用内置评论抽屉卡片打开（网页版对 /feed/ 分享链接只会返回扫码落地页）
        appStore.openCommentDrawer(id, item);
        return;
      case 'u':
      case 'user':
        router.push(`/user/${id}`);
        return;
      case 'apk':
        router.push(`/app/${id}`);
        return;
      case 't':
      case 'tag':
        router.push(`/topic/${id}`);
        return;
      case 'dyh':
        router.push(`/dyh/${id}`);
        return;
      case 'product':
        router.push(`/product/${id}`);
        return;
      case 'album':
      case 'appCollection':
        router.push(`/album/${id}`);
        return;
    }
  }

  // 问答/网页等暂未内置的页面交给应用内外部链接页
  const full = url.startsWith('http') ? url : `https://www.coolapk.com${url}`;
  CoolapkTauriAPI.openUrl(full, 'internal');
}

/**
 * 描述区富文本点击（参考通知页 handleNotifyClick）：
 *  - /feed/<id> 链接 → 带上下文打开评论抽屉；
 *  - 其余链接 → 统一 anchor 处理；
 *  - 点击纯文本（非链接）→ 回退到卡片级打开逻辑，避免描述区点击无响应。
 */
function handleDescClick(e: Event, item: any) {
  const anchor = (e.target as HTMLElement).closest('a');
  if (!anchor?.href) {
    openItem(item);
    return;
  }
  e.preventDefault();
  const feedMatch = (anchor.getAttribute('href') || '').match(/^\/feed\/(\d+)/);
  if (feedMatch?.[1]) {
    appStore.openCommentDrawer(feedMatch[1], item);
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
        const existingKeys = new Set(recentItems.value.map(recentKey));
        recentItems.value.push(...newItems.filter((i: any) => !existingKeys.has(recentKey(i))));
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
    if (activeTab.value === 'history') {
      if (!loading.value && !loadingMore.value && !noMore.value) {
        void fetchHistory(false);
      }
    } else if (!recentLoading.value && !recentLoadingMore.value && !recentNoMore.value) {
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
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-main {
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

.source-tabs {
  display: flex;
  gap: var(--space-5);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-4);
}

.source-tab {
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px 2px;
  margin-bottom: -1px;
}

.source-tab.active {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
  border-bottom: 2px solid var(--brand-primary, #10b981);
}

.login-hint {
  margin-top: var(--space-3);
  text-align: center;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color var(--duration-fast) var(--ease-default);
}

.history-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  background-color: var(--surface-hover);
}

.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.history-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.history-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-type {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--brand-primary, #10b981);
  background-color: var(--brand-soft, rgba(16, 185, 129, 0.1));
  padding: 1px 6px;
  border-radius: var(--radius-xs);
}

.history-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.history-desc {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-caption);
  line-height: 1.5;
  color: var(--text-tertiary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.history-desc :deep(a) {
  color: var(--brand-primary, #10b981);
  cursor: pointer;
}

.history-desc :deep(a):hover {
  text-decoration: underline;
}

.history-time {
  flex-shrink: 0;
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.history-arrow {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-tertiary);
  opacity: 0.6;
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
