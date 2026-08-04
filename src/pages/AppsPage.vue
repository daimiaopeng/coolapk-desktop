<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <div class="header-title-row">
        <h2 class="page-title"><i class="fas fa-cubes icon"></i> 应用中心</h2>
        <span class="page-subtitle">探索酷安精选 Android 应用与优质工具</span>
      </div>

      <!-- 分类快捷标签栏 -->
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.key"
          :class="['cat-tab', { active: activeCat === cat.key }]"
          @click="activeCat = cat.key"
        >
          <i :class="cat.icon"></i> {{ cat.name }}
        </button>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在探索酷安应用列表..." />
    </div>

    <div v-else-if="apps.length === 0" class="empty-wrapper">
      <EmptyState title="暂无应用数据" description="可尝试在顶部搜索框直接搜素指定包名或应用名称" />
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
            <span class="app-name">{{ app.title || app.shorttitle || '未知应用' }}</span>
            <span v-if="app.version" class="app-version">{{ app.version }}</span>
          </div>
          <span class="app-desc">{{ app.subTitle || app.description || app.packageName || '酷安精选推荐应用' }}</span>
          <div class="app-meta">
            <span v-if="app.score" class="score"><i class="fas fa-star"></i> {{ app.score }}</span>
            <span v-if="app.apkSizeFormatted || app.size" class="size">{{ app.apkSizeFormatted || app.size }}</span>
            <span v-if="app.downCountFormatted || app.downnum" class="downloads">{{ app.downCountFormatted || app.downnum }} 下载</span>
          </div>
        </div>
        <AppButton variant="secondary" size="sm" icon="fas fa-arrow-right">
          查看
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import AppButton from '../components/common/AppButton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const router = useRouter();
const activeCat = ref('recommend');
const loading = ref(false);
const apps = ref<any[]>([]);

const categories = [
  { key: 'recommend', name: '推荐榜', icon: 'fas fa-fire' },
  { key: 'tools', name: '系统工具', icon: 'fas fa-wrench' },
  { key: 'social', name: '社交通讯', icon: 'fas fa-comments' },
  { key: 'media', name: '影音播放', icon: 'fas fa-film' },
  { key: 'beauty', name: '美化手机', icon: 'fas fa-palette' }
];

function getAppIcon(app: any): string {
  return app.apkRomIcon || app.logo || app.icon || app.pic || 'https://c2.coolapk.com/coolmarket/apk/default_avatar.png';
}

async function fetchApps() {
  loading.value = true;
  apps.value = [];
  try {
    let query = '应用';
    if (activeCat.value === 'tools') query = '工具';
    if (activeCat.value === 'social') query = '社交';
    if (activeCat.value === 'media') query = '影音';
    if (activeCat.value === 'beauty') query = '壁纸';

    const res = await CoolapkTauriAPI.searchAll(query, 1);
    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      apps.value = list.filter((item: any) => item.title || item.packageName || item.entityType === 'apk');
    }
  } catch (err) {
    console.warn('Fetch apps failed', err);
  } finally {
    loading.value = false;
  }
}

function navigateToApp(app: any) {
  const pkg = app.packageName || app.id || app.title;
  if (pkg) {
    router.push(`/app/${pkg}`);
  }
}

watch(activeCat, () => fetchApps());
onMounted(() => fetchApps());
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

.header-title-row {
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
  width: 56px;
  height: 56px;
  border-radius: var(--radius-control);
  object-fit: cover;
  flex-shrink: 0;
}

.app-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.app-version {
  font-size: 11px;
  color: var(--text-tertiary);
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
  margin-top: 4px;
}

.score {
  color: #f59e0b;
  font-weight: bold;
}
</style>
