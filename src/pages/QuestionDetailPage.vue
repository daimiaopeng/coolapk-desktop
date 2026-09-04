<template>
  <div class="question-detail-page page-container custom-scrollbar">
    <div class="question-detail-shell">
      <div v-if="questionLoading && !question" class="state-wrapper">
        <LoadingState text="正在加载问题详情..." />
      </div>

      <div v-else-if="questionError && !question" class="state-wrapper">
        <ErrorState title="问题加载失败" :message="questionError" @retry="loadQuestion" />
      </div>

      <template v-else-if="question">
        <QuestionHeaderCard
          :question="question"
          :answer-count="answerCount"
          :follow-count="followCount"
          :is-followed="isFollowed"
          :follow-pending="followPending"
          @toggle-follow="toggleFollow"
          @invite="openInviteDialog"
        />

        <section class="answers-section">
          <div class="answers-toolbar">
            <div class="answers-title-group">
              <h2 class="answers-title">回答列表</h2>
              <span class="answers-total">{{ answerCount }} 个回答</span>
            </div>
            <div class="answer-sort-tabs" role="tablist" aria-label="回答排序">
              <button
                v-for="option in sortOptions"
                :key="option.key"
                type="button"
                :class="['answer-sort-tab', { active: sort === option.key }]"
                :aria-selected="sort === option.key"
                @click="changeSort(option.key)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div v-if="answersLoading && !answers.length" class="state-wrapper answers-state">
            <LoadingState text="正在加载回答..." />
          </div>

          <div v-else-if="answersError && !answers.length" class="state-wrapper answers-state">
            <ErrorState title="回答加载失败" :message="answersError" @retry="reloadAnswers" />
          </div>

          <div v-else-if="!answers.length" class="state-wrapper answers-state">
            <EmptyState title="还没有回答" description="成为第一个回答问题的人吧" />
          </div>

          <div v-else class="answer-list">
            <QuestionAnswerCard v-for="(answer, index) in answers" :key="answerKey(answer, index)" :answer="answer" :index="index" />
          </div>

          <div class="answers-footer">
            <LoadingState v-if="answersLoading && answers.length" text="正在加载更多回答..." />
            <button v-else-if="answersError && answers.length" type="button" class="retry-inline" @click="reloadAnswers">加载失败，点击重试</button>
            <button v-else-if="!noMoreAnswers" type="button" class="load-more-button" @click="loadMoreAnswers">加载更多回答</button>
            <span v-else-if="answers.length" class="no-more">没有更多回答了</span>
          </div>
        </section>
      </template>

      <div v-else class="state-wrapper">
        <EmptyState title="未找到该问题" description="该问题可能已被删除或 ID 不正确" />
      </div>
    </div>

    <AppDialog :is-open="inviteDialogOpen" title="邀请回答" :width="460" @close="closeInviteDialog">
      <div class="invite-dialog-body">
        <p class="invite-description">输入酷安用户 UID，可使用逗号或空格分隔多个用户。</p>
        <input
          v-model="inviteUids"
          class="invite-input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="例如：10086, 20014"
          @keydown.enter.prevent="submitInvite"
        />
        <p v-if="inviteError" class="invite-error">{{ inviteError }}</p>
        <p v-else class="invite-hint">邀请发送后，对方会在酷安收到回答提醒。</p>
      </div>
      <template #footer>
        <AppButton variant="ghost" @click="closeInviteDialog">取消</AppButton>
        <AppButton variant="primary" :loading="invitePending" :disabled="!inviteUids.trim()" @click="submitInvite">发送邀请</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppButton from '../components/common/AppButton.vue';
import AppDialog from '../components/common/AppDialog.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import LoadingState from '../components/common/LoadingState.vue';
import QuestionAnswerCard from '../components/question/QuestionAnswerCard.vue';
import QuestionHeaderCard from '../components/question/QuestionHeaderCard.vue';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { getErrorMessage } from '../utils/errors';
import {
  extractQuestionAnswers,
  getQuestionAnswerCount,
  getQuestionFollowCount,
  getQuestionHasMore,
  isQuestionFollowed,
  normalizeInviteUids,
  normalizeQuestionDetail,
  QUESTION_ANSWER_PAGE_SIZE,
  type QuestionSort,
} from '../utils/question';
import { showToast } from '../utils/toast';

defineOptions({ name: 'QuestionDetailPage' });

const props = defineProps<{
  questionId: string;
}>();

const appStore = useAppStore();
const authStore = useAuthStore();
const questionId = computed(() => String(props.questionId || '').trim());

const question = ref(normalizeQuestionDetail(appStore.getFeedDetailContext(questionId.value), questionId.value));
const questionLoading = ref(Boolean(questionId.value));
const questionError = ref('');
const answers = ref<any[]>([]);
const answersLoading = ref(false);
const answersError = ref('');
const page = ref(1);
const noMoreAnswers = ref(false);
const sort = ref<QuestionSort>('reply');
const isFollowed = ref(false);
const followCount = ref(0);
const followPending = ref(false);
const inviteDialogOpen = ref(false);
const inviteUids = ref('');
const inviteError = ref('');
const invitePending = ref(false);
let questionRequestVersion = 0;
let answersRequestVersion = 0;

const sortOptions: Array<{ key: QuestionSort; label: string }> = [
  { key: 'reply', label: '热门' },
  { key: 'like', label: '高赞' },
  { key: 'dateline', label: '最新' },
];

const answerCount = computed(() => Math.max(getQuestionAnswerCount(question.value), answers.value.length));

function syncQuestionMeta(value: unknown) {
  isFollowed.value = isQuestionFollowed(value);
  followCount.value = getQuestionFollowCount(value);
}

function answerKey(answer: any, index: number): string {
  return String(answer?.id || answer?.entityId || `answer-${index}`);
}

async function loadQuestion() {
  if (!questionId.value) return;
  const requestedId = questionId.value;
  const version = ++questionRequestVersion;
  questionLoading.value = true;
  questionError.value = '';
  try {
    const response: any = await CoolapkTauriAPI.getFeedDetail(requestedId);
    const detail = normalizeQuestionDetail(response?.data, requestedId);
    if (!detail) throw new Error('接口没有返回问题内容');
    if (version !== questionRequestVersion || requestedId !== questionId.value) return;
    question.value = detail;
    syncQuestionMeta(detail);
    appStore.setFeedDetailContext(requestedId, detail);
  } catch (error) {
    if (version === questionRequestVersion) questionError.value = getErrorMessage(error, '问题详情加载失败');
  } finally {
    if (version === questionRequestVersion) questionLoading.value = false;
  }
}

async function loadAnswers(reset = true) {
  if (!questionId.value || (!reset && answersLoading.value)) return;
  const requestedId = questionId.value;
  const requestedSort = sort.value;
  const requestedPage = reset ? 1 : page.value;
  const version = ++answersRequestVersion;
  answersLoading.value = true;
  answersError.value = '';
  if (reset) {
    answers.value = [];
    page.value = 1;
    noMoreAnswers.value = false;
  }
  try {
    const response: any = await CoolapkTauriAPI.getQuestionAnswers(requestedId, requestedSort, requestedPage);
    const rows = extractQuestionAnswers(response);
    if (version !== answersRequestVersion || requestedId !== questionId.value || requestedSort !== sort.value) return;
    const existing = new Set(answers.value.map((item) => answerKey(item, 0)));
    const uniqueRows = rows.filter((item, index) => {
      const key = answerKey(item, index);
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    answers.value = reset ? uniqueRows : [...answers.value, ...uniqueRows];
    page.value = requestedPage + 1;
    noMoreAnswers.value = !getQuestionHasMore(response, rows.length) || rows.length < QUESTION_ANSWER_PAGE_SIZE;
  } catch (error) {
    if (version === answersRequestVersion) answersError.value = getErrorMessage(error, '回答列表加载失败');
  } finally {
    if (version === answersRequestVersion) answersLoading.value = false;
  }
}

function reloadAnswers() {
  void loadAnswers(true);
}

function loadMoreAnswers() {
  if (!noMoreAnswers.value) void loadAnswers(false);
}

function changeSort(nextSort: QuestionSort) {
  if (sort.value === nextSort) return;
  sort.value = nextSort;
  void loadAnswers(true);
}

async function toggleFollow() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (!questionId.value || followPending.value) return;
  const previous = isFollowed.value;
  const previousCount = followCount.value;
  const next = !previous;
  isFollowed.value = next;
  followCount.value = Math.max(0, previousCount + (next ? 1 : -1));
  followPending.value = true;
  try {
    if (next) await CoolapkTauriAPI.followQuestion(questionId.value);
    else await CoolapkTauriAPI.unfollowQuestion(questionId.value);
  } catch (error) {
    isFollowed.value = previous;
    followCount.value = previousCount;
    showToast(getErrorMessage(error, '关注操作失败'), 'error');
  } finally {
    followPending.value = false;
  }
}

function openInviteDialog() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  inviteUids.value = '';
  inviteError.value = '';
  inviteDialogOpen.value = true;
}

function closeInviteDialog() {
  if (invitePending.value) return;
  inviteDialogOpen.value = false;
  inviteError.value = '';
}

async function submitInvite() {
  if (!questionId.value || invitePending.value) return;
  const uids = normalizeInviteUids(inviteUids.value);
  if (!uids.length) {
    inviteError.value = '请输入有效的数字 UID';
    return;
  }
  invitePending.value = true;
  inviteError.value = '';
  try {
    await CoolapkTauriAPI.inviteQuestionAnswer(questionId.value, uids.join(','));
    showToast(`已向 ${uids.length} 位用户发送回答邀请`, 'success');
    inviteDialogOpen.value = false;
  } catch (error) {
    inviteError.value = getErrorMessage(error, '邀请发送失败');
  } finally {
    invitePending.value = false;
  }
}

watch(questionId, (nextId) => {
  question.value = normalizeQuestionDetail(appStore.getFeedDetailContext(nextId), nextId);
  questionLoading.value = Boolean(nextId);
  questionError.value = '';
  syncQuestionMeta(question.value);
  answers.value = [];
  answersError.value = '';
  page.value = 1;
  noMoreAnswers.value = false;
  if (!nextId) return;
  void loadQuestion();
  void loadAnswers(true);
}, { immediate: true });

</script>

<style scoped>
.question-detail-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 0 16px 32px;
  background: var(--background-secondary);
}

.question-detail-shell {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
}

.state-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: var(--space-8) 0;
}

.answers-section {
  margin-top: 14px;
  padding: 0 0 24px;
}

.answers-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;
  padding: 0 4px;
}

.answers-title-group,
.answer-sort-tabs {
  display: flex;
  align-items: center;
}

.answers-title-group {
  gap: 10px;
}

.answers-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
}

.answers-total {
  color: var(--text-tertiary);
  font-size: 12px;
}

.answer-sort-tabs {
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-pill, 999px);
  background: var(--surface);
  border: 1px solid var(--border-light, var(--border));
}

.answer-sort-tab {
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-pill, 999px);
  color: var(--text-tertiary);
  background: transparent;
  font-size: 12px;
  cursor: pointer;
}

.answer-sort-tab.active {
  color: var(--brand-primary);
  background: var(--brand-soft);
  font-weight: 600;
}

.answers-state {
  min-height: 220px;
  background: var(--surface);
  border: 1px solid var(--border-light, var(--border));
  border-radius: var(--radius-card, 14px);
}

.answer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.answers-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding-top: 6px;
  text-align: center;
}

.load-more-button,
.retry-inline {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill, 999px);
  background: var(--surface);
  color: var(--brand-primary);
  font-size: 12px;
  cursor: pointer;
}

.load-more-button:hover,
.retry-inline:hover {
  border-color: var(--brand-primary);
  background: var(--brand-soft);
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}

.invite-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.invite-description,
.invite-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.invite-hint {
  color: var(--text-tertiary);
  font-size: 12px;
}

.invite-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control, 8px);
  outline: none;
  color: var(--text-primary);
  background: var(--surface);
  font-size: 14px;
}

.invite-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.invite-error {
  margin: 0;
  color: var(--danger);
  font-size: 12px;
}

@media (max-width: 640px) {
  .question-detail-page {
    padding: 0 0 24px;
  }

  .answers-section {
    margin-top: 10px;
  }

  .answers-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 0 14px 10px;
  }

  .answer-sort-tabs {
    width: 100%;
  }

  .answer-sort-tab {
    flex: 1;
  }
}
</style>
