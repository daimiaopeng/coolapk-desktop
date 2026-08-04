<template>
  <div class="feed-tabs custom-scrollbar">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :class="['tab-item', { 'is-active': activeKey === tab.key }]"
      @click="$emit('update:activeKey', tab.key)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  activeKey: string;
}>();

defineEmits<{
  (e: 'update:activeKey', key: string): void;
}>();

const tabs = [
  { key: 'index_v8', label: '推荐' },
  { key: 'hot', label: '热榜' },
  { key: 'latest', label: '最新' },
  { key: 'digest', label: '精选' },
  { key: 'cool_picture', label: '酷图' },
  { key: 'secondhand', label: '二手' },
];
</script>

<style scoped>
.feed-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-5);
  background-color: var(--surface);
  border-bottom: 1px solid var(--border);
  height: 52px;
  overflow-x: auto;
  flex-shrink: 0;
}

.tab-item {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
  white-space: nowrap;
  background: transparent;
  cursor: pointer;
}

.tab-item:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.tab-item.is-active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}
</style>
