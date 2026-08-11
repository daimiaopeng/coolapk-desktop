import { beforeEach, describe, expect, it } from 'vitest';
import { addSearchHistory, clearSearchHistory, removeSearchHistory, searchHistory } from '../searchHistory';

describe('searchHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    searchHistory.value = [];
  });

  it('按最近使用顺序保存并去重', () => {
    addSearchHistory('小米');
    addSearchHistory('  酷安  ');
    addSearchHistory('小米');
    expect(searchHistory.value).toEqual(['小米', '酷安']);
    expect(JSON.parse(localStorage.getItem('coolapk-desktop-search-history') || '[]')).toEqual(['小米', '酷安']);
  });

  it('支持删除和清空记录', () => {
    addSearchHistory('小米');
    addSearchHistory('酷安');
    removeSearchHistory('小米');
    expect(searchHistory.value).toEqual(['酷安']);
    clearSearchHistory();
    expect(searchHistory.value).toEqual([]);
  });
});
