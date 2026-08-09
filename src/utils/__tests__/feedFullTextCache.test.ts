import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getFeedDetail: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFeedDetail: mocks.getFeedDetail,
  },
}));

import {
  clearFeedFullTextCache,
  getFeedFullTextRequestStats,
  preloadFeedFullText,
} from '../feedFullTextCache';

describe('动态全文后台缓存', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeedFullTextCache();
  });

  it('同一条动态共享请求并复用已完成结果', async () => {
    mocks.getFeedDetail.mockResolvedValue({ data: { message: '完整正文' } });

    const first = preloadFeedFullText('100');
    const second = preloadFeedFullText('100');
    expect(second).toBe(first);
    await expect(Promise.all([first, second])).resolves.toEqual(['完整正文', '完整正文']);
    await expect(preloadFeedFullText('100')).resolves.toBe('完整正文');
    expect(mocks.getFeedDetail).toHaveBeenCalledTimes(1);
  });

  it('批量预取最多同时发出三个请求', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    mocks.getFeedDetail.mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve))
    );

    const requests = Array.from({ length: 5 }, (_, index) => preloadFeedFullText(index + 1));
    expect(mocks.getFeedDetail).toHaveBeenCalledTimes(3);
    expect(getFeedFullTextRequestStats()).toEqual({ active: 3, queued: 2 });

    resolvers[0]({ data: { message: '正文 1' } });
    await vi.waitFor(() => expect(mocks.getFeedDetail).toHaveBeenCalledTimes(4));

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
