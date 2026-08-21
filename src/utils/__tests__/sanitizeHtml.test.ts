import { describe, it, expect } from 'vitest';
import { sanitizeCoolapkHtml } from '../sanitizeHtml';

describe('sanitizeCoolapkHtml', () => {
  it('保留站内与 http(s) 链接，剥离多余属性', () => {
    const input =
      '插眼//<a class="feed-link-uname" href="/u/测试用户">@测试用户</a>:不如债券基金' +
      '<a class="feed-forward-pic" href="http://image.coolapk.com/feed/2023/0822/16/123456_1c34c870_4735_0557_79@1440x3200.jpeg">查看图片</a>';
    const html = sanitizeCoolapkHtml(input);
    expect(html).toContain('<a href="/u/测试用户"');
    expect(html).toContain('class="coolapk-user-link"');
    expect(html).toContain('<a href="http://image.coolapk.com/feed/2023/0822/16/123456_1c34c870_4735_0557_79@1440x3200.jpeg"');
    expect(html).toContain('@测试用户');
    expect(html).toContain('查看图片');
    expect(html).not.toContain('feed-link-uname');
    expect(html).not.toContain('feed-forward-pic');
  });

  it('保留酷安站内 hash 路径，交由路由层校验具体目标', () => {
    const html = sanitizeCoolapkHtml('<a href="#/feed/nodeRatingList?uid=123&targetType=product&parseRatingToFeed=1">点击点评</a>');
    expect(html).toContain('href="#/feed/nodeRatingList?uid=123&amp;targetType=product&amp;parseRatingToFeed=1"');
    expect(html).toContain('点击点评');
  });

  it('剥离除 a/br 外的所有标签，仅保留文本', () => {
    const html = sanitizeCoolapkHtml('<div><span>内容</span><b>加粗</b></div>');
    expect(html).toBe('内容加粗');
  });

  it('丢弃 script/style 等危险内容', () => {
    const html = sanitizeCoolapkHtml('<script>alert(1)</script>你好<script src="evil.js"></script>');
    expect(html).not.toContain('alert');
    expect(html).not.toContain('script');
    expect(html).toContain('你好');
  });

  it('javascript: 等不安全协议链接按纯文本处理', () => {
    const html = sanitizeCoolapkHtml('<a href="javascript:alert(1)">点击</a>');
    expect(html).not.toContain('<a');
    expect(html).toContain('点击');
  });

  it('换行转为 <br/>', () => {
    const html = sanitizeCoolapkHtml('第一行\n第二行');
    expect(html).toContain('第一行<br>');
    expect(html).toContain('第二行');
  });

  it('空输入返回空字符串', () => {
    expect(sanitizeCoolapkHtml('')).toBe('');
    expect(sanitizeCoolapkHtml(null as unknown as string)).toBe('');
  });
});
