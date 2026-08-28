<template>
  <div
    v-show="isSidebarRoute"
    class="sidebar-page-host"
    :aria-hidden="!isSidebarRoute"
  >
    <Transition
      v-for="page in pages"
      :key="page.key"
      :name="isSidebarTransitionActive ? 'page' : undefined"
    >
      <div
        v-show="activePageKey === page.key"
        class="sidebar-page-slot"
        :aria-hidden="activePageKey !== page.key"
      >
        <component :is="page.component" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useRoute } from 'vue-router';
import HomePage from '../../pages/HomePage.vue';
import DigitalPage from '../../pages/DigitalPage.vue';
import DiscoverPage from '../../pages/DiscoverPage.vue';
import TopicsHubPage from '../../pages/TopicsHubPage.vue';
import PicturesPage from '../../pages/PicturesPage.vue';
import AppsPage from '../../pages/AppsPage.vue';
import MorePage from '../../pages/MorePage.vue';
import NotificationsPage from '../../pages/NotificationsPage.vue';
import MessagesPage from '../../pages/MessagesPage.vue';
import HistoryPage from '../../pages/HistoryPage.vue';
import FavoritesPage from '../../pages/FavoritesPage.vue';
import FollowingPage from '../../pages/FollowingPage.vue';
import MoreWorkspacePage from '../../pages/MoreWorkspacePage.vue';
import { useSidebarTransition } from '../../utils/routeTransition';
import { isSidebarPreloadPath, type SidebarPreloadPath } from '../../utils/sidebarPreload';

interface SidebarPageDefinition {
  key: SidebarPreloadPath;
  component: Component;
}

const pages: SidebarPageDefinition[] = [
  { key: '/', component: HomePage },
  { key: '/digital', component: DigitalPage },
  { key: '/discover', component: DiscoverPage },
  { key: '/topics', component: TopicsHubPage },
  { key: '/pictures', component: PicturesPage },
  { key: '/apps', component: AppsPage },
  { key: '/more', component: MorePage },
  { key: '/notifications', component: NotificationsPage },
  { key: '/messages', component: MessagesPage },
  { key: '/history', component: HistoryPage },
  { key: '/favorites', component: FavoritesPage },
  { key: '/following', component: FollowingPage },
  { key: '/my', component: MoreWorkspacePage },
];

const route = useRoute();
const { isSidebarTransitionActive } = useSidebarTransition();
const activePageKey = computed<SidebarPreloadPath | null>(() => (
  isSidebarPreloadPath(route.path) ? route.path : null
));
const isSidebarRoute = computed(() => activePageKey.value !== null);
</script>

<style scoped>
.sidebar-page-host {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.sidebar-page-slot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
