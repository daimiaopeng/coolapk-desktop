<template>
  <div class="comment-composer">
    <textarea
      v-model="content"
      placeholder="写下你的精彩评论..."
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '../common/AppButton.vue';
import AppIconButton from '../common/AppIconButton.vue';

const props = defineProps<{
  feedId: string | number;
}>();

const emit = defineEmits<{
  (e: 'success'): void;
}>();

const content = ref('');
const submitting = ref(false);

async function handleSubmit() {
  if (!content.value.trim() || submitting.value) return;
  submitting.value = true;
  try {
    // 调用发评论 API
    content.value = '';
    emit('success');
  } catch (err) {
    console.error('Failed to reply feed', err);
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
</style>
