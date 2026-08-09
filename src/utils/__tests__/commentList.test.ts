import { describe, expect, it } from 'vitest';
import {
  COMMENT_SORT_OPTIONS,
  DEFAULT_COMMENT_SORT_MODE,
  formatCommentAbsoluteTime,
  formatCommentTime,
  getCommentDeviceTitle,
  getCommentImages,
  getCommentLocation,
  getCommentUserLevel,
  getCommentVerifyTitle,
  mergeReplies,
  sortComments,
} from '../commentList';

describe('评论列表处理', () => {
  const comments = [
    { id: '101', message: '较早评论', dateline: 100, likenum: 8 },
    { id: '102', message: '最新评论', dateline: 300, likenum: 2 },
    { id: '103', message: '中间评论', dateline: 200, likenum: 15 },
  ];

  it('合并热门和普通评论时保留普通评论并按编号去重', () => {
    const result = mergeReplies([comments[2]], comments);
    expect(result.map((item) => item.id)).toEqual(['103', '101', '102']);
  });

  it('热门评论缺少时间时从完整评论补齐，同时保持热门顺序', () => {
    const result = mergeReplies(
      [
        { id: 'hot-1', message: '热门评论', likenum: 20, infoHtml: '回复' },
        { id: 'hot-2', message: '第二条热门评论', infoHtml: '1分钟前' },
      ],
      [
        { id: 'hot-1', message: '热门评论', dateline: 100, infoHtml: '24分钟前' },
        { id: 'normal-1', message: '普通评论', dateline: 200, infoHtml: '12分钟前' },
      ],
    );

    expect(result.map((item) => item.id)).toEqual(['hot-1', 'hot-2', 'normal-1']);
    expect(result[0]).toMatchObject({ likenum: 20, dateline: 100, infoHtml: '24分钟前' });
    expect(result[1].infoHtml).toBe('1分钟前');
  });

  it('支持按点赞最多、最新和最早排序', () => {
    expect(sortComments(comments, 'likes').map((item) => item.id)).toEqual(['103', '101', '102']);
    expect(sortComments(comments, 'latest').map((item) => item.id)).toEqual(['102', '103', '101']);
    expect(sortComments(comments, 'earliest').map((item) => item.id)).toEqual(['101', '103', '102']);
  });

  it('排序按钮按最新、最早、点赞最多排列，并默认使用最早', () => {
    expect(COMMENT_SORT_OPTIONS.map((option) => option.label)).toEqual([
      '最新的',
      '最早的',
      '点赞最多的',
    ]);
    expect(DEFAULT_COMMENT_SORT_MODE).toBe('earliest');
  });

  it('忽略热门接口的回复文案并根据时间戳显示评论时间', () => {
    expect(formatCommentTime({ infoHtml: '回复', dateline: 1_000 }, 2_440)).toBe('24分钟前');
    expect(formatCommentTime({ infoHtml: '6分钟前', dateline: 1_000 }, 2_440)).toBe('6分钟前');
    expect(formatCommentTime({ dateline: 2_420 }, 2_440)).toBe('刚刚');
  });

  it('点击时间所需的完整时间格式精确到秒', () => {
    const timestamp = new Date(2026, 7, 9, 10, 20, 30).getTime() / 1000;
    expect(formatCommentAbsoluteTime({ dateline: timestamp })).toBe('2026-08-09 10:20:30');
    expect(formatCommentAbsoluteTime({ infoHtml: '回复' })).toBe('');
  });

  it('整理评论单图、多图和对象图片字段并去重', () => {
    expect(getCommentImages({
      pic: '/feed/a.jpg',
      picArr: '["//image.coolapk.com/feed/a.jpg", {"url":"https://image.coolapk.com/feed/b.jpg"}]',
      images: [{ src: 'https://image.coolapk.com/feed/c.jpg' }],
    })).toEqual([
      'https://image.coolapk.com/feed/a.jpg',
      'https://image.coolapk.com/feed/b.jpg',
      'https://image.coolapk.com/feed/c.jpg',
    ]);
  });

  it('兼容完整接口与嵌套回复中的作者附加字段', () => {
    const item = {
      device_title: '小米 17 Pro',
      ip_location: '广东深圳',
      userInfo: { level: 6, verify_title: '酷安认证用户' },
    };
    expect(getCommentDeviceTitle(item)).toBe('小米 17 Pro');
    expect(getCommentLocation(item)).toBe('广东深圳');
    expect(getCommentUserLevel(item)).toBe('6');
    expect(getCommentVerifyTitle(item)).toBe('酷安认证用户');
  });
});
