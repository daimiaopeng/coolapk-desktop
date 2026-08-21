import { describe, it, expect } from 'vitest';
import { hasFeedRenderableContent, isAdFeed, matchesBlockedKeywords, shouldHideFeed } from '../feedFilter';

describe('isAdFeed', () => {
  it('识别 feedType 为 ad 的动态', () => {
    expect(isAdFeed({ feedType: 'ad', message: 'xx' })).toBe(true);
    expect(isAdFeed({ type: 'advert', title: 'xx' })).toBe(true);
  });

  it('识别带广告字段的动态', () => {
    expect(isAdFeed({ advert: true, message: 'xx' })).toBe(true);
    expect(isAdFeed({ isAd: true })).toBe(true);
    expect(isAdFeed({ extra_key: 'ad', message: 'xx' })).toBe(true);
  });

  it('识别广告标题', () => {
    expect(isAdFeed({ title: '[广告] 大促来袭' })).toBe(true);
    expect(isAdFeed({ title: '广告：新品上线' })).toBe(true);
    expect(isAdFeed({ title: '推广：快来参加' })).toBe(true);
  });

  it('普通动态不误判', () => {
    expect(isAdFeed({ feedType: 'feed', message: '今天天气不错' })).toBe(false);
    expect(isAdFeed(null)).toBe(false);
  });
});

describe('matchesBlockedKeywords', () => {
  const keywords = ['抽奖', '比特币'];

  it('正文命中关键词', () => {
    expect(matchesBlockedKeywords({ message: '转发抽奖送手机' }, keywords)).toBe(true);
  });

  it('标题命中关键词', () => {
    expect(matchesBlockedKeywords({ title: '比特币行情分析' }, keywords)).toBe(true);
  });

  it('英文大小写不敏感', () => {
    expect(matchesBlockedKeywords({ message: 'Buy BTC Now' }, ['btc'])).toBe(true);
  });

  it('未命中或空列表返回 false', () => {
    expect(matchesBlockedKeywords({ message: '普通内容' }, keywords)).toBe(false);
    expect(matchesBlockedKeywords({ message: '普通内容' }, [])).toBe(false);
    expect(matchesBlockedKeywords({ message: '普通内容' }, [''])).toBe(false);
  });
});

describe('shouldHideFeed', () => {
  const settings = { hideAdCards: true, blockedKeywords: ['抽奖'] };

  it('广告卡片命中', () => {
    expect(shouldHideFeed({ feedType: 'ad', message: 'xx' }, settings)).toBe(true);
  });

  it('关键词命中', () => {
    expect(shouldHideFeed({ message: '转发抽奖' }, settings)).toBe(true);
  });

  it('普通动态不隐藏', () => {
    expect(shouldHideFeed({ message: '今天写代码' }, settings)).toBe(false);
  });
});

describe('hasFeedRenderableContent', () => {
  it('保留只有视频内容的动态', () => {
    expect(hasFeedRenderableContent({ id: 1, videoUrl: 'https://cdn.example.com/video.mp4' })).toBe(true);
  });

  it('保留只有多关联标的的动态', () => {
    expect(hasFeedRenderableContent({ id: 2, relationRows: [{ id: 20, title: '黑神话：悟空' }] })).toBe(true);
  });

  it('过滤没有任何可渲染内容的空对象', () => {
    expect(hasFeedRenderableContent({ id: 3 })).toBe(false);
  });
});
