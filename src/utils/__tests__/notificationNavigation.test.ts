import { describe, expect, it } from 'vitest';
import { getNotificationFeedId, getNotificationTargetRoute } from '../notificationNavigation';

describe('通知目标导航', () => {
  it('不会把机型目标的 id 当成动态 id', () => {
    expect(getNotificationFeedId({ targetRow: { id: 123, entityType: 'product', title: '小米 13 Pro' } })).toBe('');
  });

  it('可以识别明确的动态目标', () => {
    expect(getNotificationFeedId({ targetRow: { id: 456, entityType: 'feed', message: '动态正文' } })).toBe('456');
    expect(getNotificationFeedId({ target_type: 'feed', target_id: 789 })).toBe('789');
  });

  it('将通知中的应用和机型目标转换为对应详情路由', () => {
    expect(getNotificationTargetRoute({ targetRow: { entityType: 'apk', packageName: 'com.example.app' } })).toBe('/app/com.example.app');
    expect(getNotificationTargetRoute({ targetRow: { entityType: 'product', id: 123 } })).toBe('/product/123');
    expect(getNotificationTargetRoute({ targetUrl: '/product/detail?id=456' })).toBe('/product/456');
  });

  it('将评价列表链接转换为用户评分页面并保留筛选类型', () => {
    expect(getNotificationTargetRoute({ targetUrl: '/feed/nodeRatingList?uid=123&targetType=product&parseRatingToFeed=1' })).toBe('/user/123?tab=rating&ratingTarget=digital');
    expect(getNotificationTargetRoute({ targetUrl: '#/feed/nodeRatingList?uid=456&targetType=apk&parseRatingToFeed=1' })).toBe('/user/456?tab=rating&ratingTarget=app');
    expect(getNotificationTargetRoute({ targetUrl: 'https://www.coolapk.com/#/feed/nodeRatingList?uid=789&targetType=all&parseRatingToFeed=1' })).toBe('/user/789?tab=rating&ratingTarget=all');
  });

  it('将产品评价写入通知转换为产品详情页，不当作动态打开', () => {
    expect(getNotificationTargetRoute({ targetUrl: 'https://www.coolapk.com/feed/writer?type=rating&targetType=product&targetId=2967' })).toBe('/product/2967?tab=rating&mode=writer');
  });
});
