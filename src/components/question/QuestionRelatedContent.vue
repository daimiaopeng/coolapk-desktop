<template>
  <div v-if="targetRows.length" class="question-related-list">
    <div
      v-for="(target, index) in targetRows"
      :key="getTargetKey(target, index)"
      class="question-related-card"
      @click.stop="openTarget(target)"
    >
      <div class="question-related-main">
        <div v-if="getTargetImage(target)" class="question-related-image-wrap">
          <AppImage
            :src="getTargetImage(target)"
            :alt="getTargetTitle(target)"
            image-class="question-related-image"
            fit="contain"
          />
        </div>
        <div v-else class="question-related-image-wrap question-related-placeholder">
          <i :class="targetIconClass(target)" aria-hidden="true"></i>
        </div>
        <div class="question-related-copy">
          <span class="question-related-type">{{ getTargetTypeLabel(target) }}</span>
          <strong class="question-related-title">{{ getTargetTitle(target) || '关联内容' }}</strong>
          <span v-if="getTargetSubtitle(target)" class="question-related-subtitle">{{ getTargetSubtitle(target) }}</span>
          <span v-if="getTargetMetricText(target)" class="question-related-metrics">{{ getTargetMetricText(target) }}</span>
        </div>
      </div>
      <i class="fas fa-chevron-right question-related-arrow" aria-hidden="true"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { FeedItem } from '../../types/feed';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppImage from '../common/AppImage.vue';
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';
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
import { showToast } from '../../utils/toast';

const props = defineProps<{ content: FeedItem | Record<string, any> }>();

const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();

const targetRows = computed<any[]>(() => {
  const content = props.content as any;
  const base = content.targetRow || content.target_row || content.targetFeed || content.feedInfo;
  const candidates = [base, ...getFeedRelationRows(content)]
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  const seen = new Set<string>();
  return candidates.filter((item, index) => {
    const key = getFeedRelationKey(item, index);
    if (seen.has(key)) return false;
    seen.add(key);
    const type = getFeedRelationType(item);
    return !['feed', 'feed_reply', 'feedreply', 'article'].includes(type)
      && Boolean(getFeedRelationTitle(item) || getFeedRelationImage(item) || item.id || item.entityId || item.url || type);
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
  if (type.includes('goods') || type.includes('mall')) return '好物';
  return '关联内容';
}

function targetIconClass(target: any): string {
  const type = getFeedRelationType(target);
  const title = getTargetTitle(target).toLowerCase();
  if (type.includes('product') || type.includes('device') || /pro|ultra|phone|mate|pura/.test(title)) return 'fas fa-mobile-screen';
  if (type.includes('apk') || type.includes('app')) return 'fas fa-cubes';
  if (type.includes('topic') || type.includes('node') || type.includes('tag')) return 'fas fa-hashtag';
  if (type.includes('goods') || type.includes('mall')) return 'fas fa-bag-shopping';
  return 'fas fa-tag';
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
    showToast(getErrorMessage(error, next ? '关注数码失败' : '取消关注数码失败'), 'error');
  } finally {
    const pending = { ...targetFollowPending.value };
    delete pending[id];
    targetFollowPending.value = pending;
  }
}

function openRelatedPost() { appStore.openPublish(); }

function openTarget(target: any) {
  const targetUrl = target?.url || target?.targetUrl || target?.target_url || target?.webUrl || target?.web_url;
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
  const packageName = target?.packageName || target?.package_name || target?.apkName || target?.apkname;
  const topicTag = target?.tag || target?.topicTag || target?.topic_tag || target?.title || target?.name || id;
  if (packageName && (type.includes('apk') || type.includes('app') || type.includes('game'))) {
    const appRoute = normalizeCoolapkNativeRoute(`/apk/${String(packageName)}`);
    if (appRoute) void router.push(appRoute);
    return;
  }
  if (type.includes('topic') || type.includes('node') || type.includes('tag')) {
    if (topicTag) void router.push(`/topic/${encodeURIComponent(String(topicTag))}`);
    return;
  }
  if (id && (type.includes('product') || type.includes('device') || type === '7')) void router.push(`/product/${encodeURIComponent(id)}`);
}
</script>

<style scoped>
.question-related-list { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 6px 0 8px; }
.question-related-card { display: inline-flex; align-items: center; gap: 6px; min-width: 0; min-height: 32px; padding: 4px 8px; border: 1px solid var(--border-light); border-radius: 999px; background: var(--background-secondary); cursor: pointer; transition: background .18s ease, border-color .18s ease, transform .18s ease; }
.question-related-card:hover { background: var(--surface-hover, var(--background-secondary)); border-color: rgba(16, 185, 129, .35); transform: translateY(-1px); }
.question-related-main { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.question-related-image-wrap { display: grid; flex: 0 0 20px; place-items: center; width: 20px; height: 20px; overflow: hidden; border-radius: 4px; background: var(--surface); }
.question-related-placeholder { color: var(--brand-primary); font-size: 12px; }
:deep(.question-related-image) { width: 20px; height: 20px; }
.question-related-copy { display: inline-flex; align-items: baseline; min-width: 0; gap: 6px; }
.question-related-type { display: none; }
.question-related-title { overflow: hidden; max-width: 240px; color: var(--text-primary); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.question-related-subtitle, .question-related-metrics { overflow: hidden; max-width: 140px; color: var(--text-tertiary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.question-related-metrics { color: var(--text-secondary); }
.question-related-arrow { flex: 0 0 auto; color: var(--text-tertiary); font-size: 10px; opacity: .5; }

@media (max-width: 640px) {
  .question-related-title { max-width: 180px; }
}
</style>
