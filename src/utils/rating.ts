const RATING_MARKERS = [
  'feedType',
  'feed_type',
  'entityType',
  'entity_type',
  'type',
  'ratingType',
  'rating_type',
  'filterRating',
  'filter_rating',
];

const RATING_PAYLOAD_KEYS = [
  'rating_score',
  'ratingScore',
  'rating_item_info',
  'ratingItemInfo',
  'v4_rating_message',
  'v4RatingMessage',
  'comment_addition',
  'commentAddition',
  'comment_good',
  'commentGood',
  'comment_general',
  'commentGeneral',
  'comment_bad',
  'commentBad',
];

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(String(value ?? '').trim());
}

/** 根据 APK 的 feedType 和点评字段识别点评动态，供不同列表页面共用。 */
export function isRatingFeedEntity(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const source = item as Record<string, unknown>;
  const markers = RATING_MARKERS.map((key) => String(source[key] ?? '').trim().toLowerCase());
  if (markers.some((value) => value === 'rating' || value === 'feed_rating' || value === 'rating_feed' || value === 'ratingv4')) return true;
  return RATING_PAYLOAD_KEYS.some((key) => hasValue(source[key]));
}
