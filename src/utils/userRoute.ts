type UserRecord = Record<string, any>;

/** 只接受酷安可访问的数字 UID，避免把用户名或占位 UID 拼成错误用户路由。 */
export function normalizeUserUid(value: unknown): string {
  const uid = String(value ?? '').trim();
  return /^\d+$/.test(uid) && !/^0+$/.test(uid) ? uid : '';
}

/** 从动态及其作者嵌套对象中提取有效 UID。 */
export function getUserUid(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const record = source as UserRecord;
  const nestedUsers = [record.userInfo, record.user, record.authorInfo, record.author].filter((value): value is UserRecord => Boolean(value && typeof value === 'object' && !Array.isArray(value)));
  const candidates = [
    record.uid,
    record.userId,
    record.user_id,
    record.authorUid,
    record.author_uid,
    ...nestedUsers.flatMap((user) => [user.uid, user.userId, user.user_id, user.authorUid, user.author_uid, user.id]),
  ];
  for (const candidate of candidates) {
    const uid = normalizeUserUid(candidate);
    if (uid) return uid;
  }
  return '';
}
