import { normalizeCoolapkNativeRoute, normalizeCoolapkRoute } from './coolapkRoute';

type NotificationRecord = Record<string, any>;

function asRecord(value: unknown): NotificationRecord | null {
  return value && typeof value === 'object' ? value as NotificationRecord : null;
}

function entityType(value: NotificationRecord): string {
  return [
    value.entityType,
    value.entity_type,
    value.feedType,
    value.feed_type,
    value.targetType,
    value.target_type,
    value.type,
  ].filter(Boolean).map((item) => String(item).toLowerCase()).join(' ');
}

function hasExplicitFeedType(value: NotificationRecord): boolean {
  const type = entityType(value);
  return type.includes('feed') || Boolean(value.feedId || value.feed_id || value.fid);
}

function isFeedLikeTarget(value: unknown): value is NotificationRecord {
  const record = asRecord(value);
  if (!record) return false;
  if (hasExplicitFeedType(record)) return true;
  const type = entityType(record);
  if (/product|device|apk|app|game|goods|user|topic|dyh|album/.test(type)) return false;
  return Boolean(record.message || record.message_raw_output || record.message_title || record.replyRows || record.replyRowsCount);
}

export function getNotificationFeedTarget(item: unknown): NotificationRecord | null {
  const record = asRecord(item);
  if (!record) return null;
  const feedInfo = asRecord(record.feedInfo);
  if (feedInfo) return feedInfo;
  const targetFeed = asRecord(record.targetFeed);
  if (targetFeed) return targetFeed;
  return isFeedLikeTarget(record.targetRow) ? record.targetRow : null;
}

function normalizeFeedId(value: unknown): string {
  const raw = String(value || '').trim().replace(/^feed:/i, '');
  return /^\d+$/.test(raw) ? raw : '';
}

function getFeedIdFromSource(value: unknown): string {
  const match = String(value || '').match(/(?:^|[/?#])feed\/(\d+)/i);
  return match?.[1] || '';
}

export function getNotificationFeedId(item: unknown): string {
  const record = asRecord(item);
  if (!record) return '';

  const feedTarget = getNotificationFeedTarget(record);
  for (const value of [feedTarget?.feedId, feedTarget?.feed_id, feedTarget?.fid, feedTarget?.id, record.feedId, record.feed_id, record.fid]) {
    const feedId = normalizeFeedId(value);
    if (feedId) return feedId;
  }

  if (hasExplicitFeedType(record)) {
    for (const value of [record.targetId, record.target_id, record.id]) {
      const feedId = normalizeFeedId(value);
      if (feedId) return feedId;
    }
  }

  for (const value of [record.url, record.targetUrl, record.target_url, record.note, record.message, record.targetTitle]) {
    const feedId = getFeedIdFromSource(value);
    if (feedId) return feedId;
  }
  return '';
}

function routeFromSource(value: unknown): string | null {
  return normalizeCoolapkRoute(String(value || ''));
}

function getNotificationCandidates(item: NotificationRecord): NotificationRecord[] {
  return [item.targetRow, item.targetFeed, item.feedInfo, item]
    .map(asRecord)
    .filter((candidate): candidate is NotificationRecord => Boolean(candidate));
}

export function getNotificationTargetRoute(item: unknown): string | null {
  const record = asRecord(item);
  if (!record) return null;

  for (const candidate of getNotificationCandidates(record)) {
    for (const value of [candidate.url, candidate.targetUrl, candidate.target_url, candidate.webUrl, candidate.web_url]) {
      const route = routeFromSource(value);
      if (route) return route;
    }

    const type = entityType(candidate);
    const packageName = candidate.packageName || candidate.package_name || candidate.apkname || candidate.apkName;
    if (packageName && /(apk|app|game)/.test(type)) {
      return normalizeCoolapkNativeRoute(`/apk/${String(packageName)}`);
    }

    const productId = candidate.productId || candidate.product_id || (/(product|device)/.test(type) ? candidate.id || candidate.entityId || candidate.entity_id || candidate.target_id : '');
    if (productId && /(product|device)/.test(type)) {
      return normalizeCoolapkNativeRoute(`/product/${String(productId)}`);
    }
  }
  return null;
}
