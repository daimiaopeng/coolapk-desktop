import { describe, expect, it } from 'vitest';
import { isPortraitLongImage } from '../image';

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
