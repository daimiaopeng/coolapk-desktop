import { APP_VERSION } from '../constants/version';
import type { UpdateChannel } from '../types/settings';

export { APP_VERSION };
const RELEASES_URL = 'https://api.github.com/repos/daimiaopeng/coolapk-desktop/releases';

export type UpdateInfo = {
  hasNew: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  installerUrl?: string;
};

export function isNewerVersion(latest: string, current = APP_VERSION) {
  const latestVersion = parseVersion(latest);
  const currentVersion = parseVersion(current);
  return Boolean(latestVersion && currentVersion && compareVersions(latestVersion, currentVersion) > 0);
}

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

function parseVersion(value: unknown): ParsedVersion | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/i);
  if (!match) return null;
  const parts = [match[1], match[2], match[3]].map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) return null;
  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2],
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }
  if (left.prerelease.length === 0 && right.prerelease.length > 0) return 1;
  if (left.prerelease.length > 0 && right.prerelease.length === 0) return -1;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber > rightNumber ? 1 : -1;
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

export function normalizeVersion(value: string): string | null {
  const parsed = parseVersion(value);
  if (!parsed) return null;
  const suffix = parsed.prerelease.length ? `-${parsed.prerelease.join('.')}` : '';
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${suffix}`;
}

async function pickRelease(channel: UpdateChannel): Promise<any> {
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (channel === 'beta') {
    // 测试版渠道：列出最近发布（含预发布），取最新一条
    const response = await fetch(`${RELEASES_URL}?per_page=30`, { headers });
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
    const releases = await response.json();
    if (!Array.isArray(releases) || releases.length === 0) throw new Error('未获取到任何发布版本');
    return releases[0];
  }
  const response = await fetch(`${RELEASES_URL}/latest`, { headers });
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
  return await response.json();
}

export async function checkLatestRelease(channel: UpdateChannel = 'stable'): Promise<UpdateInfo> {
  const release = await pickRelease(channel);
  const tagName = release.tag_name || '';
  const hasNew = Boolean(normalizeVersion(tagName)) && isNewerVersion(tagName);

  // 挑选 Windows 安装包（NSIS setup.exe），智能匹配系统架构 (x64 / arm64)，且版本号匹配
  let installerUrl: string | undefined;
  const assets: Array<{ name?: string; browser_download_url?: string }> = release.assets || [];
  const candidates = assets.filter(
    (asset) => asset.name && /[-_]setup\.exe$/i.test(asset.name) && asset.browser_download_url
  );
  const tagVersion = normalizeVersion(tagName);
  const versionedCandidates = candidates.filter((asset) => Boolean(asset.name && versionFromAssetName(asset.name)));
  const versionMatched = candidates.filter(
    (asset) => Boolean(asset.name && tagVersion && versionFromAssetName(asset.name) === tagVersion)
  );
  // 如果资源名明确带版本号但与 release 不一致，禁止误下载旧安装包；
  // 只有资源名完全不含版本号时才允许兼容旧发布格式。
  const validCandidates = versionMatched.length > 0
    ? versionMatched
    : versionedCandidates.length > 0
      ? []
      : candidates;

  if (validCandidates.length > 0) {
    const isArm64 = typeof navigator !== 'undefined' && /arm64|aarch64/i.test(navigator.userAgent || '');
    if (isArm64) {
      const armCandidate = validCandidates.find((asset) => /arm64|aarch64/i.test(asset.name || ''));
      if (armCandidate) {
        installerUrl = armCandidate.browser_download_url;
      }
    }
    if (!installerUrl) {
      const preferred = validCandidates.find((asset) => /x64|amd64/i.test(asset.name || ''));
      installerUrl = (preferred || validCandidates[0]).browser_download_url;
    }
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
  const match = name.match(/(?:^|[-_])v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?=[-_]|$)/i);
  return match ? normalizeVersion(match[1]) : undefined;
}
