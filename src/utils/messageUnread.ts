const UNREAD_COUNT_KEYS = [
  'unreadNum',
  'unread_num',
  'unreadCount',
  'unread_count',
] as const;

// 酷安私信模型中 fromuid 是发送者。其余字段用于兼容不同接口版本的命名。
const SENDER_UID_KEYS = [
  'fromuid',
  'fromUid',
  'senderUid',
  'sender_uid',
  'messageFromUid',
  'message_from_uid',
  'lastMessageFromUid',
  'last_message_from_uid',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeUid(value: unknown): string {
  return String(value ?? '').trim();
}

/** 读取私信或会话摘要中“最后一条消息”的发送者 UID。 */
export function getMessageSenderUid(item: unknown): string {
  const record = asRecord(item);
  if (!record) return '';
  for (const key of SENDER_UID_KEYS) {
    const uid = normalizeUid(record[key]);
    if (uid) return uid;
  }
  return '';
}

/** 判断私信摘要中的最后一条消息是否由当前账号发出。 */
export function isMessageSentByCurrentUser(item: unknown, currentUid: string | number | null | undefined): boolean {
  const senderUid = getMessageSenderUid(item);
  const userUid = normalizeUid(currentUid);
  return Boolean(senderUid && userUid && senderUid === userUid);
}

/** 读取服务端原始未读数；不在这里判断消息方向。 */
export function getRawMessageUnreadCount(item: unknown): number {
  const record = asRecord(item);
  if (!record) return 0;

  let count = 0;
  for (const key of UNREAD_COUNT_KEYS) {
    const value = Number(record[key]);
    if (!Number.isFinite(value)) continue;
    count = Math.max(count, Math.floor(value));
  }
  if (count > 0) return count;

  return Number(record.isnew ?? record.isNew ?? 0) > 0 ? 1 : 0;
}

/** 只有对方发来的未读消息才计入角标。发送者未知时保留服务端原值，避免误吞真实未读。 */
export function getMessageUnreadCount(
  item: unknown,
  currentUid: string | number | null | undefined,
): number {
  return isMessageSentByCurrentUser(item, currentUid) ? 0 : getRawMessageUnreadCount(item);
}

/** 计算当前页会话中明确由自己发送、但服务端仍标为未读的数量。 */
export function getSelfMessageUnreadCount(
  items: readonly unknown[] | null | undefined,
  currentUid: string | number | null | undefined,
): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce(
    (total, item) => total + (
      isMessageSentByCurrentUser(item, currentUid) ? getRawMessageUnreadCount(item) : 0
    ),
    0,
  );
}
