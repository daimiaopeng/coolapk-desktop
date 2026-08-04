import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { AppSettings, ThemeMode, FeedDensity, ImageQuality } from '../types/settings';

const STORAGE_KEY = 'coolapk_desktop_settings';

const defaultSettings: AppSettings = {
  theme: 'system',
  density: 'standard',
  fontSize: 15,
  zoom: 100,
  sidebarCollapsed: false,
  reduceMotion: false,
  inlineComments: false,
  downloadPath: 'C:\\Downloads\\Coolapk',
  maxConcurrentDownloads: 3,
  autoCleanCache: true,
  cacheThresholdMB: 500,
  imageQuality: 'hd'
};

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...defaultSettings });

  // 从 localStorage 加载持久化设置
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      settings.value = { ...defaultSettings, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error('Failed to load settings from storage', err);
  }

  // 持久化与生效应用
  watch(
    settings,
    (newVal) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal));
      } catch (err) {
        console.error('Failed to save settings', err);
      }
      applyTheme(newVal.theme);
      applyZoom(newVal.zoom);
    },
    { deep: true, immediate: true }
  );

  function applyTheme(theme: ThemeMode) {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      root.removeAttribute('data-theme');
    } else {
      // Follow system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }
    }
  }

  function applyZoom(zoom: number) {
    const safeZoom = Math.min(Math.max(zoom || 100, 50), 200);
    const factor = safeZoom / 100;
    const appEl = document.getElementById('app');
    if (!appEl) return;

    // 彻底清除旧的 CSS zoom（有 vw/vh 计算 Bug）
    (appEl.style as any).zoom = '';
    document.body.style.zoom = '';

    // 使用 transform: scale() 实现缩放，配合反算宽高确保精准充盈视口
    appEl.style.transformOrigin = 'top left';
    appEl.style.transform = `scale(${factor})`;
    appEl.style.width = `${100 / factor}vw`;
    appEl.style.height = `${100 / factor}vh`;
  }

  function setTheme(mode: ThemeMode) {
    settings.value.theme = mode;
  }

  function toggleSidebar() {
    settings.value.sidebarCollapsed = !settings.value.sidebarCollapsed;
  }

  function setZoom(zoom: number) {
    settings.value.zoom = Math.min(Math.max(zoom, 50), 200);
  }

  return {
    settings,
    setTheme,
    toggleSidebar,
    setZoom
  };
});
