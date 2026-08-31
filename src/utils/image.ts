import { useSettingsStore } from '../stores/settings';

export type ImageQualityMode = 'standard' | 'hd' | 'raw';

/** 判断图片地址是否指向可直接播放的 GIF 动图。 */
export function isAnimatedImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^data:image\/gif[;,]/i.test(trimmed)) return true;
  const path = trimmed.split(/[?#]/, 1)[0].toLowerCase();
  return /\.(?:gif|gifv)$/.test(path);
}

/**
 * 将酷安 CDN 的 GIF 原图转换为静态 JPEG 缩略图。返回空字符串表示该地址
 * 无法可靠生成静态封面，调用方可选择不在列表中加载它。
 */
export function getStaticAnimatedImageUrl(url: string): string {
  if (!isAnimatedImageUrl(url) || !/^https?:\/\//i.test(url) || !url.includes('coolapk.com')) return '';
  const baseUrl = url.replace(/(\.xs|\.s|\.m|\.b|\.t)\.jpg$/i, '').split(/[?#]/, 1)[0];
  return `${baseUrl}.m.jpg`;
}

/** 判断是否为酷安 Live Photo 的静态封面地址。实况视频由独立地址提供。 */
export function isLivePhotoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /https?:\/\/\S+livepic\S*@\d+x\d+\.(?:jpg|jpeg|png|gif|webp)(?:[?#].*)?$/i.test(url.trim());
}

/**
 * 根据系统设置或指定的图片质量参数获取处理后的图片 URL
 * - 'standard': 标准 (轻量缩略图 .s.jpg)
 * - 'hd': 高清 (高清缩略图 .m.jpg)
 * - 'raw': 原图 (原图无损 URL)
 */
export function getImageUrlByQuality(url: string, targetQuality?: ImageQualityMode): string {
  if (!url || typeof url !== 'string') return '';
  if (isAnimatedImageUrl(url) || isLivePhotoUrl(url)) return url;
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

  // 先清洗 URL，剥离现有的 .xs.jpg、.m.jpg、.s.jpg、.b.jpg、.t.jpg 后缀及 query 参数
  const baseUrl = url.replace(/(\.xs|\.s|\.m|\.b|\.t)\.jpg$/i, '').split('?')[0];

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
