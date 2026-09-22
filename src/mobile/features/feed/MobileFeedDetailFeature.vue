<template>
  <section
    class="mobile-feed-detail-feature"
    data-mobile-feature="feed-detail"
    aria-label="动态详情"
  >
    <MobileFeedPage
      v-if="isStandalone"
      mode="detail"
      :title="title"
      :feed-id="feedId"
      :feed="feed"
      :loading="loading"
      :error="error"
      :comments="comments"
      :comment-loading="commentLoading"
      :comment-loading-more="commentLoadingMore"
      :comment-error="commentError"
      :comment-has-more="commentHasMore"
      :comment-total="commentTotal"
      @refresh="emit('refresh')"
      @open-feed="emit('open-feed', $event)"
      @open-user="emit('open-user', $event)"
      @open-topic="emit('open-topic', $event)"
      @open-comment="emit('open-comment', $event)"
      @toggle-like="emit('toggle-like', $event)"
      @toggle-favorite="emit('toggle-favorite', $event)"
      @share="emit('share', $event)"
      @follow="emit('follow', $event)"
      @more="emit('more', $event)"
      @comment-sort-change="emit('comment-sort-change', $event)"
      @comment-reply="emit('comment-reply', $event)"
      @load-replies="emit('load-replies', $event)"
    >
      <template v-if="$slots.header" #header="slotProps"><slot name="header" v-bind="slotProps" /></template>
      <template v-if="$slots.loading" #loading="slotProps"><slot name="loading" v-bind="slotProps" /></template>
      <template v-if="$slots.error" #error="slotProps"><slot name="error" v-bind="slotProps" /></template>
      <template v-if="$slots.empty" #empty="slotProps"><slot name="empty" v-bind="slotProps" /></template>
      <template v-if="$slots.detail" #detail="slotProps"><slot name="detail" v-bind="slotProps" /></template>
      <template v-if="$slots.comments" #comments="slotProps"><slot name="comments" v-bind="slotProps" /></template>
    </MobileFeedPage>

    <div v-else class="mobile-feed-detail-feature__surface">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import MobileFeedPage from './MobileFeedPage.vue';
import type { FeedItem } from '../../../types/feed';

defineOptions({ name: 'MobileFeedDetailFeature' });

const props = defineProps<{
  standalone?: boolean;
  title?: string;
  feedId?: string | number;
  feed?: FeedItem | null;
  loading?: boolean;
  error?: string;
  comments?: readonly any[];
  commentLoading?: boolean;
  commentLoadingMore?: boolean;
  commentError?: string;
  commentHasMore?: boolean;
  commentTotal?: number;
}>();

const emit = defineEmits<{
  (event: 'refresh'): void;
  (event: 'open-feed', feed: FeedItem): void;
  (event: 'open-user', uid: string): void;
  (event: 'open-topic', topic: string): void;
  (event: 'open-comment', feed: FeedItem): void;
  (event: 'toggle-like', payload: unknown): void;
  (event: 'toggle-favorite', payload: unknown): void;
  (event: 'share', feed: FeedItem): void;
  (event: 'follow', payload: unknown): void;
  (event: 'more', feed: FeedItem): void;
  (event: 'comment-sort-change', payload: unknown): void;
  (event: 'comment-reply', comment: any): void;
  (event: 'load-replies', comment: any): void;
}>();

const slots = useSlots();
const isStandalone = computed(() => props.standalone ?? !Boolean(slots.default));
</script>

<style scoped>
.mobile-feed-detail-feature {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background-secondary, #f5f7f9);
  color: var(--text-primary);
}

.mobile-feed-detail-feature__surface {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.mobile-feed-detail-feature__surface :deep(.feed-detail-page) {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  background: var(--background-secondary, #f5f7f9);
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}

.mobile-feed-detail-feature__surface :deep(.feed-detail-shell) {
  width: 100%;
  max-width: 100%;
  padding: 0 0 max(32px, env(safe-area-inset-bottom, 0px));
}

.mobile-feed-detail-feature__surface :deep(.feed-detail-shell .feed-card),
.mobile-feed-detail-feature__surface :deep(.feed-detail-shell .question-answer-card) {
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 16px var(--mobile-page-padding, 10px) 20px;
  border: 0;
  border-radius: 0;
  background: var(--surface, #fff);
  box-shadow: none;
}

.mobile-feed-detail-feature__surface :deep(.feed-detail-shell .feed-action-bar) {
  display: flex;
  gap: 4px;
  margin-top: 16px;
  padding: 8px 4px 4px;
  border: 1px solid var(--border-light, rgba(15, 23, 42, 0.08));
  border-radius: 16px;
  background: var(--surface-muted, var(--background));
}

.mobile-feed-detail-feature__surface :deep(.feed-detail-shell .feed-action-bar .action-btn),
.mobile-feed-detail-feature__surface :deep(.feed-detail-shell .feed-action-bar .interaction-count-btn) {
  min-width: 44px;
  min-height: 44px;
  padding: 8px 6px;
  border-radius: 12px;
  -webkit-tap-highlight-color: transparent;
}

.mobile-feed-detail-feature__surface :deep(.feed-detail-shell .feed-action-bar .comment-btn) {
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, 0.12));
}

.mobile-feed-detail-feature__surface :deep(.feed-detail-shell .inline-comment-wrapper) {
  margin-top: 12px;
  padding-top: 0;
  border-top: 0;
}

.mobile-feed-detail-feature__surface :deep(.feed-detail-shell .feed-comment-section) {
  margin-top: 0;
  padding: 12px;
  border: 1px solid var(--border-light, rgba(15, 23, 42, 0.08));
  border-radius: 16px;
  background: var(--surface-muted, var(--background));
}

.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-toolbar) {
  align-items: flex-start;
  gap: 10px;
}

.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-toolbar-left) {
  min-width: 0;
  gap: 8px;
}

.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-sort) {
  max-width: 100%;
}

.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-sort-button),
.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-toolbar-collapse-btn),
.mobile-feed-detail-feature__surface :deep(.feed-comment-section .composer-tool-btn) {
  min-height: 40px;
  -webkit-tap-highlight-color: transparent;
}

.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-composer-box) {
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 14px;
  background: var(--surface, #fff);
}

.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-rich-editor) {
  min-height: 72px;
  padding: 8px 2px;
  line-height: 1.55;
}

.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-actions),
.mobile-feed-detail-feature__surface :deep(.feed-comment-section .sub-reply-actions) {
  gap: 8px;
}

.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-like-btn),
.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-reply-btn),
.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-delete-btn) {
  min-height: 40px;
  padding: 6px 8px;
  border-radius: 10px;
  -webkit-tap-highlight-color: transparent;
}

.mobile-feed-detail-feature__surface :deep(.feed-comment-section .comment-load-more) {
  min-height: 48px;
}
</style>
