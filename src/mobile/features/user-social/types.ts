/**
 * The small, presentation-only profile shape consumed by MobileUserFeature.
 *
 * The aliases mirror the names used by the existing CoolAPK responses so a
 * route page can pass its profile through without making this adapter depend
 * on an API response type or a store.
 */
export interface MobileUserStat {
  key?: string;
  label: string;
  value: string | number;
}

export interface MobileUserProfile {
  id?: string | number;
  uid?: string | number;
  name?: string;
  username?: string;
  avatar?: string;
  userAvatar?: string;
  avatarAlt?: string;
  cover?: string;
  bio?: string;
  level?: string | number;
  verifiedLabel?: string;
  stats?: readonly MobileUserStat[];
}
