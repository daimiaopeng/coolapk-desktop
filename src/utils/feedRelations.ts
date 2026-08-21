type FeedRelationRecord = Record<string, any>;

const RELATION_COLLECTION_KEYS = [
  'relationRows',
  'relation_rows',
  'extraRows',
  'extra_rows',
  'productRows',
  'product_rows',
];

function appendRows(value: unknown, rows: FeedRelationRecord[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => appendRows(item, rows));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as FeedRelationRecord;
  const nested = [record.rows, record.entities, record.list, record.data].find(Array.isArray);
  if (nested) {
    appendRows(nested, rows);
    return;
  }
  rows.push(record);
}

/** 读取动态上的多关联标的，兼容官方接口的驼峰和下划线字段。 */
export function getFeedRelationRows(feed: unknown): FeedRelationRecord[] {
  if (!feed || typeof feed !== 'object') return [];

  const sources = [feed as FeedRelationRecord];
  const record = feed as FeedRelationRecord;
  for (const nested of [record.feedInfo, record.feed, record.data]) {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) sources.push(nested as FeedRelationRecord);
  }

  const rows: FeedRelationRecord[] = [];
  for (const source of sources) {
    for (const key of RELATION_COLLECTION_KEYS) appendRows(source[key], rows);
  }

  const seen = new Set<string>();
  return rows.filter((row, index) => {
    const key = getFeedRelationKey(row, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getFeedRelationTitle(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const record = row as FeedRelationRecord;
  return String(
    record.title
    || record.name
    || record.targetTitle
    || record.target_title
    || record.productName
    || record.product_name
    || record.appName
    || record.app_name
    || record.gameName
    || record.game_name
    || record.entityTitle
    || record.entity_title
    || record.label
    || '',
  ).trim();
}

export function getFeedRelationSubtitle(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const record = row as FeedRelationRecord;
  return String(
    record.subTitle
    || record.subtitle
    || record.description
    || record.targetSubTitle
    || record.target_subtitle
    || record.versionName
    || record.version_name
    || '',
  ).trim();
}

export function getFeedRelationImage(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const record = row as FeedRelationRecord;
  return String(
    record.logo
    || record.productLogo
    || record.product_logo
    || record.pic
    || record.icon
    || record.avatar
    || record.targetPic
    || record.target_pic
    || '',
  ).trim();
}

export function getFeedRelationType(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const record = row as FeedRelationRecord;
  return String(
    record.entityType
    || record.entity_type
    || record.targetType
    || record.target_type
    || record.type
    || record.entityTemplate
    || record.entity_template
    || record.template
    || '',
  ).toLowerCase();
}

export function getFeedRelationKey(row: unknown, fallbackIndex = 0): string {
  if (!row || typeof row !== 'object') return `unknown:${fallbackIndex}`;
  const record = row as FeedRelationRecord;
  const type = getFeedRelationType(record);
  const id = record.entityId ?? record.entity_id ?? record.id ?? record.targetId ?? record.target_id;
  if (id !== undefined && id !== null && String(id).trim()) return `${type}:${String(id)}`;
  const url = record.url || record.targetUrl || record.target_url || record.webUrl || record.web_url;
  if (url) return `${type}:url:${String(url)}`;
  return `${type}:text:${getFeedRelationTitle(record)}:${getFeedRelationImage(record)}:${fallbackIndex}`;
}
