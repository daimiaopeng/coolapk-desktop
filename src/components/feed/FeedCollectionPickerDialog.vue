<template>
  <AppDialog :is-open="isOpen" title="选择收藏夹" :width="460" :close-on-backdrop="!submitting" @close="close">
    <div v-if="loading" class="collection-picker-state">
      <i class="fas fa-spinner fa-spin"></i>
      <span>正在加载收藏夹...</span>
    </div>

    <div v-else-if="collections.length === 0" class="collection-picker-state is-empty">
      <i class="far fa-folder-open"></i>
      <span>暂无可用收藏夹</span>
    </div>

    <div v-else class="collection-picker-list">
      <button
        v-for="collection in collections"
        :key="collectionKey(collection)"
        type="button"
        class="collection-picker-item"
        :class="{ 'is-selected': selectedIds.has(collectionKey(collection)) }"
        :disabled="submitting"
        @click="toggle(collection)"
      >
        <span class="collection-picker-check">
          <i v-if="selectedIds.has(collectionKey(collection))" class="fas fa-check"></i>
        </span>
        <span class="collection-picker-info">
          <span class="collection-picker-title">{{ collectionTitle(collection) }}</span>
          <span v-if="isDefault(collection)" class="collection-picker-tag">默认</span>
        </span>
        <span v-if="isCollected(collection)" class="collection-picker-status">已收藏</span>
      </button>
    </div>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="close">取消</AppButton>
      <AppButton
        variant="primary"
        :loading="submitting"
        :disabled="loading || selectedIds.size === 0"
        @click="confirm"
      >
        确定收藏
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import AppButton from '../common/AppButton.vue';
import AppDialog from '../common/AppDialog.vue';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    collections: any[];
    selectedIds?: string[];
    loading?: boolean;
    submitting?: boolean;
  }>(),
  {
    selectedIds: () => [],
    loading: false,
    submitting: false,
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', ids: string[]): void;
}>();

const selectedIds = ref(new Set<string>());

function collectionKey(collection: any): string {
  return String(collection?.id ?? collection?.collectionId ?? collection?.entityId ?? '');
}

function collectionTitle(collection: any): string {
  return String(collection?.title ?? collection?.name ?? '未命名收藏夹');
}

function isOne(value: any): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function isDefault(collection: any): boolean {
  return isOne(
    collection?.defaultCollected ??
    collection?.default_collected ??
    collection?.isDefault ??
    collection?.is_default ??
    collection?.isDefaultCollection,
  );
}

function isCollected(collection: any): boolean {
  return isOne(collection?.isBeCollected ?? collection?.is_be_collected);
}

function syncSelectedIds() {
  selectedIds.value = new Set(props.selectedIds.filter((id) => id.length > 0));
}

watch(
  () => [props.isOpen, props.selectedIds] as const,
  ([isOpen]) => {
    if (isOpen) syncSelectedIds();
  },
  { immediate: true },
);

function toggle(collection: any) {
  const id = collectionKey(collection);
  if (!id || props.submitting) return;
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function close() {
  if (!props.submitting) emit('close');
}

function confirm() {
  if (props.loading || props.submitting || selectedIds.value.size === 0) return;
  emit('confirm', Array.from(selectedIds.value));
}
</script>

<style scoped>
.collection-picker-state {
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-secondary);
}

.collection-picker-state.is-empty {
  flex-direction: column;
  color: var(--text-tertiary);
}

.collection-picker-state.is-empty i {
  font-size: 28px;
}

.collection-picker-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collection-picker-item {
  width: 100%;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default), background-color var(--duration-fast) var(--ease-default);
}

.collection-picker-item:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--border);
}

.collection-picker-item.is-selected {
  background: var(--brand-soft);
  border-color: var(--brand-primary);
}

.collection-picker-item:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.collection-picker-check {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-inverse);
  background: var(--surface);
}

.is-selected .collection-picker-check {
  border-color: var(--brand-primary);
  background: var(--brand-primary);
}

.collection-picker-info {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.collection-picker-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-picker-tag,
.collection-picker-status {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--brand-primary);
}

.collection-picker-status {
  color: var(--text-tertiary);
}
</style>
