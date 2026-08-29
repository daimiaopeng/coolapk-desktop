import { nextTick } from 'vue';

type ScrollPosition = {
  element: HTMLElement;
  top: number;
  left: number;
};

const routeScrollPositions = new Map<string, ScrollPosition[]>();
const SCROLL_CONTAINER_SELECTOR = '[data-route-scroll], .custom-scrollbar';
let restoreGeneration = 0;
let firstRestoreFrame: number | null = null;
let secondRestoreFrame: number | null = null;

/**
 * 收集页面级滚动容器。
 *
 * 不能遍历全部后代节点再读取 getComputedStyle：动态流页面常有数千节点，
 * 高速切路由时这会迫使渲染线程反复进行整页样式计算。
 */
function getScrollContainers(): HTMLElement[] {
  if (typeof document === 'undefined') return [];
  const root = document.querySelector<HTMLElement>('.app-main-content');
  if (!root) return [];

  const candidates = [
    root,
    ...Array.from(root.children).filter((element): element is HTMLElement => element instanceof HTMLElement),
    ...Array.from(root.querySelectorAll<HTMLElement>(SCROLL_CONTAINER_SELECTOR)),
  ];

  return [...new Set(candidates)].filter((element) => (
    element.scrollHeight > element.clientHeight
    || element.scrollWidth > element.clientWidth
    || element.scrollTop !== 0
    || element.scrollLeft !== 0
  ));
}

/** 在路由离开前保存页面内各滚动容器的位置。 */
export function saveRouteScrollPosition(routeKey: string): void {
  if (!routeKey) return;
  const positions = getScrollContainers().map((element) => ({
    element,
    top: element.scrollTop,
    left: element.scrollLeft,
  }));
  routeScrollPositions.set(routeKey, positions);
}

/** 在缓存页面重新显示后恢复全部滚动位置。 */
export async function restoreRouteScrollPosition(routeKey: string): Promise<void> {
  const positions = routeScrollPositions.get(routeKey);
  if (!positions) return;

  const generation = ++restoreGeneration;
  await nextTick();
  if (generation !== restoreGeneration) return;

  if (firstRestoreFrame !== null) cancelAnimationFrame(firstRestoreFrame);
  if (secondRestoreFrame !== null) cancelAnimationFrame(secondRestoreFrame);

  const restore = () => {
    if (generation !== restoreGeneration) return;
    positions.forEach(({ element, top, left }) => {
      // keep-alive 会暂时移出非活动页面；仅在节点重新挂载后恢复。
      if (!element.isConnected) return;
      element.scrollTop = top;
      element.scrollLeft = left;
    });
  };

  firstRestoreFrame = requestAnimationFrame(() => {
    firstRestoreFrame = null;
    restore();
    secondRestoreFrame = requestAnimationFrame(() => {
      secondRestoreFrame = null;
      restore();
    });
  });
}
