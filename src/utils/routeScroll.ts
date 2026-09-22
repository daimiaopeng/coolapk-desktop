import { nextTick } from 'vue';

type ScrollPosition = {
  key: string;
  top: number;
  left: number;
  anchor?: ScrollAnchor;
};

type ScrollAnchor = {
  attribute: 'data-feed-id' | 'data-entity-id' | 'data-id';
  value: string;
  offset: number;
};

const routeScrollPositions = new Map<string, ScrollPosition[]>();
const SCROLL_CONTAINER_SELECTOR = '[data-route-scroll], .custom-scrollbar';
const SEMANTIC_ANCHOR_SELECTOR = '[data-feed-id], [data-entity-id], [data-id]';
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
  const root = document.querySelector<HTMLElement>('[data-route-surface], .app-main-content');
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

function getScrollKey(element: HTMLElement, index: number): string {
  const explicit = element.dataset.routeScrollKey || element.getAttribute('data-route-scroll');
  if (explicit) return explicit;
  if (index === 0) return 'root';

  const className = typeof element.className === 'string'
    ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
    : '';
  return `${element.tagName.toLowerCase()}:${className || index}`;
}

function getSemanticAnchor(element: HTMLElement): ScrollAnchor | undefined {
  const containerRect = element.getBoundingClientRect();
  const candidates: HTMLElement[] = [];
  if (element.matches(SEMANTIC_ANCHOR_SELECTOR)) candidates.push(element);
  candidates.push(...Array.from(element.querySelectorAll<HTMLElement>(SEMANTIC_ANCHOR_SELECTOR)));

  const visible = candidates
    .map((candidate) => ({ candidate, rect: candidate.getBoundingClientRect() }))
    .filter(({ rect }) => rect.bottom >= containerRect.top)
    .sort((left, right) => left.rect.top - right.rect.top)[0];
  if (!visible) return undefined;

  const attribute = visible.candidate.hasAttribute('data-feed-id')
    ? 'data-feed-id'
    : visible.candidate.hasAttribute('data-entity-id')
      ? 'data-entity-id'
      : 'data-id';
  const value = visible.candidate.getAttribute(attribute);
  if (!value) return undefined;

  return {
    attribute,
    value,
    offset: visible.rect.top - containerRect.top,
  };
}

function findSemanticAnchor(element: HTMLElement, anchor: ScrollAnchor): HTMLElement | undefined {
  if (element.getAttribute(anchor.attribute) === anchor.value) return element;
  return Array.from(element.querySelectorAll<HTMLElement>(SEMANTIC_ANCHOR_SELECTOR))
    .find((candidate) => candidate.getAttribute(anchor.attribute) === anchor.value);
}

/** 在路由离开前保存页面内各滚动容器的位置。 */
export function saveRouteScrollPosition(routeKey: string): void {
  if (!routeKey) return;
  const positions = getScrollContainers().map((element, index) => ({
    key: getScrollKey(element, index),
    top: element.scrollTop,
    left: element.scrollLeft,
    anchor: getSemanticAnchor(element),
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
    const currentContainers = getScrollContainers();
    const currentByKey = new Map(currentContainers.map((element, index) => [getScrollKey(element, index), element]));
    positions.forEach(({ key, top, left, anchor }, index) => {
      // Presentation 切换会用另一套 DOM 替换旧容器，因此按显式语义 key
      // 优先恢复，旧版没有匹配 key 时退回到相同的容器序号。
      const element = currentByKey.get(key) || currentContainers[index];
      if (!element) return;
      element.scrollTop = top;
      element.scrollLeft = left;

      // A Mobile card can be taller or narrower than its Desktop counterpart;
      // use the same visible entity as the primary anchor when it still exists,
      // and keep scrollTop as the fallback for generic pages.
      if (anchor) {
        const currentAnchor = findSemanticAnchor(element, anchor);
        if (currentAnchor) {
          const currentOffset = currentAnchor.getBoundingClientRect().top - element.getBoundingClientRect().top;
          const delta = currentOffset - anchor.offset;
          if (Number.isFinite(delta) && Math.abs(delta) > 0.5) element.scrollTop += delta;
        }
      }
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
