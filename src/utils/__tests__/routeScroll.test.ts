import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreRouteScrollPosition, saveRouteScrollPosition } from '../routeScroll';

describe('route scroll restoration', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('restores the recorded page scroll container without scanning every descendant style', async () => {
    const root = document.createElement('main');
    root.className = 'app-main-content';
    const page = document.createElement('section');
    page.className = 'page-container';
    for (let index = 0; index < 100; index += 1) page.append(document.createElement('div'));
    root.append(page);
    document.body.append(root);

    Object.defineProperties(page, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 600 },
    });
    page.scrollTop = 240;

    const getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle');
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    saveRouteScrollPosition('/scroll-test');
    page.scrollTop = 0;
    await restoreRouteScrollPosition('/scroll-test');

    expect(page.scrollTop).toBe(240);
    expect(getComputedStyleSpy).not.toHaveBeenCalled();
  });
});
