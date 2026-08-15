import { describe, expect, it } from 'vitest';

function resolveUserUid(routeUid: unknown, authUid: unknown): string {
  const routeValue = String(routeUid || '').trim();
  return routeValue && routeValue !== 'me' ? routeValue : String(authUid || '');
}

describe('user page route uid resolution', () => {
  it('resolves /user/me to the logged-in account uid', () => {
    expect(resolveUserUid('me', 12345)).toBe('12345');
  });

  it('keeps an explicit public uid', () => {
    expect(resolveUserUid('67890', 12345)).toBe('67890');
  });

  it('does not send the literal me when no account is available', () => {
    expect(resolveUserUid('me', '')).toBe('');
  });
});
