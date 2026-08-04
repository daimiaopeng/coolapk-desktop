<template>
  <div class="custom-card" :class="{ 'is-hoverable': hoverable, 'no-padding': noPadding }">
    <div v-if="$slots.header || title" class="card-header">
      <slot name="header">
        <h3 class="card-title">{{ title }}</h3>
        <span v-if="subtitle" class="card-subtitle">{{ subtitle }}</span>
      </slot>
    </div>
    <div class="card-body">
      <slot></slot>
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  subtitle?: string;
  hoverable?: boolean;
  noPadding?: boolean;
}>();
</script>

<style scoped>
.custom-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e4e9ef);
  border-radius: var(--radius-xl, 12px);
  box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.04));
  overflow: hidden;
  transition: var(--transition-fast, all 0.15s ease);
}

.custom-card.is-hoverable:hover {
  box-shadow: var(--shadow-hover, 0 6px 16px rgba(0,0,0,0.06));
  border-color: #cbd5e1;
}

.card-header {
  padding: 16px 20px 12px 20px;
  border-bottom: 1px solid var(--divider-color, #edf0f3);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main, #172033);
}

.card-subtitle {
  font-size: 0.78rem;
  color: var(--text-muted, #98a2b3);
}

.card-body {
  padding: 16px 20px;
}

.custom-card.no-padding .card-body {
  padding: 0;
}

.card-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--divider-color, #edf0f3);
  background: var(--bg-subtle, #f8fafc);
}
</style>
