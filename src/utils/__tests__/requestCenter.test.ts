import { describe, expect, it } from 'vitest';
import { requestWithPolicy, shouldRetryRequest } from '../requestCenter';

describe('requestCenter', () => {
  it('只对可恢复的网络错误进行重试', () => {
    expect(shouldRetryRequest(new Error('请求超时'))).toBe(true);
    expect(shouldRetryRequest(new Error('HTTP 503'))).toBe(true);
    expect(shouldRetryRequest(new Error('账号权限不足'))).toBe(false);
  });

  it('请求失败后按策略重试并返回成功结果', async () => {
    let attempts = 0;
    const result = await requestWithPolicy('测试接口', async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('网络连接失败');
      return 'ok';
    }, { retry: true, maxAttempts: 2, retryDelayMs: 0, timeoutMs: 100 });
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('关闭重试时只执行一次请求', async () => {
    let attempts = 0;
    await expect(requestWithPolicy('测试接口', async () => {
      attempts += 1;
      throw new Error('网络连接失败');
    }, { retry: false, timeoutMs: 100 })).rejects.toThrow('网络连接失败');
    expect(attempts).toBe(1);
  });
});
