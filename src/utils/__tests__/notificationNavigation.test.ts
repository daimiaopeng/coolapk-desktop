import { describe, expect, it } from 'vitest';
import { getNotificationExternalUrl, getNotificationFeedId, getNotificationProductName, getNotificationTargetRoute, resolveNotificationTargetRoute } from '../notificationNavigation';

describe('通知目标导航', () => {
  it('不会把机型目标的 id 当成动态 id', () => {
    expect(getNotificationFeedId({ targetRow: { id: 123, entityType: 'product', title: '小米 13 Pro' } })).toBe('');
  });

  it('可以识别明确的动态目标', () => {
    expect(getNotificationFeedId({ targetRow: { id: 456, entityType: 'feed', message: '动态正文' } })).toBe('456');
    expect(getNotificationFeedId({ target_type: 'feed', target_id: 789 })).toBe('789');
  });

  it('优先使用通知正文中的原始动态链接，不把评论记录 id 当成动态 id', () => {
    expect(getNotificationFeedId({
      id: 111,
      feedInfo: { id: 222, entityType: 'reply', message: '评论记录' },
      note: '<a href="/feed/333">查看原动态</a>',
    })).toBe('333');
  });

  it('没有动态链接时不会使用未标记类型的 feedInfo 通用 id', () => {
    expect(getNotificationFeedId({
      feedInfo: { id: 222, message: '评论记录' },
    })).toBe('');
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

  it('将“点击点评”的普通产品通知转换为产品评分 Tab', () => {
    expect(getNotificationTargetRoute({
      targetUrl: '/product/2967',
      note: '邀请你来点评打分：点击点评',
    })).toBe('/product/2967?tab=rating');
  });

  it('产品目标没有 URL 时也能根据点评通知进入评分 Tab', () => {
    expect(getNotificationTargetRoute({
      targetRow: { entityType: 'product', id: 2967 },
      message: '邀请你来点评打分',
    })).toBe('/product/2967?tab=rating');
  });

  it('点评邀请优先使用产品目标，不被正文中的用户链接覆盖', () => {
    expect(getNotificationTargetRoute({
      targetType: 'product',
      targetId: 2967,
      targetUrl: '/u/123456',
      note: '<a href="/u/123456">点击点评</a>',
    })).toBe('/product/2967?tab=rating');
  });

  it('识别酷安原生产品点评目标类型 7，不跳转到通知里的用户页', () => {
    expect(getNotificationTargetRoute({
      target_type: '7',
      target_id: '2967',
      url: '/u/123456',
      note: '<a href="/u/123456">点击点评</a>',
    })).toBe('/product/2967?tab=rating');
  });

  it('可以从点评邀请正文提取产品名称', () => {
    expect(getNotificationProductName({
      note: '亲爱的 Redmi K70 机主，真诚邀请您来点评打分：点击点评',
    })).toBe('Redmi K70');
  });

  it('产品目标缺失时通过真实产品详情接口结果进入评分 Tab', async () => {
    await expect(resolveNotificationTargetRoute(
      { url: '/u/123456', note: '亲爱的 Redmi K70 机主，邀请您来点评打分：点击点评' },
      async (name) => ({ data: { id: name === 'Redmi K70' ? 2967 : 0 } }),
    )).resolves.toBe('/product/2967?tab=rating');
  });

  it('保留明确的用户评分列表入口', () => {
    expect(getNotificationTargetRoute({
      targetUrl: '/feed/nodeRatingList?uid=123&targetType=product&parseRatingToFeed=1',
      note: '查看用户评分',
    })).toBe('/user/123?tab=rating&ratingTarget=digital');
  });

  it('不会把系统安全通知中的任意用户链接误判成用户资料页', () => {
    expect(getNotificationTargetRoute({
      targetUrl: '/u/123456',
      note: '您的账号在陌生设备尝试手机验证码登录，请注意账号安全：点击查看',
    })).toBeNull();
  });

  it('将系统安全通知转到官方账号设置页', () => {
    expect(getNotificationExternalUrl({
      targetUrl: '/u/123456',
      note: '您的账号在陌生设备尝试手机验证码登录，请注意账号安全：点击查看',
    })).toBe('https://account.coolapk.com/account/settings');
  });
});
