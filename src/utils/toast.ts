export function showToast(
  message: string,
  type: 'success' | 'error' = 'success',
  duration: number = 1500
): void {
  const tip = document.createElement('div');
  tip.className = `app-toast${type === 'error' ? ' is-error' : ''}`;
  tip.textContent = message;
  document.body.appendChild(tip);
  setTimeout(() => tip.remove(), duration);
}
