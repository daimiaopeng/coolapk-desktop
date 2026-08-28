/**
 * 将酷安 API 返回的富文本 HTML 安全转换为可渲染的 HTML。
 *
 * 通用规则（不针对具体标签写特例）：
 *  - 仅 <a> 与 <br> 保留语义，其余标签一律视为透明容器，递归保留其文本与合法链接；
 *  - <a> 仅当 href 为 http(s)、协议相对(//)、站内路径(/) 或站内 hash 路径(#/) 时保留，其余按纯文本处理；
 *  - script/style/iframe 等危险内容直接丢弃；
 *  - 换行统一转为 <br/>。
 */

const SAFE_LINK_RE = /^(https?:)?\/\//i;

function highlightTextNodes(root: Node, keyword: string, doc: Document) {
  const kw = keyword.trim();
  if (!kw) return;
  const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedKw})`, 'gi');

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode.parentElement?.tagName.toLowerCase() !== 'mark') {
      textNodes.push(currentNode as Text);
    }
    currentNode = walker.nextNode();
  }

  for (const node of textNodes) {
    const text = node.nodeValue || '';
    if (!regex.test(text)) continue;
    const parts = text.split(regex);
    const frag = doc.createDocumentFragment();
    for (const part of parts) {
      if (part.toLowerCase() === kw.toLowerCase()) {
        const mark = doc.createElement('mark');
        mark.classList.add('search-highlight');
        mark.textContent = part;
        frag.appendChild(mark);
      } else if (part) {
        frag.appendChild(doc.createTextNode(part));
      }
    }
    node.parentNode?.replaceChild(frag, node);
  }
}

export function sanitizeCoolapkHtml(text: string, keyword?: string): string {
  if (!text) return '';
  const doc = new DOMParser().parseFromString(text.replace(/\n/g, '<br/>'), 'text/html');

  doc.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());

  const convert = (node: Node): Node => {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
    if (node.nodeType !== Node.ELEMENT_NODE) return doc.createTextNode('');
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') return doc.createElement('br');

    if (tag === 'mark') {
      const mark = doc.createElement('mark');
      mark.classList.add('search-highlight');
      el.childNodes.forEach((c) => mark.appendChild(convert(c)));
      return mark;
    }

    if (tag === 'font' || tag === 'span') {
      const hasHighlight = el.classList.contains('highlight') || el.classList.contains('hit') || el.getAttribute('color') || (el as HTMLElement).style?.color;
      if (hasHighlight) {
        const mark = doc.createElement('mark');
        mark.classList.add('search-highlight');
        el.childNodes.forEach((c) => mark.appendChild(convert(c)));
        return mark;
      }
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      if (SAFE_LINK_RE.test(href) || href.startsWith('/') || href.startsWith('#/')) {
        const a = doc.createElement('a');
        a.setAttribute('href', href);
        a.setAttribute('rel', 'noopener noreferrer');
        if (/^\/u\//i.test(href)) {
          a.classList.add('coolapk-user-link');
        }
        el.childNodes.forEach((c) => a.appendChild(convert(c)));
        return a;
      }
      return doc.createTextNode(el.textContent || '');
    }

    const frag = doc.createDocumentFragment();
    el.childNodes.forEach((c) => frag.appendChild(convert(c)));
    return frag;
  };

  const frag = doc.createDocumentFragment();
  doc.body.childNodes.forEach((c) => frag.appendChild(convert(c)));
  doc.body.innerHTML = '';
  doc.body.appendChild(frag);

  if (keyword && keyword.trim()) {
    highlightTextNodes(doc.body, keyword.trim(), doc);
  }

  return doc.body.innerHTML;
}

/** 将酷安富文本 HTML 转为纯文本（去标签、解码实体），用于文本插值场景 */
export function coolapkHtmlToPlainText(text: string): string {
  if (!text) return '';
  const doc = new DOMParser().parseFromString(text.replace(/\n/g, '<br/>'), 'text/html');
  return (doc.body.textContent || '').replace(/\s*\n\s*/g, '\n').trim();
}
