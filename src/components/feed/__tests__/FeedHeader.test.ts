import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeedHeader from '../FeedHeader.vue';
import { reactiveUserProfileMap } from '../../../utils/userProfilePreloader';

const routerPush = vi.hoisted(() => vi.fn());

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return { ...actual, useRouter: () => ({ push: routerPush }) };
});

describe('动态头部信息布局', () => {
  it('按 APK 顺序展示认证、发布时间和机型', () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedHeader, {
      props: {
        username: '竹本青',
        verifyTitle: '酷安认证: 资讯达人',
        recommendSource: '每日游戏资讯',
        dateline: '1 天前',
        device: 'OPPO Find X7 Ultra',
      },
      global: {
        stubs: {
          AppAvatar: true,
          AppIconButton: true,
        },
      },
    });

    expect(wrapper.find('.verify-badge').text()).toContain('酷安认证: 资讯达人');
    expect(wrapper.find('.meta-row .source-tag').exists()).toBe(false);
    expect(wrapper.find('.meta-row .dateline').text()).toBe('1 天前');
    expect(wrapper.find('.meta-row .device-badge').text()).toContain('OPPO Find X7 Ultra');
    expect(wrapper.find('.user-row .device-badge').exists()).toBe(false);
    expect(wrapper.find('.meta-row').element.firstElementChild?.classList.contains('dateline')).toBe(true);
  });

  it('问答动态在头部右侧显示明确的问答标识', () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedHeader, {
      props: {
        username: '问答用户',
        questionMode: true,
      },
      global: {
        stubs: {
          AppAvatar: true,
          AppIconButton: true,
        },
      },
    });

    const badge = wrapper.find('.header-actions .question-badge');
    expect(badge.text()).toBe('问答');
    expect(badge.attributes('aria-label')).toBe('问答');
  });

  it('将头条返回的数字字符串时间转换为相对时间', () => {
    vi.setSystemTime(new Date(1787311908 * 1000));
    setActivePinia(createPinia());
    const wrapper = mount(FeedHeader, {
      props: {
        dateline: '17873111783',
      },
      global: {
        stubs: {
          AppAvatar: true,
          AppIconButton: true,
        },
      },
    });

    expect(wrapper.find('.meta-row .dateline').text()).toBe('12 分钟前');
    vi.useRealTimers();
  });

  it('没有有效 UID 时不把用户名拼成错误用户路由', async () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedHeader, {
      props: { uid: '0', username: '酷安头条' },
      global: { stubs: { AppAvatar: true, AppIconButton: true, UserHoverCard: { template: '<div><slot /></div>' } } },
    });

    await wrapper.find('.username').trigger('click');
    expect(routerPush).not.toHaveBeenCalled();

    await wrapper.setProps({ uid: '24680' });
    await wrapper.find('.username').trigger('click');
    expect(routerPush).toHaveBeenCalledWith('/user/24680');
  });

  it('动态只有用户 ID 时使用预加载资料中的头像', () => {
    const uid = '24681';
    reactiveUserProfileMap[uid] = { userAvatar: 'https://image.coolapk.com/avatar/user.jpg' };
    setActivePinia(createPinia());

    const wrapper = mount(FeedHeader, {
      props: { uid, username: '资料用户' },
      global: {
        stubs: {
          AppAvatar: {
            props: ['src'],
            template: '<div class="stub-avatar" :data-src="src"></div>',
          },
          AppIconButton: true,
          UserHoverCard: { template: '<div><slot /></div>' },
        },
      },
    });

    expect(wrapper.find('.stub-avatar').attributes('data-src')).toBe('https://image.coolapk.com/avatar/user.jpg');
    delete reactiveUserProfileMap[uid];
  });
});
