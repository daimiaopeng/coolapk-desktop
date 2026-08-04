<template>
  <AppShell>
    <router-view v-slot="{ Component, route }">
      <keep-alive include="HomePage">
        <component :is="Component" :key="route.fullPath" />
      </keep-alive>
    </router-view>

    <!-- 全局交互浮层 -->
    <CommentDrawer />
    <PublishDialog />
    <ImageViewer />
    <SearchCommand />
    <LoginModal />
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import AppShell from './components/layout/AppShell.vue';
import CommentDrawer from './components/comments/CommentDrawer.vue';
import PublishDialog from './components/overlays/PublishDialog.vue';
import ImageViewer from './components/overlays/ImageViewer.vue';
import SearchCommand from './components/overlays/SearchCommand.vue';
import LoginModal from './components/overlays/LoginModal.vue';
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();

onMounted(() => {
  authStore.initAuth();
});
</script>

<style>
/* 全局辅助无边框无滚动 */
html, body {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#app {
  margin: 0;
  padding: 0;
  overflow: hidden;
  box-sizing: border-box;
}
</style>
