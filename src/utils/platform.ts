import { invoke, isTauri } from '@tauri-apps/api/core';

export type PlatformInfo = {
  os: 'windows' | 'macos' | 'linux' | string;
  arch: 'x86_64' | 'aarch64' | string;
  /**
   * 是否以 MSIX 打包形式运行。
   *
   * 动态磁贴要求调用方具有包标识，未打包时该功能整体不可用，
   * 前端据此隐藏磁贴相关设置，避免给出一个选了也没用的选项。
   */
  hasPackageIdentity?: boolean;
};

const UNKNOWN_PLATFORM: PlatformInfo = { os: 'unknown', arch: 'unknown', hasPackageIdentity: false };
let platformInfoPromise: Promise<PlatformInfo> | null = null;

export function getPlatformInfo(): Promise<PlatformInfo> {
  if (!platformInfoPromise) {
    platformInfoPromise = isTauri()
      ? invoke<PlatformInfo>('get_platform_info')
      : Promise.resolve(UNKNOWN_PLATFORM);
  }
  return platformInfoPromise;
}

/**
 * 触摸优先的移动端（iPhone / iPad / Android）。
 *
 * 用于区分"桌面语义"的设置与布局：这些设置在手机上要么无意义，要么会把移动外壳整个关掉。
 * iPadOS 的"请求桌面网站"UA 会伪装成 MacIntel，因此还要用触控点数识别。
 */
export function isTouchMobilePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platformName = `${navigator.platform ?? ''} ${navigator.userAgent}`.toLowerCase();
  if (platformName.includes('android')) return true;
  return /iphone|ipad|ipod/.test(platformName)
    || (platformName.includes('mac') && (navigator.maxTouchPoints ?? 0) > 1);
}

/** 主指针是否为触摸。用于关闭桌面专属行为（hover 播放、打开即抢焦点弹键盘等）。 */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
