import type { ConfigPageSubChannel, ConfigPageTab, HomeTabKey } from '../types/settings';

export interface HomeSubChannel {
  key: string;
  title: string;
  url: string;
  logo: string;
  icon: string;
  subTitle: string;
  requestArgs: Record<string, unknown>;
  raw: ConfigPageSubChannel;
}

export interface HomeSubChannelSelection {
  parentKey: string;
  subChannel: HomeSubChannel;
}

export function getHomeTabKey(tab: ConfigPageTab): string {
  return tab.page_name || tab.url || String(tab.id || tab.title);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return asRecord(parsed);
    } catch {
      return {};
    }
  }
  return {};
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return '';
}

function readSubChannelChildren(value: unknown): unknown[] {
  const record = asRecord(value);
  for (const key of ['entities', 'rawEntities', 'raw_entities', 'children', 'tabs', 'subChannels', 'sub_channels']) {
    const children = parseArray(record[key]);
    if (children.length > 0) return children;
  }
  return [];
}

function getConfiguredSubChannelSource(tab: ConfigPageTab | undefined): unknown[] {
  if (!tab) return [];
  for (const value of [tab.entities, tab.rawEntities, tab.raw_entities]) {
    const source = parseArray(value);
    if (source.length > 0) return source;
  }
  return [];
}

function collectSubChannelLeaves(value: unknown, output: ConfigPageSubChannel[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectSubChannelLeaves(item, output);
    return;
  }
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return;
  const children = readSubChannelChildren(record);
  if (children.length > 0) {
    collectSubChannelLeaves(children, output);
    return;
  }
  output.push(record as ConfigPageSubChannel);
}

function getSubChannelTitle(value: unknown): string {
  const record = asRecord(value);
  return firstText(record.title, record.name, record.label);
}

function getSubChannelUrl(value: unknown): string {
  const record = asRecord(value);
  return firstText(record.url, record.pageName, record.page_name, record.action);
}

function getQueryRequestArgs(url: string): Record<string, unknown> {
  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) return {};
  const query = url.slice(queryIndex + 1).split('#')[0];
  const result: Record<string, unknown> = {};
  const reserved = new Set(['url', 'title', 'subtitle', 'sub_title', 'page', 'firstitem', 'first_item', 'lastitem', 'last_item', 'pagecontext', 'page_context']);
  new URLSearchParams(query).forEach((value, key) => {
    if (key && !reserved.has(key.toLowerCase())) result[key] = value;
  });
  return result;
}

function getSubChannelRequestArgs(value: ConfigPageSubChannel, url: string): Record<string, unknown> {
  const record = value as Record<string, unknown>;
  const extra = parseRecord(record.extraData ?? record.extra_data);
  const requestSources = [
    record.requestArgs,
    record.request_args,
    record.requestParams,
    record.request_params,
    record.params,
    record.queryParams,
    record.query_params,
    extra.requestArgs,
    extra.request_args,
    extra.requestParams,
    extra.request_params,
    extra.params,
    extra.queryParams,
    extra.query_params,
  ];
  const explicit = requestSources.map(parseRecord).find((item) => Object.keys(item).length > 0) || {};
  const directType = firstText(record.type, extra.type);
  return { ...getQueryRequestArgs(url), ...(directType ? { type: directType } : {}), ...explicit };
}

function normalizeSubChannelIcon(value: unknown): string {
  const icon = firstText(value);
  if (!icon) return 'fas fa-layer-group';
  return icon.startsWith('fa-') ? `fas ${icon}` : icon;
}

function getFollowSubChannelRoute(tab: ConfigPageTab): string {
  const source = `${tab.page_name || ''} ${tab.url || ''}`.toLowerCase();
  return source.includes('v9_home_tab_follow') || source.includes('followfeedlist')
    ? 'V9_HOME_TAB_FOLLOW'
    : 'V15_HOME_TAB_FOLLOW';
}

/** 当前首页配置没有子实体时，按 APK 关注页的 type 维度生成可点击子栏目。 */
function getFollowSubChannelFallback(tab: ConfigPageTab): ConfigPageSubChannel[] {
  const route = getFollowSubChannelRoute(tab);
  return [
    { id: 'follow-all', title: '全部关注', url: route },
    { id: 'follow-circle', title: '好友关注', url: route, type: 'circle' },
    { id: 'follow-apk', title: '应用关注', url: route, type: 'apk' },
    { id: 'follow-topic', title: '话题关注', url: route, type: 'topic' },
    { id: 'follow-recent', title: '最近常去', url: route, type: 'recent' },
    { id: 'follow-product', title: '数码关注', url: route, type: 'product' },
  ];
}

function buildHomeSubChannels(tab: ConfigPageTab, source: unknown[]): HomeSubChannel[] {
  const leaves: ConfigPageSubChannel[] = [];
  collectSubChannelLeaves(source, leaves);
  const parentKey = getHomeTabKey(tab);
  const usedKeys = new Set<string>();
  return leaves.map((raw, index) => {
    const title = getSubChannelTitle(raw);
    const url = getSubChannelUrl(raw);
    const baseKey = firstText(raw.entityId, raw.entity_id, raw.id, raw.pageName, raw.page_name, url, title) || `sub-${index}`;
    let key = `${parentKey}:${baseKey}`;
    if (usedKeys.has(key)) key = `${key}:${index}`;
    usedKeys.add(key);
    return {
      key,
      title,
      url,
      logo: firstText(raw.logo, raw.pic, raw.icon),
      icon: normalizeSubChannelIcon(raw.icon),
      subTitle: firstText(raw.subTitle, raw.sub_title, raw.description),
      requestArgs: getSubChannelRequestArgs(raw, url),
      raw,
    };
  }).filter((item) => Boolean(item.title && item.url));
}

/** 读取 APK ConfigPage 下发的子栏目，支持直接数组和分组嵌套数组。 */
export function getHomeSubChannels(tab: ConfigPageTab | undefined): HomeSubChannel[] {
  if (!tab) return [];
  const configured = getConfiguredSubChannelSource(tab);
  const configuredChannels = buildHomeSubChannels(tab, configured);
  if (configuredChannels.length > 0) return configuredChannels;
  if (isFollowingHomeTab(tab, getHomeTabKey(tab))) return buildHomeSubChannels(tab, getFollowSubChannelFallback(tab));
  return [];
}

/** 读取服务端配置中的分组标题；关注页未下发标题时使用 APK 的固定分组名。 */
export function getHomeSubChannelGroupTitle(tab: ConfigPageTab | undefined): string {
  const source = getConfiguredSubChannelSource(tab);
  for (const item of source) {
    const title = getSubChannelTitle(item);
    const url = getSubChannelUrl(item);
    if (!url && title) return title;
    if (readSubChannelChildren(item).length > 0 && title) return title;
  }
  if (tab && isFollowingHomeTab(tab, getHomeTabKey(tab))) return '关注分组';
  return '';
}

/** 判断首页栏目是否使用 APK 的关注动态专用请求链。 */
export function isFollowingHomeTab(tab: ConfigPageTab | undefined, activeKey = ''): boolean {
  const pageName = String(tab?.page_name || '').toLowerCase();
  const url = String(tab?.url || '').toLowerCase();
  const title = String(tab?.title || '').trim();
  const key = String(activeKey || '').toLowerCase();
  return title === '关注' || title === '关注动态' || /(?:home_tab_follow|followfeedlist|followfeed)/i.test(`${pageName} ${url} ${key}`);
}

function includesAny(value: string, candidates: readonly string[]): boolean {
  const normalized = value.toLowerCase();
  return candidates.some((candidate) => normalized.includes(candidate));
}

export function matchesHomeTabPreference(tab: ConfigPageTab, preferred: HomeTabKey): boolean {
  const pageName = String(tab.page_name || '').toLowerCase();
  const url = String(tab.url || '').toLowerCase();
  const title = String(tab.title || '').trim().toLowerCase();

  switch (preferred) {
    case 'index_v8':
      return title === '推荐'
        || includesAny(pageName, ['index', 'recommend'])
        || includesAny(url, ['/main/index', 'index_v8', 'recommend']);
    case 'digest':
      return title === '头条' || pageName === 'v9_home_tab_headline' || url === '/main/headline';
    case 'hot':
      return title === '热榜' || includesAny(pageName, ['ranking']) || includesAny(url, ['ranking']);
    case 'latest':
      return title === '快讯' || includesAny(pageName, ['news']) || includesAny(url, ['news']);
    case 'cool_picture':
    case 'pictures':
      return title === '酷图'
        || title === '图片'
        || includesAny(pageName, ['coolpic', 'cool_picture', 'picture'])
        || includesAny(url, ['coolpic', 'cool_picture', '/pictures']);
    case 'secondhand':
      return title.includes('二手')
        || includesAny(pageName, ['secondhand', 'ershou'])
        || includesAny(url, ['secondhand', 'ershou']);
    case 'dyh':
      return title === '看看号'
        || includesAny(pageName, ['dyh'])
        || includesAny(url, ['dyhsubscribe', '/dyh/']);
    default:
      return false;
  }
}

export function resolvePreferredHomeTab(tabs: ConfigPageTab[], preferred: HomeTabKey): string {
  const exact = tabs.find((tab) => getHomeTabKey(tab) === preferred);
  if (exact) return getHomeTabKey(exact);

  const semantic = tabs.find((tab) => matchesHomeTabPreference(tab, preferred));
  if (semantic) return getHomeTabKey(semantic);

  return tabs[0] ? getHomeTabKey(tabs[0]) : 'V9_HOME_TAB_HEADLINE';
}
