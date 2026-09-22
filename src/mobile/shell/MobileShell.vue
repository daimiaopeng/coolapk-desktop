<template>
  <div class="mobile-shell" :data-mobile-layout="presentationStore.mobileLayout">
    <NetworkStatusBanner />
    <MobileAppBar />

    <div class="mobile-body">
      <MobileNavigation v-if="presentationStore.mobileLayout === 'expanded' && !hideGlobalNavigation" variant="rail" />
      <main class="mobile-main-content" data-route-surface>
        <slot />
      </main>
    </div>

    <MobileNavigation v-if="presentationStore.mobileLayout !== 'expanded' && !hideGlobalNavigation" variant="bottom" />
  </div>
</template>

<script setup lang="ts">
import NetworkStatusBanner from '../../components/common/NetworkStatusBanner.vue';
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { usePresentationStore } from '../../stores/presentation';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useSettingsStore } from '../../stores/settings';
import { loadImageResource, normalizeResourceUrl } from '../../utils/resourceCache';
import MobileAppBar from './MobileAppBar.vue';
import MobileNavigation from '../navigation/MobileNavigation.vue';

const presentationStore = usePresentationStore();
const settingsStore = useSettingsStore();
const route = useRoute();
const hideGlobalNavigation = computed(() => /^\/(feed|question|live)\//.test(route.path));

/**
 * Mobile feature pages may contain plain images in API-driven cards. Retry
 * those URLs through the same native cache/proxy used by AppImage after a
 * WebView request fails, so a CDN/certificate difference does not render a
 * broken-image glyph across every mobile subpage.
 */
function retryFailedRemoteImage(event: Event) {
  const image = event.target instanceof HTMLImageElement ? event.target : null;
  if (!image || image.dataset.mobileImageProxyAttempted === 'true') return;
  if (image.closest('.app-image-container') || image.dataset.originalUrl) return;

  const source = image.currentSrc || image.src;
  if (!/^https?:\/\//i.test(source)) return;

  image.dataset.mobileImageProxyAttempted = 'true';
  const normalized = normalizeResourceUrl(source);
  void loadImageResource(normalized, (url) => CoolapkTauriAPI.getImageDataUrl(url, {
    cacheDir: settingsStore.settings.cachePath,
    cacheTtlDays: settingsStore.settings.cacheTtlDays,
  })).then((dataUrl) => {
    if (dataUrl) image.src = dataUrl;
  }).catch(() => {
    image.style.display = 'none';
  });
}

onMounted(() => window.addEventListener('error', retryFailedRemoteImage, true));
onBeforeUnmount(() => window.removeEventListener('error', retryFailedRemoteImage, true));
</script>

<style scoped>
.mobile-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--background);
  color: var(--text-primary);
}

.mobile-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.mobile-main-content {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  overscroll-behavior: none;
}

.mobile-shell[data-mobile-layout='expanded'] .mobile-main-content {
  width: min(100%, 1180px);
  margin: 0 auto;
}

.mobile-shell[data-mobile-layout='expanded'] .mobile-body {
  gap: 12px;
  padding: 0 16px;
}

#mobile-route-target {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
