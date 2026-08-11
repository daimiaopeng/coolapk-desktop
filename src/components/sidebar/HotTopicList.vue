<template>
  <div class="sidebar-card">
    <div class="card-header">
      <h3 class="card-title">热门话题</h3>
      <button class="refresh-btn" title="换一换" @click="fetchTopics">
        <i class="fas fa-sync-alt"></i>
        <span>换一换</span>
      </button>
    </div>
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在获取话题" />
    </div>
    <div v-else-if="topics.length === 0" class="empty-wrapper">
      <EmptyState title="暂无话题" />
      </div>
      <div v-else class="topic-list">
        <router-link
          v-for="(topic, index) in topics.slice(0, 8)"
          :key="topic.tag || index"
          :to="`/topic/${encodeURIComponent(topic.tag)}`"
          class="topic-item"
        >
          <span :class="['topic-rank', `rank-${index + 1}`]">{{ index + 1 }}</span>
          <span class="topic-tag">{{ topic.tag || '热门话题' }}</span>
          <i v-if="index === 0" class="fas fa-fire topic-hot-mark"></i>
          <span class="topic-meta">{{ formatCount(topic.count) }}热度</span>
        </router-link>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';

const topics = ref<any[]>([]);
const loading = ref(false);

function formatCount(value: number | string) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return '';
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return String(count);
}

async function fetchTopics() {
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getHotTopics();
    if (res && res.data && Array.isArray(res.data)) {
      topics.value = res.data;
    }
  } catch (err) {
    console.error('Failed to fetch hot topics', err);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchTopics);
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
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  padding: 3px 0;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-default);
}

.refresh-btn:hover {
  color: var(--brand-primary);
}

.loading-wrapper, .empty-wrapper {
  padding: 12px 0;
}

.topic-list {
  display: flex;
  flex-direction: column;
}

.topic-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 4px 0;
  text-decoration: none;
  min-width: 0;
}

.topic-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 13px;
  font-weight: 700;
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

.topic-tag {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-hot-mark {
  flex: 0 0 auto;
  color: #ff4757;
  font-size: 11px;
}

.topic-meta {
  flex: 0 0 auto;
  min-width: 48px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 18px;
  text-align: right;
  white-space: nowrap;
}

.topic-item:hover .topic-tag {
  color: var(--brand-primary);
}

.topic-item:hover .topic-rank {
  border-color: var(--brand-primary);
}

.topic-item:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: -2px;
  border-radius: 4px;
}

</style>
