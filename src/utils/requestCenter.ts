import { reactive, readonly } from 'vue';

export type RequestKind = 'feed' | 'comment' | 'default';

export interface RequestPolicy {
  retry?: boolean;
  maxAttempts?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  kind?: RequestKind;
}

const requestState = reactive({
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0,
  lastError: '',
  lastErrorAt: 0,
  lastSuccessAt: 0,
});

export const requestCenterState = readonly(requestState);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { requestState.isOnline = true; });
  window.addEventListener('offline', () => { requestState.isOnline = false; });
}

function getErrorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || '');
  return String(error || '请求失败');
}

export function shouldRetryRequest(error: unknown): boolean {
  const message = getErrorText(error).toLowerCase();
  return /timeout|timed out|aborted|network|fetch|连接|网络|超时|502|503|504|429|temporar|暂时/.test(message);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label}请求超时`)), timeoutMs);
    task.then((value) => { window.clearTimeout(timer); resolve(value); }, (error) => { window.clearTimeout(timer); reject(error); });
  });
}

export async function requestWithPolicy<T>(label: string, task: () => Promise<T>, policy: RequestPolicy = {}): Promise<T> {
  const retry = policy.retry ?? true;
  const maxAttempts = retry ? Math.max(1, policy.maxAttempts ?? 3) : 1;
  const timeoutMs = policy.timeoutMs ?? 15_000;
  const retryDelayMs = policy.retryDelayMs ?? 350;
  requestState.pending += 1;
  try {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await withTimeout(Promise.resolve().then(task), timeoutMs, label);
        requestState.lastError = '';
        requestState.lastSuccessAt = Date.now();
        return result;
      } catch (error) {
        lastError = error;
        requestState.lastError = getErrorText(error);
        requestState.lastErrorAt = Date.now();
        if (attempt >= maxAttempts || !shouldRetryRequest(error)) throw error;
        await wait(retryDelayMs * attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(getErrorText(lastError));
  } finally {
    requestState.pending = Math.max(0, requestState.pending - 1);
  }
}
