<template>
  <div class="settings-section">
    <h3 class="section-title">下载与缓存设置</h3>

    <div class="setting-group">
      <h4 class="group-title">下载存储</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">默认保存目录</span>
          <span class="row-sub">
            {{ displayDownloadPath }}（用于导出数据等文件保存；留空则使用系统下载目录）
          </span>
        </div>
        <AppButton variant="secondary" size="sm" @click="chooseDownloadDir">更改目录</AppButton>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">同时下载并发任务数</span>
          <span class="row-sub">为未来的下载管理器预留，当前版本暂未启用下载任务</span>
        </div>
        <select
          v-model.number="settingsStore.settings.maxConcurrentDownloads"
          class="select-control"
          disabled
        >
          <option v-for="n in [1, 2, 3, 4, 5, 6, 8]" :key="n" :value="n">{{ n }} 任务</option>
        </select>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">图片与数据缓存</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">图片加载质量</span>
          <span class="row-sub">控制高清图与缩略图加载比例</span>
        </div>
        <select v-model="settingsStore.settings.imageQuality" class="select-control">
          <option value="standard">标准 (流畅省流量)</option>
          <option value="hd">高清 (推荐)</option>
          <option value="raw">原图</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">自动清理缓存</span>
          <span class="row-sub">应用启动时先删除过期图片；总占用超过阈值后再清理全部缓存</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.autoCleanCache" />
      </div>

      <div v-if="settingsStore.settings.autoCleanCache" class="setting-row">
        <div class="row-info">
          <span class="row-label">缓存清理阈值</span>
          <span class="row-sub">当本地缓存超过该值时触发自动清理</span>
        </div>
        <select v-model.number="settingsStore.settings.cacheThresholdMB" class="select-control">
          <option :value="200">超过 200 MB</option>
          <option :value="500">超过 500 MB (推荐)</option>
          <option :value="1000">超过 1 GB</option>
          <option :value="2000">超过 2 GB</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">图片缓存有效期</span>
          <span class="row-sub">超过有效期的图片会在应用启动时和再次读取时自动删除</span>
        </div>
        <select v-model.number="settingsStore.settings.cacheTtlDays" class="select-control" @change="cleanExpiredCache">
          <option :value="1">1 天</option>
          <option :value="3">3 天</option>
          <option :value="7">7 天（推荐）</option>
          <option :value="14">14 天</option>
          <option :value="30">30 天</option>
          <option :value="0">永不过期</option>
        </select>
      </div>

      <div class="setting-row cache-directory-row">
        <div class="row-info">
          <span class="row-label">图片缓存目录</span>
          <span class="row-sub cache-path">{{ cacheDirectoryText }}</span>
          <span class="row-sub">自定义目录中会创建 CoolapkDesktopCache\images；WebView 系统缓存位置不变</span>
        </div>
        <div class="row-actions">
          <AppButton variant="ghost" size="sm" @click="openCacheDir">打开目录</AppButton>
          <AppButton variant="secondary" size="sm" @click="chooseCacheDir">更改目录</AppButton>
          <AppButton
            v-if="settingsStore.settings.cachePath"
            variant="ghost"
            size="sm"
            @click="resetCacheDir"
          >恢复默认</AppButton>
        </div>
      </div>

      <div class="setting-row cache-usage-row">
        <div class="row-info cache-usage-info">
          <span class="row-label">缓存占用</span>
          <div class="cache-total-line">
            <span class="cache-total-label">当前总占用</span>
            <strong v-if="cacheBytes !== null" class="cache-total-value">{{ formatBytes(cacheBytes) }}</strong>
            <span v-else class="cache-total-value is-loading">正在统计...</span>
          </div>
          <div class="cache-breakdown">
            <span class="cache-breakdown-item"><span>图片</span><strong>{{ formatBytes(cacheImageBytes) }}</strong></span>
            <span class="cache-breakdown-item"><span>WebView</span><strong>{{ formatBytes(cacheWebviewBytes) }}</strong></span>
            <span class="cache-breakdown-item"><span>更新包</span><strong>{{ formatBytes(cacheUpdateBytes) }}</strong></span>
          </div>
        </div>
        <div class="row-actions cache-usage-actions">
          <AppButton variant="ghost" size="sm" :disabled="cacheBusy" @click="cleanExpiredCache">
            清理过期项
          </AppButton>
          <AppButton variant="ghost" size="sm" :disabled="cacheBusy" @click="clearCache">
            {{ cacheBusy ? '清理中...' : '清理全部缓存' }}
          </AppButton>
        </div>
      </div>
    </div>
    <div class="setting-group">
      <h4 class="group-title">更新包下载</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">下载速度限制</span>
          <span class="row-sub">限制后台更新包下载的最大速度，避免占用全部带宽</span>
        </div>
        <select v-model.number="settingsStore.settings.updateSpeedLimitKBps" class="select-control">
          <option :value="0">不限速 (推荐)</option>
          <option :value="500">500 KB/s</option>
          <option :value="1024">1 MB/s</option>
          <option :value="2048">2 MB/s</option>
          <option :value="5120">5 MB/s</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">HTTP 代理</span>
          <span class="row-sub">为更新下载配置代理服务器（如 http://127.0.0.1:7890），留空则直连</span>
        </div>
        <input
          v-model="settingsStore.settings.proxyUrl"
          type="text"
          class="text-input"
          placeholder="http://127.0.0.1:7890"
        />
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">下载完成桌面通知</span>
          <span class="row-sub">更新包下载完成后发送系统通知提醒</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.notifyDownloadComplete" />
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">数据管理</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">导出浏览历史</span>
          <span class="row-sub">将酷安账号的浏览历史导出为 JSON 文件保存到下载目录</span>
        </div>
        <AppButton variant="ghost" size="sm" :disabled="exporting" @click="exportHistory">
          {{ exporting ? '导出中...' : '导出 JSON' }}
        </AppButton>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">导出我的收藏</span>
          <span class="row-sub">将我的收藏导出为 JSON 文件保存到下载目录</span>
        </div>
        <AppButton variant="ghost" size="sm" :disabled="exporting" @click="exportFavorites">
          {{ exporting ? '导出中...' : '导出 JSON' }}
        </AppButton>
      </div>

      <p v-if="exportResult" class="tray-tip">
        <i class="fas fa-check-circle"></i>
        已导出到：{{ exportResult }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import { useAuthStore } from '../../stores/auth';
import AppButton from '../../components/common/AppButton.vue';
import AppSwitch from '../../components/common/AppSwitch.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { clearResourceCache, clearResourceMemoryCache } from '../../utils/resourceCache';

const settingsStore = useSettingsStore();
const authStore = useAuthStore();

const exporting = ref(false);
const exportResult = ref('');
const cacheBusy = ref(false);
const cacheBytes = ref<number | null>(null);
const cacheImageBytes = ref(0);
const cacheWebviewBytes = ref(0);
const cacheUpdateBytes = ref(0);
const cacheDirectory = ref('');

const displayDownloadPath = computed(
  () => settingsStore.settings.downloadPath || '（系统下载目录）'
);

const cacheDirectoryText = computed(() => (
  cacheDirectory.value || (settingsStore.settings.cachePath
    ? `${settingsStore.settings.cachePath}\\CoolapkDesktopCache\\images`
    : '正在读取默认缓存目录...')
));

function formatBytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

async function refreshCacheInfo() {
  try {
    const info = await CoolapkTauriAPI.getCacheInfo(settingsStore.settings.cachePath);
    cacheBytes.value = Number(info?.bytes) || 0;
    cacheImageBytes.value = Number(info?.imageBytes) || 0;
    cacheWebviewBytes.value = Number(info?.webviewBytes) || 0;
    cacheUpdateBytes.value = Number(info?.updateBytes) || 0;
    cacheDirectory.value = String(info?.path || '');
  } catch {
    cacheBytes.value = 0;
  }
}

async function clearCache() {
  if (cacheBusy.value) return;
  cacheBusy.value = true;
  try {
    sessionStorage.clear();
    await clearResourceCache();
    const info = await CoolapkTauriAPI.clearAppCache(settingsStore.settings.cachePath);
    cacheBytes.value = Number(info?.bytes) || 0;
    await refreshCacheInfo();
    alert(`缓存清理完成，当前占用约 ${formatBytes(cacheBytes.value)}`);
  } catch (err) {
    alert(`缓存清理失败：${err instanceof Error ? err.message : String(err)}`);
  } finally {
    cacheBusy.value = false;
  }
}

async function cleanExpiredCache() {
  if (cacheBusy.value) return;
  cacheBusy.value = true;
  try {
    await CoolapkTauriAPI.cleanExpiredCache(
      settingsStore.settings.cachePath,
      settingsStore.settings.cacheTtlDays
    );
    clearResourceMemoryCache();
    await refreshCacheInfo();
  } catch (err) {
    alert(`清理过期缓存失败：${err instanceof Error ? err.message : String(err)}`);
  } finally {
    cacheBusy.value = false;
  }
}

async function chooseCacheDir() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, title: '选择图片缓存所在目录' });
    if (typeof selected === 'string' && selected) {
      settingsStore.settings.cachePath = selected;
      clearResourceMemoryCache();
      await refreshCacheInfo();
    }
  } catch (err) {
    alert(`选择缓存目录失败：${err instanceof Error ? err.message : String(err)}`);
  }
}

async function openCacheDir() {
  try {
    cacheDirectory.value = await CoolapkTauriAPI.openCacheDirectory(settingsStore.settings.cachePath);
  } catch (err) {
    alert(`打开缓存目录失败：${err instanceof Error ? err.message : String(err)}`);
  }
}

async function resetCacheDir() {
  settingsStore.settings.cachePath = '';
  clearResourceMemoryCache();
  await refreshCacheInfo();
}

async function chooseDownloadDir() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, title: '选择默认保存目录' });
    if (typeof selected === 'string' && selected) {
      settingsStore.settings.downloadPath = selected;
    }
  } catch (err) {
    alert(`选择目录失败：${err instanceof Error ? err.message : String(err)}`);
  }
}

function dateStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function exportError(err: unknown) {
  return `导出失败：${err instanceof Error ? err.message : String(err)}（请先登录酷安账号）`;
}

async function collectPages(
  fetcher: (page: number) => Promise<any>,
  maxPages = 10
): Promise<any[]> {
  const items: any[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetcher(page);
    const list = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    items.push(...list);
    if (list.length === 0) break;
  }
  return items;
}

async function exportHistory() {
  if (exporting.value) return;
  if (!authStore.isLoggedIn) {
    alert('请先登录酷安账号后再导出浏览历史');
    return;
  }
  exporting.value = true;
  exportResult.value = '';
  try {
    const items = await collectPages((page) => CoolapkTauriAPI.getHitHistory(page));
    const path = await CoolapkTauriAPI.exportJsonFile(
      `coolapk_history_${dateStamp()}.json`,
      JSON.stringify(items, null, 2),
      settingsStore.settings.downloadPath
    );
    exportResult.value = path;
  } catch (err) {
    alert(exportError(err));
  } finally {
    exporting.value = false;
  }
}

async function exportFavorites() {
  if (exporting.value) return;
  if (!authStore.isLoggedIn) {
    alert('请先登录酷安账号后再导出收藏');
    return;
  }
  exporting.value = true;
  exportResult.value = '';
  try {
    const items = await collectPages((page) => CoolapkTauriAPI.getFavoriteList('feed', page));
    const path = await CoolapkTauriAPI.exportJsonFile(
      `coolapk_favorites_${dateStamp()}.json`,
      JSON.stringify(items, null, 2),
      settingsStore.settings.downloadPath
    );
    exportResult.value = path;
  } catch (err) {
    alert(exportError(err));
  } finally {
    exporting.value = false;
  }
}

onMounted(() => {
  void refreshCacheInfo();
});
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 720px;
}

.section-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-3);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.group-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-light);
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cache-directory-row {
  align-items: flex-start;
}

.cache-usage-info {
  min-width: 0;
  flex: 1 1 auto;
  gap: 4px;
}

.cache-total-line {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.cache-total-label {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
}

.cache-total-value {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.cache-total-value.is-loading {
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
}

.cache-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--space-3);
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.cache-breakdown-item {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.cache-breakdown-item strong {
  color: var(--text-secondary);
  font-weight: var(--font-weight-semibold);
}

.cache-path {
  max-width: 500px;
  color: var(--text-secondary);
  word-break: break-all;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  flex-shrink: 0;
  margin-left: var(--space-4);
}

.cache-usage-actions {
  gap: 4px;
  margin-left: var(--space-3);
  white-space: nowrap;
}

.cache-usage-actions :deep(.app-button) {
  padding: 4px 8px;
  font-size: 12px;
}

.row-label {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.row-sub {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.select-control {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 6px 12px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.select-control:hover {
  border-color: var(--brand-primary);
}

.text-input {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 6px 12px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  outline: none;
  width: 220px;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.text-input:hover,
.text-input:focus {
  border-color: var(--brand-primary);
}

.tray-tip {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  word-break: break-all;
}
</style>
