import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { CoolapkTauriAPI } from '../coolapk';

describe('CoolapkTauriAPI 动态互动列表接口封装', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue({ code: 200, data: [] });
  });

  it('点赞列表传入动态 ID 和页码', async () => {
    await CoolapkTauriAPI.getFeedLikeList('42', 2);

    expect(invoke).toHaveBeenCalledWith('get_feed_like_list', { feedId: '42', page: 2 });
  });

  it('转发列表传入动态类型和页码', async () => {
    await CoolapkTauriAPI.getFeedForwardList('42', 'article', 3);

    expect(invoke).toHaveBeenCalledWith('get_feed_forward_list', { feedId: '42', feedType: 'article', page: 3 });
  });
});
