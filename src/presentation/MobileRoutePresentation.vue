<template>
  <component
    v-if="customPageComponent"
    :is="customPageComponent"
    :key="`${routeKey}:mobile-page`"
    :data-mobile-route-feature="surfaceName"
  />

  <component
    v-else-if="standaloneAdapter"
    :is="adapterComponent"
    :standalone="true"
    :data-mobile-route-feature="surfaceName"
  />

  <component
    v-else
    :is="adapterComponent"
    :data-mobile-route-feature="surfaceName"
  >
    <!-- Fallback adapters reuse the single routed page instance. This keeps
         the current API/store/lifecycle contract for routes without a
         dedicated Mobile data entry. -->
    <component :is="routeComponent" v-bind="route.params" :key="routeKey" />
  </component>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useRoute } from 'vue-router';
import MobileSharedFeature from '../mobile/features/MobileSharedFeature.vue';
import MobileFeedFeature from '../mobile/features/feed/MobileFeedFeature.vue';
import MobileFeedDetailFeature from '../mobile/features/feed/MobileFeedDetailFeature.vue';
import MobileHomeFeature from '../mobile/features/feed/MobileHomeFeature.vue';
import MobileSearchFeature from '../mobile/features/search-market/MobileSearchFeature.vue';
import MobileSearchPage from '../mobile/features/search-market/MobileSearchPage.vue';
import MobileDigitalPage from '../mobile/features/search-market/MobileDigitalPage.vue';
import MobileMarketFeature from '../mobile/features/search-market/MobileMarketFeature.vue';
import MobileProductFeature from '../mobile/features/search-market/MobileProductFeature.vue';
import MobileMessageFeature from '../mobile/features/user-social/MobileMessageFeature.vue';
import MobileSocialFeature from '../mobile/features/user-social/MobileSocialFeature.vue';
import MobileUserFeature from '../mobile/features/user-social/MobileUserFeature.vue';
import MobileProfilePage from '../mobile/features/user-social/MobileProfilePage.vue';
import MobileMessagePage from '../mobile/features/user-social/MobileMessagePage.vue';
import MobileNotificationsPage from '../mobile/features/user-social/MobileNotificationsPage.vue';
import MobileUserPage from '../mobile/features/user-social/MobileUserPage.vue';
import MobileDownloadsFeature from '../mobile/features/settings-library/MobileDownloadsFeature.vue';
import MobileDownloadsPage from '../mobile/features/settings-library/MobileDownloadsPage.vue';
import MobileLibraryFeature from '../mobile/features/settings-library/MobileLibraryFeature.vue';
import MobileLibraryPage from '../mobile/features/settings-library/MobileLibraryPage.vue';
import MobileMoreServicesPage from '../mobile/features/settings-library/MobileMoreServicesPage.vue';
import MobileSettingsFeature from '../mobile/features/settings-library/MobileSettingsFeature.vue';
import MobileSettingsPage from '../mobile/features/settings-library/MobileSettingsPage.vue';
import MobileMarketPage from '../mobile/features/search-market/MobileMarketPage.vue';
import MobileProductDetailPage from '../mobile/features/search-market/MobileProductDetailPage.vue';
import MobileCommunityPage from '../mobile/features/community/MobileCommunityPage.vue';
import MobileAccountPage from '../mobile/features/account/MobileAccountPage.vue';
import MobileUtilityPage from '../mobile/features/MobileUtilityPage.vue';
import MobileAuthCallbackPage from '../mobile/features/MobileAuthCallbackPage.vue';

defineOptions({ name: 'MobileRoutePresentation' });

const props = defineProps<{
  routeComponent: Component;
  routeKey: string;
}>();

type AdapterName =
  | 'home'
  | 'feed'
  | 'feed-detail'
  | 'search'
  | 'market'
  | 'product'
  | 'user'
  | 'social'
  | 'message'
  | 'settings'
  | 'library'
  | 'downloads'
  | 'shared';

const adapterComponents: Record<AdapterName, Component> = {
  home: MobileHomeFeature,
  feed: MobileFeedFeature,
  'feed-detail': MobileFeedDetailFeature,
  search: MobileSearchFeature,
  market: MobileMarketFeature,
  product: MobileProductFeature,
  user: MobileUserFeature,
  social: MobileSocialFeature,
  message: MobileMessageFeature,
  settings: MobileSettingsFeature,
  library: MobileLibraryFeature,
  downloads: MobileDownloadsFeature,
  shared: MobileSharedFeature,
};

const route = useRoute();

function resolveCustomPage(path: string): Component | null {
  if (path === '/auth_callback') return MobileAuthCallbackPage;
  if (path === '/my') return MobileProfilePage;
  if (path === '/more') return MobileMoreServicesPage;
  if (path === '/digital') return MobileDigitalPage;
  if (path === '/search' || path === '/product-selector') return MobileSearchPage;
  if (path === '/downloads') return MobileDownloadsPage;
  if (path === '/messages') return MobileMessagePage;
  if (path === '/notifications') return MobileNotificationsPage;
  if (/^\/user\/[^/]+\/relations\//.test(path)) return MobileAccountPage;
  if (/^\/user\//.test(path)) return MobileUserPage;
  if (/^\/(app|product)\//.test(path)) return MobileProductDetailPage;
  if (/^\/(apps|games|goods|secondhand|my-products|product-compare)(\/|$)/.test(path)) return MobileMarketPage;
  if (/^\/(topics|topic|node|headline|page|events|event|dyh|my-dyh|albums|album|pictures|anylist|reviews)(\/|$)/.test(path)) return MobileCommunityPage;
  if (/^\/(favorites|history|my-albums|my-likes)(\/|$)/.test(path)) return MobileLibraryPage;
  if (/^\/(following|blacklist|followed-nodes|followed-topics|recent-contacts|recycle-bin|hidden-replies|my-devices|my-votes)(\/|$)/.test(path)) return MobileAccountPage;
  if (path === '/center' || path === '/external' || /^\/anylist(?:\/|$)/.test(path)) return MobileUtilityPage;
  if (/^\/settings(?:\/|$)/.test(path)) return MobileSettingsPage;
  return null;
}

function resolveAdapter(path: string): AdapterName {
  if (path === '/' || path === '/feeds') return 'home';
  if (/^\/(feed|question|live)\//.test(path)) return 'feed-detail';
  if (/^\/(search|product-selector)(\/|$)/.test(path)) return 'search';
  if (/^\/(app|product)(\/|$)/.test(path)) return 'product';
  if (/^\/product-compare(\/|$)/.test(path) || /^\/goods\/(lists|ranking)\/[^/]+/.test(path)) return 'product';
  if (/^\/(digital|apps|games|goods|secondhand|my-products)(\/|$)/.test(path)) return 'market';
  if (/^\/my-dyh(\/|$)/.test(path)) return 'shared';
  if (/^\/user\//.test(path)) return 'user';
  if (/^\/messages(\/|$)/.test(path)) return 'message';
  if (/^\/notifications(\/|$)/.test(path)) return 'social';
  if (/^\/downloads(\/|$)/.test(path)) return 'downloads';
  if (/^\/(favorites|history|albums|album|pictures|my-albums|my-likes)(\/|$)/.test(path)) return 'library';
  if (/^\/(following|blacklist|followed-nodes|followed-topics|recent-contacts|recycle-bin|hidden-replies|my-devices|my-votes|user\/[^/]+\/relations)(\/|$)/.test(path)) return 'social';
  if (/^\/(discover|topics|headline|page|topic|node|dyh|events|reviews)(\/|$)/.test(path)) return 'feed';
  return 'shared';
}

const customPageComponent = computed(() => resolveCustomPage(route.path));
const standaloneAdapter = computed(() => {
  const adapter = resolveAdapter(route.path);
  return route.path === '/' || route.path === '/feeds' || adapter === 'feed-detail';
});
const surfaceName = computed(() => {
  if (route.path === '/my') return 'profile';
  if (route.path === '/more') return 'more-services';
  if (route.path === '/discover') return 'discover';
  if (route.path === '/digital') return 'digital';
  if (route.path === '/search' || route.path === '/product-selector') return 'search-page';
  if (route.path === '/downloads') return 'downloads-page';
  if (route.path === '/messages') return 'messages-page';
  if (route.path === '/notifications') return 'notifications-page';
  if (/^\/user\/[^/]+\/relations\//.test(route.path)) return 'account-page';
  if (/^\/user\//.test(route.path)) return 'user-page';
  if (/^\/(app|product)\//.test(route.path)) return 'product-detail-page';
  if (/^\/(apps|games|goods|secondhand|my-products|product-compare)(\/|$)/.test(route.path)) return 'market-page';
  if (/^\/(topics|topic|node|headline|page|events|event|dyh|my-dyh|albums|album|pictures|anylist|reviews)(\/|$)/.test(route.path)) return 'community-page';
  if (/^\/(favorites|history|my-albums|my-likes)(\/|$)/.test(route.path)) return 'library-page';
  if (/^\/(following|blacklist|followed-nodes|followed-topics|recent-contacts|recycle-bin|hidden-replies|my-devices|my-votes)(\/|$)/.test(route.path)) return 'account-page';
  if (route.path === '/auth_callback') return 'auth-callback';
  if (route.path === '/center' || route.path === '/external' || /^\/anylist(?:\/|$)/.test(route.path)) return 'utility';
  if (/^\/settings(?:\/|$)/.test(route.path)) return 'settings-page';
  return resolveAdapter(route.path);
});
const adapterComponent = computed(() => adapterComponents[resolveAdapter(route.path)]);
const routeComponent = computed(() => props.routeComponent);
const routeKey = computed(() => props.routeKey);
</script>

<style scoped>
:deep([data-mobile-page]),
:deep([data-mobile-feature]) {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

</style>
