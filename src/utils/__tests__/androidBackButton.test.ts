import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

const backButtonMock = vi.hoisted(() => {
  const state: { handler?: (payload: { canGoBack: boolean }) => void } = {};
  const unregister = vi.fn(async () => undefined);
  const register = vi.fn(async (handler: (payload: { canGoBack: boolean }) => void) => {
    state.handler = handler;
    return { unregister };
  });
  return { state, register };
});

vi.mock('@tauri-apps/api/app', () => ({ onBackButtonPress: backButtonMock.register }));

import { useAndroidBackButton } from '../androidBackButton';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete backButtonMock.state.handler;
});

describe('useAndroidBackButton', () => {
  it('does not register a native listener for a desktop user agent', () => {
    vi.stubGlobal('isTauri', true);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });

    const active = ref(true);
    const scope = effectScope();
    scope.run(() => useAndroidBackButton(() => active.value, vi.fn()));

    expect(backButtonMock.register).not.toHaveBeenCalled();
    scope.stop();
  });

  it('dispatches to the top active surface and restores the previous one when it closes', () => {
    vi.stubGlobal('isTauri', true);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)' });

    const lowerActive = ref(true);
    const lowerBack = vi.fn();
    const lowerScope = effectScope();
    lowerScope.run(() => useAndroidBackButton(() => lowerActive.value, lowerBack));

    const topActive = ref(true);
    const topBack = vi.fn();
    const topScope = effectScope();
    topScope.run(() => useAndroidBackButton(() => topActive.value, topBack));

    expect(backButtonMock.register).toHaveBeenCalledTimes(1);
    backButtonMock.state.handler?.({ canGoBack: false });
    expect(topBack).toHaveBeenCalledTimes(1);
    expect(lowerBack).not.toHaveBeenCalled();

    topScope.stop();
    backButtonMock.state.handler?.({ canGoBack: false });
    expect(lowerBack).toHaveBeenCalledTimes(1);

    lowerScope.stop();
  });
});
