import type { Router } from 'vue-router';

/** 当前是否存在应用内上一页。 */
export function canNavigateBack(router: Router): boolean {
  return Boolean(router.options.history.state.back);
}

/** 当前是否存在可以前进到的应用内页面。 */
export function canNavigateForward(router: Router): boolean {
  return Boolean(router.options.history.state.forward);
}

/**
 * 返回应用内上一页；直接打开详情页时改为进入指定兜底页面，
 * 避免依据浏览器历史长度误退出应用。
 */
export function navigateBack(router: Router, fallback = '/'): void {
  if (canNavigateBack(router)) {
    router.back();
    return;
  }
  void router.replace(fallback);
}

/** 撤销最近一次后退；没有前进记录时不执行任何操作。 */
export function navigateForward(router: Router): void {
  if (canNavigateForward(router)) {
    router.forward();
  }
}

/** 按浏览器刷新语义重新加载当前页面。 */
export function reloadCurrentPage(location: Pick<Location, 'reload'> = window.location): void {
  location.reload();
}
