import type { DiscoveryEntity } from '../types/discovery';

export interface DigitalTab {
  key: string;
  title: string;
  url: string;
  webUrl?: string;
  pageName?: string;
  subTitle?: string;
  logo?: string;
  order: number;
  category: boolean;
  visible: boolean;
  fixed: boolean;
  rawEntities: DiscoveryEntity[];
  raw: DiscoveryEntity;
}

export interface DigitalConfig {
  tabs: DigitalTab[];
  selectedKey: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return '';
}

function isWebUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function visibleValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
  return normalized !== false && normalized !== 0 && normalized !== '0' && normalized !== 'false' && normalized !== 'hidden' && normalized !== 'disabled';
}

function isConfigPage(entity: DiscoveryEntity): boolean {
  const type = text(entity.entityType ?? entity.entity_type).toLowerCase();
  const template = text(entity.entityTemplate ?? entity.entity_template).toLowerCase();
  return type.includes('configpage') || template.includes('configpage') || Boolean(text(entity.pageName ?? entity.page_name) || entity.page_visibility !== undefined || entity.page_fixed !== undefined);
}

function isDigitalContainer(entity: DiscoveryEntity): boolean {
  const textContent = `${text(entity.title)} ${text(entity.pageName ?? entity.page_name)} ${text(entity.url)}`.toUpperCase();
  const type = text(entity.entityType ?? entity.entity_type).toLowerCase();
  return textContent.includes('数码') || textContent.includes('DIGITAL') || (type.includes('configcard') && textContent.includes('PRODUCT'));
}

function walkEntities(value: unknown, rows: DiscoveryEntity[] = [], visited = new Set<object>(), digitalContext = false): DiscoveryEntity[] {
  if (Array.isArray(value)) {
    value.forEach((item) => walkEntities(item, rows, visited, digitalContext));
    return rows;
  }
  if (!value || typeof value !== 'object' || visited.has(value)) return rows;
  visited.add(value);
  const record = asRecord(value);
  const entity = record as DiscoveryEntity;
  const inDigitalConfig = digitalContext || isDigitalContainer(entity);
  if (isDigitalPage(entity) || (digitalContext && isConfigPage(entity))) rows.push(entity);
  const childContext = inDigitalConfig && !isConfigPage(entity);
  for (const key of ['data', 'entities', 'rawEntities', 'raw_entities', 'pages', 'tabs', 'configPages', 'config_pages', 'allConfigPages', 'all_config_pages']) walkEntities(record[key], rows, visited, childContext);
  return rows;
}

function isDigitalPage(entity: DiscoveryEntity): boolean {
  const pageName = text(entity.pageName ?? entity.page_name).toUpperCase();
  const url = firstText(entity.url, entity.webUrl, entity.web_url).toLowerCase();
  const title = text(entity.title);
  const entityType = text(entity.entityType ?? entity.entity_type).toLowerCase();
  const entityTemplate = text(entity.entityTemplate ?? entity.entity_template).toLowerCase();
  if (!(entityType.includes('configpage') || entityTemplate.includes('configpage') || pageName || url)) return false;
  return pageName.includes('DIGITAL')
    || pageName.includes('CHANNEL_SJB')
    || pageName.includes('ZHUANTI_COMPUTER')
    || pageName.includes('ZHUANTI_EARPHONE')
    || pageName.includes('CHANNEL_SMB')
    || pageName.includes('PRODUCT_LIST')
    || url === '/product/categorylist'
    || (title.includes('数码') && Boolean(url || pageName));
}

function findSelectedHomeTab(value: unknown, visited = new Set<object>()): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const selected = findSelectedHomeTab(item, visited);
      if (selected) return selected;
    }
    return '';
  }
  if (!value || typeof value !== 'object' || visited.has(value)) return '';
  visited.add(value);
  const record = asRecord(value);
  const selected = firstText(record.selectedHomeTab, record.selected_home_tab, record.selectedTab, record.selected_tab, record.selectedPage, record.selected_page, record.selectedPageName, record.selected_page_name, record.currentPage, record.current_page);
  if (selected) return selected;
  for (const key of ['data', 'config', 'navigation', 'navigationServerData', 'navigation_server_data', 'navigationData', 'navigation_data', 'mainInit', 'main_init', 'extraData', 'extra_data']) {
    const rawNestedValue = record[key];
    const nestedValue = key === 'extraData' || key === 'extra_data' ? (rawNestedValue === undefined ? undefined : parseRecord(rawNestedValue)) : rawNestedValue;
    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue) && Object.keys(nestedValue).length === 0) continue;
    const nested = findSelectedHomeTab(nestedValue, visited);
    if (nested) return nested;
  }
  return '';
}

function getRawEntities(entity: DiscoveryEntity, extra: Record<string, unknown>): DiscoveryEntity[] {
  const raw = entity.rawEntities ?? entity.raw_entities ?? entity.entities ?? entity.children ?? extra.rawEntities ?? extra.raw_entities ?? extra.entities ?? extra.children;
  const parsed = Array.isArray(raw) ? raw : typeof raw === 'string' ? (() => { try { const value = JSON.parse(raw); return Array.isArray(value) ? value : []; } catch { return []; } })() : [];
  return parsed.filter((item): item is DiscoveryEntity => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
}

export function parseDigitalConfig(response: unknown): DigitalConfig {
  const entities = walkEntities(response);
  const seen = new Set<string>();
  const tabs = entities.map((entity, index) => {
    const pageName = text(entity.pageName ?? entity.page_name);
    const extra = parseRecord(entity.extraData ?? entity.extra_data);
    const rawUrl = firstText(entity.url, extra.url, pageName);
    const webUrl = firstText(entity.webUrl, entity.web_url, extra.webUrl, extra.web_url, isWebUrl(rawUrl) ? rawUrl : '');
    const url = isWebUrl(rawUrl) ? pageName : rawUrl || pageName || webUrl;
    const rawEntities = getRawEntities(entity, extra);
    const key = pageName || url || webUrl || text(entity.id ?? entity.entityId) || `digital-${index}`;
    const uniqueKey = seen.has(key) ? `${key}-${index}` : key;
    seen.add(uniqueKey);
    const normalizedUrl = url.toLowerCase();
    const pageVisibility = entity.page_visibility ?? entity.pageVisibility ?? entity.visibility ?? entity.visible ?? entity.isVisible ?? extra.page_visibility ?? extra.pageVisibility ?? extra.visibility ?? extra.visible ?? extra.isVisible;
    const status = entity.status ?? extra.status;
    const visible = visibleValue(pageVisibility) && visibleValue(status);
    return {
      key: uniqueKey,
      title: firstText(entity.title, extra.title) || '数码',
      url,
      webUrl: webUrl || undefined,
      pageName,
      subTitle: firstText(entity.subTitle, entity.sub_title, extra.subTitle, extra.sub_title),
      logo: firstText(entity.logo, entity.icon, entity.pic, extra.logo, extra.icon),
      order: Number(entity.order ?? entity.page_order ?? extra.order ?? index),
      category: entity.category === true || entity.category === 1 || entity.category === '1' || normalizedUrl.includes('/product/categorylist') || pageName.toUpperCase().includes('PRODUCT_LIST'),
      visible,
      fixed: visibleValue(entity.page_fixed ?? entity.pageFixed ?? entity.fixed ?? entity.isFixed ?? extra.page_fixed ?? extra.pageFixed ?? extra.fixed ?? extra.isFixed) && (entity.page_fixed === 1 || entity.page_fixed === '1' || entity.pageFixed === 1 || entity.pageFixed === '1' || entity.fixed === 1 || entity.fixed === '1' || entity.isFixed === 1 || entity.isFixed === '1' || extra.page_fixed === 1 || extra.page_fixed === '1' || extra.pageFixed === 1 || extra.pageFixed === '1' || extra.fixed === 1 || extra.fixed === '1' || extra.isFixed === 1 || extra.isFixed === '1'),
      rawEntities,
      raw: entity,
    };
  }).filter((tab) => tab.visible && Boolean(tab.url || tab.webUrl)).sort((a, b) => a.order - b.order);
  const selectedValue = findSelectedHomeTab(response);
  const selectedKey = tabs.find((tab) => tab.key === selectedValue || tab.pageName === selectedValue || tab.url === selectedValue || tab.webUrl === selectedValue)?.key || tabs[0]?.key || '';
  return { tabs, selectedKey };
}

export function parseDigitalTabs(response: unknown): DigitalTab[] {
  return parseDigitalConfig(response).tabs;
}

export function removeRedundantFirstDigitalTab(tabs: DigitalTab[]): { tabs: DigitalTab[]; removedKey: string } {
  const digitalIndexes = tabs.map((tab, index) => tab.title.trim() === '数码' ? index : -1).filter((index) => index >= 0);
  if (digitalIndexes.length < 2) return { tabs, removedKey: '' };
  const removedIndex = digitalIndexes[0];
  return { tabs: tabs.filter((_tab, index) => index !== removedIndex), removedKey: tabs[removedIndex]?.key || '' };
}

export function resolveDefaultDigitalTabKey(tabs: DigitalTab[], selectedKey: string, removedKey = ''): string {
  const normalizedSelectedKey = selectedKey === removedKey ? tabs.find((tab) => tab.title.trim() === '数码')?.key || '' : selectedKey;
  return tabs.find((tab) => tab.key === normalizedSelectedKey)?.key || tabs.find((tab) => tab.title.trim() === '数码')?.key || tabs[0]?.key || '';
}

export function getFallbackDigitalTabs(): DigitalTab[] {
  const raw: DiscoveryEntity = { pageName: 'V10_DIGITAL_HOME', title: '数码', url: 'V10_DIGITAL_HOME', entityType: 'ConfigPage' };
  return [{ key: 'V10_DIGITAL_HOME', title: '数码', url: 'V10_DIGITAL_HOME', pageName: 'V10_DIGITAL_HOME', order: 0, category: false, visible: true, fixed: true, rawEntities: [], raw }];
}
