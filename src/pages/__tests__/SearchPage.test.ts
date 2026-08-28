import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getHotSearches: vi.fn(),
  searchByType: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));

import SearchPage from '../SearchPage.vue';

describe('话题内搜索', () => {
  it('使用 feed 搜索并携带当前话题作用域', async () => {
    mocks.getHotSearches.mockResolvedValue({ code: 200, data: [] });
    mocks.searchByType.mockResolvedValue({ code: 200, data: [] });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/search', component: SearchPage }],
    });
    await router.push({
      path: '/search',
      query: { q: '镜头', tab: 'feed', pageType: 'tag', pageParam: '数码' },
    });
    await router.isReady();

    const wrapper = mount(SearchPage, {
      global: {
        plugins: [createPinia(), router],
        stubs: {
          SearchResultItem: true,
          SearchHotListCard: true,
          LoadingState: true,
          EmptyState: true,
        },
      },
    });

    await flushPromises();

    const request = mocks.searchByType.mock.calls.at(-1)?.[0];
    expect(request).toMatchObject({
      searchType: 'feed',
      query: '镜头',
      pageType: 'tag',
      pageParam: '数码',
      feedType: 'all',
      sort: 'default',
    });
    expect(wrapper.find('.search-tabs').exists()).toBe(false);
    expect(wrapper.find('.search-field').attributes('placeholder')).toContain('数码');
  });
});
