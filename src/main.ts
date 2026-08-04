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
app.mount('#app');
