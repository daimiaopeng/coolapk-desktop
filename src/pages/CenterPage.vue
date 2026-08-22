<template>
  <div class="center-page">
    <div class="center-tabs custom-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['center-tab', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        <i :class="[tab.icon, 'tab-icon']"></i>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div class="center-panel">
      <EventsPage v-if="activeTab === 'events'" />
      <NodePage v-else-if="activeTab === 'nodes'" node-type="topic" node-id="数码" title="数码版块" />
      <AnyListPage v-else-if="activeTab === 'anylist'" />
      <MyDyhPage v-else-if="activeTab === 'dyh'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import EventsPage from './EventsPage.vue';
import NodePage from './NodePage.vue';
import AnyListPage from './AnyListPage.vue';
import MyDyhPage from './MyDyhPage.vue';

const tabs = [
  { key: 'events', label: '酷友圈活动', icon: 'fas fa-trophy' },
  { key: 'nodes', label: '节点版块', icon: 'fas fa-th' },
  { key: 'anylist', label: '万物清单', icon: 'fas fa-list-ul' },
  { key: 'dyh', label: '我的动态号', icon: 'fas fa-building-columns' },
];

const activeTab = ref('events');
</script>

<style scoped>
.center-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.center-tabs {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  padding: 4px 2px 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.center-tabs::-webkit-scrollbar {
  display: none;
}

.center-tab {
  position: relative;
  min-width: max-content;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 14px 12px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: color .15s ease;
}

.center-tab:hover {
  color: var(--text-primary);
}

.center-tab.active {
  color: var(--brand-primary);
  font-weight: 700;
}

.center-tab.active::after {
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 20px;
  height: 3px;
  transform: translateX(-50%);
  border-radius: 4px;
  background: var(--brand-primary);
  content: '';
}

.center-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 让被内嵌的子页面滚动容器填满当前面板，并隐藏其自带标题栏 */
.center-panel :deep(.page-container) {
  height: 100%;
  padding: 0 16px 16px;
}

.center-panel :deep(.top-nav-bar) {
  display: none;
}
</style>
