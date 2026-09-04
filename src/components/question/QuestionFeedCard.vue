<template>
  <article
    ref="cardRef"
    :class="['question-feed-card', { 'is-detail-mode': detailMode }]"
    :data-question-id="questionId"
    @click="handleCardClick"
  >
    <FeedHeader
      :uid="authorUid"
      :avatar="question.userAvatar || question.userInfo?.userAvatar"
      :plugin-url="(question.userInfo as any)?.avatar_plugin_url || (question as any).avatar_plugin_url || (question as any).userAvatarPluginUrl"
      :username="question.username || question.userInfo?.username"
      :level="question.userInfo?.level || question.level"
      :gender="(question.userInfo as any)?.gender ?? (question as any).gender"
      :gender-title="(question.userInfo as any)?.gender_title ?? (question as any).gender_title"
      :ip-location="(question as any).ip_location || (question as any).ipLocation || (question as any).location || (question as any).city || (question.userInfo as any)?.ip_location"
      :verify-title="question.userInfo?.verify_title || question.verifyTitle"
      :dateline="question.dateline || (question as any).infoHtml"
      :device="question.device_title || question.deviceTitle"
      :rank-index="rankIndex"
      :show-device-info="showDeviceInfo"
      entity-type="question"
      :entity-id="question.id"
    >
    </FeedHeader>

    <div class="question-feed-title-row">
      <span class="question-feed-kind-badge" aria-label="提问">
        <i class="fas fa-circle-question" aria-hidden="true"></i>
        <span>提问</span>
      </span>
      <h2 class="question-feed-title">{{ questionTitle }}</h2>
    </div>

    <FeedContent
      :feed-id="questionId"
      :message="questionMessage"
      :username="question.username || question.userInfo?.username"
      :force-expanded="detailMode"
      :max-lines="maxLines"
      :highlight-keyword="highlightKeyword"
    />

    <FeedVideoCard :feed="question" />

    <FeedImageGrid
      v-if="questionImages.length"
      :images="questionImages"
      :content-id="questionId"
      content-type="feed"
    />

    <QuestionRelatedContent :content="question" />

    <div class="question-feed-footer">
      <div class="question-feed-stats">
        <span><i class="fas fa-comment-dots" aria-hidden="true"></i>{{ answerCount }} 个回答</span>
        <span><i class="fas fa-user-group" aria-hidden="true"></i>{{ followCount }} 人关注</span>
      </div>
      <div class="question-feed-actions">
        <button
          type="button"
          :class="['question-feed-action', { active: isFollowed }]"
          :disabled="followPending"
          :aria-pressed="isFollowed"
          @click.stop="toggleFollow"
        >
          <i :class="isFollowed ? 'fas fa-check' : 'fas fa-plus'" aria-hidden="true"></i>
          {{ isFollowed ? '已关注' : '关注问题' }}
        </button>
        <button type="button" class="question-feed-action question-feed-answer-action" @click.stop="openQuestionDetail">
          <i class="fas fa-pen-to-square" aria-hidden="true"></i>
          回答问题
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { FeedItem } from '../../types/feed';
import { CoolapkTauriAPI } from '../../api/coolapk';
import FeedContent from '../feed/FeedContent.vue';
import FeedHeader from '../feed/FeedHeader.vue';
import FeedImageGrid from '../feed/FeedImageGrid.vue';
import FeedVideoCard from '../feed/FeedVideoCard.vue';
import QuestionRelatedContent from './QuestionRelatedContent.vue';
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { getErrorMessage } from '../../utils/errors';
import {
  getFeedRelationImage,
  getFeedRelationKey,
  getFeedRelationRows,
  getFeedRelationSubtitle,
  getFeedRelationTitle,
  getFeedRelationType,
} from '../../utils/feedRelations';
import { normalizeCoolapkNativeRoute, normalizeCoolapkPageRoute, normalizeCoolapkRoute } from '../../utils/coolapkRoute';
import { getQuestionAnswerCount, getQuestionAnswerImages, getQuestionFollowCount, getQuestionMessage, getQuestionTitle, isQuestionFollowed } from '../../utils/question';
import { getUserUid } from '../../utils/userRoute';
import { preloadUserProfile } from '../../utils/userProfilePreloader';
import { showToast } from '../../utils/toast';

const props = withDefaults(defineProps<{
  question: FeedItem;
  detailMode?: boolean;
  rankIndex?: number;
  maxLines?: number;
  highlightKeyword?: string;
}>(), {
  detailMode: false,
  maxLines: undefined,
  highlightKeyword: '',
});

const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const showDeviceInfo = computed(() => settingsStore.settings.showDeviceInfo);
const authorUid = computed(() => getUserUid(props.question));
const questionId = computed(() => String(
  (props.question as any).questionId
    ?? (props.question as any).question_id
    ?? (props.question as any).id
    ?? (props.question as any).entityId
    ?? '',
).trim());
const questionTitle = computed(() => getQuestionTitle(props.question));
const questionMessage = computed(() => getQuestionMessage(props.question));
const questionImages = computed(() => getQuestionAnswerImages(props.question));
const answerCount = computed(() => getQuestionAnswerCount(props.question));
const followCount = ref(getQuestionFollowCount(props.question));
const isFollowed = ref(isQuestionFollowed(props.question));
const followPending = ref(false);

onMounted(() => {
  if (authorUid.value) preloadUserProfile(authorUid.value);
});

watch(authorUid, (uid) => {
  if (uid) preloadUserProfile(uid);
});

watch(() => props.question, (value) => {
  followCount.value = getQuestionFollowCount(value);
  isFollowed.value = isQuestionFollowed(value);
}, { deep: true });

const targetRows = computed<any[]>(() => {
  const base = (props.question as any).targetRow
    || (props.question as any).target_row
    || (props.question as any).targetFeed
    || (props.question as any).feedInfo;
  const candidates = [base, ...getFeedRelationRows(props.question)]
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  const seen = new Set<string>();
  return candidates.filter((item, index) => {
    const key = getFeedRelationKey(item, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(getFeedRelationTitle(item) || getFeedRelationImage(item) || item.id || item.entityId || item.url);
  });
});

function getTargetTitle(target: any): string { return getFeedRelationTitle(target); }
function getTargetSubtitle(target: any): string { return getFeedRelationSubtitle(target); }
function getTargetImage(target: any): string { return getFeedRelationImage(target); }
function getTargetKey(target: any, index: number): string { return getFeedRelationKey(target, index); }

function getTargetTypeLabel(target: any): string {
  const type = getFeedRelationType(target);
  if (type.includes('product') || type.includes('device') || type === '7') return '数码';
  if (type.includes('apk') || type.includes('app') || type.includes('game')) return '应用';
  if (type.includes('topic') || type.includes('node') || type.includes('tag')) return '话题';
  return '关联内容';
}

function targetIconClass(target: any): string {
  const type = getFeedRelationType(target);
  if (type.includes('product') || type.includes('device') || type === '7') return 'fas fa-mobile-screen';
  if (type.includes('apk') || type.includes('app')) return 'fas fa-cubes';
  if (type.includes('topic') || type.includes('node') || type.includes('tag')) return 'fas fa-hashtag';
  return 'fas fa-tag';
}

function openTarget(target: any) {
  const rawUrl = target?.url || target?.targetUrl || target?.target_url || target?.webUrl || target?.web_url;
  if (typeof rawUrl === 'string' && rawUrl) {
    const normalized = normalizeCoolapkRoute(rawUrl);
    if (normalized && !/^\/page(?:\?|$)/i.test(normalized)) {
      void router.push(normalized);
      return;
    }
    const pageRoute = normalizeCoolapkPageRoute(rawUrl);
    if (pageRoute) {
      const pageUrl = new URL(pageRoute, 'https://www.coolapk.com');
      void router.push({ path: '/page', query: { url: pageUrl.searchParams.get('url') || '', title: getTargetTitle(target) } });
      return;
    }
    if (normalized) void router.push(normalized);
    else if (rawUrl.startsWith('/')) void router.push(normalizeCoolapkNativeRoute(rawUrl) || rawUrl);
    else void CoolapkTauriAPI.openUrl(rawUrl);
    return;
  }
  const type = getFeedRelationType(target);
  const id = String(target?.id ?? target?.entityId ?? target?.entity_id ?? target?.targetId ?? target?.target_id ?? target?.productId ?? target?.product_id ?? '').trim();
  const packageName = target?.packageName || target?.package_name || target?.apkName || target?.apkname;
  if (packageName && (type.includes('apk') || type.includes('app') || type.includes('game'))) {
    void router.push(normalizeCoolapkNativeRoute(`/apk/${packageName}`) || `/app/${encodeURIComponent(packageName)}`);
  } else if (type.includes('topic') || type.includes('node') || type.includes('tag')) {
    const tag = target?.tag || target?.topicTag || target?.topic_tag || target?.title || target?.name || id;
    if (tag) void router.push(`/topic/${encodeURIComponent(String(tag))}`);
  } else if (id && (type.includes('product') || type.includes('device') || type === '7' || target?.productId || target?.product_id)) {
    void router.push(`/product/${encodeURIComponent(id)}`);
  }
}

function openQuestionDetail() {
  const id = questionId.value;
  if (!id) return;
  appStore.setFeedDetailContext(id, props.question);
  void router.push(`/question/${encodeURIComponent(id)}`);
}

function handleCardClick(event: MouseEvent) {
  if (props.detailMode) return;
  const target = event.target as HTMLElement;
  if (target.closest('a, button, .grid-item, .feed-video-card, .question-feed-related-card')) return;
  openQuestionDetail();
}

async function toggleFollow() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const id = String(props.question.id || '').trim();
  if (!id || followPending.value) return;
  const previous = isFollowed.value;
  isFollowed.value = !previous;
  followCount.value = Math.max(0, followCount.value + (isFollowed.value ? 1 : -1));
  followPending.value = true;
  try {
    if (isFollowed.value) await CoolapkTauriAPI.followQuestion(id);
    else await CoolapkTauriAPI.unfollowQuestion(id);
  } catch (error) {
    isFollowed.value = previous;
    followCount.value = Math.max(0, followCount.value + (previous ? 1 : -1));
    showToast(getErrorMessage(error, '关注问题失败'), 'error');
  } finally {
    followPending.value = false;
  }
}
</script>

<style scoped>
.question-feed-card {
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

.question-feed-card.is-detail-mode {
  cursor: default;
  border-right: 0;
  border-left: 0;
  border-radius: 0;
  box-shadow: none;
}

.question-feed-kind-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--brand-primary);
  font-weight: 700;
  white-space: nowrap;
}

.question-feed-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 2px 0 7px;
}

.question-feed-kind-badge {
  flex: 0 0 auto;
  margin-top: 2px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--brand-soft);
  font-size: 12px;
}

.question-feed-title {
  min-width: 0;
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.question-feed-related-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 8px;
}

.question-feed-related-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 9px 11px;
  border-radius: 11px;
  background: var(--background-secondary);
  cursor: pointer;
}

.question-feed-related-card:hover { background: var(--surface-hover, var(--background-secondary)); }

:deep(.question-feed-related-image) {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  overflow: hidden;
  border-radius: 9px;
  background: var(--surface);
}

.question-feed-related-icon {
  display: grid;
  flex: 0 0 44px;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--brand-primary);
  border-radius: 9px;
  background: var(--surface);
}

.question-feed-related-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.question-feed-related-copy small { color: var(--brand-primary); font-size: 11px; }
.question-feed-related-copy strong,
.question-feed-related-copy em { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.question-feed-related-copy strong { color: var(--text-primary); font-size: 14px; }
.question-feed-related-copy em { color: var(--text-tertiary); font-size: 12px; font-style: normal; }
.question-feed-related-arrow { color: var(--text-tertiary); font-size: 12px; }

.question-feed-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.question-feed-stats,
.question-feed-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.question-feed-stats {
  color: var(--text-tertiary);
  font-size: 12px;
}

.question-feed-stats span { display: inline-flex; align-items: center; gap: 5px; }
.question-feed-stats i { color: var(--brand-primary); }

.question-feed-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 31px;
  gap: 5px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--surface);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.question-feed-action:hover:not(:disabled),
.question-feed-action.active,
.question-feed-answer-action {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.question-feed-action:disabled { opacity: .55; cursor: wait; }

@media (max-width: 640px) {
  .question-feed-card { padding: 14px; border-right: 0; border-left: 0; border-radius: 0; }
  .question-feed-title { font-size: 18px; }
  .question-feed-footer { align-items: flex-start; flex-direction: column; }
  .question-feed-actions { width: 100%; }
  .question-feed-action { flex: 1; }
}
</style>
