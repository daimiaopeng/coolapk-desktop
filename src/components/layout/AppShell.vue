<template>
  <div class="app-shell">
    <NetworkStatusBanner />
    <TopBar />
    <MobileTopBar />
    <div class="app-body">
      <MainSidebar />
      <div class="app-content-column">
        <PageTabBar />
        <main class="app-main-content">
          <slot></slot>
        </main>
      </div>
    </div>
    <MobileBottomNav />
  </div>
</template>

<script setup lang="ts">
import TopBar from './TopBar.vue';
import MainSidebar from './MainSidebar.vue';
import NetworkStatusBanner from '../common/NetworkStatusBanner.vue';
import MobileTopBar from './MobileTopBar.vue';
import MobileBottomNav from './MobileBottomNav.vue';
import PageTabBar from './PageTabBar.vue';
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--background);
}

.app-body {
  --page-tabbar-height: 38px;
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-main-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  position: relative;
  display: flex;
}

.app-content-column {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 720px) {
  .app-shell :deep(.top-bar),
  .app-shell :deep(.main-sidebar),
  .app-shell :deep(.page-tab-bar) {
    display: none !important;
  }

  .app-body,
  .app-main-content {
    min-height: 0;
  }

  .app-main-content {
    width: 100%;
    overscroll-behavior: none;
  }
}
</style>
