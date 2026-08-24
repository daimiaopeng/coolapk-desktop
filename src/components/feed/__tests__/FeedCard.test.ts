import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

const mocks = vi.hoisted(() => ({
  getFeedChangeHistory: vi.fn(),
  getHotReplies: vi.fn(),
  getFeedReplies: vi.fn(),
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
    getHotReplies: mocks.getHotReplies,
    getFeedReplies: mocks.getFeedReplies,
  },
}));

import FeedCard from '../FeedCard.vue';

describe('动态卡片编辑记录', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHotReplies.mockResolvedValue({ data: [] });
    mocks.getFeedReplies.mockResolvedValue({ data: [] });
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

  it('单动态详情页进入后自动展开并加载评论', async () => {
    mocks.getHotReplies.mockResolvedValue({
      data: [{ id: 'reply-1', username: '评论用户', message: '评论内容' }],
    });

    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: '789', uid: '456', username: '测试用户', message: '动态正文' },
        detailMode: true,
        autoOpenComments: true,
      },
      global: {
        stubs: {
          FeedHeader: true,
          FeedContent: true,
          FeedImageGrid: true,
          FeedActionBar: true,
          FeedCommentSection: {
            props: ['comments', 'totalCommentCount'],
            template: '<div class="stub-comments">{{ comments.length }} / {{ totalCommentCount }}</div>',
          },
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: true,
        },
      },
    });
    await flushPromises();

    expect(mocks.getHotReplies).toHaveBeenCalledWith('789', 1);
    expect(wrapper.find('.stub-comments').text()).toBe('1 /');

    await wrapper.setProps({
      feed: { id: '789', uid: '456', username: '测试用户', message: '动态正文', replynum: 22 },
    });
    expect(wrapper.find('.stub-comments').text()).toBe('1 / 22');
  });

  it('通知摘要阶段不请求评论，完整动态准备好后再加载', async () => {
    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: 'summary-id', username: '测试用户', message: '通知摘要' },
        detailMode: true,
        autoOpenComments: false,
      },
      global: {
        stubs: {
          FeedHeader: true,
          FeedContent: true,
          FeedImageGrid: true,
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: true,
        },
      },
    });
    await flushPromises();
    expect(mocks.getHotReplies).not.toHaveBeenCalled();

    await wrapper.setProps({
      feed: { id: 'real-feed-id', username: '测试用户', message: '完整动态' },
      autoOpenComments: true,
    });
    await flushPromises();

    expect(mocks.getHotReplies).toHaveBeenCalledWith('real-feed-id', 1);
    expect(mocks.getHotReplies).not.toHaveBeenCalledWith('summary-id', 1);
  });

  it('热门排序同时保留普通评论，并去除热门评论中的重复项', async () => {
    mocks.getHotReplies.mockResolvedValue({
      data: [{ id: 'hot-1', username: '热门用户', message: '热门评论' }],
    });
    mocks.getFeedReplies.mockResolvedValue({
      data: [
        { id: 'hot-1', username: '热门用户', message: '热门评论' },
        { id: 'normal-1', username: '普通用户', message: '普通评论' },
      ],
    });

    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: 'all-comments-feed', uid: '456', username: '动态作者', message: '动态正文' },
        detailMode: true,
        autoOpenComments: true,
      },
      global: {
        stubs: {
          FeedHeader: true,
          FeedContent: true,
          FeedImageGrid: true,
          FeedActionBar: true,
          FeedCommentSection: {
            props: ['comments'],
            template: '<div class="stub-comments">{{ comments.map(item => item.id).join(",") }}</div>',
          },
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: true,
        },
      },
    });
    await flushPromises();

    expect(mocks.getHotReplies).toHaveBeenCalledWith('all-comments-feed', 1);
    expect(mocks.getFeedReplies).toHaveBeenCalledWith('all-comments-feed', 1);
    expect(wrapper.find('.stub-comments').text()).toBe('hot-1,normal-1');
  });
});

describe('动态关联和视频内容', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it('渲染多种关联标的并保留视频卡片入口', () => {
    const wrapper = mount(FeedCard, {
      props: {
        feed: {
          id: 'relation-feed',
          uid: '456',
          username: '测试用户',
          message: '视频动态正文',
          videoUrl: 'https://cdn.example.com/video.mp4',
          relationRows: [{ id: 1, title: '黑神话：悟空', entityType: 'game' }],
          extraRows: [{ id: 2, title: '小米 13 Pro', entityType: 'product' }],
          productRows: [{ id: 3, title: '蓝牙耳机', entityType: 'goods' }],
        },
      },
      global: {
        stubs: {
          FeedHeader: true,
          FeedContent: true,
          FeedImageGrid: true,
          FeedVideoCard: {
            props: ['feed'],
            template: '<div v-if="feed.videoUrl" class="stub-video-card">视频</div>',
          },
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: true,
          FeedCollectionPickerDialog: true,
          AppImage: true,
        },
      },
    });

    expect(wrapper.findAll('.feed-target-chip')).toHaveLength(3);
    expect(wrapper.find('.stub-video-card').exists()).toBe(true);
  });
});

describe('评论区收起定位', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHotReplies.mockResolvedValue({ data: [] });
    mocks.getFeedReplies.mockResolvedValue({
      data: [{ id: 'comment-1', username: '评论用户', message: '评论内容' }],
    });
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('当前动态被评论区挤出视口时，收起后回到当前动态而不是下一条', async () => {
    const host = document.createElement('div');
    host.className = 'feed-scroll-container';
    Object.defineProperties(host, {
      clientHeight: { configurable: true, value: 600 },
      scrollHeight: { configurable: true, value: 5000 },
      scrollTop: { configurable: true, writable: true, value: 4500 },
    });
    document.body.appendChild(host);

    let collapsed = false;
    const makeRect = (top: number, bottom: number): DOMRect => ({
      x: 0,
      y: top,
      width: 800,
      height: bottom - top,
      top,
      right: 800,
      bottom,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
      if (this.classList.contains('feed-scroll-container')) return makeRect(0, 600);
      if (this.classList.contains('feed-card')) return collapsed ? makeRect(-1200, -600) : makeRect(100, 500);
      return makeRect(0, 0);
    });

    const wrapper = mount(FeedCard, {
      attachTo: host,
      props: {
        feed: { id: 'collapse-feed', uid: '456', username: '动态作者', message: '动态正文' },
      },
      global: {
        stubs: {
          FeedHeader: true,
          FeedContent: true,
          VoteCard: true,
          FeedImageGrid: true,
          FeedVideoCard: true,
          FeedActionBar: {
            template: '<button class="stub-open-comments" @click="$emit(\'open-comment\')">评论</button>',
          },
          FeedCommentSection: {
            props: ['comments'],
            template: '<div class="stub-comments">{{ comments.length }}</div>',
          },
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: true,
          AppImage: true,
          FeedCollectionPickerDialog: true,
        },
      },
    });

    await wrapper.find('.stub-open-comments').trigger('click');
    await flushPromises();
    window.dispatchEvent(new Event('scroll'));
    await nextTick();
    const collapseButton = document.body.querySelector<HTMLButtonElement>('.btn-floating-collapse');
    expect(collapseButton).not.toBeNull();

    collapsed = true;
    collapseButton?.click();
    await nextTick();
    await nextTick();

    expect(host.scrollTop).toBe(3300);
    expect(wrapper.find('.stub-comments').exists()).toBe(false);
    wrapper.unmount();
    host.remove();
  });
});
