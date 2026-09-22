<template>
  <section class="mobile-route-frame" :data-mobile-feature="getMobileFeature(route)">
    <div id="mobile-route-target" data-route-surface-target style="display: flex; flex: 1; width: 100%; min-width: 0; min-height: 0"></div>
  </section>
</template>

<script setup lang="ts">
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router';

const route = useRoute();

function getMobileFeature(routeLocation: RouteLocationNormalizedLoaded): string {
  const path = routeLocation.path;
  if (path === '/') return 'home';
  if (path === '/my') return 'profile';
  if (path === '/more') return 'more-services';
  if (path === '/discover') return 'discover';
  if (path === '/digital') return 'digital';
  if (path === '/search') return 'search-page';
  if (path === '/downloads') return 'downloads-page';
  if (path === '/messages') return 'messages-page';
  if (path === '/notifications') return 'notifications-page';
  if (/^\/(feed|question|live)\//.test(path)) return 'feed-detail';
  if (/^\/(search|product-selector)(\/|$)/.test(path)) return 'search';
  if (/^\/(app|product)\//.test(path)) return 'product-detail';
  if (/^\/(apps|games|goods|digital|secondhand|my-products|product-compare)(\/|$)/.test(path)) return 'market';
  if (/^\/user\/[^/]+\/relations\//.test(path)) return 'account';
  if (/^\/user\//.test(path)) return 'user';
  if (/^\/downloads(\/|$)/.test(path)) return 'downloads';
  if (/^\/settings(\/|$)/.test(path)) return 'settings';
  if (/^\/(favorites|history|my-albums|my-likes)(\/|$)/.test(path)) return 'library';
  if (/^\/(following|blacklist|followed-nodes|followed-topics|recent-contacts|recycle-bin|hidden-replies|my-devices|my-votes)(\/|$)/.test(path)) return 'account';
  if (
    /^\/(discover|topics|headline|page|topic|node|dyh|my-dyh|events|event|reviews|albums|album|pictures|anylist)(\/|$)/.test(path)
  ) return 'community';
  if (path === '/auth_callback') return 'auth-callback';
  if (/^\/(my-dyh|center|external)(\/|$)/.test(path)) return 'utility';
  return 'shared';
}
</script>

<style scoped>
.mobile-route-frame {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background-secondary, #f2f2f6);
  color: var(--text-primary);
}

.mobile-route-frame :deep(button),
.mobile-route-frame :deep([role='button']),
.mobile-route-frame :deep(input),
.mobile-route-frame :deep(textarea),
.mobile-route-frame :deep(select) {
  touch-action: manipulation;
}
</style>
