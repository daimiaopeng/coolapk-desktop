<template>
  <article
    class="question-search-card"
    role="button"
    tabindex="0"
    :aria-label="`问答：${title || '未命名问题'}`"
    @click="openQuestion"
    @keydown.enter.prevent="openQuestion"
    @keydown.space.prevent="openQuestion"
  >
    <div class="question-search-main">
      <div class="question-search-title-row">
        <span class="question-search-badge" aria-label="问答">
          <i class="fas fa-circle-question" aria-hidden="true"></i>
          <span>问答</span>
        </span>
        <h3 class="question-search-title">{{ title || '未命名问题' }}</h3>
      </div>
      <div class="question-search-meta">
        <span>{{ answerCount }}人回答</span>
        <span aria-hidden="true">·</span>
        <span>{{ followCount }}人关注</span>
      </div>
    </div>
    <i class="fas fa-chevron-right question-search-arrow" aria-hidden="true"></i>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { SearchEntity } from '../../types/search';
import { getSearchEntityTitle, navigateSearchEntity } from '../../utils/searchEntities';
import { getQuestionAnswerCount, getQuestionFollowCount } from '../../utils/question';

const props = defineProps<{ entity: SearchEntity }>();
const router = useRouter();

const title = computed(() => getSearchEntityTitle(props.entity));
const answerCount = computed(() => getQuestionAnswerCount(props.entity));
const followCount = computed(() => getQuestionFollowCount(props.entity));

function openQuestion() {
  navigateSearchEntity(router, props.entity);
}
</script>

<style scoped>
.question-search-card {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 82px;
  box-sizing: border-box;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--border-light, var(--border));
  border-radius: var(--radius-card, 14px);
  box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default);
}

.question-search-card:hover,
.question-search-card:focus-visible {
  background: var(--surface-hover);
  border-color: var(--brand-primary);
  box-shadow: 0 5px 16px rgba(15, 23, 42, .07);
  outline: none;
  transform: translateY(-1px);
}

.question-search-main {
  flex: 1;
  min-width: 0;
}

.question-search-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.question-search-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  color: var(--brand-primary);
  background: var(--brand-soft);
  border-radius: 999px;
  font-size: var(--font-size-caption, 12px);
  font-weight: var(--font-weight-bold, 700);
  line-height: 1.3;
  white-space: nowrap;
}

.question-search-badge i {
  font-size: 11px;
}

.question-search-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-sub, 16px);
  font-weight: var(--font-weight-semibold, 600);
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-search-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: var(--font-size-caption, 12px);
}

.question-search-arrow {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: 12px;
}

@media (max-width: 640px) {
  .question-search-card {
    gap: 10px;
    min-height: 72px;
    padding: 13px 14px;
  }

  .question-search-title-row {
    gap: 7px;
  }

  .question-search-badge {
    padding: 2px 6px;
  }
}
</style>
