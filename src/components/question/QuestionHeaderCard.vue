<template>
  <article class="question-header-card">
    <FeedHeader
      :uid="authorUid"
      :avatar="question.userAvatar || question.userInfo?.userAvatar"
      :plugin-url="(question.userInfo as any)?.avatar_plugin_url || (question as any).avatar_plugin_url || (question as any).userAvatarPluginUrl"
      :username="question.username || question.userInfo?.username"
      :level="question.userInfo?.level || question.level"
      :verify-title="question.userInfo?.verify_title || question.verifyTitle"
      :dateline="question.dateline || (question as any).infoHtml"
      :device="question.device_title || question.deviceTitle"
      entity-type="question"
      :entity-id="question.id"
    >
    </FeedHeader>

    <FeedContent
      :feed-id="question.id"
      :title="question.title"
      :message="questionMessage"
      :username="question.username || question.userInfo?.username"
      force-expanded
    />

    <FeedImageGrid
      v-if="questionImages.length"
      :images="questionImages"
      :content-id="question.id"
      content-type="feed"
    />

    <QuestionRelatedContent :content="question" />

    <div class="question-header-footer">
      <div class="question-counts">
        <button
          type="button"
          class="question-count-item question-count-clickable"
          title="点击查看回答列表"
          @click="$emit('view-answers')"
        >
          <i class="fas fa-comment-dots" aria-hidden="true"></i>
          <span>{{ answerCount }} 个回答</span>
        </button>
        <span class="count-divider" aria-hidden="true">·</span>
        <span class="question-count-item">
          <i class="fas fa-user-group" aria-hidden="true"></i>
          <span>{{ followCount }} 人关注</span>
        </span>
      </div>
      <div class="question-header-actions">
        <button
          type="button"
          class="question-action question-invite-action"
          @click="$emit('invite')"
        >
          <i class="fas fa-user-plus" aria-hidden="true"></i>
          邀请回答
        </button>
        <button
          type="button"
          :class="['question-action', 'question-follow-action', { active: isFollowed }]"
          :disabled="followPending"
          :aria-pressed="isFollowed"
          @click="$emit('toggle-follow')"
        >
          <i :class="isFollowed ? 'fas fa-check' : 'fas fa-plus'" aria-hidden="true"></i>
          {{ isFollowed ? '已关注' : '关注问题' }}
        </button>
        <button
          type="button"
          class="question-action question-add-answer"
          @click="$emit('add-answer')"
        >
          <i class="fas fa-pen-to-square" aria-hidden="true"></i>
          写回答
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FeedItem } from '../../types/feed';
import FeedContent from '../feed/FeedContent.vue';
import FeedHeader from '../feed/FeedHeader.vue';
import FeedImageGrid from '../feed/FeedImageGrid.vue';
import QuestionRelatedContent from './QuestionRelatedContent.vue';
import { getQuestionAnswerCount, getQuestionAnswerImages, getQuestionMessage } from '../../utils/question';
import { getUserUid } from '../../utils/userRoute';

const props = defineProps<{
  question: FeedItem;
  answerCount: number;
  followCount: number;
  isFollowed: boolean;
  followPending?: boolean;
}>();

defineEmits<{
  (event: 'toggle-follow'): void;
  (event: 'invite'): void;
  (event: 'view-answers'): void;
  (event: 'add-answer'): void;
}>();

const authorUid = computed(() => getUserUid(props.question));
const questionImages = computed(() => getQuestionAnswerImages(props.question));
const questionMessage = computed(() => getQuestionMessage(props.question));
const answerCount = computed(() => props.answerCount || getQuestionAnswerCount(props.question));
const followCount = computed(() => Math.max(0, Number(props.followCount) || 0));
</script>

<style scoped>
.question-header-card {
  padding: 20px 22px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card, 14px);
  box-shadow: var(--shadow-card, 0 2px 8px rgba(15, 23, 42, .04));
}

.question-header-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}

.question-counts {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: var(--font-size-caption, 13px);
}

.question-count-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.question-count-clickable {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--font-size-caption, 13px);
  cursor: pointer;
  transition: color var(--duration-fast, 0.15s) ease;
}

.question-count-clickable:hover {
  color: var(--brand-primary);
}

.question-counts i {
  color: var(--brand-primary);
  font-size: 13px;
}

.count-divider {
  color: var(--border-light, var(--border));
  user-select: none;
}

.question-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.question-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill, 999px);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast, 0.15s) var(--ease-default, ease);
}

.question-action:hover:not(:disabled) {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.question-action:disabled {
  opacity: .55;
  cursor: not-allowed;
}

/* 邀请回答 */
.question-invite-action {
  color: var(--text-secondary);
}

.question-invite-action i {
  color: var(--text-tertiary);
  transition: color var(--duration-fast, 0.15s) ease;
}

.question-invite-action:hover:not(:disabled) i {
  color: var(--brand-primary);
}

/* 关注问题 */
.question-follow-action.active {
  border-color: var(--brand-soft);
  color: var(--brand-primary);
  background: var(--brand-soft);
  font-weight: 600;
}

/* 写回答（主要 CTA 按钮） */
.question-add-answer {
  border-color: var(--brand-primary);
  background: var(--brand-primary);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.22);
}

.question-add-answer:hover:not(:disabled) {
  background: var(--brand-primary-hover, #059669);
  border-color: var(--brand-primary-hover, #059669);
  color: #fff;
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.32);
  transform: translateY(-1px);
}

.question-add-answer:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.2);
}

.question-add-answer i {
  color: #fff;
}

@media (max-width: 640px) {
  .question-header-card {
    padding: 14px;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }

  .question-header-footer {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .question-header-actions {
    width: 100%;
  }

  .question-action {
    flex: 1;
    padding: 0 8px;
    font-size: 12px;
  }
}
</style>
