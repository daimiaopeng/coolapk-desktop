import { describe, expect, it } from 'vitest';
import {
  FEED_SEARCH_SORT_OPTIONS,
  PRODUCT_FEED_TYPE_OPTIONS,
  TOPIC_FEED_TYPE_OPTIONS,
  resolveFeedSearchSort,
} from '../coolapkFeedSearch';

describe('APK 局部动态搜索参数', () => {
  it('把最新和评论排序映射为 APK 参数', () => {
    expect(resolveFeedSearchSort('latest')).toEqual({ sort: 'dateline', isStrict: 0 });
    expect(resolveFeedSearchSort('comment')).toEqual({ sort: 'reply', isStrict: 0 });
  });

  it('精确排序使用 isStrict 而不是 sort=accurate', () => {
    expect(resolveFeedSearchSort('accurate')).toEqual({ sort: '', isStrict: 1 });
  });

  it('话题不包含产品专属的点评和好物类型', () => {
    const topicKeys = TOPIC_FEED_TYPE_OPTIONS.map((option) => option.key);
    const productKeys = PRODUCT_FEED_TYPE_OPTIONS.map((option) => option.key);
    expect(topicKeys).toContain('comment');
    expect(topicKeys).not.toContain('rating');
    expect(topicKeys).not.toContain('goods');
    expect(productKeys).toEqual(expect.arrayContaining(['rating', 'goods', 'comment']));
    expect(FEED_SEARCH_SORT_OPTIONS.map((option) => option.key)).toEqual([
      'default', 'latest', 'hot', 'comment', 'accurate',
    ]);
  });
});
