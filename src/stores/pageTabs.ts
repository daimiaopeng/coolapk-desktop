import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { RouteLocationNormalizedLoaded, RouteLocationNormalized } from 'vue-router';
import { describePageTab, getPageTabId, type PageTabDescriptor } from '../utils/pageTabs';

export interface PageTab extends PageTabDescriptor {
  generation: number;
  pinned: boolean;
  favorite: boolean;
}

export interface SavedPageTab {
  id: string;
  route: string;
  title: string;
  icon: string;
  pinned: boolean;
  favorite: boolean;
  order: number;
}

const STORAGE_KEY = 'coolapk_page_tabs_v1';
const homeTab: PageTab = { id: 'home', route: '/', title: '首页', icon: 'fas fa-house', closable: false, generation: 0, pinned: true, favorite: false };

function loadSavedPages(): SavedPageTab[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedPageTab => Boolean(item && typeof item.id === 'string' && typeof item.route === 'string' && item.route.startsWith('/') && typeof item.title === 'string' && typeof item.icon === 'string' && (item.pinned || item.favorite))).slice(0, 100).map((item, index) => ({ ...item, pinned: Boolean(item.pinned), favorite: Boolean(item.favorite), order: Number.isFinite(item.order) ? item.order : index }));
  } catch {
    return [];
  }
}

export const usePageTabsStore = defineStore('pageTabs', () => {
  const savedPages = ref<SavedPageTab[]>(loadSavedPages());
  const restoredTabs = savedPages.value.filter((page) => page.pinned).sort((a, b) => a.order - b.order).map<PageTab>((page) => ({ ...page, closable: false, generation: 0 }));
  const savedHomeOrder = savedPages.value.find((page) => page.id === 'home')?.order ?? 0;
  const tabs = ref<PageTab[]>([{ ...homeTab }, ...restoredTabs.filter((tab) => tab.id !== 'home')].sort((a, b) => (a.id === 'home' ? savedHomeOrder : savedPages.value.find((page) => page.id === a.id)?.order ?? 0) - (b.id === 'home' ? savedHomeOrder : savedPages.value.find((page) => page.id === b.id)?.order ?? 0)));
  const activeId = ref('home');
  const generations = ref<Record<string, number>>({});
  const activationHistory = ref<string[]>(['home']);

  const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeId.value) || tabs.value[0]);
  const favoritePages = computed(() => savedPages.value.filter((page) => page.favorite).sort((a, b) => a.order - b.order));

  function persistSavedPages() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPages.value));
    } catch (error) {
      console.warn('保存页面标签失败:', error);
    }
  }

  function rememberActivation(id: string) {
    activationHistory.value = [...activationHistory.value.filter((item) => item !== id), id];
  }

  function syncSavedFromTab(tab: PageTab) {
    const savedIndex = savedPages.value.findIndex((page) => page.id === tab.id);
    if (!tab.pinned && !tab.favorite) {
      if (savedIndex >= 0) savedPages.value.splice(savedIndex, 1);
      persistSavedPages();
      return;
    }
    const next: SavedPageTab = { id: tab.id, route: tab.route, title: tab.title, icon: tab.icon, pinned: tab.pinned, favorite: tab.favorite, order: savedIndex >= 0 ? savedPages.value[savedIndex].order : tabs.value.indexOf(tab) };
    if (savedIndex >= 0) savedPages.value[savedIndex] = next;
    else savedPages.value.push(next);
    persistSavedPages();
  }

  function syncRoute(route: RouteLocationNormalizedLoaded | RouteLocationNormalized) {
    const descriptor = describePageTab(route);
    const saved = savedPages.value.find((page) => page.id === descriptor.id);
    const existing = tabs.value.find((tab) => tab.id === descriptor.id);
    if (existing) {
      existing.route = descriptor.route;
      if (existing.title === '页面' || existing.title.startsWith('用户 ') || existing.title.startsWith('动态 ')) existing.title = descriptor.title;
      existing.icon = descriptor.icon;
      if (saved) syncSavedFromTab(existing);
    } else {
      tabs.value.push({ ...descriptor, title: saved?.title || descriptor.title, icon: saved?.icon || descriptor.icon, closable: descriptor.closable && !saved?.pinned, generation: generations.value[descriptor.id] || 0, pinned: Boolean(saved?.pinned), favorite: Boolean(saved?.favorite) });
    }
    activeId.value = descriptor.id;
    rememberActivation(descriptor.id);
  }

  function activate(id: string): string | null {
    const tab = tabs.value.find((item) => item.id === id);
    if (!tab) return null;
    activeId.value = id;
    rememberActivation(id);
    return tab.route;
  }

  function openSaved(id: string): string | null {
    const existing = tabs.value.find((tab) => tab.id === id);
    if (existing) return activate(id);
    const saved = savedPages.value.find((page) => page.id === id);
    if (!saved) return null;
    tabs.value.push({ ...saved, closable: !saved.pinned, generation: generations.value[id] || 0 });
    return activate(id);
  }

  function close(id: string): string | null {
    const index = tabs.value.findIndex((tab) => tab.id === id);
    if (index < 0 || !tabs.value[index].closable) return null;
    const wasActive = activeId.value === id;
    generations.value[id] = (generations.value[id] || tabs.value[index].generation) + 1;
    tabs.value.splice(index, 1);
    activationHistory.value = activationHistory.value.filter((item) => item !== id);
    if (!wasActive) return null;
    const recentId = [...activationHistory.value].reverse().find((item) => tabs.value.some((tab) => tab.id === item));
    const fallback = tabs.value[Math.min(index, tabs.value.length - 1)] || tabs.value[0];
    const next = tabs.value.find((tab) => tab.id === recentId) || fallback;
    activeId.value = next.id;
    rememberActivation(next.id);
    return next.route;
  }

  function closeOthers(id: string): string | null {
    const target = tabs.value.find((tab) => tab.id === id);
    if (!target) return null;
    tabs.value.filter((tab) => tab.closable && tab.id !== id).forEach((tab) => { generations.value[tab.id] = (generations.value[tab.id] || tab.generation) + 1; });
    tabs.value = tabs.value.filter((tab) => !tab.closable || tab.id === id);
    activationHistory.value = activationHistory.value.filter((item) => tabs.value.some((tab) => tab.id === item));
    activeId.value = id;
    rememberActivation(id);
    return target.route;
  }

  function closeRight(id: string): string | null {
    const index = tabs.value.findIndex((tab) => tab.id === id);
    if (index < 0) return null;
    const removed = tabs.value.slice(index + 1).filter((tab) => tab.closable);
    removed.forEach((tab) => { generations.value[tab.id] = (generations.value[tab.id] || tab.generation) + 1; });
    const removedIds = new Set(removed.map((tab) => tab.id));
    tabs.value = tabs.value.filter((tab, tabIndex) => tabIndex <= index || !tab.closable);
    activationHistory.value = activationHistory.value.filter((item) => !removedIds.has(item));
    if (!removedIds.has(activeId.value)) return null;
    activeId.value = id;
    rememberActivation(id);
    return tabs.value.find((tab) => tab.id === id)?.route || '/';
  }

  function cycle(direction: 1 | -1): string | null {
    if (tabs.value.length < 2) return null;
    const index = tabs.value.findIndex((tab) => tab.id === activeId.value);
    const nextIndex = (index + direction + tabs.value.length) % tabs.value.length;
    return activate(tabs.value[nextIndex].id);
  }

  /** 拖动标签时只改变显示顺序，不改变当前页和最近访问顺序；固定标签的启动顺序同步保存。 */
  function move(draggedId: string, targetId: string, placeAfter: boolean) {
    if (draggedId === targetId) return;
    const draggedIndex = tabs.value.findIndex((tab) => tab.id === draggedId);
    if (draggedIndex < 0 || !tabs.value.some((tab) => tab.id === targetId)) return;
    const [dragged] = tabs.value.splice(draggedIndex, 1);
    const targetIndex = tabs.value.findIndex((tab) => tab.id === targetId);
    tabs.value.splice(targetIndex + (placeAfter ? 1 : 0), 0, dragged);
    tabs.value.forEach((tab, order) => {
      let saved = savedPages.value.find((page) => page.id === tab.id);
      if (tab.id === 'home' && !saved) {
        saved = { id: homeTab.id, route: homeTab.route, title: homeTab.title, icon: homeTab.icon, pinned: true, favorite: false, order };
        savedPages.value.push(saved);
      }
      if (saved?.pinned) saved.order = order;
    });
    persistSavedPages();
  }

  function toggleFavorite(id: string): boolean {
    const tab = tabs.value.find((item) => item.id === id);
    if (!tab || id === 'home') return false;
    tab.favorite = !tab.favorite;
    syncSavedFromTab(tab);
    return tab.favorite;
  }

  function removeFavorite(id: string) {
    const tab = tabs.value.find((item) => item.id === id);
    if (tab) {
      tab.favorite = false;
      syncSavedFromTab(tab);
      return;
    }
    const saved = savedPages.value.find((item) => item.id === id);
    if (!saved) return;
    saved.favorite = false;
    if (!saved.pinned) savedPages.value = savedPages.value.filter((item) => item.id !== id);
    persistSavedPages();
  }

  function togglePin(id: string): boolean {
    const tab = tabs.value.find((item) => item.id === id);
    if (!tab || id === 'home') return false;
    tab.pinned = !tab.pinned;
    tab.closable = !tab.pinned;
    syncSavedFromTab(tab);
    return tab.pinned;
  }

  function updateTitle(id: string, title: string) {
    const normalized = title.trim();
    const tab = tabs.value.find((item) => item.id === id);
    if (!tab || !normalized) return;
    tab.title = normalized.length > 28 ? `${normalized.slice(0, 27)}…` : normalized;
    if (tab.pinned || tab.favorite) syncSavedFromTab(tab);
  }

  function getGeneration(route: RouteLocationNormalizedLoaded | RouteLocationNormalized): number {
    const id = getPageTabId(route);
    return tabs.value.find((tab) => tab.id === id)?.generation || generations.value[id] || 0;
  }

  return { tabs, activeId, activeTab, favoritePages, syncRoute, activate, openSaved, close, closeOthers, closeRight, cycle, move, toggleFavorite, removeFavorite, togglePin, updateTitle, getGeneration };
});
