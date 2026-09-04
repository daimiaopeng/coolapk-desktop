import { describe, expect, it } from 'vitest';
import {
  formatLiveCount,
  getLiveActionLabel,
  getLiveImage,
  getLiveMetric,
  getLiveOpenUrl,
  getLiveStatus,
  getLiveStatusLabel,
  isLiveEntity,
  isLiveFollowed,
  isLiveListCard,
} from '../live';

describe('直播实体解析', () => {
  const upcoming = {
    entityType: 'liveTopic',
    id: '12345',
    title: '新品发布会',
    live_status: 0,
    is_follow: 1,
    follow_num: 1234,
    follow_num_format: '1234',
    pic_url: 'https://img.example/live.jpg',
    show_live_time: '今天 20:00',
  };

  it('识别 APK 直播实体并保留官方状态、预约和图片字段', () => {
    expect(isLiveEntity(upcoming)).toBe(true);
    expect(getLiveStatus(upcoming)).toBe(0);
    expect(isLiveFollowed(upcoming)).toBe(true);
    expect(getLiveMetric(upcoming)).toBe('1234');
    expect(getLiveImage(upcoming)).toBe('https://img.example/live.jpg');
  });

  it('识别直播列表卡并按 APK 状态显示文案', () => {
    const list = { entityTemplate: 'liveListCard', cols: 2, entities: [upcoming] };
    expect(isLiveListCard(list)).toBe(true);
    expect(getLiveStatusLabel(-1)).toBe('已结束');
    expect(getLiveStatusLabel(1)).toBe('直播中');
    expect(getLiveActionLabel(0, false)).toBe('预约');
    expect(getLiveActionLabel(0, true)).toBe('已预约');
    expect(getLiveActionLabel(-1, false)).toBe('看回放');
    expect(getLiveActionLabel(1, false)).toBe('看直播');
  });

  it('优先使用官方格式化数值并生成直播详情地址', () => {
    expect(formatLiveCount(10000)).toBe('1万');
    expect(getLiveMetric({ entityType: 'liveTopic', live_status: 1, visit_num_format: '2.3万', visit_num: 23000 })).toBe('2.3万');
    expect(getLiveOpenUrl({ entityType: 'liveTopic', id: '12345' })).toBe('https://www.coolapk.com/live/12345');
    expect(isLiveEntity({ entityType: 'feed', entityTemplate: 'feedCard' })).toBe(false);
  });
});
