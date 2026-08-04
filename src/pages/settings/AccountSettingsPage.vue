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
        <AppButton v-else variant="danger" size="sm" @click="authStore.logout()">退出登录</AppButton>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">Cookie 凭据管理</span>
          <span class="row-sub">本地安全存储与极简一键凭据校验</span>
        </div>
        <AppButton variant="secondary" size="sm" @click="authStore.openLoginModal()">管理凭据 Cookie</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '../../stores/auth';
import AppButton from '../../components/common/AppButton.vue';

const authStore = useAuthStore();
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
</style>
