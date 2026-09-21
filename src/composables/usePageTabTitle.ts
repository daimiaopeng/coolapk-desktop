import { onUnmounted, watch, type WatchSource } from 'vue';
import { useRoute } from 'vue-router';
import { usePageTabsStore } from '../stores/pageTabs';
import { getPageTabId } from '../utils/pageTabs';

/** 页面数据异步返回后，用真实名称替换标签栏中的路由占位标题。 */
export function usePageTabTitle(title: WatchSource<string | null | undefined>) {
  const route = useRoute();
  const tabsStore = usePageTabsStore();
  // keep-alive 页面隐藏后仍可能完成异步请求；固定创建时的身份，避免误改当前可见标签的标题。
  const tabId = getPageTabId(route);
  const stop = watch(title, (value) => { if (value?.trim()) tabsStore.updateTitle(tabId, value); }, { immediate: true });
  onUnmounted(stop);
}
