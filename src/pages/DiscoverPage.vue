<template>
  <div class="page-container custom-scrollbar">
    <!-- 头部区域 -->
    <div class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title">
            <i class="fas fa-compass icon"></i> 发现中心
          </h2>
          <span class="page-subtitle">探索酷友热议话题、二手酷品、全站精选与酷图大赏</span>
        </div>

        <!-- 动态搜索框 -->
        <div class="search-box">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索全站动态或热帖..."
            class="search-input"
            @keyup.enter="handleSearch"
          />
          <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 分类 Tab 栏 -->
      <div class="category-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['cat-tab', { active: activeTab === tab.key && !isSearching }]"
          @click="selectTab(tab.key)"
        >
          <i :class="tab.icon"></i> {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 列表数据区 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState :text="loadingText" />
    </div>

    <div v-else-if="feeds.length === 0" class="empty-wrapper">
      <EmptyState title="暂无相关发现内容" description="可尝试在上方搜索框搜索关键词或切换发现分类" />
    </div>

    <div v-else class="discover-feeds">
      <FeedCard v-for="item in feeds" :key="item.id || item.feedId" :feed="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const activeTab = ref('digest');
const searchQuery = ref('');
const isSearching = ref(false);
const loading = ref(false);
const feeds = ref<any[]>([]);

const tabs = [
  { key: 'digest', label: '精选热帖', icon: 'fas fa-fire' },
  { key: 'secondhand', label: '酷品二手', icon: 'fas fa-store' },
  { key: 'cool_picture', label: '酷图大赏', icon: 'fas fa-camera' },
  { key: 'hot', label: '24H 热榜', icon: 'fas fa-chart-line' }
];

const loadingText = computed(() => {
  if (isSearching.value) return `正在搜索 "${searchQuery.value}" 相关动态...`;
  return '正在搜索与聚合发现流...';
});

async function fetchDiscoverFeeds() {
  loading.value = true;
  feeds.value = [];
  try {
    if (isSearching.value && searchQuery.value.trim()) {
      const res = await CoolapkTauriAPI.searchFeeds(searchQuery.value.trim(), 1);
      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        feeds.value = list.filter((item: any) => item.id && (item.message || item.title || item.username));
      }
      return;
    }

    let res: any;
    if (activeTab.value === 'secondhand') {
      res = await CoolapkTauriAPI.getSecondHandFeeds(1);
    } else if (activeTab.value === 'cool_picture') {
      res = await CoolapkTauriAPI.getCoolPictureRank(1);
    } else if (activeTab.value === 'hot') {
      res = await CoolapkTauriAPI.getHotFeeds(1);
    } else {
      res = await CoolapkTauriAPI.getDigestFeeds(1);
    }

    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      feeds.value = list.filter((item: any) => item.id && (item.message || item.title || item.pic || item.username));
    }
  } catch (err) {
    console.warn('Fetch discover feeds failed', err);
  } finally {
    loading.value = false;
  }
}

function selectTab(tabKey: string) {
  activeTab.value = tabKey;
  if (isSearching.value) {
    isSearching.value = false;
    searchQuery.value = '';
  }
  fetchDiscoverFeeds();
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    isSearching.value = true;
    fetchDiscoverFeeds();
  }
}

function clearSearch() {
  searchQuery.value = '';
  isSearching.value = false;
  fetchDiscoverFeeds();
}

onMounted(() => fetchDiscoverFeeds());
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

.discover-feeds {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>

