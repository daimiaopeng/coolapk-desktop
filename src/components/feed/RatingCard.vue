<template>
  <article ref="cardRef" class="rating-card" @click="handleCardClick">
    <!-- 头部用户信息 -->
    <FeedHeader
      :uid="feed.uid || feed.userInfo?.uid"
      :avatar="feed.userAvatar || feed.userInfo?.userAvatar"
      :plugin-url="(feed.userInfo as any)?.avatar_plugin_url || (feed as any).avatar_plugin_url || (feed as any).userAvatarPluginUrl"
      :username="feed.username || feed.userInfo?.username"
      :level="feed.userInfo?.level"
      :gender="(feed.userInfo as any)?.gender ?? (feed as any).gender"
      :gender-title="(feed.userInfo as any)?.gender_title ?? (feed as any).gender_title ?? (feed.userInfo as any)?.age_group ?? (feed as any).age_group"
      :ip-location="(feed as any).ip_location || (feed as any).ipLocation || (feed as any).location || (feed as any).city || (feed as any).province || (feed.userInfo as any)?.ip_location || (feed.userInfo as any)?.city"
      :verify-title="feed.userInfo?.verify_title"
      :dateline="feed.dateline"
      :device="feed.device_title || feed.target_title"
      :show-device-info="showDeviceInfo"
    />

    <!-- 总体星级与机主评分标签 -->
    <div class="rating-score-banner" v-if="hasOverallRating">
      <span class="owner-badge">
        <i class="fas fa-mobile-alt"></i> {{ isOwnerRating ? '机主评分' : '评分' }}
      </span>
      <div class="star-rating-stars">
        <i 
          v-for="i in 5" 
          :key="i" 
          :class="['fas', 'fa-star', { 'active': i <= starCount }]"
        ></i>
      </div>
      <span class="score-text" v-if="scoreText">{{ scoreText }}</span>
    </div>

    <!-- 多维度参数打分项列表 (续航、影像、性能、屏幕等) -->
    <div class="rating-dimensions-row" v-if="subRatings.length > 0">
      <div v-for="item in subRatings" :key="item.label" class="sub-rating-item">
        <span class="sub-label">{{ item.label }}</span>
        <span class="sub-stars" :aria-label="`${item.score} 星`">
          <i v-for="starIndex in 5" :key="starIndex" :class="['fas', 'fa-star', { active: starIndex <= item.starCount }]" aria-hidden="true"></i>
        </span>
        <span class="sub-score">{{ item.score }}</span>
        <span class="sub-description">{{ item.description }}</span>
      </div>
    </div>

    <span v-if="isFilteredRating" class="filter-rating-badge">不计分</span>

    <!-- 点评正文及维度的结构化评语 -->
    <FeedContent
      :feed-id="feed.id"
      :title="feed.title || feed.message_title || feed.messageTitle"
      :message="displayedRatingMessage"
      :username="feed.username || feed.userInfo?.username"
      :highlight-keyword="highlightKeyword"
    />

    <!-- APK 点评卡把优点、一般、缺点作为独立字段展示，不能只显示 message 摘要。 -->
    <div v-if="ratingComments.length" class="rating-comments">
      <div v-for="item in ratingComments" :key="item.key" class="rating-comment-item">
        <span class="rating-comment-label">{{ item.label }}</span>
        <div class="rating-comment-text" v-html="item.html" @click="handleRatingTextClick"></div>
      </div>
    </div>

    <!-- 点评配图 -->
    <FeedImageGrid
      :images="feedImages"
      :content-id="feed.id"
      content-type="feed"
    />

    <!-- 关联的数码设备卡片盒子 -->
    <div class="target-device-card" v-if="targetProduct">
      <div class="device-thumb">
        <AppImage :src="targetProduct.logo" image-class="device-img" />
      </div>
      <div class="device-info">
        <h4 class="device-title">{{ targetProduct.title }}</h4>
        <p class="device-count" v-if="targetProduct.meta">{{ targetProduct.meta }}</p>
      </div>
      <div class="device-rating-box" v-if="targetProduct.score">
        <span class="big-score">{{ targetProduct.score }}</span>
        <div class="mini-stars">
          <i v-for="i in 5" :key="i" class="fas fa-star active"></i>
        </div>
      </div>
    </div>

    <!-- 底部互动操作栏 -->
    <FeedActionBar
      :feed-id="feed.id"
      :likenum="feed.likenum"
      :replynum="feed.replynum"
      :favnum="favnum"
      :sharenum="feed.sharenum"
      :favorited="isFav"
      :user-action="feed.userAction"
      @open-comment="toggleComments"
      @toggle-fav="toggleFav"
      @open-like-list="openLikeList"
      @open-forward-list="openForwardList"
    />

    <!-- 评论区域折叠展示 -->
    <div v-if="showComments" class="inline-comment-wrapper" @click.stop="touchActiveComments(feed.id)">
      <FeedCommentSection
        :feed-id="feed.id"
        :feed-uid="feed.uid || feed.userInfo?.uid"
        :feed-username="feed.username"
        :default-sort-mode="commentsSortMode"
        :total-comment-count="feed.replynum"
        :comments="comments"
        :loading="commentsLoading"
        :error="commentsError"
        :has-more-comments="hasMoreComments"
        :loading-more-comments="commentsLoadingMore"
        :load-more-error="commentsLoadMoreError"
        :normalize-img="(u) => u"
        :format-rich-text="formatRichText"
        @collapse="handleCollapseComments"
        @retry-comments="loadComments"
        @load-more-comments="loadMoreComments"
        @retry-more-comments="loadMoreComments"
        @comment-sort-change="handleCommentSortChange"
      />
      <!-- 评论区右下角固定悬浮收起按钮（评论滑动时按钮固定在视口右下角纹丝不动） -->
      <Teleport to="body">
        <Transition name="floating-collapse-fade">
          <div
            v-if="isCommentsFloatingVisible"
            class="global-floating-comment-collapse"
            :style="floatingCollapseStyle"
            @click.stop="handleCollapseComments"
          >
            <button
              type="button"
              class="btn-floating-collapse"
              title="收起评论区"
            >
              <i class="fa-solid fa-chevron-up"></i>
              <span>收起评论</span>
            </button>
          </div>
        </Transition>
      </Teleport>
    </div>

    <FeedCollectionPickerDialog
      :is-open="collectionPickerOpen"
      :collections="collectionOptions"
      :selected-ids="collectionInitialSelectedIds"
      :loading="collectionPickerLoading"
      :submitting="collectionPickerSubmitting"
      :allow-empty-selection="favoritePickerOnRemove"
      @close="closeCollectionPicker"
      @confirm="confirmCollectionSelection"
    />

    <FeedInteractionListDialog
      :show="interactionMode !== null"
      :mode="interactionMode || 'likes'"
      :feed-id="feed.id"
      :feed-type="interactionFeedType"
      @update:show="closeInteractionDialog"
    />
  </article>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted, onDeactivated } from 'vue';
import FeedHeader from './FeedHeader.vue';
import FeedContent from './FeedContent.vue';
import FeedImageGrid from './FeedImageGrid.vue';
import FeedActionBar from './FeedActionBar.vue';
import FeedCollectionPickerDialog from './FeedCollectionPickerDialog.vue';
import FeedCommentSection from './FeedCommentSection.vue';
import FeedInteractionListDialog from './FeedInteractionListDialog.vue';
import AppImage from '../common/AppImage.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { renderCoolapkRichText } from '../../utils/richText';
import {
  getCommentReplyRequestOptions,
  getExpectedCommentCount,
  getReplyData,
  getReplyPageCursor,
  hasMoreReplyPages,
  mergeReplies,
  type CommentSortMode,
  type CommentSortSelection,
} from '../../utils/commentList';
import { handleAnchorClick } from '../../utils/anchorClick';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';
import { extractFeedImageInputs } from '../../utils/livePhoto';
import { registerOpenComments, touchActiveComments } from '../../utils/activeCommentTracker';
import { queueFavoriteContentIndexEntry, removeFavoriteContentIndexEntry } from '../../utils/favoriteContentIndex';

const settingsStore = useSettingsStore();
const showDeviceInfo = computed(() => settingsStore.settings.showDeviceInfo);

const props = defineProps<{
  feed: any;
  cloudFavorite?: boolean;
  favoritePickerOnRemove?: boolean;
  highlightKeyword?: string;
}>();

const emit = defineEmits<{
  (event: 'favorite-changed', payload: { id: string | number; favorited: boolean }): void;
}>();

const authStore = useAuthStore();

const isFav = ref(props.cloudFavorite === true || props.feed.userAction?.collect === 1 || props.feed.userAction?.favorite === 1);
const favnum = ref(props.feed.favnum || 0);
const favoritePending = ref(false);
const collectionPickerOpen = ref(false);
const collectionPickerLoading = ref(false);
const collectionPickerSubmitting = ref(false);
const collectionOptions = ref<any[]>([]);
const collectionInitialSelectedIds = ref<string[]>([]);
const interactionMode = ref<'likes' | 'forwards' | null>(null);

const interactionFeedType = computed(() => String(props.feed.feedType || props.feed.feed_type || props.feed.entityType || 'feed'));

const showComments = ref(false);
const comments = ref<any[]>([]);
const commentsLoading = ref(false);
const commentsError = ref('');
const commentsPage = ref(0);
const hasMoreComments = ref(false);
const commentsLoadingMore = ref(false);
const commentsLoadMoreError = ref('');
const commentsSortMode = ref<CommentSortMode>(settingsStore.settings.commentDefaultSortMode);
const commentsAuthorOnly = ref(false);
let commentsFirstItem = '';
let commentsLastItem = '';
let commentsRequestVersion = 0;

async function toggleFav() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (favoritePending.value) return;

  const id = String(props.feed.id);
  const target = !isFav.value;
  const feedType = String(props.feed.entityType || props.feed.feedType || 'feed');
  const trace = String(props.feed.trace || props.feed.extra_key || '');

  if (target || props.favoritePickerOnRemove) {
    await openCollectionPicker(id);
    return;
  }

  favoritePending.value = true;
  try {
    await CoolapkTauriAPI.setFeedCloudFavorite(id, target, feedType, trace);
    isFav.value = target;
    favnum.value = Math.max(0, favnum.value + (target ? 1 : -1));
    if (target) void queueFavoriteContentIndexEntry(authStore.user?.uid || '', props.feed).catch((error) => console.warn('更新收藏正文索引失败:', error));
    else void removeFavoriteContentIndexEntry(authStore.user?.uid || '', id).catch((error) => console.warn('移除收藏正文索引失败:', error));
    showToast(target ? '已收藏到云端' : '已取消云端收藏', 'success');
    emit('favorite-changed', { id: props.feed.id, favorited: target });
  } catch (err) {
    showToast(getErrorMessage(err, target ? '收藏失败' : '取消收藏失败'), 'error');
  } finally {
    favoritePending.value = false;
  }
}

function collectionId(collection: any): string {
  return String(collection?.id ?? collection?.collectionId ?? collection?.entityId ?? '');
}

function isCollectionSelected(collection: any): boolean {
  const value = collection?.isBeCollected ?? collection?.is_be_collected;
  return value === true || value === 1 || value === '1' || value === 'true';
}

async function openCollectionPicker(feedId: string) {
  if (collectionPickerOpen.value || collectionPickerLoading.value) return;
  favoritePending.value = true;
  collectionPickerLoading.value = true;
  try {
    const options = await CoolapkTauriAPI.getFeedCollectionOptions(feedId);
    const validOptions = options.filter((item: any) => collectionId(item));
    if (validOptions.length === 0) {
      throw new Error('酷安未返回可用收藏夹，请先在酷安创建收藏夹');
    }
    collectionOptions.value = validOptions;
    collectionInitialSelectedIds.value = validOptions
      .filter(isCollectionSelected)
      .map(collectionId);
    collectionPickerOpen.value = true;
  } catch (err) {
    showToast(getErrorMessage(err, '加载收藏夹失败'), 'error');
  } finally {
    collectionPickerLoading.value = false;
    favoritePending.value = false;
  }
}

function closeCollectionPicker() {
  if (collectionPickerSubmitting.value) return;
  collectionPickerOpen.value = false;
  collectionOptions.value = [];
  collectionInitialSelectedIds.value = [];
}

function openLikeList() {
  interactionMode.value = 'likes';
}

function openForwardList() {
  interactionMode.value = 'forwards';
}

function closeInteractionDialog(show: boolean) {
  if (!show) interactionMode.value = null;
}

async function confirmCollectionSelection(selectedIds: string[]) {
  if (collectionPickerSubmitting.value) return;
  const ids = Array.from(new Set(selectedIds.filter(Boolean)));
  if (ids.length === 0 && !props.favoritePickerOnRemove) {
    showToast('请至少选择一个收藏夹', 'error');
    return;
  }

  const cancelIds = collectionInitialSelectedIds.value.filter((id) => !ids.includes(id));
  const feedType = String(props.feed.entityType || props.feed.feedType || 'feed');
  const trace = String(props.feed.trace || props.feed.extra_key || '');
  collectionPickerSubmitting.value = true;
  favoritePending.value = true;
  try {
    await CoolapkTauriAPI.updateFeedCloudCollections(
      String(props.feed.id),
      ids.join(','),
      cancelIds.join(','),
      feedType,
      trace,
    );
    const remainsFavorited = ids.length > 0;
    isFav.value = remainsFavorited;
    if (collectionInitialSelectedIds.value.length === 0 && remainsFavorited) favnum.value = Math.max(0, favnum.value + 1);
    else if (collectionInitialSelectedIds.value.length > 0 && !remainsFavorited) favnum.value = Math.max(0, favnum.value - 1);
    if (remainsFavorited) void queueFavoriteContentIndexEntry(authStore.user?.uid || '', props.feed).catch((error) => console.warn('更新收藏正文索引失败:', error));
    else void removeFavoriteContentIndexEntry(authStore.user?.uid || '', props.feed.id).catch((error) => console.warn('移除收藏正文索引失败:', error));
    showToast(remainsFavorited ? '收藏夹已更新' : '已取消全部云端收藏', 'success');
    collectionPickerOpen.value = false;
    emit('favorite-changed', { id: props.feed.id, favorited: remainsFavorited });
  } catch (err) {
    showToast(getErrorMessage(err, '收藏失败'), 'error');
  } finally {
    collectionPickerSubmitting.value = false;
    favoritePending.value = false;
  }
}

function firstValue(source: any, keys: string[]): unknown {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function readText(source: any, keys: string[]): string {
  return textValue(firstValue(source, keys));
}

function toDisplayScore(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return 0;
  if (number <= 5) return number;
  // APK 会把 0～10 分按半星阈值映射到 0～5 星，不能直接除以 2。
  if (number >= 9.2) return 5;
  if (number >= 8.4) return 4.5;
  if (number >= 7.6) return 4;
  if (number >= 6.8) return 3.5;
  if (number >= 6) return 3;
  if (number >= 5) return 2.5;
  if (number >= 4) return 2;
  if (number >= 3) return 1.5;
  return 1;
}

function ratingDescription(score: number): string {
  const rounded = Math.round(score);
  if (rounded >= 5) return '非常好';
  if (rounded === 4) return '不错';
  if (rounded === 3) return '一般';
  if (rounded === 2) return '较差';
  return '很差';
}

function ratingFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

const ratingMessage = computed(() => readText(props.feed, [
  'message',
  'message_raw_output',
  'messageRawOutput',
  'content',
  'text',
]));

const overallScore = computed(() => toDisplayScore(firstValue(props.feed, [
  'rating_score',
  'ratingScore',
  'star',
  'score',
])));

const starCount = computed(() => Math.floor(overallScore.value));
const hasOverallRating = computed(() => overallScore.value > 0);
const isOwnerRating = computed(() => ratingFlag(firstValue(props.feed, ['is_owner', 'isOwner', 'show_owner', 'showOwner'])));
const isFilteredRating = computed(() => ratingFlag(firstValue(props.feed, ['filter_rating', 'filterRating'])));

const scoreText = computed(() => {
  const explicit = readText(props.feed, ['score_title', 'scoreTitle', 'rating_score_title', 'ratingScoreTitle']);
  return explicit || (hasOverallRating.value ? ratingDescription(overallScore.value) : '');
});

function parseRatingItems(value: unknown): any[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  const object = parsed as Record<string, unknown>;
  const nested = object.items || object.data || object.list;
  if (Array.isArray(nested)) return nested;
  const hasItemShape = ['name', 'title', 'label', 'item_name', 'itemName'].some((key) => object[key] !== undefined)
    && ['star', 'score', 'v4_score', 'v4Score', 'rating', 'value'].some((key) => object[key] !== undefined);
  if (hasItemShape) return [object];
  return Object.entries(object).map(([label, score]) => ({ label, score }));
}

function getRatingItemDescription(item: any, score: number): string {
  const rawDescription = firstValue(item, ['star_desc', 'starDesc']);
  if (Array.isArray(rawDescription)) {
    const description = textValue(rawDescription[Math.max(0, Math.round(score) - 1)]);
    return description || ratingDescription(score);
  }
  return textValue(rawDescription) || readText(item, ['description', 'desc']) || ratingDescription(score);
}

function getRatingItemScore(item: any): number {
  const rawV4Score = firstValue(item, ['v4_score', 'v4Score']);
  if (rawV4Score !== undefined) {
    const score = Number(rawV4Score);
    return Number.isFinite(score) && score > 0 ? Math.min(5, score / 2) : 0;
  }
  return toDisplayScore(firstValue(item, ['star', 'score', 'rating', 'value']));
}

// APK 只展示接口实际返回的 rating_item_info，不为缺失的维度补造评分。
const subRatings = computed(() => {
  const raw = firstValue(props.feed, ['rating_item_info', 'ratingItemInfo', 'rating_info', 'ratingInfo', 'sub_scores', 'subScores']);
  const items = parseRatingItems(raw);
  return items.map((item: any, index) => {
    const label = readText(item, ['name', 'title', 'label', 'item_name', 'itemName']) || `评分${index + 1}`;
    const score = getRatingItemScore(item);
    if (score <= 0) return null;
    return {
      label,
      score: Number.isInteger(score) ? String(score) : score.toFixed(1),
      starCount: Math.floor(score),
      description: getRatingItemDescription(item, score),
    };
  }).filter(Boolean) as Array<{ label: string; score: string; starCount: number; description: string }>;
});

function parseV4RatingEntries(value: unknown): Array<{ label: string; value: string }> {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  return Object.entries(parsed)
    .map(([label, entry]) => ({ label: label.trim(), value: textValue(entry) }))
    .filter((item) => item.label && item.value);
}

const ratingComments = computed(() => {
  const v4Entries = parseV4RatingEntries(firstValue(props.feed, ['v4_rating_message', 'v4RatingMessage']));
  if (v4Entries.length > 0) {
    return v4Entries.map((item, index) => ({ key: `v4-${index}-${item.label}`, label: item.label, value: item.value, html: renderCoolapkRichText(item.value) }));
  }

  const addition = readText(props.feed, ['comment_addition', 'commentAddition']);
  const good = readText(props.feed, ['comment_good', 'commentGood']);
  const bad = readText(props.feed, ['comment_bad', 'commentBad']);
  const general = readText(props.feed, ['comment_general', 'commentGeneral']);
  const generalLabel = good ? '总评' : bad ? '总评' : '点评';
  return [
    { key: 'addition', label: '对象', value: addition },
    { key: 'good', label: '优点', value: good },
    { key: 'bad', label: '缺点', value: bad },
    { key: 'general', label: generalLabel, value: general },
  ].filter((item) => item.value).map((item) => ({ ...item, html: renderCoolapkRichText(item.value) }));
});

const displayedRatingMessage = computed(() => ratingComments.value.length > 0 ? '' : ratingMessage.value);

function splitRatingImageValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => splitRatingImageValues(item));
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const feedImages = computed(() => {
  const directImages = extractFeedImageInputs(props.feed);
  const rawV4 = firstValue(props.feed, ['v4_rating_message', 'v4RatingMessage']);
  const rawItems = firstValue(props.feed, ['rating_item_info', 'ratingItemInfo']);
  const hasApkRatingDetails = Boolean(textValue(rawV4)) || parseRatingItems(rawItems).length > 0;
  if (hasApkRatingDetails) return directImages;
  // APK 在没有 v4 评分明细时，会把三个 comment_*_pic 字段合并到点评图片区域。
  const commentImages = [
    firstValue(props.feed, ['comment_good_pic', 'commentGoodPic']),
    firstValue(props.feed, ['comment_bad_pic', 'commentBadPic']),
    firstValue(props.feed, ['comment_general_pic', 'commentGeneralPic']),
  ].flatMap(splitRatingImageValues);
  return commentImages.length > 0 ? commentImages : directImages;
});

const targetProduct = computed(() => {
  const rawTarget = firstValue(props.feed, ['targetRow', 'target_row']);
  const target = rawTarget && typeof rawTarget === 'object' ? rawTarget as any : null;
  const title = readText(target, ['title', 'name', 'device_title', 'deviceTitle']) || readText(props.feed, ['target_title', 'targetTitle']);
  if (!title) return null;
  const commentCount = readText(target, ['comment_num', 'commentNum', 'comment_count', 'commentCount']) || readText(props.feed, ['target_comment_count', 'targetCommentCount']);
  const hotNum = readText(target, ['hot_num', 'hotNum']) || readText(props.feed, ['target_hot_num', 'targetHotNum']);
  const discussionCount = readText(target, ['discussion_num', 'discussionNum', 'discussion_count', 'discussionCount']);
  return {
    title,
    logo: readText(target, ['recommendLogo', 'recommend_logo', 'logo', 'pic', 'tpic']) || readText(props.feed, ['target_pic', 'targetPic', 'pic']),
    score: readText(target, ['score', 'rating_score', 'ratingScore', 'rating', 'ratingAverageScore']) || readText(props.feed, ['target_score', 'targetScore']),
    meta: [
      commentCount ? `${commentCount} 人点评` : '',
      hotNum ? `${hotNum} 热度` : '',
      discussionCount ? `${discussionCount} 讨论` : '',
    ].filter(Boolean).join(' · '),
  };
});

function handleRatingTextClick(event: Event) {
  handleAnchorClick(event, props.feed.id);
}

const cardRef = ref<HTMLElement | null>(null);
const isCommentsFloatingVisible = ref(false);
const floatingCollapseStyle = ref<{ bottom: string; right: string }>({ bottom: '32px', right: '32px' });

function updateFloatingCollapse() {
  if (!showComments.value || !cardRef.value || !comments.value.length) {
    isCommentsFloatingVisible.value = false;
    return;
  }
  const rect = cardRef.value.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  const windowWidth = window.innerWidth;

  const isInViewport = rect.top < windowHeight - 80 && rect.bottom > 120;

  if (isInViewport) {
    isCommentsFloatingVisible.value = true;
    const rightOffset = Math.max(28, windowWidth - rect.right + 24);
    const isOverlappingFabZone = rightOffset < 96;
    floatingCollapseStyle.value = {
      bottom: isOverlappingFabZone ? '84px' : '32px',
      right: `${rightOffset}px`,
    };
  } else {
    isCommentsFloatingVisible.value = false;
  }
}

let scrollListenerAttached = false;

function bindScrollListener() {
  if (scrollListenerAttached) return;
  scrollListenerAttached = true;
  window.addEventListener('scroll', updateFloatingCollapse, true);
  window.addEventListener('resize', updateFloatingCollapse);
}

function unbindScrollListener() {
  if (!scrollListenerAttached) return;
  scrollListenerAttached = false;
  window.removeEventListener('scroll', updateFloatingCollapse, true);
  window.removeEventListener('resize', updateFloatingCollapse);
}

function handleCollapseComments() {
  showComments.value = false;
  isCommentsFloatingVisible.value = false;
  unbindScrollListener();
  if (cardRef.value) {
    cardRef.value.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

let activeCommentsUnregister: (() => void) | null = null;

watch(
  showComments,
  (isOpen) => {
    if (isOpen) {
      activeCommentsUnregister?.();
      activeCommentsUnregister = registerOpenComments(props.feed.id, handleCollapseComments);
      bindScrollListener();
      void nextTick(updateFloatingCollapse);
    } else {
      activeCommentsUnregister?.();
      activeCommentsUnregister = null;
      isCommentsFloatingVisible.value = false;
      unbindScrollListener();
    }
  },
  { immediate: true }
);

onDeactivated(unbindScrollListener);
onUnmounted(() => {
  activeCommentsUnregister?.();
  activeCommentsUnregister = null;
  unbindScrollListener();
});

function isCurrentCommentRequest(requestedFeedId: string, currentRequest: number): boolean {
  return currentRequest === commentsRequestVersion
    && requestedFeedId === String(props.feed.id || '');
}

async function loadCommentPage(
  requestedFeedId: string,
  page: number,
  cursor?: { firstItem?: string; lastItem?: string },
): Promise<any[]> {
  const response = await CoolapkTauriAPI.getFeedReplies(requestedFeedId, page, {
    ...getCommentReplyRequestOptions(commentsSortMode.value, commentsAuthorOnly.value),
    ...cursor,
  });
  return getReplyData(response);
}

function updateCommentCursor(pageReplies: any[], resetFirst = false) {
  const cursor = getReplyPageCursor(pageReplies);
  if (resetFirst || !commentsFirstItem) commentsFirstItem = cursor.firstItem;
  if (cursor.lastItem) commentsLastItem = cursor.lastItem;
}

async function loadMoreComments() {
  if (
    !hasMoreComments.value ||
    commentsLoading.value ||
    commentsLoadingMore.value
  ) {
    return;
  }

  const requestedFeedId = String(props.feed.id || '');
  if (!requestedFeedId) return;

  const currentRequest = commentsRequestVersion;
  const page = commentsPage.value + 1;
  commentsLoadingMore.value = true;
  commentsLoadMoreError.value = '';

  try {
    const pageReplies = await loadCommentPage(requestedFeedId, page, {
      firstItem: commentsFirstItem,
      lastItem: commentsLastItem,
    });
    if (!isCurrentCommentRequest(requestedFeedId, currentRequest)) return;

    updateCommentCursor(pageReplies);
    const previousReplies = comments.value;
    const mergedReplies = mergeReplies(previousReplies, pageReplies);
    if (mergedReplies.length > previousReplies.length) {
      comments.value = mergedReplies;
      commentsPage.value = page;
    }
    hasMoreComments.value = hasMoreReplyPages(
      pageReplies,
      previousReplies,
      mergedReplies,
      getExpectedCommentCount(props.feed.replynum),
    );
  } catch (err) {
    if (isCurrentCommentRequest(requestedFeedId, currentRequest)) {
      console.error('Failed to load more rating comments', err);
      commentsLoadMoreError.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (isCurrentCommentRequest(requestedFeedId, currentRequest)) {
      commentsLoadingMore.value = false;
    }
  }
}

async function loadComments(force = false) {
  if (
    !force &&
    (commentsLoading.value || commentsLoadingMore.value || commentsPage.value > 0)
  ) {
    return;
  }

  const requestedFeedId = String(props.feed.id || '');
  if (!requestedFeedId) return;

  const currentRequest = ++commentsRequestVersion;
  if (force) comments.value = [];
  commentsPage.value = 0;
  hasMoreComments.value = false;
  commentsFirstItem = '';
  commentsLastItem = '';
  commentsError.value = '';
  commentsLoadMoreError.value = '';
  commentsLoadingMore.value = false;
  commentsLoading.value = true;

  try {
    const pageReplies = await loadCommentPage(requestedFeedId, 1);

    if (!isCurrentCommentRequest(requestedFeedId, currentRequest)) return;

    updateCommentCursor(pageReplies, true);
    comments.value = pageReplies;
    commentsPage.value = pageReplies.length > 0 ? 1 : 0;
    hasMoreComments.value = hasMoreReplyPages(
      pageReplies,
      [],
      pageReplies,
      getExpectedCommentCount(props.feed.replynum),
    );
    commentsLoading.value = false;
    if (hasMoreComments.value) void loadMoreComments();
  } catch (err) {
    if (isCurrentCommentRequest(requestedFeedId, currentRequest)) {
      console.error('Failed to load rating comments', err);
      commentsError.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (isCurrentCommentRequest(requestedFeedId, currentRequest)) {
      commentsLoading.value = false;
    }
  }
}

function handleCommentSortChange(selection: CommentSortSelection) {
  commentsSortMode.value = selection.mode;
  commentsAuthorOnly.value = selection.authorOnly;
  void loadComments(true);
}

watch(() => settingsStore.settings.commentDefaultSortMode, (sortMode) => {
  commentsSortMode.value = sortMode;
  commentsAuthorOnly.value = false;
  if (showComments.value) void loadComments(true);
});

async function toggleComments() {
  showComments.value = !showComments.value;
  if (showComments.value) void loadComments();
}

function handleCardClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest('a') || target.closest('button') || target.closest('.grid-item') || target.closest('.inline-comment-wrapper')) {
    return;
  }
  toggleComments();
}

function formatRichText(text: string) {
  if (!text) return '';
  return renderCoolapkRichText(text);
}
defineExpose({ toggleComments, handleCollapseComments, showComments });
</script>

<style scoped>
.rating-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--feed-card-padding);
  margin-bottom: var(--feed-card-gap);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: all var(--duration-normal) var(--ease-default);
}

.rating-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-hover);
}

.rating-score-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: -2px;
}

.owner-badge {
  background: linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%);
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.star-rating-stars {
  display: flex;
  gap: 3px;
  color: #d1d5db;
  font-size: 13px;
}

.star-rating-stars .active {
  color: #f59e0b;
}

.score-text {
  font-size: 12px;
  font-weight: 700;
  color: #d97706;
  background: #fef3c7;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

.rating-dimensions-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
  font-size: 12px;
  color: var(--text-tertiary);
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.02));
  padding: 6px 12px;
  border-radius: var(--radius-card-sm, 6px);
}

.sub-rating-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.sub-label {
  color: var(--text-secondary);
}

.sub-stars {
  display: inline-flex;
  gap: 1px;
  color: var(--border-strong, #d1d5db);
  font-size: 10px;
}

.sub-stars .active {
  color: #f59e0b;
}

.sub-score {
  color: var(--text-secondary);
  font-size: 11px;
}

.sub-description {
  color: var(--text-tertiary);
  font-size: 11px;
}

.filter-rating-badge {
  align-self: flex-end;
  margin-top: -4px;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, var(--danger, #ef4444) 45%, transparent);
  border-radius: var(--radius-pill);
  color: var(--danger, #ef4444);
  font-size: 10px;
}

.rating-body {
  font-size: var(--font-size-body);
  color: var(--text-primary);
  line-height: 1.6;
}

.rating-comments {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: -4px;
}

.rating-comment-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--text-primary);
  font-size: var(--font-size-body, 15px);
  line-height: 1.6;
}

.rating-comment-label {
  flex: 0 0 auto;
  color: var(--brand-primary, #10b981);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.8;
}

.rating-comment-text {
  min-width: 0;
  word-break: break-word;
}

.rating-comment-text :deep(a) {
  color: var(--brand-primary, #10b981);
}

.target-device-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--border);
  padding: 10px 14px;
  border-radius: var(--radius-card);
  margin-top: 4px;
  transition: background-color 0.2s;
}

.target-device-card:hover {
  background-color: var(--surface-hover);
}

.device-thumb {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #fff;
}

.device-thumb :deep(.device-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-count {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.device-rating-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.big-score {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}

.mini-stars {
  display: flex;
  gap: 2px;
  font-size: 10px;
  color: #fbbf24;
}

.inline-comment-wrapper {
  position: relative;
  margin-top: 12px;
  border-top: 1px solid var(--border-light);
  padding-top: 4px;
  cursor: default;
}

/* 全局固定悬浮收起按钮（Fixed 定位在视口右下角，评论滚动时静止不动） */
.global-floating-comment-collapse {
  position: fixed;
  z-index: 900;
  pointer-events: auto;
  transition: bottom 0.2s cubic-bezier(0.4, 0, 0.2, 1), right 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-floating-collapse {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 15px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
  border-radius: 22px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14), 0 1px 4px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-floating-collapse:hover {
  background: var(--brand-primary, #10b981);
  border-color: var(--brand-primary, #10b981);
  color: #ffffff;
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
}

.btn-floating-collapse:active {
  transform: translateY(0) scale(0.98);
}

.btn-floating-collapse i {
  font-size: 11px;
}

.floating-collapse-fade-enter-active,
.floating-collapse-fade-leave-active {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.floating-collapse-fade-enter-from,
.floating-collapse-fade-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.94);
}
</style>
