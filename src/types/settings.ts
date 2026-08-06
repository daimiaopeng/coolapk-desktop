export type ThemeMode = 'light' | 'dark' | 'system';
export type FeedDensity = 'comfortable' | 'standard' | 'compact';
export type ImageQuality = 'standard' | 'hd' | 'raw';
export type AccentColor = 'green' | 'blue' | 'violet' | 'orange';
export type CommentSort = 'hot' | 'latest';
export type HomeTabKey = 'index_v8' | 'digest' | 'hot' | 'latest' | 'cool_picture' | 'secondhand';

export interface NavVisibilitySettings {
  home: boolean;
  feeds: boolean;
  discover: boolean;
  apps: boolean;
  games: boolean;
  topics: boolean;
  favorites: boolean;
  history: boolean;
  messages: boolean;
  following: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  density: FeedDensity;
  fontSize: number;
  zoom: number;
  sidebarCollapsed: boolean;
  reduceMotion: boolean;
  inlineComments: boolean;
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
  imageQuality: ImageQuality;
  navVisibility?: NavVisibilitySettings;
  checkUpdateOnStartup: boolean;
  ignoredUpdateVersion: string;
  ignoreAllUpdates: boolean;
  closeToTray: boolean;
}
