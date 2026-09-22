import { describe, expect, it } from 'vitest';
import { featureCapabilities } from '../featureCapabilities';

describe('feature capability manifest', () => {
  it('declares both Desktop and Mobile support for every migrated feature', () => {
    expect(featureCapabilities.length).toBeGreaterThan(0);
    for (const feature of featureCapabilities) {
      expect(feature.id).toBeTruthy();
      expect(feature.routes.length).toBeGreaterThan(0);
      expect(feature.actions.length).toBeGreaterThan(0);
      expect(feature.desktop).not.toBe('not-supported');
      expect(feature.mobile).not.toBe('not-supported');
      expect(feature.mobileEntry).toMatch(/^src\//);
    }
  });

  it('keeps feature identifiers unique', () => {
    const ids = featureCapabilities.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
