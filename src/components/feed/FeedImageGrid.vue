<template>
  <div
    v-if="!settingsStore.settings.noImageMode && processedImages && processedImages.length > 0"
    :class="['feed-image-grid', `count-${gridCount}`, `variant-${variant}`]"
  >
    <div
      v-for="(item, index) in processedImages"
      :key="item.key"
      :class="[
        'grid-item',
        {
          'has-natural-size': Boolean(imageRatios[item.key]),
          'is-long-image': gridCount === 1 && isLongImage,
        },
      ]"
      data-context-kind="image"
      :data-context-image-url="item.sourceUrl"
      @click.stop="openViewer(index)"
    >
      <LivePhotoPreview
        :item="item"
        :content-id="contentId"
        :content-type="contentType"
        :is-single="gridCount === 1"
        :is-long="gridCount === 1 && isLongImage"
        @load="handleImageLoad(item.key, $event)"
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
import LivePhotoPreview from './LivePhotoPreview.vue';
import { getStaticAnimatedImageUrl, isAnimatedImageUrl, isPortraitLongImage } from '../../utils/image';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { getErrorMessage } from '../../utils/errors';
import { showToast } from '../../utils/toast';
import {
  normalizeFeedImageItems,
  type LivePhotoContextType,
} from '../../utils/livePhoto';

const props = defineProps<{
  images?: unknown[];
  variant?: 'feed' | 'comment';
  contentId?: string | number;
  contentType?: LivePhotoContextType;
}>();

const variant = computed(() => props.variant || 'feed');
const contentId = computed(() => props.contentId);
const contentType = computed<LivePhotoContextType>(() => props.contentType || 'feed');

const appStore = useAppStore();
const settingsStore = useSettingsStore();
const LONG_IMAGE_RATIO = 1.8;
const imageRatios = ref<Record<string, number>>({});

const processedImages = computed(() => {
  return normalizeFeedImageItems(props.images).flatMap(item => {
    // 关闭动图自动播放时加载 CDN 静态封面，保留原图地址供点击查看。
    if (!settingsStore.settings.autoPlayGif && !item.isLivePhoto && isAnimatedImageUrl(item.sourceUrl)) {
      const staticCover = getStaticAnimatedImageUrl(item.sourceUrl);
      return staticCover ? [{ ...item, coverUrl: staticCover }] : [];
    }
    return [item];
  });
});

const gridCount = computed(() => {
  return Math.min(processedImages.value.length, 9);
});

const singleImageRatio = computed(() => {
  const item = processedImages.value[0];
  return item ? imageRatios.value[item.key] || 0 : 0;
});

const isLongImage = computed(() => isPortraitLongImage(singleImageRatio.value, LONG_IMAGE_RATIO));

function handleImageLoad(key: string, event: Event) {
  const image = event.target as HTMLImageElement;
  if (!image.naturalWidth || !image.naturalHeight) return;
  imageRatios.value = {
    ...imageRatios.value,
    [key]: image.naturalWidth / image.naturalHeight,
  };
}

function openViewer(index: number) {
  const images = processedImages.value;
  const item = images[index];
  if (!item) return;
  // 系统查看器模式：先缓存原图文件，再交给系统默认图片程序。
  if (settingsStore.settings.imageOpenMode === 'system') {
    void CoolapkTauriAPI.openImageInSystemViewer(item.sourceUrl, settingsStore.settings.cachePath)
      .catch((error) => showToast(getErrorMessage(error, '系统图片查看器打开失败'), 'error'));
    return;
  }
  appStore.openImageViewer(images, index, {
    contentId: props.contentId,
    contentType: contentType.value,
  });
}
</script>

<style scoped>
.feed-image-grid {
  display: grid;
  gap: 8px;
  margin-bottom: var(--space-3, 12px);
  width: 100%;
}

.variant-comment {
  max-width: 420px;
  gap: 6px;
  margin-top: 6px;
  margin-bottom: 4px;
}

.variant-comment .grid-item {
  border-radius: 9px;
  box-shadow: none;
}

.variant-comment.count-1 {
  max-width: 240px;
}

.variant-comment.count-1 .grid-item {
  min-height: 80px;
  max-height: 260px !important;
  overflow: hidden;
}

.variant-comment .grid-item.has-natural-size {
  max-height: 260px !important;
  overflow: hidden;
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
  max-height: 520px;
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
  height: 420px;
  max-height: 420px;
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
  transform: translateZ(0);
  isolation: isolate;
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
