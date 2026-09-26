import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { getUserProfileCached, preloadUserProfile } from '../userProfilePreloader';

describe('userProfilePreloader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('后台自动预加载使用游客用户空间', async () => {
    vi.useFakeTimers();
    const getUserSpace = vi.spyOn(CoolapkTauriAPI, 'getUserSpace');
    const getPublicUserSpace = vi.spyOn(CoolapkTauriAPI, 'getPublicUserSpace').mockResolvedValue({ data: { uid: 'background-user' } });

    preloadUserProfile('background-user');
    await vi.runAllTimersAsync();

    expect(getPublicUserSpace).toHaveBeenCalledWith('background-user');
    expect(getUserSpace).not.toHaveBeenCalled();
  });

  it('悬停即时读取也使用游客用户空间', async () => {
    const getUserSpace = vi.spyOn(CoolapkTauriAPI, 'getUserSpace').mockResolvedValue({ data: { uid: 'enabled-user' } });
    const getPublicUserSpace = vi.spyOn(CoolapkTauriAPI, 'getPublicUserSpace').mockResolvedValue({ data: { uid: 'hover-user' } });

    await getUserProfileCached('hover-user');

    expect(getPublicUserSpace).toHaveBeenCalledWith('hover-user');
    expect(getUserSpace).not.toHaveBeenCalled();
  });
});
