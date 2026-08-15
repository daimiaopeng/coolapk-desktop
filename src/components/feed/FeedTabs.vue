<template>
  <div class="feed-tabs-wrapper">
    <div class="feed-tabs custom-scrollbar" ref="tabsContainer" @wheel.passive="handleWheel">
      <button
        v-for="tab in tabs"
        :key="getTabKey(tab)"
        :class="['tab-item', { 'is-active': activeKey === getTabKey(tab) }]"
        @click="$emit('update:activeKey', getTabKey(tab))"
      >
        <span class="tab-label">{{ tab.title }}</span>
        <span v-if="activeKey === getTabKey(tab)" class="coolapk-tab-indicator"></span>
      </button>
    </div>

    <!-- 官方右侧 ☰ 频道管理按钮 -->
    <button
      class="tab-manage-btn"
      title="频道管理与排序"
      @click="showTabManager = true"
    >
      <i class="fas fa-bars"></i>
    </button>

    <!-- 频道管理弹窗 (九宫格/磁贴网格) -->
    <TabManagerModal
      :visible="showTabManager"
      :tabs="tabs"
      :active-key="activeKey"
      @close="showTabManager = false"
      @select-tab="$emit('update:activeKey', $event)"
      @updated="$emit('tabOrderUpdated')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ConfigPageTab } from '../../types/settings';
import TabManagerModal from './TabManagerModal.vue';

const props = defineProps<{
  activeKey: string;
  tabs: ConfigPageTab[];
}>();

defineEmits<{
  (e: 'update:activeKey', key: string): void;
  (e: 'tabOrderUpdated'): void;
}>();

const showTabManager = ref(false);
const tabsContainer = ref<HTMLElement | null>(null);

function getTabKey(tab: ConfigPageTab): string {
  return tab.page_name || tab.url || String(tab.id || tab.title);
}

function handleWheel(e: WheelEvent) {
  if (tabsContainer.value && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    tabsContainer.value.scrollLeft += e.deltaY;
  }
}
</script>

<style scoped>
.feed-tabs-wrapper {
  display: flex;
  align-items: center;
  background-color: var(--surface);
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  height: 48px;
  position: relative;
  flex-shrink: 0;
  width: 100%;
}

.feed-tabs {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  height: 100%;
  overflow-x: auto;
  flex: 1;
  user-select: none;
  scrollbar-width: none;
}

.feed-tabs::-webkit-scrollbar {
  display: none;
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
  transition: all var(--duration-fast, 0.15s) var(--ease-default, ease);
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
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 3.5px;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
  animation: tabSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tab-manage-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 100%;
  background: linear-gradient(to right, transparent, var(--surface) 25%);
  border: none;
  color: var(--text-secondary);
  font-size: 15px;
  cursor: pointer;
  padding-right: 12px;
  transition: color 0.15s ease;
  flex-shrink: 0;
}

.tab-manage-btn:hover {
  color: var(--primary, #10b981);
}

@keyframes tabSlideIn {
  from {
    width: 0px;
    opacity: 0;
  }
  to {
    width: 22px;
    opacity: 1;
  }
}
</style>
