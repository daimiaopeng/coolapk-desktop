import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import type { AppSettings } from '../../types/settings';

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
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
