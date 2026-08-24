import { describe, expect, it } from 'vitest';
import { getImageUrlByQuality, isAnimatedImageUrl, isPortraitLongImage } from '../image';

describe('动图地址判断', () => {
  it('识别 GIF、GIFV 以及带参数的地址', () => {
    expect(isAnimatedImageUrl('https://image.coolapk.com/a/demo.GIF?x=1')).toBe(true);
    expect(isAnimatedImageUrl('https://image.coolapk.com/a/demo.gifv#frame')).toBe(true);
    expect(isAnimatedImageUrl('data:image/gif;base64,R0lGODlh')).toBe(true);
  });

  it('不把静态缩略图和普通图片识别为动图', () => {
    expect(isAnimatedImageUrl('https://image.coolapk.com/a/demo.gif.m.jpg')).toBe(false);
    expect(isAnimatedImageUrl('https://image.coolapk.com/a/demo.jpg')).toBe(false);
  });

  it('高清处理不会破坏 GIF 原地址', () => {
    const url = 'https://image.coolapk.com/a/demo.gif';
    expect(getImageUrlByQuality(url, 'hd')).toBe(url);
  });
});

describe('图片宽高比判断', () => {
  it('只把纵向超长图片识别为长图', () => {
    expect(isPortraitLongImage(0.4)).toBe(true);
    expect(isPortraitLongImage(0.7)).toBe(false);
    expect(isPortraitLongImage(2.2)).toBe(false);
  });

  it('忽略尚未加载或无效的宽高比', () => {
    expect(isPortraitLongImage(0)).toBe(false);
    expect(isPortraitLongImage(Number.NaN)).toBe(false);
  });
});
