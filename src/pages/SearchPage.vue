<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <h2 class="page-title">搜索结果：{{ queryStr }}</h2>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在全局检索内容..." />
    </div>

    <div v-else-if="results.length === 0" class="empty-wrapper">
      <EmptyState title="未搜索到任何相关数据" description="请尝试输入其他关键字重新搜索" />
    </div>

    <div v-else class="search-result-list">
      <FeedCard v-for="item in results" :key="item.id" :feed="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const queryStr = computed(() => (route.query.q as string) || '');
const loading = ref(false);
const results = ref<any[]>([]);

async function fetchSearch() {
  if (!queryStr.value) return;
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.searchAll(queryStr.value, 1);
    if (res && res.data) {
      results.value = Array.isArray(res.data) ? res.data : [];
    }
  } catch (err) {
    console.error('Search error', err);
  } finally {
    loading.value = false;
  }
}

watch(queryStr, () => fetchSearch());
onMounted(() => fetchSearch());
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
  margin-bottom: var(--space-4);
}

.page-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}
</style>
