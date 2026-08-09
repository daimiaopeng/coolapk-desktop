import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import SearchPage from '../pages/SearchPage.vue';
import NotificationsPage from '../pages/NotificationsPage.vue';
import MessagesPage from '../pages/MessagesPage.vue';
import DiscoverPage from '../pages/DiscoverPage.vue';
import AppsPage from '../pages/AppsPage.vue';
import GamesPage from '../pages/GamesPage.vue';
import FavoritesPage from '../pages/FavoritesPage.vue';
import HistoryPage from '../pages/HistoryPage.vue';
import FollowingPage from '../pages/FollowingPage.vue';
import UserPage from '../pages/UserPage.vue';
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
import ReviewPage from '../pages/ReviewPage.vue';
import SecondHandPage from '../pages/SecondHandPage.vue';
import ExternalPage from '../pages/ExternalPage.vue';
import SettingsLayout from '../pages/settings/SettingsLayout.vue';
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

import AuthCallbackView from '../pages/AuthCallbackView.vue';

const routes = [
  { path: '/', name: 'Home', component: HomePage },
  { path: '/auth_callback', name: 'AuthCallback', component: AuthCallbackView },
  { path: '/feeds', name: 'Feeds', component: HomePage },
  { path: '/discover', name: 'Discover', component: DiscoverPage },
  { path: '/apps', name: 'Apps', component: AppsPage },
  { path: '/games', name: 'Games', component: GamesPage },
  { path: '/topics', name: 'Topics', component: TopicsHubPage },
  { path: '/favorites', name: 'Favorites', component: FavoritesPage },
  { path: '/history', name: 'History', component: HistoryPage },
  { path: '/following', name: 'Following', component: FollowingPage },
  { path: '/reviews', name: 'Reviews', component: ReviewPage },
  { path: '/secondhand', name: 'SecondHand', component: SecondHandPage },
  { path: '/external', name: 'External', component: ExternalPage },
  { path: '/search', name: 'Search', component: SearchPage },
  { path: '/notifications', name: 'Notifications', component: NotificationsPage },
  { path: '/messages', name: 'Messages', component: MessagesPage },
  { path: '/user/:uid', name: 'User', component: UserPage },
  { path: '/blacklist', name: 'BlackList', component: BlackListPage },
  { path: '/topic/:tag', name: 'Topic', component: TopicPage },
  { path: '/app/:packageName', name: 'AppDetail', component: AppDetailPage },
  { path: '/product/:productId', name: 'Product', component: ProductPage },
  { path: '/dyh/:dyhId', name: 'Dyh', component: DyhPage },
  { path: '/album/:albumId', name: 'AlbumDetail', component: AlbumPage },
  { path: '/albums', name: 'Albums', component: AlbumsPage },
  { path: '/pictures', name: 'Pictures', component: PicturesPage },
  { path: '/headline', name: 'Headline', component: HeadlinePage },
  {
    path: '/settings',
    component: SettingsLayout,
    redirect: '/settings/appearance',
    children: [
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
