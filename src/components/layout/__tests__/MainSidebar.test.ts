import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRoute: () => ({ path: '/' }),
  };
});

import MainSidebar from '../MainSidebar.vue';
import * as routeTransition from '../../../utils/routeTransition';

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to" class="nav-item"><slot /></a>',
};

describe('MainSidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('点击导航项时触发 triggerSidebarTransition', async () => {
    const spy = vi.spyOn(routeTransition, 'triggerSidebarTransition');
    const wrapper = mount(MainSidebar, {
      global: {
        stubs: {
          'router-link': RouterLinkStub,
        },
      },
    });

    const homeLink = wrapper.find('a[href="/"]');
    expect(homeLink.exists()).toBe(true);

    await homeLink.trigger('click');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('点击底部操作按钮（如反馈/更新）时不触发 triggerSidebarTransition', async () => {
    const spy = vi.spyOn(routeTransition, 'triggerSidebarTransition');
    const wrapper = mount(MainSidebar, {
      global: {
        stubs: {
          'router-link': RouterLinkStub,
        },
      },
    });

    const feedbackButton = wrapper.find('.feedback-btn');
    expect(feedbackButton.exists()).toBe(true);

    await feedbackButton.trigger('click');
    expect(spy).not.toHaveBeenCalled();
  });

  it('存在一键反馈与更新按钮并正常展示', async () => {
    const wrapper = mount(MainSidebar, {
      global: {
        stubs: {
          'router-link': RouterLinkStub,
        },
      },
    });

    const feedbackButton = wrapper.find('.feedback-btn');
    expect(feedbackButton.exists()).toBe(true);
    expect(feedbackButton.text()).toContain('反馈');

    const updateButton = wrapper.find('.check-update-btn');
    expect(updateButton.exists()).toBe(true);
    expect(updateButton.text()).toContain('更新');
  });
});
