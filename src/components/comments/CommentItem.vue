<template>
  <div class="comment-item">
    <AppAvatar :src="comment.userAvatar || comment.userInfo?.userAvatar" size="sm" />
    <div class="comment-content">
      <div class="comment-header">
        <span class="username">{{ comment.username || comment.userInfo?.username || '酷友' }}</span>
        <span class="dateline">{{ comment.dateline }}</span>
      </div>

      <div class="comment-body" v-html="comment.message"></div>

      <div class="comment-actions">
        <button :class="['action-link', { 'is-liked': isLiked }]" @click="toggleLike">
          <i :class="[isLiked ? 'fas fa-heart' : 'far fa-heart']"></i>
          <span>{{ likeCount > 0 ? likeCount : '赞' }}</span>
        </button>
        <button class="action-link" @click="$emit('reply', comment)">
          <i class="far fa-comment"></i> 回复
        </button>
      </div>

      <!-- 楼中楼列表 -->
      <div v-if="comment.rlist && comment.rlist.length > 0" class="sub-comments">
        <div v-for="reply in comment.rlist" :key="reply.id" class="sub-item">
          <span class="sub-username">{{ reply.username || reply.userInfo?.username }}: </span>
          <span class="sub-text" v-html="reply.message"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { CommentItem as CommentType } from '../../types/comment';
import AppAvatar from '../common/AppAvatar.vue';

const props = defineProps<{
  comment: CommentType;
}>();

defineEmits<{
  (e: 'reply', comment: CommentType): void;
}>();

const isLiked = ref(props.comment.userAction?.like === 1);
const likeCount = ref(props.comment.likenum || 0);

function toggleLike() {
  isLiked.value = !isLiked.value;
  likeCount.value += isLiked.value ? 1 : -1;
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
}

.sub-username {
  font-weight: var(--font-weight-medium);
  color: var(--brand-primary);
}

.sub-text {
  color: var(--text-primary);
}
</style>
