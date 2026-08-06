import { describe, it, expect } from 'vitest';
import { APP_VERSION } from '../../constants/version';

describe('version constant', () => {
  it('APP_VERSION is a non-empty string', () => {
    expect(APP_VERSION).toBeTruthy();
    expect(typeof APP_VERSION).toBe('string');
  });

  it('APP_VERSION follows semver pattern', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
