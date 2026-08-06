import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type {
  AppSettings,
  ThemeMode,
  FeedDensity,
  ImageQuality,
  AccentColor,
  NavVisibilitySettings,
} from '../types/settings';

const STORAGE_KEY = 'coolapk_desktop_settings';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;

function clampZoom(zoom: number) {
  const safeZoom = Number.isFinite(zoom) ? zoom : DEFAULT_ZOOM;
  return Math.min(Math.max(safeZoom, MIN_ZOOM), MAX_ZOOM);
}

function getSystemZoom() {
  const devicePixelRatio = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
    ? window.devicePixelRatio
    : 1;
  return clampZoom(Math.round(devicePixelRatio * 100));
}

const defaultNavVisibility: NavVisibilitySettings = {
  home: true,
  feeds: true,
  discover: true,
  apps: true,
  games: true,
  topics: true,
  reviews: true,
  secondhand: true,
  notifications: true,
  favorites: true,
  history: true,
  messages: true,
  following: true,
};

const defaultSettings: AppSettings = {
  theme: 'system',
  density: 'standard',
  fontSize: 15,
  zoom: DEFAULT_ZOOM,
  zoomManuallySet: false,
  sidebarCollapsed: false,
  reduceMotion: false,
  inlineComments: false,
  accentColor: 'green',
  collapseLines: 12,
  commentSort: 'hot',
  infiniteScroll: true,
  autoPlayGif: true,
  showDeviceInfo: true,
  defaultHomeTab: 'index_v8',
  downloadPath: '',
  maxConcurrentDownloads: 3,
  autoCleanCache: true,
  cacheThresholdMB: 500,
  imageQuality: 'hd',
  navVisibility: { ...defaultNavVisibility },
  checkUpdateOnStartup: true,
  ignoredUpdateVersion: '',
  ignoreAllUpdates: false,
  closeToTray: false,
  autostart: false,
  startMinimized: false,
  alwaysOnTop: false,
  rememberWindowState: false,
  notifyReplies: true,
  notifyAt: true,
  notifyPm: true,
  desktopNotifications: false,
  notificationSound: true,
  notificationPollInterval: 1,
  externalLinkMode: 'internal',
  timeDisplay: 'relative',
  hideAdCards: false,
  blockedKeywords: [],
  publishDeviceSignature: true,
  deviceSignature: '酷安桌面版',
  imageOpenMode: 'internal',
  updateSpeedLimitKBps: 0,
  proxyUrl: '',
  notifyDownloadComplete: true,
  updateChannel: 'stable',
  experimentalFeatures: false,
};

type AccentPalette = {
  primary: string;
  hover: string;
  active: string;
  soft: string;
  softHover: string;
};

const ACCENT_PALETTES: Record<AccentColor, { light: AccentPalette; dark: AccentPalette }> = {
  green: {
    light: { primary: '#10b768', hover: '#079e58', active: '#05844b', soft: '#eaf8f0', softHover: '#ddf4e7' },
    dark: { primary: '#22c875', hover: '#32d984', active: '#16af65', soft: '#173a29', softHover: '#1d4933' },
  },
  blue: {
    light: { primary: '#2f7bff', hover: '#1f6bf0', active: '#1a5bd0', soft: '#eaf1ff', softHover: '#dce9ff' },
    dark: { primary: '#5b9dff', hover: '#6faaff', active: '#4a8bf0', soft: '#16263f', softHover: '#1d3152' },
  },
  violet: {
    light: { primary: '#7c5cff', hover: '#6c4cf0', active: '#5b3dd8', soft: '#f1ecff', softHover: '#e6dcff' },
    dark: { primary: '#a78bff', hover: '#b59cff', active: '#9676f0', soft: '#241a3d', softHover: '#2e2250' },
  },
  orange: {
    light: { primary: '#f58220', hover: '#e0720f', active: '#c9640c', soft: '#fff2e6', softHover: '#ffe8d1' },
    dark: { primary: '#ffa145', hover: '#ffb066', active: '#f08d30', soft: '#3d2a17', softHover: '#4f371e' },
  },
};

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...defaultSettings });

  // 从 localStorage 加载持久化设置
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const hasManualZoomFlag = typeof parsed.zoomManuallySet === 'boolean';
      settings.value = {
        ...defaultSettings,
        ...parsed,
        // Older settings did not record this flag; non-default zoom values
        // from those versions were necessarily chosen by the user.
        zoomManuallySet: hasManualZoomFlag ? parsed.zoomManuallySet : Number(parsed.zoom) !== DEFAULT_ZOOM,
        navVisibility: { ...defaultNavVisibility, ...(parsed.navVisibility || {}) }
      };
    }
  } catch (err) {
    console.error('Failed to load settings from storage', err);
  }

  if (!settings.value.zoomManuallySet) {
    settings.value.zoom = getSystemZoom();
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
      applyAccent(newVal.accentColor);
      applyDensity(newVal.density);
      applyFontSize(newVal.fontSize);
      applyZoom(newVal.zoom);
      syncCloseToTray(newVal.closeToTray);
      syncAutostart(newVal.autostart);
      syncAlwaysOnTop(newVal.alwaysOnTop);
      syncStartupFlags(newVal);
      applyReduceMotion(newVal.reduceMotion);
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

  function applyAccent(color: AccentColor) {
    const palette = ACCENT_PALETTES[color] || ACCENT_PALETTES.green;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const p = isDark ? palette.dark : palette.light;
    const root = document.documentElement;
    const vars: Record<string, string> = {
      '--brand-primary': p.primary,
      '--brand-hover': p.hover,
      '--brand-active': p.active,
      '--brand-soft': p.soft,
      '--brand-soft-hover': p.softHover,
      '--brand-green': p.primary,
      '--brand-green-hover': p.hover,
      '--brand-green-light': p.soft,
      '--brand-green-subtle': p.soft,
      '--brand-green-border': p.primary,
      '--success': p.primary,
      '--color-success': p.primary,
      '--border-focus': `${p.primary}80`,
    };
    for (const key of Object.keys(vars)) {
      root.style.setProperty(key, vars[key]);
    }
  }

  function applyDensity(density: FeedDensity) {
    document.documentElement.setAttribute('data-density', density);
  }

  function applyReduceMotion(enabled: boolean) {
    document.documentElement.setAttribute('data-reduce-motion', String(enabled));
  }

  function applyFontSize(size: number) {
    const safe = Math.min(Math.max(size || 15, 12), 20);
    document.documentElement.style.setProperty('--font-size-body', `${safe}px`);
  }

  function applyZoom(zoom: number) {
    const safeZoom = clampZoom(zoom);
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

  function syncCloseToTray(enabled: boolean) {
    try {
      void invoke('set_close_to_tray', { enabled });
    } catch (err) {
      console.warn('同步关闭到托盘设置失败:', err);
    }
  }

  function syncAutostart(enabled: boolean) {
    // 非 Tauri 环境（浏览器预览/单元测试）下跳过
    if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;
    import('@tauri-apps/plugin-autostart')
      .then(async ({ enable, disable }) => {
        if (enabled) {
          await enable();
        } else {
          await disable();
        }
      })
      .catch((err) => {
        console.warn('同步开机自启动设置失败:', err);
      });
  }

  function syncAlwaysOnTop(enabled: boolean) {
    if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setAlwaysOnTop(enabled))
      .catch((err) => {
        console.warn('设置窗口置顶失败:', err);
      });
  }

  function syncStartupFlags(s: AppSettings) {
    if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;
    invoke('set_startup_flags', {
      startMinimized: s.startMinimized,
      rememberWindowState: s.rememberWindowState,
      alwaysOnTop: s.alwaysOnTop,
    }).catch((err) => {
      console.warn('同步启动参数失败:', err);
    });
  }

  function setTheme(mode: ThemeMode) {
    settings.value.theme = mode;
  }

  function toggleSidebar() {
    settings.value.sidebarCollapsed = !settings.value.sidebarCollapsed;
  }

  function setZoom(zoom: number) {
    settings.value.zoom = clampZoom(zoom);
    settings.value.zoomManuallySet = true;
  }

  function refreshAutoZoom() {
    if (settings.value.zoomManuallySet) return;
    const systemZoom = getSystemZoom();
    if (settings.value.zoom !== systemZoom) {
      settings.value.zoom = systemZoom;
    }
  }

  function setAccent(color: AccentColor) {
    settings.value.accentColor = color;
  }

  function toggleNavVisibility(key: keyof NavVisibilitySettings) {
    if (!settings.value.navVisibility) {
      settings.value.navVisibility = { ...defaultNavVisibility };
    }
    settings.value.navVisibility[key] = !settings.value.navVisibility[key];
  }

  function ignoreUpdateVersion(version: string) {
    settings.value.ignoredUpdateVersion = version;
  }

  function setIgnoreAllUpdates(enabled: boolean) {
    settings.value.ignoreAllUpdates = enabled;
  }

  function resetUpdateNotifications() {
    settings.value.ignoredUpdateVersion = '';
    settings.value.ignoreAllUpdates = false;
  }

  return {
    settings,
    setTheme,
    toggleSidebar,
    setZoom,
    refreshAutoZoom,
    setAccent,
    toggleNavVisibility,
    ignoreUpdateVersion,
    setIgnoreAllUpdates,
    resetUpdateNotifications,
  };
});
