<template>
  <div ref="pageContainerRef" class="page-container custom-scrollbar" @scroll.passive="handlePageScroll">
    <div class="page-header">
      <div class="notification-title-row">
        <h2 class="page-title">通知中心</h2>
        <div class="notification-actions">
          <button type="button" class="header-action-btn" :disabled="loading" @click="refreshNotifications"><i class="fas fa-sync-alt"></i> 刷新</button>
          <button type="button" class="header-action-btn" :disabled="!notificationStore.categoryCounts[getCurrentCategory()]" @click="markCurrentTabViewed"><i class="fas fa-check-double"></i> 当前分类已读</button>
        </div>
      </div>
      
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.value"
          :class="['tab-btn', { active: currentTab === tab.value }]"
          @click="switchTab(tab.value)"
        >
          {{ tab.label }}
          <span v-if="notificationStore.categoryCounts[tab.countKey] > 0" class="tab-badge">
            {{ notificationStore.categoryCounts[tab.countKey] }}
          </span>
        </button>
      </div>
    </div>

    <div class="content-wrapper">
      <div v-if="loading && items.length === 0" class="loading-wrapper">
        <LoadingState text="正在获取通知..." />
      </div>

      <div v-else-if="notificationError && items.length === 0" class="empty-wrapper">
        <ErrorState title="通知加载失败" :message="notificationError" @retry="refreshNotifications" />
      </div>

      <div v-else-if="!loading && items.length === 0" class="empty-wrapper">
        <EmptyState title="暂无通知" description="当有新动态时会在这里提醒你" />
      </div>

      <div v-else class="notification-list">
        <div v-for="item in items" :key="getNotificationKey(item)" :class="['notify-card', { unread: isNotificationUnread(item) }]">
          <div class="notify-avatar-wrap">
            <AppAvatar :src="getAvatar(item)" size="md" class="notify-avatar" />
          </div>
          <div class="notify-content">
            <div class="notify-header">
              <span class="notify-user">{{ getUsername(item) }}</span>
              <span class="notify-header-right">
                <span class="notify-time">{{ formatTime(item.likeTime || item.dateline) }}</span>
                <span v-if="getNotificationUnreadCount(item) > 0" class="notify-unread-badge" aria-label="未读通知数">{{ getNotificationUnreadLabel(item) }}</span>
              </span>
            </div>
            
            <div v-if="getNote(item)" class="notify-action" v-html="renderCoolapkRichText(getNote(item))" @click="handleNotifyClick($event, item)"></div>

            <div v-if="getMessage(item)" class="notify-message" v-html="renderCoolapkRichText(getMessage(item))" @click="handleNotifyClick($event, item)"></div>

            <div v-if="getTarget(item)" class="notify-target">
              <span class="target-title" v-html="renderCoolapkRichText(getTarget(item))" @click="handleNotifyClick($event, item)"></span>
            </div>

            <button
              v-if="getOriginalFeedId(item)"
              type="button"
              class="original-feed-preview"
              @click="openOriginalFeed(item)"
            >
              <span class="original-feed-label">原动态</span>
              <span class="original-feed-summary">{{ getOriginalFeedSummary(item) }}</span>
              <span class="original-feed-action">查看原动态 <i class="fas fa-chevron-right"></i></span>
            </button>
          </div>
        </div>

        <div class="load-more-wrapper" v-if="items.length > 0">
          <div v-if="notificationError" class="notification-inline-error">{{ notificationError }} <button type="button" @click="refreshNotifications">重试</button></div>
          <button 
            v-if="hasMore" 
            class="load-more-btn" 
            @click="loadMore" 
            :disabled="loading"
          >
            {{ loading ? '加载中...' : '加载更多' }}
          </button>
          <div v-else class="no-more">
            — 到底了 —
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onActivated, onDeactivated, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useNotificationStore } from '../stores/notifications';
import type { NotificationCategory } from '../utils/notificationCount';
import { getNotificationActor } from '../utils/notificationItem';
import { renderCoolapkRichText } from '../utils/richText';
import { handleAnchorClick } from '../utils/anchorClick';
import { openFeedDetail } from '../utils/feedNavigation';
import { getNotificationExternalUrl, getNotificationFeedId, getNotificationFeedTarget, getNotificationProductName, resolveNotificationTargetRoute } from '../utils/notificationNavigation';
import AppAvatar from '../components/common/AppAvatar.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';

const router = useRouter();
const route = useRoute();
const notificationStore = useNotificationStore();

// 分类 Tabs（接口路径与官方 UWP 客户端一致）
const tabs: Array<{ label: string; value: string; countKey: NotificationCategory }> = [
  { label: '评论回复', value: 'list', countKey: 'comment' },
  { label: '@ 提及', value: 'atMeList', countKey: 'atMe' },
  { label: '评论 @', value: 'atCommentMeList', countKey: 'atComment' },
  { label: '收到的赞', value: 'feedLikeList', countKey: 'like' },
  { label: '新关注', value: 'contactsFollowList', countKey: 'follow' }
];

const currentTab = ref('list');
const loading = ref(false);
const items = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);
const notificationError = ref('');
const pageContainerRef = ref<HTMLElement | null>(null);

// 切换 Tab
async function switchTab(tabValue: string) {
  if (currentTab.value === tabValue && items.value.length > 0) return;
  currentTab.value = tabValue;
  page.value = 1;
  items.value = [];
  hasMore.value = true;
  await fetchNotifications();
}

// 加载更多
async function loadMore() {
  if (loading.value || !hasMore.value) return;
  page.value += 1;
  await fetchNotifications();
}

/**
 * 通知页使用自身作为纵向滚动容器，不能依赖 window 的 scroll 事件。
 * 距离底部不足一张卡片高度时提前预取，按钮仍保留作键盘/兜底入口。
 */
function handlePageScroll(event: Event) {
  const container = event.currentTarget as HTMLElement | null;
  loadMoreWhenNearBottom(container);
}

function loadMoreWhenNearBottom(container = pageContainerRef.value) {
  if (!container || loading.value || !hasMore.value) return;
  const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
  if (remaining <= 240) void loadMore();
}

// 获取数据
async function fetchNotifications() {
  if (loading.value) return;
  loading.value = true;
  notificationError.value = '';
  try {
    const res = await CoolapkTauriAPI.getNotifications(currentTab.value, page.value);
    const data = res?.data || [];
    
    if (Array.isArray(data)) {
      if (data.length === 0) {
        hasMore.value = false;
      } else {
        if (page.value === 1) {
          items.value = data;
        } else {
          items.value = [...items.value, ...data];
        }
      }
    } else {
      hasMore.value = false;
    }
  } catch (err) {
    console.warn('Notifications fetch warning', err);
    notificationError.value = err instanceof Error ? err.message : String(err);
    if (page.value > 1) page.value -= 1;
  } finally {
    loading.value = false;
    // “@ 提及”等分类可能只有一两条，首屏没有滚动条时不会触发 scroll。
    // DOM 更新后检查一次并继续加载，直到内容足以滚动或接口明确到底。
    await nextTick();
    loadMoreWhenNearBottom();
  }
}

async function refreshNotifications() {
  if (loading.value) return;
  page.value = 1;
  hasMore.value = true;
  await fetchNotifications();
}

function handleNotificationCountIncrease() {
  void refreshNotifications();
}

// 数据提取工具函数，容错处理（兼容不同通知类型字段：
// 通用 userInfo / 关注类 fromUserInfo / 点赞类 likeUserInfo / 私信类 messageUserInfo）
function getAvatar(item: any): string {
  return getNotificationActor(item, getCurrentCategory()).avatar
    || item.messageUserInfo?.userAvatar
    || '';
}

function getUsername(item: any): string {
  const actor = getNotificationActor(item, getCurrentCategory());
  return actor.username === '酷友'
    ? item.messageUserInfo?.username || '匿名用户'
    : actor.username;
}

function getNote(item: any): string {
  if (currentTab.value === 'feedLikeList') {
    const target = String(item.feedTypeName || item.infoHtml || '动态')
      .replace(/<[^>]+>/g, '')
      .trim();
    return `赞了你的${target}`;
  }
  return item.note || item.message_title || item.feedInfo?.message_title || '';
}

function getMessage(item: any): string {
  // 提取具体评论或动态内容
  if (item.message) return item.message;
  if (item.replyRows && Array.isArray(item.replyRows) && item.replyRows[0]) {
    return item.replyRows[0].message || '';
  }
  if (item.feedInfo?.message) return item.feedInfo.message;
  if (item.targetRow?.message) return item.targetRow.message;
  return '';
}

function getTarget(item: any): string {
  // 目标标题，比如回复了哪篇文章
  if (item.targetTitle) return item.targetTitle;
  if (item.feedInfo?.message_title) return item.feedInfo.message_title;
  if (item.feedInfo?.title) return item.feedInfo.title;
  return '';
}

function getOriginalFeed(item: any): any {
  return getNotificationFeedTarget(item);
}

function getOriginalFeedId(item: any): string {
  return getNotificationFeedId(item);
}

function getOriginalFeedSummary(item: any): string {
  const original = getOriginalFeed(item);
  const text = original?.title
    || original?.message_title
    || original?.message
    || item?.targetTitle
    || item?.message_title
    || item?.message
    || '点击查看这条通知对应的完整动态';
  return String(text).replace(/<[^>]+>/g, '').trim();
}

function openOriginalFeed(item: any) {
  const id = getOriginalFeedId(item);
  if (!id) return;
  openFeedDetail(router, id, item);
}

async function resolveNotificationTarget(item: any): Promise<string | null> {
  return resolveNotificationTargetRoute(item, (name) => CoolapkTauriAPI.getProductDetailByName(name));
}

async function openNotificationTarget(item: any): Promise<boolean> {
  const externalUrl = getNotificationExternalUrl(item);
  if (externalUrl) {
    void CoolapkTauriAPI.openUrl(externalUrl);
    return true;
  }
  const feedId = getNotificationFeedId(item);
  if (feedId) {
    openFeedDetail(router, feedId, item);
    return true;
  }
  const targetRoute = await resolveNotificationTarget(item);
  if (!targetRoute) {
    return false;
  }
  void router.push(targetRoute);
  return true;
}

function formatTime(dateline: any): string {
  if (!dateline) return '';
  // 酷安的时间可能是时间戳(秒)
  const ts = typeof dateline === 'string' && /^\d+$/.test(dateline) 
    ? parseInt(dateline, 10) 
    : typeof dateline === 'number' 
      ? dateline 
      : 0;
      
  if (ts > 0) {
    const date = new Date(ts > 9999999999 ? ts : ts * 1000);
    return date.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }
  return String(dateline);
}

function getCurrentCategory(): NotificationCategory {
  return tabs.find((tab) => tab.value === currentTab.value)?.countKey || 'comment';
}

function getNotificationKey(item: any): string {
  const category = currentTab.value;
  const stableId = item?.id ?? item?.entityId ?? item?.targetId;
  if (stableId !== undefined && stableId !== null && String(stableId).trim()) {
    return `${category}:${String(stableId)}`;
  }
  const actor = item?.fromuid ?? item?.uid ?? item?.likeUid ?? '';
  const timestamp = item?.dateline ?? item?.likeTime ?? item?.lastUpdate ?? '';
  const content = String(item?.note || item?.message || item?.targetTitle || '').slice(0, 80);
  return `${category}:${actor}:${timestamp}:${content}`;
}

function getNotificationUnreadCount(item: any): number {
  const count = Number(item?.unread_count ?? item?.unreadCount);
  if (Number.isFinite(count) && count > 0) return Math.floor(count);
  return Number(item?.isnew ?? item?.isNew ?? 0) > 0 ? 1 : 0;
}

function getNotificationUnreadLabel(item: any): string {
  const count = getNotificationUnreadCount(item);
  return count > 99 ? '99+' : String(count);
}

function isNotificationUnread(item: any): boolean {
  return getNotificationUnreadCount(item) > 0;
}

function markCurrentTabViewed() {
  notificationStore.markCategoryViewed(getCurrentCategory());
}

function renderSafeHtml(text: string): string {
  return renderCoolapkRichText(text);
}

// 通知内链接点击：动态链接携带通知上下文进入完整动态页，其余走统一处理。
async function handleNotifyClick(e: Event, item: any) {
  const anchor = (e.target as HTMLElement).closest('a');
  const href = anchor?.getAttribute('href') || '';
  if (!anchor?.href || !href || href === '#' || href.startsWith('javascript:')) {
    await openNotificationTarget(item);
    return;
  }
  const feedMatch = href.match(/^\/feed\/(\d+)/);
  if (feedMatch?.[1]) {
    e.preventDefault();
    openFeedDetail(router, feedMatch[1], item);
    return;
  }
  const notification = {
    ...item,
    targetUrl: href,
    note: `${String(item?.note || '')} ${anchor.textContent || ''}`.trim(),
  };
  e.preventDefault();
  // 系统账号安全通知有时把“点击查看”渲染为普通 /u/:uid 链接。
  // 不能让该链接先走用户页路由，否则会落到“用户资料加载失败”。
  const externalUrl = getNotificationExternalUrl(notification);
  if (externalUrl) {
    void CoolapkTauriAPI.openUrl(externalUrl);
    return;
  }
  const targetRoute = await resolveNotificationTarget(notification);
  if (targetRoute) {
    void router.push(targetRoute);
    return;
  }
  if (!getNotificationProductName(notification)) handleAnchorClick(e);
}

onActivated(() => {
  window.addEventListener('coolapk-notification-count-increased', handleNotificationCountIncrease);
  notificationStore.markAllNotificationsViewed();
  void CoolapkTauriAPI.clearNotificationCount('feed').catch((err) => {
    console.warn('清除服务端通知数失败', err);
  });
  const requestedTab = String(route.query.tab || '');
  if (tabs.some((tab) => tab.value === requestedTab)) currentTab.value = requestedTab;
  void refreshNotifications();
});

onDeactivated(() => {
  window.removeEventListener('coolapk-notification-count-increased', handleNotificationCountIncrease);
});

watch(
  () => route.query.tab,
  (tab) => {
    const requestedTab = String(tab || '');
    if (tabs.some((item) => item.value === requestedTab)) void switchTab(requestedTab);
  }
);
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  padding: 0;
  margin: 0 auto;
  background-color: var(--background);
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: var(--surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: var(--space-4) var(--space-2) 0;
  border-bottom: 1px solid var(--border);
  /* 与下方 content-wrapper 的左右留白保持一致，固定时不会比通知卡片更宽。 */
  margin: 0 var(--space-3) var(--space-4);
}

.page-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-3);
  letter-spacing: -0.02em;
}

.notification-title-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.notification-actions { display: flex; gap: var(--space-2); }
.header-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; color: var(--text-secondary); background: transparent; border: 1px solid var(--border); border-radius: var(--radius-control); cursor: pointer; font-size: var(--font-size-caption); }
.header-action-btn:hover:not(:disabled) { color: var(--brand-primary); border-color: var(--brand-primary); background: var(--brand-soft); }
.header-action-btn:disabled { color: var(--text-disabled); cursor: not-allowed; }

.tabs {
  display: flex;
  gap: var(--space-4);
  overflow-x: auto;
  padding-bottom: var(--space-3);
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  background: transparent;
  border: none;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  padding: var(--space-2) 0;
  cursor: pointer;
  position: relative;
  transition: color 0.3s ease;
  white-space: nowrap;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 17px;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background-color: var(--danger);
  color: #ffffff;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  line-height: 17px;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 3px;
  background-color: var(--brand-primary);
  border-radius: var(--radius-full);
}

.content-wrapper {
  /* 与固定页头使用同一组水平边界，避免页头加宽后与卡片错位。 */
  padding: 0 var(--space-3) var(--space-5);
  min-height: 200px;
}

.loading-wrapper, .empty-wrapper {
  padding: var(--space-8) 0;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.notify-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border-light, var(--border));
  padding: var(--space-4);
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.notify-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-color: rgba(var(--brand-primary-rgb), 0.3);
}

.notify-card.unread {
  border-left: 3px solid var(--danger);
  padding-left: calc(var(--space-4) - 2px);
}

.notify-avatar-wrap {
  flex-shrink: 0;
}

.notify-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.notify-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.notify-header-right {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.notify-user {
  min-width: 0;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notify-time {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.notify-unread-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--danger);
  color: #ffffff;
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  line-height: 18px;
  box-sizing: border-box;
}

.notify-card.unread .notify-user {
  font-weight: var(--font-weight-bold);
}

.notify-action {
  font-size: var(--font-size-body);
  color: var(--text-primary);
  line-height: 1.5;
  cursor: pointer;
}

.notify-message a,
.notify-action a {
  color: var(--brand-primary);
  text-decoration: underline;
  cursor: pointer;
}

.notify-message {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  background-color: var(--background);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  margin-top: 2px;
  line-height: 1.5;
  word-break: break-all;
  cursor: pointer;
}

.notify-target {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.notify-target::before {
  content: '对：';
}

.target-title {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.original-feed-preview {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-control);
  background-color: var(--background);
  text-align: left;
  transition: border-color var(--duration-fast) var(--ease-default), background-color var(--duration-fast) var(--ease-default);
}

.original-feed-preview:hover {
  border-color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.original-feed-label {
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.original-feed-summary {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.original-feed-action {
  color: var(--brand-primary);
  font-size: var(--font-size-caption);
  white-space: nowrap;
}

.load-more-wrapper {
  display: flex;
  justify-content: center;
  padding: var(--space-4) 0;
}

.notification-inline-error { margin-bottom: var(--space-3); color: var(--danger); font-size: var(--font-size-caption); }
.notification-inline-error button { margin-left: 6px; color: var(--brand-primary); background: transparent; border: 0; cursor: pointer; }

.load-more-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.no-more {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}
</style>
