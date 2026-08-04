<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="dialog-backdrop" @click="handleBackdropClick"></div>
    </Transition>
    <Transition name="scale-dialog">
      <div v-if="isOpen" class="dialog-wrapper">
        <div class="dialog-container" :style="{ width: `${width}px` }">
          <div v-if="title" class="dialog-header">
            <h3 class="dialog-title">{{ title }}</h3>
            <button class="dialog-close" aria-label="关闭" @click="close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="dialog-body custom-scrollbar">
            <slot></slot>
          </div>
          <div v-if="$slots.footer" class="dialog-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    title?: string;
    width?: number;
    closeOnBackdrop?: boolean;
  }>(),
  {
    title: '',
    width: 600,
    closeOnBackdrop: true
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function close() {
  emit('close');
}

function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    close();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (props.isOpen && e.key === 'Escape') {
    close();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.dialog-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2001;
  pointer-events: none;
}

.dialog-container {
  pointer-events: auto;
  background-color: var(--surface);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-dialog);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;
}

.dialog-header {
  height: 56px;
  padding: 0 var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light);
}

.dialog-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.dialog-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
}

.dialog-close:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.dialog-body {
  padding: var(--space-5);
  overflow-y: auto;
  flex: 1;
}

.dialog-footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  background-color: var(--background-secondary);
}
</style>
