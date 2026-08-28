import { describe, expect, it } from 'vitest';
import { SIDEBAR_PRELOAD_PATHS, isSidebarPreloadPath } from '../sidebarPreload';

describe('侧边栏页面预加载路由', () => {
  it('覆盖侧边栏固定栏目且不包含详情页', () => {
    expect(SIDEBAR_PRELOAD_PATHS).toEqual([
      '/',
      '/digital',
      '/discover',
      '/topics',
      '/pictures',
      '/apps',
      '/more',
      '/notifications',
      '/messages',
      '/history',
      '/favorites',
      '/following',
      '/my',
    ]);
    expect(isSidebarPreloadPath('/feed/123')).toBe(false);
    expect(isSidebarPreloadPath('/settings/appearance')).toBe(false);
  });

  it('按路由 path 识别固定栏目', () => {
    expect(isSidebarPreloadPath('/messages')).toBe(true);
    expect(isSidebarPreloadPath('/notifications')).toBe(true);
  });
});
