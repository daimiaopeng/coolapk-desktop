<template>
  <div class="window-controls" data-tauri-drag-region="false" aria-label="窗口控制">
    <button type="button" class="window-control-button" aria-label="最小化" title="最小化" @click="$emit('minimize')">
      <svg class="minimize-icon" aria-hidden="true" viewBox="0 0 12 12">
        <path d="M1 6.5h10" />
      </svg>
    </button>
    <button
      type="button"
      class="window-control-button"
      :aria-label="isMaximized ? '还原' : '最大化'"
      :title="isMaximized ? '还原' : '最大化'"
      @click="$emit('toggle-maximize')"
    >
      <svg v-if="isMaximized" class="restore-icon" aria-hidden="true" viewBox="0 0 12 12">
        <path d="M4 3.25V1.5h6.5V8H8.75M1.5 3.5h7v7h-7z" />
      </svg>
      <svg v-else class="maximize-icon" aria-hidden="true" viewBox="0 0 12 12">
        <rect x="1" y="1" width="10" height="10" />
      </svg>
    </button>
    <button type="button" class="window-control-button close-button" aria-label="关闭" title="关闭" @click="$emit('close')">
      <svg class="close-icon" aria-hidden="true" viewBox="0 0 12 12">
        <path d="m1.25 1.25 9.5 9.5m0-9.5-9.5 9.5" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ isMaximized: boolean }>();
defineEmits<{
  minimize: [];
  'toggle-maximize': [];
  close: [];
}>();
</script>

<style scoped>
.window-controls {
  align-self: stretch;
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
  height: var(--app-titlebar-height);
  border-left: 1px solid transparent;
}

.window-control-button {
  width: var(--window-control-width);
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: default;
  transition: background-color var(--duration-fast) var(--ease-default),
              color var(--duration-fast) var(--ease-default);
}

.window-control-button svg {
  width: 14px;
  height: 14px;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: square;
  stroke-linejoin: miter;
  shape-rendering: geometricPrecision;
}

.window-control-button .close-icon {
  stroke-width: 1.1;
}

.window-control-button svg * {
  vector-effect: non-scaling-stroke;
}

.window-control-button:hover {
  background-color: var(--window-control-hover);
}

.window-control-button:active {
  background-color: var(--window-control-active);
}

.window-control-button.close-button:hover,
.window-control-button.close-button:active {
  background-color: #c42b1c;
  color: #ffffff;
}

.window-control-button:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: -2px;
}
</style>
