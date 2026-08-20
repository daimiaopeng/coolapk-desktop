export interface FeedItem {
  id: string | number;
  entityId?: string | number;
  feedType?: string;
  type?: string;
  title?: string;
  message?: string;
  message_raw_output?: string;
  userAction?: {
    like?: number;
    favorite?: number;
    collect?: number;
  };
  uid?: string | number;
  username?: string;
  userAvatar?: string;
  userSmallAvatar?: string;
  userInfo?: {
    uid?: string | number;
    username?: string;
    userAvatar?: string;
    level?: number;
    verify_title?: string;
  };
  pic?: string;
  picArr?: string[];
  device_title?: string;
  dateline?: number | string;
  isModified?: boolean | number | string;
  is_modified?: boolean | number | string;
  changeCount?: number | string;
  change_count?: number | string;
  lastChangeTime?: number | string;
  last_change_time?: number | string;
  likenum?: number;
  replynum?: number;
  favnum?: number;
  sharenum?: number;
  target_multilink_title?: string;
  target_multilink_url?: string;
  extra_key?: string;
  [key: string]: any;
}
