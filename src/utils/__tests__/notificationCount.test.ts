import { describe, expect, it } from 'vitest';
import {
  getNotificationCategoryCountFromItems,
  getNotificationCategoryCountsFromItems,
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
      categoryPresence: {
        comment: true,
        atMe: true,
        atComment: true,
        like: true,
        follow: true,
        message: true,
      },
    });
  });

  it('兼容 v18 接口的总角标字段，同时保留 feedlike 的收到的赞分类数', () => {
    expect(normalizeNotificationCounts({
      data: {
        badge: 0,
        badge_v18: 7,
        notification_v18: 4,
        feedlike: 1,
      },
    })).toEqual({
      total: 7,
      categories: {
        comment: 0,
        atMe: 0,
        atComment: 0,
        like: 1,
        follow: 0,
        message: 0,
      },
      categoryPresence: {
        comment: false,
        atMe: false,
        atComment: false,
        like: true,
        follow: false,
        message: false,
      },
    });
  });

  it('没有 badge_v18 时不会把 notification_v18 当成总数而漏算 feedlike', () => {
    expect(normalizeNotificationCount({
      data: {
        notification_v18: 4,
        feedlike: 1,
      },
    })).toBe(5);
  });

  it('从通知列表项的 notifyCount 恢复分类数字，不重复累加每一条列表项', () => {
    const items = [
      { id: 1, notifyCount: { commentme: 2, feedlike: 3 } },
      { id: 2, notifyCount: { commentme: 2, feedlike: 3 } },
    ];

    expect(getNotificationCategoryCountsFromItems(items)).toEqual({
      comment: 2,
      like: 3,
    });
    expect(getNotificationCategoryCountFromItems(items, 'like')).toBe(3);
  });

  it('只有明确的 isnew 或 unread_count 时才从列表项推断分类未读数', () => {
    expect(getNotificationCategoryCountFromItems([
      { id: 1, isnew: 1 },
      { id: 2, isnew: 0 },
    ], 'like')).toBe(1);
    expect(getNotificationCategoryCountFromItems([{ id: 1 }], 'like')).toBeNull();
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
    expect(reconcileViewedCount(1, 0, 1, 0)).toEqual({
      count: 0,
      locallyViewedCount: 1,
    });
  });
});
