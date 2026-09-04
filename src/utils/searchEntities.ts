import type { Router } from 'vue-router';
import type { SearchEntity, SearchTabDefinition } from '../types/search';
import { DEFAULT_SEARCH_TABS } from '../types/search';

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
}

function firstTextValue(...values: unknown[]): string {
  for (const value of values) {
    const text = textValue(value);
    if (text) return text;
  }
  return '';
}

export function getSearchEntityType(entity: SearchEntity): string {
  return firstTextValue(entity.entityType, entity.entity_type, entity.type).toLowerCase();
}

export function getSearchEntityTemplate(entity: SearchEntity): string {
  return firstTextValue(entity.entityTemplate, entity.entity_template, entity.template).toLowerCase();
}

export function getSearchEntityId(entity: SearchEntity): string {
  if (isAnswerSearchEntity(entity)) {
    return firstTextValue(entity.id, entity.entityId, entity.entity_id, entity.answerId, entity.answer_id, entity.feedId, entity.feed_id);
  }
  return firstTextValue(entity.questionId, entity.question_id, entity.id, entity.entityId, entity.entity_id, entity.feedId, entity.feed_id);
}

export function getSearchEntityTitle(entity: SearchEntity): string {
  return firstTextValue(entity.title, entity.message_title, entity.messageTitle, entity.questionTitle, entity.shorttitle, entity.name, entity.username, entity.entityTitle, entity.label, entity.searchValue);
}

export function getSearchEntitySubtitle(entity: SearchEntity): string {
  return textValue(entity.subTitle ?? entity.subtitle ?? entity.description ?? entity.message ?? entity.summary ?? entity.bio ?? entity.sign);
}

export function getSearchEntityImage(entity: SearchEntity): string {
  return textValue(entity.apkRomIcon ?? entity.logo ?? entity.icon ?? entity.pic ?? entity.userAvatar ?? entity.cover ?? entity.image ?? entity.avatar);
}

export function getSearchEntityUid(entity: SearchEntity): string {
  return textValue(entity.uid ?? entity.userId ?? entity.user_id);
}

export function getSearchEntityPackageName(entity: SearchEntity): string {
  return textValue(entity.packageName ?? entity.package_name ?? entity.pkg ?? entity.apkname ?? entity.apkName);
}

export function getSearchEntityTag(entity: SearchEntity): string {
  return textValue(entity.tag ?? entity.topicTag ?? entity.topic_tag ?? entity.topicName);
}

function normalizeTopicTag(value: unknown): string {
  return textValue(value).replace(/^#+/, '').trim();
}

function getTopicTagFromUrl(rawUrl: unknown): string {
  const raw = textValue(rawUrl);
  if (!raw) return '';
  const candidates = [raw];
  const hashIndex = raw.indexOf('#');
  if (hashIndex >= 0) candidates.push(raw.slice(hashIndex + 1));
  for (const candidate of candidates) {
    const withoutOrigin = candidate.replace(/^https?:\/\/[^/]+/i, '');
    const [path, query = ''] = withoutOrigin.split('?', 2);
    const pathMatch = path.match(/\/(?:topic|t)\/([^/?#]+)/i);
    if (pathMatch?.[1]) {
      try {
        return normalizeTopicTag(decodeURIComponent(pathMatch[1]));
      } catch {
        return normalizeTopicTag(pathMatch[1]);
      }
    }
    if (/\/(?:topic|t)\/?$/i.test(path) && query) {
      const params = new URLSearchParams(query);
      const value = params.get('tag') || params.get('topic') || params.get('topicName') || params.get('title');
      if (value) return normalizeTopicTag(value);
    }
  }
  return '';
}

function getSearchEntityTopicTag(entity: SearchEntity): string {
  return normalizeTopicTag(getSearchEntityTag(entity)) || getTopicTagFromUrl(getSearchEntityUrl(entity)) || normalizeTopicTag(getSearchEntityTitle(entity));
}

export function getSearchEntityUrl(entity: SearchEntity): string {
  return textValue(entity.url ?? entity.actionUrl ?? entity.action_url ?? entity.link);
}

export interface SearchEntitySearchTarget {
  keyword: string;
  searchType: string;
}

/** 解析 APK 联想词的 searchTab://<searchType>?keyword=<keyword> 动作。 */
export function getSearchEntitySearchTarget(entity: SearchEntity): SearchEntitySearchTarget | null {
  const rawUrl = getSearchEntityUrl(entity);
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol.toLowerCase() !== 'searchtab:') return null;
    const keyword = textValue(url.searchParams.get('keyword'));
    const searchType = textValue(url.hostname || url.host).toLowerCase();
    return keyword && searchType ? { keyword, searchType } : null;
  } catch {
    return null;
  }
}

export function isSponsorSearchEntity(entity: SearchEntity): boolean {
  const type = getSearchEntityType(entity);
  const template = getSearchEntityTemplate(entity);
  const sponsorType = entity.sponsorType ?? entity.sponsor_type;
  const hasSponsorType = typeof sponsorType === 'boolean' ? sponsorType : typeof sponsorType === 'number' ? sponsorType !== 0 : textValue(sponsorType) !== '';
  return type.startsWith('sponsor') || template.startsWith('sponsor') || hasSponsorType;
}

function sanitizeSearchValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeSearchValue).filter((item) => item !== null);
  }
  if (!value || typeof value !== 'object') return value;
  const entity = value as SearchEntity;
  if (isSponsorSearchEntity(entity)) return null;
  const result: SearchEntity = {};
  for (const [key, child] of Object.entries(entity)) {
    const sanitized = sanitizeSearchValue(child);
    if (sanitized !== null) result[key] = sanitized;
  }
  return result;
}

function collectSearchRows(value: unknown, rows: SearchEntity[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchRows(item, rows));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const entity = value as SearchEntity;
  const template = getSearchEntityTemplate(entity);
  const type = getSearchEntityType(entity);
  const isHotContainer = template.includes('searchhot') || type.includes('searchhot');
  const isEntityContainer = template.includes('card') || type.includes('card');
  if (Array.isArray(entity.entities) && !isHotContainer && (!template && !type || isEntityContainer)) {
    collectSearchRows(entity.entities, rows);
    return;
  }
  const sanitized = sanitizeSearchValue(entity);
  if (sanitized && typeof sanitized === 'object') rows.push(sanitized as SearchEntity);
}

export function extractSearchEntities(response: unknown): SearchEntity[] {
  const root = response as SearchEntity | undefined;
  const data = root && typeof root === 'object' && 'data' in root ? root.data : root;
  const rows: SearchEntity[] = [];
  collectSearchRows(data, rows);
  return rows;
}

export function extractHotSearchKeywords(response: unknown): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  const addValue = (value: unknown) => {
    const text = textValue(value);
    if (text && !seen.has(text)) {
      seen.add(text);
      values.push(text);
    }
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      addValue(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const entity = value as SearchEntity;
    if (isSponsorSearchEntity(entity)) return;
    const children = ['entities', 'entityList', 'data', 'list', 'items', 'children']
      .flatMap((key) => Array.isArray(entity[key]) ? entity[key] : []);
    if (children.length) {
      children.forEach(visit);
      return;
    }
    addValue(entity.title ?? entity.searchValue ?? entity.keyword ?? entity.word ?? entity.name);
  };
  const root = response as SearchEntity | undefined;
  visit(root && typeof root === 'object' && 'data' in root ? root.data : root);
  return values;
}

export function isQuestionSearchEntity(entity: SearchEntity): boolean {
  const type = getSearchEntityType(entity);
  const template = getSearchEntityTemplate(entity);
  if (isAnswerSearchEntity(entity)) return false;
  const markers = [
    type,
    template,
    entity.feedType,
    entity.feed_type,
    entity.feedTypeName,
    entity.feed_type_name,
    entity.searchType,
    entity.search_type,
    entity.questionType,
    entity.question_type,
  ].map((value) => textValue(value).toLowerCase());
  return markers.some((value) => value.includes('question') || value.includes('提问') || value.includes('问答') || value === 'qa' || value === 'ask')
    || Boolean(firstTextValue(entity.questionId, entity.question_id));
}

/** APK 将回答作为 feedType=answer 的 Feed，不能和 feedQuestion 问题实体混用。 */
export function isAnswerSearchEntity(entity: SearchEntity): boolean {
  const markers = [
    getSearchEntityType(entity),
    getSearchEntityTemplate(entity),
    entity.feedType,
    entity.feed_type,
    entity.feedTypeName,
    entity.feed_type_name,
    entity.answerType,
    entity.answer_type,
  ].map((value) => textValue(value).toLowerCase());
  return markers.some((value) => value === 'answer' || value.includes('answer') || value.includes('回答'))
    || Boolean(firstTextValue(entity.answerId, entity.answer_id));
}

/** APK 的 feedQuestion 使用 item_question_title_view，只显示问题标题和统计数。 */
export function isQuestionTitleSearchEntity(entity: SearchEntity): boolean {
  if (!isQuestionSearchEntity(entity)) return false;
  const type = getSearchEntityType(entity);
  const template = getSearchEntityTemplate(entity);
  if ([type, template].some((value) => value === 'feedquestion' || value.includes('questiontitle'))) return true;
  const hasBody = Boolean(textValue(entity.message ?? entity.message_raw_output ?? entity.content ?? entity.text));
  const hasQuestionCount = ['question_answer_num', 'questionAnswerNum', 'question_follow_num', 'questionFollowNum']
    .some((key) => entity[key] !== undefined);
  return !hasBody && hasQuestionCount;
}

/** 搜索接口的 ask 页签有时返回普通 feed 实体，保留页签语义供后续路由和渲染使用。 */
export function normalizeSearchEntityForTab(entity: SearchEntity, searchType: string): SearchEntity {
  const normalizedType = textValue(searchType).toLowerCase();
  if (!['ask', 'question', 'qa'].includes(normalizedType)) return entity;
  return { ...entity, searchType: 'ask' };
}

export function getSearchEntityKind(entity: SearchEntity): 'hot' | 'user' | 'topic' | 'app' | 'feed' | 'question' | 'answer' | 'product' | 'generic' {
  const type = getSearchEntityType(entity);
  const template = getSearchEntityTemplate(entity);
  if (template.includes('searchhot') || type.includes('searchhot')) return 'hot';
  if (type.includes('user') || template.includes('user')) return 'user';
  if (type.includes('topic') || template.includes('topic')) return 'topic';
  if (type.includes('apk') || type.includes('app') || type.includes('game') || getSearchEntityPackageName(entity)) return 'app';
  if (type.includes('product') || template.includes('product')) return 'product';
  if (isAnswerSearchEntity(entity)) return 'answer';
  if (isQuestionSearchEntity(entity)) return 'question';
  if (type.includes('feed') || type.includes('reply') || type.includes('article') || type.includes('dyh') || type.includes('ershou') || entity.message || entity.feed_id || entity.feedId) return 'feed';
  return 'generic';
}

export function isNavigableSearchEntity(entity: SearchEntity): boolean {
  if (isSponsorSearchEntity(entity)) return false;
  const kind = getSearchEntityKind(entity);
  if (kind === 'hot') return false;
  const template = getSearchEntityTemplate(entity);
  if (template.includes('card') || template.includes('header') || template.includes('placeholder')) return false;
  if (kind === 'user') return Boolean(getSearchEntityUid(entity));
  if (kind === 'topic') return Boolean(getSearchEntityTopicTag(entity));
  if (kind === 'app') return Boolean(getSearchEntityPackageName(entity));
  if (kind === 'product' || typeIncludes(entity, 'dyh') || typeIncludes(entity, 'album') || typeIncludes(entity, 'goods')) return Boolean(getSearchEntityId(entity));
  return kind === 'feed' || kind === 'question' || kind === 'answer' ? Boolean(getSearchEntityId(entity)) : Boolean(getSearchEntityUrl(entity));
}

export function getSearchEntityRoute(entity: SearchEntity): string | null {
  if (isSponsorSearchEntity(entity)) return null;
  const searchTarget = getSearchEntitySearchTarget(entity);
  if (searchTarget) {
    return `/search?q=${encodeURIComponent(searchTarget.keyword)}&tab=${encodeURIComponent(searchTarget.searchType)}`;
  }
  const kind = getSearchEntityKind(entity);
  const id = getSearchEntityId(entity);
  if (kind === 'user' && getSearchEntityUid(entity)) return `/user/${encodeURIComponent(getSearchEntityUid(entity))}`;
  if (kind === 'topic') {
    const topicTag = getSearchEntityTopicTag(entity);
    if (topicTag) return `/topic/${encodeURIComponent(topicTag)}`;
  }
  if (kind === 'app' && getSearchEntityPackageName(entity)) return `/app/${encodeURIComponent(getSearchEntityPackageName(entity))}`;
  if (kind === 'product' && id) return `/product/${encodeURIComponent(id)}`;
  if (kind === 'question' && id) return `/question/${encodeURIComponent(id)}`;
  if (kind === 'answer' && id) return `/feed/${encodeURIComponent(id)}`;
  if (typeIncludes(entity, 'dyh') && id) return `/dyh/${encodeURIComponent(id)}`;
  if (typeIncludes(entity, 'album') && id) return `/album/${encodeURIComponent(id)}`;
  if (typeIncludes(entity, 'goods') && id) return `/goods?tab=detail&id=${encodeURIComponent(id)}`;
  if (kind === 'feed' && id) return `/feed/${encodeURIComponent(id)}`;
  const url = getSearchEntityUrl(entity);
  if (url.startsWith('#/')) return url.slice(1);
  if (url.startsWith('/')) return url;
  return null;
}

function typeIncludes(entity: SearchEntity, value: string): boolean {
  return `${getSearchEntityType(entity)} ${getSearchEntityTemplate(entity)}`.includes(value);
}

export function navigateSearchEntity(router: Router, entity: SearchEntity): boolean {
  const route = getSearchEntityRoute(entity);
  if (!route) return false;
  void router.push(route);
  return true;
}

function parseConfiguredTabs(value: unknown, rows: SearchTabDefinition[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => parseConfiguredTabs(item, rows));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const obj = value as SearchEntity;
  for (const [key, child] of Object.entries(obj)) {
    if (key.toLowerCase().replace(/[_-]/g, '.') === 'search.tab' && typeof child === 'string') {
      child.split(',').map((item) => item.trim()).filter(Boolean).forEach((searchType) => {
        const fallback = DEFAULT_SEARCH_TABS.find((tab) => tab.searchType === searchType);
        if (fallback) rows.push(fallback);
      });
    }
    if (['searchTabs', 'search_tabs', 'searchTabData', 'search_tab_data', 'searchTabDataList'].includes(key) && Array.isArray(child)) {
      child.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const tab = item as SearchEntity;
        const searchType = textValue(tab.searchType ?? tab.search_type ?? tab.key ?? tab.type);
        const label = textValue(tab.title ?? tab.label ?? tab.name);
        if (searchType && label) rows.push({ key: searchType, searchType, label, icon: textValue(tab.icon) || undefined });
      });
    }
    parseConfiguredTabs(child, rows);
  }
}

export function extractSearchTabs(response: unknown): SearchTabDefinition[] {
  const rows: SearchTabDefinition[] = [];
  parseConfiguredTabs(response, rows);
  const unique = new Map<string, SearchTabDefinition>();
  rows.forEach((tab) => unique.set(tab.searchType, tab));
  return unique.size ? [...unique.values()] : DEFAULT_SEARCH_TABS;
}
