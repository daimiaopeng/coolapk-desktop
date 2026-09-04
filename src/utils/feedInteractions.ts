import { getUserUid, normalizeUserUid } from './userRoute';

export type FeedInteractionMode = 'likes' | 'forwards';

export interface FeedInteractionItem {
  id: string;
  uid: string;
  username: string;
  avatar: string;
  pluginUrl: string;
  dateline: string | number;
  message: string;
  title: string;
  raw: Record<string, any>;
}

export const FEED_INTERACTION_PAGE_SIZE = 20;

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
}

function firstText(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = textValue(record[key]);
    if (value) return value;
  }
  return '';
}

function findList(value: unknown, depth = 0): unknown[] {
  if (Array.isArray(value)) return value;
  if (depth > 5) return [];
  const record = asRecord(value);
  for (const key of ['data', 'entities', 'list', 'items', 'rows', 'forwardList', 'forward_list', 'likeList', 'like_list']) {
    if (record[key] === undefined) continue;
    const rows = findList(record[key], depth + 1);
    if (rows.length || Array.isArray(record[key])) return rows;
  }
  return [];
}

function nestedUserRecords(record: Record<string, any>): Record<string, any>[] {
  return ['userInfo', 'user_info', 'user', 'author', 'authorInfo', 'author_info', 'fromUser', 'from_user', 'sender', 'forwardUser', 'forward_user']
    .map((key) => asRecord(record[key]))
    .filter((user) => Object.keys(user).length > 0);
}

function getInteractionUid(record: Record<string, any>, users: Record<string, any>[]): string {
  const directUid = getUserUid(record);
  if (directUid) return directUid;
  for (const user of users) {
    const uid = getUserUid(user) || normalizeUserUid(user.id);
    if (uid) return uid;
  }
  return normalizeUserUid(record.uid ?? record.userId ?? record.user_id ?? record.authorUid ?? record.author_uid ?? record.id);
}

function getInteractionId(record: Record<string, any>, uid: string, index: number): string {
  return firstText(record, ['interactionId', 'interaction_id', 'forwardId', 'forward_id', 'likeId', 'like_id', 'entityId', 'entity_id', 'id']) || uid || `interaction-${index}`;
}

function getInteractionUsername(record: Record<string, any>, users: Record<string, any>[]): string {
  return firstText(record, ['username', 'userName', 'user_name', 'nickname', 'nickName', 'displayName', 'display_name', 'name', 'forwardUsername', 'forward_username'])
    || users.map((user) => firstText(user, ['username', 'userName', 'user_name', 'nickname', 'nickName', 'displayName', 'display_name', 'name'])).find(Boolean)
    || '酷友';
}

function getInteractionAvatar(record: Record<string, any>, users: Record<string, any>[]): string {
  return firstText(record, ['userAvatar', 'user_avatar', 'avatar', 'avatarUrl', 'avatar_url', 'userSmallAvatar', 'user_small_avatar', 'userBigAvatar', 'user_big_avatar', 'headImg', 'head_img', 'icon'])
    || users.map((user) => firstText(user, ['userAvatar', 'user_avatar', 'avatar', 'avatarUrl', 'avatar_url', 'userSmallAvatar', 'user_small_avatar', 'userBigAvatar', 'user_big_avatar', 'headImg', 'head_img', 'icon'])).find(Boolean)
    || '';
}

function getInteractionPluginUrl(record: Record<string, any>, users: Record<string, any>[]): string {
  return firstText(record, ['avatar_plugin_url', 'avatarPluginUrl', 'userAvatarPluginUrl', 'user_avatar_plugin_url'])
    || users.map((user) => firstText(user, ['avatar_plugin_url', 'avatarPluginUrl', 'userAvatarPluginUrl', 'user_avatar_plugin_url'])).find(Boolean)
    || '';
}

function getInteractionMessage(record: Record<string, any>): string {
  return firstText(record, ['message', 'message_raw_output', 'content', 'text', 'note', 'comment', 'forwardMessage', 'forward_message', 'description']);
}

function getInteractionDateline(record: Record<string, any>): string | number {
  for (const key of ['dateline', 'createTime', 'create_time', 'lastupdate', 'lastUpdate', 'time', 'date', 'infoHtml']) {
    if (record[key] !== undefined && record[key] !== null && textValue(record[key])) return record[key];
  }
  return '';
}

/** 提取点赞/转发接口的分页数据，保留用户列表中的原始字段。 */
export function extractFeedInteractionRows(response: unknown): FeedInteractionItem[] {
  return findList(response).map((item, index) => normalizeFeedInteractionRow(item, index)).filter((item): item is FeedInteractionItem => Boolean(item));
}

/** 将不同版本的互动列表实体归一化为弹窗展示所需字段。 */
export function normalizeFeedInteractionRow(value: unknown, index: number): FeedInteractionItem | null {
  const record = asRecord(value);
  if (!Object.keys(record).length) return null;
  const users = nestedUserRecords(record);
  const uid = getInteractionUid(record, users);
  const id = getInteractionId(record, uid, index);
  return {
    id,
    uid,
    username: getInteractionUsername(record, users),
    avatar: getInteractionAvatar(record, users),
    pluginUrl: getInteractionPluginUrl(record, users),
    dateline: getInteractionDateline(record),
    message: getInteractionMessage(record),
    title: firstText(record, ['title', 'message_title', 'messageTitle']),
    raw: record,
  };
}

export function getFeedInteractionKey(item: FeedInteractionItem, index = 0): string {
  if (item.id && !item.id.startsWith('interaction-')) return `id:${item.id}`;
  if (item.uid) return `uid:${item.uid}`;
  return `row:${item.username}:${item.dateline}:${item.message}:${index}`;
}

function getExplicitHasMore(response: unknown): unknown {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const pagination = asRecord(root.pagination || root.pageInfo || root.page_info || data.pagination || data.pageInfo || data.page_info);
  return root.hasMore ?? root.has_more ?? data.hasMore ?? data.has_more ?? pagination.hasMore ?? pagination.has_more;
}

function isTruthy(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const normalized = textValue(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function hasMoreFeedInteractions(response: unknown, rowCount: number): boolean {
  const explicit = getExplicitHasMore(response);
  if (explicit !== undefined) return isTruthy(explicit);
  return rowCount >= FEED_INTERACTION_PAGE_SIZE;
}

/** 使用动态列表常见的时间字段显示相对时间，无法解析时保留服务端文本。 */
export function formatFeedInteractionDate(value: unknown, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const raw = textValue(value);
  if (!raw) return '';
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return raw;
  const seconds = numeric >= 1_000_000_000_000 ? numeric / 1000 : numeric >= 10_000_000_000 ? numeric / 10 : numeric;
  const difference = Math.max(0, nowSeconds - seconds);
  if (difference < 60) return '刚刚';
  if (difference < 3600) return `${Math.floor(difference / 60)}分钟前`;
  if (difference < 86400) return `${Math.floor(difference / 3600)}小时前`;
  if (difference < 2_592_000) return `${Math.floor(difference / 86400)}天前`;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? raw : `${date.getMonth() + 1}-${date.getDate()}`;
}
