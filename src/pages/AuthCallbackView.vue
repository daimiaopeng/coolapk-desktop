<template>
  <div class="auth-callback-container">
    <div class="callback-card">
      <i class="fas fa-circle-notch fa-spin status-icon"></i>
      <h3>正在完成酷安账号凭据提取与同步...</h3>
      <p>身份校验成功，即刻关闭登录窗口并载入会话</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';

onMounted(async () => {
  try {
    const cookies = document.cookie || "";
    if (cookies) {
      await CoolapkTauriAPI.saveCookieSecurely(cookies);
    }
  } catch (e) {
    console.warn('回调凭据提取警告:', e);
  } finally {
    setTimeout(async () => {
      try {
        await CoolapkTauriAPI.closeLoginWebview();
      } catch (err) {
        console.warn('关闭窗口异常:', err);
      }
    }, 300);
  }
});
</script>

<style scoped>
.auth-callback-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: var(--background, #f9fafb);
  color: var(--text-primary, #111827);
  font-family: system-ui, -apple-system, sans-serif;
}

.callback-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 30px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
  gap: 12px;
}

.status-icon {
  font-size: 36px;
  color: #10b981;
}

h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
</style>
