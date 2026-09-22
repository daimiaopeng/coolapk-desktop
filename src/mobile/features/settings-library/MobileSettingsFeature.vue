<template>
  <section class="mobile-settings-feature" data-mobile-feature="settings">
    <div class="mobile-settings-feature__surface">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineOptions({ name: 'MobileSettingsFeature' });
</script>

<style scoped>
.mobile-settings-feature,
.mobile-settings-feature__surface {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.mobile-settings-feature {
  overflow: hidden;
  background: var(--background-secondary, #f3f5f7);
  color: var(--text-primary);
}

.mobile-settings-feature__surface {
  flex: 1 1 auto;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 12px max(12px, env(safe-area-inset-left, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-right, 0px));
}

.mobile-settings-feature__surface :deep(button),
.mobile-settings-feature__surface :deep([role='button']),
.mobile-settings-feature__surface :deep(input),
.mobile-settings-feature__surface :deep(select),
.mobile-settings-feature__surface :deep(textarea) {
  min-height: 40px;
  touch-action: manipulation;
}

.mobile-settings-feature__surface :deep(.settings-layout),
.mobile-settings-feature__surface :deep(.settings-page),
.mobile-settings-feature__surface :deep(.settings-content) {
  min-width: 0;
  max-width: 100%;
}

@media (min-width: 960px) {
  .mobile-settings-feature__surface {
    max-width: 900px;
    margin: 0 auto;
    width: min(100%, 900px);
  }
}
</style>
