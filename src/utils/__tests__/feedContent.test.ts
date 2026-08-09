import { describe, expect, it } from 'vitest';
import { getFeedDetailMessage, hasFeedMoreSuffix, stripFeedMoreSuffix } from '../feedContent';

describe('动态正文处理', () => {
  it('识别并移除纯文本查看更多', () => {
    const message = '预计发布日期 2026 年 8 月 24 日... 查看更多';
    expect(hasFeedMoreSuffix(message)).toBe(true);
    expect(stripFeedMoreSuffix(message)).toBe('预计发布日期 2026 年 8 月 24 日');
  });

  it('识别并移除链接形式的查看更多', () => {
    const message = '正文… <a href="/feed/123">查看更多</a>';
    expect(hasFeedMoreSuffix(message)).toBe(true);
    expect(stripFeedMoreSuffix(message)).toBe('正文');
  });

  it('不删除正文中的普通查看更多文字', () => {
    const message = '这里介绍如何查看更多内容，不是列表占位。';
    expect(hasFeedMoreSuffix(message)).toBe(false);
    expect(stripFeedMoreSuffix(message)).toBe(message);
  });

  it('按优先级提取动态详情正文', () => {
    expect(getFeedDetailMessage({ message: '完整正文', message_raw_output: '原始正文' })).toBe('完整正文');
    expect(getFeedDetailMessage({ message_raw_output: '原始正文' })).toBe('原始正文');
  });
});
