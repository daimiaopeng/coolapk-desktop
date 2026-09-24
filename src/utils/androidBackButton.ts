import { onBackButtonPress } from '@tauri-apps/api/app';
import { onScopeDispose, watch } from 'vue';

const handlers = new Map<symbol, () => void>();
let listenerPromise: Promise<void> | null = null;

function isAndroidTauri(): boolean {
  const runtime = globalThis as typeof globalThis & { isTauri?: boolean };
  return runtime.isTauri === true && typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

function ensureNativeListener(): void {
  if (!isAndroidTauri() || listenerPromise) return;

  listenerPromise = onBackButtonPress(() => {
    const topHandler = Array.from(handlers.values()).at(-1);
    topHandler?.();
  }).then(() => undefined).catch((error) => {
    listenerPromise = null;
    console.warn('注册 Android 返回键监听失败:', error);
  });
}

function registerHandler(handler: () => void): () => void {
  if (!isAndroidTauri()) return () => undefined;

  const key = Symbol('android-back-handler');
  handlers.set(key, handler);
  ensureNativeListener();

  return () => {
    handlers.delete(key);
  };
}

/** Register a temporary Android system-back action while a mobile surface is active. */
export function useAndroidBackButton(isActive: () => boolean, handler: () => void): void {
  let unregister: (() => void) | null = null;

  const stop = watch(isActive, (active) => {
    if (active) {
      unregister ??= registerHandler(handler);
    } else {
      unregister?.();
      unregister = null;
    }
  }, { immediate: true, flush: 'sync' });

  onScopeDispose(() => {
    stop();
    unregister?.();
    unregister = null;
  });
}
