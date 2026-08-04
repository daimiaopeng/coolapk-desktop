<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <h2 class="page-title"><i class="fas fa-gamepad icon"></i> 游戏中心</h2>
      <span class="page-subtitle">探寻热门游戏大作、独立游戏与酷友游戏评测</span>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在获取酷安热门游戏列表..." />
    </div>

    <div v-else-if="games.length === 0" class="empty-wrapper">
      <EmptyState title="暂无相关游戏" />
    </div>

    <div v-else class="games-grid">
      <div
        v-for="game in games"
        :key="game.id || game.packageName || game.title"
        class="game-card"
        @click="navigateToApp(game)"
      >
        <AppImage :src="getIcon(game)" alt="Logo" image-class="game-icon" />
        <div class="game-info">
          <span class="game-title">{{ game.title || game.shorttitle || '热热门游戏' }}</span>
          <span class="game-sub">{{ game.subTitle || game.description || '酷安精选热门游戏' }}</span>
          <div class="game-meta">
            <span class="score"><i class="fas fa-star"></i> {{ game.score || '9.0' }}</span>
            <span class="tag">手游</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const router = useRouter();
const loading = ref(false);
const games = ref<any[]>([]);

function getIcon(game: any): string {
  return game.apkRomIcon || game.logo || game.icon || game.pic || 'https://c2.coolapk.com/coolmarket/apk/default_avatar.png';
}

async function fetchGames() {
  loading.value = true;
  games.value = [];
  try {
    const res = await CoolapkTauriAPI.searchAll('游戏', 1);
    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      games.value = list.filter((item: any) => item.title || item.packageName);
    }
  } catch (err) {
    console.warn('Fetch games failed', err);
  } finally {
    loading.value = false;
  }
}

function navigateToApp(game: any) {
  const pkg = game.packageName || game.id || game.title;
  if (pkg) {
    router.push(`/app/${pkg}`);
  }
}

onMounted(() => fetchGames());
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 900px;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-5);
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

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-4);
}

.game-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.game-card:hover {
  border-color: var(--brand-primary);
  transform: translateY(-2px);
}

.game-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-control);
  object-fit: cover;
  flex-shrink: 0;
}

.game-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.game-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.game-sub {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.game-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: 4px;
}

.score {
  font-size: 11px;
  color: #f59e0b;
  font-weight: bold;
}

.tag {
  font-size: 10px;
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  padding: 1px 5px;
  border-radius: var(--radius-xs);
}
</style>
