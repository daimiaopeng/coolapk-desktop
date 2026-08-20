import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../../../stores/auth';

const mocks = vi.hoisted(() => ({
  getReplyDetail: vi.fn(),
  replyFeed: vi.fn(),
  uploadImage: vi.fn(),
}));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getReplyDetail: mocks.getReplyDetail,
    replyFeed: mocks.replyFeed,
    uploadImage: mocks.uploadImage,
  },
}));

import FeedCommentSection from '../FeedCommentSection.vue';

describe('评论完整信息展示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getReplyDetail.mockResolvedValue({ data: {} });
    mocks.replyFeed.mockResolvedValue({ code: 200, message: 'ok' });
    mocks.uploadImage.mockResolvedValue({ code: 200, data: { url: 'https://image.coolapk.com/feed/test.jpg' } });
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
          Button: {
            props: ['loading', 'disabled'],
            template: '<button class="stub-button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
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

  it('支持表情面板展开与表情插入', async () => {
    const wrapper = mountSection();
    expect(wrapper.find('.emoji-picker-popover').exists()).toBe(false);

    // 点击表情按钮
    const emojiBtn = wrapper.findAll('.composer-tool-btn').find(btn => btn.text().includes('表情'));
    expect(emojiBtn).toBeDefined();
    await emojiBtn!.trigger('click');

    expect(wrapper.find('.emoji-picker-popover').exists()).toBe(true);

    // 点击某一个表情
    const firstEmoji = wrapper.find('.emoji-item-btn');
    expect(firstEmoji.exists()).toBe(true);
    await firstEmoji.trigger('click');

    const textarea = wrapper.find<HTMLTextAreaElement>('.comment-textarea');
    expect(textarea.element.value).toMatch(/^\[.+\]$/);
  });

  it('点击回复酷友时显示回复目标栏且支持一键取消', async () => {
    const wrapper = mountSection();
    expect(wrapper.find('.comment-reply-target-bar').exists()).toBe(false);

    const replyBtn = wrapper.find('.comment-reply-btn');
    await replyBtn.trigger('click');

    expect(wrapper.find('.comment-reply-target-bar').exists()).toBe(true);
    expect(wrapper.find('.reply-target-name').text()).toBe('@测试酷友');

    // 点击取消回复
    await wrapper.find('.reply-target-clear-btn').trigger('click');
    expect(wrapper.find('.comment-reply-target-bar').exists()).toBe(false);
  });

  it('登录状态下成功提交评论并触发 replyFeed', async () => {
    const authStore = useAuthStore();
    authStore.user = { uid: 12345, username: '发布者' } as any;
    authStore.isLoggedIn = true;

    const wrapper = mountSection();
    const editor = wrapper.find('.comment-textarea');
    editor.element.textContent = '这是一条测试评论内容';
    await editor.trigger('input');

    const submitBtn = wrapper.find('.stub-button');
    await submitBtn.trigger('click');
    await flushPromises();

    expect(mocks.replyFeed).toHaveBeenCalledWith('feed-1', '这是一条测试评论内容', undefined, undefined);
    expect(wrapper.emitted('send-comment')?.[0]).toEqual(['这是一条测试评论内容']);
  });
});
