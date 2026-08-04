<template>
  <AppShell>
    <router-view v-slot="{ Component, route }">
      <keep-alive include="HomePage">
        <component :is="Component" :key="route.fullPath" />
      </keep-alive>
    </router-view>

    <!-- 全局交互浮层 -->
    <CommentDrawer />
    <PublishDialog />
    <ImageViewer />
    <SearchCommand />
    <LoginModal />

    <AppDialog :is-open="Boolean(updateInfo)" title="发现新版本" :width="460" @close="updateInfo = null">
      <div v-if="updateInfo" class="startup-update">
        <p class="startup-update-version">酷安桌面版 {{ updateInfo.latestVersion }}</p>
        <p class="startup-update-notes">{{ updateInfo.releaseNotes }}</p>
        <div class="startup-update-actions">
          <button class="startup-update-later" @click="updateInfo = null">稍后提醒</button>
          <button class="startup-update-button" @click="openUpdate">前往下载更新</button>
        </div>
      </div>
    </AppDialog>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import AppShell from './components/layout/AppShell.vue';
import CommentDrawer from './components/comments/CommentDrawer.vue';
import PublishDialog from './components/overlays/PublishDialog.vue';
import ImageViewer from './components/overlays/ImageViewer.vue';
import SearchCommand from './components/overlays/SearchCommand.vue';
import LoginModal from './components/overlays/LoginModal.vue';
import AppDialog from './components/common/AppDialog.vue';
import { useAuthStore } from './stores/auth';
import { checkLatestRelease, type UpdateInfo } from './utils/updateChecker';
import { CoolapkTauriAPI } from './api/coolapk';

const authStore = useAuthStore();
const updateInfo = ref<UpdateInfo | null>(null);

async function checkForUpdate() {
  try {
    const result = await checkLatestRelease();
    if (result.hasNew) updateInfo.value = result;
  } catch {
    // 启动时检测失败不打断主界面，用户仍可在设置页手动重试。
  }
}

function openUpdate() {
  const url = updateInfo.value?.downloadUrl;
  if (url) void CoolapkTauriAPI.openUrl(url);
  updateInfo.value = null;
}

onMounted(() => {
  authStore.initAuth();
  void checkForUpdate();
  window.addEventListener('check-for-update', checkForUpdate);
});

onUnmounted(() => window.removeEventListener('check-for-update', checkForUpdate));
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

.startup-update-actions {
  display: flex;
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
</style>
