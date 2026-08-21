<template>
  <section class="vote-card" @click.stop>
    <div class="vote-heading">
      <div>
        <span class="vote-title"><i class="fas fa-square-poll-vertical"></i> {{ voteTitle }}</span>
        <span class="vote-rule">{{ ruleText }}</span>
      </div>
      <span v-if="totalVotes > 0" class="vote-total">{{ totalVotes }}人参与</span>
    </div>

    <div class="vote-options">
      <button
        v-for="option in options"
        :key="optionKey(option)"
        type="button"
        class="vote-option"
        :class="{ 'is-selected': selectedIds.includes(optionKey(option)), 'is-result': submitted }"
        :disabled="submitted || submitting"
        @click="toggleOption(option)"
      >
        <span class="vote-option-mark" :style="{ borderColor: optionColor(option) }">
          <i v-if="selectedIds.includes(optionKey(option))" class="fas fa-check"></i>
        </span>
        <span class="vote-option-name">{{ optionTitle(option) }}</span>
        <span v-if="submitted && optionCount(option) !== null" class="vote-option-count">
          {{ optionCount(option) }}票
        </span>
      </button>
    </div>

    <div class="vote-footer">
      <span v-if="submitted" class="vote-submitted"><i class="fas fa-check-circle"></i> 已参与投票</span>
      <span v-else class="vote-hint">请选择{{ minSelect > 1 ? `至少 ${minSelect} 项` : '一个选项' }}</span>
      <button
        v-if="!submitted"
        type="button"
        class="vote-submit"
        :disabled="submitting || !canSubmit"
        @click="submitVote"
      >
        {{ submitting ? '提交中…' : '投票' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';

const props = defineProps<{
  feedId: string | number;
  vote: any;
}>();

const authStore = useAuthStore();
const voteState = ref<any>(props.vote || {});
const selectedIds = ref<string[]>(initialSelectedIds(props.vote));
const submitted = ref(hasExistingVote(props.vote));
const submitting = ref(false);

watch(() => props.vote, (value) => {
  voteState.value = value || {};
  if (!submitted.value) selectedIds.value = initialSelectedIds(value);
}, { deep: true });

const options = computed<any[]>(() => {
  const raw = voteState.value?.options || voteState.value?.voteOptions || voteState.value?.vote_options;
  if (!Array.isArray(raw)) return [];
  return [...raw].sort((a, b) => Number(a?.order ?? a?.sort ?? 0) - Number(b?.order ?? b?.sort ?? 0));
});

const maxSelect = computed(() => {
  const value = Number(voteState.value?.max_select_num ?? voteState.value?.maxSelectNum ?? options.value.length);
  return value > 0 ? value : options.value.length;
});

const minSelect = computed(() => {
  const value = Number(voteState.value?.min_select_num ?? voteState.value?.minSelectNum ?? 1);
  return value > 0 ? Math.min(value, maxSelect.value) : 1;
});

const voteTitle = computed(() => String(voteState.value?.message_title || voteState.value?.title || '投票'));
const totalVotes = computed(() => Number(voteState.value?.total_vote_num ?? voteState.value?.totalVoteNum ?? 0));
const ruleText = computed(() => maxSelect.value > 1 ? `最多选择 ${maxSelect.value} 项` : '单选');
const canSubmit = computed(() => selectedIds.value.length >= minSelect.value && selectedIds.value.length <= maxSelect.value);

function optionKey(option: any): string {
  return String(option?.id ?? option?.option_id ?? option?.optionId ?? option?.value ?? '');
}

function optionTitle(option: any): string {
  return String(option?.title ?? option?.name ?? option?.text ?? option?.label ?? '未命名选项');
}

function optionColor(option: any): string {
  return String(option?.color || '#00b578');
}

function optionCount(option: any): number | null {
  const value = option?.vote_num ?? option?.voteNum ?? option?.count ?? option?.num ?? option?.total_num;
  if (value === undefined || value === null || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function hasExistingVote(vote: any): boolean {
  return Boolean(vote?.user_vote || vote?.userVote || vote?.is_vote || vote?.isVote || vote?.voted);
}

function initialSelectedIds(vote: any): string[] {
  const raw = vote?.user_vote || vote?.userVote || vote?.selected_options || vote?.selectedOptions;
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => optionKey(item)).filter(Boolean);
}

function toggleOption(option: any) {
  const id = optionKey(option);
  if (!id || submitted.value || submitting.value) return;
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((value) => value !== id);
    return;
  }
  if (maxSelect.value === 1) {
    selectedIds.value = [id];
    return;
  }
  if (selectedIds.value.length >= maxSelect.value) {
    showToast(`最多选择 ${maxSelect.value} 项`, 'warning');
    return;
  }
  selectedIds.value = [...selectedIds.value, id];
}

async function submitVote() {
  if (!canSubmit.value || submitting.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }

  submitting.value = true;
  try {
    const response: any = await CoolapkTauriAPI.createUserVote(
      String(props.feedId),
      selectedIds.value,
      Boolean(voteState.value?.anonymous_status ?? voteState.value?.anonymousStatus),
    );
    const returnedVote = response?.data?.vote || response?.data;
    if (returnedVote && typeof returnedVote === 'object' && !Array.isArray(returnedVote)) {
      voteState.value = { ...voteState.value, ...returnedVote };
    }
    submitted.value = true;
    showToast('投票成功', 'success');
  } catch (error) {
    showToast(getErrorMessage(error, '投票失败'), 'error');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.vote-card {
  margin: 14px 0 6px;
  padding: 16px 18px 14px;
  width: fit-content;
  max-width: 100%;
  border: 1px solid #e5e9ed;
  border-radius: 12px;
  background: #f8fafb;
}

.vote-heading,
.vote-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.vote-heading { margin-bottom: 12px; }
.vote-title { color: #18232d; font-size: 15px; font-weight: 700; }
.vote-title i { margin-right: 6px; color: #00b578; }
.vote-rule, .vote-total, .vote-hint { color: #87919a; font-size: 12px; }
.vote-rule { margin-left: 10px; }
.vote-options {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.vote-option {
  display: flex;
  align-items: center;
  width: min(480px, 100%);
  min-height: 42px;
  padding: 8px 11px;
  border: 1px solid #dfe5e9;
  border-radius: 8px;
  background: #fff;
  color: #27323a;
  cursor: pointer;
  text-align: left;
  transition: border-color .15s ease, background .15s ease;
}

.vote-option:hover:not(:disabled) { border-color: #00b578; background: #f2fbf7; }
.vote-option.is-selected { border-color: #00b578; background: #edfaf5; }
.vote-option:disabled { cursor: default; }
.vote-option-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin-right: 9px;
  border: 2px solid #b9c3ca;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
}

.is-selected .vote-option-mark { border-color: #00b578 !important; background: #00b578; }
.vote-option-name { flex: 1; overflow-wrap: anywhere; font-size: 14px; }
.vote-option-count { margin-left: 10px; color: #71808a; font-size: 12px; }
.vote-footer { margin-top: 13px; }

.vote-submit {
  min-width: 68px;
  padding: 6px 16px;
  border: 0;
  border-radius: 16px;
  background: #00b578;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.vote-submit:disabled { background: #c7d8d1; cursor: not-allowed; }
.vote-submitted { color: #00a86f; font-size: 13px; }
.vote-submitted i { margin-right: 5px; }
</style>
