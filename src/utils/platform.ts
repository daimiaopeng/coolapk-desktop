import { invoke, isTauri } from '@tauri-apps/api/core';

export type PlatformInfo = {
  os: 'windows' | 'macos' | 'linux' | string;
  arch: 'x86_64' | 'aarch64' | string;
};

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
