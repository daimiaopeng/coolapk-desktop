import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCollectionItemList: vi.fn(),
  getCollectionList: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getCollectionItemList: mocks.getCollectionItemList,
    getCollectionList: mocks.getCollectionList,
  },
}));

import { loadAllFavoriteFeeds } from '../favoriteFeeds';

describe('favorite feeds', () => {
  beforeEach(() => {
    mocks.getCollectionItemList.mockReset();
    mocks.getCollectionList.mockReset();
  });

  it('遍历所有收藏单并按发布时间排序，固定首项游标并更新末项游标', async () => {
    mocks.getCollectionList.mockImplementation(async (_uid: string, page: number) => {
      if (page === 1) return { data: [{ id: 'default', entityId: 'collection-100' }, { id: 'created', entityId: 'collection-90' }] };
      return { data: [] };
    });
    mocks.getCollectionItemList.mockImplementation(async (collectionId: string, page: number) => {
      if (collectionId === 'default' && page === 1) return { data: [{ id: 'feed-500', entityId: '500', dateline: 50 }, { id: 'feed-490', entityId: '490', dateline: 40 }] };
      if (collectionId === 'default' && page === 2) return { data: [{ id: 'feed-480', entityId: '480', dateline: 30 }] };
      if (collectionId === 'created' && page === 1) return { data: [{ id: 'feed-470', entityId: '470', dateline: 60 }, { id: 'feed-500', entityId: '500', dateline: 50 }] };
      return { data: [] };
    });

    const result = await loadAllFavoriteFeeds();

    expect(result).toEqual({ feeds: [{ id: 'feed-470', entityId: '470', dateline: 60 }, { id: 'feed-500', entityId: '500', dateline: 50 }, { id: 'feed-490', entityId: '490', dateline: 40 }, { id: 'feed-480', entityId: '480', dateline: 30 }], complete: true });
    expect(mocks.getCollectionList.mock.calls).toEqual([
      ['', 1, '', ''],
      ['', 2, 'collection-100', 'collection-90'],
    ]);
    expect(mocks.getCollectionItemList.mock.calls).toEqual([
      ['default', 1, '', ''],
      ['default', 2, '500', '490'],
      ['default', 3, '500', '480'],
      ['created', 1, '', ''],
      ['created', 2, '470', '500'],
    ]);
  });
});
