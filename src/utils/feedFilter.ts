import { getFeedVideo } from './feedMedia';
import { getFeedRelationImage, getFeedRelationRows, getFeedRelationTitle } from './feedRelations';

/**
 * 判断动态文本（标题/正文）是否命中任一屏蔽关键词
 */
export function matchesBlockedKeywords(item: any, keywords: string[]): boolean {
  if (!item || !Array.isArray(keywords) || keywords.length === 0) return false;
  const text = `${item.title || ''} ${item.message || ''}`.toLowerCase();
  for (const kw of keywords) {
    const key = String(kw).trim().toLowerCase();
    if (key && text.includes(key)) return true;
  }
  return false;
}

/** 列表过滤统一入口：关键词屏蔽。 */
export function shouldHideFeed(item: any, settings: { blockedKeywords: string[] }): boolean {
  if (matchesBlockedKeywords(item, settings.blockedKeywords)) return true;
  return false;
}

/** 判断动态是否至少包含文本、图片、视频或关联卡片中的一种可渲染内容。 */
export function hasFeedRenderableContent(item: any): boolean {
  if (!item || !item.id) return false;

  const text = [item.title, item.message, item.message_raw_output, item.content, item.username, item.userInfo?.username]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
  if (text) return true;

  const pictures = item.pics || item.picArr || item.pic;
  if ((Array.isArray(pictures) && pictures.some((value) => typeof value === 'string' && value.trim())) || (typeof pictures === 'string' && pictures.trim())) return true;
  const video = getFeedVideo(item);
  if (video?.url || video?.requestParams) return true;

  return getFeedRelationRows(item).some((row) => Boolean(
    getFeedRelationTitle(row)
    || getFeedRelationImage(row)
    || row.id
    || row.entityId
    || row.entity_id
    || row.url,
  ));
}
