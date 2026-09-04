import { ref } from 'vue';
import { EMOJI_MAP } from './coolapkEmoji';
import { readTauriStoreValue, writeTauriStoreValue } from './tauriStore';

const STORE_FILE = 'recent_emojis.json';
const STORE_KEY = 'recent_emojis';
const LEGACY_STORAGE_KEY = 'coolapk_recent_emojis';
const MAX_RECENT = 16;
const SYNC_EVENT = 'coolapk:recent-emojis-updated';

function normalizeRecentEmojis(value: unknown): string[] {
  try {
    const list = Array.isArray(value) ? value : [];
    return list
      .filter((item): item is string => typeof item === 'string' && !!EMOJI_MAP[item])
      .filter((item, index, self) => self.indexOf(item) === index)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export const recentEmojis = ref<string[]>([]);
let loadPromise: Promise<void> | null = null;

/**
 * 从磁盘（Tauri Store JSON文件）以及本地缓存加载最近使用表情
 */
export function loadRecentEmojis(forceReload = false): Promise<void> {
  if (loadPromise && !forceReload) return loadPromise;

  loadPromise = (async () => {
    // 1. 先尝试从本地 localStorage 快速读取，避免界面闪烁
    let cachedList: string[] = [];
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        cachedList = normalizeRecentEmojis(JSON.parse(raw));
        if (cachedList.length > 0 && recentEmojis.value.length === 0) {
          recentEmojis.value = cachedList;
        }
      }
    } catch {
      // 忽略
    }

    // 2. 从 Tauri 独立持久化存储文件 recent_emojis.json 读取
    try {
      const stored = await readTauriStoreValue<unknown>(STORE_FILE, STORE_KEY);
      if (stored !== undefined) {
        const parsed = normalizeRecentEmojis(stored);
        recentEmojis.value = parsed;
        // 同步回 localStorage
        try {
          localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
          // 忽略
        }
        return;
      }
    } catch (err) {
      console.warn('从 Tauri 存储加载 recent_emojis.json 失败:', err);
    }

    // 3. 如果 Tauri 存储为空但 localStorage 有数据，迁移存入 Tauri 存储
    if (cachedList.length > 0) {
      recentEmojis.value = cachedList;
      try {
        await writeTauriStoreValue(STORE_FILE, STORE_KEY, cachedList);
      } catch {
        // 忽略
      }
    }
  })().catch((error) => {
    console.warn('加载最近使用表情失败:', error);
  });

  return loadPromise;
}

// 应用启动时自动触发磁盘数据恢复
void loadRecentEmojis();

/**
 * 同步持久化到磁盘与本地缓存
 */
function persist(updated: string[]) {
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // 忽略
  }
  void writeTauriStoreValue(STORE_FILE, STORE_KEY, updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: updated }));
  }
}

/**
 * 获取当前的最近使用表情（同步返回）
 */
export function getRecentEmojis(): string[] {
  if (recentEmojis.value.length > 0) {
    return recentEmojis.value;
  }
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    return normalizeRecentEmojis(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * 记录一次表情使用（排重并置顶，持久化至磁盘与 localStorage）
 */
export function recordRecentEmoji(name: string): void {
  if (!name || !EMOJI_MAP[name]) return;
  const list = [name, ...recentEmojis.value.filter((item) => item !== name)].slice(0, MAX_RECENT);
  recentEmojis.value = list;
  persist(list);
}

/**
 * 清空最近使用表情
 */
export function clearRecentEmojis(): void {
  recentEmojis.value = [];
  persist([]);
}

/**
 * Vue 响应式组合式函数，统一多组件状态联动
 */
export function useRecentEmojis(): {
  recentEmojis: typeof recentEmojis;
  addRecent: (name: string) => void;
  loadRecentEmojis: typeof loadRecentEmojis;
} {
  // 确保已触发磁盘加载
  void loadRecentEmojis();

  const addRecent = (name: string) => {
    recordRecentEmoji(name);
  };

  return {
    recentEmojis,
    addRecent,
    loadRecentEmojis,
  };
}
