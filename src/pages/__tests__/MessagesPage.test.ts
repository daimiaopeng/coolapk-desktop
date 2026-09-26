import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  route: { query: { uid: '20002' } },
  listMessages: vi.fn(),
  listChatHistory: vi.fn(),
  sendPrivateMessage: vi.fn(),
  sendPrivateImage: vi.fn(),
  followUser: vi.fn(),
  uploadImage: vi.fn(),
  readMessage: vi.fn(),
  getPublicUserProfile: vi.fn(),
  showToast: vi.fn(),
  requestConfirmation: vi.fn(),
  createObjectURL: vi.fn(() => 'blob:http://localhost/test-preview'),
  revokeObjectURL: vi.fn(),
}));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useRouter: () => mocks.router,
    useRoute: () => mocks.route,
  };
});

vi.mock('../../router', () => ({
  router: mocks.router,
}));

vi.mock('../../utils/toast', () => ({
  showToast: mocks.showToast,
}));

vi.mock('../../utils/confirm', () => ({
  requestConfirmation: mocks.requestConfirmation,
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    listMessages: mocks.listMessages,
    listChatHistory: mocks.listChatHistory,
    sendPrivateMessage: mocks.sendPrivateMessage,
    sendPrivateImage: mocks.sendPrivateImage,
    followUser: mocks.followUser,
    uploadImage: mocks.uploadImage,
    readMessage: mocks.readMessage,
    getPublicUserProfile: mocks.getPublicUserProfile,
  },
}));

// Mock URL methods in jsdom
window.URL.createObjectURL = mocks.createObjectURL;
window.URL.revokeObjectURL = mocks.revokeObjectURL;

import MessagesPage from '../MessagesPage.vue';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';

describe('MessagesPage 粘贴图片发送功能', () => {
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const pinia = createPinia();
    setActivePinia(pinia);

    const authStore = useAuthStore(pinia);
    authStore.user = { uid: 10001, username: '测试用户' } as any;
    authStore.isLoggedIn = true;

    const testSession = {
      ukey: '10001_20002',
      id: '10001_20002',
      uid: 20002,
      fromuid: 10001,
      entityId: 20002,
      messageUid: 20002,
      messageUsername: '好友酷友',
      username: '好友酷友',
      message: '你好',
      dateline: 1700000000,
      isNewConversation: true,
    };

    sessionStorage.setItem('coolapk_message_sessions_10001', JSON.stringify([testSession]));
    mocks.listMessages.mockResolvedValue({ data: [testSession] });
    mocks.listChatHistory.mockResolvedValue({ data: [] });
    mocks.uploadImage.mockResolvedValue({ data: '/message/2026/09/test_image.jpg' });
    mocks.sendPrivateImage.mockResolvedValue({ data: [{ id: 999, message_pic: '/message/2026/09/test_image.jpg' }] });
    mocks.sendPrivateMessage.mockResolvedValue({ data: [{ id: 1000, message: '测试文本' }] });
    mocks.followUser.mockResolvedValue({ code: 200 });
    mocks.getPublicUserProfile.mockResolvedValue({ data: { isFollow: 0 } });
    mocks.requestConfirmation.mockResolvedValue(true);
    mocks.readMessage.mockResolvedValue({ code: 200 });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  async function mountMessagesPage() {
    wrapper = mount(MessagesPage, {
      global: {
        stubs: {
          AppAvatar: true,
          AppImage: true,
          EmptyState: true,
          LoadingState: true,
          ErrorState: true,
          AppButton: {
            props: ['loading', 'disabled', 'variant', 'size'],
            template: '<button class="app-btn" :disabled="disabled"><slot /></button>',
          },
        },
      },
    });

    await flushPromises();
    const sessionItem = wrapper.find('.session-item');
    if (sessionItem.exists()) {
      await sessionItem.trigger('click');
      await flushPromises();
    }
    return wrapper;
  }

  it('手机上可从聊天返回会话列表，同时保留当前会话', async () => {
    const w = await mountMessagesPage();

    expect(w.find('.messages-page').classes()).toContain('is-mobile-chat-active');
    expect(w.find('.mobile-session-back').exists()).toBe(true);

    await w.find('.mobile-session-back').trigger('click');

    expect(w.find('.messages-page').classes()).not.toContain('is-mobile-chat-active');
    expect(w.find('.messages-main').exists()).toBe(true);
  });

  it('只处理 APK 返回的 messageExtra/float 关注提示，并将数字 messageUid 转为字符串', async () => {
    const historySession = {
      ukey: '10001_20002',
      id: '10001_20002',
      uid: 20002,
      fromuid: 20002,
      entityId: 20002,
      messageUid: 20002,
      messageUsername: '好友酷友',
      username: '好友酷友',
      message: '你好',
      dateline: 1700000000,
      isNewConversation: false,
    };
    sessionStorage.setItem('coolapk_message_sessions_10001', JSON.stringify([historySession]));
    mocks.listMessages.mockResolvedValue({ data: [historySession] });
    mocks.listChatHistory.mockResolvedValue({
      data: [{ id: 'follow-tip-1', entityId: 'follow-tip-1', entityType: 'messageExtra', entityTemplate: 'float', title: '由于你未关注对方，你回复之前，ta只能给你发送3条私信' }],
    });

    const w = await mountMessagesPage();
    const followButton = w.find('.follow-action-btn');
    expect(followButton.exists()).toBe(true);
    expect(mocks.getPublicUserProfile).not.toHaveBeenCalled();

    await followButton.trigger('click');
    await flushPromises();

    expect(mocks.requestConfirmation).toHaveBeenCalledWith({
      title: '关注用户',
      message: '是否关注用户『好友酷友』？关注对方即可让TA与你无限制聊天',
      confirmText: '确认关注',
    });
    expect(mocks.followUser).toHaveBeenCalledWith('20002');
    expect(mocks.showToast).toHaveBeenCalledWith('关注成功', 'success');
    expect(w.find('.follow-action-btn').exists()).toBe(false);
  });

  it('普通 messageExtra 即使文本包含关注也不显示关注按钮', async () => {
    const historySession = {
      ukey: '10001_20002',
      id: '10001_20002',
      uid: 20002,
      fromuid: 20002,
      entityId: 20002,
      messageUid: 20002,
      messageUsername: '好友酷友',
      username: '好友酷友',
      message: '你好',
      dateline: 1700000000,
      isNewConversation: false,
    };
    sessionStorage.setItem('coolapk_message_sessions_10001', JSON.stringify([historySession]));
    mocks.listMessages.mockResolvedValue({ data: [historySession] });
    mocks.listChatHistory.mockResolvedValue({
      data: [{ id: 'notice-1', entityType: 'messageExtra', entityTemplate: 'time', message: '关注对方后可以继续互动' }],
    });

    const w = await mountMessagesPage();
    expect(w.find('.follow-action-btn').exists()).toBe(false);
    expect(mocks.followUser).not.toHaveBeenCalled();
  });

  it('APK 不查询 isFollow，服务端返回提示时直接调用关注接口', async () => {
    mocks.getPublicUserProfile.mockResolvedValue({ data: { isFollow: 1 } });
    mocks.listChatHistory.mockResolvedValue({
      data: [{ id: 'follow-tip-1', entityId: 'follow-tip-1', entityType: 'messageExtra', entityTemplate: 'float', title: '关注对方即可让TA与你无限制聊天' }],
    });
    const historySession = {
      ukey: '10001_20002',
      id: '10001_20002',
      uid: 20002,
      fromuid: 20002,
      entityId: 20002,
      messageUid: 20002,
      messageUsername: '好友酷友',
      username: '好友酷友',
      message: '你好',
      dateline: 1700000000,
      isNewConversation: false,
    };
    sessionStorage.setItem('coolapk_message_sessions_10001', JSON.stringify([historySession]));
    mocks.listMessages.mockResolvedValue({ data: [historySession] });

    const w = await mountMessagesPage();
    const followButton = w.find('.follow-action-btn');
    await followButton.trigger('click');
    await flushPromises();

    expect(mocks.getPublicUserProfile).not.toHaveBeenCalled();
    expect(mocks.followUser).toHaveBeenCalledWith('20002');
    expect(mocks.showToast).not.toHaveBeenCalledWith('已经关注过该酷友了，无需重复关注', 'info');
  });

  it('关注成功后只移除当前会话提示，切换会话不会误删其他会话提示', async () => {
    const firstSession = {
      ukey: '10001_20002',
      id: '10001_20002',
      uid: 20002,
      fromuid: 20002,
      entityId: 20002,
      messageUid: 20002,
      messageUsername: '好友酷友',
      username: '好友酷友',
      message: '你好',
      dateline: 1700000000,
      isNewConversation: false,
    };
    const secondSession = { ...firstSession, ukey: '10001_30003', id: '10001_30003', uid: 30003, messageUid: 30003, messageUsername: '另一个酷友', username: '另一个酷友' };
    let firstSessionFollowed = false;
    sessionStorage.setItem('coolapk_message_sessions_10001', JSON.stringify([firstSession, secondSession]));
    mocks.listMessages.mockResolvedValue({ data: [firstSession, secondSession] });
    mocks.followUser.mockImplementation(async () => {
      firstSessionFollowed = true;
      return { code: 200 };
    });
    mocks.listChatHistory.mockImplementation(async (ukey: string) => ({
      data: ukey === firstSession.ukey && firstSessionFollowed
        ? []
        : [{ id: 'follow-tip-1', entityId: 'follow-tip-1', entityType: 'messageExtra', entityTemplate: 'float', title: '关注对方即可让TA与你无限制聊天' }],
    }));

    const w = await mountMessagesPage();
    await w.find('.follow-action-btn').trigger('click');
    await flushPromises();
    expect(w.find('.follow-action-btn').exists()).toBe(false);

    const sessionItems = w.findAll('.session-item');
    await sessionItems[1].trigger('click');
    await flushPromises();
    expect(w.find('.follow-action-btn').exists()).toBe(true);

    await sessionItems[0].trigger('click');
    await flushPromises();

    expect(w.find('.follow-action-btn').exists()).toBe(false);
  });

  it('关注请求失败时保留提示并允许重试', async () => {
    mocks.followUser.mockRejectedValueOnce(new Error('关注失败'));
    const historySession = {
      ukey: '10001_20002',
      id: '10001_20002',
      uid: 20002,
      fromuid: 20002,
      entityId: 20002,
      messageUid: 20002,
      messageUsername: '好友酷友',
      username: '好友酷友',
      message: '你好',
      dateline: 1700000000,
      isNewConversation: false,
    };
    sessionStorage.setItem('coolapk_message_sessions_10001', JSON.stringify([historySession]));
    mocks.listMessages.mockResolvedValue({ data: [historySession] });
    mocks.listChatHistory.mockResolvedValue({
      data: [{ id: 'follow-tip-1', entityId: 'follow-tip-1', entityType: 'messageExtra', entityTemplate: 'float', title: '关注对方即可让TA与你无限制聊天' }],
    });

    const w = await mountMessagesPage();
    await w.find('.follow-action-btn').trigger('click');
    await flushPromises();

    expect(w.find('.follow-action-btn').exists()).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith('关注失败', 'error');

    await w.find('.follow-action-btn').trigger('click');
    await flushPromises();
    expect(mocks.followUser).toHaveBeenCalledTimes(2);
    expect(w.find('.follow-action-btn').exists()).toBe(false);
  });

  it('取消确认时不调用关注接口并保留提示', async () => {
    mocks.requestConfirmation.mockResolvedValueOnce(false);
    const historySession = {
      ukey: '10001_20002',
      id: '10001_20002',
      uid: 20002,
      fromuid: 20002,
      entityId: 20002,
      messageUid: 20002,
      messageUsername: '好友酷友',
      username: '好友酷友',
      message: '你好',
      dateline: 1700000000,
      isNewConversation: false,
    };
    sessionStorage.setItem('coolapk_message_sessions_10001', JSON.stringify([historySession]));
    mocks.listMessages.mockResolvedValue({ data: [historySession] });
    mocks.listChatHistory.mockResolvedValue({
      data: [{ id: 'follow-tip-1', entityId: 'follow-tip-1', entityType: 'messageExtra', entityTemplate: 'float', title: '关注对方即可让TA与你无限制聊天' }],
    });

    const w = await mountMessagesPage();
    await w.find('.follow-action-btn').trigger('click');
    await flushPromises();

    expect(mocks.followUser).not.toHaveBeenCalled();
    expect(w.find('.follow-action-btn').exists()).toBe(true);
  });

  it('关注请求进行中阻止重复提交', async () => {
    let resolveFollow!: (value: unknown) => void;
    mocks.followUser.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFollow = resolve;
    }));
    const historySession = {
      ukey: '10001_20002',
      id: '10001_20002',
      uid: 20002,
      fromuid: 20002,
      entityId: 20002,
      messageUid: 20002,
      messageUsername: '好友酷友',
      username: '好友酷友',
      message: '你好',
      dateline: 1700000000,
      isNewConversation: false,
    };
    sessionStorage.setItem('coolapk_message_sessions_10001', JSON.stringify([historySession]));
    mocks.listMessages.mockResolvedValue({ data: [historySession] });
    mocks.listChatHistory.mockResolvedValue({
      data: [{ id: 'follow-tip-1', entityId: 'follow-tip-1', entityType: 'messageExtra', entityTemplate: 'float', title: '关注对方即可让TA与你无限制聊天' }],
    });

    const w = await mountMessagesPage();
    const followButton = w.find('.follow-action-btn');
    await followButton.trigger('click');
    await followButton.trigger('click');
    expect(mocks.followUser).toHaveBeenCalledTimes(1);

    resolveFollow({ code: 200 });
    await flushPromises();
    expect(w.find('.follow-action-btn').exists()).toBe(false);
  });

  it('支持在输入框粘贴图片，展示待发送图片缩略图并启用发送按钮', async () => {
    const w = await mountMessagesPage();
    const editor = w.find('.message-rich-editor');
    expect(editor.exists()).toBe(true);

    const sendBtn = w.find('.input-actions .app-btn');
    expect(sendBtn.attributes('disabled')).toBeDefined();

    const fakeImageFile = new File(['fake content'], 'screenshot.png', { type: 'image/png' });
    await editor.trigger('paste', {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => fakeImageFile,
          },
        ],
        files: [],
        getData: () => '',
      },
    });

    // 预览区域展示待发送图片
    const previewBar = w.find('.pending-images-bar');
    expect(previewBar.exists()).toBe(true);
    expect(w.findAll('.pending-image-card')).toHaveLength(1);

    // 发送按钮被启用
    expect(sendBtn.attributes('disabled')).toBeUndefined();
  });

  it('点击移除按钮可删除待发送图片', async () => {
    const w = await mountMessagesPage();
    const editor = w.find('.message-rich-editor');

    const fakeImageFile = new File(['fake'], 'test.png', { type: 'image/png' });
    await editor.trigger('paste', {
      clipboardData: {
        items: [{ type: 'image/png', getAsFile: () => fakeImageFile }],
        files: [],
        getData: () => '',
      },
    });

    expect(w.findAll('.pending-image-card')).toHaveLength(1);

    const removeBtn = w.find('.pending-image-remove-btn');
    await removeBtn.trigger('click');

    expect(w.findAll('.pending-image-card')).toHaveLength(0);
    expect(mocks.revokeObjectURL).toHaveBeenCalled();

    // 发送按钮重新禁用
    const sendBtn = w.find('.input-actions .app-btn');
    expect(sendBtn.attributes('disabled')).toBeDefined();
  });

  it('空输入框按退格键可移除最后一张待发送图片', async () => {
    const w = await mountMessagesPage();
    const editor = w.find('.message-rich-editor');

    const fakeImageFile = new File(['fake'], 'test.png', { type: 'image/png' });
    await editor.trigger('paste', {
      clipboardData: {
        items: [{ type: 'image/png', getAsFile: () => fakeImageFile }],
        files: [],
        getData: () => '',
      },
    });

    expect(w.findAll('.pending-image-card')).toHaveLength(1);

    await editor.trigger('keydown', { key: 'Backspace' });
    expect(w.findAll('.pending-image-card')).toHaveLength(0);
  });

  it('点击发送或按回车时上传并发送已粘贴的图片', async () => {
    const w = await mountMessagesPage();
    const editor = w.find('.message-rich-editor');

    const fakeImageFile = new File(['fake image bytes'], 'pasted_photo.png', { type: 'image/png' });
    await editor.trigger('paste', {
      clipboardData: {
        items: [{ type: 'image/png', getAsFile: () => fakeImageFile }],
        files: [],
        getData: () => '',
      },
    });

    const sendBtn = w.find('.input-actions .app-btn');
    expect(sendBtn.attributes('disabled')).toBeUndefined();

    await sendBtn.trigger('click');
    await flushPromises();

    expect(mocks.uploadImage).toHaveBeenCalledTimes(1);
    expect(mocks.sendPrivateImage).toHaveBeenCalledWith('20002', '/message/2026/09/test_image.jpg');

    // 图片发送后，待发送列表清空
    expect(w.findAll('.pending-image-card')).toHaveLength(0);
  });

  it('支持同时存在待发送图片与文本内容时顺序发送图片与文本', async () => {
    const w = await mountMessagesPage();
    const editor = w.find('.message-rich-editor');

    const fakeImageFile = new File(['fake image bytes'], 'pasted_photo.png', { type: 'image/png' });
    await editor.trigger('paste', {
      clipboardData: {
        items: [{ type: 'image/png', getAsFile: () => fakeImageFile }],
        files: [],
        getData: () => '',
      },
    });

    // 粘贴一段文本
    await editor.trigger('paste', {
      clipboardData: {
        items: [],
        files: [],
        getData: (format: string) => (format === 'text/plain' ? '请查看此截图' : ''),
      },
    });

    const sendBtn = w.find('.input-actions .app-btn');
    expect(sendBtn.attributes('disabled')).toBeUndefined();

    await sendBtn.trigger('click');
    await flushPromises();

    expect(mocks.uploadImage).toHaveBeenCalledTimes(1);
    expect(mocks.sendPrivateImage).toHaveBeenCalledWith('20002', '/message/2026/09/test_image.jpg');
    expect(mocks.sendPrivateMessage).toHaveBeenCalledWith('20002', '请查看此截图');
    expect(w.findAll('.pending-image-card')).toHaveLength(0);
  });

  it('默认按 Enter 发送私信', async () => {
    const w = await mountMessagesPage();
    const editor = w.find('.message-rich-editor');
    editor.element.textContent = '测试消息';
    await editor.trigger('input');

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    editor.element.dispatchEvent(event);
    await flushPromises();

    expect(event.defaultPrevented).toBe(true);
    expect(mocks.sendPrivateMessage).toHaveBeenCalledWith('20002', '测试消息');
  });

  it('切换为换行模式后按 Enter 换行，按 Ctrl+Enter 发送私信', async () => {
    const w = await mountMessagesPage();
    const settingsStore = useSettingsStore();
    settingsStore.settings.messageEnterBehavior = 'newline';
    const editor = w.find('.message-rich-editor');
    editor.element.textContent = '测试消息';
    await editor.trigger('input');

    const newlineEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    editor.element.dispatchEvent(newlineEvent);
    expect(newlineEvent.defaultPrevented).toBe(false);
    expect(mocks.sendPrivateMessage).not.toHaveBeenCalled();

    const sendEvent = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true });
    editor.element.dispatchEvent(sendEvent);
    await flushPromises();

    expect(sendEvent.defaultPrevented).toBe(true);
    expect(mocks.sendPrivateMessage).toHaveBeenCalledWith('20002', '测试消息');
  });

  it('向上滚动时按 APK 游标加载更早消息并保持消息顺序', async () => {
    const historySession = {
      ukey: '10001_20002',
      id: '10001_20002',
      uid: 20002,
      fromuid: 20002,
      entityId: 20002,
      messageUid: 20002,
      messageUsername: '好友酷友',
      username: '好友酷友',
      message: '最新消息',
      dateline: 3,
      isNewConversation: false,
    };
    sessionStorage.setItem('coolapk_message_sessions_10001', JSON.stringify([historySession]));
    mocks.listMessages.mockResolvedValue({ data: [historySession] });
    mocks.listChatHistory.mockImplementation(async (_ukey: string, page: number) => {
      if (page === 1) {
        return {
          data: [
            { id: 'm2', entityId: 'm2', entityType: 'message', message: '中间消息', dateline: 2, fromuid: 20002 },
            { id: 'm3', entityId: 'm3', entityType: 'message', message: '最新消息', dateline: 3, fromuid: 20002 },
          ],
        };
      }
      return {
        data: [{ id: 'm1', entityId: 'm1', entityType: 'message', message: '最早消息', dateline: 1, fromuid: 20002 }],
      };
    });

    const w = await mountMessagesPage();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const chatArea = w.find('.chat-area');
    const chatAreaElement = chatArea.element as HTMLElement;
    let scrollHeight = 200;
    Object.defineProperty(chatAreaElement, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(chatAreaElement, 'clientHeight', { configurable: true, value: 100 });
    chatAreaElement.scrollTop = 0;
    await chatArea.trigger('scroll');
    scrollHeight = 300;
    await flushPromises();

    expect(mocks.listChatHistory).toHaveBeenNthCalledWith(2, '10001_20002', 2, 'm2', '');
    expect(w.findAll('.message-item')).toHaveLength(3);
    expect(w.findAll('.msg-text').map((item: any) => item.text())).toEqual(['最早消息', '中间消息', '最新消息']);
    expect(chatAreaElement.scrollTop).toBe(100);
  });
});
