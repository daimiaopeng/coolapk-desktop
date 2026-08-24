export type SearchEntity = Record<string, any>;

export interface SearchTabDefinition {
  key: string;
  searchType: string;
  label: string;
  icon?: string;
}

export interface SearchCursor {
  page: number;
  firstItem: string;
  lastItem: string;
  noMore: boolean;
}

export interface SearchTabState {
  items: SearchEntity[];
  loading: boolean;
  loadingMore: boolean;
  error: string;
  cursor: SearchCursor;
  requestVersion: number;
}

// APK 在没有用户自定义 search.tab 配置时使用的协议默认页签。
// 这里固定的是服务端 searchType 协议，不是业务搜索词或搜索结果。
export const DEFAULT_SEARCH_TABS: SearchTabDefinition[] = [
  { key: 'all', searchType: 'all', label: '综合', icon: 'fas fa-layer-group' },
  { key: 'apk', searchType: 'apk', label: '应用', icon: 'fas fa-cube' },
  { key: 'game', searchType: 'game', label: '游戏', icon: 'fas fa-gamepad' },
  { key: 'user', searchType: 'user', label: '用户', icon: 'fas fa-user' },
  { key: 'feed', searchType: 'feed', label: '动态', icon: 'fas fa-align-left' },
  { key: 'ask', searchType: 'ask', label: '问答', icon: 'fas fa-circle-question' },
  { key: 'product', searchType: 'product', label: '数码', icon: 'fas fa-mobile-screen-button' },
  { key: 'feedTopic', searchType: 'feedTopic', label: '话题', icon: 'fas fa-hashtag' },
  { key: 'dyhMix', searchType: 'dyhMix', label: '看看号', icon: 'fas fa-newspaper' },
  { key: 'album', searchType: 'album', label: '应用集', icon: 'fas fa-layer-group' },
  { key: 'ershou', searchType: 'ershou', label: '二手', icon: 'fas fa-shop' },
  { key: 'goods', searchType: 'goods', label: '好物', icon: 'fas fa-bag-shopping' },
  { key: 'goods_list', searchType: 'goods_list', label: '好物榜', icon: 'fas fa-ranking-star' },
];
