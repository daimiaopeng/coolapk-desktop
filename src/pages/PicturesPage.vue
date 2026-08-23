<template>
  <div class="pictures-page custom-scrollbar" @scroll="handleScroll">
    <!-- 首页同款纯粹顶栏 Tab -->
    <div class="pictures-tabs-bar">
      <div class="pictures-tabs">
        <button
          v-for="tag in pictureTags"
          :key="tag"
          type="button"
          :class="['tab-item', { 'is-active': activeTag === tag }]"
          @click="switchTag(tag)"
        >
          <span>{{ tag }}</span>
          <span v-if="activeTag === tag" class="coolapk-tab-indicator"></span>
        </button>
      </div>
    </div>

    <div class="pictures-content-area">
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
const error = ref('');
const page = ref(1);
const noMore = ref(false);

function pictureIdOf(item: any): string {
  return String(item?.id || item?.feed_id || item?.entityId || '');
}

function usernameOf(item: any): string {
  return String(item?.username || item?.userAction?.username || item?.userInfo?.username || '');
}

function avatarOf(item: any): string {
  return String(item?.userAvatar || item?.userAction?.userAvatar || item?.userInfo?.userAvatar || '');
}

function plainMessageOf(item: any): string {
  const raw = String(item?.message || item?.feed_title || item?.title || '');
  return coolapkHtmlToPlainText(raw).trim();
}

function picListOf(item: any): string[] {
  let list: any[] = [];
  if (Array.isArray(item?.pics) && item.pics.length > 0) {
    list = item.pics;
  } else if (Array.isArray(item?.picArr) && item.picArr.length > 0) {
    list = item.picArr;
  } else if (Array.isArray(item?.extra_pic) && item.extra_pic.length > 0) {
    list = item.extra_pic;
  } else if (item?.pic) {
    list = [item.pic];
  }
  return list
    .map((p: any) => String(typeof p === 'string' ? p : p?.url || p?.pic || p?.image || ''))
    .filter((u: string) => u.trim() && u !== 'null' && u !== 'undefined');
}

function displayedPicsOf(item: any): string[] {
  return picListOf(item).slice(0, MAX_DISPLAY_PICS);
}

function openViewer(item: any, initialIndex: number) {
  const urls = picListOf(item);
  if (urls.length > 0) {
    appStore.openImageViewer(urls, initialIndex);
  }
}

function switchTag(tag: string) {
  if (activeTag.value === tag) return;
  activeTag.value = tag;
  void fetchPictures(true);
}

async function fetchPictures(isRefresh = false) {
  if (loading.value) return;
  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    pictures.value = [];
  }
  if (noMore.value && !isRefresh) return;

  loading.value = true;
  error.value = '';

  try {
    const tag = activeTag.value === '全部' ? '' : activeTag.value;
    const res: any = await CoolapkTauriAPI.getPictureList(tag, page.value);
    const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

    if (list.length === 0) {
      noMore.value = true;
    } else {
      if (isRefresh || page.value === 1) {
        pictures.value = list;
      } else {
        const existingIds = new Set(pictures.value.map(pictureIdOf));
        const newItems = list.filter((it: any) => !existingIds.has(pictureIdOf(it)));
        pictures.value.push(...newItems);
      }
      if (list.length < 10) {
        noMore.value = true;
      } else {
        page.value++;
      }
    }
  } catch (err: any) {
    error.value = err?.message || '获取酷图失败，请检查网络';
  } finally {
    loading.value = false;
  }
}

function handleScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
    if (!loading.value && !noMore.value) {
      void fetchPictures(false);
    }
  }
}

onMounted(() => {
  void fetchPictures(false);
});
</script>

<style scoped>
.pictures-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background-color: var(--background-secondary, var(--surface));
  display: flex;
  flex-direction: column;
}

.pictures-tabs-bar {
  display: flex;
  align-items: center;
  background-color: var(--surface);
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  height: 48px;
  min-height: 48px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100%;
  box-sizing: border-box;
}

.pictures-tabs {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
  height: 100%;
  overflow-x: auto;
  flex: 1;
  user-select: none;
  scrollbar-width: none;
}

.pictures-tabs::-webkit-scrollbar {
  display: none;
}

.tab-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  height: 100%;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.15s ease;
  white-space: nowrap;
  background: transparent;
  cursor: pointer;
  border: none;
  outline: none;
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.is-active {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 16px;
}

/* 酷安 APP 标志性绿色胶囊指示条 */
.coolapk-tab-indicator {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 3.5px;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
}

.pictures-content-area {
  padding: 16px 20px;
  flex: 1;
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
