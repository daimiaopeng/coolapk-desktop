/**
 * 文本与内容 Diff 工具函数
 */
import { renderCoolapkRichText } from './richText';

export type DiffOp = 'equal' | 'insert' | 'delete';

export interface DiffPart {
  type: DiffOp;
  text: string;
}

/**
 * 字符串分词（支持中文单字、英文单词、标点、emoji、换行等）
 */
export function tokenizeForDiff(text: string): string[] {
  if (!text) return [];
  // 匹配：酷安表情标签/话题/URL/英文字词/换行/单个中文字符/空格
  const regex = /#[\w\u4e00-\u9fa5\s]+#|\[[\u4e00-\u9fa5\w]+\]|[a-zA-Z0-9]+|[\r\n]+|[^\s\w\u4e00-\u9fa5]|[\u4e00-\u9fa5]|\s+/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    tokens.push(match[0]);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.filter(Boolean);
}

/**
 * 基于最长公共子序列（LCS）计算两段 token 列表的差异
 */
export function diffTokens(oldTokens: string[], newTokens: string[]): DiffPart[] {
  const m = oldTokens.length;
  const n = newTokens.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) return [{ type: 'insert', text: newTokens.join('') }];
  if (n === 0) return [{ type: 'delete', text: oldTokens.join('') }];

  // 优化：处理首尾完全相同的部分（常见的前后缀）
  let prefixCount = 0;
  while (prefixCount < m && prefixCount < n && oldTokens[prefixCount] === newTokens[prefixCount]) {
    prefixCount++;
  }

  let suffixCount = 0;
  while (
    suffixCount < m - prefixCount &&
    suffixCount < n - prefixCount &&
    oldTokens[m - 1 - suffixCount] === newTokens[n - 1 - suffixCount]
  ) {
    suffixCount++;
  }

  const trimmedOld = oldTokens.slice(prefixCount, m - suffixCount);
  const trimmedNew = newTokens.slice(prefixCount, n - suffixCount);

  const tM = trimmedOld.length;
  const tN = trimmedNew.length;

  // 构建 LCS 动态规划矩阵（带上限限制以防止超大文本卡顿）
  const MAX_MATRIX_CELLS = 400000;
  if (tM * tN > MAX_MATRIX_CELLS) {
    // 降级为整段删除 + 整段新增
    const parts: DiffPart[] = [];
    if (prefixCount > 0) parts.push({ type: 'equal', text: oldTokens.slice(0, prefixCount).join('') });
    if (tM > 0) parts.push({ type: 'delete', text: trimmedOld.join('') });
    if (tN > 0) parts.push({ type: 'insert', text: trimmedNew.join('') });
    if (suffixCount > 0) parts.push({ type: 'equal', text: oldTokens.slice(m - suffixCount).join('') });
    return parts;
  }

  const dp: number[][] = Array.from({ length: tM + 1 }, () => new Array(tN + 1).fill(0));

  for (let i = 1; i <= tM; i++) {
    for (let j = 1; j <= tN; j++) {
      if (trimmedOld[i - 1] === trimmedNew[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯生成 Diff 片段
  const middleParts: DiffPart[] = [];
  let i = tM;
  let j = tN;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && trimmedOld[i - 1] === trimmedNew[j - 1]) {
      middleParts.unshift({ type: 'equal', text: trimmedOld[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      middleParts.unshift({ type: 'insert', text: trimmedNew[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      middleParts.unshift({ type: 'delete', text: trimmedOld[i - 1] });
      i--;
    }
  }

  // 合并相同类型的相邻片段
  const merged: DiffPart[] = [];
  const rawParts: DiffPart[] = [
    ...(prefixCount > 0 ? [{ type: 'equal' as const, text: oldTokens.slice(0, prefixCount).join('') }] : []),
    ...middleParts,
    ...(suffixCount > 0 ? [{ type: 'equal' as const, text: oldTokens.slice(m - suffixCount).join('') }] : []),
  ];

  for (const part of rawParts) {
    if (!part.text) continue;
    if (merged.length > 0 && merged[merged.length - 1].type === part.type) {
      merged[merged.length - 1].text += part.text;
    } else {
      merged.push({ ...part });
    }
  }

  return merged;
}

/**
 * 将两段文本做 Diff 并生成带酷安富文本渲染的高亮 HTML
 */
export function generateTextDiffHtml(oldText: string, newText: string): string {
  if (oldText === newText) {
    return renderCoolapkRichText(newText);
  }

  const oldTokens = tokenizeForDiff(oldText || '');
  const newTokens = tokenizeForDiff(newText || '');
  const diffParts = diffTokens(oldTokens, newTokens);

  return diffParts
    .map((part) => {
      const formatted = renderCoolapkRichText(part.text);
      if (part.type === 'insert') {
        return `<ins class="diff-tag-insert" title="本次新增内容">${formatted}</ins>`;
      }
      if (part.type === 'delete') {
        return `<del class="diff-tag-delete" title="本次删除内容">${formatted}</del>`;
      }
      return formatted;
    })
    .join('');
}

/**
 * 统计两段文本的差异字数统计
 */
export function getDiffSummary(oldText: string, newText: string): { addedChars: number; deletedChars: number; isSame: boolean } {
  if (oldText === newText) {
    return { addedChars: 0, deletedChars: 0, isSame: true };
  }
  const oldTokens = tokenizeForDiff(oldText || '');
  const newTokens = tokenizeForDiff(newText || '');
  const diffParts = diffTokens(oldTokens, newTokens);

  let addedChars = 0;
  let deletedChars = 0;

  for (const part of diffParts) {
    if (part.type === 'insert') addedChars += part.text.length;
    if (part.type === 'delete') deletedChars += part.text.length;
  }

  return {
    addedChars,
    deletedChars,
    isSame: addedChars === 0 && deletedChars === 0,
  };
}

/**
 * 图片列表差异对比
 */
export interface ImageDiffItem {
  url: string;
  status: 'normal' | 'added' | 'removed';
}

export function diffImageLists(oldImages: string[], newImages: string[]): ImageDiffItem[] {
  const result: ImageDiffItem[] = [];
  const oldSet = new Set(oldImages || []);
  const newSet = new Set(newImages || []);

  // 新增与保留的图片
  for (const url of newImages || []) {
    if (!oldSet.has(url)) {
      result.push({ url, status: 'added' });
    } else {
      result.push({ url, status: 'normal' });
    }
  }

  // 被删除的图片
  for (const url of oldImages || []) {
    if (!newSet.has(url)) {
      result.push({ url, status: 'removed' });
    }
  }

  return result;
}
