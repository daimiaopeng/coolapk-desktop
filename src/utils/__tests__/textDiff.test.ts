import { describe, it, expect } from 'vitest';
import { tokenizeForDiff, diffTokens, generateTextDiffHtml, getDiffSummary, diffImageLists } from '../textDiff';

describe('textDiff utility', () => {
  it('tokenizeForDiff correctly tokenizes Chinese and English', () => {
    const tokens = tokenizeForDiff('你好 coolapk! #话题#');
    expect(tokens).toContain('你');
    expect(tokens).toContain('好');
    expect(tokens).toContain('coolapk');
    expect(tokens).toContain('#话题#');
  });

  it('diffTokens computes insert, delete and equal parts correctly', () => {
    const oldTokens = ['我', '喜欢', '苹果'];
    const newTokens = ['我', '很', '喜欢', '苹果', '派'];
    const diff = diffTokens(oldTokens, newTokens);

    expect(diff).toEqual([
      { type: 'equal', text: '我' },
      { type: 'insert', text: '很' },
      { type: 'equal', text: '喜欢苹果' },
      { type: 'insert', text: '派' },
    ]);
  });

  it('generateTextDiffHtml wraps additions in <ins> and deletions in <del>', () => {
    const oldText = '今天天气不错';
    const newText = '今天天气真不错呀';
    const html = generateTextDiffHtml(oldText, newText);

    expect(html).toContain('class="diff-tag-insert"');
    expect(html).toContain('真');
    expect(html).toContain('呀');
  });

  it('getDiffSummary counts added and deleted characters accurately', () => {
    const oldText = '苹果手机';
    const newText = '安卓手机赞';
    const summary = getDiffSummary(oldText, newText);

    expect(summary.deletedChars).toBe(2); // '苹果'
    expect(summary.addedChars).toBe(3); // '安卓', '赞'
    expect(summary.isSame).toBe(false);
  });

  it('diffImageLists marks added, normal, and removed images', () => {
    const oldImages = ['a.jpg', 'b.jpg'];
    const newImages = ['b.jpg', 'c.jpg'];
    const diff = diffImageLists(oldImages, newImages);

    expect(diff).toEqual([
      { url: 'b.jpg', status: 'normal' },
      { url: 'c.jpg', status: 'added' },
      { url: 'a.jpg', status: 'removed' },
    ]);
  });
});
