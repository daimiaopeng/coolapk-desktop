<template>
  <section
    class="mobile-home-feature"
    data-mobile-feature="home"
    aria-label="首页动态"
  >
    <MobileFeedPage
      v-if="isStandalone"
      mode="home"
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
      @open-channel-manager="emit('open-channel-manager')"
    >
      <template v-if="$slots.header" #header="slotProps"><slot name="header" v-bind="slotProps" /></template>
      <template #before="slotProps">
        <section class="mobile-home-apk-header" aria-label="首页快捷内容">
          <button type="button" class="mobile-home-banner" @click="openHomeShortcut('/headline')">
            <span class="mobile-home-banner__mark">CA</span>
            <span class="mobile-home-banner__copy">
              <strong>酷安精选</strong>
              <small>玩数码，上酷安，真实有趣的数码社区</small>
            </span>
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>

          <nav class="mobile-home-shortcuts" aria-label="首页快捷栏目">
            <button type="button" @click="openHomeShortcut('/headline?tab=worth')">
              <span class="tone-blue"><i class="fas fa-check-double"></i></span><strong>值得看</strong>
            </button>
            <button type="button" @click="openHomeShortcut('/headline?tab=hot')">
              <span class="tone-orange"><i class="fas fa-newspaper"></i></span><strong>热闻</strong>
            </button>
            <button type="button" @click="openHomeShortcut('/events')">
              <span class="tone-red"><i class="fas fa-gift"></i></span><strong>活动</strong>
            </button>
            <button type="button" @click="openHomeShortcut('/discover')">
              <span class="tone-blue"><i class="fas fa-robot"></i></span><strong>AI</strong>
            </button>
            <button type="button" @click="openHomeShortcut('/topic/人像摄影')">
              <span class="tone-cyan"><i class="fas fa-user-astronaut"></i></span><strong>人像摄影</strong>
            </button>
          </nav>

          <div class="mobile-home-hot-products" aria-label="热门数码">
            <button type="button" @click="openHomeShortcut('/product-selector')"><i class="fas fa-mobile-screen-button"></i> 红魔 10S Pro</button>
            <button type="button" @click="openHomeShortcut('/product-selector')"><i class="fas fa-mobile-screen-button"></i> 红魔 10S Pro+</button>
            <button type="button" @click="openHomeShortcut('/product-selector')"><i class="fas fa-mobile-screen-button"></i> 红魔 10 Pro</button>
          </div>
        </section>
        <slot v-if="$slots.before" name="before" v-bind="slotProps" />
      </template>
      <template v-if="$slots.loading" #loading="slotProps"><slot name="loading" v-bind="slotProps" /></template>
      <template v-if="$slots.error" #error="slotProps"><slot name="error" v-bind="slotProps" /></template>
      <template v-if="$slots.empty" #empty="slotProps"><slot name="empty" v-bind="slotProps" /></template>
      <template v-if="$slots.feed" #feed="slotProps"><slot name="feed" v-bind="slotProps" /></template>
    </MobileFeedPage>

    <div v-else class="mobile-home-feature__surface">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { useRouter } from 'vue-router';
import MobileFeedPage from './MobileFeedPage.vue';
import type { FeedItem } from '../../../types/feed';

defineOptions({ name: 'MobileHomeFeature' });

const props = defineProps<{
  standalone?: boolean;
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
  (event: 'open-channel-manager'): void;
}>();

const slots = useSlots();
const router = useRouter();
const isStandalone = computed(() => props.standalone ?? !Boolean(slots.default));

function openHomeShortcut(path: string) {
  void router.push(path);
}
</script>

<style scoped>
.mobile-home-feature {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background-secondary, #f5f7f9);
  color: var(--text-primary);
}

.mobile-home-feature__surface {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.mobile-home-feature__surface :deep(.home-page-layout) {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--background-secondary, #f5f7f9);
}

.mobile-home-feature__surface :deep(.main-feed-column) {
  border-right: 0;
  background: transparent;
}

.mobile-home-feature__surface :deep(.feed-toolbar-row) {
  min-height: 48px;
  border-bottom-color: var(--border-light, rgba(15, 23, 42, 0.08));
  background: color-mix(in srgb, var(--surface, #fff) 96%, transparent);
  backdrop-filter: blur(12px);
}

.mobile-home-feature__surface :deep(.feed-toolbar-row button) {
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
}

.mobile-home-feature__surface :deep(.feed-toolbar-row .feed-layout-toggle) {
  display: none;
}

.mobile-home-feature__surface :deep(.follow-subchannel-bar) {
  min-height: 48px;
  padding: 0 var(--mobile-page-padding, 10px);
}

.mobile-home-feature__surface :deep(.follow-subchannel-item) {
  min-height: 40px;
  padding: 8px 12px;
  -webkit-tap-highlight-color: transparent;
}

.mobile-home-feature__surface :deep(.feed-scroll-container) {
  background: var(--background-secondary, #f5f7f9);
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}

.mobile-home-feature__surface :deep(.feed-list-padding),
.mobile-home-feature__surface :deep(.feed-list-padding.is-double-column) {
  display: flex;
  flex-direction: column;
  gap: var(--mobile-feed-gap, 8px);
  width: 100%;
  min-width: 0;
  padding: var(--mobile-feed-gap, 8px) var(--mobile-page-padding, 10px) 24px;
  column-count: auto;
  column-gap: 0;
}

.mobile-home-feature__surface :deep(.feed-list-padding .feed-card),
.mobile-home-feature__surface :deep(.feed-list-padding.is-double-column .feed-card) {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 14px var(--mobile-page-padding, 10px);
  border: 1px solid var(--border-light, rgba(15, 23, 42, 0.08));
  border-radius: 16px;
  background: var(--surface, #fff);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  break-inside: auto;
}

.mobile-home-feature__surface :deep(.home-page-entity-list),
.mobile-home-feature__surface :deep(.headline-discovery-list),
.mobile-home-feature__surface :deep(.dyh-tab-grid) {
  display: flex;
  flex-direction: column;
  gap: var(--mobile-feed-gap, 8px);
  padding: var(--mobile-feed-gap, 8px) var(--mobile-page-padding, 10px) 24px;
}

.mobile-home-feature__surface :deep(.headline-ranking-list) {
  display: flex;
  flex-direction: column;
  gap: var(--mobile-feed-gap, 8px);
  padding: var(--mobile-feed-gap, 8px) var(--mobile-page-padding, 10px) 24px;
  grid-template-columns: none;
  grid-template-rows: none;
  grid-auto-flow: row;
}

.mobile-home-feature__surface :deep(.headline-ranking-card),
.mobile-home-feature__surface :deep(.dyh-tab-card) {
  min-height: 72px;
  margin: 0;
  border-radius: 16px;
}

.mobile-home-feature__surface :deep(.quick-icons-grid),
.mobile-home-feature__surface :deep(.hot-ranks-row),
.mobile-home-feature__surface :deep(.hot-search-chips) {
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-home-feature__surface :deep(.icon-btn-item),
.mobile-home-feature__surface :deep(.rank-action-item),
.mobile-home-feature__surface :deep(.chip-btn) {
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
}

.mobile-home-feature__surface :deep(.feed-action-bar) {
  gap: 4px;
  margin-top: 12px;
  padding: 8px 2px 0;
}

.mobile-home-feature__surface :deep(.feed-action-bar .action-btn),
.mobile-home-feature__surface :deep(.feed-action-bar .interaction-count-btn) {
  min-width: 44px;
  min-height: 44px;
  padding: 8px 6px;
  border-radius: 12px;
  -webkit-tap-highlight-color: transparent;
}

.mobile-home-feature__surface :deep(.feed-action-bar .comment-btn) {
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, 0.1));
}

.mobile-home-apk-header {
  display: grid;
  gap: 10px;
  padding: 10px 10px 2px;
  background: #f2f2f6;
}

.mobile-home-banner {
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 132px;
  padding: 20px 18px;
  border: 0;
  border-radius: 20px;
  background: linear-gradient(135deg, #e8f8f0 0%, #c9efdd 100%);
  color: #1d2924;
  font: inherit;
  text-align: left;
  touch-action: manipulation;
}

.mobile-home-banner__mark {
  display: grid;
  place-items: center;
  flex: 0 0 54px;
  width: 54px;
  height: 54px;
  border-radius: 17px;
  background: #0f9d58;
  color: #fff;
  font-size: 19px;
  font-weight: 850;
  letter-spacing: -2px;
}

.mobile-home-banner__copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.mobile-home-banner__copy strong { font-size: 24px; }
.mobile-home-banner__copy small { color: #57806a; font-size: 13px; }
.mobile-home-banner > i { color: #0f9d58; font-size: 18px; }

.mobile-home-shortcuts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 5px 0;
}

.mobile-home-shortcuts button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 7px 2px;
  border: 0;
  background: transparent;
  color: #2c2c2e;
  font: inherit;
  font-size: 13px;
  touch-action: manipulation;
}

.mobile-home-shortcuts button > span {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(30, 30, 35, .05);
  font-size: 23px;
}

.mobile-home-shortcuts strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-home-shortcuts .tone-blue { color: #268de8; }
.mobile-home-shortcuts .tone-orange { color: #ee9418; }
.mobile-home-shortcuts .tone-red { color: #f2524a; }
.mobile-home-shortcuts .tone-cyan { color: #08b5c8; }

.mobile-home-hot-products {
  display: flex;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.mobile-home-hot-products::-webkit-scrollbar { display: none; }
.mobile-home-hot-products button {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 6px;
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: 13px;
  background: #fff;
  color: #343437;
  font: inherit;
  font-size: 13px;
  touch-action: manipulation;
}
.mobile-home-hot-products i { color: #9a9aa0; }

@media (min-width: 720px) {
  .mobile-home-apk-header { width: min(100%, 720px); margin-inline: auto; padding-inline: 0; }
}
</style>
