import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_COOLAPK_CAPTCHA_ID,
  loadNECaptchaScript,
  verifyWithCaptcha,
} from '../neteaseCaptcha';

describe('neteaseCaptcha', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    delete (window as any).initNECaptcha;
  });

  it('exports default coolapk captcha id', () => {
    expect(DEFAULT_COOLAPK_CAPTCHA_ID).toBe('414e5c9b866a03db03f860a1a9101672');
  });

  it('loads the script tag into DOM', async () => {
    const promise = loadNECaptchaScript();
    const script = document.querySelector('script[src*="load.min.js"]');
    expect(script).toBeTruthy();

    (window as any).initNECaptcha = vi.fn();
    script?.dispatchEvent(new Event('load'));
    await promise;
  });

  it('resolves formatted token on successful validation', async () => {
    (window as any).initNECaptcha = vi.fn((config, onLoad) => {
      const mockInstance = {
        popup: vi.fn(),
        refresh: vi.fn(),
        destroy: vi.fn(),
      };
      if (onLoad) onLoad(mockInstance);
      if (config.onReady) config.onReady(mockInstance);
      // Simulate verify success
      if (config.onVerify) {
        config.onVerify(null, { validate: 'mock_validate_hash_12345' });
      }
    });

    const token = await verifyWithCaptcha('414e5c9b866a03db03f860a1a9101672');
    expect(token).toBe('NEC:414e5c9b:mock_validate_hash_12345');
  });

  it('rejects on user cancellation or verify error', async () => {
    (window as any).initNECaptcha = vi.fn((config, onLoad) => {
      const mockInstance = {
        popup: vi.fn(),
        refresh: vi.fn(),
        destroy: vi.fn(),
      };
      if (onLoad) onLoad(mockInstance);
      if (config.onClose) {
        config.onClose();
      }
    });

    await expect(verifyWithCaptcha()).rejects.toThrow('用户取消了人机验证');
  });
});
