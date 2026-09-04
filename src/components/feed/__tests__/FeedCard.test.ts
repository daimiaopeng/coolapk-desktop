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

  it('将生成长图放入头部的更多菜单', async () => {
    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: 'menu-feed', uid: '456', username: '测试用户', message: '动态正文' },
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
          FeedShareImageDialog: {
            props: ['show'],
            template: '<div class="stub-share-image-dialog" :data-open="String(show)"></div>',
          },
          FeedInteractionListDialog: true,
          FeedCollectionPickerDialog: true,
          AppDialog: true,
          LoadingState: true,
        },
      },
    });

    await wrapper.find('.stub-more').trigger('click');
    expect(wrapper.find('.more-menu').text()).toContain('生成长图');

    await wrapper.find('.more-menu-item').trigger('click');
    expect(wrapper.find('.more-menu').exists()).toBe(false);
    expect(wrapper.find('.stub-share-image-dialog').attributes('data-open')).toBe('true');
  });

  it('提问卡显示 APK 的回答/关注统计并沿用问答头部标识', async () => {
    const wrapper = mount(FeedCard, {
      props: {
        feed: {
          id: 'question-card',
          feedType: 'question',
          title: '问题标题',
          message: '问题正文',
          question_answer_num: 3,
          question_follow_num: 4,
        },
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          FeedHeader: {
            props: ['questionMode'],
            template: '<div class="stub-feed-header" :data-question-mode="String(questionMode)"></div>',
          },
          FeedContent: true,
          FeedImageGrid: true,
          FeedVideoCard: true,
          FeedActionBar: true,
          FeedCommentSection: true,
          ForwardDialog: true,
          FeedShareImageDialog: true,
          FeedInteractionListDialog: true,
          FeedCollectionPickerDialog: true,
          AppDialog: true,
          LoadingState: true,
        },
      },
    });

    expect(wrapper.find('.stub-feed-header').attributes('data-question-mode')).toBe('true');
    expect(wrapper.find('.question-stats').text()).toContain('3人回答');
    expect(wrapper.find('.question-stats').text()).toContain('4人关注');

    await wrapper.setProps({ feed: { id: 'answer-card', feedType: 'answer', title: '回答标题', message: '回答正文' } });
    expect(wrapper.find('.stub-feed-header').attributes('data-question-mode')).toBe('true');
    expect(wrapper.find('.question-stats').exists()).toBe(false);
    wrapper.unmount();
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

  it('不把动态正文配图当作作者头像', () => {
    const wrapper = mount(FeedCard, {
      props: {
        feed: {
          id: 'avatar-feed',
          uid: '789',
          username: '测试用户',
          message: '带正文配图的动态',
          pic: 'https://image.coolapk.com/feed/content.jpg',
        },
      },
      global: {
        stubs: {
          FeedHeader: {
            props: ['avatar'],
            template: '<div class="stub-feed-header" :data-avatar="avatar"></div>',
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

    expect(wrapper.find('.stub-feed-header').attributes('data-avatar')).toBeUndefined();
  });

  it('单动态详情页进入后自动展开并加载评论', async () => {
    mocks.getFeedReplies.mockResolvedValue({
      data: [{ id: 'reply-1', username: '评论用户', message: '评论内容' }],
    });

    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: '789', uid: '456', username: '测试用户', message: '动态正文', replynum: 1 },
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

    expect(mocks.getHotReplies).not.toHaveBeenCalled();
    expect(mocks.getFeedReplies).toHaveBeenCalledWith(
      '789',
      1,
      { listType: 'lastupdate_desc', fromFeedAuthor: 0 },
    );
    expect(wrapper.find('.stub-comments').text()).toBe('1 / 1');

    await wrapper.setProps({
      feed: { id: '789', uid: '456', username: '测试用户', message: '动态正文', replynum: 22 },
    });
    expect(wrapper.find('.stub-comments').text()).toBe('1 / 22');
  });

  it('展开动态评论时自动读取后续分页', async () => {
    mocks.getFeedReplies.mockImplementation(async (_feedId: string, page: number) => ({
      data: Array.from({ length: page === 3 ? 5 : 10 }, (_, index) => ({
        id: `reply-${(page - 1) * 10 + index + 1}`,
        message: `第${page}页`,
      })),
    }));

    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: 'paged-feed', uid: '456', username: '测试用户', message: '动态正文', replynum: 25 },
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
            props: ['comments', 'hasMoreComments', 'loadingMoreComments'],
            emits: ['load-more-comments'],
            template: '<div class="stub-comments"><span>{{ comments.length }}</span><button v-if="hasMoreComments && !loadingMoreComments" class="load-more" @click="$emit(\'load-more-comments\')">更多</button></div>',
          },
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: true,
        },
      },
    });
    await flushPromises();

    expect(mocks.getFeedReplies.mock.calls.map(([, page]) => page)).toEqual([1, 2]);
    expect(mocks.getFeedReplies).toHaveBeenCalledWith(
      'paged-feed',
      2,
      {
        listType: 'lastupdate_desc',
        fromFeedAuthor: 0,
        firstItem: 'reply-1',
        lastItem: 'reply-10',
      },
    );
    expect(mocks.getFeedReplies).not.toHaveBeenCalledWith('paged-feed', 3);
    expect(wrapper.find('.stub-comments span').text()).toBe('20');

    await wrapper.find('.load-more').trigger('click');
    await flushPromises();

    expect(mocks.getFeedReplies.mock.calls.map(([, page]) => page)).toEqual([1, 2, 3]);
    expect(mocks.getFeedReplies).toHaveBeenCalledWith(
      'paged-feed',
      3,
      {
        listType: 'lastupdate_desc',
        fromFeedAuthor: 0,
        firstItem: 'reply-1',
        lastItem: 'reply-20',
      },
    );
    expect(wrapper.find('.stub-comments span').text()).toBe('25');
  });

  it('少量评论只请求第一页，不为确认末页额外等待', async () => {
    mocks.getFeedReplies.mockResolvedValue({
      data: [
        { id: 'short-1', message: '评论一' },
        { id: 'short-2', message: '评论二' },
        { id: 'short-3', message: '评论三' },
      ],
    });

    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: 'short-feed', uid: '456', username: '测试用户', message: '动态正文', replynum: 3 },
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
            template: '<div class="stub-comments">{{ comments.length }}</div>',
          },
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: true,
        },
      },
    });
    await flushPromises();

    expect(mocks.getFeedReplies.mock.calls.map(([, page]) => page)).toEqual([1]);
    expect(wrapper.find('.stub-comments').text()).toBe('3');
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

    expect(mocks.getFeedReplies).toHaveBeenCalledWith(
      'real-feed-id',
      1,
      { listType: 'lastupdate_desc', fromFeedAuthor: 0 },
    );
    expect(mocks.getHotReplies).not.toHaveBeenCalledWith('summary-id', 1);
  });

  it('热门排序使用 replyList 的 popular 参数并去除重复项', async () => {
    mocks.getFeedReplies.mockResolvedValue({
      data: [
        { id: 'hot-1', username: '热门用户', message: '热门评论' },
        { id: 'normal-1', username: '普通用户', message: '普通评论' },
      ],
    });

    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: 'all-comments-feed', uid: '456', username: '动态作者', message: '动态正文', replynum: 2 },
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
            emits: ['comment-sort-change'],
            template: '<div class="stub-comments"><button class="sort-hot" @click="$emit(\'comment-sort-change\', { mode: \'likes\', authorOnly: false })"></button>{{ comments.map(item => item.id).join(",") }}</div>',
          },
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: true,
        },
      },
    });
    await flushPromises();

    expect(mocks.getHotReplies).not.toHaveBeenCalled();
    expect(mocks.getFeedReplies).toHaveBeenCalledWith(
      'all-comments-feed',
      1,
      { listType: 'lastupdate_desc', fromFeedAuthor: 0 },
    );
    await wrapper.find('.sort-hot').trigger('click');
    await flushPromises();
    expect(mocks.getFeedReplies).toHaveBeenLastCalledWith(
      'all-comments-feed',
      1,
      { listType: 'popular', fromFeedAuthor: 0 },
    );
    expect(wrapper.find('.stub-comments').text()).toBe('hot-1,normal-1');
  });

  it('切换排序时重置分页并使用 APK 的默认、最新和楼主参数', async () => {
    mocks.getFeedReplies.mockImplementation(async (_feedId: string, page: number, options: { listType?: string; fromFeedAuthor?: number }) => ({
      data: Array.from({ length: 10 }, (_, index) => ({
        id: `${options.listType || 'author'}-${(page - 1) * 10 + index + 1}`,
        message: `第${page}页`,
      })),
    }));

    const wrapper = mount(FeedCard, {
      props: {
        feed: { id: 'sort-feed', uid: '456', username: '动态作者', message: '动态正文', replynum: 20 },
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
            props: ['comments', 'hasMoreComments', 'loadingMoreComments'],
            emits: ['comment-sort-change'],
            template: `
              <div class="stub-comments">
                <button class="sort-default" @click="$emit('comment-sort-change', { mode: 'default', authorOnly: false })">默认</button>
                <button class="sort-latest" @click="$emit('comment-sort-change', { mode: 'latest', authorOnly: false })">最新</button>
                <button class="sort-author" @click="$emit('comment-sort-change', { mode: 'default', authorOnly: true })">楼主</button>
                <span>{{ comments.length }}</span>
              </div>
            `,
          },
          ForwardDialog: true,
          LoadingState: true,
          AppDialog: true,
        },
      },
    });
    await flushPromises();

    expect(mocks.getFeedReplies.mock.calls.slice(0, 2)).toEqual([
      ['sort-feed', 1, { listType: 'lastupdate_desc', fromFeedAuthor: 0 }],
      ['sort-feed', 2, {
        listType: 'lastupdate_desc',
        fromFeedAuthor: 0,
        firstItem: 'lastupdate_desc-1',
        lastItem: 'lastupdate_desc-10',
      }],
    ]);

    await wrapper.find('.sort-latest').trigger('click');
    await flushPromises();
    expect(mocks.getFeedReplies.mock.calls.slice(-2)).toEqual([
      ['sort-feed', 1, { listType: 'dateline_desc', fromFeedAuthor: 0 }],
      ['sort-feed', 2, {
        listType: 'dateline_desc',
        fromFeedAuthor: 0,
        firstItem: 'dateline_desc-1',
        lastItem: 'dateline_desc-10',
      }],
    ]);

    await wrapper.find('.sort-default').trigger('click');
    await flushPromises();
    expect(mocks.getFeedReplies.mock.calls.slice(-2)).toEqual([
      ['sort-feed', 1, { listType: 'lastupdate_desc', fromFeedAuthor: 0 }],
      ['sort-feed', 2, {
        listType: 'lastupdate_desc',
        fromFeedAuthor: 0,
        firstItem: 'lastupdate_desc-1',
        lastItem: 'lastupdate_desc-10',
      }],
    ]);

    await wrapper.find('.sort-author').trigger('click');
    await flushPromises();
    expect(mocks.getFeedReplies.mock.calls.slice(-2)).toEqual([
      ['sort-feed', 1, { listType: '', fromFeedAuthor: 1 }],
      ['sort-feed', 2, {
        listType: '',
        fromFeedAuthor: 1,
        firstItem: 'author-1',
        lastItem: 'author-10',
      }],
    ]);
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

  it('当卡片靠近屏幕右侧时悬浮收起评论按钮自动上移避让回到顶部按钮', async () => {
    const host = document.createElement('div');
    host.className = 'feed-scroll-container';
    document.body.appendChild(host);

    let cardRight = 980;
    const makeRect = (right: number): DOMRect => ({
      x: 0,
      y: 100,
      width: 780,
      height: 400,
      top: 100,
      right,
      bottom: 500,
      left: right - 780,
      toJSON: () => ({}),
    } as DOMRect);

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
      if (this.classList.contains('feed-scroll-container')) return makeRect(1000);
      if (this.classList.contains('feed-card')) return makeRect(cardRight);
      return makeRect(0);
    });

    // 模拟窗口宽度 1000px，卡片右边缘在 980px（距离右边缘 20px，加上 24px 后 rightOffset = 44px < 96px）
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });

    const wrapper = mount(FeedCard, {
      attachTo: host,
      props: {
        feed: { id: 'collapse-feed-avoid-overlap', uid: '456', username: '动态作者', message: '动态正文' },
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

    const floatingContainer = document.body.querySelector<HTMLElement>('.global-floating-comment-collapse');
    expect(floatingContainer).not.toBeNull();
    // 应该避让到 84px
    expect(floatingContainer?.style.bottom).toBe('84px');

    // 模拟窗口宽度变宽为 1400px，卡片右边缘在 1000px（距离右边缘 400px，rightOffset = 424px >= 96px）
    cardRight = 1000;
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true, configurable: true });
    window.dispatchEvent(new Event('resize'));
    await nextTick();

    expect(floatingContainer?.style.bottom).toBe('32px');

    wrapper.unmount();
    host.remove();
  });
});
