<template>
  <aside class="topic-feed-comment-aside">
    <!-- 顶部状态栏 -->
    <div class="aside-header">
      <div v-if="feed" class="active-feed-brief">
        <div class="author-avatar-wrap">
          <img
            v-if="authorAvatar"
            :src="authorAvatar"
            class="author-avatar"
            alt="avatar"
          />
          <div v-else class="author-avatar-fallback">👤</div>
        </div>
        <div class="author-info">
          <div class="author-row">
            <span class="author-name">{{ authorName }}</span>
            <span v-if="authorLevel" class="author-level">Lv.{{ authorLevel }}</span>
          </div>
          <div class="author-sub-meta">
            <span class="feed-time">{{ formattedFeedTime }}</span>
            <span v-if="deviceTitle" class="feed-device">
              <i class="fas fa-mobile-alt device-icon"></i>
              <span>{{ deviceTitle }}</span>
            </span>
          </div>
        </div>
      </div>
      <div v-else class="aside-title">
        <i class="fas fa-comments text-brand"></i>
        <span>评论互动</span>
      </div>

      <button
        type="button"
        class="btn-close-aside"
        title="关闭/折叠评论区"
        @click="$emit('close')"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- 评论内容区 -->
    <div class="aside-content custom-scrollbar">
      <div v-if="feed" class="feed-comment-container">
        <FeedCommentSection
          :feed-id="feed.id"
          :feed-uid="authorUid"
          :feed-username="authorName"
          :total-comment-count="commentCount"
          :comments="comments"
          :loading="loading"
          :error="error"
          @retry-comments="loadComments"
          @delete-comment="handleDeleteComment"
        />
      </div>
      <div v-else class="aside-empty-placeholder">
        <i class="far fa-comment-dots empty-icon"></i>
        <p class="empty-title">点击中间动态查看评论</p>
        <p class="empty-desc">在中间选择一条动态，即可在此快速浏览楼层讨论并发表回复</p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import FeedCommentSection from '../feed/FeedCommentSection.vue';
import { getUserUid } from '../../utils/userRoute';
import { getReplyData } from '../../utils/commentList';

const props = defineProps<{
  feed?: any;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const comments = ref<any[]>([]);
const loading = ref(false);
const error = ref('');

const authorName = computed(() => {
  if (!props.feed) return '';
  return props.feed.username || props.feed.userInfo?.username || '酷友';
});

const authorAvatar = computed(() => {
  if (!props.feed) return '';
  return props.feed.userAvatar || props.feed.userInfo?.userAvatar || props.feed.pic || '';
});

const authorLevel = computed(() => {
  if (!props.feed) return 0;
  return Number(props.feed.userInfo?.level || props.feed.userLevel || 0);
});

const authorUid = computed(() => {
  if (!props.feed) return '';
  return getUserUid(props.feed);
});

const deviceTitle = computed(() => {
  if (!props.feed) return '';
  return props.feed.device_title || props.feed.device || props.feed.device_name || '';
});

const formattedFeedTime = computed(() => {
  if (!props.feed) return '';
  const raw = props.feed.dateline || props.feed.infoHtml || props.feed.created_at || '';
  return formatDateline(raw);
});

function formatDateline(time?: number | string): string {
  if (!time) return '刚刚';
  const timestamp = normalizeTimestamp(time);
  if (timestamp === null) return String(time);
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

function normalizeTimestamp(value: number | string): number | null {
  const timestamp = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  if (timestamp >= 1_000_000_000_000) return timestamp / 1000;
  if (timestamp >= 10_000_000_000) return timestamp / 10;
  return timestamp;
}

const commentCount = computed(() => {
  if (!props.feed) return 0;
  return props.feed.replynum || props.feed.commentnum || 0;
});

async function loadComments() {
  if (!props.feed || !props.feed.id) {
    comments.value = [];
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const res: any = await CoolapkTauriAPI.getFeedReplies(props.feed.id, 1);
    comments.value = getReplyData(res);
  } catch (err: any) {
    error.value = err?.message || '获取评论列表失败';
  } finally {
    loading.value = false;
  }
}

function handleDeleteComment(commentId: string | number) {
  comments.value = comments.value.filter((c) => String(c.id) !== String(commentId));
}

watch(
  () => props.feed?.id,
  (newId) => {
    if (newId) {
      loadComments();
    } else {
      comments.value = [];
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.feed?.id) {
    loadComments();
  }
});
</script>

<style scoped>
.topic-feed-comment-aside {
  width: 380px;
  flex: 0 0 380px;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--surface);
  border-left: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  overflow: hidden;
  animation: slideInRight 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.aside-header {
  height: 52px;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
}

.active-feed-brief {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.author-avatar-wrap {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.author-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.author-avatar-fallback {
  width: 100%;
  height: 100%;
  background: var(--background-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.author-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.author-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.author-level {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.12);
  color: var(--brand-primary, #10b981);
  line-height: 1.2;
}

.author-sub-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.feed-device {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--text-tertiary);
}

.device-icon {
  font-size: 9px;
}

.aside-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.btn-close-aside {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.btn-close-aside:hover {
  background: var(--background-secondary);
  color: var(--text-primary);
}

.aside-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.feed-comment-container {
  flex: 1;
  padding: 12px 16px 24px;
}

.feed-comment-container :deep(.feed-comment-section) {
  margin-top: 0;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.aside-empty-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  text-align: center;
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 42px;
  color: var(--text-tertiary);
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 12px;
  line-height: 1.6;
  max-width: 260px;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
