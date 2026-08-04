<template>
  <aside class="right-sidebar custom-scrollbar">
    <TrendingList />
    <HotTopicList />
    <RecommendedUsers />
  </aside>
</template>

<script setup lang="ts">
import TrendingList from '../sidebar/TrendingList.vue';
import HotTopicList from '../sidebar/HotTopicList.vue';
import RecommendedUsers from '../sidebar/RecommendedUsers.vue';
</script>

<style scoped>
.right-sidebar {
  width: var(--right-sidebar-width, 270px);
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 6px;
  flex-shrink: 0;
  box-sizing: border-box;
}

@media (max-width: 1200px) {
  .right-sidebar {
    display: none !important;
  }
}
</style>
