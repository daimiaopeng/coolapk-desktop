import { nextTick } from 'vue';

type ScrollPosition = {
  top: number;
  left: number;
};

const routeScrollPositions = new Map<string, ScrollPosition[]>();

/** 收集当前页面内容区内所有可滚动容器。 */
function getScrollContainers(): HTMLElement[] {
  if (typeof document === 'undefined') return [];
  const root = document.querySelector<HTMLElement>('.app-main-content');
  if (!root) return [];

  return [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].filter((element) => {
    const style = window.getComputedStyle(element);
    const canScroll = /(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`);
    return canScroll || element.scrollTop !== 0 || element.scrollLeft !== 0;
  });
}

/** 在路由离开前保存页面内各滚动容器的位置。 */
export function saveRouteScrollPosition(routeKey: string): void {
  if (!routeKey) return;
  const positions = getScrollContainers().map((element) => ({
    top: element.scrollTop,
    left: element.scrollLeft,
  }));
  routeScrollPositions.set(routeKey, positions);
}

/** 在缓存页面重新显示后恢复全部滚动位置。 */
export async function restoreRouteScrollPosition(routeKey: string): Promise<void> {
  const positions = routeScrollPositions.get(routeKey);
  if (!positions) return;

  await nextTick();
  requestAnimationFrame(() => {
    const restore = () => {
      const containers = getScrollContainers();
      positions.forEach((position, index) => {
        const container = containers[index];
        if (!container) return;
        container.scrollTop = position.top;
        container.scrollLeft = position.left;
      });
    };

    restore();
    requestAnimationFrame(restore);
  });
}
