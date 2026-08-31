import { describe, expect, it } from 'vitest';
import { resolvePreferredHomeTab } from '../homeTabs';
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
