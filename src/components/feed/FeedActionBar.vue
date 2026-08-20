<template>
  <div class="feed-action-bar">
    <button :class="['action-btn', 'like-btn', { 'is-liked': isLiked }]" @click.stop="toggleLike" title="点赞">
      <i :class="[isLiked ? 'fas fa-heart' : 'far fa-heart', 'action-icon']"></i>
      <span>{{ formatCount(likeCount, '点赞') }}</span>
    </button>

    <button class="action-btn comment-btn" @click.stop="$emit('open-comment')" title="评论">
      <i class="far fa-comment action-icon"></i>
      <span>{{ formatCount(replyCount, '评论') }}</span>
    </button>

    <button class="action-btn share-btn" @click.stop="shareFeed" title="转发">
      <i class="fas fa-retweet action-icon"></i>
      <span>{{ formatCount(shareCount, '转发') }}</span>
    </button>

    <button :class="['action-btn', 'fav-btn', { 'is-fav': isFav }]" @click.stop="toggleFav" title="收藏">
      <i :class="[isFav ? 'fas fa-bookmark' : 'far fa-bookmark', 'action-icon']"></i>
      <span>{{ formatCount(favnum, '收藏') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';

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
  (e: 'forward'): void;
}>();

const isLiked = ref(props.userAction?.like === 1);
const likeCount = ref(props.likenum || 0);

const isFav = ref(props.userAction?.favorite === 1);

const replyCount = ref(props.replynum || 0);
const shareCount = ref(props.sharenum || 0);

function formatCount(num?: number, defaultText: string = ''): string {
  if (!num || num <= 0) return defaultText;
  if (num >= 10000) {
    const val = (num / 10000).toFixed(1);
    return `${val.endsWith('.0') ? val.slice(0, -2) : val}万`;
  }
  return String(num);
}

// 动态详情可能异步到达，需同步 props 更新
watch(
  () => [props.likenum, props.replynum, props.sharenum] as const,
  ([like, reply, share]) => {
    if (like !== undefined) likeCount.value = like;
    if (reply !== undefined) replyCount.value = reply;
    if (share !== undefined) shareCount.value = share;
  }
);

watch(
  () => [props.userAction?.like, props.userAction?.favorite] as const,
  ([like, favorite]) => {
    if (like !== undefined) isLiked.value = like === 1;
    if (favorite !== undefined) isFav.value = favorite === 1;
  }
);

async function toggleLike() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const prevLiked = isLiked.value;
  const prevCount = likeCount.value;
  const nextLiked = !prevLiked;
  isLiked.value = nextLiked;
  likeCount.value = Math.max(0, prevCount + (nextLiked ? 1 : -1));
  try {
    if (nextLiked) {
      await CoolapkTauriAPI.likeFeed(String(props.feedId));
    } else {
      await CoolapkTauriAPI.unlikeFeed(String(props.feedId));
    }
  } catch (err: any) {
    isLiked.value = prevLiked;
    likeCount.value = prevCount;
    const msg = getErrorMessage(err, '点赞操作失败');
    if (msg.includes('网络') || msg.includes('err_')) {
      showToast('酷安服务端风控拦截（需官方手机环境），点赞失败', 'error');
    } else {
      showToast(msg, 'error');
    }
  }
}

function toggleFav() {
  isFav.value = !isFav.value;
  emit('toggle-fav');
}

function shareFeed() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  emit('forward');
}
</script>

<style scoped>
.feed-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  border-top: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  padding-top: 8px;
  margin-top: 10px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 14px;
  font-weight: 500;
  padding: 6px 16px;
  border-radius: 18px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0, 0.2, 1);
}

.action-btn:hover {
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.04));
  color: var(--text-primary);
}

.action-btn:hover .action-icon {
  transform: scale(1.15);
}

.like-btn:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.08);
}

.like-btn.is-liked {
  color: #ef4444;
  font-weight: 600;
}

.like-btn.is-liked .action-icon {
  animation: heartPulse 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.comment-btn:hover {
  color: var(--brand-primary, #10b981);
  background-color: rgba(16, 185, 129, 0.08);
}

.share-btn:hover {
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.08);
}

.fav-btn:hover {
  color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.08);
}

.fav-btn.is-fav {
  color: #f59e0b;
  font-weight: 600;
}

@keyframes heartPulse {
  0% { transform: scale(1); }
  40% { transform: scale(1.4); }
  80% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

.action-icon {
  font-size: 15px;
  transition: transform 0.2s ease;
}
</style>
