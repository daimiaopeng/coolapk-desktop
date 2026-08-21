import { describe, expect, it } from 'vitest';
import { normalizeCoolapkAppRoute, normalizeCoolapkRoute } from '../coolapkRoute';

describe('酷安应用路由', () => {
  it('将应用详情查询链接转换为桌面端路由', () => {
    expect(normalizeCoolapkAppRoute('/apk/detail?packageName=com.example.app')).toBe('/app/com.example.app');
    expect(normalizeCoolapkAppRoute('/apk/detail?foo=1&packageName=com.example.app')).toBe('/app/com.example.app');
  });

  it('将应用路径和编码后的包名转换为桌面端路由', () => {
    expect(normalizeCoolapkAppRoute('/apk/com.example.app')).toBe('/app/com.example.app');
    expect(normalizeCoolapkAppRoute('/apk/com.example%2Eapp')).toBe('/app/com.example.app');
  });

  it('不把应用列表或非应用链接误判为应用详情', () => {
    expect(normalizeCoolapkAppRoute('/apk/list')).toBeNull();
    expect(normalizeCoolapkAppRoute('/product/123')).toBeNull();
  });
});

describe('酷安站内路由', () => {
  it('统一解析普通、hash 和完整 URL 形式的评价页面', () => {
    const query = 'uid=123&targetType=product&parseRatingToFeed=1';
    expect(normalizeCoolapkRoute(`/feed/nodeRatingList?${query}`)).toBe('/user/123?tab=rating&ratingTarget=digital');
    expect(normalizeCoolapkRoute(`#/feed/nodeRatingList?${query}`)).toBe('/user/123?tab=rating&ratingTarget=digital');
    expect(normalizeCoolapkRoute(`https://www.coolapk.com/#/feed/nodeRatingList?${query}`)).toBe('/user/123?tab=rating&ratingTarget=digital');
  });

  it('将产品评价写入页转换为产品详情路由并保留写入意图', () => {
    const query = 'type=rating&targetType=product&targetId=2967';
    const expected = '/product/2967?tab=rating&mode=writer';
    expect(normalizeCoolapkRoute(`/feed/writer?${query}`)).toBe(expected);
    expect(normalizeCoolapkRoute(`https://www.coolapk.com/feed/writer?${query}`)).toBe(expected);
    expect(normalizeCoolapkRoute(`https://www.coolapk.com/#/feed/writer?${query}`)).toBe(expected);
  });

  it('不会把未知的 feed 页面误判成动态详情', () => {
    expect(normalizeCoolapkRoute('/feed/nodeRatingList?uid=123')).toBeNull();
    expect(normalizeCoolapkRoute('/feed/not-a-feed-id')).toBeNull();
    expect(normalizeCoolapkRoute('/feed/writer?type=rating&targetType=product')).toBeNull();
  });
});
