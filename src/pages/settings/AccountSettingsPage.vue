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

    <div class="account-management">
      <div class="account-management-header">
        <div>
          <h4 class="account-management-title">本地账户</h4>
          <p class="account-management-desc">切换会先验证凭据；退出登录不会删除这里的账户。</p>
        </div>
        <AppButton variant="secondary" size="sm" @click="authStore.openLoginModal()">添加账户</AppButton>
      </div>
      <div v-if="authStore.accounts.length" class="account-list">
        <div v-for="account in authStore.accounts" :key="account.uid" class="account-item">
          <AppAvatar :src="account.userAvatar" size="sm" />
          <div class="account-info">
            <div class="account-name-row">
              <span class="account-name">{{ account.username || `酷友_${String(account.uid).slice(-4)}` }}</span>
              <span v-if="isCurrentAccount(account.uid)" class="current-badge">当前</span>
            </div>
            <span class="account-uid">UID: {{ account.uid }}</span>
          </div>
          <div class="account-actions">
            <AppButton variant="secondary" size="sm" :disabled="isCurrentAccount(account.uid)" :loading="switchingUid === String(account.uid)" @click="handleSwitchAccount(account)">
              {{ isCurrentAccount(account.uid) ? '已登录' : '切换' }}
            </AppButton>
            <AppButton variant="danger" size="sm" :loading="removingUid === String(account.uid)" @click="handleRemoveAccount(account)">删除</AppButton>
          </div>
        </div>
      </div>
      <div v-else class="empty-accounts">暂无保存的账户，登录成功后会保存在这里。</div>
      <p v-if="accountError" class="account-error">{{ accountError }}</p>
    </div>

    <AppDialog :is-open="cookieDialogOpen" title="Cookie 凭据管理" :width="480" @close="cookieDialogOpen = false">
      <div class="cookie-panel">
          <div v-if="cookieLoading" class="cookie-tip">
            <i class="fas fa-circle-notch fa-spin"></i> 正在读取本地凭据...
          </div>
          <div v-else-if="cookieError" class="cookie-tip account-error">{{ cookieError }}</div>
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

    <AppConfirmDialog
      :is-open="Boolean(pendingRemovalAccount)"
      title="删除本地账户"
      :message="`确定删除本地账户“${pendingRemovalAccountName}”吗？该操作不会注销酷安账号。`"
      confirm-text="删除"
      danger
      :loading="Boolean(removingUid)"
      @cancel="cancelRemoveAccount"
      @confirm="confirmRemoveAccount"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import AppButton from '../../components/common/AppButton.vue';
import AppDialog from '../../components/common/AppDialog.vue';
import AppConfirmDialog from '../../components/common/AppConfirmDialog.vue';
import AppAvatar from '../../components/common/AppAvatar.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { getErrorMessage } from '../../utils/errors';

const authStore = useAuthStore();

const cookieDialogOpen = ref(false);
const cookieLoading = ref(false);
const cookieText = ref('');
const cookieError = ref('');
const switchingUid = ref('');
const removingUid = ref('');
const accountError = ref('');
const pendingRemovalAccount = ref<any | null>(null);

const pendingRemovalAccountName = computed(() => {
  const account = pendingRemovalAccount.value;
  return account?.username || (account?.uid ? `UID ${account.uid}` : '');
});

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
  cookieError.value = '';
  try {
    const cookie = await CoolapkTauriAPI.getUserCookie();
    cookieText.value = cookie || '';
  } catch (error) {
    cookieText.value = '';
    cookieError.value = `读取 Cookie 凭据失败：${getErrorMessage(error, '未知错误')}`;
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

async function handleLogout() {
  await authStore.logout();
  cookieDialogOpen.value = false;
}

function isCurrentAccount(uid: string | number) {
  return authStore.isLoggedIn && String(authStore.user?.uid || '') === String(uid);
}

async function handleSwitchAccount(account: any) {
  if (switchingUid.value) return;
  switchingUid.value = String(account.uid);
  accountError.value = '';
  try {
    await authStore.loginAs(String(account.uid));
  } catch (error: any) {
    accountError.value = error?.message || '账户切换失败，请重新登录该账户。';
  } finally {
    switchingUid.value = '';
  }
}

function handleRemoveAccount(account: any) {
  if (removingUid.value || switchingUid.value) return;
  pendingRemovalAccount.value = account;
}

function cancelRemoveAccount() {
  if (!removingUid.value) pendingRemovalAccount.value = null;
}

async function confirmRemoveAccount() {
  const account = pendingRemovalAccount.value;
  if (!account || removingUid.value || switchingUid.value) return;
  const name = account.username || `UID ${account.uid}`;
  removingUid.value = String(account.uid);
  accountError.value = '';
  try {
    await authStore.removeAccount(String(account.uid));
    pendingRemovalAccount.value = null;
  } catch (error: any) {
    accountError.value = (typeof error === 'string' ? error : error?.message) || '删除账户失败，请稍后重试。';
  } finally {
    removingUid.value = '';
  }
}

onMounted(() => {
  authStore.loadAccounts();
});
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

.account-management {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.account-management-header,
.account-item,
.account-name-row,
.account-actions {
  display: flex;
  align-items: center;
}

.account-management-header { justify-content: space-between; gap: var(--space-4); }
.account-management-title { margin: 0; font-size: var(--font-size-title-sm); color: var(--text-primary); }
.account-management-desc,
.account-uid,
.empty-accounts { margin: 4px 0 0; font-size: var(--font-size-sub); color: var(--text-secondary); }
.account-list { display: flex; flex-direction: column; border-top: 1px solid var(--border-light); }
.account-item { gap: var(--space-3); padding: var(--space-3) 0; border-bottom: 1px solid var(--border-light); }
.account-info { min-width: 0; flex: 1; }
.account-name-row { gap: var(--space-2); }
.account-name { overflow: hidden; color: var(--text-primary); font-weight: var(--font-weight-medium); text-overflow: ellipsis; white-space: nowrap; }
.current-badge { padding: 1px 6px; border-radius: var(--radius-pill); background: var(--brand-soft); color: var(--brand-primary); font-size: var(--font-size-caption); }
.account-actions { gap: var(--space-2); }
.account-error { margin: 0; color: var(--danger); font-size: var(--font-size-sub); }

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
