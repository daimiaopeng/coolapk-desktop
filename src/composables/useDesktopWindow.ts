import { computed, onMounted, onUnmounted, readonly, ref } from 'vue';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { detectRuntimePlatform } from '../utils/platform';

export type DesktopPlatform = 'windows' | 'macos' | 'linux' | 'web';

function detectDesktopPlatform(): DesktopPlatform {
  const runtime = detectRuntimePlatform();
  if (runtime === 'macos' || runtime === 'windows' || runtime === 'linux') return runtime;
  // Android/iOS/Web runtimes do not expose desktop window controls, even when
  // a browser requests the desktop-site user agent.
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
