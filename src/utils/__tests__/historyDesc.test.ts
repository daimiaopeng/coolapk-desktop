import { describe, it, expect } from 'vitest';
import { renderCoolapkRichText } from '../richText';

const rawFromApi =
  '<a class="feed-link-tag" href="/t/%E6%95%B0%E7%A0%81%E6%97%A5%E5%B8%B8?type=0">#数码日常#</a> <a class="feed-link-tag" href="/t/Windows11?type=0">#Windows11#</a>\n在家用 Windows 刷酷安的新方式——在 M1 Mac mini 上刷 iOS 版[受虐滑稽][受虐滑稽]';

describe('history description rich text', () => {
  it('decodes escaped links and emoji', () => {
    const out = renderCoolapkRichText(rawFromApi);
    expect(out).not.toContain('&lt;');
    expect(out).toContain('href="/t/%E6%95%B0%E7%A0%81%E6%97%A5%E5%B8%B8?type=0"');
    expect(out).toContain('#数码日常#');
    expect(out).toContain('coolapk_emotion_64_shounuehuaji.png');
    expect(out).toContain('<br>');
  });
});
