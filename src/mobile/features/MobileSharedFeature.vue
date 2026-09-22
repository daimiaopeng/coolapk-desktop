<template>
  <section class="mobile-shared-feature" data-mobile-feature="shared">
    <div class="mobile-shared-feature__surface">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineOptions({ name: 'MobileSharedFeature' });
</script>

<style scoped>
.mobile-shared-feature {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background);
  color: var(--text-primary);
}

.mobile-shared-feature__surface {
  display: flex;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-shared-feature__surface :deep(*) {
  min-width: 0;
  max-width: 100%;
}

.mobile-shared-feature__surface :deep(button),
.mobile-shared-feature__surface :deep([role='button']),
.mobile-shared-feature__surface :deep(input),
.mobile-shared-feature__surface :deep(textarea),
.mobile-shared-feature__surface :deep(select) {
  touch-action: manipulation;
}
</style>
