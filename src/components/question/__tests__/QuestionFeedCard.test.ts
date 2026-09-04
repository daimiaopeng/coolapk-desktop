import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';

const routerPush = vi.fn();

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return { ...actual, useRouter: () => ({ push: routerPush }) };
});

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getUserSpace: vi.fn().mockResolvedValue({ data: {} }),
    followQuestion: vi.fn(),
    unfollowQuestion: vi.fn(),
  },
}));

import QuestionFeedCard from '../QuestionFeedCard.vue';

describe('问答问题卡', () => {
  it('使用独立问答卡而不是普通动态卡片', async () => {
    const wrapper = mount(QuestionFeedCard, {
      props: {
        question: {
          id: 'question-42',
          uid: '10086',
          username: '提问用户',
          title: '如何选择显示器',
          message: '请大家给点建议',
          feedType: 'question',
          question_answer_num: 2,
          question_follow_num: 8,
        },
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          FeedHeader: { template: '<div class="stub-header"><slot name="actions" /></div>' },
          FeedContent: true,
          FeedVideoCard: true,
          FeedImageGrid: true,
          AppImage: true,
        },
      },
    });

    expect(wrapper.find('.question-feed-card').exists()).toBe(true);
    expect(wrapper.find('.feed-card').exists()).toBe(false);
    expect(wrapper.find('.question-feed-badge').exists()).toBe(false);
    expect(wrapper.find('.question-feed-kind-badge').text()).toContain('提问');
    expect(wrapper.find('.question-feed-stats').text()).toContain('2 个回答');
    expect(wrapper.find('.question-feed-stats').text()).toContain('8 人关注');

    await wrapper.find('.question-feed-answer-action').trigger('click');
    expect(routerPush).toHaveBeenCalledWith('/question/question-42');
  });
});
