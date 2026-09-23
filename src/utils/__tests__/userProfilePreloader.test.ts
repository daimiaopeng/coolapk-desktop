import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../../stores/settings';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { preloadUserProfile } from '../userProfilePreloader';

describe('userProfilePreloader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('关闭后台预加载时不请求用户空间', async () => {
    vi.useFakeTimers();
    const settingsStore = useSettingsStore();
    settingsStore.settings.preloadUserProfile = false;
    const getUserSpace = vi.spyOn(CoolapkTauriAPI, 'getUserSpace').mockResolvedValue({ data: { uid: 'disabled-user' } });

    preloadUserProfile('disabled-user');
    await vi.runAllTimersAsync();

    expect(getUserSpace).not.toHaveBeenCalled();
  });

  it('开启后台预加载时继续请求用户空间', async () => {
    vi.useFakeTimers();
    const settingsStore = useSettingsStore();
    settingsStore.settings.preloadUserProfile = true;
    const getUserSpace = vi.spyOn(CoolapkTauriAPI, 'getUserSpace').mockResolvedValue({ data: { uid: 'enabled-user' } });

    preloadUserProfile('enabled-user');
    await vi.runAllTimersAsync();

    expect(getUserSpace).toHaveBeenCalledWith('enabled-user');
  });
});
