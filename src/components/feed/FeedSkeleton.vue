<template>
  <div class="feed-skeleton-list">
    <div v-for="i in count" :key="i" class="feed-skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-user-meta">
          <div class="skeleton-line line-name"></div>
          <div class="skeleton-line line-sub"></div>
        </div>
      </div>
      <div class="skeleton-body">
        <div class="skeleton-line line-full"></div>
        <div class="skeleton-line line-3-4"></div>
        <div class="skeleton-line line-1-2"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    count?: number;
  }>(),
  {
    count: 3
  }
);
</script>

<style scoped>
.feed-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feed-skeleton-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border-light);
  padding: 20px;
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.skeleton-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: var(--background-secondary);
  animation: skeleton-pulse 1.5s infinite ease-in-out;
}

.skeleton-user-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.skeleton-line {
  height: 12px;
  border-radius: 4px;
  background-color: var(--background-secondary);
  animation: skeleton-pulse 1.5s infinite ease-in-out;
}

.line-name { width: 120px; height: 14px; }
.line-sub { width: 180px; }
.line-full { width: 100%; height: 14px; margin-bottom: 8px; }
.line-3-4 { width: 75%; height: 14px; margin-bottom: 8px; }
.line-1-2 { width: 40%; height: 14px; }

@keyframes skeleton-pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
</style>
