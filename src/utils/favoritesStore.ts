import { ref } from 'vue';
import type { FeedItem } from '../types/feed';

const STORAGE_KEY = 'coolapk-desktop-favorites';

function loadFavorites(): FeedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((f) => f && f.id != null);
      }
    }
  } catch (err) {
    console.warn('[FavoritesStore] Failed to load favorites from localStorage:', err);
  }
  return [];
}

const favorites = ref<FeedItem[]>(loadFavorites());

export { favorites };

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.value));
  } catch (err) {
    console.warn('[FavoritesStore] Failed to save favorites:', err);
  }
}

export function getFavorites(): FeedItem[] {
  return favorites.value.slice();
}

export function isFavorite(feedId: string | number): boolean {
  const id = String(feedId);
  return favorites.value.some((f) => String(f.id) === id);
}

export function addFavorite(feed: FeedItem) {
  const id = String(feed.id);
  if (favorites.value.some((f) => String(f.id) === id)) return;
  favorites.value.unshift(feed);
  persist();
}

export function importFavorites(feeds: FeedItem[]) {
  if (!Array.isArray(feeds)) return 0;
  const existing = new Set(favorites.value.map((f) => String(f.id)));
  const added: FeedItem[] = [];
  for (const feed of feeds) {
    if (!feed || feed.id == null) continue;
    const id = String(feed.id);
    if (existing.has(id)) continue;
    existing.add(id);
    added.push(feed);
  }
  if (added.length > 0) {
    favorites.value.unshift(...added);
    persist();
  }
  return added.length;
}

export function removeFavorite(feedId: string | number) {
  const id = String(feedId);
  favorites.value = favorites.value.filter((f) => String(f.id) !== id);
  persist();
}

export function clearFavorites() {
  favorites.value = [];
  persist();
}
