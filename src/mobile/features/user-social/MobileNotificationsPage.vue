<template>
  <MobileSocialFeature
    variant="activity"
    title="通知"
    subtitle="评论、点赞和关注"
    :loading="loading"
    :error="Boolean(error)"
    :error-text="error || '通知加载失败，请稍后重试'"
    :empty="!loading && !error && !items.length"
    empty-text="暂无通知"
    :items="notificationItems"
    @retry="refresh"
    @select="openNotification"
  >
    <template #actions>
      <button type="button" aria-label="刷新通知" :disabled="loading" @click="refresh">
        <i class="fas fa-rotate" :class="{ 'fa-spin': loading }" aria-hidden="true"></i>
      </button>
    </template>

    <template #filters>
      <div class="mobile-notifications-page__tabs" role="tablist" aria-label="通知分类">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          role="tab"
          :aria-selected="currentTab === tab.value"
          :class="{ 'is-active': currentTab === tab.value }"
          @click="switchTab(tab.value)"
        >
          {{ tab.label }}
          <small v-if="notificationStore.categoryCounts[tab.countKey]">{{ notificationStore.categoryCounts[tab.countKey] }}</small>
        </button>
      </div>
    </template>

    <template #footer>
      <div class="mobile-notifications-page__footer">
        <span v-if="items.length && !hasMore">已到底部</span>
        <button v-if="hasMore && items.length" type="button" :disabled="loading" @click="loadMore">
          {{ loading ? '加载中…' : '加载更多' }}
        </button>
        <span v-if="items.length && inlineError">{{ inlineError }}</span>
      </div>
    </template>
  </MobileSocialFeature>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { useNotificationStore } from '../../../stores/notifications';
import MobileSocialFeature from './MobileSocialFeature.vue';
import { getNotificationActor } from '../../../utils/notificationItem';
import {
  getNotificationExternalUrl,
  getNotificationFeedId,
  resolveNotificationTargetRoute,
} from '../../../utils/notificationNavigation';
import { openFeedDetail } from '../../../utils/feedNavigation';
import { getNotificationCategoryCountsFromItems, type NotificationCategory } from '../../../utils/notificationCount';

defineOptions({ name: 'MobileNotificationsPage' });

const router = useRouter();
const notificationStore = useNotificationStore();
const tabs: Array<{ label: string; value: string; countKey: NotificationCategory }> = [
  { label: '评论回复', value: 'list', countKey: 'comment' },
  { label: '@ 提及', value: 'atMeList', countKey: 'atMe' },
  { label: '评论 @', value: 'atCommentMeList', countKey: 'atComment' },
  { label: '收到的赞', value: 'feedLikeList', countKey: 'like' },
  { label: '新关注', value: 'contactsFollowList', countKey: 'follow' },
];
const currentTab = ref('list');
const items = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);
const error = ref('');
const inlineError = ref('');
let requestId = 0;

const notificationItems = computed(() => items.value.map((item, index) => {
  const actor = getNotificationActor(item, currentCategory());
  const message = stripHtml(item.message || item.replyRows?.[0]?.message || item.feedInfo?.message || '');
  const note = stripHtml(item.note || item.message_title || item.feedInfo?.message_title || (currentTab.value === 'feedLikeList' ? '赞了你的动态' : ''));
  return {
    key: notificationKey(item, index),
    id: item.id || item.entityId,
    title: actor.username === '酷友' ? String(item.messageUserInfo?.username || '匿名用户') : actor.username,
    subtitle: [note, message, stripHtml(item.targetTitle || item.feedInfo?.title || '')].filter(Boolean).join(' · ') || '查看通知详情',
    avatar: actor.avatar || item.messageUserInfo?.userAvatar || '',
    time: formatTime(item.likeTime || item.dateline),
    badge: unreadCount(item) || undefined,
    tone: currentCategory() === 'follow' ? ('green' as const) : ('blue' as const),
    raw: item,
  };
}));

function payload(response: any): any { return response?.data ?? response; }
function stripHtml(value: unknown): string { return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function formatTime(value: unknown): string {
  if (!value) return '';
  const numeric = Number(value);
  const date = new Date(Number.isFinite(numeric) ? numeric * (numeric < 10_000_000_000 ? 1000 : 1) : String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function currentCategory(): NotificationCategory { return tabs.find((tab) => tab.value === currentTab.value)?.countKey || 'comment'; }
function notificationKey(item: any, index: number): string { return `${currentTab.value}:${item.id || item.entityId || item.targetId || `${item.fromuid || ''}-${item.dateline || index}`}`; }
function unreadCount(item: any): number { return Math.max(0, Number(item.unread_count ?? item.unreadCount ?? item.isnew ?? item.isNew ?? 0) || 0); }

async function fetchNotifications(reset = false): Promise<void> {
  if (loading.value) return;
  if (!reset && !hasMore.value) return;
  if (reset) { page.value = 1; hasMore.value = true; items.value = []; }
  const request = ++requestId;
  loading.value = true;
  if (page.value === 1) error.value = ''; else inlineError.value = '';
  const requestedPage = page.value;
  try {
    const response = await CoolapkTauriAPI.getNotifications(currentTab.value, requestedPage);
    if (request !== requestId) return;
    const rows = Array.isArray(payload(response)) ? payload(response) : [];
    for (const [category, count] of Object.entries(getNotificationCategoryCountsFromItems(rows)) as Array<[NotificationCategory, number]>) notificationStore.applyCategoryCount(category, count);
    const existing = new Set(items.value.map((item, index) => notificationKey(item, index)));
    const incoming = rows.filter((item: any, index: number) => !existing.has(notificationKey(item, index)));
    items.value = [...items.value, ...incoming];
    page.value = requestedPage + 1;
    hasMore.value = rows.length > 0 && incoming.length > 0;
    if (requestedPage === 1 && rows.length) notificationStore.markCategoryViewed(currentCategory());
  } catch (reason) {
    if (request !== requestId) return;
    const message = reason instanceof Error ? reason.message : '通知加载失败';
    if (requestedPage === 1) error.value = message; else inlineError.value = message;
  } finally { if (request === requestId) loading.value = false; }
}

function refresh(): void { void fetchNotifications(true); }
function loadMore(): void { void fetchNotifications(false); }
function switchTab(tab: string): void { if (currentTab.value !== tab) { currentTab.value = tab; void fetchNotifications(true); } }

async function openNotification(item: any): Promise<void> {
  const raw = item?.raw || item;
  const externalUrl = getNotificationExternalUrl(raw);
  if (externalUrl) { void CoolapkTauriAPI.openUrl(externalUrl, 'system'); return; }
  const feedId = getNotificationFeedId(raw);
  if (feedId) { openFeedDetail(router, feedId, raw); return; }
  const routePath = await resolveNotificationTargetRoute(raw, (name) => CoolapkTauriAPI.getProductDetailByName(name));
  if (routePath) { void router.push(routePath); return; }
  const actorUid = String(raw.fromuid || raw.uid || raw.likeUid || raw.userInfo?.uid || '').trim();
  if (actorUid) void router.push(`/user/${encodeURIComponent(actorUid)}`);
}

onMounted(() => void fetchNotifications(true));
</script>

<style scoped>
.mobile-notifications-page__tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
.mobile-notifications-page__tabs::-webkit-scrollbar { display: none; }
.mobile-notifications-page__tabs button { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; min-height: 38px; padding: 0 12px; border: 0; border-radius: 999px; background: #f2f2f6; color: #85878d; font: inherit; font-size: 13px; }
.mobile-notifications-page__tabs button.is-active { background: #e5f7ee; color: #0f9d58; font-weight: 700; }
.mobile-notifications-page__tabs small { min-width: 16px; padding: 1px 4px; border-radius: 999px; background: #e3483b; color: #fff; font-size: 10px; }
.mobile-notifications-page__footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; color: #85878d; font-size: 12px; }
.mobile-notifications-page__footer button { min-height: 36px; padding: 0 18px; border: 1px solid #0f9d58; border-radius: 999px; background: #fff; color: #0f9d58; font: inherit; }
</style>
