import { sanitizeCoolapkHtml } from './sanitizeHtml';
import { renderCoolapkEmoji } from './coolapkEmoji';

/**
 * 统一渲染酷安富文本：先安全化（去标签/防注入），再渲染 [表情] 代码。
 * 所有动态/评论/通知正文渲染都应走此函数。
 */
export function renderCoolapkRichText(text: string): string {
  if (!text) return '';
  return renderCoolapkEmoji(sanitizeCoolapkHtml(text));
}
