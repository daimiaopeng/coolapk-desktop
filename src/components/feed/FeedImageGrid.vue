<template>
  <div v-if="processedImages && processedImages.length > 0" :class="['feed-image-grid', `count-${gridCount}`]">
    <div
      v-for="(url, index) in processedImages"
      :key="index"
      :class="[
        'grid-item',
        {
          'has-natural-size': Boolean(imageRatios[url]),
          'is-long-image': gridCount === 1 && isLongImage,
        },
      ]"
      @click.stop="openViewer(index)"
    >
      <AppImage
        :src="getHdImageUrl(url)"
        alt="feed image"
        image-class="grid-img"
        @load="handleImageLoad(url, $event)"
      />
      <div v-if="processedImages.length >= 3 && index === processedImages.length - 1" class="image-count-badge">
        {{ processedImages.length }}图
      </div>
      <div v-if="gridCount === 1 && isLongImage" class="long-image-badge">
        <i class="fas fa-arrows-alt-v"></i>
        <span>长图，点击查看完整图片</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppStore } from '../../stores/app';
import { useSettingsStore } from '../../stores/settings';
import AppImage from '../common/AppImage.vue';
import { getHdImageUrl } from '../../utils/image';
import { CoolapkTauriAPI } from '../../api/coolapk';

const props = defineProps<{
  images?: string[];
}>();

const appStore = useAppStore();
const settingsStore = useSettingsStore();
const LONG_IMAGE_RATIO = 1.8;
const imageRatios = ref<Record<string, number>>({});

const processedImages = computed(() => {
  if (!props.images || !Array.isArray(props.images)) return [];
  return props.images.filter(url => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed.length <= 5 || trimmed === 'null' || trimmed === 'undefined') return false;
    // 关闭动图自动播放时，过滤 GIF 图片以节省流量
    if (!settingsStore.settings.autoPlayGif && /\.gif(?:v)?[\s?]|\.gif$/i.test(trimmed)) {
      return false;
    }
    return true;
  });
});

const gridCount = computed(() => {
  return Math.min(processedImages.value.length, 9);
});

const singleImageRatio = computed(() => {
  const url = processedImages.value[0];
  return url ? imageRatios.value[url] || 0 : 0;
});

const isLongImage = computed(() => singleImageRatio.value >= LONG_IMAGE_RATIO);

function handleImageLoad(url: string, event: Event) {
  const image = event.target as HTMLImageElement;
  if (!image.naturalWidth || !image.naturalHeight) return;
  imageRatios.value = {
    ...imageRatios.value,
    [url]: image.naturalWidth / image.naturalHeight,
  };
}

function openViewer(index: number) {
  if (!props.images) return;
  // 系统查看器模式：直接用系统默认程序打开原图链接
  if (settingsStore.settings.imageOpenMode === 'system') {
    const url = props.images[index];
    if (url) void CoolapkTauriAPI.openUrl(url, 'system');
    return;
  }
  appStore.openImageViewer(props.images, index);
}
</script>

<style scoped>
.feed-image-grid {
  display: grid;
  gap: 8px;
  margin-bottom: var(--space-3, 12px);
  width: 100%;
}

.count-1 {
  grid-template-columns: 1fr;
  max-width: 380px;
}

.count-1 .grid-item {
  aspect-ratio: auto;
  min-height: 180px;
  max-height: 520px;
}

.count-1 .grid-item.has-natural-size:not(.is-long-image) {
  min-height: 0;
  max-height: none;
}

.count-1 .grid-img {
  height: auto;
}

.count-1 .grid-img :deep(img) {
  width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
}

.count-1 .grid-item.is-long-image {
  background: var(--background-secondary, #f0f0f0);
}

.count-1 .grid-item.is-long-image::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 72px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.62));
  pointer-events: none;
}

.long-image-badge {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  color: #ffffff;
  font-size: 11px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.count-2 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 480px;
}

.count-3, .count-5, .count-6, .count-7, .count-8, .count-9 {
  grid-template-columns: repeat(3, 1fr);
  max-width: 520px;
}

.count-4 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 380px;
}

.grid-item {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.03));
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-count-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  pointer-events: none;
}
</style>
