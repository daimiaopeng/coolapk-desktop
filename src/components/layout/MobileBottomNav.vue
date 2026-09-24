<template>
  <nav class="mobile-bottom-nav" aria-label="移动端主导航">
    <button
      v-for="item in leftItems"
      :key="item.path"
      type="button"
      :class="['mobile-nav-item', { active: isActive(item.path) }]"
      @click="router.push(item.path)"
    >
      <i :class="item.icon"></i>
      <span>{{ item.label }}</span>
    </button>

    <button type="button" class="mobile-publish" aria-label="发布动态" @click="appStore.openPublish">
      <i class="fas fa-plus"></i>
    </button>

    <button
      v-for="item in rightItems"
      :key="item.path"
      type="button"
      :class="['mobile-nav-item', { active: isActive(item.path) }]"
      @click="router.push(item.path)"
    >
      <i :class="item.icon"></i>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();

const leftItems = [
  { path: '/', label: '首页', icon: 'fas fa-house' },
  { path: '/digital', label: '数码', icon: 'fas fa-microchip' },
];

const profilePath = computed(() => {
  const uid = String(authStore.user?.uid || '').trim();
  return uid ? `/user/${encodeURIComponent(uid)}` : '/more';
});

const rightItems = computed(() => [
  { path: '/discover', label: '发现', icon: 'fas fa-compass' },
  { path: profilePath.value, label: '我的', icon: 'fas fa-user' },
]);

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/';
  if (path.startsWith('/user/')) return route.path.startsWith('/user/');
  return route.path === path || route.path.startsWith(`${path}/`);
}
</script>

<style scoped>
.mobile-bottom-nav {
  display: none;
}

@media (max-width: 720px) {
  .mobile-bottom-nav {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    flex: 0 0 auto;
    align-items: start;
    min-height: var(--mobile-bottom-nav-height);
    padding: 6px 6px env(safe-area-inset-bottom);
    border-top: 1px solid var(--border-light);
    background: color-mix(in srgb, var(--surface) 97%, transparent);
    backdrop-filter: blur(16px);
    z-index: 30;
  }

  .mobile-nav-item,
  .mobile-publish {
    border: 0;
    background: transparent;
    color: var(--text-tertiary);
    font: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 0;
    padding: 5px 2px;
    font-size: 10px;
  }

  .mobile-nav-item i {
    font-size: 18px;
    line-height: 22px;
  }

  .mobile-nav-item.active {
    color: var(--brand-primary);
    font-weight: 700;
  }

  .mobile-publish {
    display: grid;
    place-items: center;
    width: 48px;
    height: 38px;
    margin: 0 auto;
    border-radius: 14px;
    background: var(--brand-primary);
    color: #fff;
    box-shadow: 0 5px 16px color-mix(in srgb, var(--brand-primary) 35%, transparent);
    font-size: 18px;
  }

  .mobile-nav-item:active,
  .mobile-publish:active {
    transform: scale(.96);
  }
}
</style>
