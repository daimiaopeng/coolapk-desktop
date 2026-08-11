<template>
  <div class="comment-composer">
    <div v-if="replyTo" class="reply-target-bar">
      <span class="reply-target-text">回复 <span class="reply-target-name">@{{ replyTo.username }}</span></span>
      <button class="reply-target-clear" title="取消回复" @click="emit('cancelReply')">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <textarea
      v-model="content"
      :placeholder="replyTo ? `回复 @${replyTo.username}...` : '写下你的精彩评论...'"
      class="composer-textarea custom-scrollbar"
      rows="3"
    ></textarea>

    <div class="composer-toolbar">
      <div class="toolbar-left">
        <AppIconButton icon="far fa-smile" title="表情" aria-label="表情" size="sm" />
        <AppIconButton icon="far fa-image" title="图片" aria-label="图片" size="sm" />
        <AppIconButton icon="fas fa-hashtag" title="话题" aria-label="话题" size="sm" />
      </div>

      <AppButton
        variant="primary"
        size="sm"
        :disabled="!content.trim()"
        :loading="submitting"
        @click="handleSubmit"
      >
        发布评论
      </AppButton>
    </div>

    <div v-if="errorMsg" class="composer-error">
      <i class="fas fa-exclamation-circle"></i> {{ errorMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import AppButton from '../common/AppButton.vue';
import AppIconButton from '../common/AppIconButton.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { clearCommentDraft, loadCommentDraft, saveCommentDraft } from '../../utils/commentDrafts';

const props = defineProps<{
  feedId: string | number;
  replyTo?: { rid: string | number; username: string } | null;
}>();

const emit = defineEmits<{
  (e: 'success'): void;
  (e: 'cancelReply'): void;
}>();

const authStore = useAuthStore();

const content = ref('');
const submitting = ref(false);
const errorMsg = ref('');
let restoringDraft = false;

function currentDraftAccount(): string {
  return String(authStore.user?.uid || 'guest');
}

async function restoreDraft() {
  restoringDraft = true;
  try {
    content.value = await loadCommentDraft(currentDraftAccount(), props.feedId, props.replyTo?.rid);
  } finally {
    restoringDraft = false;
  }
}

watch([() => props.feedId, () => props.replyTo?.rid, () => authStore.user?.uid], () => {
  void restoreDraft();
});

watch(content, (value) => {
  if (!restoringDraft) void saveCommentDraft(currentDraftAccount(), props.feedId, props.replyTo?.rid, value);
});

onMounted(() => {
  void restoreDraft();
});

async function handleSubmit() {
  if (!content.value.trim() || submitting.value) return;

  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }

  submitting.value = true;
  errorMsg.value = '';
  try {
    await CoolapkTauriAPI.replyFeed(
      String(props.feedId),
      content.value.trim(),
      props.replyTo ? String(props.replyTo.rid) : undefined
    );
    await clearCommentDraft(currentDraftAccount(), props.feedId, props.replyTo?.rid);
    content.value = '';
    emit('success');
  } catch (err: any) {
    errorMsg.value = err?.message || '评论发布失败，请检查网络或登录状态';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.comment-composer {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-3);
  margin-bottom: var(--space-4);
}

.composer-textarea {
  width: 100%;
  resize: none;
  background: transparent;
  font-size: var(--font-size-sub);
  line-height: var(--line-height-sub);
  color: var(--text-primary);
}

.composer-textarea::placeholder {
  color: var(--text-tertiary);
}

.composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-light);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.composer-error {
  margin-top: var(--space-2);
  font-size: 12px;
  color: var(--danger, #f04444);
  display: flex;
  align-items: center;
  gap: 4px;
}

.reply-target-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--brand-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  margin-bottom: var(--space-2);
  font-size: 12px;
  color: var(--text-secondary);
}

.reply-target-name {
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.reply-target-clear {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
}

.reply-target-clear:hover {
  color: var(--danger);
}
</style>
