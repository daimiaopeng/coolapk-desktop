import type { DiscoveryEntity } from '../types/discovery';
import { getEntityImage } from './discovery';

export type LiveStatus = -1 | 0 | 1;

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value).trim();
    if (text) return text;
  }
  return '';
}

function readValue(entity: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = entity[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function nestedLive(entity: DiscoveryEntity): Record<string, unknown> {
  return asRecord(readValue(entity, ['live', 'liveInfo', 'live_info', 'liveEntity', 'live_entity']));
}

function normalizeLiveStatus(value: unknown): LiveStatus | null {
  const text = asString(value).trim().toLowerCase();
  if (!text) return null;
  const numeric = Number(text);
  if (numeric === -1 || numeric === 0 || numeric === 1) return numeric;
  if (['end', 'ended', 'close', 'closed', 'finish', 'finished', '结束', '已结束'].includes(text)) return -1;
  if (['start', 'started', 'living', 'live', '直播', '直播中'].includes(text)) return 1;
  if (['wait', 'waiting', 'scheduled', 'notstarted', 'not_started', '未开始', '预约'].includes(text)) return 0;
  return null;
}

function flagIsTrue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function numericValue(value: unknown): number | null {
  const text = asString(value).trim().replace(/,/g, '');
  if (!text || !/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function getLiveTemplate(entity: DiscoveryEntity): string {
  return `${asString(entity.entityType)} ${asString(entity.entityTemplate)}`.toLowerCase().trim();
}

export function isLiveEntity(entity: DiscoveryEntity): boolean {
  const type = asString(entity.entityType).toLowerCase().trim();
  const template = asString(entity.entityTemplate).toLowerCase().trim();
  return type === 'live' || type === 'livetopic' || template.includes('livetopic') || template.includes('liveimagetextcard') || template.includes('livelistcard');
}

export function isLiveListCard(entity: DiscoveryEntity): boolean {
  const type = getLiveTemplate(entity);
  return type.includes('livelistcard');
}

export function getLiveId(entity: DiscoveryEntity): string {
  const live = nestedLive(entity);
  return firstString(entity.liveId, entity.live_id, entity.id, entity.entityId, live.liveId, live.live_id, live.id, live.entityId);
}

export function getLiveTitle(entity: DiscoveryEntity): string {
  const live = nestedLive(entity);
  return firstString(entity.title, entity.liveTitle, entity.live_title, live.title, live.liveTitle, live.live_title, entity.name);
}

export function getLiveStatus(entity: DiscoveryEntity): LiveStatus {
  const live = nestedLive(entity);
  const direct = normalizeLiveStatus(readValue(entity, ['liveStatus', 'live_status', 'liveState', 'live_state']));
  const nested = normalizeLiveStatus(readValue(live, ['liveStatus', 'live_status', 'liveState', 'live_state']));
  const fallback = normalizeLiveStatus(readValue(entity, ['status'])) ?? normalizeLiveStatus(readValue(live, ['status']));
  return direct ?? nested ?? fallback ?? 0;
}

export function isLiveFollowed(entity: DiscoveryEntity): boolean {
  const live = nestedLive(entity);
  return flagIsTrue(readValue(entity, ['isFollow', 'is_follow', 'isFollowed', 'is_followed', 'followed', 'following']))
    || flagIsTrue(readValue(live, ['isFollow', 'is_follow', 'isFollowed', 'is_followed', 'followed', 'following']));
}

export function getLiveImage(entity: DiscoveryEntity): string {
  const live = nestedLive(entity);
  return getEntityImage(entity) || getEntityImage(live as DiscoveryEntity);
}

export function formatLiveCount(value: unknown): string {
  const text = asString(value).trim();
  if (!text) return '';
  const number = numericValue(text);
  if (number === null) return text;
  if (number >= 10000) {
    const amount = number / 10000;
    return `${amount.toFixed(amount >= 100 ? 0 : 1).replace(/\.0$/, '')}万`;
  }
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(number);
}

export function getLiveMetricNumber(entity: DiscoveryEntity, status: LiveStatus = getLiveStatus(entity)): number | null {
  const live = nestedLive(entity);
  const keys = status === 0 ? ['followNum', 'follow_num'] : ['visitNum', 'visit_num'];
  return numericValue(readValue(entity, keys)) ?? numericValue(readValue(live, keys));
}

export function getLiveMetric(entity: DiscoveryEntity, status: LiveStatus = getLiveStatus(entity)): string {
  const live = nestedLive(entity);
  const formattedKeys = status === 0 ? ['followNumFormat', 'follow_num_format'] : ['visitNumFormat', 'visit_num_format'];
  const countKeys = status === 0 ? ['followNum', 'follow_num'] : ['visitNum', 'visit_num'];
  const formatted = firstString(readValue(entity, formattedKeys), readValue(live, formattedKeys));
  return formatted || formatLiveCount(readValue(entity, countKeys) ?? readValue(live, countKeys));
}

export function getLiveMetricLabel(status: LiveStatus): string {
  return status === 0 ? '人预约' : '人气';
}

export function getLiveStatusLabel(status: LiveStatus): string {
  return status === -1 ? '已结束' : status === 1 ? '直播中' : '未开始';
}

export function getLiveActionLabel(status: LiveStatus, followed: boolean): string {
  return status === -1 ? '看回放' : status === 1 ? '看直播' : followed ? '已预约' : '预约';
}

export function getLiveDescription(entity: DiscoveryEntity): string {
  const live = nestedLive(entity);
  return firstString(entity.description, entity.message, entity.subTitle, entity.sub_title, live.description, live.message);
}

function getUserName(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const name = getUserName(item);
      if (name) return name;
    }
    return '';
  }
  const user = asRecord(value);
  return firstString(user.displayUsername, user.display_username, user.username, user.userName, user.nickname, user.name);
}

export function getLivePresenterName(entity: DiscoveryEntity): string {
  const live = nestedLive(entity);
  return firstString(entity.presenterName, entity.presenter_name, getUserName(entity.presenterUserInfo), getUserName(entity.presenter_user_info), getUserName(entity.userInfo), getUserName(entity.user_info), getUserName(live.presenterUserInfo), getUserName(live.presenter_user_info), getUserName(live.userInfo), getUserName(live.user_info));
}

export function getLiveShowTime(entity: DiscoveryEntity): string {
  const live = nestedLive(entity);
  const official = firstString(entity.showLiveTime, entity.show_live_time, live.showLiveTime, live.show_live_time);
  if (official) return official;
  const raw = numericValue(readValue(entity, ['liveStartTime', 'live_start_time']) ?? readValue(live, ['liveStartTime', 'live_start_time']));
  if (raw === null || raw <= 0) return '';
  const timestamp = raw < 10000000000 ? raw * 1000 : raw;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function getLiveVideoUrl(entity: DiscoveryEntity): string {
  const live = nestedLive(entity);
  const status = getLiveStatus(entity);
  const keys = status === -1 ? ['videoPlaybackUrl', 'video_playback_url'] : status === 1 ? ['videoLiveUrl', 'video_live_url'] : ['videoLiveUrl', 'video_live_url', 'videoPlaybackUrl', 'video_playback_url'];
  const value = firstString(readValue(entity, keys), readValue(live, keys));
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return '';
}

export function getLiveOpenUrl(entity: DiscoveryEntity): string {
  const id = getLiveId(entity);
  const explicit = firstString(entity.liveUrl, entity.live_url, entity.url, entity.webUrl, entity.web_url);
  if (/^https?:\/\//i.test(explicit)) return explicit;
  const path = explicit.replace(/^#/, '');
  if (/^\/live\/[^/?#]+/i.test(path)) return `https://www.coolapk.com${path}`;
  return id ? `https://www.coolapk.com/live/${encodeURIComponent(id)}` : '';
}
