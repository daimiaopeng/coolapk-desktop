<template>
  <div class="feed-tabs custom-scrollbar">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :class="['tab-item', { 'is-active': activeKey === tab.key }]"
      @click="$emit('update:activeKey', tab.key)"
    >
      <span class="tab-label">{{ tab.label }}</span>
      <span v-if="activeKey === tab.key" class="coolapk-tab-indicator"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  activeKey: string;
  dynamicTabs?: { key: string; label: string }[];
}>();

defineEmits<{
  (e: 'update:activeKey', key: string): void;
}>();

const defaultTabs = [
  { key: 'index_v8', label: '推荐' },
  { key: 'digest', label: '头条' },
  { key: 'hot', label: '热榜' },
  { key: 'latest', label: '快讯' },
  { key: 'cool_picture', label: '酷图' },
  { key: 'secondhand', label: '二手' },
];

const extraTabs = [
  { key: 'pictures', label: '酷图' },
  { key: 'dyh', label: '看看号' },
];

const tabs = computed(() => {
  const base =
    props.dynamicTabs && props.dynamicTabs.length > 0 ? props.dynamicTabs : defaultTabs;
  const merged = [...base];
  const seenKeys = new Set(merged.map((t) => t.key));
  const seenLabels = new Set(merged.map((t) => t.label));
  for (const t of extraTabs) {
    if (!seenKeys.has(t.key) && !seenLabels.has(t.label)) merged.push(t);
  }
  return merged;
});
</script>

<style scoped>
.feed-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-6);
  background-color: var(--surface);
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  height: 52px;
  overflow-x: auto;
  flex-shrink: 0;
  user-select: none;
}

.tab-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 6px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
  white-space: nowrap;
  background: transparent;
  cursor: pointer;
  border: none;
  outline: none;
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.is-active {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 16px;
}

/* 酷安 APP 标志性绿色下划弧线/胶囊滑块指示器 */
.coolapk-tab-indicator {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 4px;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
  animation: tabSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes tabSlideIn {
  from {
    width: 0px;
    opacity: 0;
  }
  to {
    width: 20px;
    opacity: 1;
  }
}
</style>
