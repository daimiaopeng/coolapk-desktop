import { describe, expect, it } from 'vitest';
import { normalizeCoolapkAppRoute, normalizeCoolapkDeepLink, normalizeCoolapkFeedLink, normalizeCoolapkPageRoute, normalizeCoolapkRoute } from '../coolapkRoute';

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
  it('只把酷安动态详情链接识别为可直达动态', () => {
    expect(normalizeCoolapkFeedLink('https://www.coolapk.com/#/feed/73789197?rid=12')).toBe('/feed/73789197?rid=12');
    expect(normalizeCoolapkFeedLink('coolmarket://m.coolapk.com/feed/73789197')).toBe('/feed/73789197');
    expect(normalizeCoolapkFeedLink('https://www.coolapk.com/topic/Android')).toBeNull();
    expect(normalizeCoolapkFeedLink('https://example.com/feed/73789197')).toBeNull();
  });

  it('将网页生成的 coolmarket 动态深链转换为桌面端路由并保留查询参数', () => {
    expect(normalizeCoolapkDeepLink('coolmarket://www.coolapk.com/feed/73789197?s=share-token')).toBe('/feed/73789197?s=share-token');
    expect(normalizeCoolapkDeepLink('coolmarket://m.coolapk.com/#/feed/73789197?rid=12')).toBe('/feed/73789197?rid=12');
    expect(normalizeCoolapkDeepLink('coolmarket://com.coolapk.market/feed/73789197?s=share-token')).toBe('/feed/73789197?s=share-token');
  });

  it('拒绝非酷安主机或不支持的深链路径', () => {
    expect(normalizeCoolapkDeepLink('coolmarket://evil.example/feed/73789197')).toBeNull();
    expect(normalizeCoolapkDeepLink('coolmarket://www.coolapk.com/search?q=手机')).toBeNull();
  });

  it('将服务端动态列表页转换为桌面端列表路由', () => {
    expect(normalizeCoolapkPageRoute('/page?url=V8_JINRI_NEWPHONE666')).toBe('/page?url=V8_JINRI_NEWPHONE666');
    expect(normalizeCoolapkRoute('/page?url=%2Fproduct%2FfeedList')).toBe('/page?url=%2Fproduct%2FfeedList');
  });

  it('将 APK 闲置型号列表入口转换为桌面端闲置列表页', () => {
    const target = '#/feed/ershouList?brand=1&productId=2&cityId=&ershouType=3&dataListType=staggered';
    const expected = '/secondhand/list?brand=1&productId=2&cityId=&ershouType=3&dataListType=staggered';
    expect(normalizeCoolapkRoute(target)).toBe(expected);
    expect(normalizeCoolapkRoute(`https://www.coolapk.com/${target}`)).toBe(expected);
  });

  it('将酷安直播详情链接转换为桌面端直播详情页', () => {
    expect(normalizeCoolapkRoute('/live/12345')).toBe('/live/12345');
    expect(normalizeCoolapkRoute('https://www.coolapk.com/live/12345')).toBe('/live/12345');
    expect(normalizeCoolapkRoute('/live/detail?id=12345')).toBe('/live/12345');
  });

  it('将动态里的话题入口转换为话题页，而不是通用头条页', () => {
    expect(normalizeCoolapkRoute('/feed/multiTagFeedList?tag=Android%2016')).toBe('/topic/Android%2016');
    expect(normalizeCoolapkRoute('/topic/tagFeedList?title=桌面改造')).toBe('/topic/%E6%A1%8C%E9%9D%A2%E6%94%B9%E9%80%A0');
    expect(normalizeCoolapkRoute('/page?url=%2Ftopic%2FtagFeedList%3Ftitle%3D桌面改造')).toBe('/topic/%E6%A1%8C%E9%9D%A2%E6%94%B9%E9%80%A0');
  });

  it('将 APK 的 tagList 入口转换为话题发现列表，而不是名为 tagList 的空话题', () => {
    const target = '/topic/tagList?withSymbol=0&keywords=种草&cacheExpires=300&title=讨论区';
    const expected = '/page?url=%2Ftopic%2FtagList%3FwithSymbol%3D0%26keywords%3D%E7%A7%8D%E8%8D%89%26cacheExpires%3D300%26title%3D%E8%AE%A8%E8%AE%BA%E5%8C%BA&title=%E8%AE%A8%E8%AE%BA%E5%8C%BA&renderer=discovery';
    expect(normalizeCoolapkRoute(target)).toBe(expected);
    expect(normalizeCoolapkRoute(`#${target}`)).toBe(expected);
    expect(normalizeCoolapkRoute(`#/page?url=${encodeURIComponent(target)}`)).toBe(expected);
  });

  it('将酷安机型搜索链接转换为原生机型列表页', () => {
    expect(normalizeCoolapkRoute('https://m.coolapk.com/mp/productSelector/configSearch?&callFunction=indexSearch'))
      .toBe('/product-selector?&callFunction=indexSearch');
  });

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

  it('保留产品入口的评分 Tab 参数', () => {
    expect(normalizeCoolapkRoute('/product/456?tab=rating')).toBe('/product/456?tab=rating');
  });

  it('不把系统通知的 /u/0 当成普通用户页', () => {
    expect(normalizeCoolapkRoute('/u/0')).toBeNull();
  });

  it('不把用户名当成用户 UID 拼成本地用户页', () => {
    expect(normalizeCoolapkRoute('/u/好事儿')).toBeNull();
    expect(normalizeCoolapkRoute('/u/123456')).toBe('/user/123456');
  });

  it('不会把未知的 feed 页面误判成动态详情', () => {
    expect(normalizeCoolapkRoute('/feed/nodeRatingList?uid=123')).toBeNull();
    expect(normalizeCoolapkRoute('/feed/not-a-feed-id')).toBeNull();
    expect(normalizeCoolapkRoute('/feed/writer?type=rating&targetType=product')).toBeNull();
  });
});
