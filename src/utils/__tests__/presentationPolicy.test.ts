import { describe, expect, it } from 'vitest';
import {
  getMobileLayoutForWidth,
  resolveInitialPresentation,
  resolvePresentationForWidth,
} from '../presentationPolicy';

describe('presentation policy', () => {
  it('uses the requested 720/760 hysteresis thresholds', () => {
    expect(resolveInitialPresentation('auto', 'windows', 800)).toBe('desktop');
    expect(resolvePresentationForWidth('desktop', 'auto', 'windows', 719)).toBe('mobile');
    expect(resolvePresentationForWidth('mobile', 'auto', 'windows', 721)).toBe('mobile');
    expect(resolvePresentationForWidth('mobile', 'auto', 'windows', 750)).toBe('mobile');
    expect(resolvePresentationForWidth('mobile', 'auto', 'windows', 761)).toBe('desktop');
    expect(resolvePresentationForWidth('desktop', 'auto', 'windows', 750)).toBe('desktop');
  });

  it('keeps Android and iOS in Mobile Presentation at every width', () => {
    expect(resolveInitialPresentation('force-desktop', 'android', 1440)).toBe('mobile');
    expect(resolvePresentationForWidth('mobile', 'auto', 'ios', 1440)).toBe('mobile');
  });

  it('supports QA overrides without changing route identity', () => {
    expect(resolvePresentationForWidth('desktop', 'force-mobile', 'windows', 1440)).toBe('mobile');
    expect(resolvePresentationForWidth('mobile', 'force-desktop', 'windows', 360)).toBe('desktop');
  });

  it('provides compact, medium, and expanded Mobile layouts', () => {
    expect(getMobileLayoutForWidth(390)).toBe('compact');
    expect(getMobileLayoutForWidth(768)).toBe('medium');
    expect(getMobileLayoutForWidth(1024)).toBe('expanded');
  });
});
