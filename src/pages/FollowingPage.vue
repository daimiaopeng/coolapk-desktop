<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i class="far fa-user icon"></i> 我关注的酷友</h2>
        <span class="page-subtitle">已关注酷友的最新动态与信息</span>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在加载已关注酷友的最新动态..." />
    </div>

    <div v-else-if="feeds.length === 0" class="empty-wrapper">
      <EmptyState title="暂无关注人的动态" description="去关注更多有趣的酷友，他们的精彩动态将展示在这一列" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in feeds" :key="item.id" :feed="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const loading = ref(false);
const feeds = ref<any[]>([]);

async function fetchFollowingFeeds() {
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getIndexV8Feeds(1);
    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      feeds.value = list;
    }
  } catch (err) {
    console.warn('Fetch following feeds error', err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => fetchFollowingFeeds());
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
