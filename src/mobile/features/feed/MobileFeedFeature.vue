<template>
  <section
    class="mobile-feed-feature"
    data-mobile-feature="feed"
    aria-label="动态内容"
  >
    <MobileFeedPage
      v-if="isStandalone"
      mode="feed"
      :title="title"
      :feeds="feeds"
      :loading="loading"
      :loading-more="loadingMore"
      :error="error"
      :has-more="hasMore"
      :tabs="tabs"
      :active-tab="activeTab"
      @update:active-tab="emit('update:activeTab', $event)"
      @tab-change="emit('tab-change', $event)"
      @refresh="emit('refresh')"
      @load-more="emit('load-more')"
      @open-feed="emit('open-feed', $event)"
      @open-user="emit('open-user', $event)"
      @open-topic="emit('open-topic', $event)"
      @open-comment="emit('open-comment', $event)"
      @toggle-like="emit('toggle-like', $event)"
      @toggle-favorite="emit('toggle-favorite', $event)"
      @share="emit('share', $event)"
      @follow="emit('follow', $event)"
      @more="emit('more', $event)"
    >
      <template v-if="$slots.header" #header="slotProps"><slot name="header" v-bind="slotProps" /></template>
      <template v-if="$slots.before" #before="slotProps"><slot name="before" v-bind="slotProps" /></template>
      <template v-if="$slots.loading" #loading="slotProps"><slot name="loading" v-bind="slotProps" /></template>
      <template v-if="$slots.error" #error="slotProps"><slot name="error" v-bind="slotProps" /></template>
      <template v-if="$slots.empty" #empty="slotProps"><slot name="empty" v-bind="slotProps" /></template>
      <template v-if="$slots.feed" #feed="slotProps"><slot name="feed" v-bind="slotProps" /></template>
    </MobileFeedPage>

    <div v-else class="mobile-feed-feature__surface">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import MobileFeedPage from './MobileFeedPage.vue';
import type { FeedItem } from '../../../types/feed';

defineOptions({ name: 'MobileFeedFeature' });

const props = defineProps<{
  standalone?: boolean;
  title?: string;
  feeds?: readonly FeedItem[];
  loading?: boolean;
  loadingMore?: boolean;
  error?: string;
  hasMore?: boolean;
  tabs?: readonly { key: string; title: string; badge?: string | number; disabled?: boolean }[];
  activeTab?: string;
}>();

const emit = defineEmits<{
  (event: 'update:activeTab', key: string): void;
  (event: 'tab-change', key: string): void;
  (event: 'refresh'): void;
  (event: 'load-more'): void;
  (event: 'open-feed', feed: FeedItem): void;
  (event: 'open-user', uid: string): void;
  (event: 'open-topic', topic: string): void;
  (event: 'open-comment', feed: FeedItem): void;
  (event: 'toggle-like', payload: unknown): void;
  (event: 'toggle-favorite', payload: unknown): void;
  (event: 'share', feed: FeedItem): void;
  (event: 'follow', payload: unknown): void;
  (event: 'more', feed: FeedItem): void;
}>();

const slots = useSlots();
const isStandalone = computed(() => props.standalone ?? !Boolean(slots.default));
</script>

<style scoped>
.mobile-feed-feature {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background-secondary, #f5f7f9);
  color: var(--text-primary);
}

.mobile-feed-feature__surface {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.mobile-feed-feature__surface :deep(.feed-scroll-container),
.mobile-feed-feature__surface :deep(.feed-detail-page) {
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}

.mobile-feed-feature__surface :deep(.feed-list-padding),
.mobile-feed-feature__surface :deep(.feed-list-padding.is-double-column) {
  display: flex;
  flex-direction: column;
  gap: var(--mobile-feed-gap, 8px);
  width: 100%;
  min-width: 0;
  padding: var(--mobile-feed-gap, 8px) var(--mobile-page-padding, 10px) 24px;
  column-count: auto;
  column-gap: 0;
}

.mobile-feed-feature__surface :deep(.feed-card) {
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 14px var(--mobile-page-padding, 10px);
  border: 1px solid var(--border-light, rgba(15, 23, 42, 0.08));
  border-radius: 16px;
  background: var(--surface, #fff);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.mobile-feed-feature__surface :deep(.feed-action-bar) {
  gap: 4px;
  margin-top: 12px;
  padding: 8px 2px 0;
}

.mobile-feed-feature__surface :deep(.feed-action-bar .action-btn),
.mobile-feed-feature__surface :deep(.feed-action-bar .interaction-count-btn) {
  min-width: 44px;
  min-height: 44px;
  padding: 8px 6px;
  border-radius: 12px;
  -webkit-tap-highlight-color: transparent;
}

.mobile-feed-feature__surface :deep(.feed-action-bar .action-btn:active),
.mobile-feed-feature__surface :deep(.feed-action-bar .interaction-count-btn:active) {
  transform: scale(0.97);
}

.mobile-feed-feature__surface :deep(.feed-action-bar .comment-btn) {
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, 0.1));
}

.mobile-feed-feature__surface :deep(.inline-comment-wrapper) {
  margin-top: 12px;
  padding-top: 8px;
}

.mobile-feed-feature__surface :deep(.feed-comment-section) {
  margin-top: 0;
  padding: 12px;
  border-radius: 16px;
  background: var(--surface-muted, var(--background));
}

.mobile-feed-feature__surface :deep(.comment-sort-button),
.mobile-feed-feature__surface :deep(.comment-toolbar-collapse-btn),
.mobile-feed-feature__surface :deep(.composer-tool-btn),
.mobile-feed-feature__surface :deep(.comment-like-btn),
.mobile-feed-feature__surface :deep(.comment-reply-btn),
.mobile-feed-feature__surface :deep(.comment-delete-btn) {
  min-height: 40px;
  -webkit-tap-highlight-color: transparent;
}
</style>
