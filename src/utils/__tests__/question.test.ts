import { describe, expect, it } from 'vitest';
import {
  extractQuestionAnswers,
  getQuestionAnswerCount,
  getQuestionFollowCount,
  getQuestionMessage,
  isQuestionFollowed,
  isQuestionFeedEntity,
  isQuestionHomeTab,
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

  it('标题和正文相同时只返回一次正文', () => {
    expect(getQuestionMessage({ title: '小米15 Ultra哪个系统版本好啊?', message: '小米15 Ultra哪个系统版本好啊' })).toBe('');
    expect(getQuestionMessage({ title: '如何选显示器', message: '预算 3000 元，主要用于办公' })).toBe('预算 3000 元，主要用于办公');
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

  it('只识别明确的问答首页页签，不误伤普通动态页', () => {
    expect(isQuestionHomeTab({ title: '问答', page_name: 'V9_HOME_TAB_QUESTION' })).toBe(true);
    expect(isQuestionHomeTab({ title: '回答', url: '/main/answer' })).toBe(true);
    expect(isQuestionHomeTab({ title: '动态', page_name: 'V9_HOME_TAB_TASK', url: '/main/task' })).toBe(false);
    expect(isQuestionHomeTab({ title: '动态', page_name: 'mask', url: '/main/mask' })).toBe(false);
  });

  it('问答栏目只识别明确的问题实体，不把普通 feed 变成问题', () => {
    expect(isQuestionFeedEntity({ entityType: 'feedQuestion', id: '1', title: '问题' })).toBe(true);
    expect(isQuestionFeedEntity({ feedType: 'question', id: '2', title: '问题' })).toBe(true);
    expect(isQuestionFeedEntity({
      entityType: 'feed',
      feedType: 'feed',
      message: '普通动态',
      question_answer_num: 0,
      question_follow_num: 0,
    })).toBe(false);
  });
});
