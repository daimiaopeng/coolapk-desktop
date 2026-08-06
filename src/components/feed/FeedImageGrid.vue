<template>
  <div v-if="processedImages && processedImages.length > 0" :class="['feed-image-grid', `count-${gridCount}`]">
    <div
      v-for="(url, index) in processedImages"
      :key="index"
      class="grid-item"
      @click.stop="openViewer(index)"
    >
      <AppImage :src="getHdImageUrl(url)" alt="feed image" image-class="grid-img" />
      <div v-if="processedImages.length >= 3 && index === processedImages.length - 1" class="image-count-badge">
        {{ processedImages.length }}图
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../../stores/app';
import { useSettingsStore } from '../../stores/settings';
import AppImage from '../common/AppImage.vue';
import { getHdImageUrl } from '../../utils/image';

const props = defineProps<{
  images?: string[];
}>();

const appStore = useAppStore();
const settingsStore = useSettingsStore();

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

function openViewer(index: number) {
  if (props.images) {
    appStore.openImageViewer(props.images, index);
  }
}
</script>

<style scoped>
.feed-image-grid {
  display: grid;
  gap: 6px;
  margin-bottom: var(--space-3);
  width: 100%;
}

.count-1 {
  grid-template-columns: 1fr;
  max-width: 380px;
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
  border-radius: var(--radius-control);
  overflow: hidden;
  background-color: var(--background-secondary);
  cursor: pointer;
}

.grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--duration-fast) var(--ease-default);
}

.grid-item:hover .grid-img {
  transform: scale(1.03);
}

.image-count-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
  pointer-events: none;
}
</style>
