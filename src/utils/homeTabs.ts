import type { ConfigPageTab, HomeTabKey } from '../types/settings';

export function getHomeTabKey(tab: ConfigPageTab): string {
  return tab.page_name || tab.url || String(tab.id || tab.title);
}

function includesAny(value: string, candidates: readonly string[]): boolean {
  const normalized = value.toLowerCase();
  return candidates.some((candidate) => normalized.includes(candidate));
}

export function matchesHomeTabPreference(tab: ConfigPageTab, preferred: HomeTabKey): boolean {
  const pageName = String(tab.page_name || '').toLowerCase();
  const url = String(tab.url || '').toLowerCase();
  const title = String(tab.title || '').trim().toLowerCase();

  switch (preferred) {
    case 'index_v8':
      return title === '推荐'
        || includesAny(pageName, ['index', 'recommend'])
        || includesAny(url, ['/main/index', 'index_v8', 'recommend']);
    case 'digest':
      return title === '头条' || pageName === 'v9_home_tab_headline' || url === '/main/headline';
    case 'hot':
      return title === '热榜' || includesAny(pageName, ['ranking']) || includesAny(url, ['ranking']);
    case 'latest':
      return title === '快讯' || includesAny(pageName, ['news']) || includesAny(url, ['news']);
    case 'cool_picture':
    case 'pictures':
      return title === '酷图'
        || title === '图片'
        || includesAny(pageName, ['coolpic', 'cool_picture', 'picture'])
        || includesAny(url, ['coolpic', 'cool_picture', '/pictures']);
    case 'secondhand':
      return title.includes('二手')
        || includesAny(pageName, ['secondhand', 'ershou'])
        || includesAny(url, ['secondhand', 'ershou']);
    case 'dyh':
      return title === '看看号'
        || includesAny(pageName, ['dyh'])
        || includesAny(url, ['dyhsubscribe', '/dyh/']);
    default:
      return false;
  }
}

export function resolvePreferredHomeTab(tabs: ConfigPageTab[], preferred: HomeTabKey): string {
  const exact = tabs.find((tab) => getHomeTabKey(tab) === preferred);
  if (exact) return getHomeTabKey(exact);

  const semantic = tabs.find((tab) => matchesHomeTabPreference(tab, preferred));
  if (semantic) return getHomeTabKey(semantic);

  return tabs[0] ? getHomeTabKey(tabs[0]) : 'V9_HOME_TAB_HEADLINE';
}
