import { describe, expect, it } from 'vitest';
import { getHomeSubChannelGroupTitle, getHomeSubChannels, isFollowingHomeTab, resolvePreferredHomeTab } from '../homeTabs';
import type { ConfigPageTab } from '../../types/settings';

const tabs: ConfigPageTab[] = [
  { title: '头条', page_name: 'V9_HOME_TAB_HEADLINE', url: '/main/headline' },
  { title: '热榜', page_name: 'V9_HOME_TAB_RANKING', url: '/page?name=RANKING' },
  { title: '快讯', page_name: 'V11_HOME_TAB_NEWS', url: '/page?name=NEWS' },
  { title: '酷图', page_name: 'V11_HOME_TAB_COOLPIC', url: '/feeds/cool_picture' },
  { title: '二手市场', page_name: 'V11_HOME_TAB_ERSHOU', url: '/feeds/secondhand' },
  { title: '看看号', page_name: 'dyh', url: '/user/dyhSubscribe' },
];

describe('首页默认频道解析', () => {
  it('识别 APK 首页的关注动态栏目', () => {
    expect(isFollowingHomeTab({ title: '关注', page_name: 'V9_HOME_TAB_FOLLOW', url: '/user/followFeedList' })).toBe(true);
    expect(isFollowingHomeTab({ title: '其他', page_name: 'V9_HOME_TAB_FOLLOW', url: '/page?url=followFeedList' })).toBe(true);
    expect(isFollowingHomeTab({ title: '头条', page_name: 'V9_HOME_TAB_HEADLINE', url: '/main/headline' })).toBe(false);
  });

  it('读取服务端关注分组的子栏目和请求参数', () => {
    const followTab: ConfigPageTab = {
      title: '关注',
      page_name: 'V9_HOME_TAB_FOLLOW',
      url: 'V9_HOME_TAB_FOLLOW',
      entities: [
        { title: '关注分组', url: '' },
        { title: '全部关注', url: 'V9_HOME_TAB_FOLLOW' },
        { title: '话题关注', url: 'V9_HOME_TAB_FOLLOW', requestParams: { type: 'topic' } },
        { title: '数码关注', url: 'V9_HOME_TAB_FOLLOW?type=product' },
      ],
    };
    const channels = getHomeSubChannels(followTab);
    expect(getHomeSubChannelGroupTitle(followTab)).toBe('关注分组');
    expect(channels.map((item) => item.title)).toEqual(['全部关注', '话题关注', '数码关注']);
    expect(channels[1]?.requestArgs).toEqual({ type: 'topic' });
    expect(channels[2]?.requestArgs).toEqual({ type: 'product' });
  });

  it('服务端未下发子栏目时按 APK 关注 type 维度动态生成分组', () => {
    const followTab: ConfigPageTab = { title: '关注', page_name: 'V15_HOME_TAB_FOLLOW', url: '/page?url=V15_HOME_TAB_FOLLOW' };
    const channels = getHomeSubChannels(followTab);
    expect(getHomeSubChannelGroupTitle(followTab)).toBe('关注分组');
    expect(channels.map((item) => item.title)).toEqual(['全部关注', '好友关注', '应用关注', '话题关注', '最近常去', '数码关注']);
    expect(channels[0]?.requestArgs).toEqual({});
    expect(channels[1]?.requestArgs).toEqual({ type: 'circle' });
    expect(channels[4]?.requestArgs).toEqual({ type: 'recent' });
    expect(channels[5]?.requestArgs).toEqual({ type: 'product' });
  });

  it('把旧设置值映射到服务端动态频道', () => {
    expect(resolvePreferredHomeTab(tabs, 'digest')).toBe('V9_HOME_TAB_HEADLINE');
    expect(resolvePreferredHomeTab(tabs, 'hot')).toBe('V9_HOME_TAB_RANKING');
    expect(resolvePreferredHomeTab(tabs, 'latest')).toBe('V11_HOME_TAB_NEWS');
    expect(resolvePreferredHomeTab(tabs, 'cool_picture')).toBe('V11_HOME_TAB_COOLPIC');
    expect(resolvePreferredHomeTab(tabs, 'secondhand')).toBe('V11_HOME_TAB_ERSHOU');
    expect(resolvePreferredHomeTab(tabs, 'dyh')).toBe('dyh');
  });

  it('优先使用服务端频道键并在无匹配时回退第一个频道', () => {
    expect(resolvePreferredHomeTab(tabs, 'V11_HOME_TAB_NEWS')).toBe('V11_HOME_TAB_NEWS');
    expect(resolvePreferredHomeTab(tabs, 'unknown')).toBe('V9_HOME_TAB_HEADLINE');
  });
});
