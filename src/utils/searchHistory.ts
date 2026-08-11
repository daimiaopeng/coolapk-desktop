import { ref } from 'vue';
import { readTauriStoreValue, writeTauriStoreValue } from './tauriStore';

const STORE_FILE = 'search_history.json';
const STORE_KEY = 'history';
const LEGACY_STORAGE_KEY = 'coolapk-desktop-search-history';
const MAX_HISTORY = 20;

function normalizeHistory(value: unknown): string[] {
  try {
    const parsed = Array.isArray(value) ? value : [];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))].slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export const searchHistory = ref<string[]>([]);
let loadPromise: Promise<void> | null = null;

export function loadSearchHistory(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const stored = await readTauriStoreValue<unknown>(STORE_FILE, STORE_KEY);
    if (stored !== undefined) {
      searchHistory.value = normalizeHistory(stored);
      return;
    }

    let legacy: string[] = [];
    try {
      legacy = normalizeHistory(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]'));
    } catch {
      // 浏览器存储不可用时直接从空历史开始。
    }
    searchHistory.value = legacy;
    await writeTauriStoreValue(STORE_FILE, STORE_KEY, legacy);
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // 忽略旧数据清理失败。
    }
  })().catch((error) => {
    console.warn('加载搜索历史失败:', error);
    searchHistory.value = [];
  });
  return loadPromise;
}

void loadSearchHistory();

function persist() {
  void writeTauriStoreValue(STORE_FILE, STORE_KEY, searchHistory.value);
}

export function addSearchHistory(value: string): void {
  const query = value.trim();
  if (!query) return;
  searchHistory.value = [query, ...searchHistory.value.filter((item) => item !== query)].slice(0, MAX_HISTORY);
  persist();
}

export function removeSearchHistory(value: string): void {
  searchHistory.value = searchHistory.value.filter((item) => item !== value);
  persist();
}

export function clearSearchHistory(): void {
  searchHistory.value = [];
  persist();
}
