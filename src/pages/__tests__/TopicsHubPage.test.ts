import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import TopicsHubPage from '../TopicsHubPage.vue';
import { useTopicHubStore } from '../../stores/topicHub';

const mocks = vi.hoisted(() => ({
  getTopicHubData: vi.fn(),
  getTopicDetail: vi.fn(),
  getTopicDetailV7: vi.fn(),
  getTopicFeeds: vi.fn(),
  searchByType: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));

describe('TopicsHubPage 三栏/双栏/单栏响应式与过渡', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    mocks.getTopicHubData.mockReset();
    mocks.getTopicDetail.mockReset();
    mocks.getTopicFeeds.mockReset();
  });

  it('初始加载显示大网格与分类 tabs，点击卡片切换至分屏模式', async () => {
    mocks.getTopicHubData.mockResolvedValue({
      tabs: [
        { title: '值得买', url: '/page?url=BUY' },
        { title: '摄影', url: '/page?url=PHOTO' },
      ],
      data: [
        { id: 't1', title: '好物安利', follower_num: 106000, logo: 'https://example.com/logo1.png' },
        { id: 't2', title: '小风扇', follower_num: 3200, logo: 'https://example.com/logo2.png' },
      ],
    });

    mocks.getTopicDetail.mockResolvedValue({
      data: {
        title: '好物安利',
        tabList: [{ pageName: 'feed', title: '讨论' }],
      },
    });

    mocks.getTopicFeeds.mockResolvedValue({
      data: [
        { id: 'feed-101', message: '夏日小风扇评测', username: '酷友小明', replynum: 5 },
      ],
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/topics', component: TopicsHubPage }],
    });
    await router.push('/topics');
    await router.isReady();

    const wrapper = mount(TopicsHubPage, {
      global: {
        plugins: [router],
        stubs: {
          TopicPage: {
            props: ['tagParam', 'embedded', 'activeFeedId'],
            template: '<div class="topic-page-stub">{{ tagParam }}</div>',
          },
          TopicFeedCommentAside: {
            props: ['feed'],
            template: '<div class="topic-feed-comment-aside-stub"></div>',
          },
          FeedCommentSection: true,
          LoadingState: true,
          EmptyState: true,
          AppImage: true,
        },
      },
    });

    await flushPromises();

    // 验证分类 tabs
    const tabs = wrapper.findAll('.cat-tab');
    expect(tabs.length).toBe(2);
    expect(tabs[0].text()).toBe('值得买');

    // 验证网格卡片
    const cards = wrapper.findAll('.topic-card');
    expect(cards.length).toBe(2);

    const store = useTopicHubStore();
    expect(store.viewMode).toBe('grid');

    // 点击第一个话题卡片进入分屏模式
    await cards[0].trigger('click');
    await flushPromises();

    expect(store.viewMode).toBe('split');
    expect(store.activeTopicTag).toBe('好物安利');

    // 验证左侧栏与中间栏存在
    expect(wrapper.find('.split-left-sidebar').exists()).toBe(true);
    expect(wrapper.find('.split-center-main').exists()).toBe(true);

    // 点击返回大网格
    await wrapper.find('.btn-back-grid').trigger('click');
    expect(store.viewMode).toBe('grid');
  });

  it('右栏宽度超过可用空间时自动收缩，避免评论被窗口裁切', async () => {
    const previousInnerWidth = window.innerWidth;
    const previousRightWidth = localStorage.getItem('coolapk_topic_hub_right_width');
    localStorage.setItem('coolapk_topic_hub_right_width', '640');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });

    mocks.getTopicHubData.mockResolvedValue({
      tabs: [],
      data: [{ id: 't1', title: '好物安利', follower_num: 106000 }],
    });
    mocks.getTopicDetail.mockResolvedValue({
      data: { title: '好物安利', tabList: [{ pageName: 'feed', title: '讨论' }] },
    });
    mocks.getTopicFeeds.mockResolvedValue({
      data: [{ id: 'feed-101', message: '动态', username: '酷友小明', replynum: 5 }],
    });

    try {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/topics', component: TopicsHubPage }],
      });
      await router.push('/topics');
      await router.isReady();

      const wrapper = mount(TopicsHubPage, {
        global: {
          plugins: [router],
          stubs: {
            TopicPage: {
              props: ['tagParam', 'embedded', 'activeFeedId', 'disableInlineComments'],
              template: '<div class="topic-page-stub" :data-disable-inline-comments="disableInlineComments"></div>',
            },
            TopicFeedCommentAside: {
              props: ['feed'],
              template: '<div class="topic-feed-comment-aside-stub"></div>',
            },
            FeedCommentSection: true,
            LoadingState: true,
            EmptyState: true,
            AppImage: true,
          },
        },
      });

      await flushPromises();
      const pageRoot = wrapper.find('.topics-page').element as HTMLElement;
      Object.defineProperty(pageRoot, 'clientWidth', { configurable: true, value: 1230 });
      window.dispatchEvent(new Event('resize'));
      await nextTick();

      await wrapper.find('.topic-card').trigger('click');
      await flushPromises();

      expect(wrapper.find('.split-right-wrapper').exists()).toBe(true);
      expect(wrapper.find('.split-right-wrapper').attributes('style')).toContain('width: 450px');
      expect(wrapper.find('.topic-page-stub').attributes('data-disable-inline-comments')).toBe('true');

      Object.defineProperty(pageRoot, 'clientWidth', { configurable: true, value: 1000 });
      window.dispatchEvent(new Event('resize'));
      await nextTick();

      expect(wrapper.find('.split-right-wrapper').exists()).toBe(false);
      expect(wrapper.find('.topic-page-stub').attributes('data-disable-inline-comments')).toBe('false');
    } finally {
      if (previousRightWidth === null) {
        localStorage.removeItem('coolapk_topic_hub_right_width');
      } else {
        localStorage.setItem('coolapk_topic_hub_right_width', previousRightWidth);
      }
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousInnerWidth });
    }
  });
});
