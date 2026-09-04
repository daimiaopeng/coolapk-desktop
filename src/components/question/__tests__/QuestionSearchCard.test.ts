import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const routerPush = vi.fn();

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return { ...actual, useRouter: () => ({ push: routerPush }) };
});

import QuestionSearchCard from '../QuestionSearchCard.vue';

describe('问答搜索问题卡', () => {
  it('按 APK 的 feedQuestion 结构显示问题标题、统计数和问答标识', async () => {
    const wrapper = mount(QuestionSearchCard, {
      props: {
        entity: {
          entityType: 'feedQuestion',
          id: 'question-42',
          message_title: '如何选择显示器',
          question_answer_num: 12,
          question_follow_num: 8,
        },
      },
    });

    expect(wrapper.find('.question-search-badge').text()).toBe('问答');
    expect(wrapper.find('.question-search-title').text()).toBe('如何选择显示器');
    expect(wrapper.find('.question-search-meta').text()).toContain('12人回答');
    expect(wrapper.find('.question-search-meta').text()).toContain('8人关注');

    await wrapper.trigger('click');
    expect(routerPush).toHaveBeenCalledWith('/question/question-42');
  });
});
