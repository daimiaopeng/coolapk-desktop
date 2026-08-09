<template>
  <div :class="['app-avatar-container', `size-${size}`]" :style="{ width: `${sizePx}px`, height: `${sizePx}px` }">
    <div class="app-avatar">
      <AppImage :src="src || defaultAvatar" :alt="alt || 'avatar'" image-class="avatar-img" />
    </div>
    <!-- 酷安官方头像装扮挂件 Overlay (纯透底 PNG) -->
    <img 
      v-if="pluginUrl && pluginDataUrl" 
      :src="pluginDataUrl" 
      alt="" 
      class="avatar-plugin-img" 
      referrerpolicy="no-referrer"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import AppImage from './AppImage.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { loadImageResource, normalizeResourceUrl } from '../../utils/resourceCache';

const props = withDefaults(
  defineProps<{
    src?: string;
    alt?: string;
    pluginUrl?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  }>(),
  {
    size: 'md'
  }
);

const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23b0b0b0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';

const pluginDataUrl = ref<string>('');
let pluginLoadSequence = 0;

async function loadPluginImage(url?: string) {
  const sequence = ++pluginLoadSequence;
  if (!url) {
    pluginDataUrl.value = '';
    return;
  }
  const targetUrl = normalizeResourceUrl(url);

  try {
    const dataUrl = await loadImageResource(targetUrl, CoolapkTauriAPI.getImageDataUrl);
    if (sequence !== pluginLoadSequence) return;
    pluginDataUrl.value = dataUrl;
  } catch (err) {
    if (sequence !== pluginLoadSequence) return;
    pluginDataUrl.value = targetUrl;
  }
}

watch(() => props.pluginUrl, (newUrl) => {
  loadPluginImage(newUrl);
});

onMounted(() => {
  loadPluginImage(props.pluginUrl);
});

const sizePx = computed(() => {
  if (typeof props.size === 'number') return props.size;
  switch (props.size) {
    case 'sm': return 32;
    case 'md': return 44;
    case 'lg': return 56;
    case 'xl': return 72;
    default: return 44;
  }
});
</script>

<style scoped>
.app-avatar-container {
  position: relative;
  flex-shrink: 0;
  display: inline-block;
}

.app-avatar {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-pill);
  overflow: hidden;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-light);
  position: relative;
  z-index: 1;
}

:deep(.avatar-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-plugin-img {
  position: absolute;
  top: -15%;
  left: -15%;
  width: 130% !important;
  height: 130% !important;
  max-width: none !important;
  pointer-events: none;
  z-index: 5;
  object-fit: contain;
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
</style>
