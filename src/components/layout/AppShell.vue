<template>
  <div class="app-shell" :class="{ 'has-mobile-window-controls': showWindowControls, 'is-android': isAndroidApp }">
    <NetworkStatusBanner />
    <TopBar />
    <MobileTopBar
      :navigation-open="mobileNavigationOpen"
      :mac-overlay="usesMacOverlay"
      @toggle-navigation="toggleMobileNavigation"
    />
    <div class="app-body">
      <MainSidebar
        :mobile-open="mobileNavigationOpen"
        :mobile-window-controls="showWindowControls"
        @close-mobile="closeMobileNavigation"
      />
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
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { isTauri } from '@tauri-apps/api/core';
import { useRoute, useRouter } from 'vue-router';
import TopBar from './TopBar.vue';
import MainSidebar from './MainSidebar.vue';
import NetworkStatusBanner from '../common/NetworkStatusBanner.vue';
import MobileTopBar from './MobileTopBar.vue';
import MobileBottomNav from './MobileBottomNav.vue';
import PageTabBar from './PageTabBar.vue';
import { useAndroidBackButton } from '../../utils/androidBackButton';
import { navigateBack } from '../../utils/navigation';
import { useDesktopWindow } from '../../composables/useDesktopWindow';

const route = useRoute();
const router = useRouter();
const mobileNavigationOpen = ref(false);
const isAndroidApp = isTauri() && /android/i.test(navigator.userAgent);
const { showWindowControls, usesMacOverlay } = useDesktopWindow();

function toggleMobileNavigation() {
  mobileNavigationOpen.value = !mobileNavigationOpen.value;
}

function closeMobileNavigation() {
  mobileNavigationOpen.value = false;
}

useAndroidBackButton(() => mobileNavigationOpen.value, closeMobileNavigation);
useAndroidBackButton(() => true, () => navigateBack(router));

function handleMobileNavigationKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMobileNavigation();
}

watch(() => route.fullPath, closeMobileNavigation);

onMounted(() => window.addEventListener('keydown', handleMobileNavigationKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleMobileNavigationKeydown));
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

@media (min-width: 721px) {
  /* Android 平板使用桌面顶栏时，给系统状态栏留出顶部安全区。 */
  .app-shell.is-android::before {
    content: '';
    flex: 0 0 env(safe-area-inset-top, 0px);
    background: var(--titlebar-background);
  }

  .app-shell.is-android :deep(.network-status-banner) {
    top: calc(var(--app-titlebar-height) + env(safe-area-inset-top, 0px));
  }
}

@media (max-width: 720px) {
  .app-shell :deep(.top-bar),
  .app-shell :deep(.page-tab-bar) {
    display: none !important;
  }

  /* 无系统标题栏的桌面平台在窄窗口仍需要最小化、最大化和关闭按钮。 */
  .app-shell.has-mobile-window-controls :deep(.top-bar.has-window-controls) {
    display: flex !important;
    flex: 0 0 var(--mobile-window-controls-height);
    height: var(--mobile-window-controls-height);
    min-height: var(--mobile-window-controls-height);
  }

  .app-shell.has-mobile-window-controls :deep(.top-bar.has-window-controls > .titlebar-sidebar-offset),
  .app-shell.has-mobile-window-controls :deep(.top-bar.has-window-controls > .top-bar-center),
  .app-shell.has-mobile-window-controls :deep(.top-bar.has-window-controls > .top-bar-right) {
    display: none !important;
  }

  .app-shell.has-mobile-window-controls :deep(.top-bar.has-window-controls > .window-controls) {
    height: var(--mobile-window-controls-height);
  }

  .app-shell.has-mobile-window-controls :deep(.network-status-banner) {
    top: calc(var(--mobile-window-controls-height) + var(--mobile-topbar-height));
  }

  .app-shell :deep(.main-sidebar) {
    display: flex !important;
    position: fixed;
    top: calc(var(--mobile-topbar-height) + 8px);
    bottom: calc(var(--mobile-bottom-nav-height) + 8px);
    left: 50%;
    z-index: 1001;
    width: min(460px, calc(100vw - 24px)) !important;
    height: auto;
    transform: translate(-50%, -8px);
    visibility: hidden;
    pointer-events: none;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-card);
    overflow: hidden;
    transition: transform var(--duration-normal) var(--ease-default), visibility var(--duration-normal), opacity var(--duration-normal);
    opacity: 0;
  }

  .app-shell.has-mobile-window-controls :deep(.main-sidebar.has-window-controls) {
    top: calc(var(--mobile-window-controls-height) + var(--mobile-topbar-height) + 8px);
  }

  .app-shell :deep(.main-sidebar.is-mobile-open) {
    transform: translate(-50%, 0);
    visibility: visible;
    pointer-events: auto;
    opacity: 1;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .mobile-navigation-header) {
    display: flex;
    flex: 0 0 auto;
    align-items: baseline;
    gap: 10px;
    padding: 14px 16px 8px;
    color: var(--text-primary);
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .mobile-navigation-header strong) {
    font-size: 16px;
    font-weight: 700;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .mobile-navigation-header span) {
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .sidebar-nav) {
    display: grid !important;
    flex: 1 1 auto;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: start;
    gap: 8px;
    min-height: 0;
    width: 100%;
    padding: 12px;
    overflow-y: auto;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .nav-group) {
    display: contents;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .nav-item) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center !important;
    gap: 5px;
    width: 100%;
    height: 60px;
    padding: 6px 4px !important;
    border: 1px solid var(--border-light);
    border-radius: 13px;
    background: var(--surface-hover);
    font-size: 12px;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .nav-label) {
    display: inline !important;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .nav-item.is-active::before) {
    display: none;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .nav-icon) {
    width: auto;
    margin: 0 !important;
    font-size: 18px;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .nav-divider) {
    display: block;
    grid-column: 1 / -1;
    width: auto;
    height: 1px;
    margin: 2px 0;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .sidebar-footer) {
    display: flex !important;
    flex: 0 0 auto;
  }

  .app-shell :deep(.main-sidebar.is-mobile-open .nav-badge) {
    position: absolute;
    top: 3px;
    right: 6px;
    left: auto;
    margin: 0;
  }

  .app-shell :deep(.sidebar-floating-toggle-btn) {
    display: none;
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
