import { describe, expect, it } from 'vitest';
import {
  extractFeedInteractionRows,
  formatFeedInteractionDate,
  getFeedInteractionKey,
  hasMoreFeedInteractions,
  normalizeFeedInteractionRow,
} from '../feedInteractions';

describe('动态互动列表归一化', () => {
  it('保留纯用户点赞行和嵌套用户字段', () => {
    const rows = extractFeedInteractionRows({
      code: 200,
      data: [
        { id: '10086', username: '点赞用户', avatar: 'https://image.coolapk.com/avatar.jpg' },
        { userInfo: { uid: '20014', username: '嵌套用户', userAvatar: 'https://image.coolapk.com/avatar2.jpg' } },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: '10086', uid: '10086', username: '点赞用户' });
    expect(rows[1]).toMatchObject({ uid: '20014', username: '嵌套用户', avatar: 'https://image.coolapk.com/avatar2.jpg' });
  });

  it('保留转发附言并支持多层列表包装', () => {
    const rows = extractFeedInteractionRows({
      data: { entities: [{ uid: '10086', username: '转发用户', message: '我的看法' }] },
    });

    expect(rows[0]).toMatchObject({ uid: '10086', message: '我的看法' });
  });

  it('支持稳定去重键和分页判断', () => {
    const row = normalizeFeedInteractionRow({ uid: '10086', username: '点赞用户' }, 0);

    expect(row).not.toBeNull();
    expect(getFeedInteractionKey(row!)).toBe('id:10086');
    expect(hasMoreFeedInteractions({ data: [] }, 20)).toBe(true);
    expect(hasMoreFeedInteractions({ data: { hasMore: false } }, 20)).toBe(false);
  });

  it('按服务端时间戳显示相对时间', () => {
    expect(formatFeedInteractionDate(1_700_000_000, 1_700_000_060)).toBe('1分钟前');
    expect(formatFeedInteractionDate('刚刚', 1_700_000_060)).toBe('刚刚');
  });
});
