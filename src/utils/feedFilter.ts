import { getFeedVideo } from './feedMedia';
import { getFeedRelationImage, getFeedRelationRows, getFeedRelationTitle } from './feedRelations';

/**
 * 判断动态是否为广告/推广内容：
 *  - feedType/type 为 ad/advert/ads
 *  - 存在 advert / isAd 字段或 extra_key 为 ad
 *  - 标题以 [广告]、广告：/ 推广： 开头
 */
export function isAdFeed(item: any): boolean {
  if (!item) return false;
  const t = String(item.feedType || item.type || '').toLowerCase();
  if (t === 'ad' || t === 'advert' || t === 'ads') return true;
  if (item.advert || item.isAd) return true;
  if (item.extra_key === 'ad') return true;
  const title = String(item.title || '');
  if (/^\[广告\]|^(广告|推广)\s*[:：]/i.test(title)) return true;
  return false;
}

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

/**
 * 列表过滤统一入口：广告卡片 + 关键词屏蔽
 */
export function shouldHideFeed(item: any, settings: { hideAdCards: boolean; blockedKeywords: string[] }): boolean {
  if (settings.hideAdCards && isAdFeed(item)) return true;
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
  if (getFeedVideo(item)?.url) return true;

  return getFeedRelationRows(item).some((row) => Boolean(
    getFeedRelationTitle(row)
    || getFeedRelationImage(row)
    || row.id
    || row.entityId
    || row.entity_id
    || row.url,
  ));
}
