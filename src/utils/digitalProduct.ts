import type { DiscoveryEntity } from '../types/discovery';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstValue(entity: DiscoveryEntity, keys: string[]): unknown {
  for (const key of keys) {
    const value = entity[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function textValue(entity: DiscoveryEntity, keys: string[]): string {
  const value = firstValue(entity, keys);
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getDigitalEntityTemplate(entity: DiscoveryEntity): string {
  return textValue(entity, ['entityTemplate', 'entity_template', 'entityType', 'entity_type']).toLowerCase();
}

export function getDigitalEntityTitle(entity: DiscoveryEntity): string {
  return textValue(entity, ['title', 'productGroupTitle', 'product_group_title', 'seriesTitle', 'series_title', 'productTitle', 'product_title', 'name', 'label', 'buttonText', 'button_text']);
}

export function getDigitalProductTitle(entity: DiscoveryEntity): string {
  return textValue(entity, ['title', 'productTitle', 'product_title', 'name', 'label']);
}

export function isDigitalSeriesTitle(entity: DiscoveryEntity): boolean {
  return ['productgrouptitle', 'product_group_title', 'series_title', 'series-title', 'seriestitle'].includes(getDigitalEntityTemplate(entity));
}

export function isDigitalSeriesMore(entity: DiscoveryEntity): boolean {
  return ['productgroupmore', 'product_group_more', 'series_more', 'series-more', 'seriesmore'].includes(getDigitalEntityTemplate(entity));
}

export function isDigitalProduct(entity: DiscoveryEntity): boolean {
  const template = getDigitalEntityTemplate(entity);
  if (isDigitalSeriesTitle(entity) || isDigitalSeriesMore(entity)) return false;
  return template === 'product' || template.includes('vertical_product') || template.includes('horizon_product') || template.includes('product_') || template.includes('product') || Boolean(entity.productId ?? entity.product_id);
}

export function getDigitalProductId(entity: DiscoveryEntity): string {
  return textValue(entity, ['productId', 'product_id', 'id', 'entityId', 'entity_id']);
}

export function getDigitalProductImage(entity: DiscoveryEntity): string {
  const logo = textValue(entity, ['logo', 'compatLogo', 'compat_logo', 'pic', 'picUrl', 'pic_url', 'icon', 'image']);
  if (logo) return logo;
  const coverList = firstValue(entity, ['coverArr', 'cover_arr', 'coverPicList', 'cover_pic_list']);
  if (Array.isArray(coverList)) {
    const first = coverList.find((item) => typeof item === 'string' && item.trim());
    if (first) return String(first);
  }
  return textValue(entity, ['cover']);
}

export function getDigitalProductSpecs(entity: DiscoveryEntity): string[] {
  const rawSpecs = firstValue(entity, ['productSpecs', 'product_specs', 'tagArr', 'tag_arr']);
  if (Array.isArray(rawSpecs)) return rawSpecs.map((item) => String(item).trim()).filter(Boolean).slice(0, 4);
  if (typeof rawSpecs === 'string') return rawSpecs.split(/[|,，、]/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
  return [];
}

export function getDigitalProductSubtitle(entity: DiscoveryEntity): string {
  const subtitle = textValue(entity, ['subTitle', 'sub_title', 'description', 'configName', 'config_name', 'categoryName', 'category_name', 'secondCategoryName', 'second_category_name']);
  return subtitle || getDigitalProductSpecs(entity).join(' · ');
}

export function getDigitalProductRating(entity: DiscoveryEntity): string {
  const rating = numberValue(firstValue(entity, ['ratingAverageScore', 'rating_average_score', 'starAverageScore', 'star_average_score']));
  return rating > 0 ? rating.toFixed(1) : '';
}

export function getDigitalProductPrice(entity: DiscoveryEntity): string {
  const min = numberValue(firstValue(entity, ['priceMin', 'price_min']));
  const max = numberValue(firstValue(entity, ['priceMax', 'price_max']));
  if (min <= 0 && max <= 0) return '';
  const currency = textValue(entity, ['priceCurrency', 'price_currency']) || '¥';
  const format = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  if (min > 0 && max > 0 && min !== max) return `${currency}${format(min)}-${format(max)}`;
  return `${currency}${format(Math.max(min, max))}`;
}

export function getDigitalProductHot(entity: DiscoveryEntity): string {
  const display = textValue(entity, ['hotNumText', 'hot_num_txt', 'followNumText', 'follow_num_txt']);
  if (display) return display;
  const hot = numberValue(firstValue(entity, ['hotNum', 'hot_num', 'followNum', 'follow_num']));
  if (hot <= 0) return '';
  if (hot >= 10000) return `${(hot / 10000).toFixed(1)}万`;
  return String(hot);
}

export function getDigitalProductRelease(entity: DiscoveryEntity): string {
  return textValue(entity, ['releaseTime', 'release_time', 'releaseDate', 'release_date']);
}

export function isDigitalProductNew(entity: DiscoveryEntity): boolean {
  return booleanValue(firstValue(entity, ['isNewProduct', 'is_new_product'])) || numberValue(firstValue(entity, ['releaseStatus', 'release_status'])) === 2;
}

export function getDigitalProductConfigCount(entity: DiscoveryEntity): number {
  return numberValue(firstValue(entity, ['configNum', 'config_num', 'compareConfigCount', 'compare_config_count']));
}

export function isDigitalProductWished(entity: DiscoveryEntity): boolean {
  const action = asRecord(firstValue(entity, ['userAction', 'user_action']));
  return booleanValue(action.follow ?? action.wish ?? action.wished);
}
