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

describe('动态卡片编辑记录', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it('已编辑动态显示标识，点击后打开编辑记录', async () => {
    mocks.getFeedChangeHistory.mockResolvedValue({
      data: [
        { id: 'history-2', isHistory: 0, change_count: 1, dateline: 1_786_000_100, message: '修改后的正文' },
        { id: 'history-1', isHistory: 1, change_count: 0, dateline: 1_786_000_000, message: '原始正文' },
      ],
    });

    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: '123', uid: '456', username: '测试用户', message: '原正文', isModified: 1 },
      },
      global: {
        stubs: {
          FeedHeader: {
            props: ['isEdited'],
            template: '<button v-if="isEdited" class="stub-edited" @click="$emit(\'edit-history\')">已编辑</button>',
          },
          FeedContent: true,
          FeedImageGrid: true,
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: {
            props: ['isOpen'],
            template: '<div v-if="isOpen" class="stub-dialog"><slot /></div>',
          },
        },
      },
    });

    expect(wrapper.find('.stub-edited').text()).toBe('已编辑');
    await wrapper.find('.stub-edited').trigger('click');
    await flushPromises();

    expect(mocks.getFeedChangeHistory).toHaveBeenCalledWith('123');
    expect(wrapper.find('.stub-dialog').text()).toContain('当前版本');
    expect(wrapper.find('.stub-dialog').text()).toContain('原始版本');
    expect(wrapper.find('.stub-dialog').text()).toContain('修改后的正文');
  });

  it('没有编辑字段的动态不显示已编辑入口', () => {
    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: '456', uid: '789', username: '测试用户', message: '未编辑正文' },
      },
      global: {
        stubs: {
          FeedHeader: {
            props: ['isEdited'],
            template: '<button v-if="isEdited" class="stub-edited">已编辑</button>',
          },
          FeedContent: true,
          FeedImageGrid: true,
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          AppDialog: true,
        },
      },
    });

    expect(wrapper.find('.stub-edited').exists()).toBe(false);
    expect(mocks.getFeedChangeHistory).not.toHaveBeenCalled();
  });
});
