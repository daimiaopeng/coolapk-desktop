<template>
  <div class="auth-callback-container">
    <div class="callback-card">
      <i class="fas fa-circle-notch fa-spin status-icon"></i>
       <h3>{{ statusText }}</h3>
       <p>只有服务端确认真实账号后才会关闭登录窗口</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const statusText = ref('正在验证酷安账号凭据...');

onMounted(() => {
  const callback = `${window.location.search}${window.location.hash}`;
  statusText.value = callback.includes('ac=access_token') && callback.includes('code=') ? '正在通过官方授权码获取登录信息...' : '正在从官方窗口同步登录信息...';
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
