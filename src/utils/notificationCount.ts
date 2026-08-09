const TOTAL_COUNT_KEYS = [
  'badge',
  'count',
  'fcount',
  'total',
  'totalCount',
  'notificationCount',
  'unreadCount',
];

const CATEGORY_COUNT_PATTERN = /(notification|message|reply|comment|atme|at_me|like|follow|contact)/i;

export type NotificationCategory =
  | 'comment'
  | 'atMe'
  | 'atComment'
  | 'like'
  | 'follow'
  | 'message';

export interface NotificationCountSnapshot {
  total: number;
  categories: Record<NotificationCategory, number>;
}

const CATEGORY_KEYS: Record<NotificationCategory, string[]> = {
  comment: ['commentme', 'commentMe', 'comment'],
  atMe: ['atme', 'atMe'],
  atComment: ['atcommentme', 'atCommentMe'],
  like: ['feedlike', 'feedLike'],
  follow: ['contacts_follow', 'contactsFollow', 'follow'],
  message: ['message', 'messageCount'],
};

function toSafeCount(value: unknown): number | null {
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  return Math.max(0, Math.floor(count));
}

function getPayload(response: unknown): unknown {
  return response && typeof response === 'object' && 'data' in response
    ? (response as { data?: unknown }).data
    : response;
}

function readCategoryCount(record: Record<string, unknown>, category: NotificationCategory): number {
  for (const key of CATEGORY_KEYS[category]) {
    const count = toSafeCount(record[key]);
    if (count !== null) return count;
  }
  return 0;
}

/** 解析酷安 checkCount 的总未读数和各通知栏目未读数。 */
export function normalizeNotificationCounts(response: unknown): NotificationCountSnapshot {
  const payload = getPayload(response);
  const emptyCategories: Record<NotificationCategory, number> = {
    comment: 0,
    atMe: 0,
    atComment: 0,
    like: 0,
    follow: 0,
    message: 0,
  };
  const direct = toSafeCount(payload);
  if (direct !== null) return { total: direct, categories: emptyCategories };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { total: 0, categories: emptyCategories };
  }

  const record = payload as Record<string, unknown>;
  const categories = Object.fromEntries(
    (Object.keys(CATEGORY_KEYS) as NotificationCategory[])
      .map((category) => [category, readCategoryCount(record, category)])
  ) as Record<NotificationCategory, number>;

  for (const key of TOTAL_COUNT_KEYS) {
    const count = toSafeCount(record[key]);
    if (count !== null) return { total: count, categories };
  }

  let categoryTotal = 0;
  let matchedCategory = false;
  for (const [key, value] of Object.entries(record)) {
    if (!CATEGORY_COUNT_PATTERN.test(key)) continue;
    const count = toSafeCount(value);
    if (count === null) continue;
    matchedCategory = true;
    categoryTotal += count;
  }
  return { total: matchedCategory ? categoryTotal : 0, categories };
}

/** 兼容只需要总未读数的旧调用。 */
export function normalizeNotificationCount(response: unknown): number {
  return normalizeNotificationCounts(response).total;
}

/**
 * 服务端可能不会在用户打开通知后立即清零；本地先扣减，待服务端数字下降后再抵消本地扣减量。
 */
export function reconcileViewedCount(
  previousServerCount: number | null,
  currentServerCount: number,
  locallyViewedCount: number
): { count: number; locallyViewedCount: number } {
  const serverDecrease = previousServerCount === null
    ? 0
    : Math.max(0, previousServerCount - currentServerCount);
  const remainingViewedCount = Math.max(0, locallyViewedCount - serverDecrease);
  return {
    count: Math.max(0, currentServerCount - remainingViewedCount),
    locallyViewedCount: remainingViewedCount,
  };
}

/** 首次请求只建立基线；基线为 0 后收到第一条通知也必须提醒。 */
export function hasNotificationCountIncreased(previous: number | null, current: number): boolean {
  return previous !== null && current > previous;
}
