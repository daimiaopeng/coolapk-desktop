<template>
  <div class="app-shell">
    <NetworkStatusBanner />
    <TopBar />
    <MobileTopBar />
    <div class="app-body">
      <MainSidebar />
      <main class="app-main-content">
        <slot></slot>
      </main>
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

@media (max-width: 720px) {
  .app-shell :deep(.top-bar),
  .app-shell :deep(.main-sidebar) {
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
