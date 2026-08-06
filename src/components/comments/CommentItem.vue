<template>
  <div class="comment-item">
    <AppAvatar :src="comment.userAvatar || comment.userInfo?.userAvatar" size="sm" />
    <div class="comment-content">
      <div class="comment-header">
        <span class="username">
          {{ comment.username || comment.userInfo?.username || '酷友' }}
          <span v-if="isLouzhu" class="louzhu-badge">楼主</span>
        </span>
        <span class="dateline">{{ comment.dateline }}</span>
      </div>

      <div class="comment-body" v-html="comment.message"></div>

      <div class="comment-actions">
        <button :class="['action-link', 'like-btn', { 'is-liked': isLiked }]" @click="toggleLike">
          <i :class="[isLiked ? 'fas fa-heart' : 'far fa-heart']"></i>
          <span>{{ likeCount > 0 ? formatCount(likeCount) : '赞' }}</span>
        </button>
        <button class="action-link" @click="$emit('reply', comment)">
          <i class="far fa-comment"></i> 回复
        </button>
      </div>

      <!-- 楼中楼列表：先展示接口内嵌的 rlist，可展开加载全部 -->
      <div v-if="displaySubReplies.length > 0" class="sub-comments">
        <div v-for="reply in displaySubReplies" :key="reply.id" class="sub-item">
          <span class="sub-username">{{ reply.username || reply.userInfo?.username || '酷友' }}:</span>
          <span class="sub-text" v-html="reply.message"></span>
          <button
            :class="['sub-like-btn', { 'is-liked': isSubLiked(reply) }]"
            @click.stop="toggleSubLike(reply)"
          >
            <i :class="[isSubLiked(reply) ? 'fas fa-heart' : 'far fa-heart']"></i>
            <span>{{ getSubLikeCount(reply) > 0 ? formatCount(getSubLikeCount(reply)) : '赞' }}</span>
          </button>
        </div>

        <div v-if="subLoading" class="sub-loading">
          <LoadingState text="加载楼中楼..." />
        </div>

        <button v-else-if="subError" class="sub-more-btn" @click="toggleExpand">
          <i class="fas fa-rotate"></i> 重试加载楼中楼
        </button>

        <button v-else-if="canLoadMoreSub" class="sub-more-btn" @click="loadMoreSubReplies">
          加载更多楼中楼 <i class="fas fa-chevron-down"></i>
        </button>
      </div>

      <button
        v-if="!expanded && subTotal > displaySubReplies.length"
        class="sub-expand-btn"
        @click="toggleExpand"
      >
        展开全部 {{ subTotal }} 条楼中楼 <i class="fas fa-chevron-down"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { CommentItem as CommentType } from '../../types/comment';
import AppAvatar from '../common/AppAvatar.vue';
import LoadingState from '../common/LoadingState.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();

const props = defineProps<{
  comment: CommentType;
  feedId?: string | number;
  isLouzhu?: boolean;
}>();

defineEmits<{
  (e: 'reply', comment: CommentType): void;
}>();

const isLiked = ref(props.comment.userAction?.like === 1);
const likeCount = ref(props.comment.likenum || 0);

// 楼中楼点赞状态（本地维护，微博式点赞不需要登录态展示）
const subLikeMap = ref(new Map<string | number, boolean>());
const subLikeCountMap = ref(new Map<string | number, number>());

function formatCount(n: number): string {
  if (n >= 10000) {
    return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(n);
}

function isSubLiked(reply: any): boolean {
  if (subLikeMap.value.has(reply.id)) return subLikeMap.value.get(reply.id) === true;
  return reply.userAction?.like === 1;
}

function getSubLikeCount(reply: any): number {
  if (subLikeCountMap.value.has(reply.id)) return subLikeCountMap.value.get(reply.id) ?? 0;
  return reply.likenum || 0;
}

async function toggleSubLike(reply: any) {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const prev = isSubLiked(reply);
  const next = !prev;
  const count = getSubLikeCount(reply);
  subLikeMap.value.set(reply.id, next);
  subLikeCountMap.value.set(reply.id, Math.max(0, count + (next ? 1 : -1)));
  try {
    if (next) {
      await CoolapkTauriAPI.likeFeed(String(reply.id));
    } else {
      await CoolapkTauriAPI.unlikeFeed(String(reply.id));
    }
    reply.userAction = { ...(reply.userAction || {}), like: next ? 1 : 0 };
  } catch (err) {
    // 请求失败回滚
    subLikeMap.value.set(reply.id, prev);
    subLikeCountMap.value.set(reply.id, count);
    console.error('Failed to toggle sub reply like', err);
  }
}

// 楼中楼状态
const expanded = ref(false);
const subLoading = ref(false);
const subError = ref('');
const subPage = ref(1);
const subNoMore = ref(false);
const fetchedSubs = ref<any[]>([]);

const subTotal = computed(() => {
  const n = Number(props.comment.replyRowsCount ?? props.comment.replynum ?? 0);
  return n > 0 ? n : 0;
});

const embeddedSubs = computed(() => (Array.isArray(props.comment.rlist) ? props.comment.rlist : []));

const displaySubReplies = computed(() =>
  expanded.value && fetchedSubs.value.length > 0 ? fetchedSubs.value : embeddedSubs.value
);

const canLoadMoreSub = computed(
  () => expanded.value && !subLoading.value && !subNoMore.value && !subError.value
);

async function toggleLike() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const prev = isLiked.value;
  const next = !prev;
  isLiked.value = next;
  likeCount.value = Math.max(0, likeCount.value + (next ? 1 : -1));
  try {
    if (next) {
      await CoolapkTauriAPI.likeFeed(String(props.comment.id));
    } else {
      await CoolapkTauriAPI.unlikeFeed(String(props.comment.id));
    }
    if (props.comment.userAction) {
      props.comment.userAction.like = next ? 1 : 0;
    } else {
      props.comment.userAction = { like: next ? 1 : 0 };
    }
  } catch (err) {
    // 请求失败回滚
    isLiked.value = prev;
    likeCount.value = Math.max(0, likeCount.value + (prev ? 1 : -1));
    console.error('Failed to toggle like', err);
  }
}

async function toggleExpand() {
  if (expanded.value) {
    expanded.value = false;
    return;
  }
  expanded.value = true;
  subPage.value = 1;
  subNoMore.value = false;
  await loadSubReplies(true);
}

async function loadMoreSubReplies() {
  await loadSubReplies(false);
}

async function loadSubReplies(reset: boolean) {
  if (!props.feedId) return;
  subLoading.value = true;
  subError.value = '';
  try {
    const res: any = await CoolapkTauriAPI.getSubReplies(
      String(props.feedId),
      String(props.comment.id),
      subPage.value
    );
    const list = res?.data && Array.isArray(res.data) ? res.data : [];
    if (reset) {
      fetchedSubs.value = list;
    } else {
      const existing = new Set(fetchedSubs.value.map((i: any) => i.id));
      fetchedSubs.value.push(...list.filter((i: any) => !existing.has(i.id)));
    }
    if (list.length < 20) {
      subNoMore.value = true;
    }
    subPage.value++;
  } catch (err: any) {
    subError.value = err?.message || '楼中楼加载失败';
  } finally {
    subLoading.value = false;
  }
}
</script>

<style scoped>
.comment-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-light);
}

.comment-content {
  flex: 1;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}

.username {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.louzhu-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  color: #fff;
  background: var(--brand-primary, #10b981);
  border-radius: var(--radius-pill);
  padding: 1px 6px;
  margin-left: 6px;
  vertical-align: 1px;
}

.sub-more-btn,
.sub-expand-btn {
  border: none;
  background: transparent;
  color: var(--brand-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sub-more-btn {
  margin-top: var(--space-1);
}

.sub-more-btn:hover,
.sub-expand-btn:hover {
  text-decoration: underline;
}

.sub-loading {
  margin-top: var(--space-1);
}

.dateline {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.comment-body {
  font-size: var(--font-size-sub);
  line-height: var(--line-height-sub);
  color: var(--text-primary);
  word-break: break-word;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-2);
}

.action-link {
  font-size: 12px;
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.action-link:hover {
  color: var(--brand-primary);
}

.action-link.is-liked {
  color: var(--danger);
}

.like-btn.is-liked i {
  animation: like-pop 0.3s ease;
}

.sub-like-btn {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  margin-left: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  vertical-align: baseline;
  transition: color 0.15s ease;
}

.sub-like-btn:hover {
  color: var(--danger);
}

.sub-like-btn.is-liked {
  color: var(--danger);
}

.sub-like-btn.is-liked i {
  animation: like-pop 0.3s ease;
}

@keyframes like-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.35); }
  100% { transform: scale(1); }
}

.sub-comments {
  background-color: var(--background);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin-top: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sub-item {
  font-size: 13px;
  line-height: 1.45;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
}

.sub-username {
  font-weight: var(--font-weight-medium);
  color: var(--brand-primary);
}

.sub-text {
  color: var(--text-primary);
}
</style>
