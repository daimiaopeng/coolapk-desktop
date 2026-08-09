const MEMORY_CACHE_LIMIT = 300;

type ResourceFetcher = (url: string) => Promise<string>;

const memoryCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string>>();
let cacheGeneration = 0;

/**
 * 统一图片地址，避免同一资源因为协议写法不同产生多份缓存。
 */
export function normalizeResourceUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice('http://'.length)}`;
  return trimmed;
}

/**
 * 所有 HTTP/HTTPS 图片都允许进入原生文件缓存，包括需要登录态的私信图片。
 */
export function canPersistResource(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function remember(url: string, value: string) {
  if (memoryCache.has(url)) memoryCache.delete(url);
  memoryCache.set(url, value);

  while (memoryCache.size > MEMORY_CACHE_LIMIT) {
    const oldestKey = memoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
}

/**
 * 读取全局内存缓存并合并相同资源的并发请求。
 * 持久缓存由原生图片请求层负责，避免 WebView 缓存故障阻塞图片显示。
 */
export async function loadImageResource(url: string, fetcher: ResourceFetcher): Promise<string> {
  const normalizedUrl = normalizeResourceUrl(url);
  const generation = cacheGeneration;
  if (!normalizedUrl) return '';
  if (normalizedUrl.startsWith('data:') || normalizedUrl.startsWith('blob:') || normalizedUrl.startsWith('/')) {
    return normalizedUrl;
  }

  const memoryValue = memoryCache.get(normalizedUrl);
  if (memoryValue) {
    remember(normalizedUrl, memoryValue);
    return memoryValue;
  }

  const pending = pendingRequests.get(normalizedUrl);
  if (pending) return pending;

  const request = (async () => {
    const fetchedValue = await fetcher(normalizedUrl);
    if (generation === cacheGeneration) {
      remember(normalizedUrl, fetchedValue);
    }
    return fetchedValue;
  })();

  pendingRequests.set(normalizedUrl, request);
  try {
    return await request;
  } finally {
    if (pendingRequests.get(normalizedUrl) === request) {
      pendingRequests.delete(normalizedUrl);
    }
  }
}

/**
 * 仅清理当前进程内的资源缓存，主要用于账号切换和测试隔离。
 */
export function clearResourceMemoryCache(): void {
  cacheGeneration += 1;
  memoryCache.clear();
  pendingRequests.clear();
}

/**
 * 清理当前进程内的图片缓存；原生文件缓存由后端统一清理。
 */
export async function clearResourceCache(): Promise<void> {
  clearResourceMemoryCache();
}
