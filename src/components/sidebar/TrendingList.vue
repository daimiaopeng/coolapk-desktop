<template>
  <div class="sidebar-card">
    <div class="card-header">
      <h3 class="card-title">本月热榜</h3>
      <button class="refresh-btn" title="刷新本月热榜" @click="fetchHot">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>

    <div class="card-body custom-scrollbar">
      <div v-if="loading" class="loading-wrapper">
        <LoadingState text="正在获取热榜" />
      </div>
      <div v-else-if="items.length === 0" class="empty-wrapper">
        <EmptyState title="暂无热榜" />
      </div>
      <div v-else class="trending-list">
        <div
          v-for="(item, index) in items.slice(0, 5)"
          :key="item.id || index"
          class="trending-item"
          @click="openFeed(item)"
        >
          <span :class="['rank-num', `rank-${index + 1}`]">{{ index + 1 }}</span>
          <div class="item-info">
            <span class="item-title">{{ item.title || item.message || '热榜动态' }}</span>
            <span class="item-meta">{{ item.replynum || 0 }} 评论 · {{ item.likenum || 0 }} 点赞</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../api/coolapk';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';
import { openFeedDetail } from '../../utils/feedNavigation';

const router = useRouter();
const loading = ref(false);
const items = ref<any[]>([]);

async function fetchHot() {
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getRankFeeds('month', 1);
    if (res && res.data) {
      items.value = res.data.filter((i: any) => i.title || i.message);
    }
  } catch (err) {
    console.error('Failed to fetch hot feeds', err);
  } finally {
    loading.value = false;
  }
}

function openFeed(item: any) {
  if (item && item.id) {
    openFeedDetail(router, item.id, item);
  }
}

onMounted(() => {
  fetchHot();
});
</script>

<style scoped>
.sidebar-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  overflow: hidden;
  min-width: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.card-title {
  margin: 0;
  font-size: 17px;
  line-height: 22px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.refresh-btn {
  color: var(--text-tertiary);
  font-size: 12px;
  padding: 4px;
  border-radius: var(--radius-xs);
  transition: color var(--duration-fast) var(--ease-default);
}

.refresh-btn:hover {
  color: var(--brand-primary);
}

.trending-list {
  display: flex;
  flex-direction: column;
}

.trending-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  cursor: pointer;
  padding: 4px 0;
  transition: opacity var(--duration-fast) var(--ease-default);
}

.trending-item:hover {
  opacity: 0.8;
}

.rank-num {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-tertiary);
  width: 18px;
  height: 18px;
  border-radius: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: transparent;
}

.rank-1 {
  color: #ff4757;
}

.rank-2 {
  color: #ffa502;
}

.rank-3 {
  color: #f5bd2e;
}

.item-info {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.item-title {
  font-size: 15px;
  line-height: 20px;
  color: var(--text-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  font-size: 12px;
  line-height: 18px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
</style>
