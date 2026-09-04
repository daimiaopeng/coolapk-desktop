import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import QuestionHeaderCard from '../QuestionHeaderCard.vue';

describe('问答问题头部', () => {
  it('标题和正文相同时不重复渲染正文', () => {
    const wrapper = mount(QuestionHeaderCard, {
      props: {
        question: { id: 'question-43', title: '小米15 Ultra哪个系统版本好啊?', message: '小米15 Ultra哪个系统版本好啊' },
        answerCount: 2,
        followCount: 0,
        isFollowed: false,
      },
      global: {
        stubs: {
          FeedHeader: { template: '<div><slot name="actions" /></div>' },
          FeedContent: {
            props: ['title', 'message'],
            template: '<div class="feed-content-test"><span class="title">{{ title }}</span><span class="message">{{ message }}</span></div>',
          },
          FeedImageGrid: true,
        },
      },
    });

    expect(wrapper.find('.feed-content-test .title').text()).toBe('小米15 Ultra哪个系统版本好啊?');
    expect(wrapper.find('.feed-content-test .message').text()).toBe('');
  });

  it('提供查看回答和写回答两个操作入口', async () => {
    const wrapper = mount(QuestionHeaderCard, {
      props: {
        question: { id: 'question-42', title: '如何选择显示器', message: '请大家给点建议' },
        answerCount: 2,
        followCount: 8,
        isFollowed: false,
      },
      global: {
        stubs: {
          FeedHeader: { template: '<div><slot name="actions" /></div>' },
          FeedContent: true,
          FeedImageGrid: true,
        },
      },
    });

    expect(wrapper.find('.question-counts').text()).toContain('2 个回答');
    expect(wrapper.find('.question-counts').text()).toContain('8 人关注');
    expect(wrapper.find('.question-add-answer').text()).toContain('写回答');

    await wrapper.find('.question-count-clickable').trigger('click');
    await wrapper.find('.question-add-answer').trigger('click');
    expect(wrapper.emitted('view-answers')).toHaveLength(1);
    expect(wrapper.emitted('add-answer')).toHaveLength(1);
  });
});
