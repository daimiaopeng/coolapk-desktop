import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isPointInsideSelection, handleSelectionClearOnPointerDown, registerGlobalSelectionClear, hasActiveTextSelection } from '../selection';

describe('selection utils', () => {
  let removeAllRangesMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    removeAllRangesMock = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false for isPointInsideSelection when point is outside selection rects', () => {
    const mockSelection = {
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => ({
        getClientRects: () => [
          { left: 100, top: 100, right: 200, bottom: 120 },
        ],
      }),
      removeAllRanges: removeAllRangesMock,
    } as unknown as Selection;

    expect(isPointInsideSelection(mockSelection, 50, 50)).toBe(false);
    expect(isPointInsideSelection(mockSelection, 150, 110)).toBe(true);
  });

  it('should clear selection when pointer down outside selection', () => {
    const mockSelection = {
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => ({
        getClientRects: () => [
          { left: 100, top: 100, right: 200, bottom: 120 },
        ],
      }),
      removeAllRanges: removeAllRangesMock,
    } as unknown as Selection;

    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

    const div = document.createElement('div');
    const event = new MouseEvent('pointerdown', {
      button: 0,
      clientX: 300,
      clientY: 300,
    });
    Object.defineProperty(event, 'target', { value: div });

    handleSelectionClearOnPointerDown(event);
    expect(removeAllRangesMock).toHaveBeenCalledTimes(1);
  });

  it('should not clear selection when clicking inside selection rects', () => {
    const mockSelection = {
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => ({
        getClientRects: () => [
          { left: 100, top: 100, right: 200, bottom: 120 },
        ],
      }),
      removeAllRanges: removeAllRangesMock,
    } as unknown as Selection;

    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

    const div = document.createElement('div');
    const event = new MouseEvent('pointerdown', {
      button: 0,
      clientX: 150,
      clientY: 110,
    });
    Object.defineProperty(event, 'target', { value: div });

    handleSelectionClearOnPointerDown(event);
    expect(removeAllRangesMock).not.toHaveBeenCalled();
  });

  it('should not clear selection on non-left-click', () => {
    const mockSelection = {
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => ({
        getClientRects: () => [
          { left: 100, top: 100, right: 200, bottom: 120 },
        ],
      }),
      removeAllRanges: removeAllRangesMock,
    } as unknown as Selection;

    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

    const div = document.createElement('div');
    const event = new MouseEvent('pointerdown', {
      button: 2, // 右键
      clientX: 300,
      clientY: 300,
    });
    Object.defineProperty(event, 'target', { value: div });

    handleSelectionClearOnPointerDown(event);
    expect(removeAllRangesMock).not.toHaveBeenCalled();
  });

  it('should not clear selection when target is an INPUT element', () => {
    const mockSelection = {
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => ({
        getClientRects: () => [
          { left: 100, top: 100, right: 200, bottom: 120 },
        ],
      }),
      removeAllRanges: removeAllRangesMock,
    } as unknown as Selection;

    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

    const input = document.createElement('input');
    const event = new MouseEvent('pointerdown', {
      button: 0,
      clientX: 300,
      clientY: 300,
    });
    Object.defineProperty(event, 'target', { value: input });

    handleSelectionClearOnPointerDown(event);
    expect(removeAllRangesMock).not.toHaveBeenCalled();
  });

  it('should register and unregister pointerdown event listener', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const unregister = registerGlobalSelectionClear();
    expect(addEventListenerSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);

    unregister();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
  });

  it('should correctly detect active text selection with hasActiveTextSelection', () => {
    // 无选区
    vi.spyOn(window, 'getSelection').mockReturnValue(null);
    expect(hasActiveTextSelection()).toBe(false);

    // 空折叠选区
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: true,
      toString: () => '',
    } as unknown as Selection);
    expect(hasActiveTextSelection()).toBe(false);

    // 有选中文本
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => '选中的文字内容',
    } as unknown as Selection);
    expect(hasActiveTextSelection()).toBe(true);
  });
});
