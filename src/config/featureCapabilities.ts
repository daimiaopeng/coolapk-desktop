export type CapabilitySupport = 'supported' | 'adapted' | 'not-supported';
export type FeatureSource = 'shared-feature' | 'apk-native' | 'desktop-adapted' | 'not-supported';

export type FeatureCapability = {
  id: string;
  label: string;
  routes: string[];
  actions: string[];
  desktop: CapabilitySupport;
  mobile: CapabilitySupport;
  source: FeatureSource;
  mobileEntry: string;
};

/**
 * The manifest is intentionally route-based: a new desktop capability must
 * declare its Mobile support in the same reviewable file. The current pages
 * keep their shared domain/API actions and are presented inside MobileShell.
 */
export const featureCapabilities: FeatureCapability[] = [
  {
    id: 'home-feed',
    label: '首页与动态流',
    routes: ['/', '/discover', '/headline', '/page'],
    actions: ['load', 'refresh', 'paginate', 'like', 'favorite', 'comment', 'share', 'open-user', 'open-topic'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/feed/MobileFeedPage.vue',
  },
  {
    id: 'feed-detail',
    label: '动态/问题/直播详情',
    routes: ['/feed/:feedId', '/question/:questionId', '/live/:liveId'],
    actions: ['load', 'like', 'favorite', 'comment', 'reply', 'share', 'report'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/feed/MobileFeedPage.vue',
  },
  {
    id: 'search',
    label: '搜索与选择器',
    routes: ['/search', '/product-selector'],
    actions: ['search', 'switch-type', 'open-result', 'remember-query', 'clear-history'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/search-market/MobileSearchPage.vue',
  },
  {
    id: 'user-profile',
    label: '用户与关系',
    routes: ['/user/:uid', '/user/:uid/relations/:relation(follow|fans)'],
    actions: ['open-user', 'follow', 'unfollow', 'view-following', 'view-fans', 'block', 'unblock'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/user-social/MobileUserPage.vue',
  },
  {
    id: 'topics-and-channels',
    label: '话题、论坛与看看号',
    routes: ['/topics', '/topic/:tag', '/node/:nodeType/:nodeId', '/dyh/:dyhId', '/following', '/blacklist'],
    actions: ['open-topic', 'follow', 'unfollow', 'load-feed', 'open-feed'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/community/MobileCommunityPage.vue',
  },
  {
    id: 'collections-and-history',
    label: '收藏、专辑与历史',
    routes: ['/favorites', '/collection/:collectionId', '/history', '/albums', '/album/:albumId', '/pictures', '/my-albums', '/my-likes'],
    actions: ['load', 'paginate', 'open', 'favorite', 'remove', 'export', 'restore-scroll'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/settings-library/MobileLibraryPage.vue',
  },
  {
    id: 'downloads',
    label: '下载中心',
    routes: ['/downloads'],
    actions: ['queue', 'pause', 'resume', 'retry', 'cancel', 'open-file'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/settings-library/MobileDownloadsPage.vue',
  },
  {
    id: 'notifications-and-messages',
    label: '通知与私信',
    routes: ['/notifications', '/messages'],
    actions: ['load', 'mark-read', 'open-target', 'send-message', 'save-draft'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/user-social/MobileMessagePage.vue',
  },
  {
    id: 'marketplace',
    label: '应用、产品与好物',
    routes: ['/app/:packageName', '/product/:productId', '/product-compare', '/goods', '/goods/lists/:feedId', '/goods/ranking/:feedId', '/digital'],
    actions: ['load', 'search', 'compare', 'open-download', 'favorite', 'open-feed'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/search-market/MobileMarketPage.vue',
  },
  {
    id: 'account-and-settings',
    label: '登录、我的空间与设置',
    routes: ['/auth_callback', '/my', '/my-dyh', '/followed-nodes', '/followed-topics', '/recent-contacts', '/recycle-bin', '/hidden-replies', '/my-devices', '/my-votes', '/settings/*'],
    actions: ['login', 'logout', 'edit-profile', 'save-settings', 'change-theme', 'change-device-profile'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/settings-library/MobileSettingsPage.vue',
  },
  {
    id: 'events-and-secondhand',
    label: '活动与闲置',
    routes: ['/events', '/event/:eventId', '/secondhand', '/secondhand/list', '/secondhand/brands', '/reviews'],
    actions: ['load', 'paginate', 'open', 'search', 'follow'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/community/MobileCommunityPage.vue',
  },
  {
    id: 'external-content',
    label: '网页与更新',
    routes: ['/external', '/more', '/center', '/anylist', '/anylist/create', '/anylist/:listId'],
    actions: ['open', 'back', 'open-external', 'create', 'edit', 'delete'],
    desktop: 'supported', mobile: 'adapted', source: 'apk-native', mobileEntry: 'src/mobile/features/MobileUtilityPage.vue',
  },
];

export function getFeatureCapability(id: string): FeatureCapability | undefined {
  return featureCapabilities.find((feature) => feature.id === id);
}
