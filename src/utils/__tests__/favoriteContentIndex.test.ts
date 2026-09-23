import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  getCollectionList: vi.fn(),
  getCollectionItemList: vi.fn(),
  getFeedDetail: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getCollectionList: mocks.getCollectionList,
    getCollectionItemList: mocks.getCollectionItemList,
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
    mocks.getCollectionList.mockReset();
    mocks.getCollectionItemList.mockReset();
    mocks.getFeedDetail.mockReset();
    mocks.getCollectionList.mockImplementation(async (_uid: string, page: number) => ({
      data: page === 1 ? [{ id: 'default', entityId: 'collection-default' }] : [],
    }));
    mocks.getCollectionItemList.mockResolvedValue({ data: [] });
    clearFavoriteContentIndexMemoryCache();
  });

  it('在更新标记变化时重新抓取旧收藏的完整正文', async () => {
    let version = 1;
    mocks.getCollectionItemList.mockImplementation(async (_collectionId: string, page: number) => {
      if (page !== 1) return { data: [] };
      return { data: [{ id: '100', entityId: '100', message: '摘要…查看更多', lastupdate: String(version) }] };
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

  it('多页同步时收藏单分页始终使用第一页首项作为 firstItem', async () => {
    mocks.getCollectionItemList.mockImplementation(async (_collectionId: string, page: number) => {
      if (page === 1) return { data: [{ id: '300', entityId: '300', message: '摘要' }, { id: '290', entityId: '290', message: '摘要' }] };
      if (page === 2) return { data: [{ id: '280', entityId: '280', message: '摘要' }] };
      return { data: [] };
    });
    mocks.getFeedDetail.mockImplementation(async (id: string) => ({ data: { id, message: `完整正文 ${id}` } }));

    const result = await syncFavoriteContentIndex('42');

    expect(result.total).toBe(3);
    expect(result.complete).toBe(true);
    expect(mocks.getCollectionItemList.mock.calls).toEqual([
      ['default', 1, '', ''],
      ['default', 2, '300', '290'],
      ['default', 3, '300', '280'],
    ]);
  });
});
