<template>
  <div
    class="app-image-container"
    :class="[imageClass, { 'is-loading': loading, 'is-error': error, 'fit-contain': fit === 'contain' }]"
  >
    <img
      v-if="renderedSrc && !error"
      :src="renderedSrc"
      :alt="alt"
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
const isFallback = ref(false);

const imageCache = new Map<string, string>();

async function loadImage(url: string | undefined) {
  if (!url) {
    renderedSrc.value = undefined;
    error.value = false;
    loading.value = false;
    return;
  }

  // 1. 如果是相对地址，自动补全 https；如果是 http 协议，强制自动升级为 https
  let targetUrl = url;
  if (targetUrl.startsWith('//')) {
    targetUrl = `https:${targetUrl}`;
  } else if (targetUrl.startsWith('http://')) {
    targetUrl = targetUrl.replace('http://', 'https://');
  }

  // 2. 如果是本地或者 base64，直接使用
  if (targetUrl.startsWith('data:') || targetUrl.startsWith('blob:') || targetUrl.startsWith('/')) {
    renderedSrc.value = targetUrl;
    loading.value = false;
    error.value = false;
    return;
  }

  // 3. 检查内存缓存
  if (imageCache.has(targetUrl)) {
    renderedSrc.value = imageCache.get(targetUrl);
    loading.value = false;
    error.value = false;
    return;
  }

  loading.value = true;
  error.value = false;
  isFallback.value = false;
  renderedSrc.value = undefined;

  try {
    const dataUrl = await CoolapkTauriAPI.getImageDataUrl(targetUrl);
    imageCache.set(targetUrl, dataUrl);
    renderedSrc.value = dataUrl;
  } catch (err) {
    // 代理请求失败时，自动降级为原生应用 HTTP/HTTPS 直接请求
    isFallback.value = true;
    renderedSrc.value = targetUrl;
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
  // 如果降级直接链接后依然失败，才提示为 Error
  if (isFallback.value || !props.src) {
    error.value = true;
  } else {
    isFallback.value = true;
    let targetUrl = props.src;
    if (targetUrl.startsWith('//')) {
      targetUrl = `https:${targetUrl}`;
    }
    renderedSrc.value = targetUrl;
  }
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
