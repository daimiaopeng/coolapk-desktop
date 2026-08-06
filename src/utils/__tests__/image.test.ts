import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { getImageUrlByQuality, getHdImageUrl, getOriginalImageUrl } from '../../utils/image';
import { useSettingsStore } from '../../stores/settings';

describe('image utils', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('returns empty string for falsy input', () => {
    expect(getImageUrlByQuality('')).toBe('');
    expect(getImageUrlByQuality(null as any)).toBe('');
    expect(getImageUrlByQuality(undefined as any)).toBe('');
  });

  it('returns non-http URLs unchanged', () => {
    expect(getImageUrlByQuality('data:image/png;base64...')).toBe('data:image/png;base64...');
  });

  it('returns non-coolapk URLs unchanged', () => {
    expect(getImageUrlByQuality('https://example.com/img.jpg')).toBe('https://example.com/img.jpg');
  });

  it('appends .m.jpg suffix for hd quality', () => {
    const url = 'https://image.coolapk.com/feed/2024/01/test';
    expect(getImageUrlByQuality(url, 'hd')).toBe('https://image.coolapk.com/feed/2024/01/test.m.jpg');
  });

  it('appends .s.jpg suffix for standard quality', () => {
    const url = 'https://image.coolapk.com/feed/2024/01/test';
    expect(getImageUrlByQuality(url, 'standard')).toBe('https://image.coolapk.com/feed/2024/01/test.s.jpg');
  });

  it('returns raw url without suffix for raw quality', () => {
    const url = 'https://image.coolapk.com/feed/2024/01/test';
    expect(getImageUrlByQuality(url, 'raw')).toBe('https://image.coolapk.com/feed/2024/01/test');
  });

  it('strips existing .m.jpg suffix before applying new quality', () => {
    const url = 'https://image.coolapk.com/feed/2024/01/test.m.jpg';
    expect(getImageUrlByQuality(url, 'standard')).toBe('https://image.coolapk.com/feed/2024/01/test.s.jpg');
  });

  it('strips .s.jpg suffix at end of url for raw', () => {
    const url = 'https://image.coolapk.com/feed/2024/01/test.s.jpg';
    expect(getImageUrlByQuality(url, 'raw')).toBe('https://image.coolapk.com/feed/2024/01/test');
  });

  it('strips query params from the base url', () => {
    const url = 'https://image.coolapk.com/feed/2024/01/test?x=1&y=2';
    expect(getImageUrlByQuality(url, 'raw')).toBe('https://image.coolapk.com/feed/2024/01/test');
  });

  it('getHdImageUrl uses default quality from settings store', () => {
    const store = useSettingsStore();
    store.settings.imageQuality = 'standard';
    const url = 'https://image.coolapk.com/feed/test';
    expect(getHdImageUrl(url)).toBe('https://image.coolapk.com/feed/test.s.jpg');
  });

  it('getOriginalImageUrl strips quality suffix', () => {
    expect(getOriginalImageUrl('https://image.coolapk.com/feed/test.m.jpg'))
      .toBe('https://image.coolapk.com/feed/test');
  });
});
