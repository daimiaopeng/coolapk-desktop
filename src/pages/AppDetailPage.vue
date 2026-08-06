<template>
  <div class="page-container custom-scrollbar">
    <!-- 顶栏返回工具条 -->
    <div class="detail-nav-bar">
      <button class="back-btn" @click="handleGoBack">
        <i class="fas fa-arrow-left"></i>
        <span>返回</span>
      </button>
      <span v-if="appTitle" class="nav-app-name">{{ appTitle }}</span>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在加载应用详情..." />
    </div>

    <div v-else-if="!appInfo" class="empty-wrapper">
      <EmptyState title="未找到该应用信息" description="该应用可能已被下架或包名不正确" />
    </div>

    <div v-else class="app-detail-content">
      <!-- 头部应用主信息卡片 -->
      <div class="app-header-card">

        <AppImage :src="logoUrl" alt="App Logo" image-class="app-large-icon" />

        <div class="app-main-meta">
          <div class="title-row">
            <h1 class="app-title">{{ appTitle }}</h1>
            <span v-if="appVersion" class="version-tag">v{{ appVersion }}</span>
          </div>

          <div class="sub-row">
            <span class="developer-text">{{ developerName }}</span>
            <span class="dot-divider">•</span>
            <span class="apk-size">{{ apkSize }}</span>
            <span class="dot-divider">•</span>
            <span class="update-time">{{ updateTime }}</span>
          </div>

          <div class="metrics-row">
            <div class="metric-item">
              <span class="metric-value text-gold">
                <i class="fas fa-star"></i> {{ ratingScore }}
              </span>
              <span class="metric-label">{{ ratingCount }} 人评分</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-item">
              <span class="metric-value">{{ downloadCount }}</span>
              <span class="metric-label">下载量</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-item">
              <span class="metric-value">{{ packageName }}</span>
              <span class="metric-label">包名</span>
            </div>
          </div>
        </div>

        <div class="header-actions">
          <AppButton variant="primary" size="md" icon="fas fa-download" @click="handleDownload">
            立即下载 APK
          </AppButton>
          <AppButton
            :variant="isFollowed ? 'secondary' : 'primary'"
            size="md"
            :icon="isFollowed ? 'fas fa-check' : 'fas fa-plus'"
            @click="toggleFollow"
          >
            {{ isFollowed ? '已关注' : '关注应用' }}
          </AppButton>
        </div>
      </div>

      <!-- 应用截图列表横滑区域 -->
      <div v-if="screenshots.length > 0" class="section-card">
        <h3 class="section-title"><i class="fas fa-images icon"></i> 应用截图</h3>
        <div class="screenshot-carousel custom-scrollbar">
          <div
            v-for="(img, idx) in screenshots"
            :key="idx"
            class="screenshot-item"
            @click="openViewer(idx)"
          >
            <AppImage :src="img" image-class="screenshot-img" />
          </div>
        </div>
      </div>

      <!-- 应用简介描述 -->
      <div class="section-card">
        <h3 class="section-title"><i class="fas fa-align-left icon"></i> 应用简介</h3>
        <div class="description-body" v-html="formattedDescription"></div>
      </div>

      <!-- 更新日志 -->
      <div v-if="changeLog" class="section-card">
        <h3 class="section-title"><i class="fas fa-clock-rotate-left icon"></i> 新版更新日志</h3>
        <div class="changelog-body" v-html="formattedChangeLog"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAppStore } from '../stores/app';
import AppButton from '../components/common/AppButton.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const packageName = computed(() => (route.params.packageName as string) || '');


const loading = ref(false);
const appInfo = ref<any>(null);
const isFollowed = ref(false);

const logoUrl = computed(() => appInfo.value?.apkRomIcon || appInfo.value?.logo || appInfo.value?.icon || '');
const appTitle = computed(() => appInfo.value?.title || appInfo.value?.shorttitle || packageName.value);
const appVersion = computed(() => appInfo.value?.apkversionname || appInfo.value?.versionName || appInfo.value?.version || '');
const developerName = computed(() => appInfo.value?.developername || appInfo.value?.shorttitle || '酷安开发者');
const apkSize = computed(() => appInfo.value?.apksize || appInfo.value?.apkSizeFormatted || appInfo.value?.size || '未知大小');
const updateTime = computed(() => {
  const raw = appInfo.value?.lastupdate || appInfo.value?.lastUpdateFormatted || appInfo.value?.update_time;
  if (typeof raw === 'number') {
    const d = new Date(raw * 1000);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }
  return raw || '近期更新';
});

const ratingScore = computed(() => appInfo.value?.score || appInfo.value?.rating || '8.5');
const ratingCount = computed(() => appInfo.value?.votenum || appInfo.value?.score_count || appInfo.value?.rating_count || 1280);
const downloadCount = computed(() => appInfo.value?.downCount || appInfo.value?.downCountFormatted || appInfo.value?.down_count || '10万+');

const screenshots = computed<string[]>(() => {
  const raw = appInfo.value?.screenList || appInfo.value?.screenshots || appInfo.value?.screenArr || appInfo.value?.screenshot || appInfo.value?.screen || [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.split(',').filter(Boolean);
  return [];
});

const formattedDescription = computed(() => {
  const text = appInfo.value?.description || appInfo.value?.intro || '暂无应用简介描述。';
  return text.replace(/\n/g, '<br/>');
});

const formattedChangeLog = computed(() => {
  const text = appInfo.value?.changeLog || appInfo.value?.changelog || '';
  return text.replace(/\n/g, '<br/>');
});

async function fetchAppDetail() {
  if (!packageName.value) return;
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getAppDetail(packageName.value);
    const data = res?.data || res;
    if (data) {
      appInfo.value = data;
    }
  } catch (err) {
    console.warn('App detail fetch error', err);
  } finally {
    loading.value = false;
  }
}

function openViewer(idx: number) {
  if (screenshots.value.length > 0) {
    appStore.openImageViewer(screenshots.value, idx);
  }
}

function handleDownload() {
  const downloadUrl = appInfo.value?.apkDownloadUrl || `https://www.coolapk.com/apk/${packageName.value}`;
  CoolapkTauriAPI.openUrl(downloadUrl);
}

function toggleFollow() {
  isFollowed.value = !isFollowed.value;
}

function handleGoBack() {
  if (window.history.state && window.history.state.back) {
    router.back();
  } else {
    router.push('/apps');
  }
}


onMounted(() => fetchAppDetail());
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 820px;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
}

.detail-nav-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.back-btn:hover {
  background-color: var(--surface-hover);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.nav-app-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
}

.app-detail-content {

  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.app-header-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-5);
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-6);
}

.app-large-icon {
  width: 84px;
  height: 84px;
  border-radius: var(--radius-large);
  border: 1px solid var(--border-light);
  flex-shrink: 0;
}

.app-main-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.version-tag {
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

.sub-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
}

.dot-divider {
  color: var(--text-tertiary);
}

.metrics-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-3);
  background-color: var(--background);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  width: fit-content;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-value {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.text-gold {
  color: #f59e0b;
}

.metric-label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.metric-divider {
  width: 1px;
  height: 20px;
  background-color: var(--border-light);
}

.header-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex-shrink: 0;
}

.section-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}

.section-title .icon {
  color: var(--brand-primary);
}

.screenshot-carousel {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

.screenshot-item {
  width: 160px;
  height: 280px;
  border-radius: var(--radius-control);
  overflow: hidden;
  border: 1px solid var(--border-light);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform var(--duration-fast);
}

.screenshot-item:hover {
  transform: scale(1.02);
}

.screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.description-body,
.changelog-body {
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-secondary);
}
</style>
