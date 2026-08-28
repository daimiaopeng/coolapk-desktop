import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import EntityFilterBar from '../EntityFilterBar.vue';

describe('EntityFilterBar', () => {
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/search', component: { template: '<div>Search</div>' } },
      ],
    });
    await router.push('/');
    await router.isReady();
  });

  it('正确渲染排序选项并支持切换排序', async () => {
    const wrapper = mount(EntityFilterBar, {
      global: {
        plugins: [router],
      },
      props: {
        sort: 'default',
        sortOptions: [
          { key: 'default', label: '默认' },
          { key: 'latest', label: '最新' },
          { key: 'hot', label: '热度' },
        ],
        targetTitle: '索尼A7C2',
      },
    });

    const buttons = wrapper.findAll('.filter-btn');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].classes()).toContain('active');

    await buttons[1].trigger('click');
    expect(wrapper.emitted('update:sort')?.[0]).toEqual(['latest']);
    expect(wrapper.emitted('change')?.[0]).toEqual(['latest']);
  });

  it('支持搜索框输入并按回车跳转路由', async () => {
    const wrapper = mount(EntityFilterBar, {
      global: {
        plugins: [router],
      },
      props: {
        targetTitle: '索尼A7C2',
        autoNavigateSearch: true,
      },
    });

    const pushSpy = vi.spyOn(router, 'push');
    const input = wrapper.find('.filter-search-input');
    expect(input.attributes('placeholder')).toBe('搜索索尼A7C2动态');

    await input.setValue('微距');
    await input.trigger('keydown.enter');
    await flushPromises();

    expect(wrapper.emitted('search')).toBeTruthy();
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/search',
      query: { q: '索尼A7C2 微距' },
    });
  });

  it('点击清空按钮可清空输入内容', async () => {
    const wrapper = mount(EntityFilterBar, {
      global: {
        plugins: [router],
      },
      props: {
        targetTitle: '数码',
      },
    });

    const input = wrapper.find('.filter-search-input');
    await input.setValue('评测');
    expect(wrapper.find('.search-clear-btn').exists()).toBe(true);

    await wrapper.find('.search-clear-btn').trigger('click');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('搜索时显示 APK 动态类型并支持切换', async () => {
    const wrapper = mount(EntityFilterBar, {
      global: {
        plugins: [router],
      },
      props: {
        sort: 'default',
        searchKeyword: '小米',
        searchSortOptions: [
          { key: 'default', label: '综合', searchSort: 'none' },
          { key: 'latest', label: '实时', searchSort: 'dateline' },
          { key: 'hot', label: '热度', searchSort: 'hot' },
          { key: 'comment', label: '评论', searchSort: 'reply' },
          { key: 'accurate', label: '精确', searchSort: '', isStrict: true },
        ],
        feedType: 'all',
        feedTypeOptions: [
          { key: 'all', label: '全部' },
          { key: 'comment', label: '评论' },
        ],
        showFeedType: true,
        autoNavigateSearch: false,
      },
    });

    expect(wrapper.findAll('.filter-btn').map((button) => button.text())).toEqual([
      '综合', '实时', '热度', '评论', '精确',
    ]);
    const trigger = wrapper.find('.filter-type-trigger');
    expect(trigger.exists()).toBe(true);
    await trigger.trigger('click');
    const commentOption = wrapper.findAll('.filter-type-option').find((option) => option.text() === '评论');
    expect(commentOption).toBeDefined();
    await commentOption!.trigger('click');
    expect(wrapper.emitted('update:feedType')?.at(-1)).toEqual(['comment']);
    expect(wrapper.emitted('change-feed-type')?.at(-1)).toEqual(['comment']);
  });
});
