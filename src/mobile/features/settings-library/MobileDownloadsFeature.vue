<template>
  <section class="mobile-downloads-feature" data-mobile-feature="downloads">
    <div class="mobile-downloads-feature__surface">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineOptions({ name: 'MobileDownloadsFeature' });
</script>

<style scoped>
.mobile-downloads-feature,
.mobile-downloads-feature__surface {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.mobile-downloads-feature {
  overflow: hidden;
  background: var(--background-secondary, #f3f5f7);
  color: var(--text-primary);
}

.mobile-downloads-feature__surface {
  flex: 1 1 auto;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 12px max(12px, env(safe-area-inset-left, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-right, 0px));
}

.mobile-downloads-feature__surface :deep(.downloads-page),
.mobile-downloads-feature__surface :deep(.download-list),
.mobile-downloads-feature__surface :deep(.download-card) {
  min-width: 0;
  max-width: 100%;
}

.mobile-downloads-feature__surface :deep(.download-card) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.mobile-downloads-feature__surface :deep(button),
.mobile-downloads-feature__surface :deep([role='button']) {
  min-height: 44px;
  touch-action: manipulation;
}
</style>
