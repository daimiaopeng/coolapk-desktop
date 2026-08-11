<template>
  <div class="feed-layout-toggle" role="group" aria-label="信息流布局">
    <button
      type="button"
      :class="['layout-option', { 'is-active': modelValue === 'single' }]"
      :aria-pressed="modelValue === 'single'"
      title="单列信息流"
      @click="selectLayout('single')"
    >
      <i class="fas fa-list"></i>
      <span>单列</span>
    </button>
    <button
      type="button"
      :class="['layout-option', { 'is-active': modelValue === 'double' }]"
      :aria-pressed="modelValue === 'double'"
      title="双列信息流"
      @click="selectLayout('double')"
    >
      <i class="fas fa-grip-vertical"></i>
      <span>双列</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { FeedLayout } from '../../types/settings';

defineProps<{
  modelValue: FeedLayout;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: FeedLayout): void;
}>();

function selectLayout(layout: FeedLayout) {
  emit('update:modelValue', layout);
}
</script>

<style scoped>
.feed-layout-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  align-self: center;
  margin-right: 12px;
  padding: 3px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: 10px;
  background: var(--background-secondary, rgba(0, 0, 0, 0.03));
}

.layout-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 56px;
  height: 28px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  color: var(--text-tertiary);
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-default), background-color var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default);
}

.layout-option:hover {
  color: var(--text-primary);
}

.layout-option.is-active {
  color: var(--brand-primary);
  background: var(--surface);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
  font-weight: 700;
}

.layout-option:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 1px;
}

@container layout (max-width: 520px) {
  .feed-layout-toggle {
    margin-right: 8px;
  }

  .layout-option {
    min-width: 34px;
    padding: 0 7px;
  }

  .layout-option span {
    display: none;
  }
}
</style>
