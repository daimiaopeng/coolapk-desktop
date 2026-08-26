<template>
  <header class="digital-series-title">
    <span class="series-title-mark"></span>
    <h3>{{ title || '产品系列' }}</h3>
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<style scoped>
.digital-series-title { display: flex; align-items: center; gap: 9px; padding: 6px 3px 1px; }
.series-title-mark { flex: 0 0 4px; width: 4px; height: 19px; border-radius: 999px; background: var(--brand-primary); }
.digital-series-title h3 { margin: 0; color: var(--text-primary); font-size: 17px; font-weight: 700; line-height: 1.3; }
</style>
