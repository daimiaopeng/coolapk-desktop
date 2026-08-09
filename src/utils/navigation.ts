import type { Router } from 'vue-router';

/** 当前是否存在应用内上一页。 */
export function canNavigateBack(router: Router): boolean {
  return Boolean(router.options.history.state.back);
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
