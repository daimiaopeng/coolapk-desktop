import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useNotificationStore } from '../notifications';

describe('通知状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('同步顶部、侧栏和私信未读数', () => {
    const store = useNotificationStore();
    store.applyServerResponse({
      data: {
        badge: 4,
        commentme: 1,
        feedlike: 2,
        message: 1,
      },
    });

    expect(store.unreadCount).toBe(4);
    expect(store.notificationCount).toBe(3);
    expect(store.messageCount).toBe(1);
  });

  it('查看收到的赞后立即减少对应栏目和总未读数', () => {
    const store = useNotificationStore();
    store.applyServerResponse({ data: { badge: 2, feedlike: 2 } });

    expect(store.markViewed('like')).toBe(true);
    expect(store.categoryCounts.like).toBe(1);
    expect(store.notificationCount).toBe(1);

    // 服务端还没有清零时，本地已查看状态仍然生效。
    store.applyServerResponse({ data: { badge: 2, feedlike: 2 } });
    expect(store.notificationCount).toBe(1);
  });

  it('接口只返回总数时，点击通知也会立即清除红点', () => {
    const store = useNotificationStore();
    store.applyServerResponse({ data: { badge: 1 } });

    expect(store.markViewed('comment')).toBe(true);
    expect(store.notificationCount).toBe(0);

    // 服务端尚未同步时不能把已查看的红点重新显示出来。
    store.applyServerResponse({ data: { badge: 1 } });
    expect(store.notificationCount).toBe(0);

    store.applyServerResponse({ data: { badge: 0 } });
    store.applyServerResponse({ data: { badge: 1 } });
    expect(store.notificationCount).toBe(1);
  });

  it('进入通知中心清除通知红点，但保留私信未读', () => {
    const store = useNotificationStore();
    store.applyServerResponse({
      data: {
        badge: 4,
        commentme: 1,
        feedlike: 2,
        message: 1,
      },
    });

    expect(store.markAllNotificationsViewed()).toBe(3);
    expect(store.notificationCount).toBe(0);
    expect(store.messageCount).toBe(1);
    expect(store.unreadCount).toBe(1);
  });

  it('扣除服务端误报的自己发送私信后，下一轮轮询不会恢复红点', () => {
    const store = useNotificationStore();
    store.applyServerResponse({ data: { badge: 1, message: 1 } });

    expect(store.suppressMessageCount(1)).toBe(1);
    expect(store.messageCount).toBe(0);
    expect(store.unreadCount).toBe(0);

    // 服务端暂时仍返回原来的数量，本地抵消状态继续生效。
    store.applyServerResponse({ data: { badge: 1, message: 1 } });
    expect(store.messageCount).toBe(0);
    expect(store.unreadCount).toBe(0);

    // 服务端真正清零后又出现新的真实私信时，应重新显示。
    store.applyServerResponse({ data: { badge: 0, message: 0 } });
    store.applyServerResponse({ data: { badge: 1, message: 1 } });
    expect(store.messageCount).toBe(1);
    expect(store.unreadCount).toBe(1);
  });
});
