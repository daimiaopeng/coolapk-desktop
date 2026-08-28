import { ref } from 'vue';

const isSidebarTransitionActive = ref(false);
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 触发侧边栏导航平滑过渡动效
 * @param durationMs 超时自动回退时间，默认 600ms（覆盖 out-in 动画时长）
 */
export function triggerSidebarTransition(durationMs = 600): void {
  isSidebarTransitionActive.value = true;
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
  }
  fallbackTimer = setTimeout(() => {
    isSidebarTransitionActive.value = false;
    fallbackTimer = null;
  }, durationMs);
}

/**
 * 重置侧边栏路由过渡动效状态
 */
export function resetSidebarTransition(): void {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  isSidebarTransitionActive.value = false;
}

/**
 * 侧边栏导航过渡动效状态组合函数
 */
export function useSidebarTransition() {
  return {
    isSidebarTransitionActive,
    triggerSidebarTransition,
    resetSidebarTransition,
  };
}
