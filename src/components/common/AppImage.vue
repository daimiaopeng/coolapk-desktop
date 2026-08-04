<template>
  <div class="app-image-container" :class="{ 'is-loading': loading, 'is-error': error, 'fit-contain': fit === 'contain' }">
    <img
      v-if="renderedSrc && !error"
      :src="renderedSrc"
      :alt="alt"
      :class="imageClass"
      :style="{ objectFit: fit }"
      @load="handleLoad"
      @error="handleError"
      v-bind="$attrs"
    />
    <div v-else-if="loading" class="image-placeholder">
      <i class="fa-solid fa-spinner fa-spin"></i>
    </div>
    <div v-else-if="error" class="image-error">
      <i class="fa-solid fa-image-slash"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';

const props = withDefaults(defineProps<{
  src?: string;
  alt?: string;
  imageClass?: string | object | any[];
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}>(), {
  fit: 'cover'
});

const renderedSrc = ref<string | undefined>(undefined);
const loading = ref(false);
const error = ref(false);

const imageCache = new Map<string, string>();

async function loadImage(url: string | undefined) {
  if (!url) {
    renderedSrc.value = undefined;
    return;
  }

  // 如果是本地或者是 base64，直接使用
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
    renderedSrc.value = url;
    return;
  }

  // 检查内存缓存
  if (imageCache.has(url)) {
    renderedSrc.value = imageCache.get(url);
    return;
  }

  loading.value = true;
  error.value = false;
  renderedSrc.value = undefined;

  try {
    const dataUrl = await CoolapkTauriAPI.getImageDataUrl(url);
    imageCache.set(url, dataUrl);
    renderedSrc.value = dataUrl;
  } catch (err) {
    console.error('Failed to load image via Tauri proxy:', url, err);
    error.value = true;
  } finally {
    loading.value = false;
  }
}

watch(() => props.src, (newSrc) => {
  loadImage(newSrc);
});

onMounted(() => {
  loadImage(props.src);
});

function handleLoad() {
  loading.value = false;
}

function handleError() {
  error.value = true;
  loading.value = false;
}
</script>

<style scoped>
.app-image-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: var(--background-secondary, #f0f0f0);
  overflow: hidden;
  position: relative;
}

.app-image-container.fit-contain {
  background-color: transparent;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.app-image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.app-image-container.fit-contain img {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-placeholder,
.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-tertiary, #999);
  font-size: 1.2rem;
}
</style>
