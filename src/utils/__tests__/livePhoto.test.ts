import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveLivePhotoVideo: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    resolveLivePhotoVideo: mocks.resolveLivePhotoVideo,
  },
}));

import {
  clearLivePhotoVideoCache,
  extractFeedImageInputs,
  normalizeFeedImageItems,
  resolveLivePhotoVideo,
} from '../livePhoto';

const LIVE_URL = 'https://image.coolapk.com/feed/2026/livepic@1080x1920.jpg';

describe('Live Photo 图片数据', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLivePhotoVideoCache();
  });

  it('识别 APK 的 livepic URL 并保留 ImageUrl 实况字段', () => {
    const inputs = extractFeedImageInputs({
      imageUriList: [{
        sourceUrl: LIVE_URL,
        compressedUrl: 'https://image.coolapk.com/feed/2026/livepic-cover.jpg',
        liveVideoUrl: 'https://video.coolapk.com/live/123.mp4',
        livePhotoEnable: 1,
      }],
    });
    const [item] = normalizeFeedImageItems(inputs);

    expect(item).toMatchObject({
      sourceUrl: LIVE_URL,
      coverUrl: 'https://image.coolapk.com/feed/2026/livepic-cover.jpg',
      liveVideoUrl: 'https://video.coolapk.com/live/123.mp4',
      isLivePhoto: true,
    });
  });

  it('按 APK 的 feed_<id> 约定解析视频，并合并相同请求', async () => {
    mocks.resolveLivePhotoVideo.mockResolvedValue({
      code: 200,
      data: { url: 'https://video.coolapk.com/live/123.mp4' },
    });
    const [item] = normalizeFeedImageItems([LIVE_URL]);

    await expect(resolveLivePhotoVideo(item, 'feed-123', 'feed')).resolves.toBe('https://video.coolapk.com/live/123.mp4');
    await expect(resolveLivePhotoVideo(item, 'feed-123', 'feed')).resolves.toBe('https://video.coolapk.com/live/123.mp4');

    expect(mocks.resolveLivePhotoVideo).toHaveBeenCalledTimes(1);
    expect(mocks.resolveLivePhotoVideo).toHaveBeenCalledWith(LIVE_URL, 'feed-123', 'feed');
  });

  it('直链失效时允许忽略元数据地址并重新解析', async () => {
    mocks.resolveLivePhotoVideo.mockResolvedValue({
      code: 200,
      data: { url: 'https://video.coolapk.com/live/refreshed.mp4' },
    });
    const [item] = normalizeFeedImageItems([{
      sourceUrl: LIVE_URL,
      liveVideoUrl: 'https://video.coolapk.com/live/expired.mp4',
      livePhotoEnable: 1,
    }]);

    await expect(resolveLivePhotoVideo(item, 'feed-123', 'feed', { force: true }))
      .resolves.toBe('https://video.coolapk.com/live/refreshed.mp4');
    expect(mocks.resolveLivePhotoVideo).toHaveBeenCalledWith(LIVE_URL, 'feed-123', 'feed');
  });
});
