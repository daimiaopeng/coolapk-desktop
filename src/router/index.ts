import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import SearchPage from '../pages/SearchPage.vue';
import NotificationsPage from '../pages/NotificationsPage.vue';
import MessagesPage from '../pages/MessagesPage.vue';
import DiscoverPage from '../pages/DiscoverPage.vue';
import AppsPage from '../pages/AppsPage.vue';
import GamesPage from '../pages/GamesPage.vue';
import FavoritesPage from '../pages/FavoritesPage.vue';
import MyLikesPage from '../pages/MyLikesPage.vue';
import MoreWorkspacePage from '../pages/MoreWorkspacePage.vue';
import MoreDataPage from '../pages/MoreDataPage.vue';
import MyAlbumsPage from '../pages/MyAlbumsPage.vue';
import HistoryPage from '../pages/HistoryPage.vue';
import FollowingPage from '../pages/FollowingPage.vue';
import UserPage from '../pages/UserPage.vue';
import UserRelationsPage from '../pages/UserRelationsPage.vue';
import FeedDetailPage from '../pages/FeedDetailPage.vue';
import LiveDetailPage from '../pages/LiveDetailPage.vue';
import BlackListPage from '../pages/BlackListPage.vue';
import TopicPage from '../pages/TopicPage.vue';
import TopicsHubPage from '../pages/TopicsHubPage.vue';
import AppDetailPage from '../pages/AppDetailPage.vue';
import ProductPage from '../pages/ProductPage.vue';
import DyhPage from '../pages/DyhPage.vue';
import AlbumPage from '../pages/AlbumPage.vue';
import AlbumsPage from '../pages/AlbumsPage.vue';
import PicturesPage from '../pages/PicturesPage.vue';
import HeadlinePage from '../pages/HeadlinePage.vue';
import PageDataListPage from '../pages/PageDataListPage.vue';
import ReviewPage from '../pages/ReviewPage.vue';
import SecondHandPage from '../pages/SecondHandPage.vue';
import EventsPage from '../pages/EventsPage.vue';
import EventDetailPage from '../pages/EventDetailPage.vue';
import NodePage from '../pages/NodePage.vue';
import AnyListPage from '../pages/AnyListPage.vue';
import AnyListDetailPage from '../pages/AnyListDetailPage.vue';
import AnyListCreatePage from '../pages/AnyListCreatePage.vue';
import MyDyhPage from '../pages/MyDyhPage.vue';
import CenterPage from '../pages/CenterPage.vue';
import ExternalPage from '../pages/ExternalPage.vue';
import ProductSelectorPage from '../pages/ProductSelectorPage.vue';
import GoodsPage from '../pages/GoodsPage.vue';
import GoodsListDetailPage from '../pages/GoodsListDetailPage.vue';
import GoodsRankingDetailPage from '../pages/GoodsRankingDetailPage.vue';
import DigitalPage from '../pages/DigitalPage.vue';
import MyProductsPage from '../pages/MyProductsPage.vue';
import ProductComparePage from '../pages/ProductComparePage.vue';
import MorePage from '../pages/MorePage.vue';
import SettingsLayout from '../pages/settings/SettingsLayout.vue';
import ProfileSettingsPage from '../pages/settings/ProfileSettingsPage.vue';
import AccountSettingsPage from '../pages/settings/AccountSettingsPage.vue';
import NotificationSettingsPage from '../pages/settings/NotificationSettingsPage.vue';
import PrivacySettingsPage from '../pages/settings/PrivacySettingsPage.vue';
import ContentSettingsPage from '../pages/settings/ContentSettingsPage.vue';
import DownloadSettingsPage from '../pages/settings/DownloadSettingsPage.vue';
import AppearanceSettingsPage from '../pages/settings/AppearanceSettingsPage.vue';
import ShortcutSettingsPage from '../pages/settings/ShortcutSettingsPage.vue';
import AboutSettingsPage from '../pages/settings/AboutSettingsPage.vue';
import StartupSettingsPage from '../pages/settings/StartupSettingsPage.vue';
import DeviceSettingsPage from '../pages/settings/DeviceSettingsPage.vue';
import { restoreRouteScrollPosition, saveRouteScrollPosition } from '../utils/routeScroll';

import AuthCallbackView from '../pages/AuthCallbackView.vue';

const routes = [
  { path: '/', name: 'Home', component: HomePage },
  { path: '/auth_callback', name: 'AuthCallback', component: AuthCallbackView },
  { path: '/feeds', name: 'Feeds', redirect: '/' },
  { path: '/discover', name: 'Discover', component: DiscoverPage },
  { path: '/apps', name: 'Apps', component: AppsPage },
  { path: '/games', name: 'Games', component: GamesPage },
  { path: '/topics', name: 'Topics', component: TopicsHubPage },
  { path: '/favorites', name: 'Favorites', component: FavoritesPage },
  { path: '/my-likes', name: 'MyLikes', component: MyLikesPage },
  { path: '/more', name: 'More', component: MorePage },
  { path: '/my', name: 'My', component: MoreWorkspacePage },
  { path: '/followed-nodes', name: 'FollowedNodes', component: MoreDataPage, meta: { mode: 'nodes' } },
  { path: '/followed-topics', name: 'FollowedTopics', component: MoreDataPage, meta: { mode: 'topics' } },
  { path: '/recent-contacts', name: 'RecentContacts', component: MoreDataPage, meta: { mode: 'contacts' } },
  { path: '/recycle-bin', name: 'RecycleBin', component: MoreDataPage, meta: { mode: 'recycle' } },
  { path: '/hidden-replies', name: 'HiddenReplies', component: MoreDataPage, meta: { mode: 'hidden' } },
  { path: '/my-devices', name: 'MyDevices', component: MoreDataPage, meta: { mode: 'devices' } },
  { path: '/my-albums', name: 'MyAlbums', component: MyAlbumsPage },
  { path: '/my-votes', name: 'MyVotes', component: MoreDataPage, meta: { mode: 'votes' } },
  { path: '/history', name: 'History', component: HistoryPage },
  { path: '/following', name: 'Following', component: FollowingPage },
  { path: '/reviews', name: 'Reviews', component: ReviewPage },
  { path: '/secondhand', name: 'SecondHand', component: SecondHandPage },
  { path: '/events', name: 'Events', component: EventsPage },
  { path: '/event/:eventId', name: 'EventDetail', component: EventDetailPage, props: true },
  { path: '/node/:nodeType/:nodeId', name: 'Node', component: NodePage },
  { path: '/anylist', name: 'AnyList', component: AnyListPage },
  { path: '/anylist/create', name: 'AnyListCreate', component: AnyListCreatePage },
  { path: '/anylist/:listId', name: 'AnyListDetail', component: AnyListDetailPage, props: true },
  { path: '/my-dyh', name: 'MyDyh', component: MyDyhPage },
  { path: '/center', name: 'Center', component: CenterPage },
  { path: '/external', name: 'External', component: ExternalPage },
  { path: '/product-selector', name: 'ProductSelector', component: ProductSelectorPage },
  { path: '/goods', name: 'Goods', component: GoodsPage },
  { path: '/goods/search', redirect: '/goods?tab=search' },
  { path: '/goods/mine', redirect: '/goods?tab=mine' },
  { path: '/goods/lists', redirect: '/goods?tab=lists' },
  { path: '/goods/ranking', redirect: '/goods?tab=ranking' },
  { path: '/goods/lists/:feedId', name: 'GoodsListDetail', component: GoodsListDetailPage },
  { path: '/goods/ranking/:feedId', name: 'GoodsRankingDetail', component: GoodsRankingDetailPage },
  { path: '/digital', name: 'Digital', component: DigitalPage },
  { path: '/digital-library', name: 'DigitalLibrary', redirect: '/digital' },
  { path: '/my-products', name: 'MyProducts', component: MyProductsPage },
  { path: '/product-compare', name: 'ProductCompare', component: ProductComparePage },
  { path: '/search', name: 'Search', component: SearchPage },
  { path: '/notifications', name: 'Notifications', component: NotificationsPage },
  { path: '/messages', name: 'Messages', component: MessagesPage },
  { path: '/user/:uid', name: 'User', component: UserPage },
  { path: '/user/:uid/relations/:relation(follow|fans)', name: 'UserRelations', component: UserRelationsPage },
  { path: '/feed/:feedId', name: 'FeedDetail', component: FeedDetailPage, props: true },
  { path: '/live/:liveId', name: 'LiveDetail', component: LiveDetailPage, props: true },
  { path: '/blacklist', name: 'BlackList', component: BlackListPage },
  { path: '/topic/:tag', name: 'Topic', component: TopicPage },
  { path: '/app/:packageName', name: 'AppDetail', component: AppDetailPage },
  { path: '/product/:productId', name: 'Product', component: ProductPage },
  { path: '/dyh/:dyhId', name: 'Dyh', component: DyhPage },
  { path: '/album/:albumId', name: 'AlbumDetail', component: AlbumPage },
  { path: '/albums', name: 'Albums', component: AlbumsPage },
  { path: '/pictures', name: 'Pictures', component: PicturesPage },
  { path: '/headline', name: 'Headline', component: HeadlinePage },
  { path: '/page', name: 'PageDataList', component: PageDataListPage },
  {
    path: '/settings',
    component: SettingsLayout,
    redirect: '/settings/appearance',
    children: [
      { path: 'profile', component: ProfileSettingsPage },
      { path: 'account', component: AccountSettingsPage },
      { path: 'notifications', component: NotificationSettingsPage },
      { path: 'privacy', component: PrivacySettingsPage },
      { path: 'content', component: ContentSettingsPage },
      { path: 'downloads', component: DownloadSettingsPage },
      { path: 'appearance', component: AppearanceSettingsPage },
      { path: 'shortcuts', component: ShortcutSettingsPage },
      { path: 'startup', component: StartupSettingsPage },
      { path: 'device', component: DeviceSettingsPage },
      { path: 'about', component: AboutSettingsPage },
    ]
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition;
    return { top: 0 };
  }
});

router.beforeEach((_to, from) => {
  saveRouteScrollPosition(from.fullPath);
});

router.afterEach((to) => {
  void restoreRouteScrollPosition(to.fullPath);
});
