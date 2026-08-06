<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i class="far fa-bookmark icon"></i> 我的收藏</h2>
        <span class="page-subtitle">已收藏的精彩动态与酷图备忘</span>
      </div>
      <div class="header-actions">
        <AppButton
          v-if="favoritesStore.length > 0"
          variant="secondary"
          size="sm"
          icon="fas fa-file-export"
          @click="exportFavorites"
        >
          导出收藏
        </AppButton>
        <AppButton
          variant="secondary"
          size="sm"
          icon="fas fa-file-import"
          @click="triggerImport"
        >
          导入收藏
        </AppButton>
        <AppButton
          v-if="favoritesStore.length > 0"
          variant="danger"
          size="sm"
          icon="fas fa-trash-alt"
          @click="clearFavorites"
        >
          清空收藏
        </AppButton>
        <input ref="fileInput" type="file" accept=".json,application/json" class="hidden-input" @change="handleImport" />
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在获取收藏列表..." />
    </div>

    <div v-else-if="favoritesStore.length === 0" class="empty-wrapper">
      <EmptyState title="暂无收藏内容" description="在浏览动态时点击“收藏”按钮，精彩内容将保存在这里" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in favoritesStore" :key="item.id" :feed="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import FeedCard from '../components/feed/FeedCard.vue';
import AppButton from '../components/common/AppButton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { favorites as favoritesStore, clearFavorites as clearAllFavorites, importFavorites } from '../utils/favoritesStore';

const loading = ref(true);
const fileInput = ref<HTMLInputElement | null>(null);

function triggerImport() {
  fileInput.value?.click();
}

function handleImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const list = Array.isArray(data) ? data : data?.favorites;
      if (!Array.isArray(list)) {
        alert('导入失败：文件格式不正确，应为收藏导出的 JSON 文件');
        return;
      }
      const count = importFavorites(list);
      alert(count > 0 ? `成功导入 ${count} 条收藏` : '没有新增收藏（内容已存在或为空）');
    } catch (err) {
      alert('导入失败：无法解析该 JSON 文件');
    }
  };
  reader.readAsText(file);
}

function exportFavorites() {
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), favorites: favoritesStore.value }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `酷安收藏-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

onMounted(async () => {
  try {
    await Promise.resolve();
  } catch (err) {
    console.warn('Fetch favorites error', err);
  } finally {
    loading.value = false;
  }
});

function clearFavorites() {
  if (confirm('确定要清空所有收藏内容吗？')) {
    clearAllFavorites();
  }
}
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

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.hidden-input {
  display: none;
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
