import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getHotSearches: vi.fn(),
  searchByType: vi.fn(),
  getSearchSuggestionsApp: vi.fn(),
  getSearchSuggestions: vi.fn(),
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

  it('点击 searchTab 联想词时使用关键词并切换到对应页签', async () => {
    mocks.getHotSearches.mockResolvedValue({ code: 200, data: [] });
    mocks.searchByType.mockResolvedValue({ code: 200, data: [] });
    mocks.getSearchSuggestionsApp.mockResolvedValue({
      code: 200,
      data: [{ entityType: 'searchWord', title: '搜索用户：小米', url: 'searchTab://user?keyword=%E5%B0%8F%E7%B1%B3' }],
    });
    mocks.getSearchSuggestions.mockResolvedValue({ code: 200, data: [] });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/search', component: SearchPage }],
    });
    await router.push('/search');
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
    const input = wrapper.find('.search-field');
    await input.setValue('小米');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await flushPromises();

    expect(wrapper.find('.suggestion-item').text()).toBe('搜索用户：小米');
    await wrapper.find('.suggestion-item').trigger('mousedown');
    await flushPromises();

    expect(router.currentRoute.value.query).toEqual({ q: '小米', tab: 'user' });
  });

  it('问答页签按 APK 提供全部、提问、回答筛选', async () => {
    mocks.getHotSearches.mockResolvedValue({ code: 200, data: [] });
    mocks.searchByType.mockResolvedValue({ code: 200, data: [] });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/search', component: SearchPage }],
    });
    await router.push({ path: '/search', query: { q: '小米', tab: 'ask' } });
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

    expect(wrapper.findAll('.search-ask-filter-item').map((item) => item.text())).toEqual(['全部', '提问', '回答']);
    await wrapper.findAll('.search-ask-filter-item')[2].trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.query).toEqual({ q: '小米', tab: 'ask', feedType: 'answer' });
    expect(mocks.searchByType.mock.calls.at(-1)?.[0]).toMatchObject({ searchType: 'ask', feedType: 'answer' });
  });
});
