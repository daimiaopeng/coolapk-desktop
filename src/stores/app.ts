import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { FeedImageInput, LivePhotoContextType } from '../utils/livePhoto';

export interface ImageViewerContext {
  contentId?: string | number;
  contentType?: LivePhotoContextType;
}

export interface ImageViewerState extends ImageViewerContext {
  urls: FeedImageInput[];
  currentIndex: number;
}

export const useAppStore = defineStore('app', () => {
  const isSearchOpen = ref(false);
  const isPublishOpen = ref(false);
  const feedDetailContexts = ref<Record<string, any>>({});
  const activeImageViewer = ref<ImageViewerState | null>(null);

  function openSearch() {
    isSearchOpen.value = true;
  }

  function closeSearch() {
    isSearchOpen.value = false;
  }

  function openPublish() {
    isPublishOpen.value = true;
  }

  function closePublish() {
    isPublishOpen.value = false;
  }

  function setFeedDetailContext(feedId: string | number, feed: any) {
    if (!feed) return;
    feedDetailContexts.value = {
      ...feedDetailContexts.value,
      [String(feedId)]: feed,
    };
  }

  function getFeedDetailContext(feedId: string | number) {
    return feedDetailContexts.value[String(feedId)] || null;
  }

  function openImageViewer(
    urls: FeedImageInput[],
    currentIndex: number = 0,
    context: ImageViewerContext = {},
  ) {
    activeImageViewer.value = {
      urls,
      currentIndex,
      ...(context.contentId !== undefined ? { contentId: context.contentId } : {}),
      ...(context.contentType ? { contentType: context.contentType } : {}),
    };
  }

  function closeImageViewer() {
    activeImageViewer.value = null;
  }

  return {
    isSearchOpen,
    isPublishOpen,
    feedDetailContexts,
    activeImageViewer,
    openSearch,
    closeSearch,
    openPublish,
    closePublish,
    setFeedDetailContext,
    getFeedDetailContext,
    openImageViewer,
    closeImageViewer
  };
});
