import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getFeedForwardList: vi.fn(),
  getFeedLikeList: vi.fn(),
}));
const routerPush = vi.hoisted(() => vi.fn());

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFeedForwardList: mocks.getFeedForwardList,
    getFeedLikeList: mocks.getFeedLikeList,
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}));

import FeedInteractionListDialog from '../FeedInteractionListDialog.vue';

function mountDialog(mode: 'likes' | 'forwards' = 'likes') {
  return mount(FeedInteractionListDialog, {
    props: { show: true, mode, feedId: '42', feedType: 'article' },
    global: {
      stubs: {
        AppDialog: {
          props: ['isOpen'],
          template: '<div v-if="isOpen"><slot /></div>',
        },
        AppAvatar: true,
        EmptyState: true,
        ErrorState: true,
        LoadingState: true,
      },
    },
  });
}

describe('动态互动列表弹窗', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFeedLikeList.mockResolvedValue({ code: 200, data: [] });
    mocks.getFeedForwardList.mockResolvedValue({ code: 200, data: [] });
  });

  it('加载点赞用户并支持进入用户主页', async () => {
    mocks.getFeedLikeList.mockResolvedValue({
      code: 200,
      data: [{ uid: '10086', username: '点赞用户', avatar: 'https://image.coolapk.com/avatar.jpg' }],
    });

    const wrapper = mountDialog('likes');
    await flushPromises();

    expect(mocks.getFeedLikeList).toHaveBeenCalledWith('42', 1);
    expect(wrapper.text()).toContain('点赞用户');

    await wrapper.find('.interaction-user-name').trigger('click');
    expect(routerPush).toHaveBeenCalledWith('/user/10086');
  });

  it('加载转发列表并按动态类型读取下一页', async () => {
    mocks.getFeedForwardList
      .mockResolvedValueOnce({
        code: 200,
        data: Array.from({ length: 20 }, (_, index) => ({ uid: String(index + 1), username: `转发用户${index + 1}`, message: '转发附言' })),
      })
      .mockResolvedValueOnce({ code: 200, data: [{ uid: '21', username: '下一页用户' }] });

    const wrapper = mountDialog('forwards');
    await flushPromises();

    expect(mocks.getFeedForwardList).toHaveBeenCalledWith('42', 'article', 1);
    expect(wrapper.text()).toContain('转发附言');

    await wrapper.find('.interaction-load-more').trigger('click');
    await flushPromises();

    expect(mocks.getFeedForwardList).toHaveBeenCalledWith('42', 'article', 2);
    expect(wrapper.text()).toContain('下一页用户');
  });
});
