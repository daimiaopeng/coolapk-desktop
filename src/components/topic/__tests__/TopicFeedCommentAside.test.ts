import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TopicFeedCommentAside from '../TopicFeedCommentAside.vue';
import { reactiveUserProfileMap } from '../../../utils/userProfilePreloader';

const routerPush = vi.hoisted(() => vi.fn());

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return { ...actual, useRouter: () => ({ push: routerPush }) };
});

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFeedReplies: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

describe('TopicFeedCommentAside 话题评论侧栏头像与头部信息', () => {
  it('正确使用动态作者头像渲染 AppAvatar', () => {
    setActivePinia(createPinia());
    const wrapper = mount(TopicFeedCommentAside, {
      props: {
        feed: {
          id: 'feed-1',
          uid: '12345',
          username: '赛博帕鲁',
          userAvatar: 'https://avatar.coolapk.com/12345.jpg',
          avatar_plugin_url: 'https://avatar.coolapk.com/plugin.png',
        },
      },
      global: {
        stubs: {
          AppAvatar: {
            props: ['src', 'pluginUrl', 'size'],
            template: '<div class="stub-avatar" :data-src="src" :data-plugin="pluginUrl" :data-size="size"></div>',
          },
          UserHoverCard: { template: '<div><slot /></div>' },
          FeedCommentSection: true,
        },
      },
    });

    const avatarStub = wrapper.find('.stub-avatar');
    expect(avatarStub.exists()).toBe(true);
    expect(avatarStub.attributes('data-src')).toBe('https://avatar.coolapk.com/12345.jpg');
    expect(avatarStub.attributes('data-plugin')).toBe('https://avatar.coolapk.com/plugin.png');
    expect(avatarStub.attributes('data-size')).toBe('32');
  });

  it('严禁把动态正文配图 (feed.pic) 当作作者头像', () => {
    setActivePinia(createPinia());
    const wrapper = mount(TopicFeedCommentAside, {
      props: {
        feed: {
          id: 'feed-2',
          uid: '67890',
          username: '赛博帕鲁',
          message: '【Grok 4.7模型将在10天后发布】',
          pic: 'https://image.coolapk.com/feed/post_banner.jpg',
        },
      },
      global: {
        stubs: {
          AppAvatar: {
            props: ['src'],
            template: '<div class="stub-avatar" :data-src="src"></div>',
          },
          UserHoverCard: { template: '<div><slot /></div>' },
          FeedCommentSection: true,
        },
      },
    });

    const avatarStub = wrapper.find('.stub-avatar');
    expect(avatarStub.exists()).toBe(true);
    // 未提供有效头像时为空字符串（交给 AppAvatar 展示默认头像），绝不能是配图 URL
    expect(avatarStub.attributes('data-src')).toBe('');
  });

  it('动态只有 uid 时自动从预加载画像补齐头像与挂件', () => {
    const uid = '99999';
    reactiveUserProfileMap[uid] = {
      userAvatar: 'https://avatar.coolapk.com/preload_avatar.jpg',
      avatar_plugin_url: 'https://avatar.coolapk.com/preload_plugin.png',
    };
    setActivePinia(createPinia());

    const wrapper = mount(TopicFeedCommentAside, {
      props: {
        feed: {
          id: 'feed-3',
          uid,
          username: '预加载用户',
        },
      },
      global: {
        stubs: {
          AppAvatar: {
            props: ['src', 'pluginUrl'],
            template: '<div class="stub-avatar" :data-src="src" :data-plugin="pluginUrl"></div>',
          },
          UserHoverCard: { template: '<div><slot /></div>' },
          FeedCommentSection: true,
        },
      },
    });

    const avatarStub = wrapper.find('.stub-avatar');
    expect(avatarStub.attributes('data-src')).toBe('https://avatar.coolapk.com/preload_avatar.jpg');
    expect(avatarStub.attributes('data-plugin')).toBe('https://avatar.coolapk.com/preload_plugin.png');
    delete reactiveUserProfileMap[uid];
  });

  it('点击头像或作者名跳转至用户主页', async () => {
    setActivePinia(createPinia());
    routerPush.mockClear();

    const wrapper = mount(TopicFeedCommentAside, {
      props: {
        feed: {
          id: 'feed-4',
          uid: '55555',
          username: '赛博帕鲁',
        },
      },
      global: {
        stubs: {
          AppAvatar: true,
          UserHoverCard: { template: '<div><slot /></div>' },
          FeedCommentSection: true,
        },
      },
    });

    await wrapper.find('.author-avatar-wrap').trigger('click');
    expect(routerPush).toHaveBeenCalledWith('/user/55555');

    routerPush.mockClear();
    await wrapper.find('.author-name').trigger('click');
    expect(routerPush).toHaveBeenCalledWith('/user/55555');
  });

  it('点击关闭按钮触发 close 事件', async () => {
    setActivePinia(createPinia());
    const wrapper = mount(TopicFeedCommentAside, {
      props: {
        feed: { id: 'feed-5', username: '测试' },
      },
      global: {
        stubs: {
          AppAvatar: true,
          UserHoverCard: { template: '<div><slot /></div>' },
          FeedCommentSection: true,
        },
      },
    });

    await wrapper.find('.btn-close-aside').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
