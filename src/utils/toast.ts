export type ToastType = 'success' | 'error' | 'warning' | 'info';

export function showToast(
  message: string,
  type: ToastType = 'success',
  duration: number = 1500
): void {
  const tip = document.createElement('div');
  tip.className = `app-toast${type === 'success' ? '' : ` is-${type}`}`;
  tip.textContent = message;
  document.body.appendChild(tip);
  setTimeout(() => tip.remove(), duration);
}
