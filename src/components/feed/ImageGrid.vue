<template>
  <div v-if="pics && pics.length > 0" class="image-grid" :class="gridClass">
    <div
      v-for="(imgUrl, idx) in pics"
      :key="idx"
      class="img-item-wrapper"
      @click.stop="$emit('open-image', imgUrl)"
    >
      <AppImage
        :src="safeSrc(imgUrl, 'feed')"
        alt="动态图片"
        image-class="feed-img"
        loading="lazy"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { sanitizeImageUrl } from '../../utils/image';
import AppImage from '../common/AppImage.vue';

const props = defineProps<{
  pics: string[];
  normalizeImg: (url: string, type: 'avatar' | 'feed') => string;
}>();

defineEmits<{
  (e: 'open-image', url: string): void;
}>();

// 协议白名单：<img> 是 WebView 原生加载（不走 Rust 代理），
// file: 等异常 scheme 一律替换为空图，防止加载/探测本地文件
function safeSrc(url: string, type: 'avatar' | 'feed'): string {
  const normalized = props.normalizeImg(url, type);
  return sanitizeImageUrl(normalized) ? normalized : '';
}

const gridClass = computed(() => {
  const count = props.pics.length;
  if (count === 1) return 'grid-single';
  if (count === 2) return 'grid-2';
  if (count === 3) return 'grid-3';
  if (count === 4) return 'grid-4';
  return 'grid-multi'; // 5 ~ 9 张
});

</script>

<style scoped>
.image-grid {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.img-item-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color, #e4e9ef);
  background: var(--bg-app, #f5f7f9);
  cursor: zoom-in;
}

.feed-img {
  width: 100%;
  height: 100%;
  display: block;
}

.feed-img :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 1 张图：保持高尚美感，不压缩为小方块 */
.grid-single {
  grid-template-columns: 1fr;
  max-width: 520px;
}

.grid-single .img-item-wrapper {
  max-height: 420px;
}

.grid-single .feed-img {
  width: 100%;
  height: auto;
  max-height: 420px;
  object-fit: cover;
}

.grid-single .feed-img :deep(img) {
  width: 100%;
  height: auto;
  max-height: 420px;
}

/* 2 张图 */
.grid-2 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 520px;
}
.grid-2 .img-item-wrapper {
  aspect-ratio: 16 / 10;
}
.grid-2 .feed-img {
  object-fit: cover;
}

/* 3 张图 */
.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}
.grid-3 .img-item-wrapper {
  aspect-ratio: 1 / 1;
}
.grid-3 .feed-img {
  object-fit: cover;
}

/* 4 张图 (2x2) */
.grid-4 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 440px;
}
.grid-4 .img-item-wrapper {
  aspect-ratio: 1 / 1;
}
.grid-4 .feed-img {
  object-fit: cover;
}

/* 5 ~ 9 张图 (3列) */
.grid-multi {
  grid-template-columns: repeat(3, 1fr);
}
.grid-multi .img-item-wrapper {
  aspect-ratio: 1 / 1;
}
.grid-multi .feed-img {
  object-fit: cover;
}
</style>
