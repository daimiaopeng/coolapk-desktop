import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  getFeedDetail: vi.fn(),
}));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFeedDetail: mocks.getFeedDetail,
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
    mocks.getFeedDetail.mockResolvedValue({ data: { message: '这里是接口返回的完整正文' } });
    const wrapper = mount(FeedContent, {
      props: { feedId: '456', message: '正文摘要... 查看更多' },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper.text()).not.toContain('查看更多');
    await wrapper.find('.expand-btn').trigger('click');
    await flushPromises();

    expect(mocks.getFeedDetail).toHaveBeenCalledWith('456');
    expect(wrapper.text()).toContain('这里是接口返回的完整正文');
  });

  it('后台预取完成后点击立即展开且不重复请求', async () => {
    mocks.getFeedDetail.mockResolvedValue({ data: { message: '后台已经准备好的完整正文' } });
    const wrapper = mount(FeedContent, {
      props: { feedId: '789', message: '正文摘要... 查看更多' },
      global: { plugins: [createPinia()] },
    });

    await flushPromises();
    expect(mocks.getFeedDetail).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.feed-body').classes()).toContain('is-collapsed');

    await wrapper.find('.expand-btn').trigger('click');
    expect(wrapper.text()).toContain('后台已经准备好的完整正文');
    expect(mocks.getFeedDetail).toHaveBeenCalledTimes(1);
  });
});
