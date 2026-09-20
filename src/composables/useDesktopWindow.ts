import { computed, onMounted, onUnmounted, readonly, ref } from 'vue';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type DesktopPlatform = 'windows' | 'macos' | 'linux' | 'web';

function detectDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === 'undefined') return 'web';

  const platformName = `${navigator.platform ?? ''} ${navigator.userAgent}`.toLowerCase();
  // 移动 WebView 不支持桌面窗口控制。iPadOS 的“请求桌面网站”UA
  // 可能伪装成 MacIntel/Mac OS X，因此还要用触控点数识别它。
  const isAppleMobile =
    /iphone|ipad|ipod/.test(platformName) ||
    (platformName.includes('mac') && navigator.maxTouchPoints > 1);
  // Android WebView 的 UA 同样包含 "Linux"，必须先排除移动平台，
  // 否则会尝试调用未初始化的桌面 window 插件。
  if (platformName.includes('android') || isAppleMobile) return 'web';
  if (platformName.includes('mac')) return 'macos';
  if (platformName.includes('win')) return 'windows';
  if (platformName.includes('linux')) return 'linux';
  return 'web';
}

const platform = detectDesktopPlatform();
const nativeRuntime = isTauri();
const nativeDesktopRuntime = nativeRuntime && platform !== 'web';

export function useDesktopWindow() {
  const isMaximized = ref(false);
  const isFullscreen = ref(false);
  let unlistenResize: (() => void) | null = null;

  const usesCustomControls = computed(
    () => nativeDesktopRuntime && (platform === 'windows' || platform === 'linux'),
  );
  const usesMacOverlay = computed(() => nativeDesktopRuntime && platform === 'macos');
  const showWindowControls = computed(() => usesCustomControls.value && !isFullscreen.value);

  async function syncWindowState() {
    if (!nativeDesktopRuntime) return;
    const appWindow = getCurrentWindow();
    const [maximized, fullscreen] = await Promise.all([
      appWindow.isMaximized(),
      appWindow.isFullscreen(),
    ]);
    isMaximized.value = maximized;
    isFullscreen.value = fullscreen;
  }

  async function minimize() {
    if (nativeDesktopRuntime) await getCurrentWindow().minimize();
  }

  async function toggleMaximize() {
    if (!nativeDesktopRuntime) return;
    await getCurrentWindow().toggleMaximize();
    await syncWindowState();
  }

  async function close() {
    if (nativeDesktopRuntime) await getCurrentWindow().close();
  }

  onMounted(async () => {
    if (!nativeDesktopRuntime) return;
    await syncWindowState();
    unlistenResize = await getCurrentWindow().onResized(() => {
      void syncWindowState();
    });
  });

  onUnmounted(() => {
    unlistenResize?.();
    unlistenResize = null;
  });

  return {
    platform,
    isMaximized: readonly(isMaximized),
    isFullscreen: readonly(isFullscreen),
    usesCustomControls,
    usesMacOverlay,
    showWindowControls,
    minimize,
    toggleMaximize,
    close,
  };
}
