import { beforeEach, describe, expect, it } from 'vitest';
import {
  countSeenNotificationItems,
  clearSeenNotificationState,
  getNotificationSeenKey,
  hasSeenNotificationItems,
  markNotificationItemsSeen,
} from '../notificationSeen';

describe('已读点赞持久化', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('只记录本次确认已读的前 N 条，并能在重启后的列表中识别它们', () => {
    const items = [
      { id: 'newest', likeTime: 3 },
      { id: 'older', likeTime: 2 },
    ];

    expect(markNotificationItemsSeen('100', 'like', items, 1)).toBe(1);
    expect(hasSeenNotificationItems('100', 'like')).toBe(true);
    expect(countSeenNotificationItems('100', 'like', items)).toBe(1);
  });

  it('没有实体 ID 时使用参与者、时间和目标组成稳定标识', () => {
    const item = { fromuid: '200', likeTime: 123, feedId: '456' };
    expect(getNotificationSeenKey(item, 'like')).toBe('like:row:200:123:456');
  });

  it('服务端清除后移除旧通知的数量和实体记录', () => {
    const items = [{ id: 'old-like', likeTime: 3 }];
    markNotificationItemsSeen('100', 'like', items, 1);
    localStorage.setItem('coolapk.notification.seen-count.v1.100.like', '1');

    clearSeenNotificationState('100', 'like');

    expect(hasSeenNotificationItems('100', 'like')).toBe(false);
    expect(localStorage.getItem('coolapk.notification.seen-count.v1.100.like')).toBeNull();
  });
});
