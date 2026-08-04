<template>
  <div class="shortcut-key-item">
    <div class="keys-wrapper">
      <kbd v-for="(k, idx) in keys" :key="idx" class="key-cap">{{ k }}</kbd>
    </div>
    <span class="action-desc">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  keys: string[];
  label: string;
}>();
</script>

<style scoped>
.shortcut-key-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-subtle, #f8fafc);
  border: 1px solid var(--divider-color, #edf0f3);
  border-radius: var(--radius-md, 8px);
}

.keys-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.key-cap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: var(--bg-card, #ffffff);
  border: 1px solid #cbd5e1;
  border-bottom: 2px solid #94a3b8;
  border-radius: 4px;
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-main, #172033);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  user-select: none;
}

.action-desc {
  font-size: 0.82rem;
  color: var(--text-sub, #667085);
}
</style>
