export interface RelatedApp {
  id?: string | number;
  aid?: string | number;
  packageName?: string;
  appId?: string;
  title?: string;
  shorttitle?: string;
  appName?: string;
  logo?: string;
  apkRomIcon?: string;
  icon?: string;
  pic?: string;
  apkSize?: string | number;
  apkSizeFormatted?: string;
  size?: string | number;
  downCount?: string | number;
  downCountFormatted?: string;
  score?: string | number;
  [key: string]: unknown;
}

export interface RelatedAlbum {
  id?: string | number;
  albumId?: string | number;
  album_id?: string | number;
  entityId?: string | number;
  title?: string;
  name?: string;
  albumName?: string;
  pic?: string;
  cover?: string;
  logo?: string;
  icon?: string;
  username?: string;
  userInfo?: { username?: string };
  apkCount?: string | number;
  apk_count?: string | number;
  apknum?: string | number;
  description?: string;
  intro?: string;
  [key: string]: unknown;
}

export interface PermissionEntry {
  label?: string;
  name?: string;
  permissionName?: string;
  sourceString?: string;
  description?: string;
  desc?: string;
  [key: string]: unknown;
}