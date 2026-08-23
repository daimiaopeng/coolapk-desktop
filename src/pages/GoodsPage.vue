<template>
  <div class="goods-page">
    <div class="goods-tabs custom-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['goods-tab', { 'is-active': activeTab === tab.key }]"
        type="button"
        @click="selectTab(tab.key)"
      >
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="activeTab === tab.key" class="coolapk-tab-indicator"></span>
      </button>
    </div>

    <div class="goods-content">
      <GoodsSearchPage v-if="activeTab === 'search'" />
      <MyGoodsPage v-else-if="activeTab === 'mine'" />
      <GoodsListsPage v-else-if="activeTab === 'lists'" />
      <GoodsRankingPage v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import GoodsSearchPage from './GoodsSearchPage.vue';
import MyGoodsPage from './MyGoodsPage.vue';
import GoodsListsPage from './GoodsListsPage.vue';
import GoodsRankingPage from './GoodsRankingPage.vue';

const tabs = [
  { key: 'search', label: '好物搜索' },
  { key: 'mine', label: '我的好物' },
  { key: 'lists', label: '好物清单' },
  { key: 'ranking', label: '好物榜' },
] as const;

type GoodsTabKey = (typeof tabs)[number]['key'];

const route = useRoute();
const router = useRouter();

const activeTab = computed<GoodsTabKey>(() => {
  const raw = String(route.query.tab || 'search');
  const matched = tabs.find((tab) => tab.key === raw);
  return (matched ? matched.key : 'search') as GoodsTabKey;
});

function selectTab(key: GoodsTabKey) {
  if (key === activeTab.value) return;
  router.replace({ path: '/goods', query: { tab: key } });
}
</script>

<style scoped>
.goods-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--background);
}

.goods-tabs {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  height: 48px;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  background-color: var(--surface);
  overflow-x: auto;
  user-select: none;
  scrollbar-width: none;
}

.goods-tabs::-webkit-scrollbar {
  display: none;
}

.goods-tab {
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

.goods-tab:hover {
  color: var(--text-primary);
}

.goods-tab.is-active {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 16px;
}

/* 首页同款绿色胶囊指示条 */
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

.goods-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
</style>