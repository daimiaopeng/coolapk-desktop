import { useSettingsStore } from '../stores/settings';

export type ImageQualityMode = 'standard' | 'hd' | 'raw';

/**
 * 根据系统设置或指定的图片质量参数获取处理后的图片 URL
 * - 'standard': 标准 (轻量缩略图 .s.jpg)
 * - 'hd': 高清 (高清缩略图 .m.jpg)
 * - 'raw': 原图 (原图无损 URL)
 */
export function getImageUrlByQuality(url: string, targetQuality?: ImageQualityMode): string {
  if (!url || typeof url !== 'string') return '';
  if (!url.startsWith('http')) return url;

  // 不给非 酷安 CDN 图片追加后缀
  if (!url.includes('coolapk.com')) return url;

  // 如果没有显式指定质量，则读取用户在设置中心的全局配置
  let quality = targetQuality;
  if (!quality) {
    try {
      const settingsStore = useSettingsStore();
      quality = settingsStore.settings.imageQuality || 'hd';
    } catch {
      quality = 'hd';
    }
  }

  // 先清洗 URL，剥离现有的 .m.jpg 或 .s.jpg 后缀及 query 参数
  const baseUrl = url.replace(/(\.m|\.s)\.jpg$/i, '').split('?')[0];

  if (quality === 'raw') {
    return baseUrl; // 原图
  } else if (quality === 'standard') {
    return `${baseUrl}.s.jpg`; // 标准省流量缩略图
  } else {
    return `${baseUrl}.m.jpg`; // 高清推荐图
  }
}

/**
 * 获取酷安动态列表/卡片默认渲染图 URL（跟随用户设置的图片质量）
 */
export function getHdImageUrl(url: string): string {
  return getImageUrlByQuality(url);
}

/**
 * 获取无损原图 URL（剥离 .m.jpg / .s.jpg 缩略图后缀）
 */
export function getOriginalImageUrl(url: string): string {
  return getImageUrlByQuality(url, 'raw');
}

/**
 * 判断图片是否为纵向长图。
 * 参数使用浏览器 naturalWidth / naturalHeight 得到的宽高比，避免把横幅图片误判成长图。
 */
export function isPortraitLongImage(widthHeightRatio: number, minimumHeightWidthRatio = 1.8): boolean {
  return Number.isFinite(widthHeightRatio)
    && widthHeightRatio > 0
    && widthHeightRatio <= 1 / minimumHeightWidthRatio;
}

/**
 * 图片 URL 协议白名单：仅放行 http/https、data:、blob: 与站内相对路径。
 * 用于直接交给 <img> 的路径（绕过 Rust 代理的降级分支），
 * 防止 file:、javascript: 等异常 scheme 被 WebView 加载/探测本地文件。
 */
export function sanitizeImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('//')) return true;
  return /^(https?|data|blob):/i.test(trimmed);
}
