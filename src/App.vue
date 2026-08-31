<template>
  <AppShell>
    <router-view v-slot="{ Component, route }">
      <!-- 原生标准页面堆栈：以 route.fullPath 为唯一标识，每个页面独立实例入栈与复原，彻底杜绝数据丢失与重载 -->
      <keep-alive>
        <component
          :is="Component"
          :key="route.fullPath"
          :class="{ 'sidebar-page-enter': isSidebarTransitionActive }"
        />
      </keep-alive>
    </router-view>

    <!-- 全局交互浮层 -->
    <PublishDialog />
    <ImageViewer />
    <SearchCommand />
    <LoginModal />
    <AppConfirmHost />
    <BackToTop />
    <AppContextMenu />

    <AppDialog :is-open="Boolean(updateInfo)" :title="updateInfo?.hasNew ? '发现新版本' : '检查更新'" :width="540" @close="updateInfo = null">
      <div v-if="updateInfo" class="startup-update">
        <div class="startup-update-header">
          <div class="update-header-info">
            <span class="update-app-title">酷安桌面版</span>
            <span class="update-version-tag">{{ updateInfo.hasNew ? updateInfo.latestVersion : `v${APP_VERSION}` }}</span>
          </div>
          <span v-if="updateInfo.publishedAt" class="startup-update-date">
            <i class="far fa-clock"></i> {{ updateInfo.publishedAt }}
          </span>
        </div>

        <div class="startup-update-notes-block">
          <div class="startup-update-notes-header">
            <i class="fas fa-sparkles text-brand"></i>
            <span class="startup-update-notes-label">{{ updateInfo.hasNew ? '更新内容' : '当前版本更新日志' }}</span>
          </div>
          <div
            class="startup-update-notes custom-scrollbar"
            v-html="renderReleaseMarkdown(updateInfo.releaseNotes || '')"
            @click="handleAnchorClick"
          ></div>
        </div>

        <div class="startup-update-actions">
          <div v-if="updateInfo.hasNew" class="update-actions-left">
            <button class="btn-text" title="本次不再提示此版本" @click="ignoreThisVersion">忽略此版本</button>
            <button class="btn-text" title="永久关闭所有自动更新提示" @click="ignoreAllUpdates">忽略所有更新</button>
          </div>
          <div v-else class="update-actions-left">
            <button class="btn-text" @click="openReleasePage">查看 Release 页面</button>
          </div>

          <div class="update-actions-right">
            <button v-if="!updateInfo.hasNew" class="startup-update-later" @click="updateInfo = null">关闭</button>
            <button v-if="updateInfo.hasNew" class="startup-update-later" @click="openUpdate">前往下载</button>
            <button
              v-if="updateInfo.hasNew && updateInfo.installerUrl && isWindows"
              class="startup-update-button"
              @click="startBackgroundDownload(updateInfo)"
            >
              <i class="fas fa-download"></i> 后台下载更新
            </button>
          </div>
        </div>
      </div>
    </AppDialog>

    <AppDialog :is-open="Boolean(downloadNotice)" title="正在下载更新" :width="460" @close="downloadNotice = null">
      <div v-if="downloadNotice" class="startup-update">
        <p class="startup-update-version">酷安桌面版 {{ downloadNotice.version }}</p>
        <p v-if="downloadNotice.releaseNotes" class="startup-update-notes">
          <span class="startup-update-notes-label">更新日志：</span>{{ downloadNotice.releaseNotes }}
        </p>
        <p class="startup-update-notes">已发现新版本，更新包正在后台下载。下载完成后会再次提示是否立即安装。</p>
        <p v-if="downloading" class="startup-update-notes">
          当前进度：{{ downloading.percent }}%（{{ formatBytes(downloading.downloaded) }} / {{ formatBytes(downloading.total) }}）
        </p>
        <div class="startup-update-actions">
          <button class="startup-update-later" @click="downloadNotice = null">知道了</button>
        </div>
      </div>
    </AppDialog>

    <AppDialog :is-open="Boolean(readyInfo)" title="更新包已下载" :width="460" @close="readyInfo = null">
      <div v-if="readyInfo" class="startup-update">
        <p class="startup-update-version">酷安桌面版 {{ readyInfo.version }} 更新包已下载完成</p>
        <p class="startup-update-notes">是否立即更新？更新将关闭当前窗口，全自动完成安装后重新打开软件。</p>
        <div class="startup-update-actions">
          <button class="startup-update-later" @click="readyInfo = null">稍后再说</button>
          <button class="startup-update-button" :disabled="installingUpdate" @click="installNow">
            {{ installingUpdate ? '正在启动安装…' : '立即更新' }}
          </button>
        </div>
      </div>
    </AppDialog>

    <AppDialog :is-open="Boolean(downloadError)" title="更新失败" :width="460" @close="downloadError = null">
      <div class="startup-update">
        <p class="startup-update-notes">{{ downloadError }}</p>
        <div class="startup-update-actions">
          <button class="startup-update-button" @click="downloadError = null">关闭</button>
        </div>
      </div>
    </AppDialog>

    <div v-if="downloading" class="update-download-pill">
      <i class="fas fa-download"></i>
      <span>正在后台下载更新 {{ downloading.percent }}%（{{ formatBytes(downloading.downloaded) }} / {{ formatBytes(downloading.total) }}）</span>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { listen } from '@tauri-apps/api/event';
import AppShell from './components/layout/AppShell.vue';
import PublishDialog from './components/overlays/PublishDialog.vue';
import ImageViewer from './components/overlays/ImageViewer.vue';
import SearchCommand from './components/overlays/SearchCommand.vue';
import LoginModal from './components/overlays/LoginModal.vue';
import AppConfirmHost from './components/common/AppConfirmHost.vue';
import BackToTop from './components/common/BackToTop.vue';
import AppContextMenu from './components/common/AppContextMenu.vue';
import AppDialog from './components/common/AppDialog.vue';
import { useAuthStore } from './stores/auth';
import { useSettingsStore } from './stores/settings';
import { APP_VERSION, checkLatestRelease, isNewerVersion, normalizeVersion, type UpdateInfo } from './utils/updateChecker';
import { renderReleaseMarkdown } from './utils/markdown';
import { handleAnchorClick } from './utils/anchorClick';
import { desktopNotify } from './utils/desktopNotify';
import { registerGlobalHotkeys } from './utils/hotkeys';
import { CoolapkTauriAPI } from './api/coolapk';
import { clearResourceCache } from './utils/resourceCache';
import { useSidebarTransition } from './utils/routeTransition';
import { registerGlobalSelectionClear } from './utils/selection';
import { getPlatformInfo } from './utils/platform';

const { isSidebarTransitionActive, resetSidebarTransition } = useSidebarTransition();

const PENDING_UPDATE_KEY = 'coolapk_pending_update';

type ReadyInfo = { version: string; path: string };
type DownloadNotice = { version: string; releaseNotes?: string };

type DownloadProgress = { downloaded: number; total: number; percent: number };

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const updateInfo = ref<UpdateInfo | null>(null);
const downloadNotice = ref<DownloadNotice | null>(null);
const readyInfo = ref<ReadyInfo | null>(null);
const downloading = ref<DownloadProgress | null>(null);
const downloadError = ref<string | null>(null);
const installingUpdate = ref(false);
const isWindows = ref(false);
let unregisterHotkeys: (() => void) | null = null;
let unregisterSelectionClear: (() => void) | null = null;
let updateDownloadInFlight = false;

function formatBytes(bytes: number) {
  if (!bytes) return '0 MB';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

async function checkForUpdate(manual = false) {
  try {
    isWindows.value = (await getPlatformInfo()).os === 'windows';
    const result = await checkLatestRelease(settingsStore.settings.updateChannel);
    const latestVersion = normalizeVersion(result.latestVersion || '') || '';
    const ignoredVersion = normalizeVersion(settingsStore.settings.ignoredUpdateVersion) || '';

    // 如果待安装包不是远端最新版本，且新版本有可用安装包，则切换到新版本。
    // 忽略更新、没有安装包或手动检查失败时保留原待安装包，避免用户已下载的更新无故丢失。
    const shouldReplacePending =
      !manual &&
      Boolean(readyInfo.value) &&
      result.hasNew &&
      Boolean(result.installerUrl) &&
      isWindows.value &&
      Boolean(latestVersion) &&
      isNewerVersion(latestVersion, readyInfo.value?.version || '') &&
      !settingsStore.settings.ignoreAllUpdates &&
      latestVersion !== ignoredVersion;
    if (shouldReplacePending) {
      localStorage.removeItem(PENDING_UPDATE_KEY);
      readyInfo.value = null;
      try {
        await CoolapkTauriAPI.cleanupUpdatePackages();
      } catch (cleanupError) {
        console.warn('切换最新更新包时清理旧包失败:', cleanupError);
      }
    }
    // 当前待安装包已经是最新可用包时，不重复下载，也不弹出重复提示。
    if (!manual && readyInfo.value) return;

    if (result.hasNew && !manual) {
      if (settingsStore.settings.ignoreAllUpdates) return;
      if (latestVersion && latestVersion === ignoredVersion) return;
      // 自动检查：有可用安装包时静默后台下载，完成后弹窗询问是否立即更新
      if (result.installerUrl && isWindows.value) {
        void startBackgroundDownload(result);
        return;
      }
    }
    if (manual || result.hasNew) updateInfo.value = result;
  } catch {
    if (!manual) return;
    updateInfo.value = {
      hasNew: false,
      releaseNotes: '检查更新失败，请检查网络连接后重试。',
      downloadUrl: 'https://github.com/daimiaopeng/coolapk-desktop/releases',
    };
  }
}

async function startBackgroundDownload(info: UpdateInfo) {
  const url = info.installerUrl;
  // 自动检查、手动检查和按钮点击可能在同一时间触发；同一应用只允许一个下载任务，
  // 否则多个任务会同时写同一个安装包并让进度事件互相覆盖。
  if (!url || updateDownloadInFlight || downloading.value || readyInfo.value) return;
  updateDownloadInFlight = true;
  updateInfo.value = null;
  downloadError.value = null;
  downloadNotice.value = {
    version: info.latestVersion || '新版本',
    releaseNotes: info.releaseNotes || '',
  };
  downloading.value = { downloaded: 0, total: 0, percent: 0 };
  let unlisten: (() => void) | null = null;
  let lastDownloaded = 0;
  try {
    unlisten = await listen<{ downloaded: number; total: number }>('update-download-progress', (event) => {
      const { downloaded, total } = event.payload;
      // 丢弃异常的倒退事件，避免进度条因旧任务或事件乱序反复跳动。
      if (downloaded < lastDownloaded) return;
      lastDownloaded = downloaded;
      downloading.value = {
        downloaded,
        total,
        percent: total ? Math.min(100, Math.round((downloaded / total) * 100)) : 0,
      };
    });
    const path = await CoolapkTauriAPI.downloadUpdate(url, {
      speedLimitKbps: settingsStore.settings.updateSpeedLimitKBps,
      proxyUrl: settingsStore.settings.proxyUrl,
    });
    const downloadedVersion = normalizeVersion(info.latestVersion || '') || info.latestVersion || '';
    try {
      await CoolapkTauriAPI.cleanupUpdatePackages(path);
    } catch (cleanupError) {
      console.warn('清理旧更新包失败，不影响当前安装包使用:', cleanupError);
    }
    downloading.value = null;
    downloadNotice.value = null;
    readyInfo.value = { version: downloadedVersion, path };
    localStorage.setItem(PENDING_UPDATE_KEY, JSON.stringify(readyInfo.value));
    if (settingsStore.settings.desktopNotifications && settingsStore.settings.notifyDownloadComplete) {
      void desktopNotify(
        {
          title: '更新包下载完成',
          body: `酷安桌面版 ${info.latestVersion || ''} 更新包已下载完成，点击“立即更新”即可安装。`,
        },
        settingsStore.settings.notificationSound
      );
    }
  } catch (err) {
    downloading.value = null;
    downloadNotice.value = null;
    downloadError.value = `更新包下载失败，请检查网络连接后重试。(${String(err)})`;
  } finally {
    if (unlisten) await unlisten();
    updateDownloadInFlight = false;
  }
}

function installNow() {
  const info = readyInfo.value;
  if (!info || installingUpdate.value) return;
  // 安装前再次校验：本地已不低于该版本时放弃安装旧包（防降级）
  if (info.version && !isNewerVersion(info.version)) {
    localStorage.removeItem(PENDING_UPDATE_KEY);
    readyInfo.value = null;
    void CoolapkTauriAPI.cleanupUpdatePackages().catch(() => undefined);
    return;
  }
  installingUpdate.value = true;
  void (async () => {
    try {
      await CoolapkTauriAPI.installUpdate(info.path);
      // 保留待安装记录到下次启动：安装程序可能启动后失败或被取消，
      // 下次启动可校验版本和文件是否仍存在，再决定重试或重新下载。
      await settingsStore.flushSettings();
      await CoolapkTauriAPI.quitApp();
    } catch (err) {
      installingUpdate.value = false;
      downloadError.value = `启动安装程序失败：${String(err)}`;
    }
  })();
}

function ignoreThisVersion() {
  const version = updateInfo.value?.latestVersion;
  if (version) settingsStore.ignoreUpdateVersion(version);
  updateInfo.value = null;
}

function ignoreAllUpdates() {
  settingsStore.setIgnoreAllUpdates(true);
  updateInfo.value = null;
}

function openUpdate() {
  const url = updateInfo.value?.downloadUrl;
  if (url) void CoolapkTauriAPI.openUrl(url, 'system');
  updateInfo.value = null;
}

function openReleasePage() {
  const url = updateInfo.value?.downloadUrl || 'https://github.com/daimiaopeng/coolapk-desktop/releases';
  void CoolapkTauriAPI.openUrl(url, 'system');
}

async function restorePendingUpdate(): Promise<boolean> {
  const clearInvalidPending = async () => {
    localStorage.removeItem(PENDING_UPDATE_KEY);
    readyInfo.value = null;
    try {
      await CoolapkTauriAPI.cleanupUpdatePackages();
    } catch (cleanupError) {
      console.warn('清理失效更新包失败:', cleanupError);
    }
  };

  try {
    const pendingRaw = localStorage.getItem(PENDING_UPDATE_KEY);
    if (!pendingRaw) {
      await CoolapkTauriAPI.cleanupUpdatePackages();
      return false;
    }
    const pending = JSON.parse(pendingRaw) as Partial<ReadyInfo>;
    const version = normalizeVersion(String(pending?.version || ''));
    const path = typeof pending?.path === 'string' ? pending.path.trim() : '';
    if (!version || !path || !isNewerVersion(version)) {
      await clearInvalidPending();
      return false;
    }

    const available = await CoolapkTauriAPI.isUpdatePackageAvailable(path);
    if (!available) {
      await clearInvalidPending();
      return false;
    }

    readyInfo.value = { version, path };
    try {
      await CoolapkTauriAPI.cleanupUpdatePackages(path);
    } catch (cleanupError) {
      console.warn('清理旧更新包失败，不影响待安装包使用:', cleanupError);
    }
    return true;
  } catch (error) {
    console.warn('恢复待安装更新失败:', error);
    await clearInvalidPending();
    return false;
  }
}

onMounted(() => {
  authStore.initAuth();
  window.addEventListener('resize', settingsStore.refreshAutoZoom);
  unregisterHotkeys = registerGlobalHotkeys();
  unregisterSelectionClear = registerGlobalSelectionClear();

  // 本地调试（vite dev）跳过自动更新检查，避免误弹更新提示或静默下载安装包；
  // 设置页的"立即检查更新"手动触发不受影响
  void (async () => {
    isWindows.value = (await getPlatformInfo()).os === 'windows';
    await restorePendingUpdate();
    if (!import.meta.env.DEV && settingsStore.settings.checkUpdateOnStartup) {
      void checkForUpdate();
    }
  })();
  window.addEventListener('check-for-update', () => void checkForUpdate(true));

  // 启动时先清理过期图片，再按总占用阈值决定是否清理全部缓存。
  if (settingsStore.settings.autoCleanCache) {
    void (async () => {
      try {
        await CoolapkTauriAPI.cleanExpiredCache(
          settingsStore.settings.cachePath,
          settingsStore.settings.cacheTtlDays
        );
        const info = await CoolapkTauriAPI.getCacheInfo(settingsStore.settings.cachePath);
        const threshold = (settingsStore.settings.cacheThresholdMB || 500) * 1024 * 1024;
        // 更新安装包有独立的待安装生命周期，不应因为安装包体积触发普通缓存清理。
        const ordinaryCacheBytes = Math.max(0, Number(info?.bytes || 0) - Number(info?.updateBytes || 0));
        if (ordinaryCacheBytes > threshold) {
          await clearResourceCache();
          await CoolapkTauriAPI.clearAppCache(settingsStore.settings.cachePath);
        }
      } catch {
        // 自动清理失败不影响启动
      }
    })();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', settingsStore.refreshAutoZoom);
  unregisterHotkeys?.();
  unregisterSelectionClear?.();
});
</script>

<style>
/* 全局辅助无边框无滚动 */
html, body {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#app {
  margin: 0;
  padding: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.startup-update-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.update-header-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-app-title {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.update-version-tag {
  font-size: 12px;
  font-weight: 700;
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, 0.12));
  padding: 2px 8px;
  border-radius: 999px;
  letter-spacing: 0.02em;
}

.startup-update-date {
  font-size: 12px;
  color: var(--text-tertiary, #888);
  display: flex;
  align-items: center;
  gap: 5px;
}

.startup-update-date i {
  font-size: 11px;
}

.startup-update-notes-block {
  display: flex;
  flex-direction: column;
  background: var(--background-secondary, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  border-radius: 8px;
  padding: 12px 14px;
}

.startup-update-notes-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.startup-update-notes-label {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 13px;
}

.startup-update-notes {
  margin: 0;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 13px;
  word-break: break-word;
}

.startup-update-notes :deep(h4),
.startup-update-notes :deep(h5),
.startup-update-notes :deep(h6) {
  color: var(--text-primary);
  margin: 8px 0 4px;
  font-weight: 600;
  line-height: 1.4;
}

.startup-update-notes :deep(h4) {
  font-size: 14px;
}

.startup-update-notes :deep(h5) {
  font-size: 13px;
}

.startup-update-notes :deep(h6) {
  font-size: 12.5px;
}

.startup-update-notes :deep(p) {
  margin: 3px 0;
}

.startup-update-notes :deep(ul),
.startup-update-notes :deep(ol) {
  margin: 3px 0;
  padding-left: 18px;
}

.startup-update-notes :deep(li) {
  margin: 2px 0;
}

.startup-update-notes :deep(blockquote) {
  margin: 6px 0;
  padding: 4px 10px;
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  border-left: 3px solid var(--brand-green, #10b981);
  border-radius: 4px;
  color: var(--text-secondary);
}

.startup-update-notes :deep(hr) {
  border: none;
  border-top: 1px solid var(--border, rgba(0, 0, 0, 0.08));
  margin: 8px 0;
}

.startup-update-notes :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg-hover, rgba(0, 0, 0, 0.06));
  font-family: monospace;
  font-size: 12px;
}

.startup-update-notes :deep(pre) {
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bg-hover, rgba(0, 0, 0, 0.06));
  overflow-x: auto;
  margin: 6px 0;
}

.startup-update-notes :deep(a) {
  color: var(--brand-green, #10b981);
  text-decoration: none;
  word-break: break-all;
}

.startup-update-notes :deep(a:hover) {
  text-decoration: underline;
}

.startup-update-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding-top: 4px;
}

.update-actions-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.update-actions-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-text {
  background: transparent;
  border: none;
  padding: 4px 6px;
  color: var(--text-tertiary, #888);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.18s ease;
}

.btn-text:hover {
  color: var(--text-primary);
  background: var(--bg-hover, rgba(0, 0, 0, 0.05));
}

.startup-update-later,
.startup-update-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.startup-update-later {
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border);
}

.startup-update-later:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  color: var(--text-primary);
}

.startup-update-button {
  color: white;
  background: var(--brand-green, #10b981);
  border: 1px solid var(--brand-green, #10b981);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.28);
}

.startup-update-button:hover {
  background: #059669;
  border-color: #059669;
  transform: translateY(-1px);
}

.update-download-pill {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(20, 22, 26, 0.92);
  color: #fff;
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

.update-download-pill i {
  color: var(--brand-green, #10b981);
}
</style>
