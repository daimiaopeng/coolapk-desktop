<template>
  <div class="settings-section">
    <h3 class="section-title">账号与安全</h3>
    <div class="setting-group">
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">登录状态</span>
          <span class="row-sub">{{ authStore.isLoggedIn ? `已登录为 ${authStore.user?.username}` : '未登录' }}</span>
        </div>
        <AppButton v-if="!authStore.isLoggedIn" variant="primary" size="sm" @click="authStore.openLoginModal()">账号登录</AppButton>
        <AppButton v-else variant="danger" size="sm" @click="handleLogout">退出登录</AppButton>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">Cookie 凭据管理</span>
          <span class="row-sub">查看本地保存的登录凭据（脱敏）、复制或清除</span>
        </div>
        <AppButton variant="secondary" size="sm" @click="openCookieDialog">管理凭据 Cookie</AppButton>
      </div>
    </div>

    <AppDialog :is-open="cookieDialogOpen" title="Cookie 凭据管理" :width="480" @close="cookieDialogOpen = false">
      <div class="cookie-panel">
        <div v-if="cookieLoading" class="cookie-tip">
          <i class="fas fa-circle-notch fa-spin"></i> 正在读取本地凭据...
        </div>
        <template v-else>
          <div v-if="cookieText" class="cookie-box">
            <p class="cookie-label">当前凭据（已脱敏，仅显示开头与结尾）：</p>
            <code class="cookie-masked">{{ cookieMasked }}</code>
            <div class="cookie-actions">
              <AppButton variant="secondary" size="sm" @click="copyCookie">复制完整凭据</AppButton>
              <AppButton variant="danger" size="sm" @click="handleLogout">清除凭据并退出</AppButton>
            </div>
            <p class="cookie-tip-text">
              <i class="fas fa-shield-alt"></i>
              完整凭据仅在你点击“复制”时展示到剪贴板，请勿泄露给他人。
            </p>
          </div>
          <div v-else class="cookie-tip">本地暂无 Cookie 凭据，请先登录账号。</div>
        </template>
      </div>
      <template #footer>
        <AppButton variant="ghost" @click="cookieDialogOpen = false">关闭</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import AppButton from '../../components/common/AppButton.vue';
import AppDialog from '../../components/common/AppDialog.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';

const authStore = useAuthStore();

const cookieDialogOpen = ref(false);
const cookieLoading = ref(false);
const cookieText = ref('');

const cookieMasked = computed(() => {
  const raw = cookieText.value;
  if (!raw) return '（空）';
  if (raw.length <= 12) return '***';
  return `${raw.slice(0, 6)}***${raw.slice(-6)}`;
});

async function openCookieDialog() {
  cookieDialogOpen.value = true;
  cookieLoading.value = true;
  cookieText.value = '';
  try {
    const cookie = await CoolapkTauriAPI.getUserCookie();
    cookieText.value = cookie || '';
  } catch {
    cookieText.value = '';
  } finally {
    cookieLoading.value = false;
  }
}

async function copyCookie() {
  if (!cookieText.value) return;
  try {
    await navigator.clipboard.writeText(cookieText.value);
    alert('完整凭据已复制到剪贴板');
  } catch {
    // 部分环境剪贴板受限时回退为选中文本
    alert('复制失败，请手动复制');
  }
}

function handleLogout() {
  authStore.logout();
  cookieDialogOpen.value = false;
}
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
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

.cookie-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cookie-tip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
}

.cookie-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cookie-label {
  margin: 0;
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.cookie-masked {
  display: block;
  padding: var(--space-3);
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-all;
  user-select: all;
}

.cookie-actions {
  display: flex;
  gap: var(--space-3);
}

.cookie-tip-text {
  margin: 0;
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
