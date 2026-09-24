import type { RouteLocationNormalizedLoaded, RouteLocationNormalized } from 'vue-router';

type TabRoute = Pick<RouteLocationNormalizedLoaded, 'fullPath' | 'name' | 'path' | 'params' | 'query'> | Pick<RouteLocationNormalized, 'fullPath' | 'name' | 'path' | 'params' | 'query'>;

export interface PageTabDescriptor {
  id: string;
  route: string;
  title: string;
  icon: string;
  closable: boolean;
}

function decodeRouteText(value: unknown): string {
  const text = Array.isArray(value) ? String(value[0] || '') : String(value || '');
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function firstParam(route: TabRoute): string {
  return Object.values(route.params).map(decodeRouteText).find(Boolean) || '';
}

function allParams(route: TabRoute): string {
  return Object.values(route.params).map(decodeRouteText).filter(Boolean).join(':');
}

function shorten(text: string, maxLength = 28): string {
  const normalized = text.trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

const structuralQueryKeys: Partial<Record<string, string[]>> = {
  My: ['section'],
  Following: ['category'],
  Goods: ['tab'],
  User: ['tab', 'ratingTarget'],
  Product: ['tab'],
  Favorites: ['collectionId'],
  Messages: ['targetUid'],
};

function structuralQuerySuffix(route: TabRoute): string {
  const keys = structuralQueryKeys[String(route.name || '')] || [];
  const values = keys.map((key) => [key, decodeRouteText(route.query[key])] as const).filter(([, value]) => Boolean(value));
  return values.length ? `:${values.map(([key, value]) => `${key}=${value}`).join('&')}` : '';
}

const mySectionTitles: Record<string, string> = {
  my_likes: '我的赞', my_comments: '我的评论', my_feeds: '我的动态', followed_nodes: '关注的论坛', followed_topics: '关注的话题', followed_collections: '关注的收藏单', followed_questions: '关注的问题', followed_products: '关注的数码吧', recent_contacts: '最近联系人', recycle_bin: '内容回收站', hidden_replies: '隐藏的回复', my_devices: '我的设备', my_albums: '我的专辑', my_votes: '我的投票', my_recent: '我的常去',
};

const settingsTitles: Record<string, string> = {
  profile: '个人资料设置', account: '账号设置', notifications: '通知设置', privacy: '隐私设置', content: '内容设置', downloads: '下载设置', appearance: '外观设置', shortcuts: '快捷键设置', startup: '启动设置', device: '设备设置', about: '关于',
};

/**
 * 为路由生成稳定的标签页身份。同一详情实体只保留一个标签；筛选、分页等查询变化更新原标签地址。
 */
export function getPageTabId(route: TabRoute): string {
  if (route.path === '/') return 'home';
  if (route.path.startsWith('/settings')) return `settings:${route.path.split('/').filter(Boolean)[1] || 'appearance'}`;
  if (route.path === '/page') return `page:${decodeRouteText(route.query.url) || route.fullPath}`;
  if (route.path === '/external') return `external:${decodeRouteText(route.query.url) || 'current'}`;
  const params = allParams(route);
  if (params) return `${String(route.name || route.path)}:${params}${structuralQuerySuffix(route)}`;
  return `${String(route.name || route.path)}${structuralQuerySuffix(route)}`;
}

/** 递增当前路由标签的视图代数，让页面内容重新挂载并保留应用外壳。 */
export function refreshPageTabGeneration(tabs: Array<{ id: string; generation: number }>, route: TabRoute): void {
  const tab = tabs.find((item) => item.id === getPageTabId(route));
  if (tab) tab.generation += 1;
}

/** 根据已有路由信息生成无需等待接口的标签标题和图标。 */
export function describePageTab(route: TabRoute): PageTabDescriptor {
  const param = firstParam(route);
  const queryTitle = decodeRouteText(route.query.title);
  const name = String(route.name || '');
  const staticPages: Record<string, [string, string]> = {
    Home: ['首页', 'fas fa-house'], Discover: ['发现', 'fas fa-compass'], Apps: ['应用', 'fas fa-mobile-screen-button'], Games: ['游戏', 'fas fa-gamepad'], Downloads: ['下载', 'fas fa-download'], Topics: ['话题', 'fas fa-hashtag'], Favorites: ['收藏', 'far fa-bookmark'], MyLikes: ['我的赞', 'far fa-thumbs-up'], More: ['更多', 'fas fa-ellipsis'], My: ['我的', 'fas fa-user'], History: ['浏览历史', 'far fa-clock'], Following: ['关注', 'fas fa-user-group'], Reviews: ['点评', 'fas fa-star'], SecondHand: ['闲置', 'fas fa-recycle'], Events: ['活动', 'fas fa-calendar-days'], AnyList: ['酷安清单', 'fas fa-list'], MyDyh: ['我的看看号', 'fas fa-rss'], Center: ['创作中心', 'fas fa-pen'], Goods: ['好物', 'fas fa-bag-shopping'], Digital: ['数码', 'fas fa-laptop'], MyProducts: ['我的产品', 'fas fa-mobile-screen'], ProductCompare: ['产品对比', 'fas fa-code-compare'], Search: ['搜索', 'fas fa-magnifying-glass'], Notifications: ['通知', 'far fa-bell'], Messages: ['私信', 'far fa-comment-dots'], BlackList: ['黑名单', 'fas fa-ban'], Albums: ['专辑', 'fas fa-images'], Pictures: ['图片', 'far fa-image'], Headline: ['头条', 'far fa-newspaper'], LiveDetail: ['直播', 'fas fa-video'], ProductSelector: ['选择产品', 'fas fa-mobile-screen-button'], AnyListCreate: ['新建清单', 'fas fa-plus'], SecondHandBrands: ['闲置品牌', 'fas fa-tags'], SecondHandList: ['闲置列表', 'fas fa-recycle'], AuthCallback: ['登录', 'fas fa-right-to-bracket'], External: ['网页', 'fas fa-globe'],
  };
  let title = staticPages[name]?.[0] || queryTitle || '页面';
  let icon = staticPages[name]?.[1] || 'far fa-file-lines';

  if (name === 'Topic') [title, icon] = [`# ${param || '话题'}`, 'fas fa-hashtag'];
  else if (name === 'FeedDetail') [title, icon] = [`动态 ${param}`, 'far fa-comment-alt'];
  else if (name === 'QuestionDetail') [title, icon] = [`问题 ${param}`, 'far fa-circle-question'];
  else if (name === 'User') [title, icon] = [param === 'me' ? '个人主页' : `用户 ${param}`, 'far fa-user'];
  else if (name === 'UserRelations') [title, icon] = ['用户关系', 'fas fa-user-group'];
  else if (name === 'AppDetail') [title, icon] = [param || '应用详情', 'fas fa-cube'];
  else if (name === 'Product') [title, icon] = [`产品 ${param}`, 'fas fa-mobile-screen-button'];
  else if (name === 'Dyh') [title, icon] = [`看看号 ${param}`, 'fas fa-rss'];
  else if (name === 'AlbumDetail') [title, icon] = [`专辑 ${param}`, 'fas fa-images'];
  else if (name === 'PageDataList') [title, icon] = [queryTitle || '页面', 'fas fa-list-ul'];
  else if (name === 'EventDetail') [title, icon] = [`活动 ${param}`, 'fas fa-calendar-day'];
  else if (name === 'Node') [title, icon] = ['讨论区', 'fas fa-comments'];
  else if (name === 'AnyListDetail') [title, icon] = [`清单 ${param}`, 'fas fa-list'];
  else if (name === 'GoodsListDetail' || name === 'GoodsRankingDetail') [title, icon] = ['好物详情', 'fas fa-bag-shopping'];
  else if (route.path.startsWith('/settings')) [title, icon] = [settingsTitles[route.path.split('/').filter(Boolean)[1] || 'appearance'] || '设置', 'fas fa-gear'];

  const section = decodeRouteText(route.query.section);
  const category = decodeRouteText(route.query.category);
  const tab = decodeRouteText(route.query.tab);
  if (name === 'My' && section && mySectionTitles[section]) title = mySectionTitles[section];
  else if (name === 'Following' && category) title = category === 'users' ? '关注的用户' : category === 'topics' ? '关注的话题' : '关注的动态';
  else if (name === 'Goods' && tab) title = ({ search: '好物搜索', mine: '我的好物', lists: '好物清单', ranking: '好物榜' } as Record<string, string>)[tab] || title;
  else if (name === 'User' && tab) title = `${title} · ${({ home: '主页', feed: '动态', like: '赞过', reply: '回复', rating: '点评', album: '图集', developer_apps: '开发者应用', apk_follow: '关注的应用', discovery: '发现', goods_store: '商品店铺' } as Record<string, string>)[tab] || tab}`;
  else if (name === 'Product' && tab) title = `${title} · ${({ feed: '讨论', answer: '问答', article: '图文', video: '视频', trade: '交易', config: '参数', media: '媒体', rating: '评分' } as Record<string, string>)[tab] || tab}`;
  else if (name === 'Favorites' && decodeRouteText(route.query.collectionId)) title = '收藏单';
  else if (name === 'Messages' && decodeRouteText(route.query.targetUid)) title = '私信会话';

  return { id: getPageTabId(route), route: route.fullPath, title: shorten(title), icon, closable: route.path !== '/' };
}
