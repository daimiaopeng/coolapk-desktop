<template>
  <aside class="right-sidebar custom-scrollbar">
    <TrendingList v-if="props.showMonthlyRank" />
    <HotTopicList v-if="props.showHotTopics" />
  </aside>
</template>

<script setup lang="ts">
import TrendingList from '../sidebar/TrendingList.vue';
import HotTopicList from '../sidebar/HotTopicList.vue';

const props = withDefaults(defineProps<{
  showMonthlyRank?: boolean;
  showHotTopics?: boolean;
}>(), {
  showMonthlyRank: true,
  showHotTopics: true,
});
</script>

<style scoped>
.right-sidebar {
  width: clamp(var(--right-sidebar-width, 280px), 19vw, 320px);
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  flex-shrink: 0;
  box-sizing: border-box;
  background-color: var(--background-secondary);
}

.right-sidebar :deep(.sidebar-card) {
  margin: 0;
  padding: 16px;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
}

@media (max-width: 1200px) {
  .right-sidebar {
    display: none !important;
  }
}
</style>
