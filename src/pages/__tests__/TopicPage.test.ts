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
});
