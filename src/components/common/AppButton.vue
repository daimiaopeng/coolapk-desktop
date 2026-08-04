<template>
  <button
    :class="[
      'app-button',
      `variant-${variant}`,
      `size-${size}`,
      { 'is-block': block, 'is-disabled': disabled || loading }
    ]"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <i v-if="loading" class="fas fa-spinner fa-spin icon-left"></i>
    <i v-else-if="icon" :class="[icon, 'icon-left']"></i>
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    block: false
  }
);
</script>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-btn);
  transition: all var(--duration-fast) var(--ease-default);
  cursor: pointer;
  border: 1px solid transparent;
  white-space: nowrap;
}

.size-sm {
  padding: 4px 10px;
  height: 28px;
  font-size: 13px;
}

.size-md {
  padding: 6px 14px;
  height: 36px;
  font-size: 14px;
}

.size-lg {
  padding: 10px 20px;
  height: 44px;
  font-size: 15px;
}

.variant-primary {
  background-color: var(--brand-primary);
  color: var(--text-inverse);
}

.variant-primary:hover:not(:disabled) {
  background-color: var(--brand-hover);
}

.variant-primary:active:not(:disabled) {
  background-color: var(--brand-active);
}

.variant-secondary {
  background-color: var(--surface);
  border-color: var(--border);
  color: var(--text-primary);
}

.variant-secondary:hover:not(:disabled) {
  background-color: var(--surface-hover);
  border-color: var(--text-tertiary);
}

.variant-soft {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
}

.variant-soft:hover:not(:disabled) {
  background-color: var(--brand-soft-hover);
}

.variant-ghost {
  background-color: transparent;
  color: var(--text-secondary);
}

.variant-ghost:hover:not(:disabled) {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.variant-danger {
  background-color: var(--danger);
  color: var(--text-inverse);
}

.icon-left {
  margin-right: 6px;
}

.is-block {
  width: 100%;
}

.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
