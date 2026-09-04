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
      <template #actions>
        <span class="question-type-badge"><i class="fas fa-circle-question"></i> 问答</span>
      </template>
    </FeedHeader>

    <FeedContent
      :feed-id="question.id"
      :title="question.title"
      :message="question.message || question.message_raw_output"
      :username="question.username || question.userInfo?.username"
      force-expanded
    />

    <FeedImageGrid
      v-if="questionImages.length"
      :images="questionImages"
      :content-id="question.id"
      content-type="feed"
    />

    <div class="question-header-footer">
      <div class="question-counts">
        <span><i class="fas fa-comment-dots"></i> {{ answerCount }} 个回答</span>
        <span><i class="fas fa-user-group"></i> {{ followCount }} 人关注</span>
      </div>
      <div class="question-header-actions">
        <button
          type="button"
          :class="['question-action', 'question-follow-action', { active: isFollowed }]"
          :disabled="followPending"
          :aria-pressed="isFollowed"
          @click="$emit('toggle-follow')"
        >
          <i :class="isFollowed ? 'fas fa-check' : 'fas fa-plus'"></i>
          {{ isFollowed ? '已关注' : '关注问题' }}
        </button>
        <button type="button" class="question-action question-invite-action" @click="$emit('invite')">
          <i class="fas fa-user-plus"></i>
          邀请回答
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
import { getQuestionAnswerCount, getQuestionAnswerImages } from '../../utils/question';
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
}>();

const authorUid = computed(() => getUserUid(props.question));
const questionImages = computed(() => getQuestionAnswerImages(props.question));
const answerCount = computed(() => props.answerCount || getQuestionAnswerCount(props.question));
const followCount = computed(() => Math.max(0, Number(props.followCount) || 0));
</script>

<style scoped>
.question-header-card {
  padding: 18px 20px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card, 14px);
  box-shadow: var(--shadow-card, 0 2px 8px rgba(15, 23, 42, .04));
}

.question-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--brand-primary);
  font-size: var(--font-size-caption, 12px);
  font-weight: 600;
}

.question-header-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}

.question-counts,
.question-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.question-counts {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption, 12px);
}

.question-counts span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.question-counts i {
  color: var(--brand-primary);
}

.question-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill, 999px);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-caption, 12px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
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

.question-follow-action.active {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.question-invite-action {
  color: var(--brand-primary);
}

@media (max-width: 640px) {
  .question-header-card {
    padding: 14px;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }

  .question-header-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .question-header-actions {
    width: 100%;
  }

  .question-action {
    flex: 1;
  }
}
</style>
