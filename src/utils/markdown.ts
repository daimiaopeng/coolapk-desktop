/**
 * 轻量且安全的 Markdown 解析器，用于版本更新日志 (Release Notes / Changelog) 的富文本渲染。
 * 支持标题、粗体、斜体、列表（含嵌套）、引用块、行内代码/代码块、分割线与超链接。
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseInline(text: string): string {
  let res = text;

  // 使用无冲突的 token 占位符
  const tokens: string[] = [];
  const makeToken = (html: string) => {
    tokens.push(html);
    return `\u0000TOK${tokens.length - 1}\u0000`;
  };

  // 1. 行内代码 `code`
  res = res.replace(/`([^`]+)`/g, (_match, code) => makeToken(`<code>${code}</code>`));

  // 2. Markdown 链接: [text](url)
  res = res.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) =>
    makeToken(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`)
  );

  // 3. 裸链接: https://...
  res = res.replace(/(https?:\/\/[^\s<>"]+)/g, (_match, url) =>
    makeToken(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
  );

  // 4. 粗体: **text** 或 __text__
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 5. 斜体: *text* 或 _text_
  res = res.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  res = res.replace(/(^|\s)_([^_]+)_(?=\s|$|[.,!?;:])/g, '$1<em>$2</em>');

  // 6. 还原所有 token
  res = res.replace(/\u0000TOK(\d+)\u0000/g, (_match, idx) => tokens[Number(idx)] || '');

  return res;
}

export function renderReleaseMarkdown(content: string): string {
  if (!content || !content.trim()) return '';

  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const htmlParts: string[] = [];

  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let inBlockquote = false;
  let blockquoteBuffer: string[] = [];
  let listStack: Array<{ type: 'ul' | 'ol'; indent: number }> = [];

  function closeLists(targetIndent = -1) {
    while (listStack.length > 0) {
      const top = listStack[listStack.length - 1];
      if (top.indent >= targetIndent && targetIndent !== -1) {
        htmlParts.push(`</${top.type}>`);
        listStack.pop();
      } else if (targetIndent === -1) {
        htmlParts.push(`</${top.type}>`);
        listStack.pop();
      } else {
        break;
      }
    }
  }

  function flushBlockquote() {
    if (inBlockquote) {
      const parsedBody = blockquoteBuffer.map((line) => parseInline(escapeHtml(line))).join('<br/>');
      htmlParts.push(`<blockquote>${parsedBody}</blockquote>`);
      blockquoteBuffer = [];
      inBlockquote = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // 代码块标记 ```
    if (/^\s*```/.test(rawLine)) {
      if (inCodeBlock) {
        htmlParts.push(`<pre><code>${escapeHtml(codeBlockBuffer.join('\n'))}</code></pre>`);
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        closeLists();
        flushBlockquote();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(rawLine);
      continue;
    }

    // 引用块 >
    const quoteMatch = rawLine.match(/^\s*>\s?(.*)$/);
    if (quoteMatch) {
      closeLists();
      inBlockquote = true;
      blockquoteBuffer.push(quoteMatch[1]);
      continue;
    } else {
      flushBlockquote();
    }

    const trimmed = rawLine.trim();

    // 空行
    if (!trimmed) {
      closeLists();
      continue;
    }

    // 分割线 ---, ***, ___
    if (/^(\s*[-*_]\s*){3,}$/.test(trimmed)) {
      closeLists();
      htmlParts.push('<hr />');
      continue;
    }

    // 标题 # ~ ######
    const headingMatch = rawLine.match(/^\s*(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      const text = parseInline(escapeHtml(headingMatch[2]));
      const tag = level <= 2 ? 'h4' : level === 3 ? 'h5' : 'h6';
      htmlParts.push(`<${tag}>${text}</${tag}>`);
      continue;
    }

    // 列表项 (- / * / + / 1. / 2.)
    const listMatch = rawLine.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const marker = listMatch[2];
      const text = parseInline(escapeHtml(listMatch[3]));
      const listType: 'ul' | 'ol' = /^\d+\./.test(marker) ? 'ol' : 'ul';

      if (listStack.length === 0) {
        listStack.push({ type: listType, indent });
        htmlParts.push(`<${listType}>`);
      } else {
        const top = listStack[listStack.length - 1];
        if (indent > top.indent) {
          listStack.push({ type: listType, indent });
          htmlParts.push(`<${listType}>`);
        } else if (indent < top.indent) {
          closeLists(indent);
          if (listStack.length === 0 || listStack[listStack.length - 1].indent < indent) {
            listStack.push({ type: listType, indent });
            htmlParts.push(`<${listType}>`);
          }
        }
      }
      htmlParts.push(`<li>${text}</li>`);
      continue;
    }

    // 普通段落
    closeLists();
    const parsedLine = parseInline(escapeHtml(trimmed));
    htmlParts.push(`<p>${parsedLine}</p>`);
  }

  // 收尾未闭合的块
  if (inCodeBlock) {
    htmlParts.push(`<pre><code>${escapeHtml(codeBlockBuffer.join('\n'))}</code></pre>`);
  }
  flushBlockquote();
  closeLists();

  return htmlParts.join('\n');
}
