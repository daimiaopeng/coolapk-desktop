import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/index.css';
import App from './App.vue';
import { router } from './router';
import { CoolapkTauriAPI } from './api/coolapk';
import { useSettingsStore } from './stores/settings';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
const settingsStore = useSettingsStore(pinia);

// 全局挂载外部链接打开器，供 DOM v-html 中的 <a onclick="..."> 安全调用
(window as any).__openCoolapkUrl = (url: string) => {
  if (!url) return;
  console.log('Open coolapk link:', url);
  void CoolapkTauriAPI.openUrl(url, useSettingsStore().settings.externalLinkMode);
};
app.use(router);

// 全局兜底：拦截 v-html 或未来新增页面中遗漏处理的 <a> 点击，
// 防止主窗口被导航到外部域名（外部页面接管主窗口 = 钓鱼/凭据回跳源被劫持风险）。
// 冒泡阶段执行：页面级 handleAnchorClick / vue-router 已处理（preventDefault）的
// 点击自动让行，只接管"无人处理"的外部链接。
document.addEventListener('click', (e) => {
  if (e.defaultPrevented) return;
  const anchor = (e.target as HTMLElement).closest('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href') || '';
  // 站内相对/锚点链接交给 vue-router 与页面级逻辑
  if (!href || href.startsWith('/') || href.startsWith('#')) return;
  e.preventDefault();
  if (/^https?:\/\//i.test(href)) {
    void CoolapkTauriAPI.openUrl(anchor.href, useSettingsStore().settings.externalLinkMode);
  }
  // 其余 scheme（javascript:、file: 等）直接静默阻止，协议白名单由 open_url 兜底
}, false);

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

async function bootstrap() {
  await settingsStore.initializeSettings();
  app.mount('#app');
}

void bootstrap();
