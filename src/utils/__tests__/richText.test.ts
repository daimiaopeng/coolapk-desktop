import { describe, it, expect } from 'vitest';
import { renderCoolapkRichText } from '../richText';

describe('renderCoolapkRichText', () => {
  it('渲染表情代码并保留站内链接', () => {
    const input =
      '懂了，厂商可以远程云控[受虐滑稽][受虐滑稽]' +
      '<a href="/feed/72852407?rid=1&amp;pRid=2">查看详情</a>';
    const html = renderCoolapkRichText(input);
    expect(html).toContain('coolapk_emotion_64_shounuehuaji.png');
    expect(html).toContain('<a href="/feed/72852407?rid=1&amp;pRid=2"');
    expect(html.match(/coolapk_emotion_64_shounuehuaji\.png/g)).toHaveLength(2);
  });

  it('不渲染未知标签内容', () => {
    const html = renderCoolapkRichText('<script>alert(1)</script>[doge]');
    expect(html).not.toContain('alert');
    expect(html).toContain('doge.png');
  });

  it('空输入返回空字符串', () => {
    expect(renderCoolapkRichText('')).toBe('');
  });
});
