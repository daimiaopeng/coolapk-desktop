<template>
  <div class="app-shell">
    <TopBar />
    <div class="app-body">
      <MainSidebar />
      <main class="app-main-content">
        <slot></slot>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import TopBar from './TopBar.vue';
import MainSidebar from './MainSidebar.vue';
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
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
</style>
