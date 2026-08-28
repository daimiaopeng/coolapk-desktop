/**
 * src/utils/selection.ts
 *
 * 全局文本选区辅助工具：
 * 解决因为全局 user-select: none 导致点击空白区域时浏览器不自动取消选中的问题。
 */

export function hasActiveTextSelection(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  return selection.toString().trim().length > 0;
}

export function isPointInsideSelection(selection: Selection, x: number, y: number): boolean {
  if (selection.rangeCount === 0) return false;
  try {
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      // 允许 2px 的边缘容差
      if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export function handleSelectionClearOnPointerDown(e: MouseEvent): void {
  // 仅在鼠标左键按下时处理
  if (e.button !== 0) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  // 输入框、文本域或富文本编辑区保持原生选区和光标处理
  if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return;
  }

  // 点击在右键菜单内部时不清除选区
  if (target.closest?.('.app-context-menu')) {
    return;
  }

  // 点击在已有文字选区外时，主动清除选区
  if (!isPointInsideSelection(selection, e.clientX, e.clientY)) {
    selection.removeAllRanges();
  }
}

export function registerGlobalSelectionClear(): () => void {
  const handler = (e: MouseEvent) => handleSelectionClearOnPointerDown(e);
  // 使用捕获阶段确保即使子元素 stopPropagation 也能在点击空白时清除选区
  window.addEventListener('pointerdown', handler, true);
  return () => {
    window.removeEventListener('pointerdown', handler, true);
  };
}
