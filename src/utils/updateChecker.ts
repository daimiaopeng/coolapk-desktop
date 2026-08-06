import { APP_VERSION } from '../constants/version';

export { APP_VERSION };
const RELEASES_URL = 'https://api.github.com/repos/daimiaopeng/coolapk-desktop/releases/latest';

export type UpdateInfo = {
  hasNew: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  installerUrl?: string;
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
  const hasNew = Boolean(tagName) && isNewerVersion(tagName);

  // 挑选 Windows 安装包（NSIS setup.exe），优先 x64，且包内版本号必须与发布标签一致
  let installerUrl: string | undefined;
  const assets: Array<{ name?: string; browser_download_url?: string }> = release.assets || [];
  const candidates = assets.filter(
    (asset) => asset.name && /[-_]setup\.exe$/i.test(asset.name) && asset.browser_download_url
  );
  const tagVersion = tagName.replace(/^v/i, '');
  const versionMatched = candidates.filter(
    (asset) => asset.name && versionFromAssetName(asset.name) === tagVersion
  );
  const validCandidates = versionMatched.length > 0 ? versionMatched : [];
  if (validCandidates.length > 0) {
    const preferred = validCandidates.find((asset) => /x64|amd64/i.test(asset.name || ''));
    installerUrl = (preferred || validCandidates[0]).browser_download_url;
  }

  return {
    hasNew,
    latestVersion: tagName || '最新发布',
    releaseNotes: hasNew
      ? (release.body ? release.body.slice(0, 300) : '暂无特别更新说明')
      : '当前已是最新版本，无需更新。',
    downloadUrl: release.html_url || 'https://github.com/daimiaopeng/coolapk-desktop/releases',
    installerUrl,
  };
}

function versionFromAssetName(name: string) {
  const match = name.match(/[-_](\d+\.\d+\.\d+)(?:[-_]|$)/);
  return match ? match[1] : undefined;
}
