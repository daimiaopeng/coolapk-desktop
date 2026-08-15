<template>
    <article
      :class="['feed-card', { 'is-detail-mode': detailMode }]"
      :data-feed-id="feed.id"
      :data-feed-text="feed.message || feed.message_raw_output || ''"
      :data-feed-images="JSON.stringify(feedImages)"
      @click="handleCardClick"
    >
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

    <FeedImageGrid :images="feedImages" />

    <!-- 1. 被回复/转发的原动态 -->
    <!-- 1. 被回复/转发的原动态 -->
    <div
      v-if="isTargetFeed && targetRow"
      class="quoted-feed-box"
      @click.stop="openQuotedFeed"
    >
      <div class="quoted-header" v-if="quotedAuthor">
        <span class="quoted-author">@{{ quotedAuthor }}</span>
      </div>
      <div
        class="quoted-message"
        v-html="formattedQuotedMessage"
      ></div>
      <FeedImageGrid 
        v-if="quotedImages.length" 
        :images="quotedImages" 
        variant="comment"
      />
    </div>

    <!-- 2. 关联的标的卡片（如机型“华为Pura70 Pro+”、应用、话题） -->
    <div v-else-if="isTargetObject && targetRow" class="feed-target-wrapper">
      <div
        class="feed-target-chip"
        @click.stop="openTarget"
        :title="targetRow.title || targetRow.name"
      >
        <div class="target-chip-media" v-if="targetRow.logo || targetRow.pic">
          <AppImage
            :src="targetRow.logo || targetRow.pic"
            :alt="targetRow.title"
            image-class="target-chip-logo"
            fit="contain"
          />
        </div>
        <div v-else class="target-chip-icon">
          <i :class="targetIconClass"></i>
        </div>
        <div class="target-chip-text">
          <span class="target-chip-title">{{ targetRow.title || targetRow.name }}</span>
          <span v-if="targetRow.subTitle || targetRow.subtitle" class="target-chip-subtitle">
            {{ targetRow.subTitle || targetRow.subtitle }}
          </span>
        </div>
        <i class="fas fa-chevron-right target-chip-arrow"></i>
      </div>
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
        :error="commentsError"
        :normalize-img="normalizeImg"
        :format-rich-text="formatRichText"
        @delete-comment="removeComment"
        @retry-comments="openComments"
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
import AppImage from '../common/AppImage.vue';
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

const feedImages = computed<string[]>(() => {
  const raw = props.feed.pics || props.feed.picArr || (props.feed.pic ? [props.feed.pic] : []);
  if (Array.isArray(raw)) return raw.filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === 'string' && url.trim().length > 0) : [raw];
    } catch {
      return [raw];
    }
  }
  return [];
});

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

const targetRow = computed<any>(() =>
  props.feed.targetRow ||
  (props.feed as any).targetFeed ||
  (props.feed as any).replyFeed ||
  (props.feed as any).feedInfo ||
  (props.feed as any).feed ||
  null
);

const isTargetFeed = computed(() => {
  const target = targetRow.value;
  if (!target) return false;
  const type = String(target.entityType || target.type || '').toLowerCase();
  if (type === 'feed' || type === 'feed_reply' || type === 'feedreply' || type === 'article') return true;
  if (Boolean((props.feed as any).replyFeed || (props.feed as any).feedInfo || (props.feed as any).feed)) return true;
  return Boolean((target.username || target.userName || target.userInfo?.username) && (target.message || target.content) && !target.title);
});

const isTargetObject = computed(() => {
  if (isTargetFeed.value) return false;
  const target = targetRow.value;
  if (!target) return false;
  return Boolean(target.title || target.name || target.subTitle || target.logo || target.pic || target.id);
});

const quotedAuthor = computed(() => {
  const t = targetRow.value;
  if (!t) return '';
  return t.username || t.userName || t.displayUserName || t.userInfo?.username || '';
});

const formattedQuotedMessage = computed(() => {
  const t = targetRow.value;
  if (!t) return '原动态内容';
  const text = t.message || t.content || t.text || t.title || '原动态内容';
  return renderCoolapkRichText(text);
});

const quotedImages = computed<string[]>(() => {
  const t = targetRow.value;
  if (!t) return [];
  const raw = t.pics || t.picArr || (t.pic ? [t.pic] : []) || (t.xsPic ? [t.xsPic] : []);
  const list = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw.trim().length > 0 ? [raw] : []);
  return list
    .map((u: string) => {
      if (typeof u !== 'string') return '';
      const trimmed = u.trim();
      if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
      if (trimmed.startsWith('http') || trimmed.startsWith('//') || trimmed.startsWith('data:')) return trimmed;
      return `https://image.coolapk.com/${trimmed.replace(/^\/+/, '')}`;
    })
    .filter((u): u is string => Boolean(u && u.length > 5));
});

const targetIconClass = computed(() => {
  const target = targetRow.value;
  if (!target) return 'fas fa-tag';
  const type = String(target.entityType || target.type || '').toLowerCase();
  const title = String(target.title || target.name || '').toLowerCase();
  if (type.includes('product') || type.includes('device') || title.includes('pro') || title.includes('ultra') || title.includes('phone') || title.includes('mate') || title.includes('pura')) return 'fas fa-mobile-screen';
  if (type.includes('apk') || type.includes('app')) return 'fas fa-cubes';
  if (type.includes('topic') || type.includes('node') || type.includes('tag') || title.includes('os') || title.includes('ui')) return 'fas fa-hashtag';
  if (type.includes('goods') || type.includes('mall')) return 'fas fa-bag-shopping';
  return 'fas fa-tag';
});

function openTarget() {
  const target = targetRow.value;
  if (!target) return;
  if (typeof target.url === 'string' && target.url) {
    if (target.url.startsWith('/')) {
      void router.push(target.url);
    } else {
      void CoolapkTauriAPI.openUrl(target.url);
    }
    return;
  }
  const type = String(target.entityType || target.type || '').toLowerCase();
  const id = target.id || target.entityId || target.target_id;
  if (id) {
    if (type.includes('apk') || type.includes('app')) {
      void router.push(`/apk/${id}`);
    } else if (type.includes('topic') || type.includes('node')) {
      void router.push(`/topic/${id}`);
    } else if (type.includes('product')) {
      void router.push(`/product/${id}`);
    }
  }
}

function openQuotedFeed() {
  const target = targetRow.value;
  const feedId = target?.id || target?.feed_id || target?.entityId || props.feed.replyRows?.[0]?.id;
  if (feedId) {
    void router.push(`/feed/${feedId}`);
  }
}

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
const commentsError = ref('');
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
  commentsError.value = '';
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
          throw allResult.reason || hotResult.reason;
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
      commentsError.value = err instanceof Error ? err.message : String(err);
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
    commentsError.value = '';
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
  padding: var(--feed-card-padding, 16px) 18px;
  margin-bottom: var(--feed-card-gap, 12px);
  transition: background-color 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}

.feed-card:hover {
  background-color: var(--surface);
  border-color: var(--border);
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
  border-radius: 8px;
  padding: 10px 14px;
  margin: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.quoted-feed-box:hover {
  background: var(--surface-hover, rgba(0, 0, 0, 0.05));
  border-color: var(--border);
}

.quoted-author {
  font-weight: 600;
  color: var(--brand-primary, #10b981);
}

.quoted-message {
  color: var(--text-secondary);
  line-height: 1.55;
  font-size: 13.5px;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.quoted-message :deep(a) {
  color: var(--brand-primary, #10b981);
  font-weight: 500;
  text-decoration: none;
  padding: 0 2px;
}

.quoted-message :deep(a):hover {
  text-decoration: underline;
}

.quoted-message :deep(.coolapk-emoji) {
  display: inline-block;
  vertical-align: -3px;
  width: 18px;
  height: 18px;
  margin: 0 2px;
}

/* 标的卡片（如机型“华为Pura70 Pro+”、产品、话题、应用等）精致胶囊 */
.feed-target-wrapper {
  display: block;
  width: 100%;
  margin: 6px 0 8px 0;
}

.feed-target-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  width: fit-content;
  height: 30px;
  padding: 0 10px 0 5px;
  border-radius: 15px;
  background: var(--background-secondary, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-sizing: border-box;
}

.feed-target-chip:hover {
  background: var(--surface-hover, var(--background-secondary));
  border-color: rgba(16, 185, 129, 0.35);
  transform: translateY(-1px);
}

.target-chip-media {
  width: 20px;
  height: 20px;
  min-width: 20px;
  max-width: 20px;
  min-height: 20px;
  max-height: 20px;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.target-chip-logo {
  width: 20px !important;
  height: 20px !important;
  border-radius: 4px;
  background: transparent !important;
}

.target-chip-logo :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.target-chip-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  font-size: 11px;
  flex-shrink: 0;
}

.target-chip-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.target-chip-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}

.target-chip-subtitle {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.target-chip-arrow {
  font-size: 10px;
  color: var(--text-tertiary);
  opacity: 0.5;
  margin-left: 2px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.feed-target-chip:hover .target-chip-arrow {
  transform: translateX(2px);
  color: #10b981;
  opacity: 1;
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
