import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPublicFeedDetail: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getPublicFeedDetail: mocks.getPublicFeedDetail,
  },
}));

import {
  clearFeedFullTextCache,
  getFeedFullTextRequestStats,
  loadFeedFullText,
} from '../feedFullTextCache';

describe('动态全文请求缓存', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeedFullTextCache();
  });

  it('同一条动态共享请求并复用已完成结果', async () => {
    mocks.getPublicFeedDetail.mockResolvedValue({ data: { message: '完整正文' } });

    const first = loadFeedFullText('100');
    const second = loadFeedFullText('100');
    expect(second).toBe(first);
    await expect(Promise.all([first, second])).resolves.toEqual(['完整正文', '完整正文']);
    await expect(loadFeedFullText('100')).resolves.toBe('完整正文');
    expect(mocks.getPublicFeedDetail).toHaveBeenCalledTimes(1);
  });

  it('并发全文请求最多同时发出三个', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    mocks.getPublicFeedDetail.mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve))
    );

    const requests = Array.from({ length: 5 }, (_, index) => loadFeedFullText(index + 1));
    expect(mocks.getPublicFeedDetail).toHaveBeenCalledTimes(3);
    expect(getFeedFullTextRequestStats()).toEqual({ active: 3, queued: 2 });

    resolvers[0]({ data: { message: '正文 1' } });
    await vi.waitFor(() => expect(mocks.getPublicFeedDetail).toHaveBeenCalledTimes(4));

    for (let index = 1; index < 5; index += 1) {
      await vi.waitFor(() => expect(resolvers[index]).toBeTypeOf('function'));
      resolvers[index]({ data: { message: `正文 ${index + 1}` } });
    }
    await expect(Promise.all(requests)).resolves.toEqual([
      '正文 1',
      '正文 2',
      '正文 3',
      '正文 4',
      '正文 5',
    ]);
  });
});
