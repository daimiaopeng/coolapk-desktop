export type DesktopNotifyOptions = {
  title: string;
  body?: string;
};

let soundCtx: AudioContext | null = null;

function playNotificationSound() {
  try {
    if (!soundCtx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      soundCtx = new Ctor();
    }
    const ctx = soundCtx;
    const beep = (startAt: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + 0.3);
    };
    beep(0, 880);
    beep(0.16, 660);
  } catch {
    // 忽略音频播放失败
  }
}

/**
 * 发送系统桌面通知（Tauri 环境），可选提示音；
 * 非 Tauri 环境（浏览器预览/单元测试）下静默忽略。
 */
export async function desktopNotify(options: DesktopNotifyOptions, sound = false) {
  try {
    if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;
    const { invoke } = await import('@tauri-apps/api/core');
    const notificationPromise = invoke('send_desktop_notification', {
      title: options.title,
      body: options.body || null,
    });
    if (sound) playNotificationSound();
    await notificationPromise;
    return;
  } catch {
    // 原生通知发送失败时，保留 Tauri 通知插件作为兜底。
  }

  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === 'granted';
    }
    if (!granted) return;
    sendNotification(options);
    if (sound) playNotificationSound();
  } catch {
    // 非 Tauri 环境或通知不可用时忽略
  }
}
