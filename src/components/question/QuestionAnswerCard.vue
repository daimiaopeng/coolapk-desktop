<template>
  <article class="question-answer-card">
    <div class="answer-header">
      <button type="button" class="answer-author-button" @click.stop="openUser">
        <AppAvatar :src="answer.userAvatar || answer.userInfo?.userAvatar" :alt="answer.username || answer.userInfo?.username" size="sm" />
      </button>
      <div class="answer-author-info">
        <button type="button" class="answer-author-name" @click.stop="openUser">
          {{ answer.username || answer.userInfo?.username || '酷友' }}
        </button>
        <div class="answer-meta">
          <time>{{ formatAnswerDate(answer.dateline || (answer as any).infoHtml) }}</time>
          <span v-if="likeCount > 0">· {{ formatCount(likeCount) }} 赞</span>
        </div>
      </div>
      <span class="answer-index">#{{ index + 1 }}</span>
    </div>

    <FeedContent
      :feed-id="answer.id"
      :message="answer.message || answer.message_raw_output"
      :username="answer.username || answer.userInfo?.username"
      force-expanded
    />

    <FeedImageGrid
      v-if="answerImages.length"
      :images="answerImages"
      :content-id="answer.id"
      content-type="reply"
      variant="comment"
    />
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { FeedItem } from '../../types/feed';
import AppAvatar from '../common/AppAvatar.vue';
import FeedContent from '../feed/FeedContent.vue';
import FeedImageGrid from '../feed/FeedImageGrid.vue';
import { getQuestionAnswerImages, getQuestionAnswerLikeCount } from '../../utils/question';
import { getUserUid } from '../../utils/userRoute';

const props = defineProps<{
  answer: FeedItem;
  index: number;
}>();

const router = useRouter();
const answerUid = computed(() => getUserUid(props.answer));
const answerImages = computed(() => getQuestionAnswerImages(props.answer));
const likeCount = computed(() => getQuestionAnswerLikeCount(props.answer));

function openUser() {
  if (answerUid.value) void router.push(`/user/${encodeURIComponent(answerUid.value)}`);
}

function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
}

function formatAnswerDate(value: unknown): string {
  const raw = String(value ?? '').trim();
  const timestamp = Number(raw);
  if (!raw || !Number.isFinite(timestamp) || timestamp <= 0) return raw || '刚刚';
  const seconds = timestamp >= 1_000_000_000_000 ? timestamp / 1000 : timestamp >= 10_000_000_000 ? timestamp / 10 : timestamp;
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - seconds));
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  const date = new Date(seconds * 1000);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}
</script>

<style scoped>
.question-answer-card {
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--border-light, var(--border));
  border-radius: var(--radius-card, 14px);
  box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
}

.answer-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.answer-author-button,
.answer-author-name {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.answer-author-button {
  display: flex;
  padding: 0;
}

.answer-author-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.answer-author-name {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.answer-author-name:hover {
  color: var(--brand-primary);
}

.answer-meta {
  display: flex;
  gap: 5px;
  color: var(--text-tertiary);
  font-size: var(--font-size-caption, 12px);
}

.answer-index {
  flex-shrink: 0;
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 700;
}

.question-answer-card :deep(.feed-content-wrapper) {
  margin-bottom: 0;
}

@media (max-width: 640px) {
  .question-answer-card {
    padding: 14px;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }
}
</style>
