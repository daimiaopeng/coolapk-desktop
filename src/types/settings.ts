export type ThemeMode = 'light' | 'dark' | 'system';
export type FeedDensity = 'comfortable' | 'standard' | 'compact';
export type ImageQuality = 'standard' | 'hd' | 'raw';

export interface AppSettings {
  theme: ThemeMode;
  density: FeedDensity;
  fontSize: number;
  zoom: number;
  sidebarCollapsed: boolean;
  reduceMotion: boolean;
  inlineComments: boolean;
  downloadPath: string;
  maxConcurrentDownloads: number;
  autoCleanCache: boolean;
  cacheThresholdMB: number;
  imageQuality: ImageQuality;
}
