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
        <i :class="[tab.icon, 'goods-tab-icon']"></i>
        <span>{{ tab.label }}</span>
        <span v-if="activeTab === tab.key" class="tab-line"></span>
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
  { key: 'search', label: '好物搜索', icon: 'fas fa-search' },
  { key: 'mine', label: '我的好物', icon: 'fas fa-gift' },
  { key: 'lists', label: '好物清单', icon: 'fas fa-list-ul' },
  { key: 'ranking', label: '好物榜', icon: 'fas fa-trophy' },
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
  gap: var(--space-5);
  padding: 0 var(--space-5);
  height: 48px;
  border-bottom: 1px solid var(--border);
  background-color: var(--surface);
  overflow-x: auto;
}

.goods-tab {
  position: relative;
  height: 100%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0 2px;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-default);
}

.goods-tab:hover {
  color: var(--text-primary);
}

.goods-tab.is-active {
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.goods-tab-icon {
  font-size: 13px;
}

.tab-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  background: var(--brand-primary);
  border-radius: 2px;
}

.goods-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
</style>