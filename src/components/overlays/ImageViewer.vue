<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="viewerData && !noImageMode" class="image-viewer-backdrop" @click="handleBackdropClick">
        <!-- 顶部工具栏 -->
        <div class="viewer-topbar">
          <div class="topbar-left">
            <span class="counter-text">{{ currentIndex + 1 }} / {{ totalCount }}</span>
            <button
              v-if="currentItem?.isLivePhoto"
              type="button"
              class="topbar-live-badge"
              :class="{ 'is-playing': liveVideoPlaying }"
              :title="liveVideoPlaying ? '点击暂停实况' : '点击播放实况'"
              @click.stop="toggleLivePlayback"
            >
              <span>Live</span>
              <span v-if="liveResolving" class="viewer-live-loading"><i class="fas fa-circle-notch fa-spin"></i></span>
            </button>
          </div>
          <div class="topbar-actions">
            <button class="viewer-btn" title="缩小" @click="zoomOut"><i class="fas fa-search-minus"></i></button>
            <span class="zoom-text">{{ Math.round(scale * 100) }}%</span>
            <button class="viewer-btn" title="放大" @click="zoomIn"><i class="fas fa-search-plus"></i></button>
            <button class="viewer-btn" title="向左旋转 90°" @click="rotateLeft"><i class="fas fa-undo"></i></button>
            <button class="viewer-btn" title="向右旋转 90°" @click="rotateRight"><i class="fas fa-redo"></i></button>
            <button class="viewer-btn" title="重置" @click="resetTransform"><i class="fas fa-compress-arrows-alt"></i></button>
            <button class="viewer-btn" title="复制链接" @click="copyLink"><i class="fas fa-link"></i></button>
            <button
              class="viewer-btn"
              :disabled="savingOriginal"
              :title="savingOriginal ? '正在保存原图' : '保存原图'"
              @click.stop="saveOriginal"
            >
              <i :class="savingOriginal ? 'fas fa-circle-notch fa-spin' : 'fas fa-download'"></i>
            </button>
            <button class="viewer-btn" title="关闭 (Esc)" @click="close"><i class="fas fa-times"></i></button>
          </div>
        </div>

        <!-- 左右导航 -->
        <button v-if="currentIndex > 0" class="nav-arrow nav-prev" @click="prev">
          <i class="fas fa-chevron-left"></i>
        </button>

        <button v-if="currentIndex < totalCount - 1" class="nav-arrow nav-next" @click="next">
          <i class="fas fa-chevron-right"></i>
        </button>

        <!-- 主图片显示区 -->
        <div
          class="image-stage"
          @dblclick="handleDoubleClick"
          @mousedown="startDrag"
          @mousemove="onDrag"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
          @wheel.prevent="handleWheel"
        >
          <img
            v-if="displaySrc"
            :src="displaySrc"
            :data-original-url="originalUrl || undefined"
            alt="Viewer Image"
            class="viewer-img"
            :style="mediaTransformStyle"
            @load="onImageLoaded"
            @dragstart.prevent
          />
          <video
            v-if="currentItem?.isLivePhoto && liveVideoUrl"
            ref="liveVideoRef"
            :key="liveVideoUrl"
            class="viewer-live-video"
            :src="liveVideoUrl"
            :poster="displaySrc || undefined"
            :muted="!liveSoundEnabled"
            loop
            playsinline
            preload="auto"
            :style="{ ...mediaTransformStyle, opacity: liveVideoPlaying ? 1 : 0 }"
            aria-label="Live Photo 实况视频"
            @canplay="handleLiveCanPlay"
            @pause="liveVideoPlaying = false"
            @error="handleLiveVideoError"
          ></video>
          <div v-if="!displaySrc" class="viewer-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>正在载入高清大图...</span>
          </div>
        </div>

        <!-- 底部一体化灵动毛玻璃控制岛 -->
        <div class="viewer-bottombar" @click.stop>
          <div class="viewer-control-island">
            <template v-if="currentItem?.isLivePhoto">
              <button
                type="button"
                class="island-btn live-play-btn"
                :class="{ 'is-active': liveVideoPlaying }"
                :disabled="!liveVideoUrl || liveResolving"
                :title="liveVideoUnsupported ? `当前系统不支持 ${liveVideoUnsupported.name}` : (liveVideoError ? '重新解析并播放实况' : (liveVideoPlaying ? '暂停实况' : '播放实况'))"
                @click.stop="toggleLivePlayback"
              >
                <i :class="liveVideoPlaying ? 'fas fa-pause' : (liveVideoUnsupported ? 'fas fa-ban' : 'fas fa-play')"></i>
                <span>{{ liveResolving ? '加载中' : (liveVideoUnsupported ? '不支持' : (liveVideoError ? '重试' : (liveVideoPlaying ? '实况' : '播放'))) }}</span>
              </button>

              <button
                type="button"
                class="island-btn live-sound-btn"
                :class="{ 'is-active': liveSoundEnabled }"
                :disabled="!liveVideoUrl || liveResolving"
                :title="liveSoundEnabled ? '关闭声音' : '开启原声'"
                @click.stop="toggleLiveSound"
              >
                <i :class="liveSoundEnabled ? 'fas fa-volume-high' : 'fas fa-volume-xmark'"></i>
                <span>{{ liveSoundEnabled ? '原声' : '静音' }}</span>
              </button>

              <div class="island-divider"></div>
            </template>

            <button
              class="island-btn raw-image-btn"
              :class="{ 'is-loaded': isCurrentOriginalLoaded, 'is-loading': isCurrentOriginalLoading }"
              :disabled="isCurrentOriginalLoading || isCurrentOriginalLoaded"
              @click.stop="loadOriginal"
            >
              <i :class="[
                isCurrentOriginalLoading ? 'fas fa-circle-notch fa-spin' :
                isCurrentOriginalLoaded ? 'fas fa-check-circle' : 'fas fa-file-image'
              ]"></i>
              <span>
                {{ isCurrentOriginalLoading ? '正在加载原图...' : (isCurrentOriginalLoaded ? '已加载原图' : '查看原图') }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../../stores/app';
import { useSettingsStore } from '../../stores/settings';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { getHdImageUrl, getOriginalImageUrl } from '../../utils/image';
import { loadImageResource, normalizeResourceUrl } from '../../utils/resourceCache';
import { getErrorMessage } from '../../utils/errors';
import { showToast } from '../../utils/toast';
import { normalizeFeedImageItems, resolveLivePhotoVideo } from '../../utils/livePhoto';
import { detectLiveVideoCodec, getLiveVideoCodecSupport, waitForDecodedVideoFrame, type LiveVideoCodec } from '../../utils/liveVideoCodec';

const appStore = useAppStore();
const settingsStore = useSettingsStore();
const noImageMode = computed(() => settingsStore.settings.noImageMode);

const viewerData = computed(() => appStore.activeImageViewer);
const currentIndex = ref(0);
const scale = ref(1);
const rotation = ref(0);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const savingOriginal = ref(false);

const displaySrc = ref<string>('');
let resolveSequence = 0;

const liveVideoRef = ref<HTMLVideoElement | null>(null);
const liveVideoUrl = ref('');
const liveResolving = ref(false);
const liveVideoPlaying = ref(false);
const liveSoundEnabled = ref(false);
const liveVideoError = ref(false);
const liveVideoUnsupported = ref<LiveVideoCodec | null>(null);
const liveVideoSource = ref<'metadata' | 'resolver' | 'none'>('none');
const liveVideoFallbackAttempted = ref(false);
let liveResolveSequence = 0;
let livePlaybackSequence = 0;
let liveUnsupportedNoticeUrl = '';
const liveVideoCodecChecks = new Map<string, Promise<{ codec: LiveVideoCodec | null; unsupported: boolean }>>();

const originalLoadedMap = ref<Record<number, boolean>>({});
const originalLoadingMap = ref<Record<number, boolean>>({});

let startX = 0;
let startY = 0;

const imageItems = computed(() => normalizeFeedImageItems(viewerData.value?.urls || []));
const currentItem = computed(() => imageItems.value[currentIndex.value] || null);
const totalCount = computed(() => imageItems.value.length);
const rawUrl = computed(() => currentItem.value?.sourceUrl || '');
const mediaTransformStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`,
  cursor: isDragging.value ? 'grabbing' : 'grab',
}));

const currentUrl = computed(() => {
  const item = currentItem.value;
  if (!item) return '';
  const coverUrl = item.coverUrl || item.sourceUrl;
  // 私信图片等走 API 接口的图片（showImage）不做缩略图后缀处理
  if (coverUrl.includes('/v6/message/showImage') || coverUrl.includes('api.coolapk.com')) {
    return coverUrl;
  }
  if (item.isLivePhoto) {
    return normalizeResourceUrl(rawUrl.value || coverUrl);
  }
  if (originalLoadedMap.value[currentIndex.value]) {
    return getOriginalImageUrl(rawUrl.value);
  }
  return getHdImageUrl(coverUrl);
});

const originalUrl = computed(() => {
  if (!rawUrl.value) return '';
  // 私信图片接口本身就返回原图，普通酷安图片则剥离缩略图后缀。
  if (rawUrl.value.includes('/v6/message/showImage') || rawUrl.value.includes('api.coolapk.com')) {
    return rawUrl.value;
  }
  return getOriginalImageUrl(rawUrl.value);
});

const isCurrentOriginalLoaded = computed(() => Boolean(originalLoadedMap.value[currentIndex.value]));
const isCurrentOriginalLoading = computed(() => Boolean(originalLoadingMap.value[currentIndex.value]));

async function resolveImageData(url: string): Promise<boolean> {
  const sequence = ++resolveSequence;
  if (noImageMode.value) {
    displaySrc.value = '';
    return false;
  }
  if (!url) {
    displaySrc.value = '';
    return false;
  }
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    displaySrc.value = url;
    return true;
  }
  displaySrc.value = '';
  try {
    const dataUrl = await loadImageResource(url, CoolapkTauriAPI.getImageDataUrl);
    if (sequence !== resolveSequence) return false;
    displaySrc.value = dataUrl;
    return true;
  } catch (err) {
    if (sequence !== resolveSequence) return false;
    console.warn('看图器加载图片失败:', err);
    displaySrc.value = url; // 备用回退直接使用原 url
    return false;
  }
}

function resetLiveState() {
  liveResolveSequence += 1;
  livePlaybackSequence += 1;
  liveResolving.value = false;
  liveVideoPlaying.value = false;
  liveSoundEnabled.value = settingsStore.settings.autoPlayLivePhotoSound;
  liveVideoError.value = false;
  liveVideoUnsupported.value = null;
  liveVideoFallbackAttempted.value = false;
  liveUnsupportedNoticeUrl = '';
  liveVideoSource.value = currentItem.value?.liveVideoUrl ? 'metadata' : 'none';
  const video = liveVideoRef.value;
  if (video) {
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // 切图时旧视频还没有元数据时无需处理。
    }
  }
  liveVideoUrl.value = currentItem.value?.liveVideoUrl || '';
}

function decodeVideoHeader(encodedHeader: string): Uint8Array | null {
  try {
    const binary = atob(encodedHeader);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function checkLiveVideoCodec(videoUrl: string): Promise<{ codec: LiveVideoCodec | null; unsupported: boolean }> {
  const cached = liveVideoCodecChecks.get(videoUrl);
  if (cached) return await cached;
  const check = (async () => {
    try {
      const header = decodeVideoHeader(await CoolapkTauriAPI.getLivePhotoVideoHeader(videoUrl));
      const codec = header ? detectLiveVideoCodec(header) : null;
      if (!codec) return { codec: null, unsupported: false };
      return { codec, unsupported: await getLiveVideoCodecSupport(codec) === 'unsupported' };
    } catch {
      return { codec: null, unsupported: false };
    }
  })();
  liveVideoCodecChecks.set(videoUrl, check);
  return await check;
}

function showUnsupportedLiveVideoToast(codec: LiveVideoCodec, force = false) {
  if (settingsStore.settings.suppressUnsupportedLivePhotoCodecPrompt) return;
  if (!force && liveUnsupportedNoticeUrl === liveVideoUrl.value) return;
  liveUnsupportedNoticeUrl = liveVideoUrl.value;
  showToast(
    `当前系统不支持该实况照片的视频编码格式（${codec.name}），请安装对应的视频解码组件后重启应用。`,
    'warning',
    6000,
    {
      label: '不再提醒',
      onClick: () => {
        settingsStore.settings.suppressUnsupportedLivePhotoCodecPrompt = true;
      },
    },
  );
}

async function playLiveVideo(forceUnsupportedNotice = false): Promise<boolean> {
  const video = liveVideoRef.value;
  if (!video || !liveVideoUrl.value || liveVideoError.value) return false;
  const playbackSequence = ++livePlaybackSequence;
  liveVideoPlaying.value = false;
  const codecCheck = await checkLiveVideoCodec(liveVideoUrl.value);
  if (playbackSequence !== livePlaybackSequence || video !== liveVideoRef.value) return false;
  if (codecCheck.unsupported && codecCheck.codec) {
    liveVideoUnsupported.value = codecCheck.codec;
    video.pause();
    showUnsupportedLiveVideoToast(codecCheck.codec, forceUnsupportedNotice);
    return false;
  }
  liveVideoUnsupported.value = null;
  video.loop = true;
  video.muted = !liveSoundEnabled.value;
  try {
    await video.play();
    const hasFrame = await waitForDecodedVideoFrame(video);
    if (playbackSequence !== livePlaybackSequence || video !== liveVideoRef.value) return false;
    liveVideoPlaying.value = hasFrame;
    return hasFrame;
  } catch {
    liveVideoPlaying.value = false;
    // 自动播放策略拒绝时保留静态封面，用户点击播放按钮仍可重试。
    return false;
  }
}

async function resolveCurrentLiveVideo(force = false) {
  if (noImageMode.value) {
    clearMediaForNoImageMode();
    return;
  }
  const item = currentItem.value;
  const sequence = ++liveResolveSequence;
  if (!item?.isLivePhoto) return;

  if (item.liveVideoUrl && !force) {
    liveVideoSource.value = 'metadata';
    await nextTick();
    if (sequence === liveResolveSequence) await playLiveVideo();
    return;
  }

  liveResolving.value = true;
  try {
    const videoUrl = await resolveLivePhotoVideo(
      item,
      viewerData.value?.contentId,
      viewerData.value?.contentType || 'feed',
      { force },
    );
    if (sequence !== liveResolveSequence) return;
    if (!videoUrl) {
      liveVideoError.value = true;
      return;
    }
    liveVideoSource.value = 'resolver';
    liveVideoUrl.value = videoUrl;
    await nextTick();
    await playLiveVideo();
  } catch (error) {
    if (sequence === liveResolveSequence) {
      liveVideoError.value = true;
      console.warn('Live Photo 查看器加载失败：', error);
    }
  } finally {
    if (sequence === liveResolveSequence) liveResolving.value = false;
  }
}

function handleLiveCanPlay() {
  void playLiveVideo();
}

async function retryLiveVideoThroughResolver() {
  const item = currentItem.value;
  if (!item?.isLivePhoto || liveVideoFallbackAttempted.value || !item.sourceUrl) return;

  liveVideoFallbackAttempted.value = true;
  livePlaybackSequence += 1;
  liveVideoError.value = false;
  liveVideoPlaying.value = false;
  liveVideoUnsupported.value = null;
  liveVideoSource.value = 'none';
  liveVideoUrl.value = '';
  await nextTick();
  await resolveCurrentLiveVideo(true);
}

async function handleLiveVideoError(event: Event) {
  // 切换地址时旧 video 节点可能晚到一步派发 error，不能覆盖新解析结果。
  if (event.target !== liveVideoRef.value) return;
  const codecCheck = await checkLiveVideoCodec(liveVideoUrl.value);
  if (event.target !== liveVideoRef.value) return;
  if (codecCheck.unsupported && codecCheck.codec) {
    liveVideoUnsupported.value = codecCheck.codec;
    liveVideoPlaying.value = false;
    showUnsupportedLiveVideoToast(codecCheck.codec);
    return;
  }
  liveVideoError.value = true;
  liveVideoPlaying.value = false;
  // imageUriList 里的 liveVideoUrl 可能是旧的直链；失败后按 APK 重新解析一次。
  if (liveVideoSource.value === 'metadata') {
    void retryLiveVideoThroughResolver();
  }
}

async function toggleLivePlayback() {
  const video = liveVideoRef.value;
  if (!video || !liveVideoUrl.value) return;
  if (liveVideoUnsupported.value) {
    showUnsupportedLiveVideoToast(liveVideoUnsupported.value, true);
    return;
  }
  if (video.paused) {
    if (liveVideoError.value && liveVideoSource.value === 'metadata') {
      await retryLiveVideoThroughResolver();
      return;
    }
    liveVideoError.value = false;
    await playLiveVideo(true);
  } else {
    livePlaybackSequence += 1;
    video.pause();
    liveVideoPlaying.value = false;
  }
}

async function toggleLiveSound() {
  if (!liveVideoUrl.value) return;
  liveSoundEnabled.value = !liveSoundEnabled.value;
  const video = liveVideoRef.value;
  if (!video) return;
  video.muted = !liveSoundEnabled.value;
  if (liveSoundEnabled.value && video.paused) await playLiveVideo();
}

watch(viewerData, (val) => {
  if (val) {
    currentIndex.value = Math.min(Math.max(val.currentIndex, 0), Math.max(imageItems.value.length - 1, 0));
    originalLoadedMap.value = {};
    originalLoadingMap.value = {};
    resetTransform();
  } else {
    liveResolveSequence += 1;
    livePlaybackSequence += 1;
    liveVideoUrl.value = '';
    liveVideoPlaying.value = false;
    liveVideoUnsupported.value = null;
  }
});

function clearMediaForNoImageMode() {
  resolveSequence += 1;
  liveResolveSequence += 1;
  livePlaybackSequence += 1;
  displaySrc.value = '';
  originalLoadedMap.value = {};
  originalLoadingMap.value = {};
  liveResolving.value = false;
  liveVideoUrl.value = '';
  liveVideoPlaying.value = false;
  liveVideoError.value = false;
  liveVideoUnsupported.value = null;
  liveVideoSource.value = 'none';
  liveVideoFallbackAttempted.value = false;
  liveUnsupportedNoticeUrl = '';
  const video = liveVideoRef.value;
  if (video) video.pause();
}

function loadCurrentMedia() {
  if (noImageMode.value) {
    clearMediaForNoImageMode();
    return;
  }
  if (settingsStore.settings.autoLoadOriginalImage) {
    void loadOriginal();
  } else if (currentUrl.value) {
    void resolveImageData(currentUrl.value);
  }
  void resolveCurrentLiveVideo();
}

watch(currentItem, () => {
  resetTransform();
  resetLiveState();
  loadCurrentMedia();
}, { immediate: true });

watch(noImageMode, (enabled) => {
  if (enabled) clearMediaForNoImageMode();
  else if (viewerData.value) loadCurrentMedia();
});

async function loadOriginal() {
  if (noImageMode.value) return;
  const idx = currentIndex.value;
  if (originalLoadedMap.value[idx] || originalLoadingMap.value[idx]) return;

  const itemSourceUrl = rawUrl.value;
  const url = originalUrl.value;
  if (!itemSourceUrl || !url) return;

  originalLoadingMap.value = { ...originalLoadingMap.value, [idx]: true };
  try {
    const loaded = await resolveImageData(url);
    if (
      loaded
      && idx === currentIndex.value
      && currentItem.value?.sourceUrl === itemSourceUrl
    ) {
      originalLoadedMap.value = { ...originalLoadedMap.value, [idx]: true };
    }
  } finally {
    if (
      idx === currentIndex.value
      && currentItem.value?.sourceUrl === itemSourceUrl
    ) {
      originalLoadingMap.value = { ...originalLoadingMap.value, [idx]: false };
    }
  }
}

function onImageLoaded() {
  const idx = currentIndex.value;
  if (originalLoadingMap.value[idx]) {
    originalLoadingMap.value = { ...originalLoadingMap.value, [idx]: false };
  }
}

function resetTransform() {
  scale.value = 1;
  rotation.value = 0;
  translateX.value = 0;
  translateY.value = 0;
}

function rotateRight() {
  rotation.value = (rotation.value + 90) % 360;
}

function rotateLeft() {
  rotation.value = (rotation.value - 90 + 360) % 360;
}

function close() {
  appStore.closeImageViewer();
}

function prev() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    resetTransform();
  }
}

function next() {
  if (currentIndex.value < totalCount.value - 1) {
    currentIndex.value++;
    resetTransform();
  }
}

function zoomIn() {
  scale.value = Math.min(Number((scale.value + 0.25).toFixed(2)), 4);
}

function zoomOut() {
  scale.value = Math.max(Number((scale.value - 0.25).toFixed(2)), 0.3);
}

function handleWheel(e: WheelEvent) {
  const delta = e.deltaY < 0 ? 0.15 : -0.15;
  const newScale = Math.min(Math.max(scale.value + delta, 0.3), 5);
  scale.value = Number(newScale.toFixed(2));
}

function handleDoubleClick() {
  if (scale.value === 1) {
    scale.value = 1.8;
  } else {
    resetTransform();
  }
}

let dragStartX = 0;
let dragStartY = 0;
let isDraggedMove = false;

function startDrag(e: MouseEvent) {
  if (e.button !== 0) return; // 仅限左键拖拽
  isDragging.value = true;
  isDraggedMove = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  startX = e.clientX - translateX.value;
  startY = e.clientY - translateY.value;
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return;
  const dist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
  if (dist > 4) {
    isDraggedMove = true;
  }
  translateX.value = e.clientX - startX;
  translateY.value = e.clientY - startY;
}

function stopDrag() {
  setTimeout(() => {
    isDragging.value = false;
  }, 50);
}

function handleBackdropClick(e: MouseEvent) {
  if (isDraggedMove) {
    isDraggedMove = false;
    return;
  }

  const target = e.target as HTMLElement;
  if (!target) return;

  if (target.tagName.toLowerCase() === 'img') return;
  if (target.closest('.viewer-topbar') || target.closest('.viewer-bottombar') || target.closest('.nav-arrow') || target.closest('.raw-image-btn') || target.closest('.viewer-btn')) {
    return;
  }

  close();
}

function copyLink() {
  if (currentUrl.value) {
    navigator.clipboard.writeText(currentUrl.value);
  }
}

async function saveOriginal() {
  if (!originalUrl.value || savingOriginal.value) return;
  savingOriginal.value = true;
  try {
    const path = await CoolapkTauriAPI.saveImage(
      originalUrl.value,
      settingsStore.settings.downloadPath
    );
    showToast(`原图已保存：${path}`, 'success', 3000);
  } catch (error) {
    showToast(getErrorMessage(error, '保存原图失败'), 'error', 3000);
  } finally {
    savingOriginal.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!viewerData.value) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft') prev();
  if (e.key === 'ArrowRight') next();
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<style scoped>
.image-viewer-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.92);
  z-index: 3000;
  display: flex;
  flex-direction: column;
}

.viewer-topbar {
  height: 56px;
  padding: 0 var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #ffffff;
  z-index: 3002;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.counter-text {
  font-size: var(--font-size-sub, 14px);
  font-weight: var(--font-weight-medium, 500);
}

.topbar-live-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 7px;
  border-radius: 4px;
  border: none;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
}

.topbar-live-badge:hover {
  background: rgba(255, 255, 255, 0.25);
}

.topbar-live-badge.is-playing {
  background: rgba(16, 185, 129, 0.8);
  color: #ffffff;
}

.live-badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  transition: all 0.2s ease;
}

.topbar-live-badge.is-playing .live-badge-dot {
  background: #ffffff;
  transform: scale(1.2);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.viewer-btn {
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-control, 8px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.viewer-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.viewer-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.zoom-text {
  font-size: 13px;
  min-width: 44px;
  text-align: center;
}

.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 3002;
  transition: background 0.2s ease;
}

.nav-arrow:hover {
  background: rgba(255, 255, 255, 0.3);
}

.nav-prev { left: 24px; }
.nav-next { right: 24px; }

.image-stage {
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  user-select: none;
}

.viewer-img {
  max-width: 90vw;
  max-height: 88vh;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  transition: transform 0.05s ease-out;
  pointer-events: auto;
}

.viewer-live-video {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  max-width: 90vw;
  max-height: 88vh;
  margin: auto;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.viewer-live-badge {
  position: absolute;
  top: 20px;
  left: 24px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 9px 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  color: #ffffff;
  background: rgba(15, 23, 42, 0.55);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.viewer-live-badge:hover {
  background: rgba(15, 23, 42, 0.75);
  border-color: rgba(255, 255, 255, 0.45);
  transform: scale(1.04);
}

.viewer-live-badge.is-playing {
  background: rgba(16, 185, 129, 0.75);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.45);
}

.live-badge-rings,
.live-badge-rings::before,
.live-badge-rings::after,
.live-badge-rings span {
  display: block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.live-badge-rings {
  position: relative;
  flex: 0 0 9px;
  background: #ffffff;
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.4);
}

.viewer-live-badge.is-playing .live-badge-rings {
  background: #ffffff;
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.6);
}

.live-badge-rings::before,
.live-badge-rings::after,
.live-badge-rings span {
  position: absolute;
  top: 50%;
  left: 50%;
  content: '';
  border: 1px solid rgba(255, 255, 255, 0.75);
  transform: translate(-50%, -50%) scale(0.6);
  animation: live-viewer-ring-pulse 1.8s ease-out infinite;
}

.live-badge-rings::after {
  animation-delay: 0.6s;
}

.live-badge-rings span {
  animation-delay: 1.2s;
}

.viewer-live-loading {
  margin-left: 2px;
  font-size: 10px;
}

.viewer-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.viewer-loading i {
  font-size: 32px;
  color: var(--brand-primary, #10b966);
}

.viewer-bottombar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3002;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-control-island {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: all 0.2s ease;
}

.island-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}

.island-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.island-btn.is-active {
  background: rgba(16, 185, 129, 0.28);
  color: #10b981;
  font-weight: 600;
}

.island-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.live-play-btn i {
  font-size: 11px;
}

.live-sound-btn i {
  font-size: 12px;
}

.island-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.16);
  margin: 0 2px;
}

.raw-image-btn i {
  font-size: 12px;
}

.raw-image-btn.is-loaded {
  color: #10b981;
  cursor: default;
}

@keyframes live-viewer-ring-pulse {
  0% {
    opacity: 0.84;
    transform: translate(-50%, -50%) scale(0.55);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.9);
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-badge-rings::before,
  .live-badge-rings::after,
  .live-badge-rings span,
  .viewer-live-video {
    animation: none;
    transition: none;
  }
}
</style>
