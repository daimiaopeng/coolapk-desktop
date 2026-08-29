const TOTAL_COUNT_KEYS = [
  // v18 接口的总角标字段优先于旧版 badge。
  'badge_v18',
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
  categoryPresence: Record<NotificationCategory, boolean>;
}

export type NotificationCategoryCounts = Partial<Record<NotificationCategory, number>>;

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

function readCategoryCount(
  record: Record<string, unknown>,
  category: NotificationCategory,
): { count: number; present: boolean } {
  for (const key of CATEGORY_KEYS[category]) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const count = toSafeCount(record[key]);
    if (count !== null) return { count, present: true };
  }
  return { count: 0, present: false };
}

function createEmptyCategoryCounts(): Record<NotificationCategory, number> {
  return {
    comment: 0,
    atMe: 0,
    atComment: 0,
    like: 0,
    follow: 0,
    message: 0,
  };
}

function createCategoryPresence(): Record<NotificationCategory, boolean> {
  return {
    comment: false,
    atMe: false,
    atComment: false,
    like: false,
    follow: false,
    message: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * 通知列表的每一项可能携带 notifyCount；兼容不同版本的包裹层，避免只依赖 checkCount。
 */
function getNotificationItemRecords(item: unknown): Record<string, unknown>[] {
  const root = asRecord(item);
  if (!root) return [];

  const records: Record<string, unknown>[] = [];
  const addRecord = (value: unknown) => {
    const record = asRecord(value);
    if (record && !records.includes(record)) records.push(record);
  };

  addRecord(root);
  for (const key of ['notifyCount', 'notify_count', 'notificationCount', 'notification_count']) {
    addRecord(root[key]);
  }

  const data = asRecord(root.data);
  if (data) {
    addRecord(data);
    for (const key of ['notifyCount', 'notify_count', 'notificationCount', 'notification_count']) {
      addRecord(data[key]);
    }
  }
  return records;
}

/** 从通知列表项内嵌的 notifyCount 恢复所有可识别的分类数字。 */
export function getNotificationCategoryCountsFromItems(items: unknown): NotificationCategoryCounts {
  if (!Array.isArray(items)) return {};

  const counts: NotificationCategoryCounts = {};
  for (const item of items) {
    for (const record of getNotificationItemRecords(item)) {
      for (const category of Object.keys(CATEGORY_KEYS) as NotificationCategory[]) {
        const result = readCategoryCount(record, category);
        if (!result.present) continue;
        // 同一列表的多条数据通常携带同一份 NotifyCount；取最大值可避免重复相加。
        counts[category] = Math.max(counts[category] ?? 0, result.count);
      }
    }
  }
  return counts;
}

function getExplicitItemUnreadCount(item: unknown): { count: number; present: boolean } {
  const record = asRecord(item);
  if (!record) return { count: 0, present: false };

  for (const key of ['unread_count', 'unreadCount']) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const count = toSafeCount(record[key]);
    if (count === null) continue;
    if (count > 0) return { count, present: true };
    // 和通知卡片自身的显示逻辑保持一致：unread_count 为 0 时继续看 isnew。
    break;
  }
  for (const key of ['isnew', 'isNew']) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const count = toSafeCount(record[key]);
    if (count !== null) return { count, present: true };
  }
  return { count: 0, present: false };
}

/**
 * 获取某个分类在列表项中明确标出的未读数。
 * 没有明确字段时返回 null，不能把“当前页条数”误当成未读数。
 */
export function getNotificationCategoryCountFromItems(
  items: unknown,
  category: NotificationCategory,
): number | null {
  if (!Array.isArray(items)) return null;

  const counts = getNotificationCategoryCountsFromItems(items);
  if (Object.prototype.hasOwnProperty.call(counts, category)) {
    return counts[category] ?? 0;
  }

  let total = 0;
  let hasExplicitUnread = false;
  for (const item of items) {
    const unread = getExplicitItemUnreadCount(item);
    if (!unread.present) continue;
    hasExplicitUnread = true;
    total += unread.count;
  }
  return hasExplicitUnread ? total : null;
}

/** 解析酷安 checkCount 的总未读数和各通知栏目未读数。 */
export function normalizeNotificationCounts(response: unknown): NotificationCountSnapshot {
  const payload = getPayload(response);
  const emptyCategories = createEmptyCategoryCounts();
  const emptyPresence = createCategoryPresence();
  const direct = toSafeCount(payload);
  if (direct !== null) {
    return { total: direct, categories: emptyCategories, categoryPresence: emptyPresence };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { total: 0, categories: emptyCategories, categoryPresence: emptyPresence };
  }

  const record = payload as Record<string, unknown>;
  const categories = createEmptyCategoryCounts();
  const categoryPresence = createCategoryPresence();
  for (const category of Object.keys(CATEGORY_KEYS) as NotificationCategory[]) {
    const result = readCategoryCount(record, category);
    categories[category] = result.count;
    categoryPresence[category] = result.present;
  }

  for (const key of TOTAL_COUNT_KEYS) {
    const count = toSafeCount(record[key]);
    if (count !== null) return { total: count, categories, categoryPresence };
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
  return { total: matchedCategory ? categoryTotal : 0, categories, categoryPresence };
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
  locallyViewedCount: number,
  maxAcknowledgedCount = Number.POSITIVE_INFINITY,
): { count: number; locallyViewedCount: number } {
  const serverDecrease = previousServerCount === null
    ? 0
    : Math.max(0, previousServerCount - currentServerCount);
  const acknowledgedCount = Math.min(
    serverDecrease,
    locallyViewedCount,
    Math.max(0, maxAcknowledgedCount),
  );
  const remainingViewedCount = Math.max(0, locallyViewedCount - acknowledgedCount);
  return {
    count: Math.max(0, currentServerCount - remainingViewedCount),
    locallyViewedCount: remainingViewedCount,
  };
}

/** 首次请求只建立基线；基线为 0 后收到第一条通知也必须提醒。 */
export function hasNotificationCountIncreased(previous: number | null, current: number): boolean {
  return previous !== null && current > previous;
}
