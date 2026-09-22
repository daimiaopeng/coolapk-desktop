<template>
  <section class="mobile-market-feature" data-mobile-feature="market">
    <header v-if="props.title || $slots.header || props.tabs.length || $slots.tabs || props.filters.length || $slots.filters" class="mobile-market-toolbar">
      <div v-if="props.title || $slots.header" class="mobile-feature-heading">
        <h1 v-if="props.title" class="mobile-feature-title">{{ props.title }}</h1>
        <slot name="header" />
      </div>

      <nav v-if="props.tabs.length || $slots.tabs" class="mobile-feature-tabs" role="tablist" aria-label="市场分类">
        <button
          v-for="tab in props.tabs"
          :key="tab.key"
          type="button"
          class="mobile-feature-tab"
          role="tab"
          :class="{ active: props.activeTab === tab.key }"
          :aria-selected="props.activeTab === tab.key"
          :disabled="tab.disabled"
          @click="selectTab(tab.key)"
        >
          <i v-if="tab.icon" :class="tab.icon" aria-hidden="true"></i>
          <span>{{ tab.label }}</span>
          <span v-if="tab.badge !== undefined" class="mobile-feature-badge">{{ tab.badge }}</span>
        </button>
        <slot name="tabs" />
      </nav>

      <div v-if="props.filters.length || $slots.filters" class="mobile-feature-filters" aria-label="市场筛选">
        <button
          v-for="filter in props.filters"
          :key="filter.key"
          type="button"
          class="mobile-feature-filter"
          :class="{ active: props.activeFilter === filter.key }"
          :aria-pressed="props.activeFilter === filter.key"
          :disabled="filter.disabled"
          @click="selectFilter(filter.key)"
        >
          <i v-if="filter.icon" :class="filter.icon" aria-hidden="true"></i>
          <span>{{ filter.label }}</span>
          <span v-if="filter.badge !== undefined" class="mobile-feature-badge">{{ filter.badge }}</span>
        </button>
        <slot name="filters" />
      </div>
    </header>

    <div class="mobile-market-content" data-feature-content>
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MobileSurfaceFilter, MobileSurfaceTab } from './types';

const props = withDefaults(
  defineProps<{
    title?: string;
    tabs?: readonly MobileSurfaceTab[];
    activeTab?: string;
    filters?: readonly MobileSurfaceFilter[];
    activeFilter?: string;
  }>(),
  {
    tabs: () => [],
    filters: () => [],
  },
);

const emit = defineEmits<{
  (event: 'update:activeTab', key: string): void;
  (event: 'tab-change', key: string): void;
  (event: 'update:activeFilter', key: string): void;
  (event: 'filter-change', key: string): void;
}>();

function selectTab(key: string) {
  emit('update:activeTab', key);
  emit('tab-change', key);
}

function selectFilter(key: string) {
  emit('update:activeFilter', key);
  emit('filter-change', key);
}
</script>

<style scoped>
.mobile-market-feature {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--background, #f6f8fa);
  color: var(--text-primary, #1f2937);
}

.mobile-market-toolbar {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
  padding: 10px clamp(12px, 3vw, 20px) 0;
  border-bottom: 1px solid var(--border-light, rgba(15, 23, 42, .08));
  background: var(--surface, #fff);
}

.mobile-feature-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  padding-bottom: 4px;
}

.mobile-feature-title {
  min-width: 0;
  margin: 0;
  color: var(--text-primary, #1f2937);
  font-size: 18px;
  line-height: 1.35;
}

.mobile-feature-tabs,
.mobile-feature-filters {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.mobile-feature-tabs {
  overflow-x: auto;
  padding: 2px 0 0;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-feature-tabs::-webkit-scrollbar {
  display: none;
}

.mobile-feature-filters {
  flex-wrap: wrap;
  padding: 6px 0 10px;
}

.mobile-feature-tab,
.mobile-feature-filter {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  border: 0;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 1.25;
  -webkit-tap-highlight-color: transparent;
}

.mobile-feature-tab {
  position: relative;
  padding: 0 10px;
  background: transparent;
  white-space: nowrap;
}

.mobile-feature-tab::after {
  position: absolute;
  right: 10px;
  bottom: -1px;
  left: 10px;
  height: 3px;
  border-radius: 999px;
  background: transparent;
  content: '';
}

.mobile-feature-tab.active {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.mobile-feature-tab.active::after {
  background: var(--brand-primary, #10b981);
}

.mobile-feature-filter {
  padding: 8px 12px;
  border: 1px solid var(--border-light, rgba(15, 23, 42, .1));
  border-radius: 999px;
  background: var(--surface-hover, #f1f5f9);
  white-space: normal;
}

.mobile-feature-filter.active {
  border-color: color-mix(in srgb, var(--brand-primary, #10b981) 35%, transparent);
  background: var(--brand-soft, rgba(16, 185, 129, .1));
  color: var(--brand-primary, #10b981);
  font-weight: 650;
}

.mobile-feature-tab:disabled,
.mobile-feature-filter:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.mobile-feature-tab:active,
.mobile-feature-filter:active {
  transform: scale(.98);
}

.mobile-feature-badge {
  min-width: 1.25em;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--surface-active, #e2e8f0);
  color: var(--text-tertiary, #94a3b8);
  font-size: 11px;
  line-height: 1.25;
}

.mobile-market-content {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

:deep(.apps-toolbar-bar),
:deep(.page-header),
:deep(.top-nav-bar) {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 10px;
  min-width: 0;
}

:deep(.apps-toolbar-bar),
:deep(.page-header),
:deep(.top-nav-bar),
:deep(.page-container) {
  box-sizing: border-box;
}

:deep(.apps-toolbar-bar),
:deep(.page-header) {
  padding: 10px 0;
}

:deep(.apps-tabs-wrapper),
:deep(.category-tabs),
:deep(.goods-tabs),
:deep(.filter-options) {
  display: flex;
  min-width: 0;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

:deep(.apps-tabs-wrapper),
:deep(.category-tabs),
:deep(.goods-tabs) {
  flex-wrap: nowrap;
}

:deep(.apps-tabs-wrapper::-webkit-scrollbar),
:deep(.category-tabs::-webkit-scrollbar),
:deep(.goods-tabs::-webkit-scrollbar),
:deep(.filter-options::-webkit-scrollbar) {
  display: none;
}

:deep(.apps-actions-wrapper),
:deep(.header-main),
:deep(.search-mode-switch) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

:deep(.apps-actions-wrapper),
:deep(.header-main) {
  flex: 1 1 100%;
}

:deep(.search-mode-switch) {
  flex: 1 1 auto;
}

:deep(.search-box) {
  display: flex;
  flex: 1 1 220px;
  min-width: min(100%, 220px);
  min-height: 44px;
}

:deep(.search-input) {
  min-width: 0;
  min-height: 42px;
}

:deep(.cat-tab),
:deep(.mode-btn),
:deep(.filter-option),
:deep(.coupon-toggle),
:deep(.goods-tab) {
  min-height: 44px;
  touch-action: manipulation;
}

:deep(.apps-grid),
:deep(.games-grid),
:deep(.goods-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 10px;
}

:deep(.app-card),
:deep(.game-card),
:deep(.goods-card) {
  min-width: 0;
  padding: 12px;
  border-radius: 14px;
}

:deep(.app-card),
:deep(.game-card) {
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

:deep(.app-info),
:deep(.game-info),
:deep(.goods-body) {
  min-width: 0;
}

:deep(.app-info),
:deep(.game-info) {
  flex: 1 1 160px;
}

:deep(.app-card .action-btn),
:deep(.game-card .action-btn),
:deep(.top-nav-bar > button) {
  min-height: 44px;
}

:deep(.goods-page) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

:deep(.goods-tabs) {
  flex: 0 0 auto;
  height: auto;
  min-height: 48px;
  padding: 0 4px;
}

:deep(.goods-content) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

:deep(.filter-bar) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 0 12px;
}

:deep(.filter-options) {
  flex: 1 1 200px;
  flex-wrap: wrap;
  overflow-x: visible;
}

:deep(.hot-words-wrap),
:deep(.history-wrap),
:deep(.goods-tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.hot-word-chip),
:deep(.history-chip),
:deep(.filter-option),
:deep(.coupon-toggle) {
  min-height: 44px;
}

:deep(.market-page button),
:deep(.mobile-market-content button),
:deep(.mobile-market-content input) {
  touch-action: manipulation;
}
</style>
