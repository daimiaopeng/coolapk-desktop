<template>
  <AppDialog
    :is-open="isOpen"
    :title="title"
    :width="420"
    :close-on-backdrop="!loading"
    @close="handleCancel"
  >
    <p class="confirm-message">{{ message }}</p>
    <template #footer>
      <AppButton variant="ghost" :disabled="loading" @click="handleCancel">取消</AppButton>
      <AppButton
        class="confirm-dialog-confirm"
        :variant="danger ? 'danger' : 'primary'"
        :loading="loading"
        @click="$emit('confirm')"
      >
        {{ confirmText }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import AppButton from './AppButton.vue';
import AppDialog from './AppDialog.vue';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    loading?: boolean;
    danger?: boolean;
  }>(),
  {
    title: '请确认',
    confirmText: '确定',
    loading: false,
    danger: false
  }
);

const emit = defineEmits<{
  (event: 'cancel'): void;
  (event: 'confirm'): void;
}>();

function handleCancel() {
  if (!props.loading) emit('cancel');
}
</script>

<style scoped>
.confirm-message {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: 1.7;
}
</style>
