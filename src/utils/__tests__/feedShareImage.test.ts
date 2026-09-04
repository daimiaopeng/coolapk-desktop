import { describe, expect, it } from 'vitest';
import { getFeedShareAuthor, getFeedShareFileName, getFeedShareText, getFeedShareTitle } from '../feedShareImage';

describe('动态分享图内容整理', () => {
  it('将富文本整理为纯文本并保留段落换行', () => {
    expect(getFeedShareText({ id: '1', message: '<p>第一段</p><p>第二段<br>继续</p> <a>查看更多</a>' })).toContain('第一段');
    expect(getFeedShareText({ id: '1', message: '<p>第一段</p><p>第二段<br>继续</p> <a>查看更多</a>' })).toContain('第二段');
    expect(getFeedShareText({ id: '1', message: '<p>第一段</p><p>第二段<br>继续</p> <a>查看更多</a>' })).not.toContain('查看更多');
  });

  it('提供分享图标题、作者和稳定文件名', () => {
    expect(getFeedShareTitle({ id: '42', title: '桌面端更新' })).toBe('桌面端更新');
    expect(getFeedShareTitle({ id: '42', title: '小明的动态' })).toBe('');
    expect(getFeedShareAuthor({ id: '42', userInfo: { username: '小明' } })).toBe('小明');
    expect(getFeedShareFileName({ id: '42' })).toBe('coolapk-feed-42.png');
  });
});
