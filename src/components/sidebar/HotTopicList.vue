<template>
  <div class="sidebar-card">
    <div class="card-header">
      <h3 class="card-title"><i class="fas fa-hashtag icon-topic"></i> 热门话题</h3>
    </div>
    <div class="topic-list">
      <router-link
        v-for="topic in topics"
        :key="topic.tag"
        :to="`/topic/${encodeURIComponent(topic.tag)}`"
        class="topic-item"
      >
        <span class="topic-tag">#{{ topic.tag }}#</span>
        <span class="topic-count">{{ topic.count }} 讨论</span>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const topics = ref([
  { tag: '酷安桌面版', count: '12.5k' },
  { tag: 'Windows11应用体验', count: '8.3k' },
  { tag: '今日份数码新闻', count: '5.1k' },
  { tag: '搞机日常', count: '3.9k' },
]);
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
  margin-bottom: var(--space-3);
}

.card-title {
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
