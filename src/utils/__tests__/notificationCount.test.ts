import { describe, expect, it } from 'vitest';
import {
  hasNotificationCountIncreased,
  normalizeNotificationCount,
  normalizeNotificationCounts,
  reconcileViewedCount,
} from '../notificationCount';

describe('通知未读数', () => {
  it('读取直接总数与分类计数对象', () => {
    expect(normalizeNotificationCount({ data: { count: 6, feedLike: 2 } })).toBe(6);
    expect(normalizeNotificationCount({
      data: {
        atMe: 1,
        atCommentMe: 2,
        feedLike: 3,
        contactsFollow: 1,
      },
    })).toBe(7);
  });

  it('读取酷安现行字段中的总数和各栏目数量', () => {
    expect(normalizeNotificationCounts({
      data: {
        badge: 9,
        commentme: 1,
        atme: 2,
        atcommentme: 1,
        feedlike: 3,
        contacts_follow: 1,
        message: 1,
      },
    })).toEqual({
      total: 9,
      categories: {
        comment: 1,
        atMe: 2,
        atComment: 1,
        like: 3,
        follow: 1,
        message: 1,
      },
    });
  });

  it('首次加载不提醒，但从零增加到一会提醒', () => {
    expect(hasNotificationCountIncreased(null, 1)).toBe(false);
    expect(hasNotificationCountIncreased(0, 1)).toBe(true);
    expect(hasNotificationCountIncreased(1, 1)).toBe(false);
  });

  it('本地查看后立即扣减，服务端随后清零时不会重复扣减', () => {
    expect(reconcileViewedCount(2, 2, 1)).toEqual({
      count: 1,
      locallyViewedCount: 1,
    });
    expect(reconcileViewedCount(2, 1, 1)).toEqual({
      count: 1,
      locallyViewedCount: 0,
    });
  });
});
