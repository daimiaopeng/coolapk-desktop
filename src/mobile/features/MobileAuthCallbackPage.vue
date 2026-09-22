<template>
  <section class="mobile-auth-callback-page" data-mobile-page="auth-callback" aria-live="polite">
    <div class="mobile-auth-callback-card">
      <span class="mobile-auth-callback-icon" :class="{ success: state === 'success', error: state === 'error' }">
        <i v-if="state === 'success'" class="fas fa-check" aria-hidden="true"></i>
        <i v-else-if="state === 'error'" class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        <i v-else class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
      </span>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <button v-if="state === 'error'" type="button" @click="retry">重新验证</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

defineOptions({ name: 'MobileAuthCallbackPage' });

type CallbackState = 'checking' | 'success' | 'error';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const state = ref<CallbackState>('checking');
const errorText = ref('');

const title = computed(() => {
  if (state.value === 'success') return '登录成功';
  if (state.value === 'error') return '登录验证失败';
  return '正在验证酷安账号';
});

const description = computed(() => {
  if (state.value === 'success') return '正在返回刚才打开的页面…';
  if (state.value === 'error') return errorText.value || '请返回登录窗口重新授权';
  return '服务端确认账号后才会完成登录，请稍候…';
});

const redirectPath = computed(() => {
  const value = String(route.query.redirect || '').trim();
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
});

async function verify() {
  state.value = 'checking';
  errorText.value = '';
  const valid = await authStore.checkStatus();
  if (!valid) {
    state.value = 'error';
    errorText.value = '服务端暂未确认有效登录凭据';
    return;
  }
  state.value = 'success';
  window.setTimeout(() => void router.replace(redirectPath.value), 350);
}

function retry() {
  void verify();
}

onMounted(() => {
  void verify();
});
</script>

<style scoped>
.mobile-auth-callback-page { display: grid; place-items: center; flex: 1; min-width: 0; min-height: 0; padding: 24px; background: #f2f2f6; color: #242426; }
.mobile-auth-callback-card { display: grid; justify-items: center; width: min(100%, 360px); gap: 12px; padding: 30px 24px 26px; border-radius: 24px; background: #fff; box-shadow: 0 10px 30px rgba(20, 20, 25, .09); text-align: center; }
.mobile-auth-callback-icon { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 18px; background: #e6f7ee; color: #0f9d58; font-size: 25px; }
.mobile-auth-callback-icon.error { background: #fff0ed; color: #e04b42; }
.mobile-auth-callback-card h1 { margin: 0; font-size: 20px; }
.mobile-auth-callback-card p { margin: 0; color: #96969c; font-size: 13px; line-height: 1.55; }
.mobile-auth-callback-card button { min-height: 38px; padding: 0 18px; border: 0; border-radius: 999px; background: #0f9d58; color: #fff; font: inherit; }
</style>
