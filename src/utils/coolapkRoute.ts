/** 将酷安应用链接统一转换为桌面端应用详情路由。 */
import { normalizeUserUid } from './userRoute';

export function normalizeCoolapkAppRoute(href: string): string | null {
  const detailMatch = href.match(/^\/apk\/detail\/?(?:\?([^#]*))?(?:#.*)?$/i);
  if (detailMatch) {
    const params = new URLSearchParams(detailMatch[1] || '');
    const packageName = params.get('packageName') || params.get('package_name');
    return packageName ? `/app/${encodeURIComponent(packageName)}` : null;
  }

  const appMatch = href.match(/^\/apk\/([^/?#]+)(?:[?#].*)?$/i);
  if (!appMatch || /^(detail|list)$/i.test(appMatch[1])) return null;

  let packageName = appMatch[1];
  try {
    packageName = decodeURIComponent(packageName);
  } catch {
    // 保留原始片段，避免异常编码阻断后续外部链接处理。
  }
  return `/app/${encodeURIComponent(packageName)}`;
}

/** 将酷安产品详情链接统一转换为桌面端产品路由。 */
export function normalizeCoolapkProductRoute(href: string): string | null {
  const detailMatch = href.match(/^\/product\/detail\/?(?:\?([^#]*))?(?:#.*)?$/i);
  if (detailMatch) {
    const params = new URLSearchParams(detailMatch[1] || '');
    const productId = params.get('id') || params.get('productId') || params.get('product_id');
    return productId ? `/product/${encodeURIComponent(productId)}` : null;
  }

  const productMatch = href.match(/^\/product\/([^/?#]+)(?:[?#].*)?$/i);
  if (!productMatch || /^(detail|list)$/i.test(productMatch[1])) return null;
  const queryIndex = href.indexOf('?');
  const hashIndex = href.indexOf('#');
  const queryEnd = hashIndex >= 0 && (queryIndex < 0 || hashIndex < queryIndex) ? hashIndex : href.length;
  const query = queryIndex >= 0 && queryIndex < queryEnd ? href.slice(queryIndex + 1, queryEnd) : '';
  return `/product/${encodeURIComponent(productMatch[1])}${query ? `?${query}` : ''}`;
}

/** 统一解析酷安应用和产品的桌面端原生路由。 */
export function normalizeCoolapkNativeRoute(href: string): string | null {
  return normalizeCoolapkAppRoute(href) || normalizeCoolapkProductRoute(href);
}

const COOLAPK_HOST_RE = /^(?:www\.|m\.)?coolapk\.com$/i;

function extractCoolapkPath(href: string): string | null {
  const raw = String(href || '').trim();
  if (!raw) return null;
  const candidate = raw.startsWith('#/') ? raw.slice(1) : raw;

  try {
    const parsed = new URL(candidate, 'https://www.coolapk.com');
    if (!['http:', 'https:'].includes(parsed.protocol) || !COOLAPK_HOST_RE.test(parsed.hostname)) return null;
    if (parsed.hash.startsWith('#/')) return parsed.hash.slice(1);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function normalizeCoolapkRatingRoute(href: string): string | null {
  const match = href.match(/^\/feed\/nodeRatingList\/?(?:\?([^#]*))?$/i);
  if (!match) return null;

  const params = new URLSearchParams(match[1] || '');
  const uid = String(params.get('uid') || '').trim();
  const targetType = String(params.get('targetType') || '').toLowerCase();
  const parseRatingToFeed = params.get('parseRatingToFeed');
  if (!uid || !['all', 'apk', 'product'].includes(targetType) || (parseRatingToFeed && parseRatingToFeed !== '1')) return null;

  const ratingTarget = targetType === 'apk' ? 'app' : targetType === 'product' ? 'digital' : 'all';
  return `/user/${encodeURIComponent(uid)}?tab=rating&ratingTarget=${ratingTarget}`;
}

/** 将酷安的内容写入页按目标实体转换为桌面端已有详情路由。 */
function normalizeCoolapkWriterRoute(href: string): string | null {
  const match = href.match(/^\/feed\/writer\/?(?:\?([^#]*))?$/i);
  if (!match) return null;

  const params = new URLSearchParams(match[1] || '');
  const writerType = String(params.get('type') || '').toLowerCase();
  const targetType = String(params.get('targetType') || params.get('target_type') || '').toLowerCase();
  const targetId = String(params.get('targetId') || params.get('target_id') || '').trim();
  if (writerType !== 'rating' || targetType !== 'product' || !/^\d+$/.test(targetId)) return null;

  // 产品评价写入页本身是酷安 Web 的 SPA 页面，桌面端没有对应的可执行写接口；
  // 先进入同一产品详情，保留入口意图，避免把产品 ID 当成动态 ID 请求。
  return `/product/${encodeURIComponent(targetId)}?tab=rating&mode=writer`;
}

/** 将酷安动态里的话题列表入口转换为桌面端话题页。 */
function normalizeCoolapkTopicFeedRoute(href: string): string | null {
  const path = extractCoolapkPath(href);
  if (!path) return null;
  const match = path.match(/^\/(?:feed\/multiTagFeedList|topic\/tagFeedList)(?:\?([^#]*))?$/i);
  if (!match) return null;
  const params = new URLSearchParams(match[1] || '');
  const tag = String(params.get('tag') || params.get('title') || '').trim();
  return tag ? `/topic/${encodeURIComponent(tag)}` : null;
}

/** 解析被酷安 /page?url= 包裹的话题入口，避免落入通用头条列表页。 */
function normalizeCoolapkNestedTopicRoute(href: string): string | null {
  const path = extractCoolapkPath(href);
  if (!path) return null;
  const match = path.match(/^\/page\?url=(.+)$/i);
  if (!match) return null;
  let nestedUrl = match[1];
  try {
    nestedUrl = decodeURIComponent(nestedUrl);
  } catch {
    // 保留原始值，避免异常编码阻断其他站内链接处理。
  }
  const nestedPath = extractCoolapkPath(nestedUrl) || nestedUrl;
  return normalizeCoolapkTopicFeedRoute(nestedUrl) || normalizeCoolapkTopicRoute(nestedPath);
}

/** 将酷安服务端动态列表页转换为桌面端的通用列表路由。 */
export function normalizeCoolapkPageRoute(href: string): string | null {
  const path = extractCoolapkPath(href);
  if (!path) return null;

  const match = path.match(/^\/page\?url=(.+)$/i);
  if (!match) return null;

  let pageUrl = match[1];
  try {
    pageUrl = decodeURIComponent(pageUrl);
  } catch {
    // 保留原始值，避免异常编码阻断服务端页面加载。
  }
  return `/page?url=${encodeURIComponent(pageUrl)}`;
}

/** 将酷安机型搜索网页入口转换为桌面端原生机型列表页。 */
function normalizeCoolapkProductSelectorRoute(href: string): string | null {
  const path = extractCoolapkPath(href);
  if (!path) return null;
  const match = path.match(/^\/mp\/productSelector\/configSearch(?:\?([^#]*))?$/i);
  if (!match) return null;
  return `/product-selector${match[1] ? `?${match[1]}` : ''}`;
}

function normalizeCoolapkUserRoute(href: string): string | null {
  const match = href.match(/^\/(?:u|user)\/([^/?#]+)(?:\?([^#]*))?$/i);
  if (!match) return null;
  // 酷安用户入口使用数字 UID；用户名或占位 UID 不能拼成本地用户路由，
  // 否则点击动态里的 @用户名 会进入用户资料错误页。
  const uid = normalizeUserUid(match[1]);
  if (!uid) return null;
  return `/user/${uid}${match[2] ? `?${match[2]}` : ''}`;
}

function normalizeCoolapkTopicRoute(href: string): string | null {
  const match = href.match(/^\/(?:t|topic)\/([^/?#]+)(?:\?([^#]*))?$/i);
  if (!match) return null;
  return `/topic/${match[1]}${match[2] ? `?${match[2]}` : ''}`;
}

function normalizeCoolapkFeedRoute(href: string): string | null {
  const match = href.match(/^\/feed\/(\d+)(?:\?([^#]*))?$/i);
  if (!match) return null;
  return `/feed/${match[1]}${match[2] ? `?${match[2]}` : ''}`;
}

function normalizeCoolapkDirectRoute(href: string): string | null {
  const match = href.match(/^\/(?:app|product|user|topic|dyh|album)\/([^/?#]+)(?:\?([^#]*))?$/i);
  if (!match) return null;
  const routeName = href.slice(1, href.indexOf('/', 1));
  return `/${routeName}/${match[1]}${match[2] ? `?${match[2]}` : ''}`;
}

/** 将酷安直播详情链接转换为桌面端直播详情页。 */
function normalizeCoolapkLiveRoute(href: string): string | null {
  const directMatch = href.match(/^\/live\/([^/?#]+)(?:\?([^#]*))?$/i);
  if (directMatch && !/^detail$/i.test(directMatch[1])) return `/live/${encodeURIComponent(decodeDiscoverySegment(directMatch[1]))}${directMatch[2] ? `?${directMatch[2]}` : ''}`;
  const detailMatch = href.match(/^\/live\/detail\/?(?:\?([^#]*))?$/i);
  if (!detailMatch) return null;
  const id = new URLSearchParams(detailMatch[1] || '').get('id') || new URLSearchParams(detailMatch[1] || '').get('liveId');
  return id ? `/live/${encodeURIComponent(id)}` : null;
}

function decodeDiscoverySegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 将酷安站内 URL、Hash 页面和桌面端已有页面统一转换为本地路由。 */
export function normalizeCoolapkRoute(href: string): string | null {
  const path = extractCoolapkPath(href);
  if (!path) return null;

  const routeRules = [
    normalizeCoolapkRatingRoute,
    normalizeCoolapkWriterRoute,
    normalizeCoolapkProductSelectorRoute,
    normalizeCoolapkNestedTopicRoute,
    normalizeCoolapkTopicFeedRoute,
    normalizeCoolapkPageRoute,
    normalizeCoolapkNativeRoute,
    normalizeCoolapkUserRoute,
    normalizeCoolapkTopicRoute,
    normalizeCoolapkFeedRoute,
    normalizeCoolapkLiveRoute,
    normalizeCoolapkDirectRoute,
  ];
  for (const normalize of routeRules) {
    const route = normalize(path);
    if (route) return route;
  }
  return null;
}
