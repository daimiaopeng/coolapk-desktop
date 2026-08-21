type FeedRecord = Record<string, any>;

export interface FeedVideoData {
  url: string;
  poster: string;
  duration: string | number;
  /** APK uses this provider-specific payload before resolving the final URL. */
  requestParams?: string;
}

function firstValue(values: unknown[]): string | number {
  const value = values.find((item) => (typeof item === 'string' && item.trim()) || (typeof item === 'number' && Number.isFinite(item)));
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return value;
  return '';
}

function parseMediaInfo(value: unknown): FeedRecord | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as FeedRecord;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as FeedRecord : undefined;
  } catch {
    return undefined;
  }
}

function normalizeMediaInfoDuration(value: string | number): string | number {
  if (typeof value === 'number') return value / 1000;
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text) / 1000;
  return text;
}

function normalizeVideoUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^http:\/\//i.test(raw)) return `https://${raw.slice('http://'.length)}`;
  if (/^(?:https?:|blob:|data:)/i.test(raw) || raw.startsWith('/')) return raw;
  return '';
}

function selectVideoRequestParams(value: unknown): string {
  const requestParams = parseMediaInfo(value);
  if (!requestParams) return '';

  // The APK normally selects the last provider entry for the current player
  // mode. Keep that ordering so the desktop request matches the APK payload.
  const selected = Object.values(requestParams).at(-1);
  if (typeof selected === 'string') return selected.trim();
  if (selected && typeof selected === 'object' && !Array.isArray(selected)) {
    return JSON.stringify(selected);
  }
  return '';
}

/** 从动态及其视频对象中提取可播放视频，拒绝无法确认协议的值。 */
export function getFeedVideo(feed: unknown): FeedVideoData | null {
  if (!feed || typeof feed !== 'object') return null;
  const record = feed as FeedRecord;
  const video = [record.video, record.videoInfo, record.video_info, record.media]
    .find((item) => item && typeof item === 'object' && !Array.isArray(item)) as FeedRecord | undefined;
  const mediaInfo = parseMediaInfo(record.mediaInfo ?? record.media_info);
  const requestParams = selectVideoRequestParams(mediaInfo?.requestParams ?? mediaInfo?.request_params);
  const localVideoParams = parseMediaInfo(requestParams);
  const localVideoUrl = localVideoParams?.fromType === 'localVideo'
    ? normalizeVideoUrl(localVideoParams['0'])
    : '';
  const directVideoUrl = normalizeVideoUrl(firstValue([
    record.videoUrl,
    record.video_url,
    record.videoURL,
    record.videoSrc,
    record.video_src,
    video?.url,
    video?.videoUrl,
    video?.video_url,
    video?.src,
  ]));
  const mediaType = String(record.mediaType ?? record.media_type ?? mediaInfo?.mediaType ?? '').toLowerCase();
  const feedType = String(record.feedType ?? record.feed_type ?? record.feedTypeName ?? '').toLowerCase();
  const isVideoMedia = mediaType === 'video' || mediaType === '2' || feedType === 'video' || feedType === '视频';
  const mediaUrl = normalizeVideoUrl(firstValue([
    record.mediaUrl,
    record.media_url,
    record.mediaURL,
    mediaInfo?.url,
    mediaInfo?.mediaUrl,
    mediaInfo?.media_url,
  ]));
  const url = localVideoUrl || directVideoUrl || (isVideoMedia ? mediaUrl : '');
  if (!url && !requestParams) return null;
  const playableRequestParams = localVideoUrl ? '' : requestParams;

  const directDuration = firstValue([
    record.videoDuration,
    record.video_duration,
    record.duration,
    video?.duration,
    video?.videoDuration,
    video?.video_duration,
  ]);
  const mediaInfoDuration = firstValue([mediaInfo?.duration]);
  const duration = directDuration || normalizeMediaInfoDuration(mediaInfoDuration);

  return {
    url,
    poster: String(firstValue([
      record.videoPic,
      record.video_pic,
      record.videoCover,
      record.video_cover,
      record.videoThumbnail,
      record.video_thumbnail,
      record.poster,
      record.mediaPic,
      record.media_pic,
      video?.pic,
      video?.cover,
      video?.poster,
      video?.thumbnail,
      mediaInfo?.cover,
      mediaInfo?.pic,
      mediaInfo?.poster,
    ]) || '').trim(),
    duration,
    ...(playableRequestParams ? { requestParams: playableRequestParams } : {}),
  };
}

/** 将秒数格式化为播放器封面上的时长；接口已返回文本时保持原样。 */
export function formatFeedVideoDuration(value: string | number): string {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return '';
    if (text.includes(':')) return text;
    value = Number(text);
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '';
  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
