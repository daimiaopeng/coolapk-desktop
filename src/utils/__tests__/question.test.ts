import { describe, expect, it } from 'vitest';
import {
  extractQuestionAnswers,
  getQuestionAnswerCount,
  getQuestionFollowCount,
  isQuestionFollowed,
  normalizeInviteUids,
  normalizeQuestionDetail,
} from '../question';

describe('问答数据归一化', () => {
  it('保留问题标题、正文和关注状态', () => {
    const question = normalizeQuestionDetail({
      id: '42',
      message_title: '如何选择显示器',
      message: '请大家推荐一款显示器',
      question_answer_num: 12,
      question_follow_num: 8,
      userAction: { follow: 1 },
      userInfo: { uid: '10086', username: '测试用户' },
    }, '42');
    expect(question?.title).toBe('如何选择显示器');
    expect(question?.message).toBe('请大家推荐一款显示器');
    expect(getQuestionAnswerCount(question)).toBe(12);
    expect(getQuestionFollowCount(question)).toBe(8);
    expect(isQuestionFollowed(question)).toBe(true);
  });

  it('从 answerList 包装中补齐回答作者和 ID', () => {
    const answers = extractQuestionAnswers({
      data: {
        answerList: [{
          reply_id: '99',
          message: '我的回答',
          user: { id: '20014', name: '回答者' },
        }],
      },
    });
    expect(answers).toHaveLength(1);
    expect(answers[0]).toMatchObject({ id: '99', message: '我的回答', uid: '20014', username: '回答者' });
  });

  it('邀请用户只接受非零数字 UID 并去重', () => {
    expect(normalizeInviteUids('10086, 20014，10086 abc 0')).toEqual(['10086', '20014']);
  });
});
