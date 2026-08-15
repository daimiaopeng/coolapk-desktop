import type { DiscoveryEntity, DiscoveryPageResult, DiscoveryRoute, DiscoveryTab } from '../types/discovery';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value).trim();
    if (text) return text;
  }
  return '';
}

function parseExtraData(entity: DiscoveryEntity): Record<string, unknown> {
  const value = entity.extraData ?? entity.extra_data ?? entity.extraDataArr ?? entity.extra_data_arr;
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try { return asRecord(JSON.parse(value)); } catch { return {}; }
  }
  return {};
}

function isDiscoveryConfigEntity(entity: DiscoveryEntity): boolean {
  const id = asString(entity.id ?? entity.entityId);
  const title = asString(entity.title);
  return id === '20131' || title === '发现' || title.toLowerCase() === 'discovery';
}

function candidatePages(value: unknown): DiscoveryEntity[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entity = asRecord(item) as DiscoveryEntity;
    if (Array.isArray(entity.entities)) return [entity, ...candidatePages(entity.entities)];
    return [entity];
  });
}

export function parseDiscoveryTabs(response: unknown): DiscoveryTab[] {
  const root = asRecord(response);
  const data = Array.isArray(root.data) ? root.data : [];
  const discoveryCards = data.filter((item) => isDiscoveryConfigEntity(asRecord(item) as DiscoveryEntity));
  const sources = discoveryCards;
  const pages = candidatePages(sources).filter((entity) => {
    const type = asString(entity.entityType).toLowerCase();
    const template = asString(entity.entityTemplate).toLowerCase();
    return type.includes('configpage') || template.includes('configpage') || Boolean(entity.pageName || entity.page_name);
  });

  const seen = new Set<string>();
  return pages.map((entity, index) => {
    const extra = parseExtraData(entity);
    const pageName = firstString(entity.pageName, entity.page_name, extra.pageName, extra.page_name);
    const webUrl = firstString(entity.webUrl, entity.web_url, extra.webUrl, extra.web_url);
    const url = firstString(entity.url, extra.url, pageName, webUrl);
    const key = pageName || url || asString(entity.id ?? entity.entityId ?? entity.title) || `tab-${index}`;
    const pageVisibility = entity.page_visibility ?? entity.pageVisibility ?? extra.page_visibility ?? 1;
    const status = entity.status ?? extra.status ?? 1;
    const visible = pageVisibility !== 0 && pageVisibility !== '0' && pageVisibility !== false
      && status !== 0 && status !== '0' && status !== false;
    const uniqueKey = seen.has(key) ? `${key}-${index}` : key;
    seen.add(uniqueKey);
    const nativeKind: DiscoveryTab['nativeKind'] = pageName === 'V11_FIND_DYH' || url === '/user/dyhSubscribe'
      ? 'dyh'
      : pageName === 'V11_FIND_GOOD_GOODS_HOME'
        ? 'goods'
        : undefined;
    return {
      key: uniqueKey,
      title: firstString(entity.title, extra.title) || `发现 ${index + 1}`,
      url,
      webUrl,
      pageName,
      subTitle: asString(entity.subTitle ?? entity.sub_title ?? extra.subTitle),
      icon: firstString(entity.tabIcon, entity.tab_icon, entity.logo, entity.icon, extra.tabIcon),
      selectedIcon: asString(entity.tabSelectedIcon ?? entity.tab_selected_icon ?? extra.tabSelectedIcon),
      iconTint: asString(entity.tabIconTint ?? entity.tab_icon_tint ?? extra.tabIconTint),
      openNewActivity: extra.openNewActivity === 1 || extra.openNewActivity === '1' || entity.openNewActivity === true,
      nativeKind,
      visible,
      order: Number(entity.order ?? entity.page_order ?? extra.order ?? index),
      raw: entity,
    };
  }).filter((tab) => tab.visible && tab.url)
    .sort((a, b) => a.order - b.order);
}

export function parseDiscoverySelectedKey(response: unknown, tabs: DiscoveryTab[]): string {
  const root = asRecord(response);
  const data = Array.isArray(root.data) ? dataFromArray(root.data) : [];
  const card = data.find((entity) => isDiscoveryConfigEntity(entity));
  if (!card) return tabs[0]?.key || '';
  const extra = parseExtraData(card);
  const selected = asString(extra.selectedHomeTab ?? extra.selectedTab ?? card.selectedHomeTab);
  return tabs.find((tab) => tab.key === selected || tab.pageName === selected || tab.url === selected)?.key
    || tabs[0]?.key
    || '';
}

function dataFromArray(data: unknown[]): DiscoveryEntity[] {
  return data.map((item) => asRecord(item) as DiscoveryEntity);
}

export function parseDiscoveryPage(response: unknown, page: number): DiscoveryPageResult {
  const root = asRecord(response);
  const rawData = root.data;
  const parsedItems = Array.isArray(rawData)
    ? rawData.flatMap((item) => {
      const entity = asRecord(item) as DiscoveryEntity;
      return Array.isArray(entity.entities) && !entity.entityTemplate ? entity.entities : [entity];
    })
    : [];
  const meta = asRecord(root.pagination ?? root.pageInfo ?? root.page_info);
  const configCard = parsedItems.find((item) => {
    const template = String(item.entityTemplate || '').toLowerCase();
    const type = String(item.entityType || '').toLowerCase();
    return template === 'configcard' || type === 'configcard';
  });
  function isDisclaimerCard(item: DiscoveryEntity): boolean {
    const text = `${item.title || ''} ${item.description || ''} ${item.message || ''} ${item.subTitle || ''}`;
    return text.includes('禁发红包') || text.includes('人头车') || (text.includes('欢迎举报') && text.includes('必封'));
  }
  const items = parsedItems.filter((item) => {
    const template = String(item.entityTemplate || '').toLowerCase();
    const type = String(item.entityType || '').toLowerCase();
    if (template === 'configcard' || type === 'configcard') return false;
    if (isDisclaimerCard(item)) return false;
    return true;
  });
  const config = configCard ? parseExtraData(configCard) : {};
  const firstItem = firstString(root.firstItem, root.first_item, meta.firstItem, meta.first_item, config.firstItem, config.first_item);
  const lastItem = firstString(root.lastItem, root.last_item, meta.lastItem, meta.last_item, config.lastItem, config.last_item);
  const total = Number(root.total ?? meta.total ?? config.total ?? 0);
  const current = Number(root.current ?? meta.current ?? config.current ?? page);
  const explicitMore = root.hasMore ?? root.has_more ?? meta.hasMore ?? meta.has_more
    ?? (total > 0 ? current < total : undefined);
  const hasMore = typeof explicitMore === 'boolean'
    ? explicitMore
    : items.length >= 20;
  return { items, page, hasMore, firstItem, lastItem, raw: response };
}

export function getEntityKey(entity: DiscoveryEntity, index: number): string {
  return asString(entity.entityId ?? entity.id ?? entity.url) || `${entity.entityTemplate || entity.entityType || 'entity'}-${index}`;
}

/**
 * Normalize a route parameter that may have been encoded by the server or by
 * an earlier route resolver. This prevents topic links from being encoded a
 * second time when they are opened from the discovery page.
 */
export function decodeDiscoveryRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getEntityImage(entity: DiscoveryEntity): string {
  return firstString(
    entity.productGoodsLogo,
    entity.product_goods_cover,
    entity.goodsCover,
    entity.goods_cover,
    entity.goodsPic,
    entity.goods_pic,
    entity.pic,
    entity.logo,
    entity.icon,
    entity.image,
    entity.banner,
    entity.userAvatar,
    entity.cover,
    entity.coverUrl,
    entity.cover_url,
    entity.picUrl,
    entity.pic_url,
  );
}

export function isGoodsEntity(entity: DiscoveryEntity): boolean {
  const type = `${asString(entity.entityType)} ${asString(entity.entityTemplate)}`.toLowerCase();
  return type.includes('goods') || type.includes('commodity') || type.includes('merchant') || type.includes('sale');
}

export function getEntityText(entity: DiscoveryEntity): string {
  return asString(entity.message ?? entity.description ?? entity.subTitle ?? entity.title);
}

export function resolveDiscoveryRoute(entity: DiscoveryEntity): DiscoveryRoute | null {
  const extra = parseExtraData(entity);
  const entityUrl = asString(entity.url);
  const target = /^https?:\/\//i.test(entityUrl)
    ? entityUrl
    : firstString(entity.webUrl, entity.web_url, extra.webUrl, extra.web_url, entityUrl, entity.targetUrl, entity.target_url);
  if (!target) return null;
  if (/^https?:\/\//i.test(target)) return { kind: 'web', target, title: asString(entity.title) };
  const apkDetail = target.match(/^\/?apk\/detail\?(?:[^#]*&)?packageName=([^&#]+)/i);
  if (apkDetail) {
    return { kind: 'native', target: `/apk/${decodeURIComponent(apkDetail[1])}`, title: asString(entity.title) };
  }
  const productDetail = target.match(/^\/?product\/detail\?(?:[^#]*&)?(?:id|productId)=([^&#]+)/i);
  if (productDetail) {
    return { kind: 'native', target: `/product/${decodeURIComponent(productDetail[1])}`, title: asString(entity.title) };
  }
  if (/^\/page\?url=/i.test(target) || /^#\//.test(target) || /^\/(apk|main|feed|product|topic)\//i.test(target)) {
    return { kind: 'data-list', target, title: asString(entity.title) };
  }
  if (/^\/(user|dyh)\/\d+/i.test(target) || /^\/(feed|product)\/\d+/i.test(target)) {
    return { kind: 'native', target, title: asString(entity.title) };
  }
  if (/^V11_FIND_(GOOD_GOODS_HOME|DYH)$/i.test(target)) {
    return { kind: 'native', target, title: asString(entity.title) };
  }
  const type = asString(entity.entityType).toLowerCase();
  if (type.includes('feed') && (entity.id || entity.entityId)) {
    return { kind: 'native', target: `/feed/${asString(entity.id ?? entity.entityId)}`, title: asString(entity.title) };
  }
  if (type.includes('user') && entity.uid) {
    return { kind: 'native', target: `/user/${asString(entity.uid)}`, title: asString(entity.title) };
  }
  if ((type.includes('apk') || type.includes('app')) && (entity.packageName || entity.package_name)) {
    return { kind: 'native', target: `/apk/${asString(entity.packageName ?? entity.package_name)}`, title: asString(entity.title) };
  }
  if (type.includes('product') && (entity.productId || entity.product_id || entity.id)) {
    return { kind: 'native', target: `/product/${asString(entity.productId ?? entity.product_id ?? entity.id)}`, title: asString(entity.title) };
  }
  if (type.includes('topic') && (entity.tag || entity.title)) {
    return { kind: 'native', target: `/topic/${encodeURIComponent(asString(entity.tag ?? entity.title))}`, title: asString(entity.title) };
  }
  if (type.includes('dyh') && (entity.dyhId || entity.dyh_id || entity.id)) {
    return { kind: 'native', target: `/dyh/${asString(entity.dyhId ?? entity.dyh_id ?? entity.id)}`, title: asString(entity.title) };
  }
  return { kind: 'data-list', target, title: asString(entity.title) };
}

export function isFeedEntity(entity: DiscoveryEntity): boolean {
  const type = asString(entity.entityType).toLowerCase();
  const template = asString(entity.entityTemplate).toLowerCase();
  return type.includes('feed') || template.includes('feed');
}

export function isImageCard(entity: DiscoveryEntity): boolean {
  const template = asString(entity.entityTemplate).toLowerCase();
  return template.includes('carousel') || template.includes('imagecard') || template.includes('banner');
}

export function isGridCard(entity: DiscoveryEntity): boolean {
  const template = asString(entity.entityTemplate).toLowerCase();
  return template.includes('grid') || template.includes('icon') || template.includes('linkcard');
}
