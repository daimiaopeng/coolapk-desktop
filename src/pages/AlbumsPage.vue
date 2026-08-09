<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <!-- 头部区域 -->
    <div class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title">
            <i class="fas fa-layer-group icon"></i> 专辑广场
          </h2>
          <span class="page-subtitle">发现酷友整理的应用合集与软件推荐</span>
        </div>

        <!-- 专辑搜索 -->
        <div class="header-actions">
          <div class="search-box">
            <i class="fas fa-search search-icon"></i>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索专辑..."
              class="search-input"
              @keyup.enter="handleSearch"
            />
            <button v-if="searchQuery" class="clear-btn" @click="clearSearch" title="清空搜索">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 分类快捷标签栏 -->
      <div class="category-tabs">
        <button
          v-for="tab in albumTabs"
          :key="tab.key"
          :class="['cat-tab', { active: activeTab === tab.key && !isSearching }]"
          @click="switchTab(tab.key)"
        >
          <i :class="tab.icon"></i> {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading && albums.length === 0" class="loading-wrapper">
      <LoadingState :text="isSearching ? '正在搜索专辑...' : '正在加载专辑列表...'" />
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error && albums.length === 0" class="error-wrapper">
      <ErrorState title="加载失败" :message="error" @retry="fetchAlbums(true)" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="albums.length === 0" class="empty-wrapper">
      <EmptyState
        :title="isSearching ? '未找到相关专辑' : '暂无专辑'"
        description="换个关键词或分类试试，酷安应用集广场等你来逛"
      />
    </div>

    <!-- 专辑卡片网格 -->
    <template v-else>
      <div class="albums-grid">
        <div
          v-for="(item, idx) in albums"
          :key="albumIdOf(item) || idx"
          class="album-card"
          @click="openAlbum(item)"
        >
          <div class="album-cover-wrapper">
            <AppImage
              v-if="albumCoverOf(item)"
              :src="albumCoverOf(item)"
              class="album-cover"
              fit="cover"
              :alt="albumTitleOf(item)"
            />
            <div v-else class="album-cover-fallback">
              <i class="fas fa-layer-group"></i>
            </div>
          </div>

          <div class="album-card-info">
            <span class="album-card-title" :title="albumTitleOf(item)">{{ albumTitleOf(item) }}</span>
            <div v-if="albumAuthorOf(item)" class="album-card-author">
              <i class="far fa-user"></i>
              <span class="album-author-name">{{ albumAuthorOf(item) }}</span>
            </div>
            <div class="album-card-meta">
              <span class="album-count"><i class="fas fa-cubes"></i> {{ formatNumber(albumAppCountOf(item)) }} 应用</span>
            </div>
            <p v-if="albumDescOf(item)" class="album-card-desc">{{ albumDescOf(item) }}</p>
          </div>
        </div>
      </div>

      <!-- 底部加载状态 -->
      <div class="pagination-footer">
        <LoadingState v-if="loading && page > 1" text="正在加载更多专辑..." />
        <button v-else-if="error" class="retry-inline" @click="fetchAlbums(true)">加载失败，点击重试</button>
        <div v-else-if="noMore" class="no-more">已加载全部专辑</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';

const router = useRouter();

const albumTabs = [
  { key: 'hot', label: '热门', icon: 'fas fa-fire' },
  { key: 'new', label: '最新', icon: 'fas fa-clock' },
];

const activeTab = ref('hot');
const searchQuery = ref('');
const isSearching = ref(false);

const albums = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const noMore = ref(false);
const error = ref('');

function albumIdOf(item: any): string {
  return String(item?.id ?? item?.albumId ?? item?.album_id ?? item?.entityId ?? '');
}

function albumCoverOf(item: any): string {
  return item?.pic || item?.cover || item?.logo || item?.icon || '';
}

function albumTitleOf(item: any): string {
  return item?.title || item?.name || item?.albumName || '未命名专辑';
}

function albumAuthorOf(item: any): string {
  return item?.username || item?.userInfo?.username || '';
}

function albumAppCountOf(item: any): number {
  const n = Number(item?.apkCount ?? item?.apk_count ?? item?.apknum ?? 0);
  return isNaN(n) ? 0 : n;
}

function albumDescOf(item: any): string {
  return item?.description || item?.intro || '';
}

function formatNumber(num: number): string {
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

function openAlbum(item: any) {
  const id = albumIdOf(item);
  if (id) router.push(`/album/${id}`);
}

function resetList() {
  page.value = 1;
  noMore.value = false;
  error.value = '';
  albums.value = [];
}

function switchTab(key: string) {
  if (activeTab.value === key && !isSearching.value) return;
  activeTab.value = key;
  searchQuery.value = '';
  isSearching.value = false;
  resetList();
  void fetchAlbums(false);
}

function handleSearch() {
  const q = searchQuery.value.trim();
  if (!q) {
    clearSearch();
    return;
  }
  isSearching.value = true;
  resetList();
  void fetchAlbums(false);
}

function clearSearch() {
  searchQuery.value = '';
  if (!isSearching.value) return;
  isSearching.value = false;
  resetList();
  void fetchAlbums(false);
}

async function fetchAlbums(isLoadMore = false) {
  if (loading.value || noMore.value) return;
  loading.value = true;
  if (!isLoadMore) error.value = '';

  try {
    const res = isSearching.value
      ? await CoolapkTauriAPI.searchAlbums(searchQuery.value.trim(), page.value)
      : await CoolapkTauriAPI.getAlbumList(activeTab.value, page.value);
    const list = (res && Array.isArray(res.data)) ? res.data : [];

    if (list.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        const existingIds = new Set(albums.value.map(albumIdOf));
        albums.value.push(...list.filter((i: any) => !existingIds.has(albumIdOf(i))));
      } else {
        albums.value = list;
      }
      page.value++;
    }
  } catch (err: any) {
    error.value = err?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
  }
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 200) {
    if (!loading.value && !noMore.value) {
      void fetchAlbums(true);
    }
  }
}

onMounted(() => {
  void fetchAlbums(false);
});
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

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 260px;
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

.loading-wrapper,
.error-wrapper,
.empty-wrapper {
  padding: var(--space-10) 0;
}

.albums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: var(--space-4);
  width: 100%;
}

.album-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
}

.album-card:hover {
  border-color: var(--brand-primary);
  transform: translateY(-2px);
}

.album-cover-wrapper {
  width: 100%;
  aspect-ratio: 4 / 3;
  background-color: var(--background);
  border-bottom: 1px solid var(--border-light);
}

.album-cover {
  width: 100%;
  height: 100%;
}

.album-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  color: var(--brand-primary);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.2));
}

.album-card-info {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.album-card-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.album-card-author {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
}

.album-card-author i {
  font-size: 11px;
  color: var(--text-tertiary);
}

.album-author-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-card-meta {
  display: flex;
  align-items: center;
}

.album-count {
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  color: var(--brand-primary);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.album-card-desc {
  margin: 0;
  font-size: var(--font-size-caption);
  line-height: var(--line-height-caption);
  color: var(--text-tertiary);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.pagination-footer {
  padding: var(--space-4) 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.retry-inline {
  border: 0;
  background: transparent;
  color: var(--brand-primary);
  cursor: pointer;
  font-size: var(--font-size-caption);
}
</style>
