<template>
  <div class="page-container custom-scrollbar">
    <!-- 顶栏工具条：左侧分类 Tab，右侧搜索模式切换 + 搜索框 -->
    <div class="apps-toolbar-bar">
      <div class="apps-tabs-wrapper">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          :class="['cat-tab', { active: activeCat === cat.key && !isSearching }]"
          @click="selectCategory(cat.key)"
        >
          <i :class="cat.icon"></i> {{ cat.name }}
        </button>
      </div>

      <div class="apps-actions-wrapper">
        <!-- 搜索模式切换（应用名 / 开发者 / 标签） -->
        <div class="search-mode-switch" role="group" aria-label="搜索方式">
          <button
            v-for="mode in searchModes"
            :key="mode.key"
            type="button"
            :class="['mode-btn', { 'is-active': searchMode === mode.key }]"
            @click="selectSearchMode(mode.key)"
          >
            <i :class="mode.icon"></i> {{ mode.label }}
          </button>
        </div>

        <!-- 应用搜索输入框 -->
        <div class="search-box">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="searchPlaceholder"
            class="search-input"
            @keyup.enter="handleSearch"
          />
          <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState :text="loadingText" />
    </div>

    <!-- 空数据状态 -->
    <div v-else-if="apps.length === 0" class="empty-wrapper">
      <EmptyState
        title="暂无相关应用数据"
        description="可尝试在上方搜索框直接查找应用名称或切换分类"
      />
    </div>

    <!-- 应用网格/列表区域 -->
    <div v-else class="apps-grid">
      <div
        v-for="app in apps"
        :key="app.id || app.packageName || app.title"
        class="app-card"
        @click="navigateToApp(app)"
      >
        <AppImage :src="getAppIcon(app)" alt="Logo" image-class="app-icon" />
        <div class="app-info">
          <div class="title-row">
            <span class="app-name">{{ app.title || app.shorttitle || '推荐应用' }}</span>
            <span v-if="app.version" class="version-tag">{{ app.version }}</span>
          </div>
          <span class="app-desc">{{ app.subTitle || app.description || app.packageName || '酷安精选推荐软件' }}</span>
          
          <div class="app-meta">
            <span v-if="app.score" class="score">
              <i class="fas fa-star"></i> {{ app.score }}
            </span>
            <span v-if="app.apkSizeFormatted || app.size" class="meta-item">
              <i class="fas fa-hdd"></i> {{ app.apkSizeFormatted || app.size }}
            </span>
            <span v-if="app.downCountFormatted || app.downnum" class="meta-item">
              <i class="fas fa-download"></i> {{ app.downCountFormatted || app.downnum }}
            </span>
          </div>
        </div>

        <AppButton variant="secondary" size="sm" icon="fas fa-arrow-right" class="action-btn">
          查看
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
const activeCat = ref('recommend');
const searchQuery = ref('');
const searchMode = ref('name');
const isSearching = ref(false);
const loading = ref(false);
const apps = ref<any[]>([]);

const searchModes = [
  { key: 'name', label: '应用名', icon: 'fas fa-magnifying-glass' },
  { key: 'developer', label: '开发者', icon: 'fas fa-user' },
  { key: 'tag', label: '标签', icon: 'fas fa-tags' },
];

const categories = [
  { key: 'recommend', name: '推荐榜', icon: 'fas fa-fire' },
  { key: 'newest', name: '酷酷新品', icon: 'fas fa-sparkles' },
  { key: 'tools', name: '系统工具', icon: 'fas fa-wrench' },
  { key: 'social', name: '社交通讯', icon: 'fas fa-comments' },
  { key: 'media', name: '影音播放', icon: 'fas fa-film' },
  { key: 'beauty', name: '美化手机', icon: 'fas fa-palette' },
];

const loadingText = computed(() => {
  if (isSearching.value) return `正在搜索 "${searchQuery.value}" 相关应用...`;
  return '正在探索酷安应用列表...';
});

const searchPlaceholder = computed(() => {
  if (searchMode.value === 'developer') return '输入开发者名称搜索...';
  if (searchMode.value === 'tag') return '输入标签名称搜索...';
  return '搜索指定应用或包名...';
});

function getAppIcon(app: any): string {
  return (
    app.icon ||
    app.apkRomIcon ||
    app.logo ||
    app.pic ||
    'https://c2.coolapk.com/coolmarket/apk/default_avatar.png'
  );
}

async function loadApps() {
  loading.value = true;
  apps.value = [];

  try {
    if (isSearching.value && searchQuery.value.trim()) {
      const query = searchQuery.value.trim();
      let res: any;
      if (searchMode.value === 'developer') {
        res = await CoolapkTauriAPI.searchApksByDeveloper(query, 1);
      } else if (searchMode.value === 'tag') {
        res = await CoolapkTauriAPI.searchApksByTag(query, '1', 1);
      } else {
        res = await CoolapkTauriAPI.searchApks(query, 1);
      }
      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        apps.value = list.filter((item: any) => item.title || item.packageName);
      }
      return;
    }

    const res = await CoolapkTauriAPI.getAppList(activeCat.value, 1);
    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      apps.value = list.filter((item: any) => item.title || item.packageName);
    }
  } catch (err) {
    console.warn('Fetch apps failed', err);
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
  loadApps();
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    isSearching.value = true;
    loadApps();
  }
}

function selectSearchMode(mode: string) {
  if (searchMode.value === mode) return;
  searchMode.value = mode;
  if (isSearching.value && searchQuery.value.trim()) {
    loadApps();
  }
}

function clearSearch() {
  searchQuery.value = '';
  isSearching.value = false;
  loadApps();
}

function navigateToApp(app: any) {
  const pkg = app.packageName || app.id || app.title;
  if (pkg) {
    router.push(`/app/${pkg}`);
  }
}

onMounted(() => loadApps());
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

.apps-toolbar-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0 14px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  flex-wrap: wrap;
}

.apps-tabs-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.cat-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-pill, 20px);
  background-color: var(--surface);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.cat-tab:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.cat-tab.active {
  background-color: var(--brand-soft, rgba(16, 185, 129, 0.12));
  color: var(--brand-primary, #10b981);
  border-color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.apps-actions-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.search-mode-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background-color: var(--background-secondary, var(--surface-hover));
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: var(--radius-pill, 16px);
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-pill, 14px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  color: var(--text-primary);
}

.mode-btn.is-active {
  background-color: var(--surface);
  color: var(--brand-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 220px;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 32px;
  padding: 0 28px;
  border-radius: var(--radius-pill, 16px);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  background-color: var(--surface-hover);
  color: var(--text-primary);
  font-size: 12.5px;
  outline: none;
  transition: all 0.15s ease;
}

.search-input:focus {
  background-color: var(--surface);
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.clear-btn {
  position: absolute;
  right: 8px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  font-size: 11px;
}

.clear-btn:hover {
  color: var(--text-primary);
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: var(--space-4);
}

.app-card {
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

.app-card:hover {
  border-color: var(--brand-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}

.app-icon {
  width: 58px;
  height: 58px;
  border-radius: var(--radius-control);
  object-fit: cover;
  flex-shrink: 0;
}

.app-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.app-name {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.version-tag {
  font-size: 10px;
  color: var(--text-tertiary);
  background-color: var(--surface-hover);
  padding: 1px 5px;
  border-radius: var(--radius-xs);
}

.app-desc {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.score {
  color: #f59e0b;
  font-weight: bold;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.action-btn {
  flex-shrink: 0;
}
</style>

