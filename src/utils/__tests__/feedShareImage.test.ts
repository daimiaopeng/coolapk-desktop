import { describe, expect, it } from 'vitest';
import {
  getFeedShareAuthor,
  getFeedShareCommentAuthor,
  getFeedShareCommentLikes,
  getFeedShareCommentText,
  getFeedShareComments,
  getFeedShareDevice,
  getFeedShareEmojiNames,
  getFeedShareFileName,
  getFeedShareLevel,
  getFeedShareText,
  getFeedShareTitle,
} from '../feedShareImage';

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

  it('从动态字段读取等级和设备胶囊', () => {
    expect(getFeedShareLevel({ id: '42', userInfo: { level: 4 } })).toBe('4');
    expect(getFeedShareDevice({ id: '42', device_title: '华为 Mate 80 Pro Max' })).toBe('华为 Mate 80 Pro Max');
    expect(getFeedShareDevice({ id: '42', deviceTitle: '小米 15 Ultra' })).toBe('小米 15 Ultra');
  });

  it('识别分享正文中的酷安表情标记并去重', () => {
    expect(getFeedShareEmojiNames('[喷血]普通文字[吃瓜][喷血][unknown]')).toEqual(['喷血', '吃瓜']);
    expect(getFeedShareEmojiNames('[牛牛点赞]支持[牛牛点赞]！')).toEqual(['牛牛点赞']);
  });

  it('整理最多三条热评并保留作者和点赞数', () => {
    const comments = [
      { id: '1', username: '热评用户', message: '<p>很有参考价值[吃瓜]</p>', likenum: 28 },
      { id: '2', userInfo: { username: '第二位' }, message: '[图片]', likenum: 9 },
      { id: '3', username: '第三位', message: '第三条热评', likenum: 123 },
      { id: '4', username: '第四位', message: '点赞最多的热评', likenum: 516 },
      { id: '3', username: '重复评论', message: '重复评论' },
    ];

    const hotComments = getFeedShareComments(comments);
    expect(hotComments).toHaveLength(3);
    expect(hotComments.map((comment) => comment.id)).toEqual(['4', '3', '1']);
    expect(getFeedShareCommentLikes(hotComments[0])).toBe('516 赞');
    expect(getFeedShareCommentText(comments[0])).toBe('很有参考价值[吃瓜]');
    expect(getFeedShareCommentText(comments[1])).toBe('（图片评论）');
    expect(getFeedShareCommentAuthor(comments[1])).toBe('第二位');
    expect(getFeedShareCommentLikes(comments[0])).toBe('28 赞');
  });
});
