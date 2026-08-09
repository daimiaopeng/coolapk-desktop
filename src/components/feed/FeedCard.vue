<template>
  <article :class="['feed-card', { 'is-detail-mode': detailMode }]" @click="handleCardClick">
    <FeedHeader
      :uid="feed.uid || feed.userInfo?.uid"
      :avatar="feed.userAvatar || feed.userInfo?.userAvatar || feed.pic"
      :username="feed.username || feed.userInfo?.username"
      :level="feed.userInfo?.level || feed.level"
      :verify-title="feed.userInfo?.verify_title || feed.verifyTitle"
      :dateline="feed.dateline || feed.infoHtml"
      :device="feed.device_title || feed.deviceTitle"
      :rank-index="rankIndex"
      :recommend-source="feed.recommendSource || feed.targetType"
      :show-device-info="showDeviceInfo"
      :entity-type="feed.entityType"
      :entity-id="feed.entityId || feed.id"
      :is-edited="isEdited"
      @more="toggleMoreMenu"
      @edit-history="openHistoryDialog"
    />

    <div v-if="moreMenuOpen" class="more-menu-backdrop" @click.stop="moreMenuOpen = false"></div>
    <div v-if="moreMenuOpen" class="more-menu" @click.stop>
      <button v-if="isMyFeed" class="more-menu-item is-danger" @click="handleDeleteFeed">
        <i class="fas fa-trash-alt"></i> 删除动态
      </button>
    </div>

    <FeedContent
      :feed-id="feed.id"
      :title="feed.title"
      :message="feed.message || feed.message_raw_output"
      :username="feed.username || feed.userInfo?.username"
      :force-expanded="detailMode"
    />

    <FeedImageGrid :images="feed.pics || feed.picArr || (feed.pic ? [feed.pic] : [])" />

    <!-- 被回复的原动态 / 被引用的卡片预览 -->
    <div v-if="feed.targetRow || feed.replyRows?.length" class="quoted-feed-box">
      <div class="quoted-header" v-if="feed.targetRow?.username || feed.targetRow?.userInfo?.username">
        <span class="quoted-author">@{{ feed.targetRow?.username || feed.targetRow?.userInfo?.username }}</span>
      </div>
      <div class="quoted-message">
        {{ feed.targetRow?.message || feed.targetRow?.title || feed.replyRows?.[0]?.message || '原动态内容' }}
      </div>
      <FeedImageGrid 
        v-if="feed.targetRow?.pics || feed.targetRow?.pic" 
        :images="feed.targetRow?.pics || (feed.targetRow?.pic ? [feed.targetRow?.pic] : [])" 
      />
    </div>

    <FeedActionBar
      :feed-id="feed.id"
      :likenum="feed.likenum"
      :replynum="feed.replynum"
      :favnum="favnum"
      :sharenum="feed.sharenum"
      :user-action="feed.userAction"
      @open-comment="toggleComments"
      @toggle-fav="toggleFav"
      @forward="openForwardDialog"
    />

    <div v-if="showComments" class="inline-comment-wrapper" @click.stop>
      <FeedCommentSection
        :feed-id="feed.id"
        :feed-uid="feed.uid || feed.userInfo?.uid"
        :feed-username="feed.username"
        :comments="comments"
        :loading="commentsLoading"
        :normalize-img="normalizeImg"
        :format-rich-text="formatRichText"
        @delete-comment="removeComment"
      />
    </div>

    <ForwardDialog v-model:show="forwardOpen" :feed="feed" @success="handleForwardSuccess" />

    <AppDialog :is-open="historyDialogOpen" title="编辑记录" :width="680" @close="historyDialogOpen = false">
      <div class="history-dialog" @click.stop>
        <p class="history-description">动态每次修改的内容都会保留，当前版本显示在最上方。</p>
        <LoadingState v-if="historyLoading" text="正在加载编辑记录..." />
        <div v-else-if="historyError" class="history-status">
          <span>{{ historyError }}</span>
          <button type="button" @click="loadHistory">重试</button>
        </div>
        <div v-else-if="!historyList.length" class="history-status">暂无编辑记录</div>
        <div v-else class="history-list">
          <article v-for="(item, index) in historyList" :key="item.entityId || item.id || item.dateline || index" class="history-item">
            <div class="history-version-row">
              <span :class="['history-version', { 'is-current': isCurrentHistory(item, index) }]">
                {{ formatHistoryVersion(item, index) }}
              </span>
              <time class="history-time">{{ formatHistoryDate(item) }}</time>
            </div>
            <h4 v-if="getHistoryTitle(item)" class="history-title">{{ getHistoryTitle(item) }}</h4>
            <div class="history-text" v-html="formatHistoryHtml(item)"></div>
            <FeedImageGrid :images="getHistoryImages(item)" />
          </article>
        </div>
      </div>
    </AppDialog>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { FeedItem } from '../../types/feed';
import FeedHeader from './FeedHeader.vue';
import FeedContent from './FeedContent.vue';
import FeedImageGrid from './FeedImageGrid.vue';
import FeedActionBar from './FeedActionBar.vue';
import FeedCommentSection from './FeedCommentSection.vue';
import ForwardDialog from '../overlays/ForwardDialog.vue';
import LoadingState from '../common/LoadingState.vue';
import AppDialog from '../common/AppDialog.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { renderCoolapkRichText } from '../../utils/richText';
import { getReplyData, mergeReplies } from '../../utils/commentList';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { showToast } from '../../utils/toast';
import { requestConfirmation } from '../../utils/confirm';
import { getErrorMessage } from '../../utils/errors';

const settingsStore = useSettingsStore();
const router = useRouter();
const showDeviceInfo = computed(() => settingsStore.settings.showDeviceInfo);

const props = defineProps<{
  feed: FeedItem;
  rankIndex?: number;
  detailMode?: boolean;
  autoOpenComments?: boolean;
}>();

const emit = defineEmits<{
  (e: 'deleted', id: string | number): void;
}>();

const authStore = useAuthStore();

const isMyFeed = computed(() => {
  if (!authStore.isLoggedIn || !authStore.user) return false;
  const feedUid = String(props.feed.uid ?? props.feed.userInfo?.uid ?? '');
  return !!feedUid && feedUid === String(authStore.user.uid);
});

const isEdited = computed(() => {
  const flag = props.feed.isModified ?? props.feed.is_modified;
  if (flag === true || flag === 1 || flag === '1') return true;
  const changeCount = Number(props.feed.changeCount ?? props.feed.change_count ?? 0);
  const lastChangeTime = Number(props.feed.lastChangeTime ?? props.feed.last_change_time ?? 0);
  return changeCount > 0 || lastChangeTime > 0;
});

const forwardOpen = ref(false);
const moreMenuOpen = ref(false);
const historyDialogOpen = ref(false);
const historyLoading = ref(false);
const historyError = ref('');
const historyList = ref<any[]>([]);
const historyLoaded = ref(false);

function openForwardDialog() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  forwardOpen.value = true;
}

function handleForwardSuccess() {
  props.feed.sharenum = (Number(props.feed.sharenum) || 0) + 1;
}

function toggleMoreMenu() {
  if (!isMyFeed.value) return;
  moreMenuOpen.value = !moreMenuOpen.value;
}

async function openHistoryDialog() {
  if (!isEdited.value) return;
  historyDialogOpen.value = true;
  if (!historyLoaded.value) {
    await loadHistory();
  }
}

async function loadHistory() {
  historyLoading.value = true;
  historyError.value = '';
  try {
    const response: any = await CoolapkTauriAPI.getFeedChangeHistory(String(props.feed.id));
    historyList.value = Array.isArray(response?.data) ? response.data : [];
    historyLoaded.value = true;
  } catch (error) {
    console.warn('加载动态编辑记录失败：', error);
    historyError.value = '编辑记录加载失败';
  } finally {
    historyLoading.value = false;
  }
}

function formatHistoryDate(item: any): string {
  const value = item?.last_change_time || item?.lastChangeTime || item?.date || item?.dateline || item?.createTime || item?.create_time;
  if (!value) return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const date = new Date(number > 9_999_999_999 ? number : number * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { hour12: false });
}

function isCurrentHistory(item: any, index: number): boolean {
  return index === 0 && Number(item?.isHistory ?? item?.is_history ?? 0) === 0;
}

function formatHistoryVersion(item: any, index: number): string {
  if (isCurrentHistory(item, index)) return '当前版本';
  const changeCount = Number(item?.change_count ?? item?.changeCount ?? 0);
  return changeCount > 0 ? `第 ${changeCount} 次编辑` : '原始版本';
}

function getHistoryTitle(item: any): string {
  return String(item?.message_title || item?.title || '').trim();
}

function formatHistoryContent(item: any): string {
  if (!item || typeof item !== 'object') return '（无详细内容）';
  return item.message
    || item.content
    || item.text
    || item.change_content
    || item.description
    || (item.title ? `标题：${item.title}` : '')
    || '（无详细内容）';
}

function formatHistoryHtml(item: any): string {
  return renderCoolapkRichText(formatHistoryContent(item));
}

function getHistoryImages(item: any): string[] {
  if (Array.isArray(item?.picArr)) return item.picArr;
  if (Array.isArray(item?.pics)) return item.pics;
  return item?.pic ? [item.pic] : [];
}

async function handleDeleteFeed() {
  const confirmed = await requestConfirmation({
    title: '删除动态',
    message: '确定要删除这条动态吗？删除后无法恢复。',
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;
  moreMenuOpen.value = false;
  try {
    const res = await CoolapkTauriAPI.deleteFeed(String(props.feed.id));
    if (res && res.code === 200) {
      showToast('动态已删除');
      emit('deleted', props.feed.id);
    } else {
      showToast(res?.message || '删除动态失败', 'error');
    }
  } catch (err: any) {
    showToast(getErrorMessage(err, '删除动态失败'), 'error');
  }
}

function removeComment(id: string | number) {
  comments.value = comments.value.filter((c: any) => String(c.id) !== String(id));
}

const isFav = ref(props.feed.userAction?.favorite === 1);
const favnum = ref(props.feed.favnum || 0);

const showComments = ref(false);
const comments = ref<any[]>([]);
const commentsLoading = ref(false);
let commentsRequestVersion = 0;

async function toggleFav() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const id = String(props.feed.id);
  const target = !isFav.value;
  isFav.value = target;
  favnum.value = Math.max(0, favnum.value + (target ? 1 : -1));
  try {
    if (target) {
      await CoolapkTauriAPI.favoriteFeed(id);
    } else {
      await CoolapkTauriAPI.unfavoriteFeed(id);
    }
  } catch (err) {
    isFav.value = !target;
    favnum.value = Math.max(0, favnum.value + (target ? -1 : 1));
    console.warn('Failed to toggle favorite', err);
  }
}

async function openComments() {
  showComments.value = true;
  if (comments.value.length === 0) {
    const requestedFeedId = String(props.feed.id || '');
    if (!requestedFeedId) return;
    const currentRequest = ++commentsRequestVersion;
    commentsLoading.value = true;
    try {
      let loadedComments: any[] = [];
      if (settingsStore.settings.commentSort === 'hot') {
        // 热门接口只返回部分评论，因此同时加载完整评论并合并，热门评论仍排在前面。
        const [hotResult, allResult] = await Promise.allSettled([
          CoolapkTauriAPI.getHotReplies(requestedFeedId, 1),
          CoolapkTauriAPI.getFeedReplies(requestedFeedId, 1),
        ]);
        const hotReplies = hotResult.status === 'fulfilled' ? getReplyData(hotResult.value) : [];
        const allReplies = allResult.status === 'fulfilled' ? getReplyData(allResult.value) : [];
        loadedComments = mergeReplies(hotReplies, allReplies);

        if (hotResult.status === 'rejected' && allResult.status === 'rejected') {
          throw allResult.reason;
        }
      } else {
        loadedComments = getReplyData(await CoolapkTauriAPI.getFeedReplies(requestedFeedId, 1));
      }
      if (
        currentRequest === commentsRequestVersion
        && requestedFeedId === String(props.feed.id || '')
      ) {
        comments.value = loadedComments;
      }
    } catch (err) {
      console.error('Failed to load comments', err);
    } finally {
      if (currentRequest === commentsRequestVersion) commentsLoading.value = false;
    }
  }
}

async function toggleComments() {
  if (showComments.value) {
    showComments.value = false;
    return;
  }
  await openComments();
}

watch(
  () => props.autoOpenComments,
  (shouldOpen) => {
    // 完整动态准备好后再自动加载评论，不让摘要阶段的空请求抢先完成。
    if (shouldOpen) void openComments();
  },
  { immediate: true }
);

watch(
  () => String(props.feed.id || ''),
  (nextFeedId, previousFeedId) => {
    if (nextFeedId === previousFeedId) return;
    commentsRequestVersion += 1;
    comments.value = [];
    commentsLoading.value = false;
    if (props.autoOpenComments) void openComments();
  }
);

function handleCardClick(e: MouseEvent) {
  if (props.detailMode) return;
  const target = e.target as HTMLElement;
  if (target.closest('a') || target.closest('button') || target.closest('.grid-item') || target.closest('.inline-comment-wrapper')) {
    return;
  }

  const entityType = props.feed.entityType;
  if (entityType === 'product') {
    const productId = props.feed.entityId || props.feed.id;
    if (productId) {
      router.push(`/product/${productId}`);
      return;
    }
  }
  if (entityType === 'dyh') {
    const dyhId = props.feed.entityId || props.feed.id;
    if (dyhId) {
      router.push(`/dyh/${dyhId}`);
      return;
    }
  }
  if (entityType === 'album') {
    const albumId = props.feed.entityId || props.feed.id;
    if (albumId) {
      router.push(`/album/${albumId}`);
      return;
    }
  }

  toggleComments();
}

function normalizeImg(url: string) {
  return url;
}

function formatRichText(text: string) {
  if (!text) return '';
  return renderCoolapkRichText(text);
}
</script>

<style scoped>
.feed-card {
  position: relative;
  background-color: var(--surface);
  border-radius: var(--radius-card, 14px);
  border: 1px solid var(--border);
  padding: 16px 18px;
  margin-bottom: var(--feed-card-gap, 12px);
  transition: background-color 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}

.feed-card:hover {
  background-color: var(--surface-hover);
  border-color: var(--border-dark, rgba(0, 0, 0, 0.12));
}

.feed-card.is-detail-mode {
  cursor: default;
}

.feed-card.is-detail-mode:hover {
  background-color: var(--surface);
  border-color: var(--border);
}

.quoted-feed-box {
  background: var(--background-secondary, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  border-left: 3px solid var(--brand-primary, #10b981);
  border-radius: 10px;
  padding: 10px 14px;
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.quoted-feed-box:hover {
  background: var(--surface-hover, rgba(0, 0, 0, 0.05));
}

.quoted-author {
  font-weight: 600;
  color: var(--brand-primary, #10b981);
}

.quoted-message {
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.inline-comment-wrapper {
  margin-top: 12px;
  border-top: 1px solid var(--border-light);
  padding-top: 4px;
  cursor: default;
}

.history-dialog {
  min-height: 160px;
  cursor: default;
}

.history-description {
  margin: 0 0 18px;
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.history-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-left: 20px;
}

.history-list::before {
  content: '';
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 5px;
  width: 1px;
  background-color: var(--border);
}

.history-item {
  position: relative;
  padding: 14px 16px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-control);
  background-color: var(--background-secondary);
}

.history-item::before {
  content: '';
  position: absolute;
  top: 18px;
  left: -20px;
  width: 11px;
  height: 11px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background-color: var(--text-tertiary);
  box-shadow: 0 0 0 1px var(--border);
}

.history-item:first-child::before {
  background-color: var(--brand-primary);
}

.history-version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}

.history-version {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.history-version.is-current {
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.history-time {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.history-title {
  margin: 0 0 6px;
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  line-height: 1.5;
}

.history-text {
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.history-text :deep(a) {
  color: var(--brand-primary);
}

.history-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 64px;
  color: var(--text-tertiary);
  font-size: var(--font-size-sub);
}

.history-status button {
  color: var(--brand-primary);
}

.more-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.more-menu {
  position: absolute;
  top: 40px;
  right: 12px;
  z-index: 21;
  min-width: 132px;
  padding: var(--space-1);
  background-color: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  box-shadow: var(--shadow-dropdown);
  display: flex;
  flex-direction: column;
}

.more-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  text-align: left;
  transition: background-color var(--duration-fast) var(--ease-default);
}

.more-menu-item:hover {
  background-color: var(--surface-hover);
}

.more-menu-item.is-danger {
  color: var(--danger);
}

.more-menu-item.is-danger:hover {
  background-color: var(--danger);
  color: var(--text-inverse);
}
</style>
