<template>
  <section
    :class="['mobile-social-feature', `mobile-social-feature--${variant}`, { 'mobile-social-feature--static': !scroll }]"
    :data-scroll="scroll ? 'enabled' : 'disabled'"
    :data-mobile-state="featureState"
    data-mobile-feature="social"
    :aria-busy="loading"
    aria-label="社交内容"
  >
    <header
      v-if="showBack || title || subtitle || $slots.header || $slots.actions"
      class="mobile-social-feature__header"
      data-mobile-surface="header"
    >
      <button
        v-if="showBack"
        type="button"
        class="mobile-social-feature__back"
        :aria-label="backLabel"
        @click="handleBack"
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span v-if="backLabel">{{ backLabel }}</span>
      </button>

      <slot name="header" :title="title" :subtitle="subtitle" :back="handleBack">
        <div class="mobile-social-feature__heading">
          <h1 v-if="title">{{ title }}</h1>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </slot>

      <div v-if="$slots.actions" class="mobile-social-feature__header-actions">
        <slot name="actions" />
      </div>
    </header>

    <div v-if="$slots.filters" class="mobile-social-feature__filters" data-mobile-surface="filters">
      <slot name="filters" />
    </div>

    <main
      :class="['mobile-social-feature__surface', { 'mobile-social-feature__surface--scroll': scroll }]"
      data-mobile-surface="list"
      data-route-surface
      data-feature-content
    >
      <div v-if="loading" class="mobile-social-feature__state" role="status" aria-live="polite">
        <slot name="loading">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>正在加载…</span>
        </slot>
      </div>

      <div v-else-if="error" class="mobile-social-feature__state mobile-social-feature__state--error" role="alert">
        <slot name="error">
          <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
          <strong>{{ errorText }}</strong>
          <button type="button" class="mobile-social-feature__retry" @click="handleRetry">重试</button>
        </slot>
      </div>

      <div v-else-if="empty || (items && !items.length && !$slots.default)" class="mobile-social-feature__state">
        <slot name="empty">
          <i class="far fa-folder-open" aria-hidden="true"></i>
          <span>{{ emptyText }}</span>
        </slot>
      </div>

      <div v-else-if="items?.length && !$slots.default" class="mobile-social-feature__list" role="list">
        <button
          v-for="item in items"
          :key="itemKey(item)"
          type="button"
          class="mobile-social-feature__item"
          data-mobile-row
          role="listitem"
          @click="handleSelect(item)"
        >
          <span v-if="item.avatar" class="mobile-social-feature__avatar">
            <img :src="item.avatar" :alt="item.title" referrerpolicy="no-referrer" />
          </span>
          <span v-else class="mobile-social-feature__avatar mobile-social-feature__avatar--icon" :class="toneClass(item)">
            <i :class="item.icon || 'fas fa-user'" aria-hidden="true"></i>
          </span>

          <span class="mobile-social-feature__item-copy">
            <strong>{{ item.title }}</strong>
            <small v-if="item.subtitle || item.description">{{ item.subtitle || item.description }}</small>
          </span>
          <span class="mobile-social-feature__item-meta">
            <time v-if="item.time">{{ item.time }}</time>
            <em v-if="item.badge !== undefined">{{ item.badge }}</em>
          </span>
          <span v-if="item.actionLabel" class="mobile-social-feature__item-action" @click.stop="handleAction(item)">
            {{ item.actionLabel }}
          </span>
        </button>
      </div>

      <div v-else class="mobile-social-feature__content">
        <slot :variant="variant" :select="handleSelect" :action="handleAction" />
      </div>
    </main>

    <footer v-if="$slots.footer" class="mobile-social-feature__footer" data-mobile-surface="footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface MobileSocialItem {
  id?: string | number;
  key?: string | number;
  title: string;
  subtitle?: string;
  description?: string;
  avatar?: string;
  icon?: string;
  tone?: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'gray';
  time?: string;
  badge?: string | number;
  actionLabel?: string;
}

defineOptions({ name: 'MobileSocialFeature' });

const props = withDefaults(
  defineProps<{
    /** Labels are optional so a route page can own its own header. */
    title?: string;
    subtitle?: string;
    variant?: 'relations' | 'list' | 'activity';
    loading?: boolean;
    error?: boolean;
    errorText?: string;
    empty?: boolean;
    emptyText?: string;
    /** Disable the adapter scroll container when the parent owns scrolling. */
    scroll?: boolean;
    showBack?: boolean;
    backLabel?: string;
    /** Optional generic relation/notification rows for slot-free mobile surfaces. */
    items?: readonly MobileSocialItem[];
  }>(),
  {
    title: '',
    subtitle: '',
    variant: 'list',
    loading: false,
    error: false,
    errorText: '加载失败，请稍后重试',
    empty: false,
    emptyText: '暂无内容',
    scroll: true,
    showBack: false,
    backLabel: '返回',
    items: undefined,
  },
);

const emit = defineEmits<{
  back: [];
  retry: [];
  select: [item: MobileSocialItem];
  action: [item: MobileSocialItem];
}>();

const featureState = computed(() => {
  if (props.loading) return 'loading';
  if (props.error) return 'error';
  if (props.empty || (props.items && !props.items.length)) return 'empty';
  return 'ready';
});

function handleBack() {
  emit('back');
}

function handleRetry() {
  emit('retry');
}

function itemKey(item: MobileSocialItem): string {
  return String(item.key ?? item.id ?? `${item.title}-${item.time || ''}`);
}

function handleSelect(item: MobileSocialItem) {
  emit('select', item);
}

function handleAction(item: MobileSocialItem) {
  emit('action', item);
}

function toneClass(item: MobileSocialItem): string {
  return `mobile-social-feature__avatar--${item.tone || 'green'}`;
}
</script>

<style scoped>
:host {
  --mobile-social-green: #0f9d58;
  --mobile-social-green-soft: #e5f7ee;
  --mobile-social-bg: #f2f2f6;
  --mobile-social-text: #202124;
  --mobile-social-muted: #85878d;
  --mobile-social-divider: #e5e5e8;
}

.mobile-social-feature {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--mobile-social-bg);
  color: var(--mobile-social-text);
}

.mobile-social-feature__header {
  display: flex;
  flex: 0 0 56px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: max(0px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) 0
    max(12px, env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--mobile-social-divider);
  background: #fff;
}

.mobile-social-feature__heading {
  flex: 1 1 auto;
  min-width: 0;
}

.mobile-social-feature__heading h1 {
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-social-feature__heading p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--mobile-social-muted);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-social-feature__back,
.mobile-social-feature__header-actions :deep(button) {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 40px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: var(--mobile-social-text);
  font: inherit;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-social-feature__back {
  gap: 6px;
  padding: 0 4px;
  font-size: 14px;
}

.mobile-social-feature__back i {
  font-size: 18px;
}

.mobile-social-feature__header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.mobile-social-feature__filters {
  flex: 0 0 auto;
  min-width: 0;
  overflow-x: auto;
  padding: 8px max(12px, env(safe-area-inset-left, 0px)) 2px;
  border-bottom: 1px solid var(--mobile-social-divider);
  background: #fff;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-social-feature__filters::-webkit-scrollbar {
  display: none;
}

.mobile-social-feature__surface {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: 12px max(12px, env(safe-area-inset-left, 0px)) calc(28px + env(safe-area-inset-bottom, 0px))
    max(12px, env(safe-area-inset-right, 0px));
}

.mobile-social-feature__surface--scroll {
  overflow: auto;
  overscroll-behavior: contain;
}

.mobile-social-feature--static .mobile-social-feature__surface {
  overflow: hidden;
}

.mobile-social-feature__content,
.mobile-social-feature__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.mobile-social-feature__list {
  gap: 1px;
  overflow: hidden;
  border-radius: 16px;
  background: var(--mobile-social-divider);
}

.mobile-social-feature__item {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  min-height: 76px;
  padding: 10px 12px;
  border: 0;
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-social-feature__item:active {
  background: #f7f8f8;
}

.mobile-social-feature__avatar {
  display: grid;
  flex: 0 0 46px;
  place-items: center;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--mobile-social-green-soft);
  color: var(--mobile-social-green);
  font-size: 19px;
}

.mobile-social-feature__avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-social-feature__avatar--blue { background: #e8f1ff; color: #2d80ed; }
.mobile-social-feature__avatar--orange { background: #fff1e4; color: #e87918; }
.mobile-social-feature__avatar--red { background: #ffebeb; color: #e3483b; }
.mobile-social-feature__avatar--purple { background: #f1eaff; color: #8d61e9; }
.mobile-social-feature__avatar--gray { background: #eef0f2; color: #7e838b; }

.mobile-social-feature__item-copy {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.mobile-social-feature__item-copy strong,
.mobile-social-feature__item-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-social-feature__item-copy strong {
  font-size: 15px;
  font-weight: 600;
}

.mobile-social-feature__item-copy small {
  color: var(--mobile-social-muted);
  font-size: 12px;
}

.mobile-social-feature__item-meta {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  color: var(--mobile-social-muted);
  font-size: 11px;
}

.mobile-social-feature__item-meta em {
  display: inline-grid;
  min-width: 18px;
  min-height: 18px;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  background: #e3483b;
  color: #fff;
  font-size: 10px;
  font-style: normal;
}

.mobile-social-feature__item-action {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid var(--mobile-social-green);
  border-radius: 999px;
  color: var(--mobile-social-green);
  font-size: 12px;
}

.mobile-social-feature__state {
  display: grid;
  place-items: center;
  gap: 9px;
  min-height: 190px;
  padding: 28px 18px;
  color: var(--mobile-social-muted);
  font-size: 14px;
  text-align: center;
}

.mobile-social-feature__state > i {
  color: var(--mobile-social-green);
  font-size: 24px;
}

.mobile-social-feature__state--error > i {
  color: #e3483b;
}

.mobile-social-feature__state strong {
  color: var(--mobile-social-text);
  font-size: 14px;
  font-weight: 500;
}

.mobile-social-feature__retry {
  min-width: 84px;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--mobile-social-green);
  border-radius: 999px;
  background: #fff;
  color: var(--mobile-social-green);
  font: inherit;
  touch-action: manipulation;
}

.mobile-social-feature__footer {
  flex: 0 0 auto;
  padding: 10px max(12px, env(safe-area-inset-left, 0px)) max(10px, env(safe-area-inset-bottom, 0px))
    max(12px, env(safe-area-inset-right, 0px));
  border-top: 1px solid var(--mobile-social-divider);
  background: #fff;
}

.mobile-social-feature__content :deep([data-mobile-card]),
.mobile-social-feature__content :deep([data-mobile-row]) {
  min-width: 0;
  border-radius: 16px;
  background: #fff;
}

.mobile-social-feature__content :deep([data-mobile-action]) {
  min-height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

@media (min-width: 720px) {
  .mobile-social-feature__surface > *,
  .mobile-social-feature__filters > * {
    max-width: 720px;
    margin-inline: auto;
  }
}
</style>
