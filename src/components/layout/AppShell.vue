<template>
  <div class="app-shell">
    <NetworkStatusBanner />
    <TopBar />
    <div class="app-body">
      <MainSidebar />
      <div class="app-content-column">
        <PageTabBar />
        <main class="app-main-content" data-route-surface>
          <slot></slot>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TopBar from './TopBar.vue';
import MainSidebar from './MainSidebar.vue';
import NetworkStatusBanner from '../common/NetworkStatusBanner.vue';
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

#desktop-route-target {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
