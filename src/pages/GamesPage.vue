<template>
  <div class="page-container custom-scrollbar">
    <!-- 头部区域 -->
    <div class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title">
            <i class="fas fa-gamepad icon"></i> 酷安游戏中心
          </h2>
          <span class="page-subtitle">探寻热门游戏大作、独立精品与酷友真实游戏评测</span>
        </div>

        <!-- 游戏搜索框 -->
        <div class="search-box">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索指定游戏或评测..."
            class="search-input"
            @keyup.enter="handleSearch"
          />
          <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 分类快捷标签栏 -->
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.key"
          :class="['cat-tab', { active: activeCat === cat.key && !isSearching }]"
          @click="selectCategory(cat.key)"
        >
          <i :class="cat.icon"></i> {{ cat.name }}
        </button>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState :text="loadingText" />
    </div>

    <!-- 空数据状态 -->
    <div v-else-if="currentItems.length === 0" class="empty-wrapper">
      <EmptyState
        title="暂无相关游戏或评测"
        description="可尝试切换分类标签或在上方搜索框直接查找游戏名称"
      />
    </div>

    <!-- 游评模式列表 -->
    <div v-else-if="activeCat === 'reviews' && !isSearching" class="reviews-feed">
      <div
        v-for="feed in currentItems"
        :key="feed.id || feed.feedId"
        class="review-card"
        @click="navigateToFeed(feed)"
      >
        <div class="review-header">
          <AppImage :src="getAvatar(feed)" image-class="user-avatar" alt="头像" />
          <div class="user-info">
            <span class="username">{{ feed.username || feed.userName || '酷友' }}</span>
            <span class="device-tag">{{ feed.deviceTitle || '手机游戏社区' }}</span>
          </div>
        </div>
        <div class="review-body">
          <h4 v-if="feed.title" class="review-title">{{ feed.title }}</h4>
          <p class="review-text">{{ feed.message || feed.description || feed.subTitle }}</p>
        </div>
        <div class="review-footer">
          <span class="stat"><i class="far fa-thumbs-up"></i> {{ feed.likenum || 0 }}</span>
          <span class="stat"><i class="far fa-comment"></i> {{ feed.replynum || 0 }}</span>
        </div>
      </div>
    </div>

    <!-- 游戏网格区域 -->
    <div v-else class="games-grid">
      <div
        v-for="game in currentItems"
        :key="game.id || game.packageName || game.title"
        class="game-card"
        @click="navigateToApp(game)"
      >
        <AppImage :src="getIcon(game)" alt="Logo" image-class="game-icon" />
        <div class="game-info">
          <div class="game-title-row">
            <span class="game-title">{{ game.title || game.shorttitle || '精选游戏' }}</span>
            <span v-if="game.score" class="score-badge">
              <i class="fas fa-star"></i> {{ game.score }}
            </span>
          </div>
          <span class="game-sub">{{ game.subTitle || game.description || '酷安精品手游推荐' }}</span>
          
          <div class="game-meta">
            <span class="tag">{{ game.category || '手游' }}</span>
            <span v-if="game.apkSizeFormatted || game.size" class="meta-item">
              <i class="fas fa-hdd"></i> {{ game.apkSizeFormatted || game.size }}
            </span>
            <span v-if="game.downCountFormatted || game.downnum" class="meta-item">
              <i class="fas fa-download"></i> {{ game.downCountFormatted || game.downnum }}
            </span>
          </div>
        </div>

        <AppButton variant="secondary" size="sm" icon="fas fa-chevron-right" class="action-btn">
          详情
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import AppButton from '../components/common/AppButton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const router = useRouter();
const activeCat = ref('hot');
const searchQuery = ref('');
const isSearching = ref(false);
const loading = ref(false);
const gamesList = ref<any[]>([]);
const reviewsList = ref<any[]>([]);

const categories = [
  { key: 'hot', name: '热门大作', icon: 'fas fa-fire' },
  { key: 'single', name: '单机精品', icon: 'fas fa-gamepad' },
  { key: 'online', name: '网游竞技', icon: 'fas fa-network-wired' },
  { key: 'casual', name: '休闲益智', icon: 'fas fa-chess-board' },
  { key: 'indie', name: '独立神作', icon: 'fas fa-cube' },
  { key: 'reviews', name: '酷友游评', icon: 'fas fa-comments' },
];

const currentItems = computed(() => {
  return activeCat.value === 'reviews' && !isSearching.value
    ? reviewsList.value
    : gamesList.value;
});

const loadingText = computed(() => {
  if (isSearching.value) return `正在搜索 "${searchQuery.value}" 相关游戏...`;
  if (activeCat.value === 'reviews') return '正在加载酷友游戏体验评测...';
  return '正在获取酷安热门游戏列表...';
});

function getIcon(game: any): string {
  return (
    game.icon ||
    game.apkRomIcon ||
    game.logo ||
    game.pic ||
    'https://c2.coolapk.com/coolmarket/apk/default_avatar.png'
  );
}

function getAvatar(item: any): string {
  return (
    item.userAvatar ||
    item.user_avatar ||
    'https://c2.coolapk.com/coolmarket/apk/default_avatar.png'
  );
}

async function loadData() {
  loading.value = true;
  gamesList.value = [];
  reviewsList.value = [];

  try {
    if (isSearching.value && searchQuery.value.trim()) {
      const res = await CoolapkTauriAPI.searchGames(searchQuery.value.trim(), 1);
      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        gamesList.value = list.filter((item: any) => item.title || item.packageName);
      }
      return;
    }

    if (activeCat.value === 'reviews') {
      const res = await CoolapkTauriAPI.searchFeeds('游戏评测', 1);
      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        reviewsList.value = list.filter((item: any) => item.message || item.title);
      }
      return;
    }

    const res = await CoolapkTauriAPI.getGameList(activeCat.value, 1);
    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      gamesList.value = list.filter((item: any) => item.title || item.packageName);
    }
  } catch (err) {
    console.warn('Failed to load game module data', err);
  } finally {
    loading.value = false;
  }
}

function selectCategory(catKey: string) {
  activeCat.value = catKey;
  if (isSearching.value) {
    isSearching.value = false;
    searchQuery.value = '';
  }
  loadData();
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    isSearching.value = true;
    loadData();
  }
}

function clearSearch() {
  searchQuery.value = '';
  isSearching.value = false;
  loadData();
}

function navigateToApp(game: any) {
  const pkg = game.packageName || game.id || game.title;
  if (pkg) {
    router.push(`/app/${pkg}`);
  }
}

function navigateToFeed(feed: any) {
  if (feed.id) {
    router.push(`/feed/${feed.id}`);
  }
}

onMounted(() => loadData());
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0;
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-titles {
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

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 280px;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 32px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  outline: none;
  transition: all var(--duration-fast);
}

.search-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.clear-btn {
  position: absolute;
  right: 10px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
}

.clear-btn:hover {
  color: var(--text-primary);
}

.category-tabs {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.cat-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cat-tab:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.cat-tab.active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--space-4);
}

.game-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.game-card:hover {
  border-color: var(--brand-primary);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.game-icon {
  width: 58px;
  height: 58px;
  border-radius: var(--radius-control);
  object-fit: cover;
  flex-shrink: 0;
}

.game-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.game-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.game-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score-badge {
  font-size: 11px;
  color: #f59e0b;
  font-weight: bold;
  background-color: rgba(245, 158, 11, 0.1);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
}

.game-sub {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.game-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.tag {
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  font-size: 10px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.action-btn {
  flex-shrink: 0;
}

/* 游评列表样式 */
.reviews-feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.review-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--duration-fast);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.review-card:hover {
  border-color: var(--brand-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.review-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar :deep(img) {
  border-radius: 50%;
  object-fit: cover;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.username {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.device-tag {
  font-size: 11px;
  color: var(--text-tertiary);
}

.review-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.review-text {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.review-footer {
  display: flex;
  gap: var(--space-4);
  font-size: 12px;
  color: var(--text-tertiary);
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
