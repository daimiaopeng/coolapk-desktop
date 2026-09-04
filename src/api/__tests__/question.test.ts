import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { CoolapkTauriAPI } from '../coolapk';

describe('CoolapkTauriAPI 问答接口封装', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue({ code: 200, data: [] });
  });

  it('调用回答列表并传入 APK 的 reply 排序', async () => {
    await CoolapkTauriAPI.getQuestionAnswers('42');
    expect(invoke).toHaveBeenCalledWith('get_question_answers', { feedId: '42', sort: 'reply', page: 1 });
  });

  it('回答列表翻页时传入 APK 的首尾游标', async () => {
    await CoolapkTauriAPI.getQuestionAnswers('42', 'dateline', 2, { firstItem: '100', lastItem: '80' });
    expect(invoke).toHaveBeenCalledWith('get_question_answers', {
      feedId: '42',
      sort: 'dateline',
      page: 2,
      firstItem: '100',
      lastItem: '80',
    });
  });

  it('调用关注和取消关注问题', async () => {
    await CoolapkTauriAPI.followQuestion('42');
    await CoolapkTauriAPI.unfollowQuestion('42');
    expect(invoke).toHaveBeenNthCalledWith(1, 'follow_question', { questionId: '42' });
    expect(invoke).toHaveBeenNthCalledWith(2, 'unfollow_question', { questionId: '42' });
  });

  it('按 APK 字段调用邀请回答', async () => {
    await CoolapkTauriAPI.inviteQuestionAnswer('42', '10086,20014');
    expect(invoke).toHaveBeenCalledWith('invite_question_answer', { questionId: '42', uid: '10086,20014' });
  });

  it('按 APK 的 createFeed 参数发布回答', async () => {
    await CoolapkTauriAPI.createAnswer('42', '这是我的回答');
    expect(invoke).toHaveBeenCalledWith('create_answer', {
      questionId: '42',
      message: '这是我的回答',
    });
  });

  it('调用产品关注状态接口', async () => {
    await CoolapkTauriAPI.changeProductFollowStatus('9988', 1);
    expect(invoke).toHaveBeenCalledWith('change_product_follow_status', { productId: '9988', status: 1 });
  });
});
