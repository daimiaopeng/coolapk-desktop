import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppContextMenu from '../AppContextMenu.vue';

const mocks = vi.hoisted(() => ({
  writeText: vi.fn().mockResolvedValue(undefined),
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ fullPath: '/' }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    go: vi.fn(),
  }),
}));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    openUrl: mocks.openUrl,
    saveImage: vi.fn(),
  },
}));

describe('AppContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: mocks.writeText,
      },
    });
  });

  it('右键私信消息时展示复制选项并正确复制消息全文', async () => {
    const wrapper = mount(AppContextMenu, {
      attachTo: document.body,
    });

    const msgContainer = document.createElement('div');
    msgContainer.setAttribute('data-context-kind', 'chat-message');
    msgContainer.setAttribute('data-context-message-text', '这是测试私信消息文本');
    msgContainer.setAttribute('data-context-message-id', '1001');

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = '这是测试私信消息文本';
    msgContainer.appendChild(bubble);
    document.body.appendChild(msgContainer);

    // 触发右键菜单
    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 300,
    });
    bubble.dispatchEvent(contextMenuEvent);

    await wrapper.vm.$nextTick();

    const menu = document.querySelector('.app-context-menu');
    expect(menu).not.toBeNull();

    const copyItem = Array.from(document.querySelectorAll('.context-menu-item')).find(
      (el) => el.textContent?.includes('复制')
    );
    expect(copyItem).toBeDefined();

    (copyItem as HTMLElement).click();
    expect(mocks.writeText).toHaveBeenCalledWith('这是测试私信消息文本');

    document.body.removeChild(msgContainer);
    wrapper.unmount();
  });

  it('私信消息中有选中文本时右键优先复制选中文字', async () => {
    const wrapper = mount(AppContextMenu, {
      attachTo: document.body,
    });

    const msgContainer = document.createElement('div');
    msgContainer.setAttribute('data-context-kind', 'chat-message');
    msgContainer.setAttribute('data-context-message-text', '是这个理解对吗');
    msgContainer.setAttribute('data-context-message-id', '1002');

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = '是这个理解对吗';
    msgContainer.appendChild(bubble);
    document.body.appendChild(msgContainer);

    // 模拟选中文本 "理解"
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => '理解',
    } as unknown as Selection);

    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 300,
    });
    bubble.dispatchEvent(contextMenuEvent);

    await wrapper.vm.$nextTick();

    const items = Array.from(document.querySelectorAll('.context-menu-item')).map((el) => el.textContent?.trim());
    expect(items.some((text) => text?.includes('复制'))).toBe(true);
    expect(items.some((text) => text?.includes('复制全文'))).toBe(true);

    const copySelectionItem = Array.from(document.querySelectorAll('.context-menu-item')).find(
      (el) => el.querySelector('span')?.textContent?.trim() === '复制'
    );
    expect(copySelectionItem).toBeDefined();

    (copySelectionItem as HTMLElement).click();
    expect(mocks.writeText).toHaveBeenCalledWith('理解');

    document.body.removeChild(msgContainer);
    wrapper.unmount();
  });
});
