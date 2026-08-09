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
      referrerpolicy="no-referrer"
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
import { useSettingsStore } from '../../stores/settings';
import { sanitizeImageUrl } from '../../utils/image';
import { loadImageResource, normalizeResourceUrl } from '../../utils/resourceCache';

const props = withDefaults(defineProps<{
  src?: string;
  alt?: string;
  imageClass?: string | object | any[];
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}>(), {
  fit: 'cover'
});

const emit = defineEmits<{
  (event: 'load', payload: Event): void;
  (event: 'error', payload: Event): void;
}>();

const settingsStore = useSettingsStore();

const renderedSrc = ref<string | undefined>(undefined);
const loading = ref(false);
const error = ref(false);
const isFallback = ref(false);

let loadSequence = 0;

async function loadImage(url: string | undefined) {
  const sequence = ++loadSequence;
  if (!url) {
    renderedSrc.value = undefined;
    error.value = false;
    loading.value = false;
    return;
  }

  // 1. 如果是相对地址，自动补全 https；如果是 http 协议，强制自动升级为 https
  const targetUrl = normalizeResourceUrl(url);

  // 协议白名单：降级路径会直接把 URL 交给 <img>（WebView 原生加载），
  // file:/javascript: 等异常 scheme 一律拒绝，防止加载/探测本地文件
  if (!sanitizeImageUrl(targetUrl)) {
    error.value = true;
    loading.value = false;
    renderedSrc.value = undefined;
    return;
  }

  // 2. 如果是本地或者 base64，直接使用
  if (targetUrl.startsWith('data:') || targetUrl.startsWith('blob:') || targetUrl.startsWith('/')) {
    renderedSrc.value = targetUrl;
    loading.value = false;
    error.value = false;
    return;
  }

  // 3. 依次检查全局内存缓存、持久缓存和网络
  loading.value = true;
  error.value = false;
  isFallback.value = false;
  renderedSrc.value = undefined;

  try {
    const dataUrl = await loadImageResource(targetUrl, (resourceUrl) => (
      CoolapkTauriAPI.getImageDataUrl(resourceUrl, {
        cacheDir: settingsStore.settings.cachePath,
        cacheTtlDays: settingsStore.settings.cacheTtlDays,
      })
    ));
    if (sequence !== loadSequence) return;
    renderedSrc.value = dataUrl;
  } catch (err) {
    if (sequence !== loadSequence) return;
    // 代理请求失败时，自动降级为原生应用 HTTP/HTTPS 直接请求
    isFallback.value = true;
    renderedSrc.value = targetUrl;
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

watch(() => props.src, (newSrc) => {
  loadImage(newSrc);
});

onMounted(() => {
  loadImage(props.src);
});

function handleLoad(event: Event) {
  loading.value = false;
  emit('load', event);
}

function handleError(event: Event) {
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
  emit('error', event);
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
