<template>
  <div class="loading-state">
    <div class="spinner">
      <i class="fas fa-circle-notch fa-spin"></i>
    </div>
    <p class="loading-text">{{ text || '正在加载数据...' }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text?: string;
}>();
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--text-tertiary);
}

.spinner {
  font-size: 24px;
  color: var(--brand-primary);
  margin-bottom: var(--space-3);
}

.loading-text {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
}
</style>
