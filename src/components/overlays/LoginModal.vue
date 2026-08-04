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
                <span class="dialog-sub">登录后即可同步体验点赞、发布动态、发送私信与评论功能</span>
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

            <div class="logged-actions">
              <AppButton variant="secondary" icon="fas fa-user-gear" @click="isRebinding = true">
                切换/重新登录账号
              </AppButton>
              <AppButton variant="danger" icon="fas fa-right-from-bracket" @click="handleLogout">
                退出登录
              </AppButton>
            </div>
          </div>

          <!-- 未登录或重新绑定凭据流程 -->
          <div v-else class="login-body">
            <div class="tab-nav">
              <button
                :class="['tab-item', { active: activeTab === 'mobile' }]"
                @click="switchTab('mobile')"
              >
                <i class="fas fa-mobile-screen-button tab-icon"></i>
                手机号验证码登录
              </button>
              <button
                :class="['tab-item', { active: activeTab === 'account' }]"
                @click="switchTab('account')"
              >
                <i class="fas fa-user-lock tab-icon"></i>
                账号密码登录
              </button>
            </div>

            <!-- TAB 1: 手机号 + 验证码登录 -->
            <div v-if="activeTab === 'mobile'" class="tab-pane">
              <div class="form-item">
                <label class="form-label">手机号码</label>
                <div class="input-with-prefix">
                  <span class="phone-prefix">+86</span>
                  <input
                    v-model="mobilePhone"
                    type="tel"
                    maxlength="11"
                    class="form-input"
                    placeholder="请输入 11 位手机号码"
                    @keyup.enter="handleSendVcode"
                  />
                </div>
              </div>

              <div class="form-item">
                <label class="form-label">短信验证码</label>
                <div class="vcode-input-group">
                  <input
                    v-model="smsCode"
                    type="text"
                    maxlength="6"
                    class="form-input"
                    placeholder="请输入短信验证码"
                    @keyup.enter="handleMobileLogin"
                  />
                  <button
                    class="send-vcode-btn"
                    :disabled="isSendingCode || countdown > 0 || !isValidPhone"
                    @click="handleSendVcode"
                  >
                    {{ countdown > 0 ? `${countdown}s 后重新获取` : (isSendingCode ? '发送中...' : '获取验证码') }}
                  </button>
                </div>
              </div>

              <!-- 错误或提示反馈 -->
              <div v-if="errorMessage" class="status-alert alert-error">
                <i class="fas fa-exclamation-circle"></i>
                <span>{{ errorMessage }}</span>
              </div>
              <div v-else-if="successMessage" class="status-alert alert-success">
                <i class="fas fa-check-circle"></i>
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
                  icon="fas fa-arrow-right-to-bracket"
                  :loading="isLoading"
                  :disabled="!isValidPhone || !smsCode.trim()"
                  @click="handleMobileLogin"
                >
                  {{ isLoading ? '登录中...' : '登录 / 注册' }}
                </AppButton>
              </div>
            </div>

            <!-- TAB 2: 账号密码登录 -->
            <div v-else class="tab-pane">
              <div class="form-item">
                <label class="form-label">酷安账号 / 手机号 / 邮箱</label>
                <input
                  v-model="accountName"
                  type="text"
                  class="form-input"
                  placeholder="请输入手机号、酷安用户名或邮箱"
                />
              </div>

              <div class="form-item">
                <label class="form-label">登录密码</label>
                <div class="password-input-wrapper">
                  <input
                    v-model="accountPassword"
                    :type="showPassword ? 'text' : 'password'"
                    class="form-input"
                    placeholder="请输入密码"
                    @keyup.enter="handleAccountLogin"
                  />
                  <button class="toggle-pwd-btn" @click="showPassword = !showPassword">
                    <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                  </button>
                </div>
              </div>

              <!-- 错误或提示反馈 -->
              <div v-if="errorMessage" class="status-alert alert-error">
                <i class="fas fa-exclamation-circle"></i>
                <span>{{ errorMessage }}</span>
              </div>
              <div v-else-if="successMessage" class="status-alert alert-success">
                <i class="fas fa-check-circle"></i>
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
                  icon="fas fa-shield-halved"
                  :loading="isLoading"
                  :disabled="!accountName.trim() || !accountPassword.trim()"
                  @click="handleAccountLogin"
                >
                  {{ isLoading ? '安全验证中...' : '立即登录' }}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import AppButton from '../common/AppButton.vue';
import AppAvatar from '../common/AppAvatar.vue';

const authStore = useAuthStore();

const activeTab = ref<'mobile' | 'account'>('mobile');

// 手机号登录表单
const mobilePhone = ref('');
const smsCode = ref('');
const isSendingCode = ref(false);
const countdown = ref(0);
let timer: any = null;

// 账号密码登录表单
const accountName = ref('');
const accountPassword = ref('');
const showPassword = ref(false);

const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const isRebinding = ref(false);

const isValidPhone = computed(() => {
  return /^1[3-9]\d{9}$/.test(mobilePhone.value.trim());
});

watch(
  () => authStore.isLoginModalOpen,
  (isOpen) => {
    if (isOpen) {
      errorMessage.value = '';
      successMessage.value = '';
      isRebinding.value = false;
    }
  }
);

function switchTab(tab: 'mobile' | 'account') {
  activeTab.value = tab;
  errorMessage.value = '';
  successMessage.value = '';
}

function handleClose() {
  authStore.closeLoginModal();
}

// 发送短信验证码
async function handleSendVcode() {
  if (!isValidPhone.value || countdown.value > 0 || isSendingCode.value) return;

  isSendingCode.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    await authStore.sendSmsCode(mobilePhone.value);
    successMessage.value = '验证码已成功发送至您的手机，请注意查收';
    
    // 启动 60s 倒计时
    countdown.value = 60;
    timer = setInterval(() => {
      if (countdown.value > 0) {
        countdown.value--;
      } else {
        clearInterval(timer);
        timer = null;
      }
    }, 1000);
  } catch (err: any) {
    errorMessage.value = err?.message || '发送验证码失败，请稍后再试';
  } finally {
    isSendingCode.value = false;
  }
}

// 手机号验证码登录
async function handleMobileLogin() {
  if (!isValidPhone.value || !smsCode.value.trim() || isLoading.value) return;

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const profile = await authStore.loginWithMobile(mobilePhone.value, smsCode.value);
    successMessage.value = `登录成功！欢迎回来，${profile.username}`;
    setTimeout(() => {
      authStore.closeLoginModal();
    }, 1000);
  } catch (err: any) {
    errorMessage.value = err?.message || '手机号登录失败，请检查验证码是否正确';
  } finally {
    isLoading.value = false;
  }
}

// 账号密码登录
async function handleAccountLogin() {
  if (!accountName.value.trim() || !accountPassword.value.trim() || isLoading.value) return;

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const profile = await authStore.loginWithAccount(accountName.value, accountPassword.value);
    successMessage.value = `登录成功！欢迎回来，${profile.username}`;
    setTimeout(() => {
      authStore.closeLoginModal();
    }, 1000);
  } catch (err: any) {
    errorMessage.value = err?.message || '账号或密码错误，请核对后重试';
  } finally {
    isLoading.value = false;
  }
}

async function handleLogout() {
  await authStore.logout();
  mobilePhone.value = '';
  smsCode.value = '';
  accountName.value = '';
  accountPassword.value = '';
  successMessage.value = '';
  errorMessage.value = '';
  isRebinding.value = false;
}

onUnmounted(() => {
  if (timer) clearInterval(timer);
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
  max-width: 460px;
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

/* 登录表单 */
.login-body {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.tab-nav {
  display: flex;
  background-color: var(--background);
  padding: 3px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--font-size-sub);
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

.form-input {
  width: 100%;
  height: 40px;
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  box-sizing: border-box;
  outline: none;
  transition: border-color var(--duration-fast);
}

.form-input:focus {
  border-color: var(--brand-primary);
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
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sub);
}

.alert-error {
  background-color: rgba(240, 68, 68, 0.1);
  color: var(--danger, #f04444);
  border: 1px solid rgba(240, 68, 68, 0.2);
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
