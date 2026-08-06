<template>
  <div class="feed-action-bar">
    <button :class="['action-btn', { 'is-liked': isLiked }]" @click.stop="toggleLike">
      <i :class="[isLiked ? 'fas fa-heart' : 'far fa-heart', 'action-icon']"></i>
      <span>{{ likeCount > 0 ? likeCount : '点赞' }}</span>
    </button>

    <button class="action-btn" @click.stop="$emit('open-comment')">
      <i class="far fa-comment action-icon"></i>
      <span>{{ replyCount > 0 ? replyCount : '评论' }}</span>
    </button>

    <button class="action-btn" @click.stop="shareFeed">
      <i class="far fa-share-square action-icon"></i>
      <span>{{ shareCount > 0 ? shareCount : '转发' }}</span>
    </button>

    <button :class="['action-btn', { 'is-fav': isFav }]" @click.stop="toggleFav">
      <i :class="[isFav ? 'fas fa-bookmark' : 'far fa-bookmark', 'action-icon']"></i>
      <span>{{ favCount > 0 ? favCount : '收藏' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { isFavorite } from '../../utils/favoritesStore';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();

const props = defineProps<{
  feedId: string | number;
  likenum?: number;
  replynum?: number;
  favnum?: number;
  sharenum?: number;
  userAction?: {
    like?: number;
    favorite?: number;
  };
}>();

const emit = defineEmits<{
  (e: 'open-comment'): void;
  (e: 'toggle-fav'): void;
}>();

const isLiked = ref(props.userAction?.like === 1);
const likeCount = ref(props.likenum || 0);

const isFav = ref(props.userAction?.favorite === 1 || isFavorite(props.feedId));
const favCount = ref(props.favnum || 0);

const replyCount = ref(props.replynum || 0);
const shareCount = ref(props.sharenum || 0);

async function toggleLike() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  try {
    if (isLiked.value) {
      isLiked.value = false;
      likeCount.value = Math.max(0, likeCount.value - 1);
      await CoolapkTauriAPI.unlikeFeed(String(props.feedId));
    } else {
      isLiked.value = true;
      likeCount.value += 1;
      await CoolapkTauriAPI.likeFeed(String(props.feedId));
    }
  } catch (err) {
    console.error('Failed to toggle like', err);
  }
}

function toggleFav() {
  isFav.value = !isFav.value;
  favCount.value += isFav.value ? 1 : -1;
  emit('toggle-fav');
}

function shareFeed() {
  console.log('Share feed:', props.feedId);
}
</script>

<style scoped>
.feed-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-light);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-tertiary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  transition: all var(--duration-fast) var(--ease-default);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.action-btn:hover {
  color: var(--text-primary);
  background-color: var(--surface-hover);
}

.action-btn.is-liked {
  color: var(--danger);
}

.action-btn.is-fav {
  color: var(--warning);
}

.action-icon {
  font-size: 15px;
}
</style>
