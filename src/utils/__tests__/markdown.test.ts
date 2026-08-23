import { describe, it, expect } from 'vitest';
import { renderReleaseMarkdown } from '../markdown';

describe('renderReleaseMarkdown', () => {
  it('handles empty or blank content gracefully', () => {
    expect(renderReleaseMarkdown('')).toBe('');
    expect(renderReleaseMarkdown('   ')).toBe('');
  });

  it('renders headings correctly', () => {
    const input = '## 🚀 Coolapk Desktop v1.9.0\n### 🎉 新增功能';
    const output = renderReleaseMarkdown(input);
    expect(output).toContain('<h4>🚀 Coolapk Desktop v1.9.0</h4>');
    expect(output).toContain('<h5>🎉 新增功能</h5>');
  });

  it('renders bold, italic and inline code', () => {
    const input = '这是 **粗体** 和 *斜体* 以及 `inline_code`';
    const output = renderReleaseMarkdown(input);
    expect(output).toContain('<strong>粗体</strong>');
    expect(output).toContain('<em>斜体</em>');
    expect(output).toContain('<code>inline_code</code>');
  });

  it('renders blockquote and horizontal rules', () => {
    const input = '> 本次版本带来了重大更新\n---\n普通段落';
    const output = renderReleaseMarkdown(input);
    expect(output).toContain('<blockquote>本次版本带来了重大更新</blockquote>');
    expect(output).toContain('<hr />');
    expect(output).toContain('<p>普通段落</p>');
  });

  it('renders lists and nested lists correctly', () => {
    const input = `- 项目 1\n  - 子项目 1.1\n- 项目 2`;
    const output = renderReleaseMarkdown(input);
    expect(output).toContain('<ul>');
    expect(output).toContain('<li>项目 1</li>');
    expect(output).toContain('<li>子项目 1.1</li>');
    expect(output).toContain('<li>项目 2</li>');
    expect(output).toContain('</ul>');
  });

  it('renders links and autolinks safely', () => {
    const input = '[官方仓库](https://github.com/daimiaopeng/coolapk-desktop)\nhttps://github.com/daimiaopeng';
    const output = renderReleaseMarkdown(input);
    expect(output).toContain('<a href="https://github.com/daimiaopeng/coolapk-desktop" target="_blank" rel="noopener noreferrer">官方仓库</a>');
    expect(output).toContain('<a href="https://github.com/daimiaopeng" target="_blank" rel="noopener noreferrer">https://github.com/daimiaopeng</a>');
  });

  it('escapes dangerous HTML tags to prevent XSS', () => {
    const input = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const output = renderReleaseMarkdown(input);
    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
    expect(output).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders code blocks properly', () => {
    const input = '```ts\nconst a = 1 < 2;\nconsole.log(a);\n```';
    const output = renderReleaseMarkdown(input);
    expect(output).toContain('<pre><code>const a = 1 &lt; 2;\nconsole.log(a);</code></pre>');
  });
});
