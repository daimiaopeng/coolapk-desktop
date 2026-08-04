<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="drawer-backdrop" @click="handleBackdropClick"></div>
    </Transition>
    <Transition name="slide-drawer">
      <div v-if="isOpen" class="drawer-container" :style="{ width: `${width}px` }">
        <div class="drawer-header">
          <h3 class="drawer-title">{{ title }}</h3>
          <button class="drawer-close" aria-label="关闭" @click="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="drawer-body custom-scrollbar">
          <slot></slot>
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
    width: 520,
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
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.drawer-container {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  background-color: var(--surface);
  z-index: 1001;
  box-shadow: var(--shadow-drawer);
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
}

.drawer-header {
  height: var(--header-height);
  padding: 0 var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.drawer-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.drawer-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
}

.drawer-close:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}
</style>
