import { describe, expect, it } from 'vitest';
import { formatFeedVideoDuration, getFeedVideo } from '../feedMedia';

describe('动态视频字段解析', () => {
  it('兼容视频 URL、封面和时长的驼峰/下划线字段', () => {
    expect(getFeedVideo({ video_url: 'http://cdn.example.com/video.mp4', videoPic: '/video-cover.jpg', video_duration: 95 })).toEqual({
      url: 'https://cdn.example.com/video.mp4',
      poster: '/video-cover.jpg',
      duration: 95,
    });
  });

  it('兼容嵌套 videoInfo，并拒绝未知协议', () => {
    expect(getFeedVideo({ videoInfo: { url: '//cdn.example.com/video.mp4', cover: 'cover.jpg', duration: '01:08' } })).toEqual({
      url: 'https://cdn.example.com/video.mp4',
      poster: 'cover.jpg',
      duration: '01:08',
    });
    expect(getFeedVideo({ videoUrl: 'javascript:alert(1)' })).toBeNull();
  });

  it('解析酷安视频动态的 media_url 和 media_info JSON', () => {
    expect(getFeedVideo({
      feedType: 'video',
      media_type: '2',
      media_url: 'https://video.example.com/video.mp4',
      media_info: JSON.stringify({ mediaType: 'video', cover: 'https://video.example.com/cover.jpg', duration: 952183 }),
    })).toEqual({
      url: 'https://video.example.com/video.mp4',
      poster: 'https://video.example.com/cover.jpg',
      duration: 952.183,
    });
    expect(formatFeedVideoDuration(952.183)).toBe('15:52');
  });

  it('格式化视频时长但保留接口已格式化的文本', () => {
    expect(formatFeedVideoDuration(95)).toBe('1:35');
    expect(formatFeedVideoDuration('01:35')).toBe('01:35');
    expect(formatFeedVideoDuration('')).toBe('');
  });
});
