import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  triggerSidebarTransition,
  resetSidebarTransition,
  useSidebarTransition,
} from '../routeTransition';

describe('routeTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSidebarTransition();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSidebarTransition();
  });

  it('初始状态下侧边栏动效为未激活', () => {
    const { isSidebarTransitionActive } = useSidebarTransition();
    expect(isSidebarTransitionActive.value).toBe(false);
  });

  it('调用 triggerSidebarTransition 后激活动效并在超时后自动复位', () => {
    const { isSidebarTransitionActive } = useSidebarTransition();
    triggerSidebarTransition(500);
    expect(isSidebarTransitionActive.value).toBe(true);

    vi.advanceTimersByTime(499);
    expect(isSidebarTransitionActive.value).toBe(true);

    vi.advanceTimersByTime(2);
    expect(isSidebarTransitionActive.value).toBe(false);
  });

  it('手动调用 resetSidebarTransition 能立即复位状态并清理定时器', () => {
    const { isSidebarTransitionActive } = useSidebarTransition();
    triggerSidebarTransition(500);
    expect(isSidebarTransitionActive.value).toBe(true);

    resetSidebarTransition();
    expect(isSidebarTransitionActive.value).toBe(false);

    vi.advanceTimersByTime(600);
    expect(isSidebarTransitionActive.value).toBe(false);
  });
});
