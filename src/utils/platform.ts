import { invoke, isTauri } from '@tauri-apps/api/core';

export type PlatformInfo = {
  os: 'windows' | 'macos' | 'linux' | string;
  arch: 'x86_64' | 'aarch64' | string;
};

export type RuntimePlatform = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web' | 'unknown';

/** Detect the runtime environment, independent from the active Presentation. */
export function detectRuntimePlatform(): RuntimePlatform {
  if (typeof navigator === 'undefined') return 'unknown';

  const platform = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`.toLowerCase();
  const isAppleMobile = /iphone|ipad|ipod/.test(platform)
    || (platform.includes('mac') && navigator.maxTouchPoints > 1);

  if (platform.includes('android')) return 'android';
  if (isAppleMobile) return 'ios';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('linux')) return 'linux';
  return 'web';
}

export function isMobileRuntime(): boolean {
  const runtime = detectRuntimePlatform();
  return runtime === 'android' || runtime === 'ios';
}

const UNKNOWN_PLATFORM: PlatformInfo = { os: 'unknown', arch: 'unknown' };
let platformInfoPromise: Promise<PlatformInfo> | null = null;

export function getPlatformInfo(): Promise<PlatformInfo> {
  if (!platformInfoPromise) {
    platformInfoPromise = isTauri()
      ? invoke<PlatformInfo>('get_platform_info')
      : Promise.resolve(UNKNOWN_PLATFORM);
  }
  return platformInfoPromise;
}
