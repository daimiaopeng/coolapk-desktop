export interface CommentItem {
  id: string | number;
  feedId?: string | number;
  uid?: string | number;
  username?: string;
  userAvatar?: string;
  userInfo?: {
    uid?: string | number;
    username?: string;
    userAvatar?: string;
    level?: number;
  };
  message?: string;
  pic?: string;
  dateline?: number | string;
  likenum?: number;
  replynum?: number;
  rlist?: CommentItem[];
  userAction?: {
    like?: number;
  };
  [key: string]: any;
}
