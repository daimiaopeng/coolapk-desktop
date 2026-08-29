import type { NotificationCategory } from './notificationCount';

const STORAGE_PREFIX = 'coolapk.notification.seen.v1';
const COUNT_STORAGE_PREFIX = 'coolapk.notification.seen-count.v1';
const MAX_SEEN_ITEMS = 200;
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

type SeenItems = Record<string, number>;

function getStorageKey(uid: string | number, category: NotificationCategory): string {
  return `${STORAGE_PREFIX}.${String(uid).trim()}.${category}`;
}

function getCountStorageKey(uid: string | number, category: NotificationCategory): string {
  return `${COUNT_STORAGE_PREFIX}.${String(uid).trim()}.${category}`;
}

function normalizeSeenItems(value: unknown): SeenItems {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, seenAt]) => [key, Number(seenAt)] as const)
      .filter(([key, seenAt]) => key && Number.isFinite(seenAt) && now - seenAt <= MAX_AGE_MS),
  );
}

function readSeenItems(uid: string | number, category: NotificationCategory): SeenItems {
  if (!String(uid).trim()) return {};
  try {
    return normalizeSeenItems(JSON.parse(localStorage.getItem(getStorageKey(uid, category)) || '{}'));
  } catch {
    return {};
  }
}

function writeSeenItems(uid: string | number, category: NotificationCategory, items: SeenItems) {
  try {
    localStorage.setItem(getStorageKey(uid, category), JSON.stringify(items));
  } catch (error) {
    console.warn('保存已读通知记录失败:', error);
  }
}

/** 同一条通知在不同列表中的字段不完全一致，优先使用稳定实体 ID。 */
export function getNotificationSeenKey(item: any, category: NotificationCategory): string | null {
  const actor = item?.fromuid ?? item?.uid ?? item?.likeUid ?? item?.like_uid ?? '';
  const time = item?.likeTime ?? item?.dateline ?? item?.createTime ?? item?.create_time ?? '';
  const target = item?.targetId ?? item?.target_id ?? item?.feedId ?? item?.feed_id ?? '';
  const id = item?.notificationId
    ?? item?.notification_id
    ?? item?.id
    ?? item?.entityId
    ?? item?.entity_id
    ?? item?.likeId
    ?? item?.like_id;
  if (id !== undefined && id !== null && String(id).trim()) {
    return `${category}:id:${String(id).trim()}:${String(actor).trim()}:${String(time).trim()}`;
  }

  if (!String(actor).trim() && !String(time).trim() && !String(target).trim()) return null;
  return `${category}:row:${String(actor).trim()}:${String(time).trim()}:${String(target).trim()}`;
}

export function hasSeenNotificationItems(uid: string | number, category: NotificationCategory): boolean {
  return Object.keys(readSeenItems(uid, category)).length > 0;
}

/**
 * 服务端不支持点赞分类已读时，保存本机已确认的数量，供下次启动先抵消旧 badge。
 * 数量只在服务端总通知真正归零后清空，避免重启反复提示同一批点赞。
 */
export function addSeenNotificationCount(
  uid: string | number,
  category: NotificationCategory,
  count: number,
): number {
  const parsedCount = Number(count);
  const increment = Number.isFinite(parsedCount) ? Math.max(0, Math.floor(parsedCount)) : 0;
  if (!String(uid).trim() || increment <= 0) return 0;

  try {
    const key = getCountStorageKey(uid, category);
    const previous = Number(localStorage.getItem(key) || 0);
    const next = Math.min(200, Math.max(0, Number.isFinite(previous) ? Math.floor(previous) : 0) + increment);
    localStorage.setItem(key, String(next));
    return next;
  } catch (error) {
    console.warn('保存已读通知数量失败:', error);
    return 0;
  }
}

/**
 * 启动时按当前服务端总未读数恢复本机已读抵消。若服务端已经归零，旧记录也一并清除。
 */
export function takeSeenNotificationCount(
  uid: string | number,
  category: NotificationCategory,
  availableCount: number,
): number {
  const parsedAvailable = Number(availableCount);
  const available = Number.isFinite(parsedAvailable) ? Math.max(0, Math.floor(parsedAvailable)) : 0;
  if (!String(uid).trim()) return 0;

  try {
    const key = getCountStorageKey(uid, category);
    const stored = Number(localStorage.getItem(key) || 0);
    const seenCount = Number.isFinite(stored) ? Math.max(0, Math.floor(stored)) : 0;
    if (available === 0) {
      localStorage.removeItem(key);
      return 0;
    }
    const restored = Math.min(seenCount, available);
    // 服务端总数低于旧记录，说明部分旧通知已自然消失，收敛保存的抵消数量。
    if (restored !== seenCount) localStorage.setItem(key, String(restored));
    return restored;
  } catch (error) {
    console.warn('读取已读通知数量失败:', error);
    return 0;
  }
}

/** 只保存本次确认已读的前 N 条，避免把同页历史通知都当成未读。 */
export function markNotificationItemsSeen(
  uid: string | number,
  category: NotificationCategory,
  items: unknown[],
  count: number,
): number {
  const parsedCount = Number(count);
  const safeCount = Number.isFinite(parsedCount) ? Math.max(0, Math.floor(parsedCount)) : 0;
  if (!String(uid).trim() || safeCount <= 0 || !Array.isArray(items)) return 0;

  const seenItems = readSeenItems(uid, category);
  const now = Date.now();
  let added = 0;
  for (const item of items) {
    if (added >= safeCount) break;
    const key = getNotificationSeenKey(item, category);
    if (!key) continue;
    seenItems[key] = now;
    added += 1;
  }

  const trimmed = Object.entries(seenItems)
    .sort(([, left], [, right]) => right - left)
    .slice(0, MAX_SEEN_ITEMS);
  writeSeenItems(uid, category, Object.fromEntries(trimmed));
  return added;
}

/** 返回当前列表中已在本机确认过的通知条数。 */
export function countSeenNotificationItems(
  uid: string | number,
  category: NotificationCategory,
  items: unknown[],
): number {
  if (!String(uid).trim() || !Array.isArray(items)) return 0;
  const seenItems = readSeenItems(uid, category);
  return items.reduce<number>((count, item) => {
    const key = getNotificationSeenKey(item, category);
    return key && seenItems[key] ? count + 1 : count;
  }, 0);
}
