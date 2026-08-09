import { CoolapkTauriAPI } from '../api/coolapk';
import { getFeedDetailMessage } from './feedContent';

const MAX_CONCURRENT_REQUESTS = 3;

type QueueTask = {
  run: () => Promise<void>;
};

const fullTextCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string>>();
const requestQueue: QueueTask[] = [];
let activeRequestCount = 0;

function runNextRequests() {
  while (activeRequestCount < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
    const task = requestQueue.shift();
    if (!task) return;
    activeRequestCount += 1;
    void task.run().finally(() => {
      activeRequestCount -= 1;
      runNextRequests();
    });
  }
}

function enqueueRequest<T>(loader: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push({
      run: async () => {
        try {
          resolve(await loader());
        } catch (error) {
          reject(error);
        }
      },
    });
    runNextRequests();
  });
}

/**
 * 后台预取动态完整正文。同一条动态的并发调用共享同一个请求，
 * 完成后保存在当前应用会话中，避免列表卡片重复访问详情接口。
 */
export function preloadFeedFullText(feedId: string | number): Promise<string> {
  const key = String(feedId).trim();
  if (!key) return Promise.reject(new Error('动态编号为空'));

  const cached = fullTextCache.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const request = enqueueRequest(async () => {
    const response: any = await CoolapkTauriAPI.getFeedDetail(key);
    const message = getFeedDetailMessage(response?.data);
    if (!message) throw new Error('动态详情没有返回完整正文');
    fullTextCache.set(key, message);
    return message;
  });
  pendingRequests.set(key, request);
  void request.then(
    () => pendingRequests.delete(key),
    () => pendingRequests.delete(key)
  );
  return request;
}

export function getCachedFeedFullText(feedId: string | number): string {
  return fullTextCache.get(String(feedId).trim()) || '';
}

/** 仅供测试或账号上下文重置时清空内存正文缓存。 */
export function clearFeedFullTextCache() {
  fullTextCache.clear();
  pendingRequests.clear();
  requestQueue.splice(0, requestQueue.length);
}

/** 仅用于验证后台请求没有超过并发上限。 */
export function getFeedFullTextRequestStats() {
  return {
    active: activeRequestCount,
    queued: requestQueue.length,
  };
}
