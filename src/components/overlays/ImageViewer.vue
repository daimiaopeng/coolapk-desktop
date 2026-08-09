<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="viewerData" class="image-viewer-backdrop" @click="handleBackdropClick">
        <!-- 顶部工具栏 -->
        <div class="viewer-topbar">
          <span class="counter-text">{{ currentIndex + 1 }} / {{ totalCount }}</span>
          <div class="topbar-actions">
            <button class="viewer-btn" title="缩小" @click="zoomOut"><i class="fas fa-search-minus"></i></button>
            <span class="zoom-text">{{ Math.round(scale * 100) }}%</span>
            <button class="viewer-btn" title="放大" @click="zoomIn"><i class="fas fa-search-plus"></i></button>
            <button class="viewer-btn" title="向左旋转 90°" @click="rotateLeft"><i class="fas fa-undo"></i></button>
            <button class="viewer-btn" title="向右旋转 90°" @click="rotateRight"><i class="fas fa-redo"></i></button>
            <button class="viewer-btn" title="重置" @click="resetTransform"><i class="fas fa-compress-arrows-alt"></i></button>
            <button class="viewer-btn" title="复制链接" @click="copyLink"><i class="fas fa-link"></i></button>
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
            alt="Viewer Image"
            class="viewer-img"
            :style="{
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }"
            @load="onImageLoaded"
            @dragstart.prevent
          />
          <div v-else class="viewer-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>正在载入高清大图...</span>
          </div>
        </div>

        <!-- 底部“查看原图”控制栏 -->
        <div class="viewer-bottombar" @click.stop>
          <button
            class="raw-image-btn"
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
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../../stores/app';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { getHdImageUrl, getOriginalImageUrl } from '../../utils/image';
import { loadImageResource } from '../../utils/resourceCache';

const appStore = useAppStore();

const viewerData = computed(() => appStore.activeImageViewer);
const currentIndex = ref(0);
const scale = ref(1);
const rotation = ref(0);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);

const displaySrc = ref<string>('');
let resolveSequence = 0;

const originalLoadedMap = ref<Record<number, boolean>>({});
const originalLoadingMap = ref<Record<number, boolean>>({});

let startX = 0;
let startY = 0;

const totalCount = computed(() => viewerData.value?.urls.length || 0);
const rawUrl = computed(() => viewerData.value?.urls[currentIndex.value] || '');

const currentUrl = computed(() => {
  if (!rawUrl.value) return '';
  // 私信图片等走 API 接口的图片（showImage）不做缩略图后缀处理
  if (rawUrl.value.includes('/v6/message/showImage') || rawUrl.value.includes('api.coolapk.com')) {
    return rawUrl.value;
  }
  if (originalLoadedMap.value[currentIndex.value]) {
    return getOriginalImageUrl(rawUrl.value);
  }
  return getHdImageUrl(rawUrl.value);
});

const isCurrentOriginalLoaded = computed(() => Boolean(originalLoadedMap.value[currentIndex.value]));
const isCurrentOriginalLoading = computed(() => Boolean(originalLoadingMap.value[currentIndex.value]));

async function resolveImageData(url: string) {
  const sequence = ++resolveSequence;
  if (!url) {
    displaySrc.value = '';
    return;
  }
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    displaySrc.value = url;
    return;
  }
  displaySrc.value = '';
  try {
    const dataUrl = await loadImageResource(url, CoolapkTauriAPI.getImageDataUrl);
    if (sequence !== resolveSequence) return;
    displaySrc.value = dataUrl;
  } catch (err) {
    if (sequence !== resolveSequence) return;
    console.warn('看图器加载图片失败:', err);
    displaySrc.value = url; // 备用回退直接使用原 url
  }
}

watch(currentUrl, (newUrl) => {
  if (newUrl) {
    resolveImageData(newUrl);
  }
}, { immediate: true });

watch(viewerData, (val) => {
  if (val) {
    currentIndex.value = val.currentIndex;
    originalLoadedMap.value = {};
    originalLoadingMap.value = {};
    resetTransform();
  }
});

function loadOriginal() {
  const idx = currentIndex.value;
  if (originalLoadedMap.value[idx] || originalLoadingMap.value[idx]) return;

  originalLoadingMap.value = { ...originalLoadingMap.value, [idx]: true };
  originalLoadedMap.value = { ...originalLoadedMap.value, [idx]: true };
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

.counter-text {
  font-size: var(--font-size-sub, 14px);
  font-weight: var(--font-weight-medium, 500);
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
  gap: var(--space-3);
}

.raw-image-btn {
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #ffffff;
  padding: 6px 16px;
  border-radius: var(--radius-pill, 9999px);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.raw-image-btn:hover:not(:disabled) {
  background: rgba(16, 185, 102, 0.85);
  border-color: rgba(16, 185, 102, 1);
  transform: translateY(-1px);
}

.raw-image-btn.is-loaded {
  background: rgba(16, 185, 102, 0.25);
  border-color: rgba(16, 185, 102, 0.5);
  color: var(--brand-primary, #10b966);
  cursor: default;
}
</style>
