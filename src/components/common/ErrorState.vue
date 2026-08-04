<template>
  <div class="error-state">
    <div class="error-icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h4 class="error-title">{{ title || '加载失败' }}</h4>
    <p class="error-desc">{{ message || '网络请求异常，请重试' }}</p>
    <button v-if="retryable" class="retry-btn" @click="$emit('retry')">
      <i class="fas fa-redo icon-left"></i> 重试
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    message?: string;
    retryable?: boolean;
  }>(),
  {
    retryable: true
  }
);

defineEmits<{
  (e: 'retry'): void;
}>();
</script>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  text-align: center;
}

.error-icon {
  font-size: 32px;
  color: var(--danger);
  margin-bottom: var(--space-3);
}

.error-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.error-desc {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
  max-width: 400px;
}

.retry-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 16px;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-radius: var(--radius-control);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sub);
  transition: all var(--duration-fast) var(--ease-default);
}

.retry-btn:hover {
  background-color: var(--brand-soft-hover);
}

.icon-left {
  margin-right: 6px;
}
</style>
