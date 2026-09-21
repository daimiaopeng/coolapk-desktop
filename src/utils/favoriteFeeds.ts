import { CoolapkTauriAPI } from '../api/coolapk';


export type FavoriteFeedListResult = {
  feeds: any[];
  complete: boolean;
};

export function favoriteFeedId(feed: any): string {
  for (const key of ['id', 'feedId', 'feed_id', 'entityId', 'entity_id']) {
    const value = feed?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

/**
 * 遍历全部云端动态收藏。酷安的游标分页要求 firstItem 始终保持为
 * 第一页首项，只在后续请求中更新 lastItem。
 */
export async function loadAllFavoriteFeeds(signal?: AbortSignal): Promise<FavoriteFeedListResult> {
  const feeds: any[] = [];
  const seenIds = new Set<string>();
  let firstItem = '';
  let lastItem = '';

  for (let page = 1; ; page += 1) {
    signal?.throwIfAborted();
    const response: any = await CoolapkTauriAPI.getFavoriteList('feed', page, firstItem, lastItem);
    signal?.throwIfAborted();
    const pageFeeds = Array.isArray(response?.data) ? response.data : [];
    if (pageFeeds.length === 0) return { feeds, complete: true };

    let pageHasNew = false;
    for (const feed of pageFeeds) {
      const feedId = favoriteFeedId(feed);
      if (!feedId || seenIds.has(feedId)) continue;
      seenIds.add(feedId);
      feeds.push(feed);
      pageHasNew = true;
    }

    const pageIds = pageFeeds.map(favoriteFeedId).filter(Boolean);
    if (!firstItem) firstItem = pageIds[0] || '';
    const nextLastItem = pageIds[pageIds.length - 1] || '';
    if (!pageHasNew || !firstItem || !nextLastItem || nextLastItem === lastItem) {
      return { feeds, complete: false };
    }
    lastItem = nextLastItem;
  }

}
