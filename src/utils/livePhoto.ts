import { CoolapkTauriAPI } from '../api/coolapk';
import { isLivePhotoUrl } from './image';
import { normalizeResourceUrl } from './resourceCache';

export type LivePhotoContextType = 'feed' | 'reply' | 'article';

export interface FeedImageMetadata {
  sourceUrl?: string;
  source_url?: string;
  compressedUrl?: string;
  compressed_url?: string;
  liveVideoUrl?: string;
  live_video_url?: string;
  livePhotoEnable?: boolean | number | string;
  live_photo_enable?: boolean | number | string;
  livePhotoSoundEnable?: boolean | number | string;
  live_photo_sound_enable?: boolean | number | string;
  isLivePhoto?: boolean | number | string;
  is_live_photo?: boolean | number | string;
  [key: string]: unknown;
}

export type FeedImageInput = string | FeedImageMetadata;

export interface FeedImageItem {
  key: string;
  sourceUrl: string;
  coverUrl: string;
  liveVideoUrl: string;
  isLivePhoto: boolean;
  [key: string]: unknown;
}

export interface ResolveLivePhotoOptions {
  /** 忽略元数据中的旧地址，重新走酷安 showVideo 解析接口。 */
  force?: boolean;
}

const SOURCE_URL_KEYS = [
  'sourceUrl',
  'source_url',
  'inSource',
  'in_source',
  'url',
  'pic',
  'imageUrl',
  'image_url',
  'src',
] as const;

const COVER_URL_KEYS = [
  'compressedUrl',
  'compressed_url',
  'coverUrl',
  'cover_url',
  'thumbnail',
  'thumb',
  'smallUrl',
  'small_url',
] as const;

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readFlag(record: Record<string, unknown>, keys: readonly string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
      if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
    }
  }
  return false;
}

function normalizeImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  if (/^(?:data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return normalizeResourceUrl(raw);
  if (raw.startsWith('/')) return `https://image.coolapk.com${raw}`;
  if (!raw.includes(':')) return `https://image.coolapk.com/${raw.replace(/^\/+/, '')}`;
  return '';
}

function normalizeVideoUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  if (/^(?:https?:|blob:|data:)/i.test(raw)) return normalizeResourceUrl(raw);
  return '';
}

function flattenImageInputs(value: unknown, result: FeedImageInput[], depth = 0): void {
  if (value === undefined || value === null || depth > 5) return;

  if (Array.isArray(value)) {
    value.forEach((item) => flattenImageInputs(item, result, depth + 1));
    return;
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return;
    if ((raw.startsWith('[') || raw.startsWith('{')) && raw.length < 200_000) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          flattenImageInputs(parsed, result, depth + 1);
          return;
        }
      } catch {
        // 不是 JSON 时按普通图片地址继续处理。
      }
    }
    result.push(raw);
    return;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested = record.imageUriList ?? record.image_uri_list ?? record.items;
    const hasOwnImage = SOURCE_URL_KEYS.some((key) => typeof record[key] === 'string' && String(record[key]).trim());
    if (!hasOwnImage && nested) {
      flattenImageInputs(nested, result, depth + 1);
      return;
    }
    result.push(record as FeedImageMetadata);
  }
}

/** 从动态/评论对象中提取图片输入，同时保留 APK 的 imageUriList 实况字段。 */
export function extractFeedImageInputs(value: unknown): FeedImageInput[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const candidates = [
    record.imageUriList,
    record.image_uri_list,
    record.pics,
    record.picArr,
    record.pic,
  ];

  for (const candidate of candidates) {
    const collected: FeedImageInput[] = [];
    flattenImageInputs(candidate, collected);
    if (collected.length > 0) return collected;
  }
  return [];
}

/** 将字符串 URL 或 APK ImageUrl 对象统一成可渲染的图片项。 */
export function normalizeFeedImageItems(value: unknown): FeedImageItem[] {
  const inputs: FeedImageInput[] = [];
  flattenImageInputs(value, inputs);

  return inputs.flatMap((input, index) => {
    const record = typeof input === 'object' ? input : null;
    const sourceUrl = normalizeImageUrl(record ? readString(record, SOURCE_URL_KEYS) : input);
    const compressedUrl = normalizeImageUrl(record ? readString(record, COVER_URL_KEYS) : '');
    const coverUrl = compressedUrl || sourceUrl;
    const liveVideoUrl = normalizeVideoUrl(record
      ? readString(record, ['liveVideoUrl', 'live_video_url'])
      : '');
    const isLivePhoto = Boolean(
      liveVideoUrl
      || isLivePhotoUrl(sourceUrl)
      || isLivePhotoUrl(coverUrl)
      || (record && readFlag(record, ['livePhotoEnable', 'live_photo_enable', 'isLivePhoto', 'is_live_photo']))
    );

    if (!sourceUrl && !coverUrl) return [];
    return [{
      key: `${sourceUrl || coverUrl}::${index}`,
      sourceUrl: sourceUrl || coverUrl,
      coverUrl,
      liveVideoUrl,
      isLivePhoto,
    }];
  });
}

function extractResolvedVideoUrl(response: unknown): string {
  if (typeof response === 'string') return normalizeVideoUrl(response);
  if (!response || typeof response !== 'object') return '';
  const record = response as Record<string, unknown>;
  const data = record.data;
  const values: unknown[] = [
    record.url,
    record.videoUrl,
    record.video_url,
    record.finalUrl,
    record.final_url,
  ];
  if (typeof data === 'string') values.push(data);
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>;
    values.push(
      dataRecord.url,
      dataRecord.videoUrl,
      dataRecord.video_url,
      dataRecord.finalUrl,
      dataRecord.final_url,
    );
    if (Array.isArray(dataRecord.urlList)) values.push(...dataRecord.urlList);
    if (Array.isArray(dataRecord.url_list)) values.push(...dataRecord.url_list);
  }
  return values.map(normalizeVideoUrl).find(Boolean) || '';
}

const resolvedLiveVideoCache = new Map<string, string>();
const pendingLiveVideoRequests = new Map<string, Promise<string>>();

/** 按 APK 的 feed_<id>/reply_<id> 约定解析实况视频，并合并并发请求。 */
export async function resolveLivePhotoVideo(
  item: FeedImageItem,
  contentId: string | number | undefined,
  contentType: LivePhotoContextType = 'feed',
  options: ResolveLivePhotoOptions = {},
): Promise<string> {
  if (!item.isLivePhoto) return '';
  if (item.liveVideoUrl && !options.force) return item.liveVideoUrl;

  const id = String(contentId ?? '').trim();
  if (!item.sourceUrl || !id) return '';

  const cacheKey = `${contentType}:${id}:${item.sourceUrl}`;
  if (!options.force) {
    const cached = resolvedLiveVideoCache.get(cacheKey);
    if (cached) return cached;
  }
  const pending = pendingLiveVideoRequests.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    const response = await CoolapkTauriAPI.resolveLivePhotoVideo(item.sourceUrl, id, contentType);
    const videoUrl = extractResolvedVideoUrl(response);
    if (!videoUrl) throw new Error('酷安未返回实况视频地址');
    resolvedLiveVideoCache.set(cacheKey, videoUrl);
    return videoUrl;
  })();

  pendingLiveVideoRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (pendingLiveVideoRequests.get(cacheKey) === request) {
      pendingLiveVideoRequests.delete(cacheKey);
    }
  }
}

export function clearLivePhotoVideoCache(): void {
  resolvedLiveVideoCache.clear();
  pendingLiveVideoRequests.clear();
}
