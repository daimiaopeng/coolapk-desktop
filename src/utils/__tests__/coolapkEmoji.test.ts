import { describe, it, expect } from 'vitest';
import { renderCoolapkEmoji, EMOJI_MAP, EMOJI_BASE } from '../../utils/coolapkEmoji';

describe('coolapkEmoji', () => {
  it('EMOJI_MAP contains known emojis', () => {
    expect(EMOJI_MAP['哈哈哈']).toBeTruthy();
    expect(EMOJI_MAP['doge']).toBeTruthy();
    expect(EMOJI_MAP['酷安']).toBeTruthy();
  });

  it('EMOJI_BASE is correct', () => {
    expect(EMOJI_BASE).toBe('https://static.coolapk.com/emoticons/v9/');
  });

  it('renderCoolapkEmoji converts [哈哈哈] to img tag', () => {
    const result = renderCoolapkEmoji('[哈哈哈]');
    expect(result).toContain('<img');
    expect(result).toContain('coolapk_emotion_1_hahaha.png');
    expect(result).toContain('alt="[哈哈哈]"');
    expect(result).toContain('title="哈哈哈"');
  });

  it('renderCoolapkEmoji leaves unknown patterns unchanged', () => {
    const result = renderCoolapkEmoji('[unknown_stuff]');
    expect(result).toBe('[unknown_stuff]');
  });

  it('renderCoolapkEmoji handles mixed content', () => {
    const result = renderCoolapkEmoji('hello [doge] world [酷安]');
    expect(result).toContain('hello');
    expect(result).toContain('world');
    expect(result).toContain('coolapk_emotion_37_doge.png');
    expect(result).toContain('coolapk_emotion_60_kuan.png');
  });

  it('renderCoolapkEmoji returns empty string for empty input', () => {
    expect(renderCoolapkEmoji('')).toBe('');
  });

  it('renderCoolapkEmoji handles text with no emoji tags', () => {
    const text = 'just plain text here';
    expect(renderCoolapkEmoji(text)).toBe(text);
  });

  it('all emoji map entries have valid image references', () => {
    const entries = Object.entries(EMOJI_MAP);
    expect(entries.length).toBeGreaterThan(50);
    for (const [, filename] of entries) {
      expect(filename).toBeTruthy();
      expect(typeof filename).toBe('string');
    }
  });
});
