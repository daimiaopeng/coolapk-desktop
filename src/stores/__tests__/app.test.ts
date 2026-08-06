import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore } from '../../stores/app';

describe('app store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('has default state with all panels closed', () => {
    const store = useAppStore();
    expect(store.isSearchOpen).toBe(false);
    expect(store.isPublishOpen).toBe(false);
    expect(store.activeCommentFeedId).toBeNull();
    expect(store.activeImageViewer).toBeNull();
  });

  it('openSearch sets isSearchOpen to true', () => {
    const store = useAppStore();
    store.openSearch();
    expect(store.isSearchOpen).toBe(true);
  });

  it('closeSearch sets isSearchOpen to false', () => {
    const store = useAppStore();
    store.openSearch();
    store.closeSearch();
    expect(store.isSearchOpen).toBe(false);
  });

  it('openPublish / closePublish toggles publish dialog', () => {
    const store = useAppStore();
    store.openPublish();
    expect(store.isPublishOpen).toBe(true);
    store.closePublish();
    expect(store.isPublishOpen).toBe(false);
  });

  it('openCommentDrawer sets active feed id', () => {
    const store = useAppStore();
    store.openCommentDrawer('feed-123');
    expect(store.activeCommentFeedId).toBe('feed-123');
  });

  it('closeCommentDrawer clears active feed id', () => {
    const store = useAppStore();
    store.openCommentDrawer(456);
    store.closeCommentDrawer();
    expect(store.activeCommentFeedId).toBeNull();
  });

  it('openImageViewer stores urls and current index', () => {
    const store = useAppStore();
    store.openImageViewer(['a.jpg', 'b.jpg'], 1);
    expect(store.activeImageViewer).toEqual({
      urls: ['a.jpg', 'b.jpg'],
      currentIndex: 1,
    });
  });

  it('closeImageViewer clears image viewer state', () => {
    const store = useAppStore();
    store.openImageViewer(['x.jpg'], 0);
    store.closeImageViewer();
    expect(store.activeImageViewer).toBeNull();
  });
});
