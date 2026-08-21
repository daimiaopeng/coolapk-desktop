/** 将酷安应用链接统一转换为桌面端应用详情路由。 */
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
  return `/product/${encodeURIComponent(productMatch[1])}`;
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

function normalizeCoolapkUserRoute(href: string): string | null {
  const match = href.match(/^\/(?:u|user)\/([^/?#]+)(?:\?([^#]*))?$/i);
  if (!match) return null;
  return `/user/${match[1]}${match[2] ? `?${match[2]}` : ''}`;
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

/** 将酷安站内 URL、Hash 页面和桌面端已有页面统一转换为本地路由。 */
export function normalizeCoolapkRoute(href: string): string | null {
  const path = extractCoolapkPath(href);
  if (!path) return null;

  const routeRules = [
    normalizeCoolapkRatingRoute,
    normalizeCoolapkWriterRoute,
    normalizeCoolapkPageRoute,
    normalizeCoolapkNativeRoute,
    normalizeCoolapkUserRoute,
    normalizeCoolapkTopicRoute,
    normalizeCoolapkFeedRoute,
    normalizeCoolapkDirectRoute,
  ];
  for (const normalize of routeRules) {
    const route = normalize(path);
    if (route) return route;
  }
  return null;
}
