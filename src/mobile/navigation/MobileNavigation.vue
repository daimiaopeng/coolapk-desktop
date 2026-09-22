<template>
  <nav :class="['mobile-navigation', `mobile-navigation--${props.variant}`]" aria-label="移动端主导航">
    <button
      v-for="item in items"
      :key="item.path"
      type="button"
      :class="['mobile-nav-item', `mobile-nav-item--${item.key}`, { active: isActive(item.path) }]"
      :aria-current="isActive(item.path) ? 'page' : undefined"
      @click="router.push(item.path)"
    >
      <i :class="item.icon"></i>
      <span>{{ item.label }}</span>
    </button>

    <button type="button" class="mobile-publish" aria-label="发布动态" @click="appStore.openPublish">
      <i class="fas fa-plus"></i>
      <span v-if="props.variant === 'rail'">发布</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';

const props = withDefaults(defineProps<{ variant?: 'bottom' | 'rail' }>(), { variant: 'bottom' });
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const profilePath = computed(() => '/my');

const items = computed(() => [
  { key: 'home', path: '/', label: '首页', icon: 'fas fa-house' },
  { key: 'digital', path: '/digital', label: '数码', icon: 'fas fa-microchip' },
  { key: 'discover', path: '/discover', label: '发现', icon: 'fas fa-compass' },
  { key: 'profile', path: profilePath.value, label: '我的', icon: 'fas fa-user' },
]);

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/';
  if (path === '/my') return route.path === '/my' || route.path === '/more' || route.path.startsWith('/settings');
  return route.path === path || route.path.startsWith(`${path}/`);
}
</script>

<style scoped>
.mobile-navigation {
  z-index: 30;
  background: color-mix(in srgb, var(--surface) 97%, transparent);
  backdrop-filter: blur(16px);
}

.mobile-navigation--bottom {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  flex: 0 0 auto;
  align-items: start;
  width: min(calc(100% - 24px), 720px);
  min-height: 64px;
  margin: 0 auto 8px;
  padding: 4px 6px max(4px, env(safe-area-inset-bottom, 0px));
  border: 1px solid rgba(255, 255, 255, .9);
  border-radius: 36px;
  background: rgba(255, 255, 255, .9);
  box-shadow: 0 8px 28px rgba(15, 23, 42, .16);
}

.mobile-navigation--bottom .mobile-nav-item--home {
  grid-column: 1;
}

.mobile-navigation--bottom .mobile-nav-item--digital {
  grid-column: 2;
}

.mobile-navigation--bottom .mobile-nav-item--discover {
  grid-column: 4;
}

.mobile-navigation--bottom .mobile-nav-item--profile {
  grid-column: 5;
}

.mobile-navigation--rail {
  display: flex;
  flex: 0 0 88px;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 14px 8px;
  border-right: 1px solid var(--border-light);
}

.mobile-nav-item,
.mobile-publish {
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font: inherit;
  -webkit-tap-highlight-color: transparent;
}

.mobile-navigation--bottom .mobile-publish {
  grid-column: 3;
  grid-row: 1;
}

.mobile-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  min-height: 56px;
  padding: 5px 2px;
  border-radius: 30px;
  font-size: 10px;
}

.mobile-navigation--rail .mobile-nav-item {
  min-height: 58px;
  justify-content: center;
  font-size: 11px;
}

.mobile-nav-item i {
  font-size: 18px;
  line-height: 22px;
}

.mobile-nav-item.active {
  background: #e3e3e3;
  color: #0b9b55;
  font-weight: 700;
}

.mobile-publish {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  min-height: 52px;
  margin: 0 auto;
  border-radius: 28px;
  background: linear-gradient(135deg, #65d29d 0%, #08a960 100%);
  color: #fff;
  box-shadow: 0 5px 16px rgba(15, 157, 88, .3);
  font-size: 22px;
}

.mobile-navigation--rail .mobile-publish {
  flex-direction: column;
  gap: 3px;
  width: 64px;
  margin-top: 8px;
  font-size: 15px;
}

.mobile-publish span {
  font-size: 10px;
}

.mobile-nav-item:active,
.mobile-publish:active {
  transform: scale(.96);
}
</style>
