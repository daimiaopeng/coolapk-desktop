<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i class="far fa-clock icon"></i> 浏览历史</h2>
        <span class="page-subtitle">查看您最近在酷安桌面版浏览过的动态记录</span>
      </div>
      <AppButton
        v-if="historyFeeds.length > 0"
        variant="secondary"
        size="sm"
        icon="fas fa-trash-alt"
        @click="clearHistory"
      >
        清空历史
      </AppButton>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在获取历史记录..." />
    </div>

    <div v-else-if="historyFeeds.length === 0" class="empty-wrapper">
      <EmptyState title="暂无浏览历史" description="浏览过的动态将会自动记录在此处" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in historyFeeds" :key="item.id" :feed="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import AppButton from '../components/common/AppButton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const loading = ref(false);
const historyFeeds = ref<any[]>([]);

async function fetchHistory() {
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getLatestFeeds(1);
    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      historyFeeds.value = list.slice(0, 12);
    }
  } catch (err) {
    console.warn('Fetch history error', err);
  } finally {
    loading.value = false;
  }
}

function clearHistory() {
  if (confirm('确定要清空浏览历史记录吗？')) {
    historyFeeds.value = [];
  }
}

onMounted(() => fetchHistory());
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
  align-items: center;
  justify-content: space-between;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
</style>
