<template>
  <div v-if="video" class="feed-video-card" @click.stop>
    <div class="feed-video-frame">
      <video
        ref="videoRef"
        class="feed-video"
        :src="video.url"
        :poster="video.poster || undefined"
        controls
        preload="metadata"
        playsinline
        @play="hasStarted = true"
        @ended="hasStarted = false"
        @error="handleVideoError"
      ></video>

        <button
          v-if="!hasStarted"
        type="button"
        class="feed-video-poster"
        aria-label="播放视频"
        @click.stop="playVideo"
      >
        <AppImage v-if="video.poster" :src="video.poster" alt="视频封面" image-class="video-poster-image" fit="cover" />
        <div v-else class="video-poster-fallback"><i class="fas fa-film"></i></div>
        <span class="video-poster-shade"></span>
        <span class="video-play-button"><i class="fas fa-play"></i></span>
          <span v-if="formattedDuration" class="video-duration">{{ formattedDuration }}</span>
        </button>
        <div v-if="videoError" class="video-error-message">视频加载失败，请重试</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AppImage from '../common/AppImage.vue';
import { formatFeedVideoDuration, getFeedVideo } from '../../utils/feedMedia';

const props = defineProps<{ feed: unknown }>();
const videoRef = ref<HTMLVideoElement | null>(null);
const hasStarted = ref(false);
const video = computed(() => getFeedVideo(props.feed));
const formattedDuration = computed(() => formatFeedVideoDuration(video.value?.duration || ''));
const videoError = ref(false);

async function playVideo() {
  if (!videoRef.value) return;
  videoError.value = false;
  try {
    await videoRef.value.play();
  } catch {
    videoError.value = true;
  }
}

function handleVideoError() {
  videoError.value = true;
}
</script>

<style scoped>
.feed-video-card {
  width: min(100%, 620px);
  margin: 6px 0 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #111827;
}

.feed-video-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  min-height: 180px;
}

.feed-video {
  display: block;
  width: 100%;
  height: 100%;
  background: #000;
  object-fit: contain;
}

.feed-video-poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  color: #fff;
  cursor: pointer;
  background: transparent;
}

.video-poster-image,
.video-poster-fallback,
.video-poster-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.video-poster-image {
  display: block;
}

.video-poster-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.68);
  font-size: 36px;
  background: linear-gradient(135deg, #1f2937, #111827);
}

.video-poster-shade {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.52));
}

.video-play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.52);
  font-size: 20px;
  transform: translate(-50%, -50%);
  transition: transform 0.18s ease, background-color 0.18s ease;
}

.feed-video-poster:hover .video-play-button {
  background: var(--brand-primary, #10b981);
  transform: translate(-50%, -50%) scale(1.06);
}

.video-duration {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 2px 7px;
  border-radius: 5px;
  color: #fff;
  background: rgba(0, 0, 0, 0.68);
  font-size: 12px;
  line-height: 1.4;
}

.video-error-message {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 2px 7px;
  border-radius: 5px;
  color: #fff;
  background: rgba(127, 29, 29, 0.82);
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
}
</style>
