import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canPersistResource,
  clearResourceCache,
  clearResourceMemoryCache,
  loadImageResource,
  normalizeResourceUrl,
} from '../resourceCache';

describe('资源缓存', () => {
  beforeEach(() => {
    clearResourceMemoryCache();
  });

  afterEach(() => {
    clearResourceMemoryCache();
    vi.restoreAllMocks();
  });

  it('统一资源地址并允许全部网络图片持久化', () => {
    expect(normalizeResourceUrl('//image.coolapk.com/a.png')).toBe('https://image.coolapk.com/a.png');
    expect(normalizeResourceUrl('http://image.coolapk.com/a.png')).toBe('https://image.coolapk.com/a.png');
    expect(canPersistResource('https://image.coolapk.com/a.png')).toBe(true);
    expect(canPersistResource('https://api.coolapk.com/v6/message/showImage?id=1')).toBe(true);
    expect(canPersistResource('file:///C:/secret.png')).toBe(false);
  });

  it('并发加载相同图片时只发起一次原生请求', async () => {
    let finish!: (value: string) => void;
    const fetcher = vi.fn(() => new Promise<string>((resolve) => {
      finish = resolve;
    }));
    const url = 'https://image.coolapk.com/feed/shared.png';

    const first = loadImageResource(url, fetcher);
    const second = loadImageResource(url, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    finish('data:image/png;base64,c2hhcmVk');

    await expect(Promise.all([first, second])).resolves.toEqual([
      'data:image/png;base64,c2hhcmVk',
      'data:image/png;base64,c2hhcmVk',
    ]);
  });

  it('同一进程内直接命中内存缓存', async () => {
    const fetcher = vi.fn().mockResolvedValue('data:image/png;base64,bWVtb3J5');
    const url = 'https://image.coolapk.com/feed/memory.png';

    await loadImageResource(url, fetcher);
    const cached = await loadImageResource(url, fetcher);

    expect(cached).toBe('data:image/png;base64,bWVtb3J5');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('清理内存后重新交给原生层读取持久缓存', async () => {
    const fetcher = vi.fn().mockResolvedValue('data:image/jpeg;base64,cHJpdmF0ZQ==');
    const url = 'https://api.coolapk.com/v6/message/showImage?id=1';

    await loadImageResource(url, fetcher);
    clearResourceMemoryCache();
    await loadImageResource(url, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('清理期间尚未完成的请求不会重新写回内存', async () => {
    let finish!: (value: string) => void;
    const fetcher = vi.fn(() => new Promise<string>((resolve) => {
      finish = resolve;
    }));
    const url = 'https://image.coolapk.com/feed/in-flight.png';

    const loading = loadImageResource(url, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await clearResourceCache();
    finish('data:image/png;base64,b2xk');
    await loading;

    const freshFetcher = vi.fn().mockResolvedValue('data:image/png;base64,bmV3');
    const reloaded = await loadImageResource(url, freshFetcher);
    expect(reloaded).toBe('data:image/png;base64,bmV3');
    expect(freshFetcher).toHaveBeenCalledTimes(1);
  });
});
