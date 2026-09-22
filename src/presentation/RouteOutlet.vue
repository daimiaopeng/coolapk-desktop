<template>
  <div class="route-portal" :data-route-presentation="presentationStore.presentation">
    <router-view v-slot="{ Component, route }">
      <Teleport :to="portalTarget" defer>
        <!-- Desktop keeps the original route component. MobileRoutePresentation
             owns the Mobile page/adapter choice, so the Desktop page is not
             instantiated alongside a Mobile page. -->
        <keep-alive :max="15">
          <component
            v-if="presentationStore.presentation === 'desktop'"
            :is="Component"
            :key="getRouteKey(route)"
            :class="{ 'sidebar-page-enter': isSidebarTransitionActive && presentationStore.presentation === 'desktop' }"
          />
          <MobileRoutePresentation
            v-else
            :route-component="Component"
            :route-key="getRouteKey(route)"
            :key="getRouteKey(route)"
          />
        </keep-alive>
      </Teleport>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { usePageTabsStore } from '../stores/pageTabs';
import { useSidebarTransition } from '../utils/routeTransition';
import { usePresentationStore } from '../stores/presentation';
import MobileRoutePresentation from './MobileRoutePresentation.vue';

const route = useRoute();
const pageTabsStore = usePageTabsStore();
const presentationStore = usePresentationStore();
const portalTarget = computed(() => presentationStore.presentation === 'desktop'
  ? '#desktop-route-target'
  : '#mobile-route-target');
const { isSidebarTransitionActive } = useSidebarTransition();

function getRouteKey(routeLocation: typeof route): string {
  // /topics owns its internal topic selector and should not be recreated for
  // every subtopic, while other pages retain the existing tab-generation key.
  if (routeLocation.path === '/topics') {
    return `/topics:${pageTabsStore.getGeneration(routeLocation)}`;
  }
  return `${routeLocation.fullPath}:${pageTabsStore.getGeneration(routeLocation)}`;
}
</script>
