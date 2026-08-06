import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../../stores/auth';

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts with logged-out state', () => {
    const store = useAuthStore();
    expect(store.isLoggedIn).toBe(false);
    expect(store.user).toBeNull();
    expect(store.rawCookie).toBe('');
    expect(store.isLoginModalOpen).toBe(false);
  });

  it('openLoginModal sets modal flag', () => {
    const store = useAuthStore();
    store.openLoginModal();
    expect(store.isLoginModalOpen).toBe(true);
  });

  it('closeLoginModal clears modal flag', () => {
    const store = useAuthStore();
    store.openLoginModal();
    store.closeLoginModal();
    expect(store.isLoginModalOpen).toBe(false);
  });

  it('logout clears user state and localStorage', async () => {
    const store = useAuthStore();
    store.user = { uid: '1', username: 'test', userAvatar: '' };
    store.isLoggedIn = true;
    store.rawCookie = 'SESSID=abc';
    localStorage.setItem('coolapk_cookie', 'SESSID=abc');
    localStorage.setItem('coolapk_user', JSON.stringify({ uid: '1' }));

    await store.logout();

    expect(store.isLoggedIn).toBe(false);
    expect(store.user).toBeNull();
    expect(store.rawCookie).toBe('');
    expect(localStorage.getItem('coolapk_cookie')).toBeNull();
    expect(localStorage.getItem('coolapk_user')).toBeNull();
  });
});
