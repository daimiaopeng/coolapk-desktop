<template>
  <Transition name="back-to-top-fade">
    <button
      v-if="showButton"
      class="back-to-top-btn"
      title="回到顶部"
      @click="scrollToTop"
    >
      <i class="fas fa-arrow-up icon"></i>
      <span class="tooltip-text">回到顶部</span>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const showButton = ref(false);
let activeScrollTarget: HTMLElement | Window | null = null;

function checkScroll(e?: Event) {
  let scrollTop = 0;
  if (e && e.target && (e.target as HTMLElement).scrollTop !== undefined) {
    const el = e.target as HTMLElement;
    scrollTop = el.scrollTop;
    if (scrollTop > 300) {
      activeScrollTarget = el;
    }
  } else {
    scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop > 300) {
      activeScrollTarget = window;
    }
  }

  showButton.value = scrollTop > 300;
}

function scrollToTop() {
  if (activeScrollTarget && 'scrollTo' in activeScrollTarget) {
    activeScrollTarget.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  } else {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    const scrollables = document.querySelectorAll('.custom-scrollbar, .feed-scroll-container, .page-container, .user-page-wrapper');
    scrollables.forEach(el => {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

onMounted(() => {
  window.addEventListener('scroll', checkScroll, true);
});

onUnmounted(() => {
  window.removeEventListener('scroll', checkScroll, true);
});
</script>

<style scoped>
.back-to-top-btn {
  position: fixed;
  bottom: 28px;
  right: 28px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface, #ffffff);
  color: var(--brand-primary, #10b981);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 990;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.back-to-top-btn:hover {
  transform: translateY(-3px) scale(1.08);
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(16, 185, 129, 0.35);
  border-color: transparent;
}

.icon {
  font-size: 16px;
}

.tooltip-text {
  position: absolute;
  right: 52px;
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.back-to-top-btn:hover .tooltip-text {
  opacity: 1;
}

/* 动画过渡 */
.back-to-top-fade-enter-active,
.back-to-top-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.back-to-top-fade-enter-from,
.back-to-top-fade-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.6);
}
</style>
