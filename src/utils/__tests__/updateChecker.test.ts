import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isNewerVersion, checkLatestRelease } from '../updateChecker';

describe('updateChecker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isNewerVersion', () => {
    it('returns true when latest is greater than current', () => {
      expect(isNewerVersion('1.4.6', '1.4.5')).toBe(true);
      expect(isNewerVersion('v1.5.0', '1.4.5')).toBe(true);
      expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
    });

    it('returns false when latest is equal or lower than current', () => {
      expect(isNewerVersion('1.4.5', '1.4.5')).toBe(false);
      expect(isNewerVersion('1.4.4', '1.4.5')).toBe(false);
      expect(isNewerVersion('v1.3.9', '1.4.5')).toBe(false);
    });
  });

  describe('checkLatestRelease', () => {
    it('fetches stable latest release and matches installer URL', async () => {
      const mockRelease = {
        tag_name: 'v9.9.9',
        body: '这是升级日志说明',
        html_url: 'https://github.com/daimiaopeng/coolapk-desktop/releases/tag/v9.9.9',
        assets: [
          {
            name: 'coolapk-desktop_9.9.9_x64-setup.exe',
            browser_download_url: 'https://github.com/download/coolapk-desktop_9.9.9_x64-setup.exe',
          },
          {
            name: 'coolapk-desktop_9.9.9_arm64-setup.exe',
            browser_download_url: 'https://github.com/download/coolapk-desktop_9.9.9_arm64-setup.exe',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      } as Response);

      const info = await checkLatestRelease('stable');
      expect(info.hasNew).toBe(true);
      expect(info.latestVersion).toBe('v9.9.9');
      expect(info.installerUrl).toBe('https://github.com/download/coolapk-desktop_9.9.9_x64-setup.exe');
      expect(info.releaseNotes).toBe('这是升级日志说明');
    });
  });
});
