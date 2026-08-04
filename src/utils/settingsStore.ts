import { reactive, watch } from 'vue';

export type ThemeMode = 'system' | 'light' | 'dark';
export type CommentSort = 'hot' | 'latest';
export type ImageQuality = 'original' | 'compressed';

export interface AppSettings {
  appZoom: number;
  theme: ThemeMode;
  collapseLines: number;
  enablePreload: boolean;
  commentSort: CommentSort;
  imageQuality: ImageQuality;
}

const STORAGE_KEY = 'coolapk-desktop-app-settings';

const defaultSettings: AppSettings = {
  appZoom: 100,
  theme: 'system',
  collapseLines: 12,
  enablePreload: true,
  commentSort: 'hot',
  imageQuality: 'original',
};

// 尝试从 localStorage 恢复配置
function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    }
  } catch (err) {
    console.warn('[SettingsStore] Failed to load settings from localStorage:', err);
  }
  return { ...defaultSettings };
}

export const settings = reactive<AppSettings>(loadSettings());

// 监听设置变化并保存到 localStorage
watch(
  settings,
  (newVal) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal));
      applyTheme(newVal.theme);
    } catch (err) {
      console.warn('[SettingsStore] Failed to save settings:', err);
    }
  },
  { deep: true }
);

// 应用主题到 html document
export function applyTheme(themeMode: ThemeMode) {
  const root = document.documentElement;
  if (themeMode === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (themeMode === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // 跟随系统
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

// 初始化应用主题
applyTheme(settings.theme);

// 监听系统主题切换变化（当选“跟随系统”时生效）
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (settings.theme === 'system') {
    applyTheme('system');
  }
});
