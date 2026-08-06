import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';

/**
 * 全局快捷键注册：
 *  - Ctrl+N 发布动态
 *  - Ctrl+, 打开设置
 *  - Ctrl+R 刷新当前信息流（派发 refresh-feeds 事件，由列表页监听）
 *  - J / K 上下一条动态（派发 feed-nav-next / feed-nav-prev，由首页监听）
 *  - Ctrl+K / Esc 由 SearchCommand 及各浮层组件自行处理
 * 焦点在输入框/文本域/下拉框时忽略 J/K 等单键快捷键。
 */
export function registerGlobalHotkeys() {
  const router = useRouter();

  function isTypingTarget(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  function handleKeydown(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      useAppStore().openPublish();
      return;
    }

    if (ctrl && e.key === ',') {
      e.preventDefault();
      router.push('/settings/startup');
      return;
    }

    if (ctrl && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      window.dispatchEvent(new Event('refresh-feeds'));
      return;
    }

    if (isTypingTarget(e)) return;
    const key = e.key.toLowerCase();
    if (key === 'j') {
      e.preventDefault();
      window.dispatchEvent(new Event('feed-nav-next'));
    } else if (key === 'k') {
      e.preventDefault();
      window.dispatchEvent(new Event('feed-nav-prev'));
    }
  }

  window.addEventListener('keydown', handleKeydown);
  return () => window.removeEventListener('keydown', handleKeydown);
}
