import { beforeEach, describe, expect, it } from 'vitest';
import { addSearchHistory, clearSearchHistory, loadSearchHistory, removeSearchHistory, searchHistory } from '../searchHistory';

describe('searchHistory', () => {
  beforeEach(async () => {
    localStorage.clear();
    searchHistory.value = [];
    await loadSearchHistory();
    clearSearchHistory();
  });

  it('按最近使用顺序保存并去重', async () => {
    addSearchHistory('小米');
    addSearchHistory('  酷安  ');
    addSearchHistory('小米');
    expect(searchHistory.value).toEqual(['小米', '酷安']);
    await new Promise((resolve) => setTimeout(resolve, 0));
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
