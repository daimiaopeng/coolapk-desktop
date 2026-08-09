import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  getReplyDetail: vi.fn(),
}));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getReplyDetail: mocks.getReplyDetail,
  },
}));

import FeedCommentSection from '../FeedCommentSection.vue';

describe('评论完整信息展示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getReplyDetail.mockResolvedValue({ data: {} });
    setActivePinia(createPinia());
  });

  function mountSection() {
    const timestamp = new Date(2026, 7, 9, 10, 20, 30).getTime() / 1000;
    return mount(FeedCommentSection, {
      props: {
        feedId: 'feed-1',
        comments: [{
          id: 'reply-1',
          username: '测试酷友',
          message: '带图片的评论',
          dateline: timestamp,
          device_title: '小米 17 Pro',
          floor: 12,
          ip_location: '广东深圳',
          userInfo: { level: 6, verify_title: '酷安认证用户' },
          picArr: ['/feed/a.jpg', '/feed/b.jpg'],
        }],
        normalizeImg: (url: string) => url,
        formatRichText: (text: string) => text,
      },
      global: {
        stubs: {
          AppAvatar: true,
          Button: true,
          FeedImageGrid: {
            props: ['images', 'variant'],
            template: '<div class="stub-comment-images">{{ variant }}:{{ images.length }}</div>',
          },
        },
      },
    });
  }

  it('展示设备、认证、楼层、属地和评论图片', () => {
    const wrapper = mountSection();
    expect(wrapper.text()).toContain('LV6');
    expect(wrapper.text()).toContain('酷安认证用户');
    expect(wrapper.text()).toContain('小米 17 Pro');
    expect(wrapper.text()).toContain('#12楼');
    expect(wrapper.text()).toContain('广东深圳');
    expect(wrapper.find('.stub-comment-images').text()).toBe('comment:2');
  });

  it('点击评论时间可在相对时间和完整时间之间切换', async () => {
    const wrapper = mountSection();
    const timeButton = wrapper.get('.comment-time-button');
    expect(timeButton.text()).not.toContain('2026-08-09 10:20:30');
    await timeButton.trigger('click');
    expect(timeButton.text()).toContain('2026-08-09 10:20:30');
    await timeButton.trigger('click');
    expect(timeButton.text()).not.toContain('2026-08-09 10:20:30');
  });

  it('后台补取评论详情并显示接口返回的真实设备', async () => {
    mocks.getReplyDetail.mockResolvedValue({
      data: { deviceTitle: '小米 17 Ultra', deviceRom: 'HyperOS' },
    });
    const wrapper = mountSection();
    await flushPromises();
    expect(mocks.getReplyDetail).toHaveBeenCalledWith('reply-1');
    expect(wrapper.text()).toContain('小米 17 Ultra');
  });
});
