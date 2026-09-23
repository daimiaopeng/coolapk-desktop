import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  feeds: ['200', '100'],
  getFavoriteList: vi.fn(),
  getCollectionList: vi.fn(),
  getCollectionItemList: vi.fn(),
  getFeedDetail: vi.fn(),
  getFeedReplies: vi.fn(),
  getSubReplies: vi.fn(),
  getImageDataUrl: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFavoriteList: mocks.getFavoriteList,
    getCollectionList: mocks.getCollectionList,
    getCollectionItemList: mocks.getCollectionItemList,
    getFeedDetail: mocks.getFeedDetail,
    getFeedReplies: mocks.getFeedReplies,
    getSubReplies: mocks.getSubReplies,
    getImageDataUrl: mocks.getImageDataUrl,
  },
}));

vi.mock('../tauriStore', () => ({
  readTauriStoreValue: vi.fn(async (_file: string, key: string) => mocks.values.get(key)),
  writeTauriStoreValue: vi.fn(async (_file: string, key: string, value: unknown) => { mocks.values.set(key, value); }),
}));

import { buildFavoriteExport, favoriteExportToHtml, favoriteExportToText, saveFavoriteExportSnapshot } from '../favoriteExport';

describe('favorite export', () => {
  beforeEach(() => {
    mocks.values.clear();
    mocks.feeds = ['200', '100'];
    mocks.getFavoriteList.mockReset();
    mocks.getCollectionList.mockReset();
    mocks.getCollectionItemList.mockReset();
    mocks.getFeedDetail.mockReset();
    mocks.getFeedReplies.mockReset();
    mocks.getSubReplies.mockReset();
    mocks.getImageDataUrl.mockReset();
    mocks.getImageDataUrl.mockResolvedValue('data:image/jpeg;base64,YWJj');
    mocks.getCollectionList.mockImplementation(async (_uid: string, page: number) => ({
      data: page === 1 ? [{ id: 'default', entityId: 'collection-default' }] : [],
    }));
    mocks.getCollectionItemList.mockImplementation(async (collectionId: string, page: number) => ({
      data: collectionId === 'default' && page === 1 ? mocks.feeds.map(id => ({ id, entityId: id, message: `摘要 ${id}…查看更多` })) : [],
    }));
    mocks.getFeedDetail.mockImplementation(async (id: string) => ({
      data: { id, title: `标题 ${id}`, username: '作者', uid: '9', userAvatar: 'https://avatar.coolapk.com/data/000/00/00/09_avatar_middle.jpg', message: `完整正文 ${id} [doge]`, pic: `https://image.coolapk.com/${id}.jpg` },
    }));
  });

  it('生成完整正文、三种格式并记录新增项目', async () => {
    const bundle = await buildFavoriteExport('42', {
      includeAllComments: false,
      includeAuthorComments: false,
      includePinnedComments: false,
      includeAuthorReplies: false,
    });

    expect(bundle.summary).toMatchObject({ total: 2, contentComplete: 2, contentFailed: 0 });
    expect(bundle.diff.added).toEqual(['100', '200']);
    expect(JSON.stringify(bundle.items)).not.toContain('查看更多');
    expect(favoriteExportToText(bundle)).toContain('完整正文 200');
    const savedUrls: string[] = [];
    const savedKinds: string[] = [];
    const html = await favoriteExportToHtml(bundle, {
      imageQuality: 'hd',
      saveImage: async (url, index, _total, kind) => {
        savedUrls.push(url);
        savedKinds.push(kind);
        return `${kind === 'emoji' ? 'emojis' : 'images'}/${kind}_${index + 1}.jpg`;
      },
    });
    expect(html).toContain('src="images/image_');
    expect(html).toContain('src="emojis/emoji_');
    expect(html).not.toContain('data:image/');
    expect(savedUrls).toContain('https://image.coolapk.com/200.jpg.m.jpg');
    expect(savedKinds).toContain('image');
    expect(savedKinds).toContain('emoji');
    expect(savedKinds).toContain('avatar');
  });

  it('通过上次快照区分取消收藏的帖子', async () => {
    const options = { includeAllComments: false, includeAuthorComments: false, includePinnedComments: false, includeAuthorReplies: false };
    await saveFavoriteExportSnapshot(await buildFavoriteExport('42', options));
    mocks.feeds = ['200'];

    const bundle = await buildFavoriteExport('42', options);

    expect(bundle.diff.removedFromFavorites.map(item => item.id)).toEqual(['100']);
    expect(bundle.diff.unavailable).toEqual([]);
  });

  it('按收藏单独立分页、导出和保存差异快照', async () => {
    mocks.getCollectionItemList.mockImplementation(async (collectionId: string, page: number) => ({
      data: page === 1
        ? [{ id: `${collectionId}-2`, message: '摘要 2' }, { id: `${collectionId}-1`, message: '摘要 1' }]
        : [],
    }));

    const options = { includeAllComments: false, includeAuthorComments: false, includePinnedComments: false, includeAuthorReplies: false };
    const source = { type: 'collection' as const, id: '88', title: '旅行收藏' };
    const bundle = await buildFavoriteExport('42', options, undefined, source);

    expect(mocks.getFavoriteList).not.toHaveBeenCalled();
    expect(mocks.getCollectionItemList).toHaveBeenNthCalledWith(1, '88', 1);
    expect(mocks.getCollectionItemList).toHaveBeenNthCalledWith(2, '88', 2);
    expect(bundle.source).toEqual(source);
    expect(bundle.summary.total).toBe(2);
    expect(favoriteExportToText(bundle)).toContain('酷安收藏导出：旅行收藏');
    expect(await favoriteExportToHtml(bundle)).toContain('酷安收藏导出：旅行收藏');

    await saveFavoriteExportSnapshot(bundle);
    expect(mocks.values.has('account:42:collection:88')).toBe(true);
    expect(mocks.values.has('account:42')).toBe(false);
  });

  it('可导出作者评论、置顶评论和楼主回复且去重', async () => {
    mocks.feeds = ['200'];
    mocks.getFeedReplies.mockImplementation(async (_feedId: string, page: number, options: any) => {
      if (page > 1) return { data: [] };
      if (options.fromFeedAuthor === 1) return { data: [{ id: 'a', uid: '9', username: '作者', message: '作者评论' }] };
      return { data: [{ id: 'a', uid: '9', username: '作者', message: '作者评论', isTop: 1 }, { id: 'b', uid: '8', username: '用户', message: '置顶评论', isTop: 1 }] };
    });
    mocks.getSubReplies.mockImplementation(async (_feedId: string, replyId: string, page: number) => ({
      data: page === 1 ? [{ id: `${replyId}-1`, uid: '9', message: '楼主回复' }, { id: `${replyId}-2`, uid: '8', message: '其他回复' }] : [],
    }));

    const bundle = await buildFavoriteExport('42', {
      includeAllComments: false,
      includeAuthorComments: true,
      includePinnedComments: true,
      includeAuthorReplies: true,
    });

    expect(bundle.items[0].comments).toHaveLength(2);
    expect(bundle.items[0].comments.find(item => item.id === 'a').exportType).toBe('author,pinned');
    expect(bundle.items[0].comments.every(item => item.replies.length === 1)).toBe(true);
    const html = await favoriteExportToHtml(bundle);
    expect(html).toContain('class="feed-card"');
    expect(html).toContain('class="feed-comment-section"');
    expect(html).toContain('class="comment-sort"');
    expect(html).toContain('class="sub-reply-thread"');
    expect(html).toContain('<details');
    expect(html).not.toContain('comment-composer-box');
  });

  it('导出所有评论时包含全部一级评论及楼中楼回复', async () => {
    mocks.feeds = ['200'];
    mocks.getFeedReplies.mockImplementation(async (_feedId: string, page: number) => ({
      data: page === 1 ? [{ id: 'a', uid: '8', message: '普通评论' }] : [],
    }));
    mocks.getSubReplies.mockImplementation(async (_feedId: string, replyId: string, page: number) => ({
      data: page === 1 ? [{ id: `${replyId}-1`, uid: '7', message: '普通回复' }] : [],
    }));

    const bundle = await buildFavoriteExport('42', {
      includeAllComments: true,
      includeAuthorComments: false,
      includePinnedComments: false,
      includeAuthorReplies: false,
    });

    expect(bundle.items[0].comments).toHaveLength(1);
    expect(bundle.items[0].comments[0].replies).toHaveLength(1);
  });

  it('收到取消信号后停止导出', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(buildFavoriteExport('42', {
      includeAllComments: false,
      includeAuthorComments: false,
      includePinnedComments: false,
      includeAuthorReplies: false,
    }, undefined, undefined, controller.signal)).rejects.toThrow('导出已取消');
    expect(mocks.getFavoriteList).not.toHaveBeenCalled();
    expect(mocks.getCollectionList).not.toHaveBeenCalled();
  });
});
