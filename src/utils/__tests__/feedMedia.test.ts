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
    const requestParams = JSON.stringify({
      fromType: 'coolapkVideo',
      url: 'https://provider.example.com/watch/123',
    });
    expect(getFeedVideo({
      feedType: 'video',
      media_type: '2',
      media_url: 'https://video.example.com/video.mp4',
      media_info: JSON.stringify({
        mediaType: 'video',
        cover: 'https://video.example.com/cover.jpg',
        duration: 952183,
        requestParams: JSON.stringify({ 普通: requestParams }),
      }),
    })).toEqual({
      url: 'https://video.example.com/video.mp4',
      poster: 'https://video.example.com/cover.jpg',
      duration: 952.183,
      requestParams,
    });
    expect(formatFeedVideoDuration(952.183)).toBe('15:52');
  });

  it('按 APK 规则识别 localVideo 参数中的直链，并不需要二次解析', () => {
    expect(getFeedVideo({
      media_type: '2',
      media_info: JSON.stringify({
        mediaType: 'video',
        requestParams: JSON.stringify({ 普通: JSON.stringify({ fromType: 'localVideo', 0: 'http://cdn.example.com/upload.mp4' }) }),
      }),
    })).toMatchObject({
      url: 'https://cdn.example.com/upload.mp4',
    });
  });

  it('保留只有 provider requestParams 的动态，交给播放器接口解析', () => {
    const requestParams = JSON.stringify({
      0: 'https://provider.example.com/watch/123',
      1: 95,
      fromType: 'coolapkVideo',
    });
    expect(getFeedVideo({
      id: 123,
      media_info: JSON.stringify({
        mediaType: 'video',
        requestParams: JSON.stringify({ 普通: requestParams }),
      }),
    })).toMatchObject({ url: '', requestParams });
  });

  it('兼容当前接口将 provider 参数直接编码为对象的 mediaInfo', () => {
    const providerParams = { 0: 'https://video-qc.example.com/video.mp4', 1: 95, fromType: 'coolapkVideo' };
    expect(getFeedVideo({
      media_info: JSON.stringify({
        mediaType: 'video',
        requestParams: JSON.stringify({ 普通: providerParams }),
      }),
    })).toMatchObject({
      url: '',
      requestParams: JSON.stringify(providerParams),
    });
  });

  it('格式化视频时长但保留接口已格式化的文本', () => {
    expect(formatFeedVideoDuration(95)).toBe('1:35');
    expect(formatFeedVideoDuration('01:35')).toBe('01:35');
    expect(formatFeedVideoDuration('')).toBe('');
  });
});
