import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRecentEmojis, recordRecentEmoji, clearRecentEmojis, recentEmojis, loadRecentEmojis } from '../recentEmojis';
import { EMOJI_MAP } from '../coolapkEmoji';
import * as tauriStore from '../tauriStore';

describe('recentEmojis', () => {
  beforeEach(() => {
    localStorage.clear();
    clearRecentEmojis();
    vi.restoreAllMocks();
  });

  it('初始状态返回空数组', () => {
    expect(getRecentEmojis()).toEqual([]);
  });

  it('记录表情并排重置顶，同时写入 localStorage', () => {
    recordRecentEmoji('doge');
    recordRecentEmoji('哈哈哈');
    expect(getRecentEmojis()).toEqual(['哈哈哈', 'doge']);
    expect(JSON.parse(localStorage.getItem('coolapk_recent_emojis') || '[]')).toEqual(['哈哈哈', 'doge']);

    // 再次记录 doge，应移动到第一位
    recordRecentEmoji('doge');
    expect(getRecentEmojis()).toEqual(['doge', '哈哈哈']);
    expect(JSON.parse(localStorage.getItem('coolapk_recent_emojis') || '[]')).toEqual(['doge', '哈哈哈']);
  });

  it('忽略不存在的表情', () => {
    recordRecentEmoji('non_existent_emoji_123');
    expect(getRecentEmojis()).toEqual([]);
  });

  it('支持清空', () => {
    recordRecentEmoji('doge');
    clearRecentEmojis();
    expect(getRecentEmojis()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('coolapk_recent_emojis') || '[]')).toEqual([]);
  });

  it('限制最大数量不超过 16 个', () => {
    const allKeys = Object.keys(EMOJI_MAP).slice(0, 20);
    for (const key of allKeys) {
      recordRecentEmoji(key);
    }
    const recents = getRecentEmojis();
    expect(recents.length).toBeLessThanOrEqual(16);
    expect(recents[0]).toBe(allKeys[allKeys.length - 1]);
  });

  it('从 Tauri 存储加载历史表情并在内存为空时恢复持久化数据', async () => {
    vi.spyOn(tauriStore, 'readTauriStoreValue').mockResolvedValueOnce(['针不戳', 'yyds', 'doge']);
    recentEmojis.value = [];
    await loadRecentEmojis(true);
    expect(recentEmojis.value).toEqual(['针不戳', 'yyds', 'doge']);
    expect(JSON.parse(localStorage.getItem('coolapk_recent_emojis') || '[]')).toEqual(['针不戳', 'yyds', 'doge']);
  });
});
