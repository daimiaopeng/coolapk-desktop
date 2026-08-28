/**
 * 由侧边栏直接进入、并在应用启动时保持挂载的主页面。
 *
 * 这里刻意只收录固定栏目路由，不包含带动态参数的详情页，避免启动时
 * 产生没有明确目标的请求，也让详情页继续由 RouterView 管理。
 */
export const SIDEBAR_PRELOAD_PATHS = [
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
] as const;

export type SidebarPreloadPath = typeof SIDEBAR_PRELOAD_PATHS[number];

export function isSidebarPreloadPath(path: string): path is SidebarPreloadPath {
  return (SIDEBAR_PRELOAD_PATHS as readonly string[]).includes(path);
}
