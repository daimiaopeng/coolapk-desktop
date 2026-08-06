import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const isSearchOpen = ref(false);
  const isPublishOpen = ref(false);
  const activeCommentFeedId = ref<string | number | null>(null);
  const activeCommentFeed = ref<any>(null);
  const activeImageViewer = ref<{ urls: string[]; currentIndex: number } | null>(null);

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

  function openCommentDrawer(feedId: string | number, feed?: any) {
    activeCommentFeedId.value = feedId;
    activeCommentFeed.value = feed || null;
  }

  function closeCommentDrawer() {
    activeCommentFeedId.value = null;
    activeCommentFeed.value = null;
  }

  function openImageViewer(urls: string[], currentIndex: number = 0) {
    activeImageViewer.value = { urls, currentIndex };
  }

  function closeImageViewer() {
    activeImageViewer.value = null;
  }

  return {
    isSearchOpen,
    isPublishOpen,
    activeCommentFeedId,
    activeCommentFeed,
    activeImageViewer,
    openSearch,
    closeSearch,
    openPublish,
    closePublish,
    openCommentDrawer,
    closeCommentDrawer,
    openImageViewer,
    closeImageViewer
  };
});
