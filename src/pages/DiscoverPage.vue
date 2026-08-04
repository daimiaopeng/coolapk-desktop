<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <h2 class="page-title"><i class="fas fa-compass icon"></i> 发现中心</h2>
      <span class="page-subtitle">探索酷友热议话题、二手酷品、全站精选与酷图大赏</span>

      <div class="discover-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['discover-tab-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          <i :class="tab.icon"></i> {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 列表数据区 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在搜索与聚合发现流..." />
    </div>

    <div v-else-if="feeds.length === 0" class="empty-wrapper">
      <EmptyState title="暂无相关发现内容" />
    </div>

    <div v-else class="discover-feeds">
      <FeedCard v-for="item in feeds" :key="item.id" :feed="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const activeTab = ref('digest');
const loading = ref(false);
const feeds = ref<any[]>([]);

const tabs = [
  { key: 'digest', label: '精选热帖', icon: 'fas fa-fire' },
  { key: 'secondhand', label: '酷品二手', icon: 'fas fa-store' },
  { key: 'cool_picture', label: '酷图大赏', icon: 'fas fa-camera' },
  { key: 'hot', label: '24H 热榜', icon: 'fas fa-chart-line' }
];

async function fetchDiscoverFeeds() {
  loading.value = true;
  feeds.value = [];
  try {
    let res: any;
    if (activeTab.value === 'secondhand') {
      res = await CoolapkTauriAPI.getSecondHandFeeds(1);
    } else if (activeTab.value === 'cool_picture') {
      res = await CoolapkTauriAPI.getCoolPictureRank(1);
    } else if (activeTab.value === 'hot') {
      res = await CoolapkTauriAPI.getHotFeeds(1);
    } else {
      res = await CoolapkTauriAPI.getDigestFeeds(1);
    }

    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      feeds.value = list.filter((item: any) => item.id && (item.message || item.title || item.pic));
    }
  } catch (err) {
    console.warn('Fetch discover feeds failed', err);
  } finally {
    loading.value = false;
  }
}

watch(activeTab, () => fetchDiscoverFeeds());
onMounted(() => fetchDiscoverFeeds());
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.page-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title .icon {
  color: var(--brand-primary);
}

.page-subtitle {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
}

.discover-tabs {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.discover-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-radius: var(--radius-control);
  background-color: var(--surface);
  border: 1px solid var(--border);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.discover-tab-btn:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.discover-tab-btn.active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}
</style>
