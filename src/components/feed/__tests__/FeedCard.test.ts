import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  getFeedChangeHistory: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../../router', () => ({
  router: { push: vi.fn(), resolve: vi.fn(() => ({ matched: [] })) },
}));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFeedChangeHistory: mocks.getFeedChangeHistory,
  },
}));

import FeedCard from '../FeedCard.vue';

describe('动态卡片修改历史', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it('从卡片更多菜单打开修改历史并显示记录', async () => {
    mocks.getFeedChangeHistory.mockResolvedValue({
      data: [{ id: 'history-1', dateline: 1_786_000_000, message: '修改后的正文' }],
    });

    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: '123', uid: '456', username: '测试用户', message: '原正文' },
      },
      global: {
        stubs: {
          FeedHeader: {
            template: '<button class="stub-more" @click="$emit(\'more\')">更多</button>',
          },
          FeedContent: true,
          FeedImageGrid: true,
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          LoadingState: true,
        },
      },
    });

    await wrapper.find('.stub-more').trigger('click');
    await wrapper.find('.more-menu-item').trigger('click');
    await flushPromises();

    expect(mocks.getFeedChangeHistory).toHaveBeenCalledWith('123');
    expect(wrapper.find('.feed-history-panel').text()).toContain('修改后的正文');
  });
});
