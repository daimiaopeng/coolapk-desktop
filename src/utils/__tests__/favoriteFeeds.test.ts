import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getFavoriteList: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFavoriteList: mocks.getFavoriteList,
  },
}));

import { loadAllFavoriteFeeds } from '../favoriteFeeds';

describe('favorite feeds', () => {
  beforeEach(() => {
    mocks.getFavoriteList.mockReset();
  });

  it('遍历时固定第一页首项并更新末项游标', async () => {
    mocks.getFavoriteList.mockImplementation(async (_type: string, page: number) => {
      if (page === 1) return { data: [{ id: '500' }, { id: '490' }] };
      if (page === 2) return { data: [{ id: '480' }, { id: '470' }] };
      return { data: [] };
    });

    const result = await loadAllFavoriteFeeds();

    expect(result).toEqual({ feeds: [{ id: '500' }, { id: '490' }, { id: '480' }, { id: '470' }], complete: true });
    expect(mocks.getFavoriteList.mock.calls).toEqual([
      ['feed', 1, '', ''],
      ['feed', 2, '500', '490'],
      ['feed', 3, '500', '470'],
    ]);
  });
});
