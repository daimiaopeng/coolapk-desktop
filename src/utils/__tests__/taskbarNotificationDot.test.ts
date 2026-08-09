import { describe, expect, it } from 'vitest';
import { formatTaskbarBadgeLabel } from '../taskbarNotificationDot';

describe('Windows 任务栏通知数字', () => {
  it('没有未读时不显示数字', () => {
    expect(formatTaskbarBadgeLabel(0)).toBe('');
    expect(formatTaskbarBadgeLabel(-1)).toBe('');
  });

  it('显示实际未读数并将大数字限制为 99+', () => {
    expect(formatTaskbarBadgeLabel(1)).toBe('1');
    expect(formatTaskbarBadgeLabel(12)).toBe('12');
    expect(formatTaskbarBadgeLabel(99)).toBe('99');
    expect(formatTaskbarBadgeLabel(100)).toBe('99+');
  });
});
