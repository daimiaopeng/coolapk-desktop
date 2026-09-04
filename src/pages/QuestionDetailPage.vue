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
          @view-answers="scrollToAnswers"
          @add-answer="openAnswerDialog"
        />

        <section ref="answersSection" class="answers-section">
          <div class="answers-toolbar">
            <div class="answers-title-group">
              <h2 class="answers-title">全部回答</h2>
              <span class="answers-count-badge">{{ answerCount }}</span>
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
            <QuestionAnswerCard
              v-for="(answer, index) in answers"
              :key="answerKey(answer, index)"
              :answer="answer"
              :question-id="questionId"
              :question-title="getQuestionTitle(question)"
              :navigate-to-question="false"
              :show-answer-heading="false"
              :show-reply-summary="false"
              :show-related-content="false"
            />
          </div>

          <div class="answers-footer">
            <LoadingState v-if="answersLoading && answers.length" text="正在加载更多回答..." />
            <button v-else-if="answersError && answers.length" type="button" class="retry-inline" @click="reloadAnswers">加载失败，点击重试</button>
            <button v-else-if="!noMoreAnswers" type="button" class="load-more-button" @click="loadMoreAnswers">加载更多回答</button>
            <div v-else-if="answers.length" class="no-more-divider">
              <span>没有更多回答了</span>
            </div>
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

    <AppDialog :is-open="answerDialogOpen" title="添加回答" :width="620" :close-on-backdrop="!answerPending" @close="closeAnswerDialog">
      <div class="answer-dialog-body">
        <p class="answer-description">回答这个问题，帮助其他酷友做出选择。</p>
        <textarea
          v-model="answerMessage"
          class="answer-textarea custom-scrollbar"
          rows="7"
          maxlength="10000"
          autofocus
          placeholder="写下你的回答..."
          @keydown.ctrl.enter.prevent="submitAnswer"
        ></textarea>
        <p v-if="answerError" class="answer-error">{{ answerError }}</p>
        <p v-else class="answer-hint">Ctrl + Enter 发布回答</p>
      </div>
      <template #footer>
        <AppButton variant="ghost" :disabled="answerPending" @click="closeAnswerDialog">取消</AppButton>
        <AppButton variant="primary" :loading="answerPending" :disabled="!answerMessage.trim()" @click="submitAnswer">发布回答</AppButton>
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
  getQuestionTitle,
  getQuestionHasMore,
  isQuestionFollowed,
  normalizeInviteUids,
  normalizeQuestionAnswer,
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
const answerCursor = ref({ firstItem: '', lastItem: '' });
const noMoreAnswers = ref(false);
const sort = ref<QuestionSort>('reply');
const isFollowed = ref(false);
const followCount = ref(0);
const followPending = ref(false);
const inviteDialogOpen = ref(false);
const inviteUids = ref('');
const inviteError = ref('');
const invitePending = ref(false);
const answerDialogOpen = ref(false);
const answerMessage = ref('');
const answerError = ref('');
const answerPending = ref(false);
const answersSection = ref<HTMLElement | null>(null);
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

function answerCursorId(answer: any): string {
  return String(answer?.id ?? answer?.entityId ?? answer?.entity_id ?? answer?.answerId ?? answer?.answer_id ?? '').trim();
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
  const requestedFirstItem = reset ? '' : answerCursor.value.firstItem;
  const requestedLastItem = reset ? '' : answerCursor.value.lastItem;
  const version = ++answersRequestVersion;
  answersLoading.value = true;
  answersError.value = '';
  if (reset) {
    answers.value = [];
    page.value = 1;
    answerCursor.value = { firstItem: '', lastItem: '' };
    noMoreAnswers.value = false;
  }
  try {
    const response: any = requestedFirstItem || requestedLastItem
      ? await CoolapkTauriAPI.getQuestionAnswers(requestedId, requestedSort, requestedPage, {
        firstItem: requestedFirstItem,
        lastItem: requestedLastItem,
      })
      : await CoolapkTauriAPI.getQuestionAnswers(requestedId, requestedSort, requestedPage);
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
    const responseFirst = String(response?.firstItem ?? response?.first_item ?? response?.data?.firstItem ?? response?.data?.first_item ?? '').trim();
    const responseLast = String(response?.lastItem ?? response?.last_item ?? response?.data?.lastItem ?? response?.data?.last_item ?? '').trim();
    const first = responseFirst || uniqueRows.map(answerCursorId).find(Boolean) || requestedFirstItem;
    const last = responseLast || [...uniqueRows].reverse().map(answerCursorId).find(Boolean) || requestedLastItem;
    answerCursor.value = {
      firstItem: reset ? first : answerCursor.value.firstItem || first,
      lastItem: last || answerCursor.value.lastItem,
    };
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

function scrollToAnswers() {
  answersSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openAnswerDialog() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  answerMessage.value = '';
  answerError.value = '';
  answerDialogOpen.value = true;
}

function closeAnswerDialog() {
  if (answerPending.value) return;
  answerDialogOpen.value = false;
  answerError.value = '';
}

function updateQuestionAnswerCount(nextCount: number) {
  if (!question.value) return;
  const count = Math.max(0, Math.round(nextCount));
  question.value = {
    ...question.value,
    question_answer_num: count,
    questionAnswerNum: count,
    answer_num: count,
    answerNum: count,
  };
}

async function submitAnswer() {
  if (!questionId.value || answerPending.value) return;
  const message = answerMessage.value.trim();
  if (!message) {
    answerError.value = '请输入回答内容';
    return;
  }
  answerPending.value = true;
  answerError.value = '';
  try {
    const response: any = await CoolapkTauriAPI.createAnswer(questionId.value, message);
    const created = normalizeQuestionAnswer(
      response?.data?.answer || response?.data?.feedInfo || response?.data,
      0,
    );
    const previousAnswerCount = Math.max(getQuestionAnswerCount(question.value), answers.value.length);
    const hasRealAnswer = created && !String(created.id).startsWith('question-answer-');
    if (hasRealAnswer) {
      answers.value = [created, ...answers.value.filter((item) => String(item.id) !== String(created.id))];
    }
    updateQuestionAnswerCount(previousAnswerCount + 1);
    answerDialogOpen.value = false;
    answerMessage.value = '';
    showToast('回答发布成功', 'success');
    if (!hasRealAnswer) void loadAnswers(true);
  } catch (error) {
    answerError.value = getErrorMessage(error, '回答发布失败');
  } finally {
    answerPending.value = false;
  }
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
  answerCursor.value = { firstItem: '', lastItem: '' };
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
  max-width: 1120px;
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
  margin-top: 8px;
  margin-bottom: 6px;
  padding: 0 4px;
}

.answers-title-group,
.answer-sort-tabs {
  display: flex;
  align-items: center;
}

.answers-title-group {
  gap: 8px;
}

.answers-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.answers-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--background-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.answer-sort-tabs {
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-pill, 999px);
  background: var(--background-secondary);
  border: 1px solid var(--border-light, var(--border));
}

.answer-sort-tab {
  min-height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-pill, 999px);
  color: var(--text-tertiary);
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast, 0.15s) ease;
}

.answer-sort-tab:hover:not(.active) {
  color: var(--text-primary);
}

.answer-sort-tab.active {
  color: var(--brand-primary);
  background: var(--surface);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
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
  gap: 12px;
}

.answer-list :deep(.question-answer-card) {
  margin-bottom: 0;
  transition: border-color var(--duration-fast, 0.15s) ease, box-shadow var(--duration-fast, 0.15s) ease;
}

.answer-list :deep(.question-answer-card:hover) {
  border-color: var(--border-hover, var(--border));
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
}

.answers-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding-top: 10px;
  padding-bottom: 12px;
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

.no-more-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  color: var(--text-tertiary);
  font-size: 12px;
}

.no-more-divider::before,
.no-more-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-light);
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

.answer-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.answer-description,
.answer-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.answer-hint {
  color: var(--text-tertiary);
  font-size: 12px;
}

.answer-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 150px;
  resize: vertical;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control, 8px);
  outline: none;
  color: var(--text-primary);
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
}

.answer-textarea:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.answer-error {
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
