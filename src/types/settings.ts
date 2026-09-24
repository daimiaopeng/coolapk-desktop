export type ThemeMode = 'light' | 'dark' | 'system';
export type FeedDensity = 'comfortable' | 'standard' | 'compact';
export type FeedLayout = 'single' | 'double';
export type FavoriteCollectionViewMode = 'large' | 'single' | 'double' | 'no-image';
export type FavoriteCollectionSortMode = 'default' | 'name' | 'item-count' | 'favorite-count' | 'follower-count';
export type FavoriteCollectionSortDirection = 'asc' | 'desc';
export type CommentSortPreference = 'default' | 'likes' | 'latest';
export type TopicDiscussionSortPreference = 'default' | 'latest' | 'hot';
/** 空字符串表示使用应用原有的系统回退字体栈，否则保存 Windows 返回的字体族名称。 */
export type FontFamily = string;
export type ImageQuality = 'standard' | 'hd' | 'raw';
export type AccentColor = 'green' | 'blue' | 'violet' | 'orange';
export type HomeTabKey = string;
export type ExternalLinkMode = 'internal' | 'system';
export type TimeDisplayMode = 'relative' | 'absolute';
export type MessageEnterBehavior = 'send' | 'newline';
export type UpdateChannel = 'stable' | 'beta';

/** 官方 ConfigPage 实体模型（对齐 com.coolapk.market.model.ConfigPage） */
export interface ConfigPageTab {
  id?: number | string;
  title: string;
  page_name?: string;
  url: string;
  logo?: string;
  subTitle?: string;
  /** APK ConfigPage.entities：空 URL 是分组标题，其余实体是可点击子栏目。 */
  entities?: ConfigPageSubChannel[];
  rawEntities?: ConfigPageSubChannel[];
  raw_entities?: ConfigPageSubChannel[];
  page_fixed?: number;
  page_visibility?: number;
  order?: number;
}

export interface ConfigPageSubChannel {
  id?: number | string;
  entityId?: number | string;
  entity_id?: number | string;
  title?: string;
  url?: string;
  logo?: string;
  icon?: string;
  subTitle?: string;
  page_name?: string;
  [key: string]: unknown;
}

export interface NavVisibilitySettings {
  home: boolean;
  feeds: boolean;
  discover: boolean;
  apps: boolean;
  games: boolean;
  digital: boolean;
  topics: boolean;
  reviews: boolean;
  secondhand: boolean;
  albums: boolean;
  pictures: boolean;
  my_products: boolean;
  notifications: boolean;
  favorites: boolean;
  history: boolean;
  messages: boolean;
  following: boolean;
  downloads: boolean;
  goods: boolean;
  events: boolean;
  nodes: boolean;
  anylist: boolean;
  mydyh: boolean;
  more: boolean;
  my: boolean;
  my_likes: boolean;
  my_comments: boolean;
  my_feeds: boolean;
  my_recent: boolean;
  followed_nodes: boolean;
  followed_topics: boolean;
  followed_collections: boolean;
  followed_questions: boolean;
  followed_products: boolean;
  recent_contacts: boolean;
  recycle_bin: boolean;
  hidden_replies: boolean;
  my_devices: boolean;
  my_albums: boolean;
  my_votes: boolean;
}

/** 设备信息（请求头指纹）：机型/Android 版本/Build 内嵌于 User-Agent，
 * App 版本/版本号/SDK Int/Locale/暗色模式为独立请求头。
 * 数盟设备 ID 用于 X-App-Device 首字段；ddid 单独填写，仅在服务端要求 DDI 的写请求中作为 Cookie 发送。 */
export interface DeviceFingerprintSettings {
  /** 是否启用自定义设备信息（关闭时使用客户端默认值） */
  customFingerprint: boolean;
  /** 手动填写的数盟设备 ID（设备ID / ShuzlmID），用于 X-App-Device 首字段 */
  deviceId: string;
  /** 手动填写的 DDI 会话值，仅作为对应写请求的 ddid Cookie 值 */
  ddid: string;
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
  /** X-Sdk-Int，如 "35" */
  sdkInt: string;
  /** X-Sdk-Locale，如 "zh-CN" */
  locale: string;
  /** X-Dark-Mode："0" 浅色 / "1" 深色 */
  darkMode: '0' | '1';
}

export interface AppSettings {
  theme: ThemeMode;
  density: FeedDensity;
  feedLayout: FeedLayout;
  fontFamily: FontFamily;
  fontSize: number;
  zoom: number;
  zoomManuallySet: boolean;
  sidebarCollapsed: boolean;
  myRecentPinned: boolean;
  moreExpanded: boolean;
  reduceMotion: boolean;
  accentColor: AccentColor;
  collapseLines: number;
  autoPlayGif: boolean;
  autoPlayLivePhotoSound: boolean;
  suppressUnsupportedLivePhotoCodecPrompt: boolean;
  autoLoadOriginalImage: boolean;
  noImageMode: boolean;
  showDeviceInfo: boolean;
  preloadUserProfile: boolean;
  showHomeMonthlyRank: boolean;
  showHomeHotTopics: boolean;
  defaultHomeTab: HomeTabKey;
  homeTabOrder: HomeTabKey[];
  favoriteCollectionViewMode: FavoriteCollectionViewMode;
  favoriteCollectionSortMode: FavoriteCollectionSortMode;
  favoriteCollectionSortDirection: FavoriteCollectionSortDirection;
  /** 普通评论与话题讨论分别使用的默认排序。 */
  commentDefaultSortMode: CommentSortPreference;
  topicDiscussionDefaultSortMode: TopicDiscussionSortPreference;
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
  messageEnterBehavior: MessageEnterBehavior;
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
