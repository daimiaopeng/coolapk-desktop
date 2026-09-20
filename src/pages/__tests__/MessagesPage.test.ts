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
  uploadImage: vi.fn(),
  readMessage: vi.fn(),
  getUserProfile: vi.fn(),
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

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    listMessages: mocks.listMessages,
    listChatHistory: mocks.listChatHistory,
    sendPrivateMessage: mocks.sendPrivateMessage,
    sendPrivateImage: mocks.sendPrivateImage,
    uploadImage: mocks.uploadImage,
    readMessage: mocks.readMessage,
    getUserProfile: mocks.getUserProfile,
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
});
