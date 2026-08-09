<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <!-- 头部区域 -->
    <div class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title">
            <i class="fas fa-images icon"></i> 酷图广场
          </h2>
          <span class="page-subtitle">精选酷安热门图片动态，一屏看图不费流量</span>
        </div>
      </div>

      <!-- 标签筛选栏 -->
      <div class="category-tabs">
        <button
          v-for="tag in pictureTags"
          :key="tag"
          :class="['cat-tab', { active: activeTag === tag }]"
          @click="switchTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading && pictures.length === 0" class="loading-wrapper">
      <LoadingState text="正在加载酷图..." />
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error && pictures.length === 0" class="error-wrapper">
      <ErrorState title="加载失败" :message="error" @retry="fetchPictures(true)" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="pictures.length === 0" class="empty-wrapper">
      <EmptyState title="暂无酷图" description="该标签下暂时没有图片动态，试试其他标签吧" />
    </div>

    <!-- 瀑布流展示 -->
    <template v-else>
      <div class="masonry-grid">
        <div v-for="(item, idx) in pictures" :key="pictureIdOf(item) || idx" class="picture-card">
          <div v-if="displayedPicsOf(item).length > 0" class="pic-thumbs" :class="picListOf(item).length === 1 ? 'single' : 'multi'">
            <div
              v-for="(pic, picIdx) in displayedPicsOf(item)"
              :key="picIdx"
              class="pic-thumb"
              @click.stop="openViewer(item, picIdx)"
            >
              <AppImage
                :src="pic"
                :alt="usernameOf(item) || '酷图'"
                fit="cover"
                image-class="thumb-img"
              />
              <span v-if="picIdx === 0 && picListOf(item).length > 1" class="pic-count-badge">
                {{ picListOf(item).length }}图
              </span>
            </div>
          </div>

          <div class="picture-card-info">
            <div class="picture-author">
              <AppAvatar :src="avatarOf(item)" size="sm" :alt="usernameOf(item) || '酷友'" />
              <span class="picture-username">{{ usernameOf(item) || '酷友' }}</span>
            </div>
            <p v-if="plainMessageOf(item)" class="picture-message">{{ plainMessageOf(item) }}</p>
          </div>
        </div>
      </div>

      <!-- 底部加载状态 -->
      <div class="pagination-footer">
        <LoadingState v-if="loading && page > 1" text="正在加载更多酷图..." />
        <button v-else-if="error" class="retry-inline" @click="fetchPictures(true)">加载失败，点击重试</button>
        <div v-else-if="noMore" class="no-more">已加载全部酷图</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppStore } from '../stores/app';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import AppAvatar from '../components/common/AppAvatar.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { coolapkHtmlToPlainText } from '../utils/sanitizeHtml';

const appStore = useAppStore();

const pictureTags = ['全部', '手机', '摄影', '动漫', '风景', '美食'];
const activeTag = ref('全部');
const MAX_DISPLAY_PICS = 4;

const pictures = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const noMore = ref(false);
const error = ref('');

function pictureIdOf(item: any): string {
  return String(item?.id ?? item?.feedId ?? item?.entityId ?? item?.title ?? '');
}

function picListOf(item: any): string[] {
  const list = item?.pics || item?.picArr || (item?.pic ? [item.pic] : []);
  if (!Array.isArray(list)) return [];
  return list.filter((u: any) => typeof u === 'string' && u.trim() && u.trim() !== 'null' && u.trim() !== 'undefined');
}

function displayedPicsOf(item: any): string[] {
  return picListOf(item).slice(0, MAX_DISPLAY_PICS);
}

function avatarOf(item: any): string {
  return item?.userAvatar || item?.userInfo?.userAvatar || '';
}

function usernameOf(item: any): string {
  return item?.username || item?.userInfo?.username || '';
}

function messageOf(item: any): string {
  const msg = item?.message || item?.message_raw_output || '';
  return typeof msg === 'string' ? msg.trim() : '';
}

// 酷安 message 是富文本 HTML（含 <a> 等标签），文本插值渲染需先转纯文本
function plainMessageOf(item: any): string {
  return coolapkHtmlToPlainText(messageOf(item));
}

function openViewer(item: any, index: number) {
  const urls = picListOf(item);
  if (urls.length === 0) return;
  appStore.openImageViewer(urls, index);
}

function switchTag(tag: string) {
  if (activeTag.value === tag) return;
  activeTag.value = tag;
  page.value = 1;
  noMore.value = false;
  error.value = '';
  pictures.value = [];
  void fetchPictures(false);
}

async function fetchPictures(isLoadMore = false) {
  if (loading.value || noMore.value) return;
  loading.value = true;
  if (!isLoadMore) error.value = '';

  try {
    const tag = activeTag.value === '全部' ? '' : activeTag.value;
    const res = await CoolapkTauriAPI.getPictureList(tag, page.value);
    const list = (res && Array.isArray(res.data)) ? res.data : [];

    if (list.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        const existingIds = new Set(pictures.value.map(pictureIdOf));
        pictures.value.push(...list.filter((i: any) => !existingIds.has(pictureIdOf(i))));
      } else {
        pictures.value = list;
      }
      page.value++;
    }
  } catch (err: any) {
    error.value = err?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
  }
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 200) {
    if (!loading.value && !noMore.value) {
      void fetchPictures(true);
    }
  }
}

onMounted(() => {
  void fetchPictures(false);
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0;
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title .icon {
  color: var(--brand-primary);
}

.page-subtitle {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
}

.category-tabs {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.cat-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cat-tab:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.cat-tab.active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.loading-wrapper,
.error-wrapper,
.empty-wrapper {
  padding: var(--space-10) 0;
}

.masonry-grid {
  column-count: 3;
  column-gap: var(--space-4);
}

@media (max-width: 1100px) {
  .masonry-grid {
    column-count: 2;
  }
}

@media (max-width: 640px) {
  .masonry-grid {
    column-count: 1;
  }
}

.picture-card {
  break-inside: avoid;
  margin-bottom: var(--space-4);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  transition: border-color var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
}

.picture-card:hover {
  border-color: var(--brand-primary);
  transform: translateY(-2px);
}

.pic-thumbs {
  display: grid;
  gap: 3px;
}

.pic-thumbs.single {
  display: block;
}

.pic-thumbs.single .pic-thumb {
  aspect-ratio: 4 / 3;
}

.pic-thumbs.multi {
  grid-template-columns: repeat(2, 1fr);
}

.pic-thumbs.multi .pic-thumb {
  aspect-ratio: 1 / 1;
}

.pic-thumb {
  position: relative;
  overflow: hidden;
  background-color: var(--background-secondary);
  cursor: zoom-in;
}

.thumb-img {
  width: 100%;
  height: 100%;
  transition: transform var(--duration-normal) var(--ease-default);
}

.pic-thumb:hover .thumb-img {
  transform: scale(1.03);
}

.pic-count-badge {
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

.picture-card-info {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picture-author {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.picture-username {
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picture-message {
  margin: 0;
  font-size: 13px;
  line-height: var(--line-height-sub);
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.pagination-footer {
  padding: var(--space-4) 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.retry-inline {
  border: 0;
  background: transparent;
  color: var(--brand-primary);
  cursor: pointer;
  font-size: var(--font-size-caption);
}
</style>
