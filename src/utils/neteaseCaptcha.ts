/**
 * 网易易盾滑块人机验证集成模块
 * 对应酷安官方 APK 中的 NetEaseProtectSDKManager / wn.java 逻辑
 */

declare global {
  interface Window {
    initNECaptcha?: (
      config: NECaptchaConfig,
      onload?: (instance: NECaptchaInstance) => void,
      onerror?: (err: any) => void
    ) => void;
  }
}

export interface NECaptchaConfig {
  captchaId: string;
  element?: string | HTMLElement;
  mode?: 'float' | 'embed' | 'popup';
  width?: string | number;
  lang?: string;
  onReady?: (instance: NECaptchaInstance) => void;
  onVerify?: (err: any, data: { validate?: string; [key: string]: any }) => void;
  onClose?: () => void;
  [key: string]: any;
}

export interface NECaptchaInstance {
  popup: () => void;
  refresh: () => void;
  destroy: () => void;
}

/** 酷安官方网易易盾 Captcha ID */
export const DEFAULT_COOLAPK_CAPTCHA_ID = '414e5c9b866a03db03f860a1a9101672';

/**
 * 从酷安服务端响应中解析动态下发的 Captcha 配置（对应 APK C2143.java / wn.java）
 */
export function extractCaptchaParamsFromResponse(data: any): { captchaId?: string; captchaField?: string } | null {
  if (!data) return null;
  let extraStr = data.messageExtra || data.extra;
  if (!extraStr && typeof data === 'object') {
    if (data.captchaId) {
      return {
        captchaId: data.captchaId,
        captchaField: data.captchaField || '_v2_post_token',
      };
    }
  }
  if (typeof extraStr === 'string' && extraStr.trim().startsWith('{')) {
    try {
      const obj = JSON.parse(extraStr);
      if (obj.captchaId) {
        return {
          captchaId: obj.captchaId,
          captchaField: obj.captchaField || '_v2_post_token',
        };
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
}

let scriptLoadingPromise: Promise<void> | null = null;

/**
 * 动态加载网易易盾 Web JS SDK
 */
export function loadNECaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('易盾验证码只能在浏览器环境运行'));
  }
  if (window.initNECaptcha) {
    return Promise.resolve();
  }
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src*="cstaticdun.126.net/load.min.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('网易易盾验证码脚本加载失败')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cstaticdun.126.net/load.min.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      scriptLoadingPromise = null;
      reject(new Error('网易易盾验证码加载失败，请检查网络连接'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * 唤起网易易盾滑块弹窗并完成验证
 * @param captchaId 易盾业务 ID，默认使用酷安官方 ID
 * @returns 返回拼装后的官方标准 Token，格式为 `NEC:{captchaId前8位}:{validate}`
 */
export async function verifyWithCaptcha(captchaId = DEFAULT_COOLAPK_CAPTCHA_ID): Promise<string> {
  await loadNECaptchaScript();

  if (!window.initNECaptcha) {
    throw new Error('网易易盾初始化函数不可用');
  }

  return new Promise<string>((resolve, reject) => {
    // 创建一个隐藏的挂载容器
    const container = document.createElement('div');
    container.id = `ne-captcha-${Date.now()}`;
    container.style.position = 'fixed';
    container.style.zIndex = '99999';
    document.body.appendChild(container);

    let captchaInstance: NECaptchaInstance | null = null;
    let resolved = false;

    const cleanup = () => {
      try {
        if (captchaInstance) {
          captchaInstance.destroy();
        }
      } catch (e) {
        // ignore
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };

    window.initNECaptcha!(
      {
        captchaId,
        element: container,
        mode: 'popup',
        width: '320px',
        lang: 'zh-CN',
        onReady: (instance) => {
          captchaInstance = instance;
        },
        onVerify: (err, data) => {
          if (err) {
            resolved = true;
            cleanup();
            reject(new Error(typeof err === 'string' ? err : err?.message || '验证码验证失败'));
            return;
          }
          if (data && data.validate) {
            resolved = true;
            const prefix = captchaId.slice(0, 8);
            const token = `NEC:${prefix}:${data.validate}`;
            cleanup();
            resolve(token);
          } else {
            resolved = true;
            cleanup();
            reject(new Error('验证码凭证无效'));
          }
        },
        onClose: () => {
          if (!resolved) {
            cleanup();
            reject(new Error('用户取消了人机验证'));
          }
        },
      },
      (instance) => {
        captchaInstance = instance;
        instance.popup();
      },
      (err) => {
        cleanup();
        reject(new Error(typeof err === 'string' ? err : err?.message || '初始化易盾滑块失败'));
      }
    );
  });
}
