<template>
  <section class="mobile-product-feature" data-mobile-feature="product">
    <header v-if="props.title || $slots.header || props.tabs.length || $slots.tabs || props.filters.length || $slots.filters" class="mobile-product-toolbar">
      <div v-if="props.title || $slots.header" class="mobile-feature-heading">
        <h1 v-if="props.title" class="mobile-feature-title">{{ props.title }}</h1>
        <slot name="header" />
      </div>

      <nav v-if="props.tabs.length || $slots.tabs" class="mobile-feature-tabs" role="tablist" aria-label="产品分类">
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

      <div v-if="props.filters.length || $slots.filters" class="mobile-feature-filters" aria-label="产品筛选">
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

    <div class="mobile-product-content" data-feature-content>
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
.mobile-product-feature {
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

.mobile-product-toolbar {
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

.mobile-product-content {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

:deep(.page-container) {
  width: 100%;
  max-width: none;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
}

:deep(.product-category-page),
:deep(.digital-page),
:deep(.product-category-page.page-container),
:deep(.digital-page.page-container) {
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

:deep(.product-category-page),
:deep(.digital-page) {
  overflow: hidden;
}

:deep(.category-toolbar),
:deep(.digital-subtabs),
:deep(.product-sub-tabs),
:deep(.media-sub-tabs),
:deep(.detail-tabs) {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

:deep(.category-toolbar::-webkit-scrollbar),
:deep(.digital-subtabs::-webkit-scrollbar),
:deep(.product-sub-tabs::-webkit-scrollbar),
:deep(.media-sub-tabs::-webkit-scrollbar),
:deep(.detail-tabs::-webkit-scrollbar) {
  display: none;
}

:deep(.category-toolbar) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
}

:deep(.mode-switch),
:deep(.category-search),
:deep(.digital-search),
:deep(.digital-content-toolbar),
:deep(.config-toolbar),
:deep(.rating-list-head) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

:deep(.category-search),
:deep(.digital-search) {
  flex: 1 1 220px;
  min-height: 44px;
}

:deep(.category-search input),
:deep(.digital-search input) {
  min-width: 0;
  min-height: 40px;
}

:deep(.mode-btn),
:deep(.mode-button),
:deep(.digital-subtab),
:deep(.product-tab-item),
:deep(.media-filter-btn),
:deep(.detail-tab-item),
:deep(.view-btn),
:deep(.compare-btn),
:deep(.filter-pill) {
  min-height: 44px;
  touch-action: manipulation;
}

:deep(.category-body) {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

:deep(.digital-body) {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

:deep(.category-side),
:deep(.digital-sidebar) {
  flex: 0 0 auto;
  min-width: 0;
  max-height: 38vh;
  overflow-y: auto;
}

:deep(.side-list),
:deep(.digital-side-list) {
  display: flex;
  flex-direction: row;
  min-width: 0;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 6px 0 10px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

:deep(.side-list::-webkit-scrollbar),
:deep(.digital-side-list::-webkit-scrollbar) {
  display: none;
}

:deep(.side-item),
:deep(.digital-side-item) {
  flex: 0 0 auto;
  min-height: 52px;
  width: auto;
  max-width: 180px;
  touch-action: manipulation;
}

:deep(.category-content),
:deep(.digital-content),
:deep(.digital-server-content) {
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

:deep(.category-content) {
  flex: 1 1 auto;
}

:deep(.category-content-header) {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

:deep(.product-grid),
:deep(.series-products.grid),
:deep(.digital-server-products.grid),
:deep(.media-grid),
:deep(.recommend-grid),
:deep(.related-albums-grid) {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  min-width: 0;
}

:deep(.product-card),
:deep(.config-card),
:deep(.section-card),
:deep(.my-rating-card),
:deep(.rating-list-section) {
  min-width: 0;
  border-radius: 14px;
}

:deep(.product-card),
:deep(.config-card) {
  min-height: 64px;
  touch-action: manipulation;
}

:deep(.product-card-info),
:deep(.config-info),
:deep(.app-main-meta),
:deep(.product-info) {
  min-width: 0;
}

:deep(.product-card-title),
:deep(.config-title),
:deep(.app-title),
:deep(.product-title) {
  overflow-wrap: anywhere;
}

:deep(.product-header-card),
:deep(.app-header-card) {
  min-width: 0;
  padding: 14px;
}

:deep(.header-content),
:deep(.app-header-card),
:deep(.app-detail-content) {
  min-width: 0;
}

:deep(.header-content),
:deep(.app-header-card) {
  flex-wrap: wrap;
}

:deep(.header-actions) {
  flex: 1 1 100%;
  width: 100%;
}

:deep(.wish-btn),
:deep(.buy-btn) {
  min-height: 44px;
  touch-action: manipulation;
}

:deep(.product-icon-wrapper),
:deep(.app-logo-wrapper) {
  flex: 0 0 auto;
}

:deep(.product-stats),
:deep(.sub-row),
:deep(.metrics-cards-row),
:deep(.secondary-actions-row),
:deep(.utility-actions-row),
:deep(.config-actions),
:deep(.rating-options) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.metric-card) {
  flex: 1 1 110px;
  min-width: min(100%, 110px);
}

:deep(.screenshot-carousel) {
  display: flex;
  max-width: 100%;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

:deep(.screenshot-carousel::-webkit-scrollbar) {
  display: none;
}

:deep(.mobile-product-content button),
:deep(.mobile-product-content input) {
  touch-action: manipulation;
}
</style>
