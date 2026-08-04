import { APP_VERSION } from '../constants/version';

export { APP_VERSION };
const RELEASES_URL = 'https://api.github.com/repos/daimiaopeng/coolapk-desktop/releases/latest';

export type UpdateInfo = {
  hasNew: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
};

function versionParts(version: string) {
  return version.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerVersion(latest: string, current = APP_VERSION) {
  const latestParts = versionParts(latest);
  const currentParts = versionParts(current);
  for (let index = 0; index < Math.max(latestParts.length, currentParts.length); index += 1) {
    const difference = (latestParts[index] || 0) - (currentParts[index] || 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

export async function checkLatestRelease(): Promise<UpdateInfo> {
  const response = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github.v3+json' } });
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
  const release = await response.json();
  const tagName = release.tag_name || '';
  return {
    hasNew: Boolean(tagName) && isNewerVersion(tagName),
    latestVersion: tagName || '最新发布',
    releaseNotes: release.body ? release.body.slice(0, 300) : '暂无特别更新说明',
    downloadUrl: release.html_url || 'https://github.com/daimiaopeng/coolapk-desktop/releases',
  };
}
