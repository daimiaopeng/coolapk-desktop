import { CoolapkTauriAPI } from '../api/coolapk';
import { getCommentImages, getReplyData, getReplyPageCursor } from './commentList';
import { getFeedDetailMessage, stripFeedMoreSuffix } from './feedContent';
import { favoriteFeedId, loadAllFavoriteFeeds } from './favoriteFeeds';
import { getImageUrlByQuality, type ImageQualityMode } from './image';
import { extractFeedImageInputs, normalizeFeedImageItems } from './livePhoto';
import { renderCoolapkRichText } from './richText';
import { readTauriStoreValue, writeTauriStoreValue } from './tauriStore';

const SNAPSHOT_FILE = 'favorite_export_snapshots.json';
const DETAIL_CONCURRENCY = 3;

export class FavoriteExportCancelledError extends Error {
  constructor() {
    super('导出已取消');
    this.name = 'FavoriteExportCancelledError';
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new FavoriteExportCancelledError();
}

export type FavoriteExportFormat = 'json' | 'txt' | 'html';
export type FavoriteExportSource =
  | { type: 'all'; id: 'all'; title: '全部收藏' }
  | { type: 'collection'; id: string; title: string };
export type FavoriteExportOptions = {
  includeAllComments: boolean;
  includeAuthorComments: boolean;
  includePinnedComments: boolean;
  includeAuthorReplies: boolean;
};

export type FavoriteExportProgress = {
  stage: 'list' | 'content' | 'comments' | 'compare' | 'render';
  current: number;
  total: number;
  message: string;
};

export type FavoriteExportEntry = {
  id: string;
  feed: any;
  contentComplete: boolean;
  contentError?: string;
  comments: any[];
  commentError?: string;
};

type FavoriteSnapshotEntry = {
  id: string;
  title: string;
  author: string;
  contentHash: string;
  lastSeenAt: string;
  feed: any;
};

type FavoriteSnapshot = {
  exportedAt: string;
  entries: Record<string, FavoriteSnapshotEntry>;
};

export type FavoriteExportDiff = {
  previousExportedAt: string;
  added: string[];
  changed: string[];
  removedFromFavorites: FavoriteSnapshotEntry[];
  unavailable: Array<FavoriteSnapshotEntry & { error: string }>;
};

export type FavoriteExportBundle = {
  exportedAt: string;
  accountId: string;
  source: FavoriteExportSource;
  complete: boolean;
  options: FavoriteExportOptions;
  summary: {
    total: number;
    contentComplete: number;
    contentFailed: number;
    commentFailed: number;
  };
  diff: FavoriteExportDiff;
  items: FavoriteExportEntry[];
};

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function feedTitle(feed: any): string {
  return text(feed?.title || feed?.message_title || feed?.messageTitle);
}

function feedAuthor(feed: any): string {
  return text(feed?.username || feed?.userName || feed?.userInfo?.username || feed?.userInfo?.user_name);
}

function feedAuthorUid(feed: any): string {
  return text(feed?.uid || feed?.userInfo?.uid || feed?.userInfo?.id);
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function mapConcurrent<T, R>(items: T[], worker: (item: T, index: number) => Promise<R>, signal?: AbortSignal): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      throwIfCancelled(signal);
      const index = cursor++;
      results[index] = await worker(items[index], index);
      throwIfCancelled(signal);
    }
  }));
  return results;
}

function replyId(reply: any): string {
  return text(reply?.id || reply?.entityId);
}

function isPinnedReply(reply: any): boolean {
  const value = reply?.isTop ?? reply?.is_top ?? reply?.top ?? reply?.isStick ?? reply?.is_stick;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function replyUid(reply: any): string {
  return text(reply?.uid || reply?.userInfo?.uid || reply?.userInfo?.id);
}

async function loadReplyPages(feedId: string, authorOnly: boolean, signal?: AbortSignal): Promise<any[]> {
  const replies: any[] = [];
  const seen = new Set<string>();
  let firstItem = '';
  let lastItem = '';
  for (let page = 1; ; page += 1) {
    throwIfCancelled(signal);
    const response = await CoolapkTauriAPI.getFeedReplies(feedId, page, {
      firstItem,
      lastItem,
      listType: authorOnly ? '' : 'lastupdate_desc',
      fromFeedAuthor: authorOnly ? 1 : 0,
    });
    const pageReplies = getReplyData(response);
    if (pageReplies.length === 0) break;
    let added = false;
    for (const reply of pageReplies) {
      const id = replyId(reply);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      replies.push(reply);
      added = true;
    }
    const pageCursor = getReplyPageCursor(pageReplies);
    if (!firstItem) firstItem = pageCursor.firstItem;
    if (!added || !pageCursor.lastItem || pageCursor.lastItem === lastItem) break;
    lastItem = pageCursor.lastItem;
  }
  return replies;
}

async function loadSubReplies(feedId: string, parentId: string, authorUid = '', signal?: AbortSignal): Promise<any[]> {
  if (!parentId) return [];
  const result: any[] = [];
  const seen = new Set<string>();
  let lastItem = '';
  for (let page = 1; ; page += 1) {
    throwIfCancelled(signal);
    const response = await CoolapkTauriAPI.getSubReplies(feedId, parentId, page, { lastItem });
    const pageReplies = getReplyData(response);
    if (pageReplies.length === 0) break;
    let added = false;
    for (const reply of pageReplies) {
      const id = replyId(reply);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (!authorUid || replyUid(reply) === authorUid) result.push(reply);
      added = true;
    }
    const nextLastItem = replyId(pageReplies[pageReplies.length - 1]);
    if (!added || !nextLastItem || nextLastItem === lastItem) break;
    lastItem = nextLastItem;
  }
  return result;
}

async function loadSelectedComments(feed: any, options: FavoriteExportOptions, signal?: AbortSignal): Promise<any[]> {
  if (!options.includeAllComments && !options.includeAuthorComments && !options.includePinnedComments) return [];
  const feedId = favoriteFeedId(feed);
  const selected = new Map<string, any>();
  if (options.includeAllComments) {
    for (const reply of await loadReplyPages(feedId, false, signal)) selected.set(replyId(reply), { ...reply, exportType: isPinnedReply(reply) ? 'pinned' : 'comment' });
  }
  if (options.includeAuthorComments) {
    for (const reply of await loadReplyPages(feedId, true, signal)) selected.set(replyId(reply), { ...reply, exportType: 'author' });
  }
  if (options.includePinnedComments) {
    const defaultReplies = await loadReplyPages(feedId, false, signal);
    for (const reply of defaultReplies.filter(isPinnedReply)) {
      const id = replyId(reply);
      selected.set(id, { ...selected.get(id), ...reply, exportType: selected.has(id) ? 'author,pinned' : 'pinned' });
    }
  }
  if (options.includeAllComments || options.includeAuthorReplies) {
    const authorUid = feedAuthorUid(feed);
    await mapConcurrent([...selected.values()], async (reply) => {
      reply.replies = await loadSubReplies(feedId, replyId(reply), options.includeAllComments ? '' : authorUid, signal);
      return reply;
    }, signal);
  }
  return [...selected.values()];
}

function snapshotEntry(entry: FavoriteExportEntry, exportedAt: string): FavoriteSnapshotEntry {
  const message = getFeedDetailMessage(entry.feed);
  return {
    id: entry.id,
    title: feedTitle(entry.feed),
    author: feedAuthor(entry.feed),
    contentHash: hash(message),
    lastSeenAt: exportedAt,
    feed: entry.feed,
  };
}

function snapshotKey(accountId: string, source: FavoriteExportSource): string {
  return source.type === 'all' ? `account:${accountId}` : `account:${accountId}:collection:${source.id}`;
}

async function compareSnapshot(accountId: string, source: FavoriteExportSource, entries: FavoriteExportEntry[], exportedAt: string, signal?: AbortSignal): Promise<FavoriteExportDiff> {
  throwIfCancelled(signal);
  const key = snapshotKey(accountId, source);
  const previous = await readTauriStoreValue<FavoriteSnapshot>(SNAPSHOT_FILE, key);
  const currentEntries = Object.fromEntries(entries.map(entry => [entry.id, snapshotEntry(entry, exportedAt)]));
  const previousEntries = previous?.entries || {};
  const currentIds = new Set(Object.keys(currentEntries));
  const added = Object.keys(currentEntries).filter(id => !previousEntries[id]);
  const changed = Object.keys(currentEntries).filter(id => previousEntries[id] && previousEntries[id].contentHash !== currentEntries[id].contentHash);
  const missing = Object.values(previousEntries).filter(entry => !currentIds.has(entry.id));
  const removedFromFavorites: FavoriteSnapshotEntry[] = [];
  const unavailable: Array<FavoriteSnapshotEntry & { error: string }> = [];
  await mapConcurrent(missing, async (entry) => {
    throwIfCancelled(signal);
    try {
      await CoolapkTauriAPI.getPublicFeedDetail(entry.id);
      removedFromFavorites.push(entry);
    } catch (error) {
      unavailable.push({ ...entry, error: errorMessage(error) });
    }
    return entry;
  }, signal);
  return { previousExportedAt: previous?.exportedAt || '', added, changed, removedFromFavorites, unavailable };
}

/** 仅在所有目标文件均保存成功后推进快照，避免失败导出污染下次差异。 */
export async function saveFavoriteExportSnapshot(bundle: FavoriteExportBundle): Promise<void> {
  const key = snapshotKey(bundle.accountId, bundle.source);
  const previous = await readTauriStoreValue<FavoriteSnapshot>(SNAPSHOT_FILE, key);
  const currentEntries = Object.fromEntries(bundle.items.map(entry => [entry.id, snapshotEntry(entry, bundle.exportedAt)]));
  await writeTauriStoreValue(SNAPSHOT_FILE, key, {
    exportedAt: bundle.exportedAt,
    // 历史缺失项继续保留，后续仍可读取其最后一次成功保存的正文并重新检查状态。
    entries: { ...(previous?.entries || {}), ...currentEntries },
  });
}

export async function buildFavoriteExport(
  accountId: string,
  options: FavoriteExportOptions,
  onProgress?: (progress: FavoriteExportProgress) => void,
  source: FavoriteExportSource = { type: 'all', id: 'all', title: '全部收藏' },
  signal?: AbortSignal,
): Promise<FavoriteExportBundle> {
  throwIfCancelled(signal);
  onProgress?.({ stage: 'list', current: 0, total: 0, message: source.type === 'all' ? '正在遍历全部云端收藏' : `正在读取收藏单“${source.title}”` });
  const { feeds, complete } = source.type === 'all' ? await loadAllFavoriteFeeds(signal) : await loadCollectionFeeds(source.id, signal);
  throwIfCancelled(signal);
  if (!complete) throw new Error(`收藏列表未能完整遍历，已读取 ${feeds.length} 条`);
  let contentDone = 0;
  const items = await mapConcurrent(feeds, async (summary): Promise<FavoriteExportEntry> => {
    throwIfCancelled(signal);
    const id = favoriteFeedId(summary);
    try {
      const response = await CoolapkTauriAPI.getPublicFeedDetail(id);
      throwIfCancelled(signal);
      const detail = response?.data;
      const message = stripFeedMoreSuffix(getFeedDetailMessage(detail) || getFeedDetailMessage(summary));
      const feed = { ...summary, ...(detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : {}), id, message };
      return { id, feed, contentComplete: Boolean(message), comments: [] };
    } catch (error) {
      return { id, feed: { ...summary, message: stripFeedMoreSuffix(getFeedDetailMessage(summary)) }, contentComplete: false, contentError: errorMessage(error), comments: [] };
    } finally {
      contentDone += 1;
      onProgress?.({ stage: 'content', current: contentDone, total: feeds.length, message: `正在获取完整正文 ${contentDone}/${feeds.length}` });
    }
  }, signal);
  let commentDone = 0;
  if (options.includeAllComments || options.includeAuthorComments || options.includePinnedComments) {
    await mapConcurrent(items, async (entry) => {
      try {
        entry.comments = await loadSelectedComments(entry.feed, options, signal);
      } catch (error) {
        entry.commentError = errorMessage(error);
      } finally {
        commentDone += 1;
        onProgress?.({ stage: 'comments', current: commentDone, total: items.length, message: `正在获取评论 ${commentDone}/${items.length}` });
      }
      return entry;
    }, signal);
  }
  throwIfCancelled(signal);
  const exportedAt = new Date().toISOString();
  onProgress?.({ stage: 'compare', current: 0, total: items.length, message: '正在与上次导出对比' });
  const diff = await compareSnapshot(accountId, source, items, exportedAt, signal);
  onProgress?.({ stage: 'render', current: items.length, total: items.length, message: '正在生成导出文件' });
  return {
    exportedAt,
    accountId,
    source,
    complete,
    options,
    summary: {
      total: items.length,
      contentComplete: items.filter(item => item.contentComplete).length,
      contentFailed: items.filter(item => !item.contentComplete).length,
      commentFailed: items.filter(item => item.commentError).length,
    },
    diff,
    items,
  };
}

async function loadCollectionFeeds(collectionId: string, signal?: AbortSignal): Promise<{ feeds: any[]; complete: boolean }> {
  const feeds: any[] = [];
  const seen = new Set<string>();
  for (let page = 1; ; page += 1) {
    throwIfCancelled(signal);
    const response = await CoolapkTauriAPI.getCollectionItemList(collectionId, page);
    throwIfCancelled(signal);
    const pageFeeds = Array.isArray(response?.data) ? response.data : [];
    if (pageFeeds.length === 0) return { feeds, complete: true };
    let added = false;
    for (const feed of pageFeeds) {
      const id = favoriteFeedId(feed);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      feeds.push(feed);
      added = true;
    }
    if (!added) return { feeds, complete: false };
  }
}

function plainText(value: string): string {
  return String(value || '')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function favoriteExportToText(bundle: FavoriteExportBundle): string {
  const sections = bundle.items.map((entry, index) => {
    const feed = entry.feed;
    const lines = [
      `# ${index + 1}. ${feedTitle(feed) || `动态 ${entry.id}`}`,
      `作者：${feedAuthor(feed) || '未知'}${feedAuthorUid(feed) ? `（${feedAuthorUid(feed)}）` : ''}`,
      `动态 ID：${entry.id}`,
      `原帖：https://www.coolapk.com/feed/${entry.id}`,
      `正文状态：${entry.contentComplete ? '完整' : `获取失败：${entry.contentError || '未知错误'}`}`,
      '',
      plainText(getFeedDetailMessage(feed)),
    ];
    for (const comment of entry.comments) {
      lines.push('', `【${comment.exportType || '评论'}】${feedAuthor(comment) || text(comment?.username)}：${plainText(text(comment?.message))}`);
      for (const reply of comment.replies || []) lines.push(`  ↳ ${optionsReplyLabel(bundle.options, reply)}：${plainText(text(reply?.message))}`);
    }
    return lines.join('\n');
  });
  return `酷安收藏导出：${bundle.source.title}\n导出时间：${bundle.exportedAt}\n总数：${bundle.summary.total}\n\n${sections.join('\n\n' + '='.repeat(72) + '\n\n')}`;
}

function optionsReplyLabel(options: FavoriteExportOptions, reply: any): string {
  return options.includeAllComments ? `${feedAuthor(reply) || text(reply?.username) || '用户'}回复` : '楼主回复';
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatExportCount(value: unknown): string {
  const count = numberValue(value);
  if (count <= 0) return '0';
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return String(count);
}

function normalizedExportImageUrl(value: unknown): string {
  return normalizeFeedImageItems([value]).find(Boolean)?.sourceUrl || text(value);
}

function exportAvatarUrl(value: any): string {
  return normalizedExportImageUrl(
    value?.userAvatar
      || value?.user_avatar
      || value?.avatar
      || value?.userInfo?.userAvatar
      || value?.userInfo?.avatar
      || value?.userInfo?.user_avatar,
  );
}

function exportFeedLevel(value: any): string {
  const level = value?.level ?? value?.userInfo?.level;
  return level === undefined || level === null || String(level).trim() === '' ? '' : `LV${level}`;
}

function exportFeedTime(value: any): string {
  return text(value?.dateline || value?.infoHtml || value?.createTime || value?.create_time) || '时间未知';
}

function exportDevice(value: any): string {
  return text(value?.device_title || value?.deviceTitle || value?.device);
}

function exportAvatarMarkup(value: any, alt: string, className = 'avatar'): string {
  const url = exportAvatarUrl(value);
  return url
    ? `<img class="export-image export-avatar ${className}" loading="lazy" src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}">`
    : `<span class="${className} avatar-fallback">${escapeAttribute((alt || '酷').slice(0, 1))}</span>`;
}

function exportCommentMarkup(comment: any, feed: any, imageQuality: Extract<ImageQualityMode, 'hd' | 'raw'>): string {
  const author = feedAuthor(comment) || text(comment?.username || comment?.userInfo?.username) || '酷友';
  const level = exportFeedLevel(comment);
  const isAuthor = Boolean(feedAuthorUid(feed) && replyUid(comment) === feedAuthorUid(feed));
  const commentImages = getCommentImages(comment)
    .map(url => `<img class="export-image comment-image" loading="lazy" src="${escapeAttribute(getImageUrlByQuality(normalizedExportImageUrl(url), imageQuality))}" alt="评论图片">`)
    .join('');
  const replies = (comment.replies || []).map((reply: any) => {
    const replyAuthor = feedAuthor(reply) || text(reply?.username || reply?.fromUserName) || '酷友';
    const replyLevel = exportFeedLevel(reply);
    const replyImages = getCommentImages(reply)
      .map(url => `<img class="export-image comment-image" loading="lazy" src="${escapeAttribute(getImageUrlByQuality(normalizedExportImageUrl(url), imageQuality))}" alt="回复图片">`)
      .join('');
    const target = text(reply?.replyUsername || reply?.rusername || reply?.toUserName);
    return `<div class="sub-reply-row">${exportAvatarMarkup(reply, replyAuthor, 'sub-reply-avatar')}<div class="sub-reply-main"><div class="sub-reply-meta"><strong>${escapeAttribute(replyAuthor)}</strong>${replyLevel ? `<span class="level-tag">${escapeAttribute(replyLevel)}</span>` : ''}${target ? `<span class="sub-reply-to">回复 @${escapeAttribute(target)}</span>` : ''}</div><div class="sub-reply-text">${renderCoolapkRichText(text(reply?.message))}</div>${replyImages}<div class="sub-reply-actions"><span><i class="far fa-heart"></i> ${formatExportCount(reply?.likenum || reply?.likeNum)}</span></div></div></div>`;
  }).join('');
  return `<div class="comment-row">${exportAvatarMarkup(comment, author, 'comment-avatar')}<div class="comment-main"><div class="comment-meta"><strong>${escapeAttribute(author)}</strong>${isAuthor ? '<span class="badge-author">楼主</span>' : ''}${level ? `<span class="level-tag">${escapeAttribute(level)}</span>` : ''}</div><div class="comment-detail-row"><span>${escapeAttribute(exportFeedTime(comment))}</span>${exportDevice(comment) ? `<span><i class="fas fa-mobile-screen-button"></i> ${escapeAttribute(exportDevice(comment))}</span>` : ''}</div><div class="comment-text">${renderCoolapkRichText(text(comment?.message))}</div>${commentImages}<div class="comment-actions"><span><i class="fas fa-heart"></i> ${formatExportCount(comment?.likenum || comment?.likeNum)}</span><span><i class="far fa-comment"></i> 回复</span></div>${replies ? `<div class="sub-reply-thread">${replies}</div>` : ''}</div></div>`;
}

export type FavoriteHtmlExportOptions = {
  imageQuality: Extract<ImageQualityMode, 'hd' | 'raw'>;
  saveImage?: (url: string, index: number, total: number, kind: 'image' | 'emoji' | 'avatar') => Promise<string>;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
};

export async function favoriteExportToHtml(bundle: FavoriteExportBundle, options: FavoriteHtmlExportOptions = { imageQuality: 'hd' }): Promise<string> {
  throwIfCancelled(options.signal);
  const articles = bundle.items.map((entry) => {
    const feed = entry.feed;
    const images = normalizeFeedImageItems(extractFeedImageInputs(feed))
      .map(image => `<a href="${escapeAttribute(image.sourceUrl)}"><img class="export-image" loading="lazy" src="${escapeAttribute(getImageUrlByQuality(image.sourceUrl || image.coverUrl, options.imageQuality))}" alt="帖子图片"></a>`)
      .join('');
    const comments = entry.comments.length > 0 ? `<details class="feed-comment-section"><summary class="comment-toolbar"><strong class="comment-title">评论 <span>${formatExportCount(feed?.replynum || entry.comments.length)}</span></strong><div class="comment-sort"><span class="comment-sort-button is-active">默认</span><span class="comment-sort-button">最新</span><span class="comment-sort-button">热门</span><span class="comment-sort-button">楼主</span></div><span class="comment-expand-hint">点击展开 <i class="fas fa-chevron-down"></i></span></summary><div class="comment-body"><div class="comment-list">${entry.comments.map(comment => exportCommentMarkup(comment, feed, options.imageQuality)).join('')}</div></div></details>` : '';
    const avatar = exportAvatarMarkup(feed, feedAuthor(feed) || '酷友');
    const level = exportFeedLevel(feed);
    const title = feedTitle(feed);
    const device = exportDevice(feed);
    return `<article id="feed-${entry.id}" class="feed-card"><div class="feed-header">${avatar}<div class="feed-user-info"><div class="feed-user-row"><strong class="feed-username">${escapeAttribute(feedAuthor(feed) || '酷友')}</strong>${level ? `<span class="level-tag">${escapeAttribute(level)}</span>` : ''}</div><div class="feed-meta"><span>${escapeAttribute(exportFeedTime(feed))}</span>${device ? `<span><i class="fas fa-mobile-screen-button"></i> ${escapeAttribute(device)}</span>` : ''}</div></div><span class="feed-more">•••</span></div>${title ? `<h2 class="feed-title">${renderCoolapkRichText(title)}</h2>` : ''}<div class="feed-content">${renderCoolapkRichText(getFeedDetailMessage(feed))}</div>${images ? `<div class="feed-images">${images}</div>` : ''}<div class="feed-action-bar"><span><i class="far fa-heart"></i> ${formatExportCount(feed?.likenum)}</span><span><i class="far fa-comment"></i> ${formatExportCount(feed?.replynum)}</span><span><i class="fas fa-retweet"></i> ${formatExportCount(feed?.sharenum)}</span><span class="is-favorite"><i class="fas fa-bookmark"></i> ${formatExportCount(feed?.favnum || feed?.favoritenum || feed?.favoriteNum)}</span></div>${comments}</article>`;
  }).join('');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>酷安收藏导出：${escapeAttribute(bundle.source.title)}</title><style>:root{--surface:#fff;--background:#f3f5f7;--border:#e3e6e8;--border-light:#edf0f2;--text-primary:#202124;--text-secondary:#68707b;--text-tertiary:#9299a3;--brand-primary:#10b981;--brand-soft:#e8f8f0;--surface-hover:#f7f9fa}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--text-primary);font:15px/1.75 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:960px;margin:auto;padding:28px 20px}header.export-header{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px 24px;margin-bottom:18px}h1{margin:0 0 6px;font-size:24px}h2{margin:0}.export-meta{color:var(--text-tertiary);font-size:13px}.feed-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:14px;overflow:hidden}.feed-header{display:flex;align-items:center;gap:12px}.avatar{width:42px;height:42px;flex:0 0 42px;border-radius:50%;object-fit:cover;background:#eef1f3}.avatar-fallback{display:grid;place-items:center;color:var(--brand-primary);font-weight:700}.feed-user-info{min-width:0;flex:1}.feed-user-row{display:flex;align-items:center;gap:7px}.feed-username{font-size:16px}.feed-meta,.comment-detail-row{display:flex;align-items:center;gap:9px;color:var(--text-tertiary);font-size:12px}.level-tag{display:inline-flex;padding:0 5px;border-radius:4px;background:#f0f2f4;color:#68707b;font-size:11px;font-weight:700}.feed-more{color:var(--text-tertiary);font-size:21px;letter-spacing:2px}.feed-title{margin-top:15px;font-size:18px}.feed-content{margin-top:10px;font-size:16px;line-height:1.75;white-space:pre-wrap;word-break:break-word}.feed-content a,.comment-text a,.sub-reply-text a{color:#087b42}.feed-images{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-top:14px}.feed-images img{display:block;width:100%;max-height:330px;object-fit:cover;border-radius:10px}.export-image{max-width:100%}.coolapk-emoji{width:24px;height:24px;object-fit:contain;vertical-align:middle}.feed-action-bar{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border-light);padding-top:9px;margin-top:14px;color:var(--text-tertiary);font-size:14px}.feed-action-bar span{display:inline-flex;align-items:center;gap:6px;min-width:0}.feed-action-bar i{font-size:16px}.feed-action-bar .is-favorite{color:#f59e0b}.feed-comment-section{margin-top:14px;padding:14px;background:var(--background);border:1px solid var(--border-light);border-radius:12px}.feed-comment-section>summary{list-style:none;cursor:pointer}.feed-comment-section>summary::-webkit-details-marker{display:none}.comment-expand-hint{margin-left:auto;color:var(--text-tertiary);font-size:12px}.comment-expand-hint i{transition:transform .2s ease}.feed-comment-section[open] .comment-expand-hint i{transform:rotate(180deg)}.comment-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:12px}.comment-title{font-size:16px}.comment-title span{color:var(--text-tertiary);font-size:13px;font-weight:500}.comment-sort{display:inline-flex;gap:3px;padding:3px;border:1px solid var(--border-light);border-radius:999px;background:var(--surface)}.comment-sort-button{padding:5px 12px;border-radius:999px;color:var(--text-secondary);font-size:12px}.comment-sort-button.is-active{background:var(--surface);color:var(--brand-primary);box-shadow:0 1px 4px rgba(0,0,0,.08);font-weight:600}.comment-list{display:flex;flex-direction:column;gap:16px}.comment-row{display:flex;align-items:flex-start;gap:10px}.comment-avatar{width:32px;height:32px;flex-basis:32px}.comment-main{flex:1;min-width:0}.comment-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:14px}.badge-author{padding:1px 5px;border-radius:4px;background:var(--brand-soft);color:var(--brand-primary);font-size:11px}.comment-detail-row{margin-top:2px}.comment-text,.sub-reply-text{margin-top:5px;font-size:14px;line-height:1.6;word-break:break-word}.comment-image{display:inline-block;width:110px;height:110px;object-fit:cover;margin:8px 8px 0 0;border-radius:8px}.comment-actions,.sub-reply-actions{display:flex;gap:14px;margin-top:5px;color:var(--text-tertiary);font-size:12px}.comment-actions i,.sub-reply-actions i{color:var(--brand-primary)}.sub-reply-thread{margin:8px 0 0 4px;padding-left:14px;border-left:2px solid var(--border);display:flex;flex-direction:column;gap:10px}.sub-reply-row{display:flex;align-items:flex-start;gap:9px}.sub-reply-avatar{width:28px;height:28px;flex-basis:28px}.sub-reply-main{flex:1;min-width:0}.sub-reply-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:13px}.sub-reply-to{color:var(--text-tertiary);font-size:12px}@media(max-width:640px){main{padding:14px 10px}.comment-toolbar{align-items:flex-start;flex-direction:column}.comment-sort{max-width:100%;overflow:auto}.comment-expand-hint{margin-left:0}.feed-images{grid-template-columns:repeat(2,minmax(0,1fr))}}</style></head><body><main><header class="export-header"><h1>酷安收藏导出：${renderCoolapkRichText(bundle.source.title)}</h1><div class="export-meta">导出时间：${escapeAttribute(bundle.exportedAt)} · 共 ${bundle.summary.total} 条 · 正文失败 ${bundle.summary.contentFailed} 条</div></header>${articles}</main></body></html>`;
  if (!options.saveImage) return html;
  const imageEntries = [...html.matchAll(/<img\b([^>]*?)\bsrc="([^\"]+)"/gi)].map((match) => ({
    source: match[2].replace(/&amp;/g, '&'),
    kind: /\bclass="[^\"]*\bexport-avatar\b/i.test(match[1])
      ? 'avatar' as const
      : /\bclass="[^\"]*\bcoolapk-emoji\b/i.test(match[1])
        ? 'emoji' as const
        : 'image' as const,
  }));
  const uniqueEntries = [...new Map(imageEntries.map(entry => [`${entry.kind}:${entry.source}`, entry])).values()];
  const localImages = new Map<string, string>();
  let done = 0;
  await mapConcurrent(uniqueEntries, async (entry, index) => {
    throwIfCancelled(options.signal);
    try {
      localImages.set(`${entry.kind}:${entry.source}`, await options.saveImage!(entry.source, index, uniqueEntries.length, entry.kind));
    } catch {
      // 下载失败时保留远程链接，HTML 仍可联网显示该图片。
    } finally {
      done += 1;
      options.onProgress?.(`正在保存 HTML 图片 ${done}/${uniqueEntries.length}`);
    }
    return entry;
  }, options.signal);
  return html.replace(/(<img\b([^>]*?)\bsrc=")([^\"]+)("[^>]*>)/gi, (full, prefix: string, attributes: string, source: string, suffix: string) => {
    const decodedSource = source.replace(/&amp;/g, '&');
    const kind = /\bclass="[^\"]*\bexport-avatar\b/i.test(attributes)
      ? 'avatar'
      : /\bclass="[^\"]*\bcoolapk-emoji\b/i.test(attributes)
        ? 'emoji'
        : 'image';
    const localPath = localImages.get(`${kind}:${decodedSource}`);
    return localPath ? `${prefix}${escapeAttribute(localPath)}${suffix}` : full;
  });
}
