<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="viewerData" class="image-viewer-backdrop" @click="close">
        <!-- 顶部工具栏 -->
        <div class="viewer-topbar" @click.stop>
          <span class="counter-text">{{ currentIndex + 1 }} / {{ totalCount }}</span>
          <div class="topbar-actions">
            <button class="viewer-btn" title="缩小" @click="zoomOut"><i class="fas fa-search-minus"></i></button>
            <span class="zoom-text">{{ Math.round(scale * 100) }}%</span>
            <button class="viewer-btn" title="放大" @click="zoomIn"><i class="fas fa-search-plus"></i></button>
            <button class="viewer-btn" title="重置" @click="resetTransform"><i class="fas fa-compress-arrows-alt"></i></button>
            <button class="viewer-btn" title="复制链接" @click="copyLink"><i class="fas fa-link"></i></button>
            <button class="viewer-btn" title="关闭 (Esc)" @click="close"><i class="fas fa-times"></i></button>
          </div>
        </div>

        <!-- 左右导航 -->
        <button v-if="currentIndex > 0" class="nav-arrow nav-prev" @click.stop="prev">
          <i class="fas fa-chevron-left"></i>
        </button>

        <button v-if="currentIndex < totalCount - 1" class="nav-arrow nav-next" @click.stop="next">
          <i class="fas fa-chevron-right"></i>
        </button>

        <!-- 主图片显示 -->
        <div
          class="image-stage"
          @click.stop
          @mousedown="startDrag"
          @mousemove="onDrag"
          @mouseup="stopDrag"
          @wheel.prevent="handleWheel"
        >
          <AppImage
            :src="currentUrl"
            alt="Viewer Image"
            class="viewer-img"
            :style="{
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }"
            @load="onImageLoaded"
          />
        </div>

        <!-- 底部微博风格“查看原图”浮动按钮 -->
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
import AppImage from '../common/AppImage.vue';
import { getHdImageUrl, getOriginalImageUrl } from '../../utils/image';

const appStore = useAppStore();

const viewerData = computed(() => appStore.activeImageViewer);
const currentIndex = ref(0);
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);

const originalLoadedMap = ref<Record<number, boolean>>({});
const originalLoadingMap = ref<Record<number, boolean>>({});

let startX = 0;
let startY = 0;

const totalCount = computed(() => viewerData.value?.urls.length || 0);
const rawUrl = computed(() => viewerData.value?.urls[currentIndex.value] || '');

const currentUrl = computed(() => {
  if (!rawUrl.value) return '';
  // 如果已触发加载原图，使用原图 URL；否则默认使用酷安高清压缩图
  if (originalLoadedMap.value[currentIndex.value]) {
    return getOriginalImageUrl(rawUrl.value);
  }
  return getHdImageUrl(rawUrl.value);
});

const isCurrentOriginalLoaded = computed(() => Boolean(originalLoadedMap.value[currentIndex.value]));
const isCurrentOriginalLoading = computed(() => Boolean(originalLoadingMap.value[currentIndex.value]));

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
  translateX.value = 0;
  translateY.value = 0;
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
  scale.value = Math.min(scale.value + 0.25, 4);
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.25, 0.5);
}

function handleWheel(e: WheelEvent) {
  if (e.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
}

function startDrag(e: MouseEvent) {
  isDragging.value = true;
  startX = e.clientX - translateX.value;
  startY = e.clientY - translateY.value;
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return;
  translateX.value = e.clientX - startX;
  translateY.value = e.clientY - startY;
}

function stopDrag() {
  isDragging.value = false;
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
  background-color: rgba(0, 0, 0, 0.9);
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
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
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
  border-radius: var(--radius-control);
  transition: all var(--duration-fast) var(--ease-default);
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
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3002;
  transition: background var(--duration-fast) var(--ease-default);
}

.nav-arrow:hover {
  background: rgba(255, 255, 255, 0.3);
}

.nav-prev { left: 24px; }
.nav-next { right: 24px; }

.image-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.viewer-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  transition: transform 0.05s ease-out;
  user-select: none;
}

/* 微博风格：底部中置“查看原图”悬浮控制栏 */
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
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
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
