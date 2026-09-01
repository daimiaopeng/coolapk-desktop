export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: 'fas fa-check-circle',
  error: 'fas fa-times-circle',
  warning: 'fas fa-exclamation-circle',
  info: 'fas fa-info-circle',
};

let toastContainer: HTMLElement | null = null;

function getToastContainer(): HTMLElement {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'app-toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(
  message: string,
  type: ToastType = 'success',
  duration: number = 2200,
  action?: ToastAction,
): void {
  if (!message || typeof window === 'undefined') return;

  const container = getToastContainer();
  const tip = document.createElement('div');
  tip.className = `app-toast${type === 'success' ? '' : ` is-${type}`}`;

  // 状态图标
  const icon = document.createElement('i');
  icon.className = `toast-icon ${TOAST_ICONS[type] || TOAST_ICONS.info}`;
  tip.appendChild(icon);

  // 文本内容
  const textSpan = document.createElement('span');
  textSpan.className = 'toast-text';
  textSpan.textContent = message;
  tip.appendChild(textSpan);

  const dismiss = () => {
    if (tip.classList.contains('is-leaving')) return;
    tip.classList.add('is-leaving');
    setTimeout(() => {
      tip.remove();
      if (container.childNodes.length === 0 && container.parentNode) {
        container.remove();
        toastContainer = null;
      }
    }, 220);
  };

  if (action) {
    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'app-toast-action';
    actionButton.textContent = action.label;
    actionButton.addEventListener('click', () => {
      try {
        action.onClick();
      } finally {
        dismiss();
      }
    });
    tip.appendChild(actionButton);
  }

  container.appendChild(tip);

  setTimeout(dismiss, duration);
}

/**
 * 全局拦截 window.alert，自动路由至高质感顶部 Toast 提示
 */
export function setupGlobalAlertProxy(): void {
  if (typeof window === 'undefined') return;
  window.alert = (message?: any) => {
    const text = message instanceof Error ? message.message : String(message ?? '');
    if (!text) return;
    let type: ToastType = 'info';
    if (
      text.includes('失败') ||
      text.includes('错误') ||
      text.includes('异常') ||
      text.includes('非法') ||
      text.includes('超时') ||
      text.includes('未通过')
    ) {
      type = 'error';
    } else if (
      text.includes('警告') ||
      text.includes('注意') ||
      text.includes('风险') ||
      text.includes('请先') ||
      text.includes('未登录')
    ) {
      type = 'warning';
    } else if (
      text.includes('成功') ||
      text.includes('完成') ||
      text.includes('已保存') ||
      text.includes('已复制') ||
      text.includes('已开启')
    ) {
      type = 'success';
    }
    showToast(text, type, 2800);
  };
}
