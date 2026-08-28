import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTopicDetail: vi.fn(),
  getTopicDetailV7: vi.fn(),
  getTopicFeeds: vi.fn(),
  getDeviceFeedList: vi.fn(),
  getTopicTabData: vi.fn(),
  followTag: vi.fn(),
  unfollowTag: vi.fn(),
  searchByType: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));

import TopicPage from '../TopicPage.vue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe('话题排序按钮', () => {
  it('首次列表请求未完成时切换排序仍会加载新排序并丢弃旧响应', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const firstRequest = deferred<any>();
    const sortedRequest = deferred<any>();
    const hotRequest = deferred<any>();
    mocks.getTopicDetail.mockResolvedValue({
      data: {
        title: '今日热点',
        tabList: [
          { pageName: 'feed', title: '讨论' },
          { pageName: 'news', title: '快讯' },
        ],
        selectedTab: 'feed',
      },
    });
    mocks.getTopicDetailV7.mockResolvedValue({ data: {} });
    mocks.getTopicFeeds.mockReset();
    mocks.getTopicFeeds
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(sortedRequest.promise)
      .mockReturnValueOnce(hotRequest.promise);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/topic/:tag', component: TopicPage }],
    });
    await router.push('/topic/今日热点');
    await router.isReady();
    const wrapper = mount(TopicPage, {
      global: {
        plugins: [pinia, router],
        stubs: {
          FeedCard: { props: ['feed'], template: '<div class="feed-card-stub">{{ feed.id }}</div>' },
          DiscoveryEntityCard: { props: ['entity'], template: '<div class="entity-card-stub">{{ entity.id }}</div>' },
          AppImage: true,
          LoadingState: { props: ['text'], template: '<div class="loading-state-stub">{{ text }}</div>' },
          EmptyState: { props: ['title'], template: '<div class="empty-state-stub">{{ title }}</div>' },
        },
      },
    });

    await flushPromises();
    expect(mocks.getTopicFeeds).toHaveBeenCalledTimes(1);
    await wrapper.findAll('.filter-btn')[1].trigger('click');
    expect(mocks.getTopicFeeds).toHaveBeenCalledTimes(2);
    expect(mocks.getTopicFeeds.mock.calls[1][2]).toMatchObject({ listType: 'dateline_desc' });

    firstRequest.resolve({ code: 200, data: [{ id: 'default', message: '默认排序' }] });
    await flushPromises();
    expect(wrapper.find('.feed-card-stub').exists()).toBe(false);

    sortedRequest.resolve({ code: 200, data: [{ id: 'latest', message: '最新排序' }] });
    await flushPromises();
    expect(wrapper.find('.feed-card-stub').text()).toBe('latest');
    expect(wrapper.findAll('.filter-btn')[1].attributes('aria-pressed')).toBe('true');

    await wrapper.findAll('.filter-btn')[2].trigger('click');
    expect(mocks.getTopicFeeds).toHaveBeenCalledTimes(3);
    expect(mocks.getTopicFeeds.mock.calls[2][2]).toMatchObject({ listType: 'popular' });
    hotRequest.resolve({ code: 200, data: [{ id: 'hot', message: '热度排序' }] });
    await flushPromises();
    expect(wrapper.find('.feed-card-stub').text()).toBe('hot');
    expect(wrapper.findAll('.filter-btn')[2].attributes('aria-pressed')).toBe('true');
  });

  it('搜索按钮位于栏目右侧且在话题页内按 APK 参数搜索', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    mocks.getTopicDetail.mockResolvedValue({
      data: {
        title: '数码',
        tabList: [{ pageName: 'feed', title: '讨论' }],
        selectedTab: 'feed',
      },
    });
    mocks.getTopicDetailV7.mockResolvedValue({ data: {} });
    mocks.getTopicFeeds.mockReset();
    mocks.getTopicFeeds.mockResolvedValue({ code: 200, data: [] });
    mocks.searchByType.mockReset();
    mocks.searchByType.mockResolvedValue({ code: 200, data: [] });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/topic/:tag', component: TopicPage },
        { path: '/search', component: { template: '<div>Search</div>' } },
      ],
    });
    await router.push('/topic/数码');
    await router.isReady();
    const wrapper = mount(TopicPage, {
      global: {
        plugins: [pinia, router],
        stubs: {
          FeedCard: true,
          DiscoveryEntityCard: true,
          AppImage: true,
          LoadingState: true,
          EmptyState: true,
        },
      },
    });

    await flushPromises();
    // 顶部导航条已移除（避免与话题概况卡片标题重复）
    expect(wrapper.find('.top-nav-bar').exists()).toBe(false);

    // 栏目/筛选条中存在通用 EntityFilterBar 搜索输入框和放大镜图标
    const searchInput = wrapper.find('.entity-filter-bar .filter-search-input');
    const searchIcon = wrapper.find('.entity-filter-bar .filter-search-icon');
    expect(searchInput.exists()).toBe(true);
    expect(searchIcon.exists()).toBe(true);

    // 输入关键词并回车搜索
    await searchInput.setValue('镜头');
    await searchInput.trigger('keydown.enter');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/topic/数码');
    expect(mocks.searchByType).toHaveBeenCalledWith(expect.objectContaining({
      searchType: 'feed',
      query: '镜头',
      pageType: 'tag',
      pageParam: '数码',
      feedType: 'all',
      sort: 'none',
      isStrict: 0,
    }));

    await wrapper.find('.filter-type-trigger').trigger('click');
    const commentOption = wrapper.findAll('.filter-type-option').find((option) => option.text() === '评论');
    expect(commentOption).toBeDefined();
    await commentOption!.trigger('click');
    await flushPromises();
    expect(mocks.searchByType).toHaveBeenLastCalledWith(expect.objectContaining({
      feedType: 'comment',
      sort: 'none',
    }));

    await wrapper.findAll('.filter-btn')[1].trigger('click');
    await flushPromises();
    expect(mocks.searchByType).toHaveBeenLastCalledWith(expect.objectContaining({
      feedType: 'comment',
      sort: 'dateline',
      isStrict: 0,
    }));
  });
});
