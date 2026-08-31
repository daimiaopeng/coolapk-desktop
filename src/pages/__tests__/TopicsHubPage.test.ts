import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
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
});
