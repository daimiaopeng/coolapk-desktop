<template>
  <article
    ref="cardRef"
    :class="['question-answer-card', { 'is-detail-mode': detailMode }]"
    :data-answer-id="answer.id"
    :data-question-id="questionIdValue"
    @click="handleCardClick"
  >
    <FeedHeader
      :uid="authorUid"
      :avatar="answer.userAvatar || answer.userInfo?.userAvatar"
      :plugin-url="(answer.userInfo as any)?.avatar_plugin_url || (answer as any).avatar_plugin_url || (answer as any).userAvatarPluginUrl"
      :username="answer.username || answer.userInfo?.username"
      :level="answer.userInfo?.level || answer.level"
      :gender="(answer.userInfo as any)?.gender ?? (answer as any).gender"
      :gender-title="(answer.userInfo as any)?.gender_title ?? (answer as any).gender_title"
      :ip-location="(answer as any).ip_location || (answer as any).ipLocation || (answer as any).location || (answer as any).city || (answer.userInfo as any)?.ip_location"
      :verify-title="answer.userInfo?.verify_title || answer.verifyTitle"
      :dateline="answer.dateline || answer.infoHtml"
      :device="answer.device_title || answer.deviceTitle"
      :show-device-info="showDeviceInfo"
      entity-type="answer"
      :entity-id="answer.id"
    >
      <template #actions>
        <button
          v-if="detailMode && authorUid"
          type="button"
          :class="['answer-author-follow', { active: authorFollowed }]"
          :disabled="authorFollowPending"
          :aria-pressed="authorFollowed"
          @click.stop="toggleAuthorFollow"
        >
          {{ authorFollowed ? '已关注' : '关注' }}
        </button>
      </template>
    </FeedHeader>

    <div v-if="showAnswerHeading && questionTitle" class="answer-question-context" @click.stop="openQuestionDetail">
      <i class="fas fa-circle-question" aria-hidden="true"></i>
      <span>{{ questionTitle }}</span>
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </div>

    <div v-if="showAnswerHeading" class="answer-title-row">
      <span class="answer-kind-badge" aria-label="回答">
        <i class="fas fa-comment-dots" aria-hidden="true"></i>
        <span>回答</span>
      </span>
      <h2 v-if="answerTitle" class="answer-title">{{ answerTitle }}</h2>
    </div>

    <FeedContent
      :feed-id="answer.id"
      :message="answer.message || answer.message_raw_output"
      :username="answer.username || answer.userInfo?.username"
      :force-expanded="detailMode"
      :max-lines="maxLines"
      :highlight-keyword="highlightKeyword"
    />

    <VoteCard v-if="answer.vote" :feed-id="answer.id" :vote="answer.vote" />

    <FeedVideoCard :feed="answer" />

    <FeedImageGrid
      v-if="answerImages.length"
      :images="answerImages"
      :content-id="answer.id"
      content-type="feed"
    />

    <QuestionRelatedContent v-if="showRelatedContent" :content="answer" />

    <div
      v-if="isTargetFeed && targetRow"
      class="answer-quoted-feed"
      @click.stop="openQuotedFeed"
    >
      <span v-if="quotedAuthor" class="answer-quoted-author">@{{ quotedAuthor }}</span>
      <div class="answer-quoted-message" v-html="formattedQuotedMessage"></div>
    </div>

    <div v-if="publishLocation || recommendText" class="answer-publish-meta">
      <span v-if="publishLocation">发布于 {{ publishLocation }}</span>
      <span v-if="recommendText" class="answer-recommend-badge">
        <i class="fas fa-arrow-up" aria-hidden="true"></i>
        {{ recommendText }}
      </span>
    </div>

    <div v-if="showReplySummary" :class="['answer-reply-summary', { 'is-expanded': showComments }]">
      <strong>共 {{ formatCount(replyCount) }} 回复</strong>
      <div v-if="!showComments" class="answer-reply-sort-tabs" role="tablist" aria-label="回答回复排序">
        <button
          v-for="option in replySortOptions"
          :key="option.key"
          type="button"
          :class="['answer-reply-sort-tab', { active: !commentsAuthorOnly && commentsSortMode === option.mode }]"
          :aria-selected="!commentsAuthorOnly && commentsSortMode === option.mode"
          @click.stop="selectReplySort(option.mode)"
        >
          {{ option.label }}
        </button>
        <button
          type="button"
          :class="['answer-reply-sort-tab', { active: commentsAuthorOnly }]"
          :aria-selected="commentsAuthorOnly"
          @click.stop="selectAuthorOnly"
        >
          楼主
        </button>
      </div>
      <button v-else type="button" class="answer-collapse-comments" @click.stop="showComments = false">
        收起回复
      </button>
    </div>

    <FeedActionBar
      :feed-id="answer.id"
      :likenum="answer.likenum"
      :replynum="replyCount"
      :favnum="favnum"
      :sharenum="answer.sharenum"
      :favorited="isFav"
      :user-action="answer.userAction"
      @open-comment="toggleComments"
      @toggle-fav="toggleFav"
      @forward="openForwardDialog"
      @open-like-list="openLikeList"
      @open-forward-list="openForwardList"
    />

    <div v-if="showComments" class="answer-comments-wrapper" @click.stop>
      <FeedCommentSection
        :feed-id="answer.id"
        :feed-uid="authorUid"
        :feed-username="answer.username || answer.userInfo?.username"
        :total-comment-count="replyCount"
        :comments="comments"
        :loading="commentsLoading"
        :error="commentsError"
        :has-more-comments="hasMoreComments"
        :loading-more-comments="commentsLoadingMore"
        :load-more-error="commentsLoadMoreError"
        :normalize-img="normalizeImg"
        :format-rich-text="formatRichText"
        @delete-comment="removeComment"
        @retry-comments="openComments(true)"
        @load-more-comments="loadMoreComments"
        @retry-more-comments="loadMoreComments"
        @comment-sort-change="handleCommentSortChange"
      />
    </div>

    <ForwardDialog v-model:show="forwardOpen" :feed="answer" @success="handleForwardSuccess" />

    <FeedInteractionListDialog
      :show="interactionMode !== null"
      :mode="interactionMode || 'likes'"
      :feed-id="answer.id"
      :feed-type="interactionFeedType"
      @update:show="closeInteractionDialog"
    />

    <FeedCollectionPickerDialog
      :is-open="collectionPickerOpen"
      :collections="collectionOptions"
      :selected-ids="collectionInitialSelectedIds"
      :loading="collectionPickerLoading"
      :submitting="collectionPickerSubmitting"
      @close="closeCollectionPicker"
      @confirm="confirmCollectionSelection"
    />
  </article>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { FeedItem } from '../../types/feed';
import { CoolapkTauriAPI } from '../../api/coolapk';
import FeedActionBar from '../feed/FeedActionBar.vue';
import FeedCollectionPickerDialog from '../feed/FeedCollectionPickerDialog.vue';
import FeedCommentSection from '../feed/FeedCommentSection.vue';
import FeedContent from '../feed/FeedContent.vue';
import FeedHeader from '../feed/FeedHeader.vue';
import FeedImageGrid from '../feed/FeedImageGrid.vue';
import FeedInteractionListDialog from '../feed/FeedInteractionListDialog.vue';
import FeedVideoCard from '../feed/FeedVideoCard.vue';
import VoteCard from '../feed/VoteCard.vue';
import ForwardDialog from '../overlays/ForwardDialog.vue';
import QuestionRelatedContent from './QuestionRelatedContent.vue';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { useAppStore } from '../../stores/app';
import { getErrorMessage } from '../../utils/errors';
import { extractFeedImageInputs, type FeedImageInput } from '../../utils/livePhoto';
import { normalizeCoolapkNativeRoute, normalizeCoolapkPageRoute, normalizeCoolapkRoute } from '../../utils/coolapkRoute';
import { renderCoolapkRichText } from '../../utils/richText';
import { preloadUserProfile } from '../../utils/userProfilePreloader';
import {
  DEFAULT_COMMENT_SORT_MODE,
  getCommentReplyRequestOptions,
  getExpectedCommentCount,
  getReplyData,
  getReplyPageCursor,
  hasMoreReplyPages,
  mergeReplies,
  type CommentSortMode,
  type CommentSortSelection,
} from '../../utils/commentList';
import {
  getFeedRelationImage,
  getFeedRelationKey,
  getFeedRelationRows,
  getFeedRelationSubtitle,
  getFeedRelationTitle,
  getFeedRelationType,
} from '../../utils/feedRelations';
import { getUserUid } from '../../utils/userRoute';
import { showToast } from '../../utils/toast';

const props = withDefaults(defineProps<{
  answer: FeedItem;
  questionId?: string | number;
  questionTitle?: string;
  detailMode?: boolean;
  autoOpenComments?: boolean;
  navigateToQuestion?: boolean;
  showAnswerHeading?: boolean;
  showReplySummary?: boolean;
  showRelatedContent?: boolean;
  maxLines?: number;
  highlightKeyword?: string;
}>(), {
  detailMode: false,
  autoOpenComments: false,
  navigateToQuestion: true,
  showAnswerHeading: true,
  showReplySummary: false,
  showRelatedContent: true,
  maxLines: undefined,
  highlightKeyword: '',
});

const emit = defineEmits<{
  (event: 'related-post', target: any): void;
  (event: 'favorite-changed', payload: { id: string | number; favorited: boolean }): void;
}>();

const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const showDeviceInfo = computed(() => settingsStore.settings.showDeviceInfo);
const authorUid = computed(() => getUserUid(props.answer));
const answerImages = computed<FeedImageInput[]>(() => extractFeedImageInputs(props.answer));
const answerTitle = computed(() => {
  const source = String(props.answer.title || props.answer.message_title || props.answer.messageTitle || '').trim();
  return source.replace(/^\s*\[(?:回答|答案)\]\s*/u, '').trim();
});
const questionIdValue = computed(() => String(
  props.questionId
    ?? (props.answer as any).questionId
    ?? (props.answer as any).question_id
    ?? (props.answer as any).fid
    ?? (props.answer as any).f_id
    ?? (props.answer as any).feedId
    ?? (props.answer as any).feed_id
    ?? (props.answer as any).question?.id
    ?? (props.answer as any).question?.entityId
    ?? '',
).trim());
const questionTitle = computed(() => String(
  props.questionTitle
    || (props.answer as any).questionTitle
    || (props.answer as any).question_title
    || (props.answer as any).question?.title
    || '',
).trim());
const replyCount = computed(() => {
  const value = Number((props.answer as any).replynum ?? (props.answer as any).replyNum ?? (props.answer as any).replyCount ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
});
const publishLocation = computed(() => String(
  (props.answer as any).location
    || (props.answer as any).locationCity
    || (props.answer as any).location_city
    || (props.answer as any).province
    || '',
).trim());
const recommendText = computed(() => {
  const value = (props.answer as any).recommend ?? (props.answer as any).isRecommend ?? (props.answer as any).is_recommend;
  if (typeof value === 'string' && value.trim() && !['0', 'false', 'no'].includes(value.trim().toLowerCase())) return value.trim();
  if (value === true || value === 1 || value === '1' || (props.answer as any).recommendSource) return '推荐';
  return '';
});

onMounted(() => {
  if (authorUid.value) preloadUserProfile(authorUid.value);
});

watch(authorUid, (uid) => {
  if (uid) preloadUserProfile(uid);
});

const baseTargetRow = computed<any>(() =>
  props.answer.targetRow
  || (props.answer as any).target_row
  || (props.answer as any).targetFeed
  || (props.answer as any).replyFeed
  || (props.answer as any).feedInfo
  || (props.answer as any).feed
  || null,
);

const targetRows = computed<any[]>(() => {
  const candidates = [baseTargetRow.value, ...getFeedRelationRows(props.answer)]
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  const seen = new Set<string>();
  return candidates.filter((row, index) => {
    const key = getFeedRelationKey(row, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

const targetRow = computed<any>(() => targetRows.value[0] || null);

function isTargetFeedRow(target: any): boolean {
  if (!target) return false;
  const type = String(target.entityType || target.entity_type || target.type || '').toLowerCase();
  if (['feed', 'feed_reply', 'feedreply', 'article'].includes(type)) return true;
  return Boolean((target.username || target.userName || target.userInfo?.username)
    && (target.message || target.message_raw_output || target.content || target.text));
}

const isTargetFeed = computed(() => isTargetFeedRow(targetRow.value));
const targetObjectRows = computed<any[]>(() => targetRows.value.filter((target) => {
  if (isTargetFeedRow(target)) return false;
  const type = getFeedRelationType(target);
  return Boolean(getFeedRelationTitle(target) || getFeedRelationImage(target) || target.id || target.entityId || target.url || type);
}));

const quotedAuthor = computed(() => String(
  targetRow.value?.username
    || targetRow.value?.userName
    || targetRow.value?.displayUserName
    || targetRow.value?.userInfo?.username
    || '',
).trim());
const formattedQuotedMessage = computed(() => renderCoolapkRichText(String(
  targetRow.value?.message
    || targetRow.value?.content
    || targetRow.value?.text
    || targetRow.value?.title
    || '原动态内容',
)));

function targetIconClass(target: any): string {
  const type = getFeedRelationType(target);
  const title = getFeedRelationTitle(target).toLowerCase();
  if (type.includes('product') || type.includes('device') || /pro|ultra|phone|mate|pura/.test(title)) return 'fas fa-mobile-screen';
  if (type.includes('apk') || type.includes('app')) return 'fas fa-cubes';
  if (type.includes('topic') || type.includes('node') || type.includes('tag')) return 'fas fa-hashtag';
  if (type.includes('goods') || type.includes('mall')) return 'fas fa-bag-shopping';
  return 'fas fa-tag';
}

function getTargetTitle(target: any): string { return getFeedRelationTitle(target); }
function getTargetSubtitle(target: any): string { return getFeedRelationSubtitle(target); }
function getTargetImage(target: any): string { return getFeedRelationImage(target); }
function getTargetKey(target: any, index: number): string { return getFeedRelationKey(target, index); }

function getTargetTypeLabel(target: any): string {
  const type = getFeedRelationType(target);
  if (type.includes('product') || type.includes('device') || type === '7') return '数码';
  if (type.includes('apk') || type.includes('app') || type.includes('game')) return '应用';
  if (type.includes('topic') || type.includes('node') || type.includes('tag')) return '话题';
  if (type.includes('goods') || type.includes('mall')) return '好物';
  return '关联内容';
}

function numericTargetValue(target: any, keys: string[]): number {
  for (const key of keys) {
    const value = Number(target?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(value));
}

function getTargetScore(target: any): string {
  const score = numericTargetValue(target, ['ratingAverageScore', 'rating_average_score', 'score', 'ratingScore']);
  return score > 0 ? score.toFixed(1).replace(/\.0$/, '') : '';
}

function getTargetMetricText(target: any): string {
  const hot = numericTargetValue(target, ['hotNum', 'hot_num', 'heat', 'hotnum']);
  const comments = numericTargetValue(target, ['feedCommentNum', 'feed_comment_num', 'commentNum', 'commentnum', 'replynum']);
  const follow = numericTargetValue(target, ['followNum', 'follow_num', 'follownum']);
  return [hot ? `${formatCount(hot)} 热度` : '', comments ? `${formatCount(comments)} 讨论` : '', follow ? `${formatCount(follow)} 关注` : ''].filter(Boolean).join(' · ');
}

function isProductTarget(target: any): boolean {
  const type = getFeedRelationType(target);
  return type.includes('product') || type.includes('device') || type === '7' || Boolean(target?.productId || target?.product_id);
}

function targetId(target: any): string {
  return String(target?.id ?? target?.entityId ?? target?.entity_id ?? target?.targetId ?? target?.target_id ?? target?.productId ?? target?.product_id ?? '').trim();
}

const targetFollowStates = ref<Record<string, boolean>>({});
const targetFollowPending = ref<Record<string, boolean>>({});

function isTargetFollowed(target: any): boolean {
  const id = targetId(target);
  if (!id) return false;
  if (id in targetFollowStates.value) return targetFollowStates.value[id];
  const action = target?.userAction || target?.user_action || {};
  return action.follow === 1 || action.follow === true || action.isFollow === 1 || action.is_follow === 1
    || target?.isFollow === 1 || target?.is_follow === 1;
}

function isTargetFollowPending(target: any): boolean { return Boolean(targetFollowPending.value[targetId(target)]); }

async function toggleTargetFollow(target: any) {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const id = targetId(target);
  if (!id || targetFollowPending.value[id]) return;
  const previous = isTargetFollowed(target);
  const next = !previous;
  targetFollowStates.value = { ...targetFollowStates.value, [id]: next };
  targetFollowPending.value = { ...targetFollowPending.value, [id]: true };
  try {
    await CoolapkTauriAPI.changeProductFollowStatus(id, next ? 1 : 0);
    showToast(next ? '已关注数码' : '已取消关注数码', 'success');
  } catch (error) {
    targetFollowStates.value = { ...targetFollowStates.value, [id]: previous };
    showToast(getErrorMessage(error, next ? '关注数码失败' : '取消关注失败'), 'error');
  } finally {
    const pending = { ...targetFollowPending.value };
    delete pending[id];
    targetFollowPending.value = pending;
  }
}

function openRelatedPost(_target: any) {
  appStore.openPublish();
}

function openTarget(target: any) {
  if (!target) return;
  const targetUrl = target.url || target.targetUrl || target.target_url || target.webUrl || target.web_url;
  if (typeof targetUrl === 'string' && targetUrl) {
    const normalizedRoute = normalizeCoolapkRoute(targetUrl);
    if (normalizedRoute && !/^\/page(?:\?|$)/i.test(normalizedRoute)) {
      void router.push(normalizedRoute);
      return;
    }
    const pageRoute = normalizeCoolapkPageRoute(targetUrl);
    if (pageRoute) {
      const pageUrl = new URL(pageRoute, 'https://www.coolapk.com');
      void router.push({ path: '/page', query: { url: pageUrl.searchParams.get('url') || '', title: getTargetTitle(target) } });
      return;
    }
    if (normalizedRoute) void router.push(normalizedRoute);
    else if (targetUrl.startsWith('/')) void router.push(normalizeCoolapkNativeRoute(targetUrl) || targetUrl);
    else void CoolapkTauriAPI.openUrl(targetUrl);
    return;
  }
  const type = getFeedRelationType(target);
  const id = targetId(target);
  const packageName = target.packageName || target.package_name || target.apkName || target.apkname;
  const topicTag = target.tag || target.topicTag || target.topic_tag || target.title || target.name || id;
  if (packageName && (type.includes('apk') || type.includes('app') || type.includes('game'))) {
    const appRoute = normalizeCoolapkNativeRoute(`/apk/${String(packageName)}`);
    if (appRoute) void router.push(appRoute);
    return;
  }
  if (type.includes('topic') || type.includes('node') || type.includes('tag')) {
    if (topicTag) void router.push(`/topic/${encodeURIComponent(String(topicTag))}`);
    return;
  }
  if (id && (type.includes('product') || type.includes('device'))) void router.push(`/product/${encodeURIComponent(id)}`);
}

function openQuotedFeed() {
  const id = targetRow.value?.id || targetRow.value?.feed_id || targetRow.value?.entityId;
  if (id) void router.push(`/feed/${encodeURIComponent(String(id))}`);
}

function openQuestionDetail() {
  if (!questionIdValue.value) return;
  appStore.setFeedDetailContext(questionIdValue.value, props.answer);
  void router.push(`/question/${encodeURIComponent(questionIdValue.value)}`);
}

function openAnswerDetail() {
  const answerId = String(props.answer.id || '').trim();
  if (!answerId) return;
  appStore.setFeedDetailContext(answerId, props.answer);
  void router.push(`/feed/${encodeURIComponent(answerId)}`);
}

function handleCardClick(event: MouseEvent) {
  if (props.detailMode) return;
  const target = event.target as HTMLElement;
  if (target.closest('a, button, .grid-item, .feed-video-card, .answer-comments-wrapper, .question-related-card, .answer-related-card, .answer-quoted-feed')) return;
  if (props.navigateToQuestion && questionIdValue.value) openQuestionDetail();
  else openAnswerDetail();
}

const authorFollowed = ref(Boolean(
  (props.answer as any).userAction?.follow === 1
    || (props.answer as any).userAction?.isFollow === 1
    || (props.answer as any).isFollow === 1
    || (props.answer as any).is_follow === 1,
));
const authorFollowPending = ref(false);

async function toggleAuthorFollow() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (!authorUid.value || authorFollowPending.value) return;
  const previous = authorFollowed.value;
  const next = !previous;
  authorFollowed.value = next;
  authorFollowPending.value = true;
  try {
    if (next) await CoolapkTauriAPI.followUser(authorUid.value);
    else await CoolapkTauriAPI.unfollowUser(authorUid.value);
  } catch (error) {
    authorFollowed.value = previous;
    showToast(getErrorMessage(error, next ? '关注用户失败' : '取消关注失败'), 'error');
  } finally {
    authorFollowPending.value = false;
  }
}

const isFav = ref(
  props.answer.userAction?.collect === 1
    || props.answer.userAction?.favorite === 1
    || (props.answer as any).favorited === true,
);
const favnum = ref(Number(props.answer.favnum || 0));
const favoritePending = ref(false);
const collectionPickerOpen = ref(false);
const collectionPickerLoading = ref(false);
const collectionPickerSubmitting = ref(false);
const collectionOptions = ref<any[]>([]);
const collectionInitialSelectedIds = ref<string[]>([]);

async function toggleFav() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (favoritePending.value) return;
  const id = String(props.answer.id || '');
  if (!id) return;
  if (!isFav.value) {
    await openCollectionPicker(id);
    return;
  }
  favoritePending.value = true;
  try {
    await CoolapkTauriAPI.setFeedCloudFavorite(id, false, String((props.answer as any).feedType || 'answer'), String((props.answer as any).trace || (props.answer as any).extra_key || ''));
    isFav.value = false;
    favnum.value = Math.max(0, favnum.value - 1);
    emit('favorite-changed', { id: props.answer.id, favorited: false });
    showToast('已取消收藏', 'success');
  } catch (error) {
    showToast(getErrorMessage(error, '取消收藏失败'), 'error');
  } finally {
    favoritePending.value = false;
  }
}

function collectionId(collection: any): string { return String(collection?.id ?? collection?.collectionId ?? collection?.entityId ?? ''); }

function isCollectionSelected(collection: any): boolean {
  const value = collection?.isBeCollected ?? collection?.is_be_collected;
  return value === true || value === 1 || value === '1' || value === 'true';
}

async function openCollectionPicker(answerId: string) {
  if (collectionPickerOpen.value || collectionPickerLoading.value) return;
  favoritePending.value = true;
  collectionPickerLoading.value = true;
  try {
    const options = await CoolapkTauriAPI.getFeedCollectionOptions(answerId);
    const validOptions = options.filter((item: any) => collectionId(item));
    if (!validOptions.length) throw new Error('酷安未返回可用收藏夹，请先在酷安创建收藏夹');
    collectionOptions.value = validOptions;
    collectionInitialSelectedIds.value = validOptions.filter(isCollectionSelected).map(collectionId);
    collectionPickerOpen.value = true;
  } catch (error) {
    showToast(getErrorMessage(error, '加载收藏夹失败'), 'error');
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

async function confirmCollectionSelection(selectedIds: string[]) {
  if (collectionPickerSubmitting.value) return;
  const ids = Array.from(new Set(selectedIds.filter(Boolean)));
  if (!ids.length) {
    showToast('请至少选择一个收藏夹', 'error');
    return;
  }
  const previousIds = new Set(collectionInitialSelectedIds.value);
  const cancelIds = collectionInitialSelectedIds.value.filter((id) => !ids.includes(id));
  collectionPickerSubmitting.value = true;
  favoritePending.value = true;
  try {
    await CoolapkTauriAPI.updateFeedCloudCollections(
      String(props.answer.id),
      ids.join(','),
      cancelIds.join(','),
      String((props.answer as any).feedType || 'answer'),
      String((props.answer as any).trace || (props.answer as any).extra_key || ''),
    );
    isFav.value = true;
    if (!previousIds.size) favnum.value += 1;
    collectionPickerOpen.value = false;
    emit('favorite-changed', { id: props.answer.id, favorited: true });
    showToast('已收藏到云端', 'success');
  } catch (error) {
    showToast(getErrorMessage(error, '收藏失败'), 'error');
  } finally {
    collectionPickerSubmitting.value = false;
    favoritePending.value = false;
  }
}

const forwardOpen = ref(false);
const interactionMode = ref<'likes' | 'forwards' | null>(null);
const interactionFeedType = computed(() => String((props.answer as any).feedType || (props.answer as any).entityType || 'answer'));

function openForwardDialog() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  forwardOpen.value = true;
}

function handleForwardSuccess() { props.answer.sharenum = Number(props.answer.sharenum || 0) + 1; }
function openLikeList() { interactionMode.value = 'likes'; }
function openForwardList() { interactionMode.value = 'forwards'; }
function closeInteractionDialog(show: boolean) { if (!show) interactionMode.value = null; }

const showComments = ref(false);
const comments = ref<any[]>([]);
const commentsLoading = ref(false);
const commentsError = ref('');
const commentsPage = ref(0);
const hasMoreComments = ref(false);
const commentsLoadingMore = ref(false);
const commentsLoadMoreError = ref('');
const commentsSortMode = ref<CommentSortMode>(DEFAULT_COMMENT_SORT_MODE);
const commentsAuthorOnly = ref(false);
let commentsFirstItem = '';
let commentsLastItem = '';
let commentsRequestVersion = 0;

const replySortOptions: Array<{ key: string; label: string; mode: CommentSortMode }> = [
  { key: 'default', label: '默认', mode: 'default' },
  { key: 'latest', label: '最新', mode: 'latest' },
  { key: 'hot', label: '热门', mode: 'likes' },
];

function isCurrentCommentRequest(requestedId: string, request: number): boolean {
  return request === commentsRequestVersion && requestedId === String(props.answer.id || '');
}

async function loadCommentPage(requestedId: string, page: number, cursor?: { firstItem?: string; lastItem?: string }): Promise<any[]> {
  const response = await CoolapkTauriAPI.getFeedReplies(requestedId, page, {
    ...getCommentReplyRequestOptions(commentsSortMode.value, commentsAuthorOnly.value),
    ...cursor,
  });
  return getReplyData(response);
}

function updateCommentCursor(rows: any[], resetFirst = false) {
  const cursor = getReplyPageCursor(rows);
  if (resetFirst || !commentsFirstItem) commentsFirstItem = cursor.firstItem;
  if (cursor.lastItem) commentsLastItem = cursor.lastItem;
}

async function loadMoreComments() {
  if (!hasMoreComments.value || commentsLoading.value || commentsLoadingMore.value) return;
  const requestedId = String(props.answer.id || '');
  if (!requestedId) return;
  const request = commentsRequestVersion;
  const nextPage = commentsPage.value + 1;
  commentsLoadingMore.value = true;
  commentsLoadMoreError.value = '';
  try {
    const rows = await loadCommentPage(requestedId, nextPage, { firstItem: commentsFirstItem, lastItem: commentsLastItem });
    if (!isCurrentCommentRequest(requestedId, request)) return;
    updateCommentCursor(rows);
    const previous = comments.value;
    const merged = mergeReplies(previous, rows);
    if (merged.length > previous.length) {
      comments.value = merged;
      commentsPage.value = nextPage;
    }
    hasMoreComments.value = hasMoreReplyPages(rows, previous, merged, getExpectedCommentCount(replyCount.value));
  } catch (error) {
    if (isCurrentCommentRequest(requestedId, request)) commentsLoadMoreError.value = getErrorMessage(error, '加载更多回复失败');
  } finally {
    if (isCurrentCommentRequest(requestedId, request)) commentsLoadingMore.value = false;
  }
}

async function openComments(force = false) {
  showComments.value = true;
  if (!force && (commentsLoading.value || commentsLoadingMore.value || commentsPage.value > 0)) return;
  const requestedId = String(props.answer.id || '');
  if (!requestedId) return;
  const request = ++commentsRequestVersion;
  if (force) comments.value = [];
  commentsPage.value = 0;
  commentsFirstItem = '';
  commentsLastItem = '';
  hasMoreComments.value = false;
  commentsError.value = '';
  commentsLoadMoreError.value = '';
  commentsLoading.value = true;
  try {
    const rows = await loadCommentPage(requestedId, 1);
    if (!isCurrentCommentRequest(requestedId, request)) return;
    updateCommentCursor(rows, true);
    comments.value = rows;
    commentsPage.value = rows.length ? 1 : 0;
    hasMoreComments.value = hasMoreReplyPages(rows, [], rows, getExpectedCommentCount(replyCount.value));
  } catch (error) {
    if (isCurrentCommentRequest(requestedId, request)) commentsError.value = getErrorMessage(error, '回复加载失败');
  } finally {
    if (isCurrentCommentRequest(requestedId, request)) commentsLoading.value = false;
  }
}

function toggleComments() {
  if (showComments.value) {
    showComments.value = false;
    return;
  }
  void openComments();
}

function selectReplySort(mode: CommentSortMode) {
  commentsSortMode.value = mode;
  commentsAuthorOnly.value = false;
  void openComments(true);
}

function selectAuthorOnly() {
  commentsAuthorOnly.value = !commentsAuthorOnly.value;
  void openComments(true);
}

function handleCommentSortChange(selection: CommentSortSelection) {
  commentsSortMode.value = selection.mode;
  commentsAuthorOnly.value = selection.authorOnly;
  void openComments(true);
}

function removeComment(id: string | number) { comments.value = comments.value.filter((comment: any) => String(comment.id) !== String(id)); }
function normalizeImg(url: string): string { return url; }
function formatRichText(text: string): string { return text ? renderCoolapkRichText(text) : ''; }

watch(() => props.autoOpenComments, (open) => {
  if (open) void openComments();
}, { immediate: true });

watch(() => String(props.answer.id || ''), () => {
  commentsRequestVersion += 1;
  comments.value = [];
  commentsPage.value = 0;
  commentsFirstItem = '';
  commentsLastItem = '';
  commentsLoading.value = false;
  commentsLoadingMore.value = false;
  commentsError.value = '';
  commentsLoadMoreError.value = '';
  if (props.autoOpenComments) void openComments();
});

onUnmounted(() => {
  commentsRequestVersion += 1;
});
</script>

<style scoped>
.question-answer-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 10px;
  padding: 18px 20px 14px;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card, 14px);
  box-shadow: var(--shadow-card, 0 2px 8px rgba(15, 23, 42, .04));
  cursor: pointer;
}

.question-answer-card.is-detail-mode {
  cursor: default;
  border-radius: 0;
  border-right: 0;
  border-left: 0;
  box-shadow: none;
}

.answer-kind-badge,
.answer-recommend-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--brand-primary);
  font-weight: 700;
  white-space: nowrap;
}

.answer-author-follow {
  min-width: 58px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--brand-primary);
  border-radius: 999px;
  color: var(--brand-primary);
  background: var(--surface);
  font-size: 12px;
  cursor: pointer;
}

.answer-author-follow.active { color: var(--text-secondary); border-color: var(--border); background: var(--background-secondary); }
.answer-author-follow:disabled { opacity: .6; cursor: wait; }

.answer-question-context {
  display: flex;
  align-items: center;
  gap: 7px;
  width: fit-content;
  max-width: 100%;
  margin: 2px 0 12px;
  color: var(--brand-primary);
  font-size: 13px;
  cursor: pointer;
}

.answer-question-context span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.answer-question-context > :last-child { margin-left: 2px; font-size: 10px; }

.answer-title-row { display: flex; align-items: flex-start; gap: 8px; margin: 2px 0 7px; }
.answer-kind-badge { flex: 0 0 auto; margin-top: 2px; padding: 3px 8px; border-radius: 999px; background: var(--brand-soft); font-size: 12px; }
.answer-title { min-width: 0; margin: 0; color: var(--text-primary); font-size: 20px; font-weight: 700; line-height: 1.45; word-break: break-word; }

.answer-quoted-feed { margin: 8px 0; padding: 9px 12px; border: 1px solid var(--border-light); border-radius: 9px; background: var(--background-secondary); cursor: pointer; }
.answer-quoted-author { color: var(--brand-primary); font-weight: 600; }
.answer-quoted-message { margin-top: 4px; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }

.answer-related-list { display: flex; flex-direction: column; gap: 8px; margin: 12px 0 8px; }
.answer-related-card { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 78px; padding: 10px 12px; border-radius: 12px; background: var(--background-secondary); cursor: pointer; transition: background .18s ease, box-shadow .18s ease; }
.answer-related-card:hover { background: var(--surface-hover, var(--background-secondary)); box-shadow: 0 2px 10px rgba(15, 23, 42, .06); }
.answer-related-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
.answer-related-image-wrap { display: grid; flex: 0 0 58px; place-items: center; width: 58px; height: 58px; overflow: hidden; border-radius: 10px; background: var(--surface); }
.answer-related-placeholder { color: var(--brand-primary); font-size: 22px; }
:deep(.answer-related-image) { width: 100%; height: 100%; }
.answer-related-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.answer-related-type { color: var(--brand-primary); font-size: 11px; }
.answer-related-title { overflow: hidden; color: var(--text-primary); font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.answer-related-subtitle,
.answer-related-metrics { overflow: hidden; color: var(--text-tertiary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.answer-related-metrics { color: var(--text-secondary); }
.answer-related-side { display: flex; flex: 0 0 auto; align-items: center; gap: 10px; }
.answer-related-score { color: #f59e0b; font-size: 20px; }
.answer-related-arrow { color: var(--text-tertiary); font-size: 12px; }
.answer-related-actions { display: flex; align-items: center; gap: 6px; }
.answer-related-follow,
.answer-related-post { min-height: 28px; padding: 0 9px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.answer-related-follow { border: 1px solid var(--brand-primary); color: var(--brand-primary); background: transparent; }
.answer-related-follow.active { border-color: var(--border); color: var(--text-secondary); background: var(--surface); }
.answer-related-post { border: 1px solid transparent; color: var(--brand-primary); background: rgba(16, 185, 129, .13); }
.answer-related-follow:disabled { opacity: .6; cursor: wait; }

.answer-publish-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 30px; color: var(--text-tertiary); font-size: 12px; }
.answer-recommend-badge { padding: 5px 10px; border-radius: 999px; background: var(--brand-soft); }

.answer-reply-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--border-light); }
.answer-reply-summary strong { color: var(--text-primary); font-size: 14px; }
.answer-reply-sort-tabs { display: flex; align-items: center; gap: 2px; padding: 3px; border: 1px solid var(--border-light); border-radius: 999px; background: var(--background-secondary); }
.answer-reply-sort-tab { min-height: 27px; padding: 0 10px; border: 0; border-radius: 999px; color: var(--text-tertiary); background: transparent; font-size: 12px; cursor: pointer; }
.answer-reply-sort-tab.active { color: var(--brand-primary); background: var(--brand-soft); font-weight: 600; }
.answer-collapse-comments { border: 0; color: var(--brand-primary); background: transparent; font-size: 12px; cursor: pointer; }
.answer-comments-wrapper { margin-top: 4px; }

@media (max-width: 640px) {
  .question-answer-card { padding: 14px; border-right: 0; border-left: 0; border-radius: 0; }
  .answer-title { font-size: 18px; }
  .answer-related-card { align-items: flex-start; gap: 8px; padding: 9px; }
  .answer-related-image-wrap { flex-basis: 50px; width: 50px; height: 50px; }
  .answer-related-side { flex-direction: column; align-items: flex-end; gap: 5px; }
  .answer-related-actions { flex-direction: column; align-items: flex-end; }
  .answer-related-score { font-size: 17px; }
  .answer-reply-summary { align-items: flex-start; flex-direction: column; }
  .answer-reply-sort-tabs { width: 100%; }
  .answer-reply-sort-tab { flex: 1; }
}
</style>
