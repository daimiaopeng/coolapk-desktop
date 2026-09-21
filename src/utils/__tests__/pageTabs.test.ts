import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { describePageTab, getPageTabId } from '../pageTabs';
import { usePageTabsStore } from '../../stores/pageTabs';

function route(path: string, name: string, params: Record<string, string> = {}, query: Record<string, string> = {}) {
  const queryString = new URLSearchParams(query).toString();
  return { path, name, params, query, fullPath: `${path}${queryString ? `?${queryString}` : ''}` } as unknown as RouteLocationNormalizedLoaded;
}

describe('页面标签身份', () => {
  it('同一详情页的查询变化复用标签，不同实体分开显示', () => {
    const first = route('/topic/摄影', 'Topic', { tag: '摄影' }, { type: 'hot' });
    const sameTopic = route('/topic/摄影', 'Topic', { tag: '摄影' }, { type: 'latest' });
    const otherTopic = route('/topic/数码', 'Topic', { tag: '数码' });

    expect(getPageTabId(first)).toBe(getPageTabId(sameTopic));
    expect(getPageTabId(first)).not.toBe(getPageTabId(otherTopic));
    expect(describePageTab(first)).toMatchObject({ title: '# 摄影', icon: 'fas fa-hashtag', closable: true });
  });

  it('服务端页面按目标地址区分，并使用路由标题', () => {
    const page = route('/page', 'PageDataList', {}, { url: '/topic/tagList', title: '全部话题' });
    expect(getPageTabId(page)).toBe('page:/topic/tagList');
    expect(describePageTab(page).title).toBe('全部话题');
  });

  it('栏目子页和同栏目下的不同具体页面分别建立标签', () => {
    const followedNodes = route('/my', 'My', {}, { section: 'followed_nodes' });
    const followedTopics = route('/my', 'My', {}, { section: 'followed_topics' });
    const nodeA = route('/node/forum/100', 'Node', { nodeType: 'forum', nodeId: '100' });
    const nodeB = route('/node/forum/200', 'Node', { nodeType: 'forum', nodeId: '200' });

    expect(getPageTabId(followedNodes)).not.toBe(getPageTabId(followedTopics));
    expect(describePageTab(followedNodes).title).toBe('关注的论坛');
    expect(getPageTabId(nodeA)).not.toBe(getPageTabId(nodeB));
  });
});

describe('页面标签状态', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('重复进入同一页面只更新地址，不创建重复标签', () => {
    const store = usePageTabsStore();
    store.syncRoute(route('/topic/摄影', 'Topic', { tag: '摄影' }, { type: 'hot' }));
    store.syncRoute(route('/topic/摄影', 'Topic', { tag: '摄影' }, { type: 'latest' }));

    expect(store.tabs).toHaveLength(2);
    expect(store.activeTab.route).toContain('type=latest');
  });

  it('关闭当前标签后回到最近使用的标签，首页不能关闭', () => {
    const store = usePageTabsStore();
    store.syncRoute(route('/topic/摄影', 'Topic', { tag: '摄影' }));
    store.syncRoute(route('/feed/100', 'FeedDetail', { feedId: '100' }));
    store.activate('Topic:摄影');

    expect(store.close('Topic:摄影')).toBe('/feed/100');
    expect(store.activeId).toBe('FeedDetail:100');
    expect(store.close('home')).toBeNull();
    expect(store.tabs.some((tab) => tab.id === 'home')).toBe(true);
  });

  it('关闭其他标签时保留首页和目标标签', () => {
    const store = usePageTabsStore();
    store.syncRoute(route('/topic/摄影', 'Topic', { tag: '摄影' }));
    store.syncRoute(route('/feed/100', 'FeedDetail', { feedId: '100' }));

    expect(store.closeOthers('Topic:摄影')).toBe('/topic/摄影');
    expect(store.tabs.map((tab) => tab.id)).toEqual(['home', 'Topic:摄影']);
  });

  it('拖动标签只调整顺序，不改变当前标签', () => {
    const store = usePageTabsStore();
    store.syncRoute(route('/topic/摄影', 'Topic', { tag: '摄影' }));
    store.syncRoute(route('/feed/100', 'FeedDetail', { feedId: '100' }));

    store.move('FeedDetail:100', 'home', false);

    expect(store.tabs.map((tab) => tab.id)).toEqual(['FeedDetail:100', 'home', 'Topic:摄影']);
    expect(store.activeId).toBe('FeedDetail:100');
  });

  it('收藏页面长期保留，固定页面在新状态实例启动时直接恢复', () => {
    const store = usePageTabsStore();
    store.syncRoute(route('/my', 'My', {}, { section: 'followed_nodes' }));
    expect(store.toggleFavorite('My:section=followed_nodes')).toBe(true);
    expect(store.togglePin('My:section=followed_nodes')).toBe(true);

    setActivePinia(createPinia());
    const restored = usePageTabsStore();
    expect(restored.tabs.map((tab) => tab.id)).toContain('My:section=followed_nodes');
    expect(restored.favoritePages.map((page) => page.id)).toContain('My:section=followed_nodes');
    expect(restored.tabs.find((tab) => tab.id === 'My:section=followed_nodes')).toMatchObject({ pinned: true, closable: false, title: '关注的论坛' });
  });

  it('固定标签拖动后的顺序在重新启动时保持不变', () => {
    const store = usePageTabsStore();
    store.syncRoute(route('/topic/摄影', 'Topic', { tag: '摄影' }));
    store.togglePin('Topic:摄影');
    store.move('Topic:摄影', 'home', false);

    setActivePinia(createPinia());
    expect(usePageTabsStore().tabs.map((tab) => tab.id)).toEqual(['Topic:摄影', 'home']);
  });
});
