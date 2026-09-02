export type CommentSortMode = 'default' | 'likes' | 'latest' | 'earliest';

export type CommentSortSelection = {
  mode: CommentSortMode;
  authorOnly: boolean;
};

export type CommentReplyListType = '' | 'lastupdate_desc' | 'dateline_desc' | 'popular';

export type CommentReplyRequestOptions = {
  listType: CommentReplyListType;
  fromFeedAuthor: 0 | 1;
  firstItem?: string;
  lastItem?: string;
};

export const DEFAULT_COMMENT_SORT_MODE: CommentSortMode = 'default';

export const COMMENT_SORT_OPTIONS: ReadonlyArray<{ value: CommentSortMode; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'latest', label: '最新' },
  { value: 'likes', label: '热门' },
];

// 酷安动态评论接口默认每页 10 条；实际是否结束以接口空页为准。
export const COMMENT_PAGE_SIZE = 10;

export type CommentPageCursor = {
  firstItem: string;
  lastItem: string;
};

/**
 * APK 的 ReplyListV13 请求参数：排序由 listType 服务端完成，楼主是独立筛选。
 * APK 没有“最早”接口；保留旧模式时沿用时间接口并在当前已加载数据上反向显示。
 */
export function getCommentReplyRequestOptions(
  mode: CommentSortMode,
  authorOnly = false,
): CommentReplyRequestOptions {
  if (authorOnly) {
    return { listType: '', fromFeedAuthor: 1 };
  }

  if (mode === 'likes') return { listType: 'popular', fromFeedAuthor: 0 };
  if (mode === 'latest' || mode === 'earliest') {
    return { listType: 'dateline_desc', fromFeedAuthor: 0 };
  }
  return { listType: 'lastupdate_desc', fromFeedAuthor: 0 };
}

export function getReplyData(response: any): any[] {
  return Array.isArray(response?.data) ? response.data : [];
}

function getReplyEntityId(item: any): string {
  return String(item?.entityId ?? item?.id ?? '').trim();
}

/** APK replyList 使用已加载评论的首尾 ID 作为下一页游标。 */
export function getReplyPageCursor(replies: any[]): CommentPageCursor {
  const ids = replies.map(getReplyEntityId).filter(Boolean);
  return {
    firstItem: ids[0] || '',
    lastItem: ids[ids.length - 1] || '',
  };
}

/** replynum 为 0/缺失时通常表示调用方没有可靠总数，不作为分页上限。 */
export function getExpectedCommentCount(value: unknown): number | null {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function getReplyKey(item: any, index: number): string {
  const id = String(item?.id ?? '').trim();
  const fallback = `${item?.uid ?? ''}:${item?.dateline ?? ''}:${item?.message ?? ''}`;
  return id || (fallback === '::' ? `index:${index}` : fallback);
}

function fillReplyDetails(preferred: any, complete: any): any {
  const merged = { ...complete, ...preferred };
  // 热门接口的 infoHtml 可能是“回复”等操作文案，时间字段必须以完整评论为准。
  for (const field of ['dateline', 'dateline_text', 'infoHtml', 'createTime', 'created_at']) {
    if (complete?.[field]) merged[field] = complete[field];
  }
  // 其他作者附加信息仅在热门接口缺失时补齐。
  for (const field of [
    'deviceTitle',
    'userLevel',
    'verifyTitle',
    'userAvatar',
    'floor',
    'ipLocation',
    'location',
    'pic',
    'picArr',
    'pics',
    'images',
  ]) {
    const value = preferred?.[field];
    if ((value === undefined || value === null || value === '' || value === 0) && complete?.[field]) {
      merged[field] = complete[field];
    }
  }
  return merged;
}

export function mergeReplies(primary: any[], secondary: any[]): any[] {
  const secondaryByKey = new Map(
    secondary.map((item, index) => [getReplyKey(item, index), item]),
  );
  const seen = new Set<string>();
  const result: any[] = [];

  primary.forEach((item, index) => {
    const key = getReplyKey(item, index);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(fillReplyDetails(item, secondaryByKey.get(key)));
  });

  secondary.forEach((item, index) => {
    const key = getReplyKey(item, index);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });

  return result;
}

/**
 * 根据 APK 的分页规则判断是否需要请求下一页。
 *
 * APK 只把空页视为到达末页。短页可能是服务端过滤卡片后的结果，不能因此
 * 提前停止；如果动态已提供可靠总数，则在已加载数量达到总数时提前结束，避免
 * 少量评论为了确认末页再多等一次请求。
 */
export function hasMoreReplyPages(
  pageReplies: any[],
  previousReplies: any[],
  mergedReplies: any[],
  expectedTotal?: number | null,
): boolean {
  if (pageReplies.length === 0 || mergedReplies.length <= previousReplies.length) return false;
  const total = getExpectedCommentCount(expectedTotal);
  return total === null || mergedReplies.length < total;
}

function getCommentLikes(item: any): number {
  const value = Number(item?.likenum ?? item?.likeNum ?? item?.like_num ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getCommentTimestamp(item: any): number {
  const raw = item?.dateline ?? item?.createTime ?? item?.created_at ?? item?.infoHtml;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 10_000_000_000 ? numeric / 1000 : numeric;
  }

  const parsed = Date.parse(String(raw ?? ''));
  if (Number.isFinite(parsed)) return parsed / 1000;

  return 0;
}

export function sortComments(comments: any[], mode: CommentSortMode): any[] {
  const result = [...comments];
  if (mode === 'default') return result;
  result.sort((left, right) => {
    const leftTime = getCommentTimestamp(left) || Number(left?.id) || 0;
    const rightTime = getCommentTimestamp(right) || Number(right?.id) || 0;
    const timeDifference = rightTime - leftTime;
    if (mode === 'latest') return timeDifference;
    if (mode === 'earliest') return -timeDifference;

    const likeDifference = getCommentLikes(right) - getCommentLikes(left);
    return likeDifference || timeDifference;
  });
  return result;
}

export function formatCommentTime(
  item: any,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  // 接口的 infoHtml 有时是“回复”等操作文案，只接受明显的时间文本。
  for (const value of [item?.dateline_text, item?.infoHtml]) {
    const text = String(value ?? '').trim();
    if (
      text
      && /(刚刚|前|昨天|今天|\d{1,4}[年/-]\d{1,2}(?:[月/-]\d{1,2})?)/.test(text)
    ) {
      return text;
    }
  }

  const timestamp = getCommentTimestamp(item);
  if (!timestamp) return '';

  const difference = Math.max(0, nowSeconds - timestamp);
  if (difference < 60) return '刚刚';
  if (difference < 3600) return `${Math.floor(difference / 60)}分钟前`;
  if (difference < 86400) return `${Math.floor(difference / 3600)}小时前`;
  if (difference < 2_592_000) return `${Math.floor(difference / 86400)}天前`;

  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

export function formatCommentAbsoluteTime(item: any): string {
  const timestamp = getCommentTimestamp(item);
  if (!timestamp) return '';

  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ');
}

function collectImageValues(value: unknown, result: string[], depth = 0): void {
  if (value === undefined || value === null || depth > 5) return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectImageValues(item, result, depth + 1));
    return;
  }

  if (typeof value === 'string') {
    const text = value.trim().replace(/\\\//g, '/');
    if (!text) return;

    if ((text.startsWith('[') || text.startsWith('{')) && text.length < 100_000) {
      try {
        collectImageValues(JSON.parse(text), result, depth + 1);
        return;
      } catch {
        // 不是 JSON 时继续按普通图片地址处理。
      }
    }

    if (text.includes(',') && !text.startsWith('data:')) {
      text.split(',').forEach((item) => collectImageValues(item, result, depth + 1));
      return;
    }

    let url = text.replace(/^['"]|['"]$/g, '');
    if (url.startsWith('//')) url = `https:${url}`;
    else if (/^(?:image|avatar|static|cos)\.coolapk\.com\//i.test(url)) url = `https://${url}`;
    else if (url.startsWith('/')) url = `https://image.coolapk.com${url}`;

    if (/^(?:https?:|data:image\/|blob:)/i.test(url)) result.push(url);
    return;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of [
      'url',
      'pic',
      'image',
      'imageUrl',
      'image_url',
      'sourceUrl',
      'source_url',
      'source',
      'src',
      'cover',
      'thumb',
      'thumbnail',
    ]) {
      collectImageValues(record[key], result, depth + 1);
    }
  }
}

export function getCommentImages(item: any): string[] {
  const result: string[] = [];
  for (const key of [
    'imageUriList',
    'image_uri_list',
    'picArr',
    'pics',
    'pic',
    'imageList',
    'images',
    'message_pic',
    'imageUrl',
    'image',
  ]) {
    collectImageValues(item?.[key], result);
  }
  return [...new Set(result)];
}

export function getCommentLocation(item: any): string {
  return String(
    item?.ipLocation
    ?? item?.ip_location
    ?? item?.location
    ?? item?.locationName
    ?? '',
  ).trim();
}

export function getCommentDeviceTitle(item: any): string {
  return String(
    item?.deviceTitle
    ?? item?.device_title
    ?? item?.device_name
    ?? item?.device
    ?? '',
  ).trim();
}

export function getCommentVerifyTitle(item: any): string {
  return String(
    item?.verifyTitle
    ?? item?.verify_title
    ?? item?.userInfo?.verify_title
    ?? '',
  ).trim();
}

export function getCommentUserLevel(item: any): string {
  return String(item?.userLevel ?? item?.level ?? item?.userInfo?.level ?? '').trim();
}
