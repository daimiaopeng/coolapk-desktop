const LINK_MORE_SUFFIX = /(?:(?:\.{2,}|…+)\s*)*<a\b[^>]*>\s*查看更多\s*<\/a>\s*$/i;
const PLAIN_MORE_SUFFIX = /(?:\.{2,}|…+)\s*查看更多\s*$/i;

/** 判断正文末尾是否包含酷安列表接口附加的“查看更多”占位。 */
export function hasFeedMoreSuffix(message: string): boolean {
  const trimmed = message.trim();
  return LINK_MORE_SUFFIX.test(trimmed) || PLAIN_MORE_SUFFIX.test(trimmed);
}

/** 删除接口附加的“查看更多”，由桌面端统一显示“展开全文”按钮。 */
export function stripFeedMoreSuffix(message: string): string {
  let result = message.trimEnd();
  while (hasFeedMoreSuffix(result)) {
    result = result.replace(LINK_MORE_SUFFIX, '').replace(PLAIN_MORE_SUFFIX, '').trimEnd();
  }
  return result;
}

/** 从动态详情对象中提取完整正文。 */
export function getFeedDetailMessage(feed: any): string {
  if (!feed) return '';
  if (Array.isArray(feed)) {
    return feed.map((item) => getFeedDetailMessage(item)).find(Boolean) || '';
  }
  if (typeof feed !== 'object') return '';

  const directMessage = [feed.message, feed.message_raw_output, feed.content, feed.text, feed.note]
    .find((value) => typeof value === 'string' && value.trim());
  if (directMessage) return directMessage;

  for (const nested of [feed.feedInfo, feed.feed, feed.targetRow, feed.targetFeed, feed.data]) {
    const message = getFeedDetailMessage(nested);
    if (message) return message;
  }

  return typeof feed.message_title === 'string' ? feed.message_title : '';
}

/** 解析酷安动态网页版返回的 JSON 正文，作为详情接口被验证码拦截时的兜底。 */
export function parseWebFeedDetail(raw: unknown): any | null {
  if (!raw) return null;

  try {
    const text = typeof raw === 'string' ? raw.trim() : raw;
    const parsed = typeof text === 'string' ? JSON.parse(text) : text;
    if (!parsed || typeof parsed !== 'object') return null;
    const detail = (parsed as any).data ?? parsed;
    return detail && typeof detail === 'object' ? detail : null;
  } catch {
    return null;
  }
}
