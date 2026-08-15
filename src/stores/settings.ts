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
  HomeTabKey,
} from '../types/settings';

const STORAGE_KEY = 'coolapk_desktop_settings';
const SETTINGS_FILE = 'settings.json';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
export const DEFAULT_HOME_TAB_ORDER: string[] = [];

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
  albums: true,
  pictures: true,
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
  sdkInt: '35',
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
  feedLayout: 'single',
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
  homeTabOrder: [...DEFAULT_HOME_TAB_ORDER],
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

type SettingsFileStore = {
  entries<T>(): Promise<Array<[string, T]>>;
  keys(): Promise<string[]>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  save(): Promise<void>;
};

function cloneDefaultSettings(): AppSettings {
  return {
    ...defaultSettings,
    navVisibility: { ...defaultNavVisibility },
    homeTabOrder: [...DEFAULT_HOME_TAB_ORDER],
    blockedKeywords: [],
    deviceFingerprint: { ...defaultDeviceFingerprint },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/** 只接受已知类型和取值，避免损坏的 JSON 让页面出现不可用设置。 */
export function normalizeSettings(value: unknown): AppSettings {
  const source = isRecord(value) ? value : {};
  const result = cloneDefaultSettings();
  if (isOneOf(source.theme, ['light', 'dark', 'system'])) result.theme = source.theme;
  if (isOneOf(source.density, ['comfortable', 'standard', 'compact'])) result.density = source.density;
  if (isOneOf(source.feedLayout, ['single', 'double'])) result.feedLayout = source.feedLayout;
  if (isOneOf(source.accentColor, ['green', 'blue', 'violet', 'orange'])) result.accentColor = source.accentColor;
  if (isOneOf(source.commentSort, ['hot', 'latest'])) result.commentSort = source.commentSort;
  if (isOneOf(source.defaultHomeTab, ['index_v8', 'digest', 'hot', 'latest', 'cool_picture', 'secondhand', 'pictures', 'dyh'])) result.defaultHomeTab = source.defaultHomeTab;
  if (Array.isArray(source.homeTabOrder)) {
    const valid = source.homeTabOrder.filter((item): item is HomeTabKey => isOneOf(item, DEFAULT_HOME_TAB_ORDER));
    result.homeTabOrder = [...new Set([...valid, ...DEFAULT_HOME_TAB_ORDER])];
  }
  if (isOneOf(source.imageQuality, ['standard', 'hd', 'raw'])) result.imageQuality = source.imageQuality;
  if (isOneOf(source.externalLinkMode, ['internal', 'system'])) result.externalLinkMode = source.externalLinkMode;
  if (isOneOf(source.timeDisplay, ['relative', 'absolute'])) result.timeDisplay = source.timeDisplay;
  if (isOneOf(source.imageOpenMode, ['internal', 'system'])) result.imageOpenMode = source.imageOpenMode;
  if (isOneOf(source.updateChannel, ['stable', 'beta'])) result.updateChannel = source.updateChannel;
  result.fontSize = readNumber(source.fontSize, result.fontSize, 12, 20);
  result.zoom = readNumber(source.zoom, result.zoom, MIN_ZOOM, MAX_ZOOM);
  result.zoomManuallySet = readBoolean(source.zoomManuallySet, result.zoomManuallySet);
  result.sidebarCollapsed = readBoolean(source.sidebarCollapsed, result.sidebarCollapsed);
  result.reduceMotion = readBoolean(source.reduceMotion, result.reduceMotion);
  result.collapseLines = [0, 8, 12, 18].includes(Number(source.collapseLines)) ? Number(source.collapseLines) : result.collapseLines;
  result.infiniteScroll = readBoolean(source.infiniteScroll, result.infiniteScroll);
  result.autoPlayGif = readBoolean(source.autoPlayGif, result.autoPlayGif);
  result.showDeviceInfo = readBoolean(source.showDeviceInfo, result.showDeviceInfo);
  result.downloadPath = readString(source.downloadPath, result.downloadPath);
  result.maxConcurrentDownloads = [1, 2, 3, 4, 5, 6, 8].includes(Number(source.maxConcurrentDownloads)) ? Number(source.maxConcurrentDownloads) : result.maxConcurrentDownloads;
  result.autoCleanCache = readBoolean(source.autoCleanCache, result.autoCleanCache);
  result.cacheThresholdMB = [200, 500, 1000, 2000].includes(Number(source.cacheThresholdMB)) ? Number(source.cacheThresholdMB) : result.cacheThresholdMB;
  result.cacheTtlDays = [0, 1, 3, 7, 14, 30].includes(Number(source.cacheTtlDays)) ? Number(source.cacheTtlDays) : result.cacheTtlDays;
  result.cachePath = readString(source.cachePath, result.cachePath);
  result.checkUpdateOnStartup = readBoolean(source.checkUpdateOnStartup, result.checkUpdateOnStartup);
  result.ignoredUpdateVersion = readString(source.ignoredUpdateVersion, result.ignoredUpdateVersion);
  result.ignoreAllUpdates = readBoolean(source.ignoreAllUpdates, result.ignoreAllUpdates);
  result.closeToTray = readBoolean(source.closeToTray, result.closeToTray);
  result.autostart = readBoolean(source.autostart, result.autostart);
  result.startMinimized = readBoolean(source.startMinimized, result.startMinimized);
  result.alwaysOnTop = readBoolean(source.alwaysOnTop, result.alwaysOnTop);
  result.rememberWindowState = readBoolean(source.rememberWindowState, result.rememberWindowState);
  result.notifyReplies = readBoolean(source.notifyReplies, result.notifyReplies);
  result.notifyAt = readBoolean(source.notifyAt, result.notifyAt);
  result.notifyPm = readBoolean(source.notifyPm, result.notifyPm);
  result.desktopNotifications = readBoolean(source.desktopNotifications, result.desktopNotifications);
  result.notificationSound = readBoolean(source.notificationSound, result.notificationSound);
  result.notificationPollInterval = [1, 5, 10, 30].includes(Number(source.notificationPollInterval)) ? Number(source.notificationPollInterval) : result.notificationPollInterval;
  result.hideAdCards = readBoolean(source.hideAdCards, result.hideAdCards);
  result.blockedKeywords = Array.isArray(source.blockedKeywords) ? [...new Set(source.blockedKeywords.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))] : result.blockedKeywords;
  result.publishDeviceSignature = readBoolean(source.publishDeviceSignature, result.publishDeviceSignature);
  result.deviceSignature = readString(source.deviceSignature, result.deviceSignature).slice(0, 40);
  result.updateSpeedLimitKBps = [0, 500, 1024, 2048, 5120].includes(Number(source.updateSpeedLimitKBps)) ? Number(source.updateSpeedLimitKBps) : result.updateSpeedLimitKBps;
  result.proxyUrl = readString(source.proxyUrl, result.proxyUrl);
  result.notifyDownloadComplete = readBoolean(source.notifyDownloadComplete, result.notifyDownloadComplete);
  result.experimentalFeatures = readBoolean(source.experimentalFeatures, result.experimentalFeatures);
  if (!result.experimentalFeatures && result.updateChannel === 'beta') result.updateChannel = 'stable';
  if (isRecord(source.navVisibility)) {
    for (const key of Object.keys(defaultNavVisibility) as Array<keyof NavVisibilitySettings>) result.navVisibility![key] = readBoolean(source.navVisibility[key], result.navVisibility![key]);
  }
  if (isRecord(source.deviceFingerprint)) {
    const fingerprint = source.deviceFingerprint;
    result.deviceFingerprint.customFingerprint = readBoolean(fingerprint.customFingerprint, result.deviceFingerprint.customFingerprint);
    result.deviceFingerprint.model = readString(fingerprint.model, result.deviceFingerprint.model);
    result.deviceFingerprint.androidVersion = readString(fingerprint.androidVersion, result.deviceFingerprint.androidVersion);
    result.deviceFingerprint.build = readString(fingerprint.build, result.deviceFingerprint.build);
    result.deviceFingerprint.appVersion = readString(fingerprint.appVersion, result.deviceFingerprint.appVersion);
    result.deviceFingerprint.appCode = readString(fingerprint.appCode, result.deviceFingerprint.appCode);
    result.deviceFingerprint.sdkInt = readString(fingerprint.sdkInt, result.deviceFingerprint.sdkInt);
    result.deviceFingerprint.locale = readString(fingerprint.locale, result.deviceFingerprint.locale);
    if (isOneOf(fingerprint.darkMode, ['0', '1'])) result.deviceFingerprint.darkMode = fingerprint.darkMode;
  }
  if (result.deviceSignature === '酷安桌面版') result.deviceSignature = '';
  return result;
}

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
  const settings = ref<AppSettings>(cloneDefaultSettings());
  const isTauriRuntime = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
  let fileStore: SettingsFileStore | null = null;
  let persistenceReady = !isTauriRuntime;
  let saveQueue = Promise.resolve();
  let initializationPromise: Promise<void> | null = null;

  function loadLegacySettings(): AppSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return cloneDefaultSettings();
      const parsed = JSON.parse(saved);
      const normalized = normalizeSettings(parsed);
      if (!normalized.zoomManuallySet) normalized.zoom = getSystemZoom();
      return normalized;
    } catch (err) {
      console.error('加载旧版设置失败，将使用默认设置', err);
      return cloneDefaultSettings();
    }
  }

  async function saveSettingsFile(snapshot: AppSettings) {
    if (!fileStore) return;
    const currentKeys = new Set(Object.keys(snapshot));
    const oldKeys = await fileStore.keys();
    for (const key of oldKeys) {
      if (!currentKeys.has(key)) await fileStore.delete(key);
    }
    for (const [key, value] of Object.entries(snapshot)) await fileStore.set(key, value);
    await fileStore.save();
  }

  function queueFileSave(snapshot: AppSettings) {
    const copy = JSON.parse(JSON.stringify(snapshot)) as AppSettings;
    saveQueue = saveQueue.then(() => saveSettingsFile(copy)).catch((err) => {
      console.error('保存 settings.json 失败', err);
    });
    return saveQueue;
  }

  async function initialize() {
    if (!isTauriRuntime) return;
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load(SETTINGS_FILE, { autoSave: false });
      const entries = await store.entries<unknown>();
      const diskSettings = Object.fromEntries(entries);
      settings.value = normalizeSettings(entries.length ? diskSettings : loadLegacySettings());
      if (!settings.value.zoomManuallySet) settings.value.zoom = getSystemZoom();
      fileStore = store;
      persistenceReady = true;
      await queueFileSave(settings.value);
    } catch (err) {
      console.error('加载 settings.json 失败，将回退到 localStorage', err);
      settings.value = loadLegacySettings();
      if (!settings.value.zoomManuallySet) settings.value.zoom = getSystemZoom();
      persistenceReady = true;
    }
  }

  if (!isTauriRuntime) settings.value = loadLegacySettings();

  function initializeSettings() {
    if (!initializationPromise) initializationPromise = initialize();
    return initializationPromise;
  }

  function flushSettings() {
    return saveQueue;
  }

  // 持久化与生效应用
  watch(
    settings,
    (newVal) => {
      if (persistenceReady) {
        if (fileStore) {
          void queueFileSave(newVal);
        } else {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal));
          } catch (err) {
            console.error('保存本地设置失败', err);
          }
        }
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

  void initializeSettings();

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

  function moveHomeTab(key: HomeTabKey, direction: -1 | 1) {
    const order = [...settings.value.homeTabOrder];
    const index = order.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    settings.value.homeTabOrder = order;
  }

  function resetHomeTabOrder() {
    settings.value.homeTabOrder = [...DEFAULT_HOME_TAB_ORDER];
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
    initializeSettings,
    flushSettings,
    setTheme,
    toggleSidebar,
    setZoom,
    refreshAutoZoom,
    setAccent,
    toggleNavVisibility,
    moveHomeTab,
    resetHomeTabOrder,
    ignoreUpdateVersion,
    setIgnoreAllUpdates,
    resetUpdateNotifications,
  };
});
