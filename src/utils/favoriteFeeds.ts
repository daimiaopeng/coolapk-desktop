import { CoolapkTauriAPI } from '../api/coolapk';


export type FavoriteFeedListResult = {
  feeds: any[];
  complete: boolean;
};

export type FavoriteCollectionListResult = {
  collections: any[];
  complete: boolean;
};

export function favoriteFeedId(feed: any): string {
  for (const key of ['id', 'feedId', 'feed_id', 'entityId', 'entity_id']) {
    const value = feed?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

export function favoriteFeedCursorId(feed: any): string {
  for (const key of ['entityId', 'entity_id', 'id', 'feedId', 'feed_id']) {
    const value = feed?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function favoriteCollectionId(collection: any): string {
  const value = collection?.id ?? collection?.collectionId ?? collection?.collection_id;
  return value === undefined || value === null ? '' : String(value).trim();
}

// 按 APK 的 entityId 首尾游标分页，收集当前账号的默认收藏单和用户创建的收藏单。
export async function loadAllFavoriteCollections(signal?: AbortSignal): Promise<FavoriteCollectionListResult> {
  const collections: any[] = [];
  const seenIds = new Set<string>();
  let firstItem = '';
  let lastItem = '';

  for (let page = 1; ; page += 1) {
    signal?.throwIfAborted();
    const response: any = await CoolapkTauriAPI.getCollectionList('', page, firstItem, lastItem);
    signal?.throwIfAborted();
    const pageCollections = Array.isArray(response?.data) ? response.data : [];
    if (pageCollections.length === 0) return { collections, complete: true };

    for (const collection of pageCollections) {
      const id = favoriteCollectionId(collection);
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      collections.push(collection);
    }

    const pageIds = pageCollections.map(favoriteFeedCursorId).filter(Boolean);
    if (!firstItem) firstItem = pageIds[0] || '';
    const nextLastItem = pageIds[pageIds.length - 1] || '';
    if (!firstItem || !nextLastItem || nextLastItem === lastItem) return { collections, complete: false };
    lastItem = nextLastItem;
  }
}

// 汇总每个收藏单的动态，跨单去重后按动态发布时间倒序供显示和导出共用。
export async function loadAllFavoriteFeeds(signal?: AbortSignal): Promise<FavoriteFeedListResult> {
  const feeds: any[] = [];
  const seenIds = new Set<string>();
  signal?.throwIfAborted();
  const collectionResult = await loadAllFavoriteCollections(signal);
  let complete = collectionResult.complete;

  for (const collection of collectionResult.collections) {
    signal?.throwIfAborted();
    const collectionId = favoriteCollectionId(collection);
    if (!collectionId) {
      complete = false;
      continue;
    }
    const seenCollectionCursors = new Set<string>();
    let firstItem = '';
    let lastItem = '';

    for (let page = 1; ; page += 1) {
      signal?.throwIfAborted();
      const response: any = await CoolapkTauriAPI.getCollectionItemList(collectionId, page, firstItem, lastItem);
      signal?.throwIfAborted();
      const pageFeeds = Array.isArray(response?.data) ? response.data : [];
      if (pageFeeds.length === 0) break;

      for (const feed of pageFeeds) {
        const feedId = favoriteFeedId(feed);
        if (!feedId || seenIds.has(feedId)) continue;
        seenIds.add(feedId);
        feeds.push(feed);
      }

      const pageIds = pageFeeds.map(favoriteFeedCursorId).filter(Boolean);
      if (!firstItem) firstItem = pageIds[0] || '';
      const nextLastItem = pageIds[pageIds.length - 1] || '';
      if (!firstItem || !nextLastItem || nextLastItem === lastItem || seenCollectionCursors.has(nextLastItem)) {
        complete = false;
        break;
      }
      seenCollectionCursors.add(nextLastItem);
      lastItem = nextLastItem;
    }
  }

  const sortedFeeds = feeds
    .map((feed, index) => ({ feed, index, timestamp: Number(feed?.dateline ?? feed?.createTime ?? feed?.create_time ?? 0) || 0 }))
    .sort((a, b) => b.timestamp - a.timestamp || a.index - b.index)
    .map(({ feed }) => feed);
  return { feeds: sortedFeeds, complete };
}
