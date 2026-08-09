<template>
  <div class="sidebar-card">
    <div class="card-header">
      <h3 class="card-title"><i class="fas fa-hashtag icon-topic"></i> 热门话题</h3>
      <button class="refresh-btn" title="刷新话题" @click="fetchTopics">
        <i class="fas fa-sync-alt"></i>
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
        v-for="topic in topics"
        :key="topic.tag"
        :to="`/topic/${encodeURIComponent(topic.tag)}`"
        class="topic-item"
      >
        <span class="topic-tag">#{{ topic.tag }}#</span>
        <span class="topic-count">{{ formatCount(topic.count) }} 讨论</span>
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
  margin-bottom: var(--space-3);
}

.card-title {
  margin: 0;
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-topic {
  color: var(--brand-primary);
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

.loading-wrapper, .empty-wrapper {
  padding: 12px 0;
}

.topic-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.topic-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  text-decoration: none;
  min-width: 0;
}

.topic-tag {
  font-size: var(--font-size-sub);
  color: var(--brand-primary);
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.topic-count {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  flex-shrink: 0;
  white-space: nowrap;
}
</style>
