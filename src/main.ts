import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/index.css';
import App from './App.vue';
import { router } from './router';
import { CoolapkTauriAPI } from './api/coolapk';

// 全局挂载外部链接打开器，供 DOM v-html 中的 <a onclick="..."> 安全调用
(window as any).__openCoolapkUrl = (url: string) => {
  if (!url) return;
  console.log('Open coolapk link:', url);
  void CoolapkTauriAPI.openUrl(url);
};

const app = createApp(App);
app.use(createPinia());
app.use(router);

// 全局错误捕获：把渲染期/异步崩溃显示出来，避免静默白屏，便于定位问题
function showGlobalError(message: string) {
  try {
    let el = document.getElementById('__global_error_overlay__');
    if (!el) {
      el = document.createElement('div');
      el.id = '__global_error_overlay__';
      el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;max-width:80vw;padding:10px 14px;background:#f04444;color:#fff;border-radius:8px;font:12px/1.5 system-ui,sans-serif;white-space:pre-wrap;word-break:break-all;box-shadow:0 4px 16px rgba(0,0,0,.25)';
      document.body.appendChild(el);
    }
    el.textContent = '[全局错误] ' + message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 15000);
  } catch {
    // 忽略叠加层自身的错误
  }
}

app.config.errorHandler = (err, _instance, info) => {
  const msg = `${info || 'render'}: ${err instanceof Error ? err.message : String(err)}`;
  console.error('[global-error]', msg, err);
  showGlobalError(msg);
};

window.addEventListener('error', (e) => {
  const msg = `${e.message || 'unknown'} @ ${e.filename || ''}:${e.lineno || ''}:${e.colno || ''}`;
  console.error('[window-error]', msg, e.error);
  showGlobalError(msg);
});

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason || e);
  console.error('[unhandledrejection]', msg, e.reason);
  showGlobalError(msg);
});

app.mount('#app');
