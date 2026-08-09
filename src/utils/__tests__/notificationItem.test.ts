import { describe, expect, it } from 'vitest';
import { getNotificationActor } from '../notificationItem';

describe('通知人物信息', () => {
  it('收到赞时显示点赞人，不显示动态作者本人', () => {
    const item = {
      username: '动态作者本人',
      userAvatar: 'self.png',
      likeUsername: '点赞的酷友',
      likeAvatar: 'liker.png',
    };

    expect(getNotificationActor(item, 'like')).toEqual({
      username: '点赞的酷友',
      avatar: 'liker.png',
    });
  });
});
