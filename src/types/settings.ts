export type ThemeMode = 'light' | 'dark' | 'system';
export type FeedDensity = 'comfortable' | 'standard' | 'compact';
export type ImageQuality = 'standard' | 'hd' | 'raw';
export type AccentColor = 'green' | 'blue' | 'violet' | 'orange';
export type CommentSort = 'hot' | 'latest';
export type HomeTabKey = 'index_v8' | 'digest' | 'hot' | 'latest' | 'cool_picture' | 'secondhand' | 'pictures' | 'dyh';
export type ExternalLinkMode = 'internal' | 'system';
export type TimeDisplayMode = 'relative' | 'absolute';
export type UpdateChannel = 'stable' | 'beta';

export interface NavVisibilitySettings {
  home: boolean;
  feeds: boolean;
  discover: boolean;
  apps: boolean;
  games: boolean;
  topics: boolean;
  reviews: boolean;
  secondhand: boolean;
  albums: boolean;
  pictures: boolean;
  notifications: boolean;
  favorites: boolean;
  history: boolean;
  messages: boolean;
  following: boolean;
}

/** 设备信息（请求头指纹）：机型/Android 版本/Build 内嵌于 User-Agent，
 * App 版本/版本号/SDK Int/Locale/暗色模式为独立请求头。
 * 注意：X-App-Device（设备码）与 X-App-Token 由账号绑定，不可自定义。 */
export interface DeviceFingerprintSettings {
  /** 是否启用自定义设备信息（关闭时使用客户端默认值） */
  customFingerprint: boolean;
  /** 机型型号，内嵌 UA，如 "23113RKC6C"（小米 14） */
  model: string;
  /** UA 内 Android 版本，如 "16" */
  androidVersion: string;
  /** UA 内 Build 号，如 "AQ3A.250226.002" */
  build: string;
  /** X-App-Version，如 "16.2.0" */
  appVersion: string;
  /** X-App-Code / X-App-Supported，如 "2604201" */
  appCode: string;
  /** X-Sdk-Int，如 "36" */
  sdkInt: string;
  /** X-Sdk-Locale，如 "zh-CN" */
  locale: string;
  /** X-Dark-Mode："0" 浅色 / "1" 深色 */
  darkMode: '0' | '1';
}

export interface AppSettings {
  theme: ThemeMode;
  density: FeedDensity;
  fontSize: number;
  zoom: number;
  zoomManuallySet: boolean;
  sidebarCollapsed: boolean;
  reduceMotion: boolean;
  accentColor: AccentColor;
  collapseLines: number;
  commentSort: CommentSort;
  infiniteScroll: boolean;
  autoPlayGif: boolean;
  showDeviceInfo: boolean;
  defaultHomeTab: HomeTabKey;
  downloadPath: string;
  maxConcurrentDownloads: number;
  autoCleanCache: boolean;
  cacheThresholdMB: number;
  cacheTtlDays: number;
  cachePath: string;
  imageQuality: ImageQuality;
  navVisibility?: NavVisibilitySettings;
  checkUpdateOnStartup: boolean;
  ignoredUpdateVersion: string;
  ignoreAllUpdates: boolean;
  closeToTray: boolean;
  autostart: boolean;
  startMinimized: boolean;
  alwaysOnTop: boolean;
  rememberWindowState: boolean;
  notifyReplies: boolean;
  notifyAt: boolean;
  notifyPm: boolean;
  desktopNotifications: boolean;
  notificationSound: boolean;
  notificationPollInterval: number;
  externalLinkMode: ExternalLinkMode;
  timeDisplay: TimeDisplayMode;
  hideAdCards: boolean;
  blockedKeywords: string[];
  publishDeviceSignature: boolean;
  deviceSignature: string;
  imageOpenMode: ExternalLinkMode;
  updateSpeedLimitKBps: number;
  proxyUrl: string;
  notifyDownloadComplete: boolean;
  updateChannel: UpdateChannel;
  experimentalFeatures: boolean;
  deviceFingerprint: DeviceFingerprintSettings;
}
