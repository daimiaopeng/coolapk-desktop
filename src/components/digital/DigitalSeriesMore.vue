<template>
  <button type="button" class="digital-series-more" @click="$emit('open')">
    <span>{{ label || '更多' }}</span>
    <i class="fas fa-chevron-right"></i>
  </button>
</template>

<script setup lang="ts">
defineProps<{ label?: string }>();
defineEmits<{ (event: 'open'): void }>();
</script>

<style scoped>
.digital-series-more { display: inline-flex; align-items: center; gap: 8px; min-height: 34px; padding: 0 4px; border: 0; background: transparent; color: var(--brand-primary); cursor: pointer; font: inherit; font-size: 12px; }
.digital-series-more:hover { color: var(--brand-primary-hover, #059669); }
.digital-series-more i { font-size: 10px; }
</style>
