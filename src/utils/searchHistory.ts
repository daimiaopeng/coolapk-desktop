import { ref } from 'vue';

const STORAGE_KEY = 'coolapk-desktop-search-history';
const MAX_HISTORY = 20;

function loadHistory(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))].slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export const searchHistory = ref<string[]>(loadHistory());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searchHistory.value));
  } catch {
    // 本地存储不可用时仍允许正常执行搜索。
  }
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
