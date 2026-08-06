<template>
  <div class="page-container custom-scrollbar" @scroll="handleDiscussionsScroll">
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
      <!-- 头部应用主信息卡片 (所有 Tab 共享) -->
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
          <div class="download-update-group">
            <AppButton variant="primary" size="md" icon="fas fa-download" :loading="downloadLoading" @click="handleDownload">
              立即下载
            </AppButton>
            <AppButton variant="secondary" size="md" icon="fas fa-qrcode" :loading="qrLoading" @click="handleShowQr">
              二维码
            </AppButton>
            <AppButton variant="secondary" size="md" icon="fas fa-sync-alt" :loading="updateLoading" @click="handleCheckUpdate">
              检查更新
            </AppButton>
          </div>
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

      <!-- 二维码弹层 -->
      <AppDialog :is-open="!!qrImageUrl" title="手机扫码下载" :width="360" @close="closeQrModal">
        <div class="qr-modal-body">
          <AppImage :src="qrImageUrl" alt="下载二维码" image-class="qr-image" />
          <p class="qr-hint">使用手机扫码即可下载安装该应用</p>
        </div>
      </AppDialog>

      <!-- Tab 导航 -->
      <div class="detail-tabs">
        <button
          v-for="tab in detailTabs"
          :key="tab.key"
          :class="['detail-tab-item', { 'is-active': activeDetailTab === tab.key }]"
          @click="selectDetailTab(tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span v-if="activeDetailTab === tab.key" class="tab-indicator"></span>
        </button>
      </div>

      <!-- Tab: 应用详情 -->
      <template v-if="activeDetailTab === 'detail'">
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
          <div class="description-body" v-html="formattedDescription" @click="handleAnchorClick"></div>
        </div>

        <!-- 更新日志 -->
        <div v-if="formattedChangeLog" class="section-card">
          <h3 class="section-title"><i class="fas fa-clock-rotate-left icon"></i> 新版更新日志</h3>
          <div class="changelog-body" v-html="formattedChangeLog" @click="handleAnchorClick"></div>
        </div>
      </template>

      <!-- Tab: 讨论 -->
      <template v-if="activeDetailTab === 'discussions'">
        <div v-if="discussionsLoading && discussionFeeds.length === 0" class="loading-wrapper">
          <LoadingState text="正在加载讨论..." />
        </div>

        <div v-else-if="discussionsError && discussionFeeds.length === 0" class="error-wrapper">
          <ErrorState title="加载讨论失败" :message="discussionsError" @retry="loadDiscussions(false)" />
        </div>

        <div v-else-if="discussionFeeds.length === 0" class="empty-wrapper">
          <EmptyState title="暂无讨论" description="快来发布第一条讨论吧" />
        </div>

        <div v-else class="feed-list">
          <FeedCard v-for="item in discussionFeeds" :key="item.id" :feed="item" />

          <div class="pagination-footer">
            <LoadingState v-if="discussionsLoading && discussionsPage > 1" text="加载更多中..." />
            <div v-else-if="discussionsNoMore" class="no-more">没有更多讨论了</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAppStore } from '../stores/app';
import AppButton from '../components/common/AppButton.vue';
import AppImage from '../components/common/AppImage.vue';
import AppDialog from '../components/common/AppDialog.vue';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { renderCoolapkRichText } from '../utils/richText';
import { handleAnchorClick } from '../utils/anchorClick';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const packageName = computed(() => (route.params.packageName as string) || '');


const loading = ref(false);
const appInfo = ref<any>(null);
const isFollowed = ref(false);

const downloadLoading = ref(false);
const qrLoading = ref(false);
const updateLoading = ref(false);
const qrImageUrl = ref('');

const activeDetailTab = ref('detail');
const detailTabs = [
  { key: 'detail', label: '应用详情' },
  { key: 'discussions', label: '讨论' },
];

const discussionFeeds = ref<any[]>([]);
const discussionsPage = ref(1);
const discussionsLoading = ref(false);
const discussionsNoMore = ref(false);
const discussionsError = ref('');

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
  // 应用简介/更新日志是开发者可控内容，必须走安全化渲染（去标签防注入）
  return renderCoolapkRichText(text);
});

const formattedChangeLog = computed(() => {
  const text = appInfo.value?.changeLog || appInfo.value?.changelog || '';
  return renderCoolapkRichText(text);
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

async function loadDiscussions(reset: boolean = false) {
  if (!packageName.value || discussionsLoading.value) return;
  if (!reset && discussionsNoMore.value) return;

  if (reset) {
    discussionsPage.value = 1;
    discussionsNoMore.value = false;
    discussionFeeds.value = [];
    discussionsError.value = '';
  }

  discussionsLoading.value = true;

  try {
    const res = await CoolapkTauriAPI.getApkFeeds(packageName.value, 'lastupdate_desc', discussionsPage.value);
    const data = res?.data || [];
    const items = Array.isArray(data) ? data : [];

    if (items.length === 0) {
      discussionsNoMore.value = true;
    } else {
      if (reset) {
        discussionFeeds.value = items;
      } else {
        discussionFeeds.value.push(...items);
      }
      discussionsPage.value++;
    }
  } catch (err: any) {
    discussionsError.value = err?.message || '加载讨论失败';
  } finally {
    discussionsLoading.value = false;
  }
}

function selectDetailTab(key: string) {
  activeDetailTab.value = key;
  if (key === 'discussions' && discussionFeeds.value.length === 0) {
    loadDiscussions(true);
  }
}

function handleDiscussionsScroll(e: Event) {
  if (activeDetailTab.value !== 'discussions') return;
  const el = e.target as HTMLElement;
  if (!el) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
    if (!discussionsLoading.value && !discussionsNoMore.value) {
      loadDiscussions(false);
    }
  }
}

function openViewer(idx: number) {
  if (screenshots.value.length > 0) {
    appStore.openImageViewer(screenshots.value, idx);
  }
}

function extractUrl(data: any, keys: string[]): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return '';
  for (const key of keys) {
    const v = data[key];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

async function handleDownload() {
  if (!packageName.value || downloadLoading.value) return;
  downloadLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getApkUrl(packageName.value);
    const data = res?.data ?? res;
    const url = extractUrl(data, ['url', 'downloadUrl', 'download_url', 'apkDownloadUrl', 'apk_download_url']);
    if (!url) {
      alert('获取下载链接失败：接口未返回有效链接');
      return;
    }
    CoolapkTauriAPI.openUrl(url, 'system');
  } catch (err: any) {
    alert(`获取下载链接失败：${err?.message || '请检查网络或登录状态'}`);
  } finally {
    downloadLoading.value = false;
  }
}

async function handleShowQr() {
  if (!packageName.value || qrLoading.value) return;
  qrLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getApkQr(packageName.value);
    const data = res?.data ?? res;
    const imgUrl = extractUrl(data, ['url', 'qrUrl', 'qr_url', 'imageUrl', 'image_url', 'img', 'image']);
    if (!imgUrl) {
      alert('获取二维码失败：接口未返回图片链接');
      return;
    }
    qrImageUrl.value = imgUrl;
  } catch (err: any) {
    alert(`获取二维码失败：${err?.message || '请检查网络或登录状态'}`);
  } finally {
    qrLoading.value = false;
  }
}

function closeQrModal() {
  qrImageUrl.value = '';
}

function formatUpdateResult(data: any): string {
  if (data == null) return '已是最新版本';

  let hasUpdate = false;
  let firstItem: any = data;
  if (Array.isArray(data)) {
    hasUpdate = data.length > 0;
    firstItem = data[0];
  } else if (typeof data === 'object') {
    hasUpdate = !!(data.hasUpdate || data.has_update);
    if (data.versions && Array.isArray(data.versions) && data.versions.length > 0) {
      hasUpdate = true;
      firstItem = data.versions[0];
    }
  }

  if (!hasUpdate) return '已是最新版本';

  const versionName = firstItem?.versionName || firstItem?.version_name || firstItem?.apkversionname || firstItem?.version || '未知版本';
  const size = firstItem?.size || firstItem?.apksize || firstItem?.apkSizeFormatted || '';
  const changeLog = firstItem?.changeLog || firstItem?.changelog || firstItem?.message || '';
  let text = `发现新版本：${versionName}`;
  if (size) text += `（${size}）`;
  if (changeLog) text += `\n更新日志：${changeLog}`;
  return text;
}

async function handleCheckUpdate() {
  if (!packageName.value || updateLoading.value) return;
  updateLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.checkUpdate(packageName.value);
    const data = res?.data ?? res;
    alert(formatUpdateResult(data));
  } catch (err: any) {
    alert(`检查更新失败：${err?.message || '请检查网络或登录状态'}`);
  } finally {
    updateLoading.value = false;
  }
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

watch(packageName, () => {
  activeDetailTab.value = 'detail';
  discussionFeeds.value = [];
  discussionsPage.value = 1;
  discussionsNoMore.value = false;
  discussionsError.value = '';
  fetchAppDetail();
});

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

.download-update-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.qr-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
}

.qr-image {
  width: 240px;
  height: 240px;
  border-radius: var(--radius-control);
  border: 1px solid var(--border-light);
  background-color: var(--background);
}

.qr-hint {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  margin: 0;
}

.detail-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  min-height: 42px;
  padding: 0 var(--space-2);
  border-bottom: 1px solid var(--border);
}

.detail-tab-item {
  position: relative;
  height: 42px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.detail-tab-item:hover,
.detail-tab-item.is-active {
  color: var(--brand-primary);
}

.detail-tab-item.is-active {
  font-weight: var(--font-weight-semibold);
}

.tab-indicator {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 3px;
  border-radius: var(--radius-pill);
  background: var(--brand-primary);
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
