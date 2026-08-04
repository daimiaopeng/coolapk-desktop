<template>
  <div v-if="images && images.length > 0" :class="['feed-image-grid', `count-${gridCount}`]">
    <div
      v-for="(url, index) in processedImages"
      :key="index"
      class="grid-item"
      @click.stop="openViewer(index)"
    >
      <AppImage :src="getHdImageUrl(url)" alt="feed image" image-class="grid-img" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../../stores/app';
import AppImage from '../common/AppImage.vue';
import { getHdImageUrl } from '../../utils/image';

const props = defineProps<{
  images?: string[];
}>();

const appStore = useAppStore();

const gridCount = computed(() => {
  if (!props.images) return 0;
  return Math.min(props.images.length, 9);
});

const processedImages = computed(() => {
  return props.images || [];
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
</style>
