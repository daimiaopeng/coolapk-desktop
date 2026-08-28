import { describe, expect, it } from 'vitest';
import {
  getMessageSenderUid,
  getMessageUnreadCount,
  getRawMessageUnreadCount,
  getSelfMessageUnreadCount,
  isMessageSentByCurrentUser,
} from '../messageUnread';

describe('私信未读方向判断', () => {
  it('按 fromuid 判断发送者，不把自己的消息计为未读', () => {
    const ownMessage = { uid: '200', fromuid: '100', unreadNum: 1, isnew: 1 };
    const incomingMessage = { uid: '100', fromuid: '200', unreadNum: 1, isnew: 1 };

    expect(getMessageSenderUid(ownMessage)).toBe('100');
    expect(isMessageSentByCurrentUser(ownMessage, '100')).toBe(true);
    expect(getMessageUnreadCount(ownMessage, '100')).toBe(0);
    expect(getMessageUnreadCount(incomingMessage, '100')).toBe(1);
  });

  it('兼容不同接口的未读字段和发送者字段', () => {
    expect(getMessageUnreadCount({ fromUid: 100, unread_num: 3 }, 100)).toBe(0);
    expect(getMessageUnreadCount({ sender_uid: 200, unread_count: 2 }, 100)).toBe(2);
    expect(getRawMessageUnreadCount({ isNew: true })).toBe(1);
  });

  it('发送者未知时不擅自清除服务端未读', () => {
    expect(getMessageUnreadCount({ unreadNum: 1 }, '100')).toBe(1);
    expect(getSelfMessageUnreadCount([
      { fromuid: '100', unreadNum: 2 },
      { fromuid: '200', unreadNum: 1 },
    ], '100')).toBe(2);
  });
});
