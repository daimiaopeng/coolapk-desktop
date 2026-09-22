<template>
  <section class="mobile-library-feature" data-mobile-feature="library">
    <div class="mobile-library-feature__surface">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineOptions({ name: 'MobileLibraryFeature' });
</script>

<style scoped>
.mobile-library-feature,
.mobile-library-feature__surface {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.mobile-library-feature {
  overflow: hidden;
  background: var(--background-secondary, #f3f5f7);
  color: var(--text-primary);
}

.mobile-library-feature__surface {
  flex: 1 1 auto;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 10px max(10px, env(safe-area-inset-left, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(10px, env(safe-area-inset-right, 0px));
}

.mobile-library-feature__surface :deep(.favorites-page),
.mobile-library-feature__surface :deep(.history-page),
.mobile-library-feature__surface :deep(.albums-page),
.mobile-library-feature__surface :deep(.pictures-page) {
  min-width: 0;
  max-width: 100%;
}

.mobile-library-feature__surface :deep(.favorite-grid),
.mobile-library-feature__surface :deep(.album-grid),
.mobile-library-feature__surface :deep(.picture-grid) {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  min-width: 0;
}

.mobile-library-feature__surface :deep(button),
.mobile-library-feature__surface :deep([role='button']),
.mobile-library-feature__surface :deep(input),
.mobile-library-feature__surface :deep(select) {
  min-height: 40px;
  touch-action: manipulation;
}
</style>
