import { isTauri } from '@tauri-apps/api/core';
import { detectRuntimePlatform, type RuntimePlatform } from './platform';

export type PlatformCapabilities = {
  runtime: RuntimePlatform;
  filesystem: boolean;
  window: boolean;
  notification: boolean;
  clipboard: boolean;
  openExternal: boolean;
  download: boolean;
  shell: boolean;
  deepLink: boolean;
  keyboardShortcut: boolean;
  systemTray: boolean;
  share: boolean;
  mobileLifecycle: boolean;
};

/**
 * Presentation and runtime are deliberately independent. A narrow Windows
 * window uses Mobile Presentation but still retains desktop capabilities.
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  const runtime: RuntimePlatform = detectRuntimePlatform();
  const native = isTauri();
  const mobile = runtime === 'android' || runtime === 'ios';
  const desktopNative = native && !mobile;

  return {
    runtime,
    filesystem: native,
    window: native,
    notification: native || typeof Notification !== 'undefined',
    clipboard: typeof navigator !== 'undefined' && Boolean(navigator.clipboard),
    openExternal: true,
    download: native || !mobile,
    shell: desktopNative,
    deepLink: native,
    keyboardShortcut: !mobile,
    systemTray: desktopNative,
    share: mobile || (typeof navigator !== 'undefined' && typeof navigator.share === 'function'),
    mobileLifecycle: mobile,
  };
}
