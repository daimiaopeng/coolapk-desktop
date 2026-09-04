import type { FeedItem } from '../types/feed';
import { CoolapkTauriAPI } from '../api/coolapk';
import { getFeedDetailMessage, stripFeedMoreSuffix } from './feedContent';
import { coolapkHtmlToPlainText } from './sanitizeHtml';
import { normalizeFeedImageItems, type FeedImageInput, type FeedImageItem } from './livePhoto';

export interface FeedShareImageResult {
  dataUrl: string;
  failedImageUrls: string[];
}

export class FeedShareImageError extends Error {
  constructor(public readonly failedImageUrls: string[]) {
    super('动态中的部分图片加载失败');
    this.name = 'FeedShareImageError';
  }
}

export interface FeedShareImageOptions {
  width?: number;
  maxImageHeight?: number;
}

const DEFAULT_WIDTH = 900;
const DEFAULT_MAX_IMAGE_HEIGHT = 1600;

function feedValue(feed: FeedItem, keys: string[]): string {
  const record = feed as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

/** 将动态富文本转换为分享图中使用的纯文本，并删除列表接口的查看更多尾标。 */
export function getFeedShareText(feed: FeedItem): string {
  const raw = getFeedDetailMessage(feed) || feedValue(feed, ['title', 'message', 'content', 'text']);
  if (!raw) return '暂无文字内容';
  const withLineBreaks = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
  return coolapkHtmlToPlainText(stripFeedMoreSuffix(withLineBreaks)) || '暂无文字内容';
}

export function getFeedShareTitle(feed: FeedItem): string {
  const title = feedValue(feed, ['title', 'message_title']);
  if (!title || title.endsWith('的动态')) return '';
  return coolapkHtmlToPlainText(title);
}

export function getFeedShareAuthor(feed: FeedItem): string {
  return feedValue(feed, ['username', 'userName']) || feed.userInfo?.username || '酷友';
}

export function getFeedShareFileName(feed: FeedItem): string {
  const id = feedValue(feed, ['id', 'entityId']) || 'unknown';
  return `coolapk-feed-${id}.png`;
}

function getFeedShareLabel(feed: FeedItem): string {
  const type = feedValue(feed, ['entityType', 'feedType', 'type']).toLowerCase();
  return type.includes('article') || type.includes('dyh') || type.includes('news') ? '图文' : '动态';
}

function asImageSource(item: FeedImageItem): string {
  return item.sourceUrl || item.coverUrl;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`图片加载失败：${dataUrl}`));
    image.src = dataUrl;
  });
}

async function loadImageItem(item: FeedImageItem): Promise<{ item: FeedImageItem; image: HTMLImageElement }> {
  const sourceUrl = asImageSource(item);
  const dataUrl = /^data:image\//i.test(sourceUrl) ? sourceUrl : await CoolapkTauriAPI.getImageDataUrl(sourceUrl);
  return { item, image: await loadImage(dataUrl) };
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  context.font = '32px system-ui, "Microsoft YaHei", sans-serif';
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const character of Array.from(paragraph)) {
      const candidate = line + character;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawRoundedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  context.save();
  roundedRect(context, x, y, width, height, 18);
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();
}

function drawAvatar(context: CanvasRenderingContext2D, image: HTMLImageElement | null, name: string, x: number, y: number, size: number) {
  context.save();
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.clip();
  if (image) {
    context.drawImage(image, x, y, size, size);
  } else {
    context.fillStyle = '#10b981';
    context.fillRect(x, y, size, size);
    context.fillStyle = '#ffffff';
    context.font = 'bold 34px system-ui, "Microsoft YaHei", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(Array.from(name)[0] || '酷', x + size / 2, y + size / 2 + 2);
  }
  context.restore();
  context.textAlign = 'left';
  context.textBaseline = 'top';
}

function formatShareDate(value: unknown): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const date = new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** 生成可预览、可复制和可保存的动态分享长图。 */
export async function generateFeedShareImage(feed: FeedItem, images: FeedImageInput[] = [], options: FeedShareImageOptions = {}): Promise<FeedShareImageResult> {
  const width = Math.max(640, Math.floor(options.width || DEFAULT_WIDTH));
  const maxImageHeight = Math.max(480, Math.floor(options.maxImageHeight || DEFAULT_MAX_IMAGE_HEIGHT));
  const normalizedImages = normalizeFeedImageItems(images);
  const loadedImages: Array<{ item: FeedImageItem; image: HTMLImageElement }> = [];
  const failedImageUrls: string[] = [];

  for (const item of normalizedImages) {
    try {
      loadedImages.push(await loadImageItem(item));
    } catch {
      failedImageUrls.push(asImageSource(item));
    }
  }
  if (failedImageUrls.length) throw new FeedShareImageError(failedImageUrls);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前环境不支持生成分享图');

  const outerPadding = 24;
  const cardPadding = 42;
  const contentWidth = width - (outerPadding + cardPadding) * 2;
  const text = getFeedShareText(feed);
  const title = getFeedShareTitle(feed);
  const author = getFeedShareAuthor(feed);
  const date = formatShareDate(feed.dateline);
  const textLines = wrapText(context, text, contentWidth);
  const titleLines = title ? wrapText(context, title, contentWidth) : [];
  const imageSizes = loadedImages.map(({ image }) => {
    const naturalWidth = image.naturalWidth || image.width || contentWidth;
    const naturalHeight = image.naturalHeight || image.height || contentWidth;
    const imageWidth = Math.min(contentWidth, naturalWidth);
    const imageHeight = Math.min(maxImageHeight, Math.max(1, imageWidth * naturalHeight / naturalWidth));
    return { width: imageWidth, height: imageHeight };
  });

  const headerHeight = 82;
  const titleHeight = titleLines.length ? titleLines.length * 42 + 18 : 0;
  const textHeight = textLines.length * 48;
  const imageHeight = imageSizes.reduce((total, size) => total + size.height, 0) + Math.max(0, imageSizes.length - 1) * 24;
  const footerHeight = 64;
  const contentHeight = headerHeight + titleHeight + textHeight + (imageSizes.length ? 30 + imageHeight : 0) + footerHeight;
  const height = outerPadding * 2 + cardPadding * 2 + contentHeight;

  canvas.width = width;
  canvas.height = Math.ceil(height);
  context.fillStyle = '#eef2f5';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const cardX = outerPadding;
  const cardY = outerPadding;
  const cardWidth = width - outerPadding * 2;
  const cardHeight = height - outerPadding * 2;
  roundedRect(context, cardX, cardY, cardWidth, cardHeight, 28);
  context.fillStyle = '#ffffff';
  context.fill();

  let cursorY = cardY + cardPadding;
  const contentX = cardX + cardPadding;
  const darkText = '#17202a';
  const secondaryText = '#6b7280';
  const accent = '#10b981';
  const avatarUrl = feed.userAvatar || feed.userInfo?.userAvatar || '';
  let avatar: HTMLImageElement | null = null;
  if (avatarUrl) {
    try {
      avatar = await loadImage(/^data:image\//i.test(avatarUrl) ? avatarUrl : await CoolapkTauriAPI.getImageDataUrl(avatarUrl));
    } catch {
      avatar = null;
    }
  }
  drawAvatar(context, avatar, author, contentX, cursorY, 64);
  context.fillStyle = darkText;
  context.font = 'bold 30px system-ui, "Microsoft YaHei", sans-serif';
  context.fillText(author, contentX + 82, cursorY + 4);
  context.fillStyle = accent;
  context.font = '24px system-ui, "Microsoft YaHei", sans-serif';
  context.fillText(getFeedShareLabel(feed), contentX + 82, cursorY + 42);
  if (date) {
    context.fillStyle = secondaryText;
    context.font = '22px system-ui, "Microsoft YaHei", sans-serif';
    context.textAlign = 'right';
    context.fillText(date, contentX + contentWidth, cursorY + 20);
    context.textAlign = 'left';
  }
  cursorY += headerHeight;

  if (titleLines.length) {
    context.fillStyle = darkText;
    context.font = 'bold 34px system-ui, "Microsoft YaHei", sans-serif';
    titleLines.forEach((line) => {
      context.fillText(line, contentX, cursorY);
      cursorY += 42;
    });
    cursorY += 18;
  }

  context.fillStyle = darkText;
  context.font = '32px system-ui, "Microsoft YaHei", sans-serif';
  textLines.forEach((line) => {
    context.fillText(line, contentX, cursorY);
    cursorY += 48;
  });

  if (loadedImages.length) {
    cursorY += 30;
    loadedImages.forEach(({ image }, index) => {
      const size = imageSizes[index];
      const imageX = contentX + (contentWidth - size.width) / 2;
      drawRoundedImage(context, image, imageX, cursorY, size.width, size.height);
      cursorY += size.height + 24;
    });
  }

  const feedId = feedValue(feed, ['id', 'entityId']);
  context.fillStyle = '#9ca3af';
  context.font = '22px system-ui, "Microsoft YaHei", sans-serif';
  context.fillText('来自酷安桌面版', contentX, cardY + cardHeight - cardPadding - 24);
  context.textAlign = 'right';
  context.fillText(feedId ? `coolapk.com/feed/${feedId}` : 'coolapk.com', contentX + contentWidth, cardY + cardHeight - cardPadding - 24);
  context.textAlign = 'left';

  return { dataUrl: canvas.toDataURL('image/png'), failedImageUrls };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(',', 2);
  if (!header || !payload || !header.startsWith('data:') || !header.includes(';base64')) throw new Error('分享图数据格式无效');
  const mimeType = header.slice(5, header.indexOf(';')) || 'image/png';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}
