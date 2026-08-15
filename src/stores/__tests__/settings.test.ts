import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { normalizeSettings, useSettingsStore } from '../../stores/settings';
import type { AppSettings } from '../../types/settings';

const fileStoreState = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const store = {
    entries: async <T>() => Array.from(values.entries()) as Array<[string, T]>,
    keys: async () => Array.from(values.keys()),
    set: async (key: string, value: unknown) => { values.set(key, value); },
    delete: async (key: string) => values.delete(key),
    save: vi.fn(async () => undefined),
  };
  return { values, store, load: vi.fn(async () => store) };
});

vi.mock('@tauri-apps/plugin-store', () => ({ Store: { load: fileStoreState.load } }));

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    delete (window as any).__TAURI_INTERNALS__;
    fileStoreState.values.clear();
    fileStoreState.load.mockClear();
    fileStoreState.store.save.mockClear();
  });

  const defaults: Partial<AppSettings> = {
    theme: 'system',
    density: 'standard',
    fontSize: 15,
    zoom: 100,
    accentColor: 'green',
    collapseLines: 12,
    commentSort: 'hot',
    infiniteScroll: true,
    autoPlayGif: true,
    imageQuality: 'hd',
  };

  it('loads default settings when localStorage is empty', () => {
    const store = useSettingsStore();
    expect(store.settings.theme).toBe(defaults.theme);
    expect(store.settings.fontSize).toBe(defaults.fontSize);
    expect(store.settings.accentColor).toBe(defaults.accentColor);
    expect(store.settings.imageQuality).toBe(defaults.imageQuality);
    expect(store.settings.navVisibility?.albums).toBe(true);
    expect(store.settings.navVisibility?.pictures).toBe(true);
  });

  it('normalizes malformed values and preserves valid nested settings', () => {
    const normalized = normalizeSettings({
      theme: 'invalid',
      fontSize: 999,
      zoom: 1,
      updateChannel: 'beta',
      experimentalFeatures: false,
      blockedKeywords: ['广告', '', '广告', 123],
      navVisibility: { albums: false, pictures: 'false' },
      deviceFingerprint: { customFingerprint: true, darkMode: '1' },
    });
    expect(normalized.theme).toBe('system');
    expect(normalized.fontSize).toBe(20);
    expect(normalized.zoom).toBe(50);
    expect(normalized.updateChannel).toBe('stable');
    expect(normalized.blockedKeywords).toEqual(['广告']);
    expect(normalized.navVisibility?.albums).toBe(false);
    expect(normalized.navVisibility?.pictures).toBe(true);
    expect(normalized.deviceFingerprint.customFingerprint).toBe(true);
    expect(normalized.deviceFingerprint.darkMode).toBe('1');
  });

  it('writes and restores every setting field through settings.json', async () => {
    (window as any).__TAURI_INTERNALS__ = {};
    const expected: AppSettings = {
      theme: 'dark',
      density: 'compact',
      feedLayout: 'double',
      fontSize: 18,
      zoom: 125,
      zoomManuallySet: true,
      sidebarCollapsed: true,
      reduceMotion: true,
      accentColor: 'violet',
      collapseLines: 18,
      commentSort: 'latest',
      infiniteScroll: false,
      autoPlayGif: false,
      showDeviceInfo: false,
      defaultHomeTab: 'dyh',
      homeTabOrder: ['dyh', 'hot', 'index_v8', 'digest', 'latest', 'cool_picture', 'secondhand', 'pictures'],
      downloadPath: 'D:\\Downloads',
      maxConcurrentDownloads: 8,
      autoCleanCache: false,
      cacheThresholdMB: 2000,
      cacheTtlDays: 30,
      cachePath: 'D:\\Cache',
      imageQuality: 'raw',
      navVisibility: {
        home: false, feeds: false, discover: false, apps: false, games: false, topics: false,
        reviews: false, secondhand: false, albums: false, pictures: false, notifications: false,
        favorites: false, history: false, messages: false, following: false,
      },
      checkUpdateOnStartup: false,
      ignoredUpdateVersion: '2.0.0',
      ignoreAllUpdates: true,
      closeToTray: true,
      autostart: true,
      startMinimized: true,
      alwaysOnTop: true,
      rememberWindowState: true,
      notifyReplies: false,
      notifyAt: false,
      notifyPm: false,
      desktopNotifications: true,
      notificationSound: false,
      notificationPollInterval: 30,
      externalLinkMode: 'system',
      timeDisplay: 'absolute',
      hideAdCards: true,
      blockedKeywords: ['广告', '抽奖'],
      publishDeviceSignature: false,
      deviceSignature: '我的设备',
      imageOpenMode: 'system',
      updateSpeedLimitKBps: 5120,
      proxyUrl: 'http://127.0.0.1:7890',
      notifyDownloadComplete: false,
      updateChannel: 'beta',
      experimentalFeatures: true,
      deviceFingerprint: {
        customFingerprint: true,
        model: 'TestModel',
        androidVersion: '15',
        build: 'TEST.1',
        appVersion: '16.3.0',
        appCode: '2604301',
        sdkInt: '35',
        locale: 'en-US',
        darkMode: '1',
      },
    };
    const first = useSettingsStore();
    await first.initializeSettings();
    Object.assign(first.settings, expected);
    await nextTick();
    await first.flushSettings();
    expect(Object.fromEntries(fileStoreState.values)).toEqual(expected);
    expect(fileStoreState.store.save).toHaveBeenCalled();

    setActivePinia(createPinia());
    const restored = useSettingsStore();
    await restored.initializeSettings();
    expect(restored.settings).toEqual(expected);
  });

  it('falls back to legacy localStorage when the JSON store cannot load', async () => {
    localStorage.setItem('coolapk_desktop_settings', JSON.stringify({ theme: 'dark', fontSize: 19 }));
    (window as any).__TAURI_INTERNALS__ = {};
    fileStoreState.load.mockRejectedValueOnce(new Error('store unavailable'));
    const store = useSettingsStore();
    await store.initializeSettings();
    expect(store.settings.theme).toBe('dark');
    expect(store.settings.fontSize).toBe(19);
  });

  it('setTheme updates theme in settings', () => {
    const store = useSettingsStore();
    store.setTheme('dark');
    expect(store.settings.theme).toBe('dark');
  });

  it('setTheme persists to localStorage across new store instances', async () => {
    const store = useSettingsStore();
    store.setTheme('dark');
    await nextTick();
    const saved = JSON.parse(localStorage.getItem('coolapk_desktop_settings')!);
    expect(saved.theme).toBe('dark');
  });

  it('toggleSidebar flips collapsed state', () => {
    const store = useSettingsStore();
    expect(store.settings.sidebarCollapsed).toBe(false);
    store.toggleSidebar();
    expect(store.settings.sidebarCollapsed).toBe(true);
    store.toggleSidebar();
    expect(store.settings.sidebarCollapsed).toBe(false);
  });

  it('setZoom clamps values to 50-200 range', () => {
    const store = useSettingsStore();
    store.setZoom(300);
    expect(store.settings.zoom).toBe(200);
    store.setZoom(10);
    expect(store.settings.zoom).toBe(50);
    store.setZoom(120);
    expect(store.settings.zoom).toBe(120);
    expect(store.settings.zoomManuallySet).toBe(true);
  });

  it('refreshAutoZoom only resets automatic zoom', () => {
    const store = useSettingsStore();
    store.settings.zoom = 150;
    store.settings.zoomManuallySet = false;
    store.refreshAutoZoom();
    expect(store.settings.zoom).toBe(100);
    store.settings.zoom = 160;
    store.settings.zoomManuallySet = true;
    store.refreshAutoZoom();
    expect(store.settings.zoom).toBe(160);
  });

  it('applies theme and zoom to the document when the app element exists', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const store = useSettingsStore();
    store.setTheme('dark');
    await nextTick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    store.setTheme('light');
    await nextTick();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    store.setZoom(125);
    await nextTick();
    const app = document.getElementById('app')!;
    expect(app.style.transform).toBe('scale(1.25)');
    expect(app.style.width).toBe('80vw');
  });

  it('setAccent changes accent color', () => {
    const store = useSettingsStore();
    store.setAccent('blue');
    expect(store.settings.accentColor).toBe('blue');
    store.setAccent('violet');
    expect(store.settings.accentColor).toBe('violet');
  });

  it('toggleNavVisibility toggles specific nav item', () => {
    const store = useSettingsStore();
    expect(store.settings.navVisibility?.home).toBe(true);
    store.toggleNavVisibility('home');
    expect(store.settings.navVisibility?.home).toBe(false);
    store.toggleNavVisibility('home');
    expect(store.settings.navVisibility?.home).toBe(true);
  });

  it('recreates navigation visibility when a legacy setting omits it', () => {
    const store = useSettingsStore();
    (store.settings as any).navVisibility = undefined;
    store.toggleNavVisibility('pictures');
    expect(store.settings.navVisibility?.pictures).toBe(false);
  });

  it('moveHomeTab persists the customized channel order', () => {
    const store = useSettingsStore();
    store.settings.homeTabOrder = ['index_v8', 'digest'];
    const first = store.settings.homeTabOrder[0];
    const second = store.settings.homeTabOrder[1];
    store.moveHomeTab(second, -1);
    expect(store.settings.homeTabOrder.slice(0, 2)).toEqual([second, first]);
    store.resetHomeTabOrder();
    expect(store.settings.homeTabOrder).toEqual([]);
  });

  it('ignoreUpdateVersion sets the ignored version', () => {
    const store = useSettingsStore();
    store.ignoreUpdateVersion('2.0.0');
    expect(store.settings.ignoredUpdateVersion).toBe('2.0.0');
  });

  it('setIgnoreAllUpdates toggles update ignoring', () => {
    const store = useSettingsStore();
    store.setIgnoreAllUpdates(true);
    expect(store.settings.ignoreAllUpdates).toBe(true);
    store.setIgnoreAllUpdates(false);
    expect(store.settings.ignoreAllUpdates).toBe(false);
  });

  it('resetUpdateNotifications clears update ignore state', () => {
    const store = useSettingsStore();
    store.ignoreUpdateVersion('2.0.0');
    store.setIgnoreAllUpdates(true);
    store.resetUpdateNotifications();
    expect(store.settings.ignoredUpdateVersion).toBe('');
    expect(store.settings.ignoreAllUpdates).toBe(false);
  });
});
