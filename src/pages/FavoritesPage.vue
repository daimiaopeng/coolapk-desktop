<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i class="far fa-bookmark icon"></i> 我的收藏</h2>
        <span class="page-subtitle">已收藏的精彩动态与酷图备忘</span>
      </div>
      <AppButton
        v-if="favorites.length > 0"
        variant="danger"
        size="sm"
        icon="fas fa-trash-alt"
        @click="clearFavorites"
      >
        清空收藏
      </AppButton>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在获取收藏列表..." />
    </div>

    <div v-else-if="favorites.length === 0" class="empty-wrapper">
      <EmptyState title="暂无收藏内容" description="在浏览动态时点击“收藏”按钮，精彩内容将保存在这里" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in favorites" :key="item.id" :feed="item" />
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
const favorites = ref<any[]>([]);

async function fetchFavorites() {
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getCoolPictureRank(1);
    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      favorites.value = list.slice(0, 10);
    }
  } catch (err) {
    console.warn('Fetch favorites error', err);
  } finally {
    loading.value = false;
  }
}

function clearFavorites() {
  if (confirm('确定要清空所有收藏内容吗？')) {
    favorites.value = [];
  }
}

onMounted(() => fetchFavorites());
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
