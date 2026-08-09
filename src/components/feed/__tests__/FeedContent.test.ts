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

describe('动态正文展开', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('本地长正文直接在卡片内展开', async () => {
    const message = Array.from({ length: 15 }, (_, index) => `第 ${index + 1} 行`).join('\n');
    const wrapper = mount(FeedContent, {
      props: { feedId: '123', message },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper.find('.feed-body').classes()).toContain('is-collapsed');
    await wrapper.find('.expand-btn').trigger('click');

    expect(wrapper.find('.feed-body').classes()).not.toContain('is-collapsed');
    expect(mocks.getFeedDetail).not.toHaveBeenCalled();
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
});
