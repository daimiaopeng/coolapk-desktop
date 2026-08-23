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

  const candidates = [record, record.feedInfo, record.targetFeed, record.targetRow]
    .map(asRecord)
    .filter((candidate): candidate is NotificationRecord => Boolean(candidate));

  // 通知正文里的原始链接是酷安接口已经确认过的目标，优先使用它，
  // 避免把评论/通知记录自身的 id 误当成动态 id。
  for (const candidate of candidates) {
    for (const value of [candidate.note, candidate.message, candidate.infoHtml, candidate.url, candidate.targetUrl, candidate.target_url, candidate.webUrl, candidate.web_url, candidate.targetTitle]) {
      const feedId = getFeedIdFromSource(value);
      if (feedId) return feedId;
    }
  }

  // feedId/fid 字段本身就明确表示所属动态，优先于通用 id。
  for (const candidate of candidates) {
    for (const value of [candidate.feedId, candidate.feed_id, candidate.fid]) {
      const feedId = normalizeFeedId(value);
      if (feedId) return feedId;
    }
  }

  // 只有明确标记为 feed 的实体，才允许使用 id/targetId。
  for (const candidate of candidates) {
    if (!hasExplicitFeedType(candidate)) continue;
    for (const value of [candidate.targetId, candidate.target_id, candidate.entityId, candidate.entity_id, candidate.id]) {
      const feedId = normalizeFeedId(value);
      if (feedId) return feedId;
    }
  }

  // 兼容没有 entityType、但 targetRow 明确带有动态正文的接口返回。
  const targetRow = asRecord(record.targetRow);
  if (targetRow && isFeedLikeTarget(targetRow)) {
    const feedId = normalizeFeedId(targetRow.id);
    if (feedId) return feedId;
  }

  for (const value of [record.note, record.message, record.targetTitle]) {
    const feedId = getFeedIdFromSource(value);
    if (feedId) return feedId;
  }
  return '';
}

function routeFromSource(value: unknown): string | null {
  return normalizeCoolapkRoute(String(value || ''));
}

function containsRatingIntent(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /点评|评分/.test(value.replace(/<[^>]*>/g, ''));
}

function containsProductRatingInvite(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.replace(/<[^>]*>/g, '');
  return /点评|邀请.*评分|机主/.test(text);
}

function isProductTarget(candidate: NotificationRecord): boolean {
  const type = entityType(candidate);
  // NodeRating 的产品目标类型是 7；通知接口可能直接返回这个数字，
  // 也可能返回 product/device 等可读类型。
  return /product|device/.test(type) || /(?:^|\s)7(?:$|\s)/.test(type);
}

function routeToProductRating(route: string): string {
  if (!/^\/product\/[^/?#]+(?:\?.*)?$/i.test(route)) return route;
  const [path, query = ''] = route.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('tab', 'rating');
  return `${path}?${params.toString()}`;
}

function getProductTargetRoute(candidate: NotificationRecord): string | null {
  const explicitProductId = candidate.productId || candidate.product_id;
  const targetId = explicitProductId || (isProductTarget(candidate)
    ? candidate.targetId || candidate.target_id || candidate.entityId || candidate.entity_id || candidate.id
    : '');
  const normalizedId = String(targetId || '').trim();
  if (!normalizedId || !isProductTarget(candidate)) return null;
  return routeToProductRating(normalizeCoolapkNativeRoute(`/product/${normalizedId}`) || '');
}

function getNotificationCandidates(item: NotificationRecord): NotificationRecord[] {
  return [item.targetRow, item.targetFeed, item.feedInfo, item]
    .map(asRecord)
    .filter((candidate): candidate is NotificationRecord => Boolean(candidate));
}

function isAccountSecurityNotification(candidates: NotificationRecord[]): boolean {
  return candidates.some((candidate) => [
    candidate.note,
    candidate.message,
    candidate.message_title,
    candidate.messageTitle,
    candidate.infoHtml,
    candidate.targetTitle,
  ].some((value) => {
    if (typeof value !== 'string') return false;
    const text = value.replace(/<[^>]*>/g, '');
    return /账号安全|陌生设备|手机验证码登录|登录设备|登录地点/.test(text);
  }));
}

/**
 * 系统账号安全通知没有可用的用户实体，通知正文偶尔会给出 /u/0，
 * 该地址会被桌面端误打开为“用户资料加载失败”。APK 中对应的账号入口
 * 是 account.coolapk.com/account/settings，因此统一降级到该官方页面。
 */
export function getNotificationExternalUrl(item: unknown): string | null {
  const record = asRecord(item);
  if (!record) return null;
  const candidates = getNotificationCandidates(record);

  for (const candidate of candidates) {
    for (const value of [candidate.url, candidate.targetUrl, candidate.target_url, candidate.webUrl, candidate.web_url]) {
      const url = String(value || '').trim();
      if (/^https:\/\/account\.coolapk\.com\//i.test(url)) return url;
    }
  }

  return isAccountSecurityNotification(candidates)
    ? 'https://account.coolapk.com/account/settings'
    : null;
}

/** 从“亲爱的 Redmi K70 机主”这类通知正文提取产品名称。 */
export function getNotificationProductName(item: unknown): string | null {
  const record = asRecord(item);
  if (!record) return null;
  const candidates = getNotificationCandidates(record);
  for (const candidate of candidates) {
    for (const value of [candidate.note, candidate.message, candidate.message_title, candidate.targetTitle, candidate.title]) {
      if (typeof value !== 'string') continue;
      const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const match = text.match(/(?:亲爱的\s*)?(.{2,80}?)\s*机主/);
      if (match?.[1]) return match[1].replace(/[，,：:。.!！]+$/, '').trim();
    }
  }
  return null;
}

export async function resolveNotificationTargetRoute(
  item: unknown,
  lookupProduct: (name: string) => Promise<unknown>,
): Promise<string | null> {
  const directRoute = getNotificationTargetRoute(item);
  if (directRoute) return directRoute;

  const productName = getNotificationProductName(item);
  if (!productName) return null;
  try {
    const response = await lookupProduct(productName) as any;
    const product = response?.data || response;
    const productId = product?.id || product?.entityId || product?.entity_id;
    return productId ? `/product/${encodeURIComponent(String(productId))}?tab=rating` : null;
  } catch {
    return null;
  }
}

export function getNotificationTargetRoute(item: unknown): string | null {
  const record = asRecord(item);
  if (!record) return null;

  const candidates = getNotificationCandidates(record);
  // 安全通知的正文链接可能指向任意用户页（并不总是 /u/0）。这些链接
  // 不是通知的真实目标，必须在通用 URL 路由解析前拦截，交给
  // getNotificationExternalUrl 打开官方账号设置页。
  if (isAccountSecurityNotification(candidates)) return null;

  const ratingNotification = candidates.some((candidate) => [
    candidate.note,
    candidate.message,
    candidate.message_title,
    candidate.messageTitle,
    candidate.infoHtml,
    candidate.targetTitle,
  ].some(containsRatingIntent));
  const productRatingInvite = candidates.some((candidate) => [
    candidate.note,
    candidate.message,
    candidate.message_title,
    candidate.messageTitle,
    candidate.infoHtml,
    candidate.targetTitle,
  ].some(containsProductRatingInvite));

  // 点评邀请的正文链接在不同通知版本中可能指向发起邀请的用户（/u/:uid），
  // 而不是被点评的产品。产品通知自身的 targetType/targetId 才是可靠目标，
  // 必须先于正文链接解析，避免点击“点击点评”误进用户资料页。
  if (productRatingInvite) {
    for (const candidate of candidates) {
      const route = getProductTargetRoute(candidate);
      if (route) return route;
    }
  }

  for (const candidate of candidates) {
    for (const value of [candidate.url, candidate.targetUrl, candidate.target_url, candidate.webUrl, candidate.web_url]) {
      const route = routeFromSource(value);
      if (route) {
        // 点评邀请的 URL 可能只是邀请人的用户页，不能把它当成最终目标。
        if (productRatingInvite && !/^\/product\//i.test(route)) continue;
        return ratingNotification ? routeToProductRating(route) : route;
      }
    }

    const type = entityType(candidate);
    const packageName = candidate.packageName || candidate.package_name || candidate.apkname || candidate.apkName;
    if (packageName && /(apk|app|game)/.test(type)) {
      return normalizeCoolapkNativeRoute(`/apk/${String(packageName)}`);
    }

    const productId = candidate.productId || candidate.product_id || (isProductTarget(candidate) ? candidate.targetId || candidate.target_id || candidate.entityId || candidate.entity_id || candidate.id : '');
    if (productId && isProductTarget(candidate)) {
      const route = normalizeCoolapkNativeRoute(`/product/${String(productId)}`);
      return route && ratingNotification ? routeToProductRating(route) : route;
    }
  }
  return null;
}
