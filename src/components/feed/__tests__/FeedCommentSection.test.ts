import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../../../stores/auth';
import { useSettingsStore } from '../../../stores/settings';

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

  function mountSection(commentOverrides: Record<string, any> = {}, extraProps: Record<string, any> = {}) {
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
          ...commentOverrides,
        }],
        normalizeImg: (url: string) => url,
        formatRichText: (text: string) => text,
        ...extraProps,
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

  it('评论图片已单独展示时移除正文中的图片占位文本', () => {
    const wrapper = mountSection({ message: '[图片]', picArr: ['/feed/animated.gif'] });
    expect(wrapper.find('.comment-text').text()).not.toContain('[图片]');
  });

  it('楼主筛选只展示楼主评论且保留原始评论总数', async () => {
    const wrapper = mountSection({}, {
      feedUid: 'owner-1',
      feedUsername: '楼主',
      totalCommentCount: 2,
      comments: [
        { id: 'owner-comment', uid: 'owner-1', username: '楼主', message: '楼主评论' },
        {
          id: 'other-comment',
          uid: 'other-1',
          username: '其他用户',
          message: '其他评论',
          replyRows: [{ id: 'owner-sub-comment', uid: 'owner-1', username: '楼主', message: '楼主楼中楼回复' }],
        },
      ],
    });

    const authorOnlyButton = wrapper.findAll('.comment-sort-button').find(button => button.text() === '楼主');
    expect(authorOnlyButton).toBeDefined();
    expect(wrapper.findAll('.comment-row')).toHaveLength(2);
    await authorOnlyButton!.trigger('click');

    expect(wrapper.findAll('.comment-row')).toHaveLength(2);
    expect(wrapper.find('.comment-row').text()).toContain('楼主评论');
    expect(wrapper.find('.sub-reply-row').text()).toContain('楼主楼中楼回复');
    expect(wrapper.find('.author-filter-context-label').text()).toBe('上下文');
    expect(wrapper.find('.comment-title').text()).toBe('评论 2');
  });

  it('优先显示动态接口返回的评论总数', () => {
    const wrapper = mountSection();
    expect(wrapper.find('.comment-title').text()).toBe('评论 1');

    wrapper.unmount();
    const withTotal = mount(FeedCommentSection, {
      props: {
        feedId: 'feed-1',
        totalCommentCount: 22,
        comments: [{ id: 'reply-1', username: '测试酷友', message: '评论内容' }],
      },
      global: { stubs: { AppAvatar: true, Button: true, FeedImageGrid: true } },
    });
    expect(withTotal.find('.comment-title').text()).toBe('评论 22');
  });

  it('没有评论总数时回退到已加载评论数量', () => {
    const wrapper = mountSection();
    expect(wrapper.find('.comment-title').text()).toBe('评论 1');
  });

  it('默认评论排序跟随内容设置', () => {
    const settings = useSettingsStore();
    settings.settings.commentSort = 'latest';
    const wrapper = mountSection({}, {
      comments: [
        { id: 'old', username: '旧评论', message: '旧', dateline: 100 },
        { id: 'new', username: '新评论', message: '新', dateline: 200 },
      ],
    });
    const active = wrapper.find('.comment-sort-button.is-active');
    expect(active.text()).toBe('最新');
    expect(wrapper.find('.comment-row').text()).toContain('新评论');
  });

  it('未指定设置时默认评论排序为热门', () => {
    const wrapper = mountSection({}, {
      comments: [
        { id: 'c1', username: '评论1', message: '少赞', likenum: 1 },
        { id: 'c2', username: '评论2', message: '多赞', likenum: 99 },
      ],
    });
    const active = wrapper.find('.comment-sort-button.is-active');
    expect(active.text()).toBe('热门');
    expect(wrapper.find('.comment-row').text()).toContain('多赞');
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
