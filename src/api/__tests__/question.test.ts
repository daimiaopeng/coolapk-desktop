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
});
