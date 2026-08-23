import { APP_VERSION } from '../constants/version';
import type { UpdateChannel } from '../types/settings';

export { APP_VERSION };
const RELEASES_URL = 'https://api.github.com/repos/daimiaopeng/coolapk-desktop/releases';

export type UpdateInfo = {
  hasNew: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  publishedAt?: string;
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

export const BUILTIN_CHANGELOGS: Record<string, string> = {
  '1.9.1': `• 完善版本更新与安装包生命周期管理，支持跨重启恢复与架构智能匹配
• 优化安装包清理机制，启动时后台异步清理避免占用磁盘空间
• 修复通知中心滚动背景穿透与站内链接跳转问题
• 修复头条动态发布时间显示异常
• 修复动态视频播放地址解析与卡片展示`,
  '1.9.0': `• 新增动态视频播放功能，支持动态中内嵌视频的解析与直接播放
• 首页栏目体系全面扩充：新增热榜、快讯、新机、摄影、开箱、值得看、热闻等
• 新增机型搜索与多维排行榜功能
• 新增投票卡片互动支持
• 优化通知中心与评论输入框体验`,
  '1.8.3': `• 完善评论接口与点赞交互
• 修复特定场景下的更新下载流程与 Toast 提示`,
  '1.8.2': `• 完善信息流与草稿保存
• 修复云端收藏夹选择与同步`,
  '1.8.1': `• 动态发现页支持全量卡片下发
• 重构用户主页并增加用户关系管理
• 增加频道排序与本地持久化`,
};

export const BUILTIN_RELEASE_DATES: Record<string, string> = {
  '1.9.1': '2026-08-21 19:51',
  '1.9.0': '2026-08-19 20:30',
  '1.8.3': '2026-08-15 16:20',
  '1.8.2': '2026-08-12 14:10',
  '1.8.1': '2026-08-10 11:00',
};

export function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(dateStr)) return dateStr;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d} ${hh}:${mm}`;
  } catch {
    return dateStr;
  }
}

export function getCurrentVersionChangelog(version = APP_VERSION, remoteBody?: string): string {
  const cleanRemote = (remoteBody || '').trim();
  if (cleanRemote) {
    return cleanRemote;
  }
  const norm = normalizeVersion(version) || version;
  return BUILTIN_CHANGELOGS[norm] || BUILTIN_CHANGELOGS[APP_VERSION] || '暂无当前版本的更新日志。';
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

  const releaseNotes = hasNew
    ? (release.body ? release.body.trim() : '暂无特别更新说明')
    : getCurrentVersionChangelog(APP_VERSION, release.body);

  const publishedAt = release.published_at
    ? formatReleaseDate(release.published_at)
    : (BUILTIN_RELEASE_DATES[normalizeVersion(tagName) || ''] || BUILTIN_RELEASE_DATES[APP_VERSION]);

  return {
    hasNew,
    latestVersion: tagName || '最新发布',
    releaseNotes,
    publishedAt,
    downloadUrl: release.html_url || 'https://github.com/daimiaopeng/coolapk-desktop/releases',
    installerUrl,
  };
}

function versionFromAssetName(name: string) {
  const match = name.match(/(?:^|[-_])v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?=[-_]|$)/i);
  return match ? normalizeVersion(match[1]) : undefined;
}
