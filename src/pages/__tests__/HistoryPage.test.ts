import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), resolve: vi.fn(() => ({ matched: [] })) },
  openUrl: vi.fn(),
  getHitHistory: vi.fn(),
  getRecentHistory: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('../../router', () => ({
  router: mocks.router,
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getHitHistory: mocks.getHitHistory,
    getRecentHistory: mocks.getRecentHistory,
    openUrl: mocks.openUrl,
  },
}));

import HistoryPage from '../HistoryPage.vue';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';

const feedItem = {
  title: 'TIGRECC的动态',
  description:
    '<a class="feed-link-tag" href="/t/%E6%95%B0%E7%A0%81%E6%97%A5%E5%B8%B8?type=0">#数码日常#</a> 在家用 Windows 刷酷安',
  logo: 'http://avatar.coolapk.com/data/x_avatar_middle.jpg',
  url: '/feed/72727311',
  historyType: 'feed',
  typeName: '',
  id: 'feed:72727311',
  entityType: 'history',
  dateline: 1786022084,
};

const userItem = {
  title: '测试用户',
  description: '',
  logo: 'http://avatar.coolapk.com/data/y_avatar_middle.jpg',
  url: '/u/123456',
  historyType: 'user',
  typeName: '用户',
  id: 'user:123456',
  entityType: 'history',
  dateline: 1786022084,
};

async function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const authStore = useAuthStore(pinia);
  authStore.isLoggedIn = true;
  authStore.user = { uid: '123456', username: '测试用户', userAvatar: '' };
  mocks.getHitHistory.mockResolvedValue({ code: 200, data: [feedItem, userItem] });
  mocks.getRecentHistory.mockResolvedValue({ code: 200, data: [] });
  mocks.router.push.mockClear();
  mocks.openUrl.mockClear();

  const wrapper = mount(HistoryPage, { global: { plugins: [pinia] } });
  await flushPromises();
  return { wrapper, appStore: useAppStore(pinia) };
}

describe('HistoryPage 点击行为', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('点击动态条目卡片 → 进入完整动态页并保存上下文', async () => {
    const { wrapper, appStore } = await mountPage();
    const items = wrapper.findAll('.history-item');
    expect(items).toHaveLength(2);

    await items[0].trigger('click');
    expect(mocks.router.push).toHaveBeenCalledWith('/feed/72727311');
    expect(appStore.getFeedDetailContext('72727311')).toStrictEqual(feedItem);
  });

  it('点击描述区纯文本（非链接）→ 进入完整动态页', async () => {
    const { wrapper, appStore } = await mountPage();
    const desc = wrapper.find('.history-desc');
    expect(desc.exists()).toBe(true);

    // 点击描述里非链接的正文文字
    await desc.trigger('click');
    expect(mocks.router.push).toHaveBeenCalledWith('/feed/72727311');
  });

  it('点击描述区话题链接 → 走统一 anchor 处理并阻止卡片事件', async () => {
    const { wrapper, appStore } = await mountPage();
    const topicLink = wrapper.find('.history-desc a');
    expect(topicLink.exists()).toBe(true);

    await topicLink.trigger('click');
    expect(appStore.feedDetailContexts).toEqual({});
    expect(mocks.router.resolve).toHaveBeenCalled();
  });

  it('点击用户条目 → 跳转用户主页', async () => {
    const { wrapper, appStore } = await mountPage();
    const items = wrapper.findAll('.history-item');

    await items[1].trigger('click');
    expect(appStore.feedDetailContexts).toEqual({});
    expect(mocks.router.push).toHaveBeenCalledWith('/user/123456');
  });
});
