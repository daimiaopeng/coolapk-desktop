<template>
  <div class="setting-row" :class="{ 'is-vertical': vertical }">
    <div class="setting-info">
      <label class="setting-label">{{ label }}</label>
      <span v-if="description" class="setting-desc">{{ description }}</span>
    </div>
    <div class="setting-control">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  description?: string;
  vertical?: boolean;
}>();
</script>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--divider-color, #edf0f3);
  gap: 24px;
}

.setting-row:last-child {
  border-bottom: 0;
}

.setting-row.is-vertical {
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 65%;
}

.setting-row.is-vertical .setting-info {
  max-width: 100%;
}

.setting-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main, #172033);
}

.setting-desc {
  font-size: 0.78rem;
  color: var(--text-muted, #98a2b3);
  line-height: 1.4;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-row.is-vertical .setting-control {
  width: 100%;
}
</style>
