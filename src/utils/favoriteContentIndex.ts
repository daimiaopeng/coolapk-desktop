import { CoolapkTauriAPI } from '../api/coolapk';
import { getFeedDetailMessage, stripFeedMoreSuffix } from './feedContent';
import { favoriteFeedId, loadAllFavoriteFeeds } from './favoriteFeeds';
import { readTauriStoreValue, writeTauriStoreValue } from './tauriStore';

const STORE_FILE = 'favorite_content_index.json';
const STORE_KEY_PREFIX = 'account:';
const INDEX_VERSION = 1;
const MAX_REVALIDATE_PER_SYNC = 16;
const REVALIDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const DETAIL_CONCURRENCY = 3;

export type FavoriteContentIndexEntry = {
  feedId: string;
  title: string;
  message: string;
  author: string;
  searchText: string;
  contentHash: string;
  updatedMarker: string;
  indexedAt: number;
  checkedAt: number;
  contentComplete: boolean;
  feed: any;
};

type FavoriteContentIndexData = {
  version: number;
  lastSyncAt: number;
  entries: Record<string, FavoriteContentIndexEntry>;
};

export type FavoriteContentIndexSyncResult = {
  total: number;
  indexed: number;
  updated: number;
  revalidated: number;
  removed: number;
  complete: boolean;
};

const loadedIndexes = new Map<string, Promise<FavoriteContentIndexData>>();
const accountQueues = new Map<string, Promise<unknown>>();
const activeSyncs = new Map<string, Promise<FavoriteContentIndexSyncResult>>();

function accountKey(accountId: string | number): string {
  return String(accountId || '').trim();
}

function emptyIndex(): FavoriteContentIndexData {
  return { version: INDEX_VERSION, lastSyncAt: 0, entries: {} };
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value).trim();
}

function firstText(source: any, keys: string[]): string {
  for (const key of keys) {
    const value = textValue(source?.[key]);
    if (value) return value;
  }
  return '';
}

function feedIdOf(feed: any): string {
  return favoriteFeedId(feed);
}

function updateMarkerOf(feed: any): string {
  return firstText(feed, ['lastupdate', 'lastUpdate', 'last_change_time', 'lastChangeTime', 'updateTime', 'update_time', 'editTime', 'edit_time']);
}

function decodeHtml(value: string): string {
  if (typeof document !== 'undefined') {
    const element = document.createElement('textarea');
    element.innerHTML = value;
    return element.value;
  }
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');
}

export function normalizeFavoriteSearchText(value: string): string {
  return decodeHtml(String(value || '')
    .replace(/<\/(?:p|div|br|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' '))
    .trim()
    .toLocaleLowerCase('zh-CN');
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function normalizeEntry(value: unknown): FavoriteContentIndexEntry | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const feedId = textValue(source.feedId);
  const message = textValue(source.message);
  if (!feedId || !message) return null;
  const title = textValue(source.title);
  const author = textValue(source.author);
  return {
    feedId,
    title,
    message,
    author,
    searchText: textValue(source.searchText) || normalizeFavoriteSearchText(`${title}\n${author}\n${message}`),
    contentHash: textValue(source.contentHash) || hashText(message),
    updatedMarker: textValue(source.updatedMarker),
    indexedAt: Number(source.indexedAt) || 0,
    checkedAt: Number(source.checkedAt) || 0,
    contentComplete: source.contentComplete !== false,
    feed: source.feed && typeof source.feed === 'object' ? source.feed : { id: feedId, title, message },
  };
}

function normalizeIndex(value: unknown): FavoriteContentIndexData {
  if (!value || typeof value !== 'object') return emptyIndex();
  const source = value as Record<string, unknown>;
  const rawEntries = source.entries && typeof source.entries === 'object' ? source.entries as Record<string, unknown> : {};
  const entries: Record<string, FavoriteContentIndexEntry> = {};
  for (const [key, rawEntry] of Object.entries(rawEntries)) {
    const entry = normalizeEntry(rawEntry);
    if (entry) entries[key] = entry;
  }
  return { version: INDEX_VERSION, lastSyncAt: Number(source.lastSyncAt) || 0, entries };
}

async function loadIndex(accountId: string): Promise<FavoriteContentIndexData> {
  const existing = loadedIndexes.get(accountId);
  if (existing) return existing;
  const pending = readTauriStoreValue<unknown>(STORE_FILE, `${STORE_KEY_PREFIX}${accountId}`)
    .then(normalizeIndex)
    .catch((error) => {
      console.warn('读取收藏正文索引失败，将使用空索引:', error);
      return emptyIndex();
    });
  loadedIndexes.set(accountId, pending);
  return pending;
}

async function saveIndex(accountId: string, index: FavoriteContentIndexData): Promise<void> {
  const snapshot = normalizeIndex(index);
  loadedIndexes.set(accountId, Promise.resolve(snapshot));
  await writeTauriStoreValue(STORE_FILE, `${STORE_KEY_PREFIX}${accountId}`, snapshot);
}

function enqueueAccountTask<T>(accountId: string, task: () => Promise<T>): Promise<T> {
  const previous = accountQueues.get(accountId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  accountQueues.set(accountId, next.catch(() => undefined));
  return next;
}

async function mapWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  }));
}

function entryFromFeed(feed: any, detail: any, checkedAt: number, contentComplete: boolean): FavoriteContentIndexEntry | null {
  const merged = detail && typeof detail === 'object' ? { ...feed, ...detail } : feed;
  const feedId = feedIdOf(merged) || feedIdOf(feed);
  const message = stripFeedMoreSuffix(getFeedDetailMessage(merged) || getFeedDetailMessage(feed));
  if (!feedId || !message) return null;
  const title = firstText(merged, ['title', 'message_title', 'messageTitle']);
  const author = firstText(merged, ['username', 'userName']) || firstText(merged?.userInfo, ['username', 'user_name']);
  const updatedMarker = updateMarkerOf(merged) || updateMarkerOf(feed);
  return {
    feedId,
    title,
    message,
    author,
    searchText: normalizeFavoriteSearchText(`${title}\n${author}\n${message}`),
    contentHash: hashText(message),
    updatedMarker,
    indexedAt: checkedAt,
    checkedAt,
    contentComplete,
    feed: { ...merged, id: feedId, message },
  };
}

async function fetchDetailEntry(feed: any, now: number): Promise<FavoriteContentIndexEntry | null> {
  const feedId = feedIdOf(feed);
  if (!feedId) return null;
  try {
    const response: any = await CoolapkTauriAPI.getPublicFeedDetail(feedId);
    return entryFromFeed(feed, response?.data, now, true);
  } catch (error) {
    console.warn(`获取收藏动态 ${feedId} 的完整正文失败:`, error);
    return entryFromFeed(feed, null, now, false);
  }
}

function shouldRefreshEntry(entry: FavoriteContentIndexEntry | undefined, feed: any): boolean {
  if (!entry || !entry.contentComplete) return true;
  const marker = updateMarkerOf(feed);
  return Boolean(marker && marker !== entry.updatedMarker);
}

export async function syncFavoriteContentIndex(accountIdValue: string | number): Promise<FavoriteContentIndexSyncResult> {
  const accountId = accountKey(accountIdValue);
  if (!accountId) return { total: 0, indexed: 0, updated: 0, revalidated: 0, removed: 0, complete: false };
  const running = activeSyncs.get(accountId);
  if (running) return running;
  const sync = enqueueAccountTask(accountId, async () => {
    const index = await loadIndex(accountId);
    const now = Date.now();
    const { feeds, complete } = await loadAllFavoriteFeeds();
    const seenIds = new Set(feeds.map(feedIdOf).filter(Boolean));
    const required = feeds.filter((feed) => shouldRefreshEntry(index.entries[feedIdOf(feed)], feed));
    const revalidationCandidates = feeds
      .filter((feed) => {
        const entry = index.entries[feedIdOf(feed)];
        return entry && !shouldRefreshEntry(entry, feed) && now - entry.checkedAt >= REVALIDATE_INTERVAL_MS;
      })
      .sort((left, right) => (index.entries[feedIdOf(left)]?.checkedAt || 0) - (index.entries[feedIdOf(right)]?.checkedAt || 0))
      .slice(0, MAX_REVALIDATE_PER_SYNC);
    const refreshFeeds = [...required, ...revalidationCandidates.filter(feed => !required.some(requiredFeed => feedIdOf(requiredFeed) === feedIdOf(feed)))];
    let indexed = 0;
    let updated = 0;
    await mapWithConcurrency(refreshFeeds, async (feed) => {
      const feedId = feedIdOf(feed);
      const previous = index.entries[feedId];
      const entry = await fetchDetailEntry(feed, now);
      if (!entry) return;
      index.entries[feedId] = entry;
      if (!previous) indexed += 1;
      else if (previous.contentHash !== entry.contentHash || previous.updatedMarker !== entry.updatedMarker) updated += 1;
    });
    let removed = 0;
    if (complete) {
      for (const feedId of Object.keys(index.entries)) {
        if (!seenIds.has(feedId)) {
          delete index.entries[feedId];
          removed += 1;
        }
      }
    }
    index.lastSyncAt = now;
    await saveIndex(accountId, index);
    return { total: Object.keys(index.entries).length, indexed, updated, revalidated: revalidationCandidates.length, removed, complete };
  });
  activeSyncs.set(accountId, sync);
  void sync.then(
    () => activeSyncs.delete(accountId),
    () => activeSyncs.delete(accountId),
  );
  return sync;
}

export async function queueFavoriteContentIndexEntry(accountIdValue: string | number, feed: any): Promise<void> {
  const accountId = accountKey(accountIdValue);
  const feedId = feedIdOf(feed);
  if (!accountId || !feedId) return;
  await enqueueAccountTask(accountId, async () => {
    const index = await loadIndex(accountId);
    const entry = await fetchDetailEntry(feed, Date.now());
    if (!entry) return;
    index.entries[feedId] = entry;
    await saveIndex(accountId, index);
  });
}

export async function removeFavoriteContentIndexEntry(accountIdValue: string | number, feedIdValue: string | number): Promise<void> {
  const accountId = accountKey(accountIdValue);
  const feedId = String(feedIdValue || '').trim();
  if (!accountId || !feedId) return;
  await enqueueAccountTask(accountId, async () => {
    const index = await loadIndex(accountId);
    if (!(feedId in index.entries)) return;
    delete index.entries[feedId];
    await saveIndex(accountId, index);
  });
}

export async function searchFavoriteContentIndex(accountIdValue: string | number, queryValue: string, limit = 100): Promise<FavoriteContentIndexEntry[]> {
  const accountId = accountKey(accountIdValue);
  const query = normalizeFavoriteSearchText(queryValue);
  if (!accountId || !query) return [];
  const keywords = query.split(' ').filter(Boolean);
  const index = await loadIndex(accountId);
  return Object.values(index.entries)
    .filter((entry) => keywords.every(keyword => entry.searchText.includes(keyword)))
    .sort((left, right) => right.indexedAt - left.indexedAt)
    .slice(0, Math.max(1, limit));
}

export async function getFavoriteContentIndexCount(accountIdValue: string | number): Promise<number> {
  const accountId = accountKey(accountIdValue);
  if (!accountId) return 0;
  return Object.keys((await loadIndex(accountId)).entries).length;
}

export function clearFavoriteContentIndexMemoryCache(): void {
  loadedIndexes.clear();
  accountQueues.clear();
  activeSyncs.clear();
}
