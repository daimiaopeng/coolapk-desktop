import { beforeEach, describe, expect, it } from 'vitest';
import {
  countSeenNotificationItems,
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
});
