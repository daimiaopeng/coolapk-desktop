import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  getFavoriteList: vi.fn(),
  getFeedDetail: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFavoriteList: mocks.getFavoriteList,
    getFeedDetail: mocks.getFeedDetail,
  },
}));

vi.mock('../tauriStore', () => ({
  readTauriStoreValue: vi.fn(async (_fileName: string, key: string) => mocks.values.get(key)),
  writeTauriStoreValue: vi.fn(async (_fileName: string, key: string, value: unknown) => { mocks.values.set(key, value); }),
}));

import {
  clearFavoriteContentIndexMemoryCache,
  searchFavoriteContentIndex,
  syncFavoriteContentIndex,
} from '../favoriteContentIndex';

describe('favorite content index', () => {
  beforeEach(() => {
    mocks.values.clear();
    mocks.getFavoriteList.mockReset();
    mocks.getFeedDetail.mockReset();
    clearFavoriteContentIndexMemoryCache();
  });

  it('在更新标记变化时重新抓取旧收藏的完整正文', async () => {
    let version = 1;
    mocks.getFavoriteList.mockImplementation(async (_type: string, page: number) => {
      if (page !== 1) return { data: [] };
      return { data: [{ id: '100', message: '摘要…查看更多', lastupdate: String(version) }] };
    });
    mocks.getFeedDetail.mockImplementation(async () => ({
      data: { id: '100', title: '旧收藏', message: version === 1 ? '初版正文' : '编辑后的正文', lastupdate: String(version) },
    }));

    await syncFavoriteContentIndex('42');
    expect(await searchFavoriteContentIndex('42', '初版正文')).toHaveLength(1);

    version = 2;
    const result = await syncFavoriteContentIndex('42');
    expect(result.updated).toBe(1);
    expect(await searchFavoriteContentIndex('42', '编辑后的正文')).toHaveLength(1);
    expect(await searchFavoriteContentIndex('42', '初版正文')).toHaveLength(0);
    expect(mocks.getFeedDetail).toHaveBeenCalledTimes(2);
  });
});
