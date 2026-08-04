<template>
  <div :class="['app-avatar', `size-${size}`]" :style="{ width: `${sizePx}px`, height: `${sizePx}px` }">
    <AppImage :src="src || defaultAvatar" :alt="alt || 'avatar'" image-class="avatar-img" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppImage from './AppImage.vue';

const props = withDefaults(
  defineProps<{
    src?: string;
    alt?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  }>(),
  {
    size: 'md'
  }
);

const defaultAvatar = 'https://c2.coolapk.com/coolmarket/apk/default_avatar.png';

const sizePx = computed(() => {
  if (typeof props.size === 'number') return props.size;
  switch (props.size) {
    case 'sm': return 32;
    case 'md': return 44;
    case 'lg': return 56;
    case 'xl': return 72;
    default: return 44;
  }
});

</script>

<style scoped>
.app-avatar {
  border-radius: var(--radius-pill);
  overflow: hidden;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-light);
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
