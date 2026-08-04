<template>
  <div class="empty-state">
    <div class="empty-icon">
      <i :class="icon || 'fas fa-inbox'"></i>
    </div>
    <h4 class="empty-title">{{ title || '暂无内容' }}</h4>
    <p v-if="description" class="empty-desc">{{ description }}</p>
    <div v-if="$slots.default" class="empty-action">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string;
  title?: string;
  description?: string;
}>();
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-5);
  text-align: center;
}

.empty-icon {
  font-size: 36px;
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
}

.empty-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.empty-desc {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
  max-width: 360px;
  line-height: var(--line-height-sub);
}

.empty-action {
  margin-top: var(--space-4);
}
</style>
