<template>
  <div
    class="live-photo-preview"
    :class="{
      'is-live-photo': item.isLivePhoto,
      'is-playing': isPlaying,
      'is-single': isSingle,
      'is-long': isLong,
    }"
    :aria-label="item.isLivePhoto ? 'Live Photo，悬浮播放' : '图片'"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <AppImage
      :src="staticCoverUrl"
      alt="动态图片"
      image-class="grid-img"
      @load="forwardLoad"
    />

    <video
      v-if="item.isLivePhoto && resolvedVideoUrl"
      ref="videoRef"
      class="live-photo-video"
      :src="resolvedVideoUrl"
      :poster="staticCoverUrl"
      muted
      loop
      playsinline
      preload="none"
      :aria-hidden="!isPlaying"
      :style="{ opacity: isPlaying ? 1 : 0 }"
      @canplay="handleCanPlay"
      @playing="isPlaying = true"
      @pause="isPlaying = false"
      @error="handleVideoError"
    ></video>

    <span v-if="item.isLivePhoto" class="live-badge" title="Live Photo 实况">
      Live
    </span>

    <span v-if="resolving" class="live-photo-loading" aria-live="polite">
      <i class="fas fa-circle-notch fa-spin"></i>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import AppImage from '../common/AppImage.vue';
import { getHdImageUrl } from '../../utils/image';
import { normalizeResourceUrl } from '../../utils/resourceCache';
import {
  resolveLivePhotoVideo,
  type FeedImageItem,
  type LivePhotoContextType,
} from '../../utils/livePhoto';

const props = withDefaults(defineProps<{
  item: FeedImageItem;
  contentId?: string | number;
  contentType?: LivePhotoContextType;
  isSingle?: boolean;
  isLong?: boolean;
}>(), {
  contentType: 'feed',
  isSingle: false,
  isLong: false,
});

const emit = defineEmits<{
  (event: 'load', payload: Event): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
// 列表默认只挂载静态封面；视频地址在首次悬浮时才交给 <video>。
const resolvedVideoUrl = ref('');
const resolving = ref(false);
const isPlaying = ref(false);
const videoError = ref(false);
const videoSource = ref<'metadata' | 'resolver' | 'none'>('none');
const fallbackAttempted = ref(false);
const isHovered = ref(false);
let resolveSequence = 0;

const staticCoverUrl = computed(() => {
  const url = props.item.coverUrl || props.item.sourceUrl;
  return props.item.isLivePhoto ? normalizeResourceUrl(url) : getHdImageUrl(url);
});

function forwardLoad(event: Event) {
  emit('load', event);
}

async function playPreview() {
  if (!isHovered.value || !videoRef.value || videoError.value) return;
  videoRef.value.muted = true;
  videoRef.value.loop = true;
  try {
    await videoRef.value.play();
  } catch {
    // 浏览器自动播放策略拒绝时保留高清静态封面，不打断图片浏览。
    isPlaying.value = false;
  }
}

function handleCanPlay() {
  void playPreview();
}

async function handleMouseEnter() {
  if (!props.item.isLivePhoto) return;
  isHovered.value = true;
  videoError.value = false;

  if (!resolvedVideoUrl.value) {
    const sequence = ++resolveSequence;
    if (props.item.liveVideoUrl) {
      resolvedVideoUrl.value = props.item.liveVideoUrl;
      videoSource.value = 'metadata';
    } else {
      resolving.value = true;
      try {
        const url = await resolveLivePhotoVideo(props.item, props.contentId, props.contentType);
        if (sequence !== resolveSequence || !isHovered.value || !url) return;
        resolvedVideoUrl.value = url;
        videoSource.value = 'resolver';
      } catch (error) {
        if (sequence === resolveSequence) {
          videoError.value = true;
          console.warn('Live Photo 预览加载失败：', error);
        }
      } finally {
        if (sequence === resolveSequence) resolving.value = false;
      }
    }
    await nextTick();
  }

  await nextTick();
  await playPreview();
}

async function retryThroughResolver() {
  if (
    !isHovered.value
    || !props.item.isLivePhoto
    || fallbackAttempted.value
    || !props.item.sourceUrl
  ) return;

  fallbackAttempted.value = true;
  videoError.value = false;
  isPlaying.value = false;
  videoSource.value = 'none';
  resolvedVideoUrl.value = '';
  const sequence = ++resolveSequence;
  resolving.value = true;
  try {
    const url = await resolveLivePhotoVideo(
      props.item,
      props.contentId,
      props.contentType,
      { force: true },
    );
    if (sequence !== resolveSequence || !isHovered.value || !url) return;
    resolvedVideoUrl.value = url;
    videoSource.value = 'resolver';
    await nextTick();
    await playPreview();
  } catch (error) {
    if (sequence === resolveSequence) {
      videoError.value = true;
      console.warn('Live Photo 预览重新解析失败：', error);
    }
  } finally {
    if (sequence === resolveSequence) resolving.value = false;
  }
}

function handleMouseLeave() {
  isHovered.value = false;
  resolveSequence += 1;
  resolving.value = false;
  const video = videoRef.value;
  if (video) {
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // 视频还没有可 seek 的元数据时无需处理。
    }
  }
  isPlaying.value = false;
}

function handleVideoError(event: Event) {
  // 切换地址时旧 video 节点可能晚到一步派发 error，不能覆盖新解析结果。
  if (event.target !== videoRef.value) return;
  videoError.value = true;
  isPlaying.value = false;
  // imageUriList 里的直链失效时，重新走一次 APK 的 showVideo 解析。
  if (videoSource.value === 'metadata') {
    void retryThroughResolver();
  }
}

watch(() => props.item.key, () => {
  handleMouseLeave();
  resolvedVideoUrl.value = '';
  videoError.value = false;
  videoSource.value = 'none';
  fallbackAttempted.value = false;
});

onUnmounted(() => {
  handleMouseLeave();
});
</script>

<style scoped>
.live-photo-preview {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  transform: translateZ(0);
  background: var(--background-secondary, #f0f0f0);
}

.live-photo-preview.is-single {
  position: relative;
  inset: auto;
  width: 100%;
  height: 100%;
  display: block;
}

.live-photo-preview :deep(.app-image-container) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: hidden;
}

.live-photo-preview.is-single :deep(.app-image-container) {
  position: relative;
  inset: auto;
  width: 100%;
  height: 100%;
}

.live-photo-preview :deep(.grid-img img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.live-photo-preview.is-single :deep(.grid-img img) {
  width: 100%;
  height: auto;
  max-height: 520px;
  object-fit: contain;
  border-radius: 12px;
}

.live-photo-preview.is-single.is-long :deep(.grid-img img) {
  height: 420px;
  object-fit: cover;
  object-position: top center;
}

.live-photo-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  background: transparent;
  transition: opacity 0.16s ease;
  pointer-events: none;
}

.live-photo-preview.is-single .live-photo-video {
  object-fit: contain;
}

.live-photo-preview.is-single.is-long .live-photo-video {
  object-fit: cover;
  object-position: top center;
}

.live-badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  z-index: 2;
  display: inline-block;
  padding: 3px 8px 3px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.78);
  color: #222222;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-size: 13px;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.2;
  pointer-events: none;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.live-photo-preview.is-playing .live-badge {
  background: rgba(16, 185, 129, 0.9);
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.45);
}

.live-photo-loading {
  position: absolute;
  left: 6px;
  bottom: 6px;
  z-index: 2;
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  font-size: 10px;
  pointer-events: none;
}

@keyframes live-ring-pulse {
  0% {
    opacity: 0.85;
    transform: translate(-50%, -50%) scale(0.6);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.85);
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-badge-rings::before,
  .live-badge-rings::after,
  .live-badge-rings span {
    animation: none;
  }

  .live-photo-video {
    transition: none;
  }
}
</style>
