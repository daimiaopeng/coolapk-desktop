<template>
  <button
    :class="['app-icon-button', `size-${size}`, { 'is-active': active }]"
    :aria-label="ariaLabel || title"
    :title="title"
    v-bind="$attrs"
  >
    <i :class="icon"></i>
    <span v-if="badge !== undefined && badge !== null && badge !== 0" class="badge-dot">{{ Number(badge) > 99 ? '99+' : badge }}</span>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string;
    size?: 'sm' | 'md' | 'lg';
    title?: string;
    ariaLabel?: string;
    active?: boolean;
    badge?: number | string;
  }>(),
  {
    size: 'md',
    active: false
  }
);
</script>

<style scoped>
.app-icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
  background: transparent;
  cursor: pointer;
}

.size-sm {
  width: 28px;
  height: 28px;
  font-size: 14px;
}

.size-md {
  width: 36px;
  height: 36px;
  font-size: 16px;
}

.size-lg {
  width: 44px;
  height: 44px;
  font-size: 18px;
}

.app-icon-button:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.app-icon-button:disabled {
  color: var(--text-tertiary);
  opacity: 0.38;
  cursor: default;
  pointer-events: none;
}

.app-icon-button.is-active {
  color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.badge-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: var(--danger);
  color: #ffffff;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 10px;
  min-width: 14px;
  height: 14px;
  line-height: 14px;
  text-align: center;
  font-weight: bold;
}
</style>
