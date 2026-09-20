import { describe, expect, it } from 'vitest';
import { isRatingFeedEntity } from '../rating';

describe('点评动态识别', () => {
  it('识别 APK 的 rating feedType', () => {
    expect(isRatingFeedEntity({ feedType: 'rating', message: '点评正文' })).toBe(true);
  });

  it('识别清洗后的点评字段', () => {
    expect(isRatingFeedEntity({ ratingScore: 8, ratingItemInfo: [{ name: '续航', star: 4 }] })).toBe(true);
    expect(isRatingFeedEntity({ v4RatingMessage: '{"性能":"很好"}' })).toBe(true);
  });

  it('不把普通动态误判为点评', () => {
    expect(isRatingFeedEntity({ feedType: 'feed', title: '普通动态', message: '正文' })).toBe(false);
  });
});
