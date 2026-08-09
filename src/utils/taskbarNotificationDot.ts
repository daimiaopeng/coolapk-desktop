import logoUrl from '../assets/coolapk-logo-rounded.png';

const ICON_SIZE = 64;
const TRAY_ICON_ID = 'main-tray';
let logoImagePromise: Promise<HTMLImageElement> | null = null;
let trayIconPromise: Promise<import('@tauri-apps/api/tray').TrayIcon | null> | null = null;
let iconUpdateQueue: Promise<void> = Promise.resolve();

function loadLogoImage(): Promise<HTMLImageElement> {
  if (logoImagePromise) return logoImagePromise;
  logoImagePromise = new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('通知图标资源加载失败'));
    image.src = logoUrl;
  });
  return logoImagePromise;
}

function normalizeUnreadCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

export function formatTaskbarBadgeLabel(count: number): string {
  const normalized = normalizeUnreadCount(count);
  if (normalized <= 0) return '';
  return normalized > 99 ? '99+' : String(normalized);
}

function drawRoundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const right = x + width;
  const bottom = y + height;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawTaskbarNumber(context: CanvasRenderingContext2D, count: number) {
  const label = formatTaskbarBadgeLabel(count);
  if (!label) return;

  const badgeWidth = label.length === 1 ? 30 : label.length === 2 ? 38 : 46;
  const badgeHeight = 29;
  const x = ICON_SIZE - badgeWidth;
  const y = 0;

  // 白色描边让数字角标在浅色和深色任务栏上都清晰可见。
  drawRoundedRectangle(context, x - 2, y - 2, badgeWidth + 4, badgeHeight + 4, 17);
  context.fillStyle = '#ffffff';
  context.fill();

  drawRoundedRectangle(context, x, y, badgeWidth, badgeHeight, 15);
  context.fillStyle = '#f04444';
  context.fill();

  context.fillStyle = '#ffffff';
  context.font = `700 ${label.length === 3 ? 15 : label.length === 2 ? 18 : 20}px "Segoe UI", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, x + badgeWidth / 2, y + badgeHeight / 2 + 0.5);
}

function drawTrayDot(context: CanvasRenderingContext2D) {
  context.beginPath();
  context.arc(52, 12, 10, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.beginPath();
  context.arc(52, 12, 7, 0, Math.PI * 2);
  context.fillStyle = '#f04444';
  context.fill();
}

async function renderNotificationIcon(
  mode: 'taskbar-number' | 'tray-dot',
  unreadCount: number
): Promise<Uint8Array> {
  const logoImage = await loadLogoImage();
  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建通知图标画布');

  context.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
  context.drawImage(logoImage, 0, 0, ICON_SIZE, ICON_SIZE);

  if (unreadCount > 0) {
    if (mode === 'taskbar-number') drawTaskbarNumber(context, unreadCount);
    else drawTrayDot(context);
  }

  return new Uint8Array(context.getImageData(0, 0, ICON_SIZE, ICON_SIZE).data);
}

async function applyWindowsNotificationIcons(unreadCount: number): Promise<void> {
  if (!(window as any).__TAURI_INTERNALS__) return;

  try {
    const [{ Image: TauriImage }, { TrayIcon }, { getCurrentWindow }] = await Promise.all([
      import('@tauri-apps/api/image'),
      import('@tauri-apps/api/tray'),
      import('@tauri-apps/api/window'),
    ]);
    const normalizedCount = normalizeUnreadCount(unreadCount);
    const [taskbarRgba, trayRgba] = await Promise.all([
      renderNotificationIcon('taskbar-number', normalizedCount),
      renderNotificationIcon('tray-dot', normalizedCount),
    ]);
    const [taskbarIcon, trayIconImage] = await Promise.all([
      TauriImage.new(taskbarRgba, ICON_SIZE, ICON_SIZE),
      TauriImage.new(trayRgba, ICON_SIZE, ICON_SIZE),
    ]);

    try {
      trayIconPromise ??= TrayIcon.getById(TRAY_ICON_ID);
      const trayIcon = await trayIconPromise;
      if (!trayIcon) trayIconPromise = null;
      await Promise.all([
        getCurrentWindow().setIcon(taskbarIcon),
        trayIcon?.setIcon(trayIconImage),
      ]);
    } finally {
      await Promise.all([taskbarIcon.close(), trayIconImage.close()]);
    }
  } catch (error) {
    console.warn('同步 Windows 通知图标失败：', error);
  }
}

/** 按顺序更新图标，避免快速清零时旧状态覆盖新状态。 */
export function syncWindowsNotificationIcons(unreadCount: number): Promise<void> {
  iconUpdateQueue = iconUpdateQueue
    .catch(() => undefined)
    .then(() => applyWindowsNotificationIcons(unreadCount));
  return iconUpdateQueue;
}
