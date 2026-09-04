import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return { ...actual, useRouter: () => ({ push: vi.fn() }) };
});

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFeedReplies: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

import QuestionAnswerCard from '../QuestionAnswerCard.vue';

describe('问答回答卡', () => {
  it('问题详情中的回答不重复显示问题上下文和回答标题', () => {
    const wrapper = mount(QuestionAnswerCard, {
      props: {
        answer: {
          id: 'answer-43',
          username: '回答用户',
          title: '小米17Pro还是findx9pro?',
          message: '看你对背屏有没有需要',
          feedType: 'answer',
        },
        questionId: 'question-2',
        questionTitle: '小米17Pro还是findx9pro?',
        navigateToQuestion: false,
        showAnswerHeading: false,
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          FeedHeader: { template: '<div class="stub-header"><slot name="actions" /></div>' },
          FeedContent: true,
          FeedVideoCard: true,
          FeedImageGrid: true,
          VoteCard: true,
          AppImage: true,
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          FeedInteractionListDialog: true,
          FeedCollectionPickerDialog: true,
        },
      },
    });

    expect(wrapper.find('.answer-question-context').exists()).toBe(false);
    expect(wrapper.find('.answer-title-row').exists()).toBe(false);
  });

  it('显示 APK 风格的回答标识，并把关联内容留给问题主体', () => {
    const wrapper = mount(QuestionAnswerCard, {
      props: {
        answer: {
          id: 'answer-42',
          username: '回答用户',
          title: '回答标题',
          message: '这是回答正文',
          feedType: 'answer',
          replynum: 3,
          targetRow: { entityType: 'product', id: '9988', title: 'realme Book 增强版' },
        },
        questionId: 'question-1',
        questionTitle: '这个电脑能外接显卡吗？',
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          FeedHeader: { template: '<div class="stub-header"><slot name="actions" /></div>' },
          FeedContent: true,
          FeedVideoCard: true,
          FeedImageGrid: true,
          VoteCard: true,
          AppImage: true,
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          FeedInteractionListDialog: true,
          FeedCollectionPickerDialog: true,
        },
      },
    });

    expect(wrapper.find('.question-answer-card').exists()).toBe(true);
    expect(wrapper.find('.feed-card').exists()).toBe(false);
    expect(wrapper.find('.answer-question-badge').exists()).toBe(false);
    expect(wrapper.find('.answer-kind-badge').text()).toContain('回答');
    expect(wrapper.find('.answer-question-context').text()).toContain('这个电脑能外接显卡吗？');
    expect(wrapper.find('.question-related-card').exists()).toBe(true);
    expect(wrapper.find('.answer-reply-summary').exists()).toBe(false);
  });

  it('显式传入 showReplySummary 时展示回复统计与排序栏', () => {
    const wrapper = mount(QuestionAnswerCard, {
      props: {
        answer: { id: 'answer-45', username: '回答用户', message: '回答正文', replynum: 3, feedType: 'answer' },
        showReplySummary: true,
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          FeedHeader: { template: '<div class="stub-header"><slot name="actions" /></div>' },
          FeedContent: true,
          FeedVideoCard: true,
          FeedImageGrid: true,
          VoteCard: true,
          AppImage: true,
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          FeedInteractionListDialog: true,
          FeedCollectionPickerDialog: true,
        },
      },
    });

    expect(wrapper.find('.answer-reply-summary').exists()).toBe(true);
    expect(wrapper.findAll('.answer-reply-sort-tab').map((item) => item.text())).toEqual(['默认', '最新', '热门', '楼主']);
  });

  it('问题详情的回答列表可以隐藏回复统计和排序栏', () => {
    const wrapper = mount(QuestionAnswerCard, {
      props: {
        answer: { id: 'answer-44', username: '回答用户', message: '回答正文', replynum: 0, feedType: 'answer' },
        showReplySummary: false,
        showRelatedContent: false,
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          FeedHeader: { template: '<div class="stub-header"><slot name="actions" /></div>' },
          FeedContent: true,
          FeedVideoCard: true,
          FeedImageGrid: true,
          VoteCard: true,
          AppImage: true,
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          FeedInteractionListDialog: true,
          FeedCollectionPickerDialog: true,
        },
      },
    });

    expect(wrapper.find('.answer-reply-summary').exists()).toBe(false);
    expect(wrapper.find('.question-related-card').exists()).toBe(false);
  });
});
