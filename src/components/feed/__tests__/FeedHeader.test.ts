import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeedHeader from '../FeedHeader.vue';

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
});
