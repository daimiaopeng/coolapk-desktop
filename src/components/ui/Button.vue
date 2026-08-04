<template>
  <button
    :type="type || 'button'"
    class="custom-btn"
    :class="[
      `btn-${variant || 'primary'}`,
      `btn-${size || 'md'}`,
      { 'is-disabled': disabled, 'is-loading': loading }
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <i v-if="loading" class="fa-solid fa-circle-notch fa-spin btn-icon"></i>
    <i v-else-if="icon" :class="[icon, 'btn-icon']"></i>
    <span class="btn-text"><slot></slot></span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
}>();

defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<style scoped>
.custom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: var(--radius-md, 8px);
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: var(--transition-fast, all 0.15s ease);
  border: 1px solid transparent;
  outline: none;
}

.custom-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--brand-green-border);
}

/* Sizes */
.btn-sm {
  padding: 4px 10px;
  font-size: 0.78rem;
  height: 28px;
}

.btn-md {
  padding: 7px 14px;
  font-size: 0.85rem;
  height: 34px;
}

.btn-lg {
  padding: 10px 20px;
  font-size: 0.95rem;
  height: 40px;
}

/* Variants */
.btn-primary {
  background-color: var(--brand-green, #10b966);
  color: var(--text-white, #ffffff);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--brand-green-hover, #0ea05b);
}

.btn-secondary {
  background-color: var(--bg-hover, #f1f5f9);
  color: var(--text-main, #172033);
  border-color: var(--border-color, #e4e9ef);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--bg-active, #e2e8f0);
}

.btn-outline {
  background-color: transparent;
  color: var(--brand-green, #10b966);
  border-color: var(--border-color, #e4e9ef);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--brand-green-light);
  border-color: var(--brand-green);
}

.btn-ghost {
  background-color: transparent;
  color: var(--text-sub, #667085);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--bg-hover, #f1f5f9);
  color: var(--text-main, #172033);
}

.btn-danger {
  background-color: var(--color-error, #e5484d);
  color: var(--text-white, #ffffff);
}

.btn-danger:hover:not(:disabled) {
  background-color: #c0392b;
}

.is-disabled,
.custom-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 0.9em;
}
</style>
