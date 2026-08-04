<template>
  <div class="desktop-titlebar" data-tauri-drag-region>
    <div class="titlebar-left" data-tauri-drag-region>
      <img src="../../assets/coolapk-logo-rounded.png" alt="Logo" class="app-logo" />
      <span class="app-title">酷安 桌面版</span>
    </div>
    <div class="titlebar-right">
      <button class="win-btn" aria-label="最小化" title="最小化" @click="minimize">
        <i class="fas fa-minus"></i>
      </button>
      <button class="win-btn" aria-label="最大化" title="最大化" @click="toggleMaximize">
        <i class="far fa-window-maximize"></i>
      </button>
      <button class="win-btn close-btn" aria-label="关闭" title="关闭" @click="close">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Window } from '@tauri-apps/api/window';

async function minimize() {
  try {
    const appWindow = Window.getCurrent();
    await appWindow.minimize();
  } catch (err) {
    console.warn('Native window action not supported in web mode', err);
  }
}

async function toggleMaximize() {
  try {
    const appWindow = Window.getCurrent();
    await appWindow.toggleMaximize();
  } catch (err) {
    console.warn('Native window action not supported in web mode', err);
  }
}

async function close() {
  try {
    const appWindow = Window.getCurrent();
    await appWindow.close();
  } catch (err) {
    console.warn('Native window action not supported in web mode', err);
  }
}
</script>

<style scoped>
.desktop-titlebar {
  height: 32px;
  background-color: var(--surface);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-3);
  user-select: none;
  z-index: 900;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.app-logo {
  width: 18px;
  height: 18px;
}

.app-title {
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
}

.titlebar-right {
  display: flex;
  align-items: center;
}

.win-btn {
  width: 36px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 11px;
  transition: background-color var(--duration-fast) var(--ease-default);
}

.win-btn:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.win-btn.close-btn:hover {
  background-color: var(--danger);
  color: #ffffff;
}
</style>
