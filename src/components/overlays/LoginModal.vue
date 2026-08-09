<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="authStore.isLoginModalOpen" class="login-overlay" @click.self="handleClose">
        <div class="login-dialog" role="dialog" aria-modal="true">
          <!-- 弹窗头部 -->
          <div class="login-header">
            <div class="header-brand">
              <img src="../../assets/coolapk-logo-rounded.png" alt="Coolapk" class="brand-logo" />
              <div class="header-titles">
                <h3 class="dialog-title">酷安账号登录</h3>
                <span class="dialog-sub">登录后同步发帖、发表评论、发私信与点赞等权益</span>
              </div>
            </div>
            <button class="close-btn" title="关闭" @click="handleClose">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- 已登录状态下展示账号信息 -->
          <div v-if="authStore.isLoggedIn && !isRebinding" class="logged-in-view">
            <div class="user-card">
              <AppAvatar :src="authStore.user?.userAvatar" size="lg" />
              <div class="user-details">
                <div class="name-row">
                  <span class="username">{{ authStore.user?.username }}</span>
                  <span v-if="authStore.user?.level" class="level-badge">Lv.{{ authStore.user?.level }}</span>
                </div>
                <span class="uid-text">UID: {{ authStore.user?.uid }}</span>
                <p v-if="authStore.user?.bio" class="user-bio">{{ authStore.user?.bio }}</p>
              </div>
            </div>

            <!-- 已保存的其他账户：快速切换 -->
            <div v-if="otherAccounts.length > 0" class="account-switch-section">
              <span class="section-label">切换账号</span>
              <div class="account-switch-list">
                <div
                  v-for="acc in otherAccounts"
                  :key="acc.uid"
                  class="account-switch-item"
                  @click="handleSwitchAccount(acc)"
                >
                  <AppAvatar :src="acc.userAvatar" size="sm" />
                  <div class="switch-item-info">
                    <span class="switch-item-name">{{ acc.username || `酷友_${String(acc.uid).slice(-4)}` }}</span>
                    <span class="switch-item-uid">UID: {{ acc.uid }}</span>
                  </div>
                  <i class="fas fa-right-left switch-icon"></i>
                </div>
              </div>
            </div>

            <div class="logged-actions">
              <AppButton variant="secondary" icon="fas fa-user-gear" @click="isRebinding = true">
                新增/重新登录账号
              </AppButton>
              <AppButton variant="danger" icon="fas fa-right-from-bracket" @click="handleLogout">
                退出登录
              </AppButton>
            </div>
          </div>

          <!-- 未登录或重新绑定凭据流程 -->
          <div v-else class="login-body">
            <div v-if="!authStore.isLoggedIn && authStore.accounts.length > 0" class="account-switch-section saved-account-section">
              <span class="section-label">已保存账户</span>
              <div class="account-switch-list">
                <div
                  v-for="acc in authStore.accounts"
                  :key="acc.uid"
                  :class="['account-switch-item', { 'is-expired': expiredUid === String(acc.uid) }]"
                >
                  <AppAvatar :src="acc.userAvatar" size="sm" />
                  <div class="switch-item-info">
                    <span class="switch-item-name">{{ acc.username || `酷友_${String(acc.uid).slice(-4)}` }}</span>
                    <span class="switch-item-uid">UID: {{ acc.uid }}</span>
                    <span v-if="expiredUid === String(acc.uid)" class="expired-label">凭据已过期</span>
                  </div>
                  <div class="saved-account-actions">
                    <button
                      class="saved-account-login"
                      :disabled="Boolean(switchingUid || removingUid)"
                      @click="expiredUid === String(acc.uid) ? handleReauthorizeAccount(acc) : handleSwitchAccount(acc)"
                    >
                      <i v-if="switchingUid === String(acc.uid)" class="fas fa-circle-notch fa-spin"></i>
                      <span v-else>{{ expiredUid === String(acc.uid) ? '重新授权' : '登录' }}</span>
                    </button>
                    <button
                      class="saved-account-remove"
                      :disabled="Boolean(switchingUid || removingUid)"
                      title="删除本地账户"
                      @click="handleRemoveSavedAccount(acc)"
                    >
                      <i :class="removingUid === String(acc.uid) ? 'fas fa-circle-notch fa-spin' : 'fas fa-trash-can'"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 官方直连授权核心主视觉卡片 -->
            <div class="official-login-card">
              <div class="card-hero-icon">
                <img src="../../assets/coolapk-logo-rounded.png" alt="Coolapk" class="hero-logo" />
              </div>
              <h4 class="hero-title">酷安官方授权登录</h4>
              <p class="hero-desc">调起酷安官方授权窗口，支持扫码验证与手机极验，登录完成自动同步会话</p>
              
              <AppButton 
                variant="primary" 
                size="lg" 
                icon="fas fa-arrow-up-right-from-square" 
                class="btn-hero-login"
                @click="handleOpenWebAuth"
              >
                调起官方授权登录
              </AppButton>
              
              <button class="btn-hero-sync" @click="handleCheckWebLogin">
                <i class="fas fa-rotate"></i> 已在窗口完成登录？点击同步凭据
              </button>
            </div>

            <!-- 提示状态框 -->
            <div v-if="successMessage" class="status-alert alert-success">
              <i class="fas fa-check-circle alert-icon"></i>
              <span>{{ successMessage }}</span>
            </div>
            <div v-else-if="errorMessage" class="status-alert alert-error">
              <i class="fas fa-exclamation-circle alert-icon"></i>
              <span>{{ errorMessage }}</span>
            </div>

            <!-- 调试状态行 -->
            <div v-if="debugStatus" class="status-alert alert-debug">
              <i class="fas fa-bug alert-icon"></i>
              <span>{{ debugStatus }}</span>
            </div>

            <!-- 底部折叠：高级 / 备用登录选项 -->
            <div class="advanced-login-toggle">
              <button class="toggle-link" @click="showAdvanced = !showAdvanced">
                <span>{{ showAdvanced ? '收起备用登录选项' : '备用登录选项 (Cookie 凭据 / 密码 / 短信)' }}</span>
                <i :class="showAdvanced ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
              </button>
            </div>

            <!-- 备用登录选项容器 -->
            <div v-if="showAdvanced" class="advanced-login-panel">
              <div class="tab-nav">
                <button
                  :class="['tab-item', { active: activeTab === 'cookie' }]"
                  @click="switchTab('cookie')"
                >
                  <i class="fas fa-key tab-icon"></i>
                  <span>Cookie 凭据导入</span>
                </button>
              </div>

            <!-- TAB: Cookie / SESSID 快速快捷登录 -->
            <div class="tab-pane">
              <div class="form-item">
                <label class="form-label">SESSID 或 Cookie 字符串</label>
                <textarea
                  v-model="rawCookieInput"
                  rows="4"
                  class="form-textarea"
                  placeholder="可在此直接贴入浏览器抓包或包含 SESSID、uid、username、token 的完整 Cookie 字符串"
                ></textarea>
                <span class="input-hint">完整凭据格式: SESSID=ea45...; uid=1451266; username=oxygen...; token=64f3...</span>
              </div>

              <!-- 错误或提示反馈 -->
              <div v-if="errorMessage" class="status-alert alert-error">
                <i class="fas fa-exclamation-circle alert-icon"></i>
                <span>{{ errorMessage }}</span>
              </div>
              <div v-else-if="successMessage" class="status-alert alert-success">
                <i class="fas fa-check-circle alert-icon"></i>
                <span>{{ successMessage }}</span>
              </div>

              <div class="dialog-actions">
                <AppButton
                  v-if="isRebinding && authStore.isLoggedIn"
                  variant="secondary"
                  @click="isRebinding = false"
                >
                  取消
                </AppButton>
                <AppButton
                  variant="primary"
                  icon="fas fa-key"
                  :loading="isLoading"
                  :disabled="!rawCookieInput.trim()"
                  @click="handleCookieLogin"
                >
                  解析并导入凭据
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
  <AppConfirmDialog
    :is-open="Boolean(pendingRemovalAccount)"
    title="删除本地账户"
    :message="`确定删除本地账户“${pendingRemovalAccountName}”吗？该操作不会注销酷安账号。`"
    confirm-text="删除"
    danger
    :loading="Boolean(removingUid)"
    @cancel="cancelRemoveSavedAccount"
    @confirm="confirmRemoveSavedAccount"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppButton from '../common/AppButton.vue';
import AppAvatar from '../common/AppAvatar.vue';
import AppConfirmDialog from '../common/AppConfirmDialog.vue';

const authStore = useAuthStore();

const activeTab = ref<'cookie'>('cookie');
const showAdvanced = ref(false);

function handleOpenWebAuth() {
  console.log('[login-debug] handleOpenWebAuth -> openLoginWebview()');
  debugStatus.value = '已调用 open_login_webview，等待登录窗口';
  CoolapkTauriAPI.openLoginWebview();
  successMessage.value = '已调起客户端嵌入式官方登录窗口。登录完成后窗口将自动关闭并完成凭据同步！';
  debugStatus.value = '登录窗口已调起，请在官方窗口完成登录后再同步';
}

async function handleCheckWebLogin() {
  console.log('[login-debug] handleCheckWebLogin start');
  debugStatus.value = '开始同步校验...';
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const isLoggedIn = await authStore.checkStatus();
    console.log('[login-debug] checkStatus result =', isLoggedIn);
    debugStatus.value = `checkStatus=${isLoggedIn ? 'true' : 'false'}`;
    if (isLoggedIn) {
      successMessage.value = '🎉 酷安账号凭据同步成功！欢迎回来，' + (authStore.user?.username || '酷友');
      setTimeout(() => {
        authStore.closeLoginModal();
      }, 1000);
    } else {
      showAdvanced.value = true;
      activeTab.value = 'cookie';
      errorMessage.value = '未检测到成功登录会话。若您已在窗口中完成登录，请点击上方的“已在窗口完成登录？点击同步凭据”；或在下方备用选项直接粘贴 Cookie 登录。';
    }
  } catch (e: any) {
    console.log('[login-debug] checkStatus error =', e?.message || e);
    errorMessage.value = '同步校验失败: ' + (e?.message || e);
  } finally {
    isLoading.value = false;
  }
}

// 监听 Rust 端发送的网页窗口自动重定向闭环事件
let unlistenFn: any = null;
import('@tauri-apps/api/event').then(({ listen }) => {
  listen('login-window-closed', () => {
    console.log('[login-debug] received login-window-closed event');
    debugStatus.value = '收到 login-window-closed 事件，触发同步校验';
    handleCheckWebLogin();
  }).then(unlisten => {
    unlistenFn = unlisten;
  });
});

// 手机号登录表单
// 账号密码登录表单

// Cookie凭据表单
const rawCookieInput = ref('');

const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const isRebinding = ref(false);
const debugStatus = ref('');
const expiredUid = ref('');
const removingUid = ref('');
const pendingRemovalAccount = ref<any | null>(null);

const pendingRemovalAccountName = computed(() => {
  const account = pendingRemovalAccount.value;
  return account?.username || (account?.uid ? `UID ${account.uid}` : '');
});

// 已保存的其他账户（排除当前登录的）
const otherAccounts = computed(() => {
  const currentUid = String(authStore.user?.uid || '');
  return authStore.accounts.filter((acc: any) => String(acc.uid) !== currentUid);
});

async function handleSwitchAccount(acc: any) {
  if (switchingUid.value) return;
  switchingUid.value = String(acc.uid);
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const profile = await authStore.loginAs(String(acc.uid));
    expiredUid.value = '';
    successMessage.value = `已切换到账号：${profile.username}`;
    setTimeout(() => {
      authStore.closeLoginModal();
    }, 800);
  } catch (err: any) {
    expiredUid.value = String(acc.uid);
    const detail = typeof err === 'string' ? err : err?.message;
    const name = acc.username || `UID ${acc.uid}`;
    errorMessage.value = `${name} 登录失败：${detail || '凭据已过期'}。请重新授权或删除该账户。`;
  } finally {
    switchingUid.value = '';
  }
}

const switchingUid = ref('');

function handleReauthorizeAccount(acc: any) {
  expiredUid.value = String(acc.uid);
  errorMessage.value = '';
  successMessage.value = `请在官方窗口重新登录 ${acc.username || `UID ${acc.uid}`}，完成后会自动更新凭据。`;
  handleOpenWebAuth();
}

function handleRemoveSavedAccount(acc: any) {
  if (removingUid.value || switchingUid.value) return;
  pendingRemovalAccount.value = acc;
}

function cancelRemoveSavedAccount() {
  if (!removingUid.value) pendingRemovalAccount.value = null;
}

async function confirmRemoveSavedAccount() {
  const acc = pendingRemovalAccount.value;
  if (!acc || removingUid.value || switchingUid.value) return;
  const name = acc.username || `UID ${acc.uid}`;
  removingUid.value = String(acc.uid);
  errorMessage.value = '';
  try {
    await authStore.removeAccount(String(acc.uid));
    if (expiredUid.value === String(acc.uid)) expiredUid.value = '';
    pendingRemovalAccount.value = null;
    successMessage.value = `已删除本地账户：${name}`;
  } catch (err: any) {
    const detail = typeof err === 'string' ? err : err?.message;
    errorMessage.value = detail || '删除账户失败，请稍后重试';
  } finally {
    removingUid.value = '';
  }
}

watch(
  () => authStore.isLoginModalOpen,
  (isOpen) => {
    if (isOpen) {
      errorMessage.value = '';
      successMessage.value = '';
      isRebinding.value = false;
      debugStatus.value = '';
      expiredUid.value = '';
      removingUid.value = '';
      pendingRemovalAccount.value = null;
      authStore.loadAccounts();
    }
  }
);

function switchTab(tab: 'cookie') {
  activeTab.value = tab;
  errorMessage.value = '';
  successMessage.value = '';
}

function handleClose() {
  pendingRemovalAccount.value = null;
  authStore.closeLoginModal();
}

// Cookie 凭据导入登录
async function handleCookieLogin() {
  if (!rawCookieInput.value.trim() || isLoading.value) return;

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const profile = await authStore.loginWithCookie(rawCookieInput.value);
    successMessage.value = `凭据绑定成功！欢迎，${profile.username || '酷友'}`;
    setTimeout(() => {
      authStore.closeLoginModal();
    }, 1000);
  } catch (err: any) {
    errorMessage.value = err?.message || err || '解析凭据失败，请检查输入格式';
  } finally {
    isLoading.value = false;
  }
}

async function handleLogout() {
  await authStore.logout();
  rawCookieInput.value = '';
  successMessage.value = '';
  errorMessage.value = '';
  isRebinding.value = false;
  authStore.closeLoginModal();
}

onUnmounted(() => {
  if (unlistenFn) unlistenFn();
});
</script>

<style scoped>
.login-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.login-dialog {
  width: 100%;
  max-width: 480px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dialog-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.login-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-light);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.brand-logo {
  width: 36px;
  height: 36px;
}

.header-titles {
  display: flex;
  flex-direction: column;
}

.dialog-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.dialog-sub {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-circle);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.close-btn:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

/* 已登录视图 */
.logged-in-view {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.user-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background-color: var(--background);
  border: 1px solid var(--border-light);
  padding: var(--space-4);
  border-radius: var(--radius-md);
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.username {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.level-badge {
  font-size: 11px;
  font-weight: bold;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  padding: 1px 6px;
  border-radius: var(--radius-pill);
}

.uid-text {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.user-bio {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  margin-top: 4px;
}

.logged-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

/* 已保存账户快速切换区 */
.account-switch-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-label {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
}

.account-switch-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.account-switch-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background-color: var(--background);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.account-switch-item:hover {
  border-color: var(--brand-primary);
  background-color: var(--surface-hover);
}

.account-switch-item.is-expired {
  border-color: color-mix(in srgb, var(--danger) 45%, var(--border-light));
  background-color: color-mix(in srgb, var(--danger) 6%, var(--background));
}

.switch-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.switch-item-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.switch-item-uid {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.expired-label {
  margin-top: 2px;
  color: var(--danger);
  font-size: var(--font-size-caption);
}

.saved-account-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.saved-account-login,
.saved-account-remove {
  height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
}

.saved-account-login {
  min-width: 64px;
  padding: 0 10px;
}

.saved-account-remove {
  width: 30px;
  color: var(--danger);
}

.saved-account-login:hover:not(:disabled) {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.saved-account-remove:hover:not(:disabled) {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, var(--surface));
}

.saved-account-login:disabled,
.saved-account-remove:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.switch-icon {
  color: var(--text-tertiary);
  font-size: 13px;
}

/* 登录表单 */
.login-body {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* 官方直连授权核心极简卡片 */
.official-login-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 20px;
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.01) 100%);
  border: 1px solid rgba(16, 185, 129, 0.18);
  border-radius: var(--radius-card, 14px);
  gap: 10px;
}

.card-hero-icon {
  margin-bottom: 2px;
}

.hero-logo {
  width: 54px;
  height: 54px;
  filter: drop-shadow(0 4px 10px rgba(16, 185, 129, 0.25));
}

.hero-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.hero-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  max-width: 360px;
  line-height: 1.5;
}

.btn-hero-login {
  width: 100%;
  max-width: 320px;
  margin-top: 6px;
  font-size: 15px;
  font-weight: 700;
  height: 42px;
  border-radius: 21px;
}

.btn-hero-sync {
  background: transparent;
  border: none;
  color: #10b981;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  transition: all 0.2s;
}

.btn-hero-sync:hover {
  text-decoration: underline;
  color: #059669;
}

/* 高级 / 备用登录面板折叠链接 */
.advanced-login-toggle {
  display: flex;
  justify-content: center;
  margin-top: 4px;
}

.toggle-link {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  transition: color 0.2s;
}

.toggle-link:hover {
  color: var(--text-secondary);
}

.advanced-login-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-light);
}

.tab-nav {
  display: flex;
  background-color: var(--background);
  padding: 3px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  gap: 2px;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  white-space: nowrap;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.tab-item.active {
  background-color: var(--surface);
  color: var(--brand-primary);
  font-weight: var(--font-weight-bold);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.form-input, .form-textarea {
  width: 100%;
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px var(--space-3);
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  box-sizing: border-box;
  outline: none;
  transition: border-color var(--duration-fast);
}

.form-input {
  height: 40px;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.form-input:focus, .form-textarea:focus {
  border-color: var(--brand-primary);
}

.input-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.input-with-prefix {
  display: flex;
  align-items: center;
  position: relative;
}

.phone-prefix {
  position: absolute;
  left: var(--space-3);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
  pointer-events: none;
}

.input-with-prefix .form-input {
  padding-left: 48px;
}

.vcode-input-group {
  display: flex;
  gap: var(--space-2);
}

.vcode-input-group .form-input {
  flex: 1;
}

.send-vcode-btn {
  height: 40px;
  padding: 0 var(--space-3);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-fast);
}

.send-vcode-btn:disabled {
  color: var(--text-tertiary);
  background-color: var(--background);
  border-color: var(--border-light);
  cursor: not-allowed;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper .form-input {
  padding-right: 40px;
}

.toggle-pwd-btn {
  position: absolute;
  right: var(--space-2);
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--space-1);
}

.toggle-pwd-btn:hover {
  color: var(--text-primary);
}

.status-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sub);
}

.alert-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.alert-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.alert-action-link {
  font-size: 12px;
  color: var(--brand-primary);
  text-decoration: underline;
  cursor: pointer;
  font-weight: bold;
}

.alert-error {
  background-color: rgba(240, 68, 68, 0.1);
  color: var(--danger, #f04444);
  border: 1px solid rgba(240, 68, 68, 0.2);
}

.alert-debug {
  background-color: rgba(59, 130, 246, 0.08);
  color: #3b82f6;
  border: 1px dashed rgba(59, 130, 246, 0.35);
  font-size: 11px;
  word-break: break-all;
}

.alert-success {
  background-color: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

/* 动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@keyframes dialog-pop {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
