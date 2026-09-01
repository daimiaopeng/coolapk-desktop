import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast } from '../toast';

describe('toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('支持操作按钮并在点击后关闭提示', () => {
    const onClick = vi.fn();

    showToast('编码不支持', 'warning', 10000, { label: '不再提醒', onClick });

    const actionButton = document.querySelector<HTMLButtonElement>('.app-toast-action');
    expect(actionButton?.textContent).toBe('不再提醒');
    actionButton?.click();

    expect(onClick).toHaveBeenCalledOnce();
    expect(document.querySelector('.app-toast')?.classList.contains('is-leaving')).toBe(true);
    vi.advanceTimersByTime(220);
    expect(document.querySelector('.app-toast')).toBeNull();
  });
});
