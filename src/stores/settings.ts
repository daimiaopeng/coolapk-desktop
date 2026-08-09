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
  DeviceFingerprintSettings,
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
  // 桌面端 WebView2 已按系统显示缩放（DPI）自动渲染，CSS 像素即逻辑像素，
  // 与系统所有应用保持一致。若再按 devicePixelRatio 额外放大，
  // 会与系统缩放双重叠加（如 150% × 150%）导致界面过大，
  // 因此自动基准固定为 100%，需要更大或更小由用户手动微调。
  return DEFAULT_ZOOM;
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

/** 默认设备信息：与 Rust 客户端 CoolapkClient::new() 内置的默认头一致 */
const defaultDeviceFingerprint: DeviceFingerprintSettings = {
  customFingerprint: false,
  model: '23113RKC6C',
  androidVersion: '16',
  build: 'AQ3A.250226.002',
  appVersion: '16.2.0',
  appCode: '2604201',
  sdkInt: '36',
  locale: 'zh-CN',
  darkMode: '0',
};

/** 由设备信息字段拼装酷安移动端 User-Agent */
export function buildDeviceUserAgent(f: DeviceFingerprintSettings): string {
  const model = f.model.trim() || defaultDeviceFingerprint.model;
  const android = f.androidVersion.trim() || defaultDeviceFingerprint.androidVersion;
  const build = f.build.trim() || defaultDeviceFingerprint.build;
  const version = f.appVersion.trim() || defaultDeviceFingerprint.appVersion;
  const code = f.appCode.trim() || defaultDeviceFingerprint.appCode;
  return `Dalvik/2.1.0 (Linux; U; Android ${android}; ${model} Build/${build}) +CoolMarket/${version}-${code}-universal`;
}

const defaultSettings: AppSettings = {
  theme: 'system',
  density: 'standard',
  fontSize: 15,
  zoom: DEFAULT_ZOOM,
  zoomManuallySet: false,
  sidebarCollapsed: false,
  reduceMotion: false,
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
  cacheTtlDays: 7,
  cachePath: '',
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
  deviceSignature: '',
  imageOpenMode: 'internal',
  updateSpeedLimitKBps: 0,
  proxyUrl: '',
  notifyDownloadComplete: true,
  updateChannel: 'stable',
  experimentalFeatures: false,
  deviceFingerprint: { ...defaultDeviceFingerprint },
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
        // 旧版本没有记录手动缩放标志：早期版本的"自动"值（devicePixelRatio×100）
        // 会与系统 DPI 双重放大导致界面过大，因此一律视为自动，按新算法重置为 100%。
        zoomManuallySet: hasManualZoomFlag ? parsed.zoomManuallySet : false,
        // 旧默认签名"来自酷安桌面版"已取消，改为空；用户自定义签名保留
        deviceSignature: parsed.deviceSignature === '酷安桌面版' ? '' : (parsed.deviceSignature ?? ''),
        navVisibility: { ...defaultNavVisibility, ...(parsed.navVisibility || {}) },
        deviceFingerprint: { ...defaultDeviceFingerprint, ...(parsed.deviceFingerprint || {}) }
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
      syncDeviceProfile(newVal);
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

  // 将"设备信息"设置同步给 Rust 客户端（作用于所有 API 请求头）。
  // 未启用自定义时下发空对象，Rust 端保持默认值。
  function syncDeviceProfile(s: AppSettings) {
    if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;
    const f = s.deviceFingerprint;
    invoke('update_device_profile', {
      profile: f.customFingerprint
        ? {
            userAgent: buildDeviceUserAgent(f),
            sdkInt: f.sdkInt,
            locale: f.locale,
            appVersion: f.appVersion,
            appCode: f.appCode,
            apiVersion: '16',
            darkMode: f.darkMode,
          }
        : {},
    }).catch((err) => {
      console.warn('同步设备信息设置失败:', err);
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
