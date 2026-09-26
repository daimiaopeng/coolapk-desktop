import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  getPublicFeedDetail: vi.fn(),
}));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getPublicFeedDetail: mocks.getPublicFeedDetail,
  },
}));

import FeedContent from '../FeedContent.vue';
import { clearFeedFullTextCache } from '../../../utils/feedFullTextCache';

describe('动态正文展开', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeedFullTextCache();
  });

  it('接口截断正文会加载完整内容且不保留查看更多', async () => {
    mocks.getPublicFeedDetail.mockResolvedValue({ data: { message: '这里是接口返回的完整正文' } });
    const wrapper = mount(FeedContent, {
      props: { feedId: '456', message: '正文摘要... 查看更多' },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper.text()).not.toContain('查看更多');
    await flushPromises();
    expect(mocks.getPublicFeedDetail).not.toHaveBeenCalled();
    await wrapper.find('.expand-btn').trigger('click');
    await flushPromises();

    expect(mocks.getPublicFeedDetail).toHaveBeenCalledWith('456');
    expect(wrapper.text()).toContain('这里是接口返回的完整正文');
  });

  it('列表卡片加载后不访问详情，只有主动展开才请求全文', async () => {
    mocks.getPublicFeedDetail.mockResolvedValue({ data: { message: '主动展开后取得的完整正文' } });
    const wrapper = mount(FeedContent, {
      props: { feedId: '789', message: '正文摘要... 查看更多' },
      global: { plugins: [createPinia()] },
    });

    await flushPromises();
    expect(mocks.getPublicFeedDetail).not.toHaveBeenCalled();
    expect(wrapper.find('.feed-body').classes()).toContain('is-collapsed');

    await wrapper.find('.expand-btn').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('主动展开后取得的完整正文');
    expect(mocks.getPublicFeedDetail).toHaveBeenCalledTimes(1);
  });

  it('回答卡片在标题前显示明确的回答标识', () => {
    const wrapper = mount(FeedContent, {
      props: { title: '回答标题', message: '回答正文', answerMode: true },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper.find('.answer-title-badge').text()).toBe('回答');
    expect(wrapper.find('.feed-title').text()).toContain('回答标题');
  });

  it('提问卡片在标题前显示明确的提问标识', () => {
    const wrapper = mount(FeedContent, {
      props: { title: '问题标题', message: '问题正文', questionMode: true },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper.find('.question-title-badge').text()).toBe('提问');
    expect(wrapper.find('.feed-title').text()).toContain('问题标题');
  });
});
