import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import {
  canNavigateBack,
  canNavigateForward,
  navigateBack,
  navigateForward,
  reloadCurrentPage,
} from '../navigation';

function createRouterState(back: unknown, forward: unknown) {
  return {
    options: {
      history: {
        state: { back, forward },
      },
    },
    back: vi.fn(),
    forward: vi.fn(),
    replace: vi.fn().mockResolvedValue(undefined),
  } as unknown as Router;
}

describe('全局页面导航', () => {
  it('根据历史状态判断后退和前进是否可用', () => {
    const router = createRouterState('/feeds', '/user/1');
    expect(canNavigateBack(router)).toBe(true);
    expect(canNavigateForward(router)).toBe(true);

    const emptyRouter = createRouterState(null, null);
    expect(canNavigateBack(emptyRouter)).toBe(false);
    expect(canNavigateForward(emptyRouter)).toBe(false);
  });

  it('后退与前进调用路由历史栈', () => {
    const router = createRouterState('/feeds', '/user/1');
    navigateBack(router);
    navigateForward(router);

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.forward).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('没有上一页时使用兜底页面且不会错误前进', () => {
    const router = createRouterState(null, null);
    navigateBack(router, '/discover');
    navigateForward(router);

    expect(router.replace).toHaveBeenCalledWith('/discover');
    expect(router.forward).not.toHaveBeenCalled();
  });

  it('刷新按钮调用当前页面刷新', () => {
    const reload = vi.fn();
    reloadCurrentPage({ reload });
    expect(reload).toHaveBeenCalledOnce();
  });
});
