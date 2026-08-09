<template>
  <AppShell>
    <router-view v-slot="{ Component, route }">
      <!--
        桌面端通过路由切换维护页面栈。缓存所有路由页面，进入详情页时不销毁下面的页面，
        从而保留已加载数据、滚动位置、筛选条件、草稿和其他局部状态。
        大多数页面使用包含参数和查询条件的完整路径作为缓存标识，让不同详情拥有独立实例。
        私信页的 uid 只表示当前会话，不能据此重建整页，否则每次点会话都会重新加载列表。
      -->
      <keep-alive>
        <component :is="Component" :key="route.name === 'Messages' ? route.path : route.fullPath" />
      </keep-alive>
    </router-view>

    <!-- 全局交互浮层 -->
    <PublishDialog />
    <ImageViewer />
    <SearchCommand />
    <LoginModal />
    <AppConfirmHost />
    <BackToTop />

    <AppDialog :is-open="Boolean(updateInfo)" :title="updateInfo?.hasNew ? '发现新版本' : '检查更新'" :width="460" @close="updateInfo = null">
      <div v-if="updateInfo" class="startup-update">
        <p class="startup-update-version">
          {{ updateInfo.hasNew ? `酷安桌面版 ${updateInfo.latestVersion}` : '当前已是最新版本' }}
        </p>
        <p class="startup-update-notes" v-if="updateInfo.hasNew"><span class="startup-update-notes-label">更新内容：</span>{{ updateInfo.releaseNotes }}</p>
        <p class="startup-update-notes" v-else>{{ updateInfo.releaseNotes }}</p>
        <div class="startup-update-actions">
          <button v-if="!updateInfo.hasNew" class="startup-update-later" @click="updateInfo = null">关闭</button>
          <button v-if="updateInfo.hasNew" class="startup-update-later" @click="ignoreThisVersion">忽略此版本</button>
          <button v-if="updateInfo.hasNew" class="startup-update-later" @click="ignoreAllUpdates">忽略所有更新</button>
          <button v-if="updateInfo.hasNew && updateInfo.installerUrl && isWindows" class="startup-update-button" @click="startBackgroundDownload(updateInfo)">后台下载更新</button>
          <button v-if="updateInfo.hasNew" class="startup-update-later" @click="openUpdate">前往下载更新</button>
        </div>
      </div>
    </AppDialog>

    <AppDialog :is-open="Boolean(readyInfo)" title="更新包已下载" :width="460" @close="readyInfo = null">
      <div v-if="readyInfo" class="startup-update">
        <p class="startup-update-version">酷安桌面版 {{ readyInfo.version }} 更新包已下载完成</p>
        <p class="startup-update-notes">是否立即更新？更新将关闭当前窗口，全自动完成安装后重新打开软件。</p>
        <div class="startup-update-actions">
          <button class="startup-update-later" @click="readyInfo = null">稍后再说</button>
          <button class="startup-update-button" @click="installNow">立即更新</button>
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
import AppDialog from './components/common/AppDialog.vue';
import { useAuthStore } from './stores/auth';
import { useSettingsStore } from './stores/settings';
import { checkLatestRelease, isNewerVersion, type UpdateInfo } from './utils/updateChecker';
import { desktopNotify } from './utils/desktopNotify';
import { registerGlobalHotkeys } from './utils/hotkeys';
import { CoolapkTauriAPI } from './api/coolapk';
import { clearResourceCache } from './utils/resourceCache';

const PENDING_UPDATE_KEY = 'coolapk_pending_update';

type ReadyInfo = { version: string; path: string };

type DownloadProgress = { downloaded: number; total: number; percent: number };

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const updateInfo = ref<UpdateInfo | null>(null);
const readyInfo = ref<ReadyInfo | null>(null);
const downloading = ref<DownloadProgress | null>(null);
const downloadError = ref<string | null>(null);
const isWindows = navigator.userAgent.includes('Windows');
let unregisterHotkeys: (() => void) | null = null;

function formatBytes(bytes: number) {
  if (!bytes) return '0 MB';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

async function checkForUpdate(manual = false) {
  try {
    const result = await checkLatestRelease(settingsStore.settings.updateChannel);
    if (result.hasNew && !manual) {
      if (settingsStore.settings.ignoreAllUpdates) return;
      if (result.latestVersion && result.latestVersion === settingsStore.settings.ignoredUpdateVersion) return;
      // 自动检查：有可用安装包时静默后台下载，完成后弹窗询问是否立即更新
      if (result.installerUrl && isWindows) {
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
  if (!url) return;
  updateInfo.value = null;
  downloading.value = { downloaded: 0, total: 0, percent: 0 };
  const unlisten = await listen<{ downloaded: number; total: number }>('update-download-progress', (event) => {
    const { downloaded, total } = event.payload;
    downloading.value = {
      downloaded,
      total,
      percent: total ? Math.round((downloaded / total) * 100) : 0,
    };
  });
  try {
    const path = await CoolapkTauriAPI.downloadUpdate(url, {
      speedLimitKbps: settingsStore.settings.updateSpeedLimitKBps,
      proxyUrl: settingsStore.settings.proxyUrl,
    });
    await unlisten();
    downloading.value = null;
    readyInfo.value = { version: info.latestVersion || '', path };
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
    await unlisten();
    downloading.value = null;
    downloadError.value = `更新包下载失败，请检查网络连接后重试。(${String(err)})`;
  }
}

function installNow() {
  const info = readyInfo.value;
  if (!info) return;
  // 安装前再次校验：本地已不低于该版本时放弃安装旧包（防降级）
  if (info.version && !isNewerVersion(info.version)) {
    localStorage.removeItem(PENDING_UPDATE_KEY);
    readyInfo.value = null;
    return;
  }
  localStorage.removeItem(PENDING_UPDATE_KEY);
  readyInfo.value = null;
  void (async () => {
    try {
      await CoolapkTauriAPI.installUpdate(info.path);
      await CoolapkTauriAPI.quitApp();
    } catch (err) {
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

onMounted(() => {
  authStore.initAuth();
  window.addEventListener('resize', settingsStore.refreshAutoZoom);
  unregisterHotkeys = registerGlobalHotkeys();

  // 上次已下载但未安装的更新包：启动时再次询问（仅当更新包版本确实高于当前版本，
  // 防止本地已更新到更高版本后仍提示安装旧包导致降级）
  try {
    const pendingRaw = localStorage.getItem(PENDING_UPDATE_KEY);
    if (pendingRaw) {
      const pending = JSON.parse(pendingRaw);
      if (pending && pending.version && pending.path && isNewerVersion(pending.version)) {
        readyInfo.value = pending;
      } else {
        localStorage.removeItem(PENDING_UPDATE_KEY);
      }
    }
  } catch {
    localStorage.removeItem(PENDING_UPDATE_KEY);
  }

  // 本地调试（vite dev）跳过自动更新检查，避免误弹更新提示或静默下载安装包；
  // 设置页的"立即检查更新"手动触发不受影响
  if (!import.meta.env.DEV && settingsStore.settings.checkUpdateOnStartup && !readyInfo.value) {
    void checkForUpdate();
  }
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
        if (Number(info?.bytes) > threshold) {
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

.startup-update-version {
  margin: 0 0 12px;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
}

.startup-update-notes {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.startup-update-notes-label {
  color: var(--text-primary);
  font-weight: 600;
}

.startup-update-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.startup-update-later,
.startup-update-button {
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.startup-update-later {
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border);
}

.startup-update-button {
  color: white;
  background: var(--brand-green, #10b981);
  border: 1px solid var(--brand-green, #10b981);
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
