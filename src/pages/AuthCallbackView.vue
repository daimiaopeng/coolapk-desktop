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
import { CoolapkTauriAPI } from '../api/coolapk';

const statusText = ref('正在验证酷安账号凭据...');

onMounted(async () => {
  try {
    let cookies = document.cookie || "";

    // 兜底：部分登录流程把凭据拼进跳转链接（query 或 hash），而 document.cookie 只对当前源可见，
    // 跳回本地源后酷安域的 cookie 读不到，需要从 URL 提取
    const query = new URLSearchParams(window.location.search);
    const hashRaw = window.location.hash.replace(/^#\/?/, '');
    const hashQuery = hashRaw.includes('?') ? hashRaw.slice(hashRaw.indexOf('?') + 1) : hashRaw;
    const hash = new URLSearchParams(hashQuery);
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = query.get(k) || hash.get(k);
        if (v) return v;
      }
      return '';
    };

    // 注入脚本/监控端回跳时把完整 cookie 塞进 ck 参数（URLSearchParams 已自动解码）
    const rawCk = pick('ck', 'cookies', 'cookie');
    if (rawCk) {
      cookies = rawCk;
    }

    const sessid = pick('SESSID', 'sessid', 'sessionid', 'sesskey');
    const uid = pick('uid', 'userId', 'user_id');
    const token = pick('token', 'auth_token');

    if (sessid) {
      cookies = `SESSID=${sessid}; uid=${uid}; token=${token}; ${cookies}`.replace(/;\s*;/, ';');
    }

    let validated = false;
    if (cookies && cookies.trim()) {
      await CoolapkTauriAPI.saveCookieSecurely(cookies);
      const result: any = await CoolapkTauriAPI.checkLoginStatus();
      const data = result?.data || result || {};
      const currentUid = String(data.uid || data.id || '').trim();
      validated = Boolean(currentUid && currentUid !== '0' && currentUid !== '10000');
      if (validated) {
        await CoolapkTauriAPI.persistCurrentAccount(
          currentUid,
          data.username || data.displayUsername || '',
          data.userAvatar || data.avatar || data.user_avatar || ''
        );
      }
    }
    statusText.value = validated ? '登录成功，正在同步会话...' : '未完成登录或凭据无效，请重新登录';
    if (!validated) {
      await CoolapkTauriAPI.clearCookie();
    }
  } catch (e) {
    console.warn('回调凭据提取警告:', e);
    statusText.value = '登录凭据验证失败，请重新登录';
  } finally {
    // 只有上面的服务端校验通过时才关窗
    if (statusText.value.startsWith('登录成功')) {
      setTimeout(() => CoolapkTauriAPI.closeLoginWebview(), 300);
    }
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
