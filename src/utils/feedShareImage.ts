import type { FeedItem } from '../types/feed';
import QRCode from 'qrcode';
import { CoolapkTauriAPI } from '../api/coolapk';
import { getFeedDetailMessage, stripFeedMoreSuffix } from './feedContent';
import { coolapkHtmlToPlainText } from './sanitizeHtml';
import { normalizeFeedImageItems, type FeedImageInput, type FeedImageItem } from './livePhoto';
import { EMOJI_BASE, EMOJI_MAP, getEmojiUrl } from './coolapkEmoji';

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
  comments?: FeedShareComment[];
}

export interface FeedShareComment {
  id?: string | number;
  uid?: string | number;
  username?: string;
  userAvatar?: string;
  userInfo?: {
    username?: string;
    userAvatar?: string;
  };
  message?: string;
  replyRowsText?: string;
  dateline?: number | string;
  likenum?: number;
  likeNum?: number;
  like_num?: number;
  [key: string]: any;
}

const DEFAULT_WIDTH = 900;
const DEFAULT_MAX_IMAGE_HEIGHT = 1600;
const SHARE_QR_SIZE = 112;
const SHARE_COMMENT_LIMIT = 3;
const SHARE_COMMENT_MAX_LENGTH = 180;
const SHARE_COMMENT_LINE_HEIGHT = 34;
const SHARE_COMMENT_CARD_GAP = 14;
const SHARE_COMMENT_AVATAR_SIZE = 36;

function feedValue(feed: FeedItem | Record<string, unknown>, keys: string[]): string {
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

export function getFeedShareLevel(feed: FeedItem): string {
  const userInfo = feed.userInfo as Record<string, unknown> | undefined;
  return feedValue(feed, ['level', 'userLevel', 'user_level']) || feedValue(userInfo || {}, ['level', 'userLevel', 'user_level']);
}

export function getFeedShareDevice(feed: FeedItem): string {
  const userInfo = feed.userInfo as Record<string, unknown> | undefined;
  return feedValue(feed, ['device_title', 'deviceTitle', 'device']) || feedValue(userInfo || {}, ['device_title', 'deviceTitle', 'device']);
}

export function getFeedShareCommentText(comment: FeedShareComment): string {
  const raw = feedValue(comment, ['message', 'replyRowsText', 'content', 'text']);
  if (!raw) return '';
  const withLineBreaks = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
  const text = coolapkHtmlToPlainText(stripFeedMoreSuffix(withLineBreaks))
    .replace(/\[\s*图片\s*\]/gi, '')
    .trim();
  if (!text) return '（图片评论）';
  const characters = Array.from(text);
  return characters.length > SHARE_COMMENT_MAX_LENGTH
    ? `${characters.slice(0, SHARE_COMMENT_MAX_LENGTH).join('')}…`
    : text;
}

export function getFeedShareCommentAuthor(comment: FeedShareComment): string {
  return feedValue(comment, ['username', 'userName'])
    || feedValue(comment.userInfo || {}, ['username', 'userName'])
    || '酷友';
}

export function getFeedShareCommentAvatar(comment: FeedShareComment): string {
  return feedValue(comment, ['userAvatar', 'user_avatar', 'avatar'])
    || feedValue(comment.userInfo || {}, ['userAvatar', 'user_avatar', 'avatar']);
}

function getFeedShareCommentLikeCount(comment: FeedShareComment): number {
  const likes = Number(comment.likenum ?? comment.likeNum ?? comment.like_num ?? 0);
  return Number.isFinite(likes) && likes > 0 ? likes : 0;
}

export function getFeedShareCommentLikes(comment: FeedShareComment): string {
  const likes = getFeedShareCommentLikeCount(comment);
  return likes > 0 ? `${likes} 赞` : '热评';
}

export function getFeedShareComments(comments: FeedShareComment[] = []): FeedShareComment[] {
  const seen = new Set<string>();
  return comments
    .filter((comment) => {
      if (!getFeedShareCommentText(comment)) return false;
      const key = String(comment.id ?? `${comment.uid ?? ''}:${comment.message ?? ''}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => getFeedShareCommentLikeCount(right) - getFeedShareCommentLikeCount(left))
    .slice(0, SHARE_COMMENT_LIMIT);
}

export function getFeedShareFileName(feed: FeedItem): string {
  const id = feedValue(feed, ['id', 'entityId']) || 'unknown';
  return `coolapk-feed-${id}.png`;
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

async function loadShareQrCode(feedId: string): Promise<HTMLImageElement | null> {
  if (!feedId) return null;
  try {
    const dataUrl = await QRCode.toDataURL(`https://coolapk.com/feed/${encodeURIComponent(feedId)}`, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: SHARE_QR_SIZE * 2,
      color: {
        dark: '#17202a',
        light: '#ffffff',
      },
    });
    return await loadImage(dataUrl);
  } catch {
    return null;
  }
}

async function loadShareCommentAvatars(comments: FeedShareComment[]): Promise<Map<string, HTMLImageElement | null>> {
  const entries = await Promise.all(comments.map(async (comment): Promise<[string, HTMLImageElement | null]> => {
    const key = String(comment.id ?? `${comment.uid ?? ''}:${comment.message ?? ''}`);
    const sourceUrl = getFeedShareCommentAvatar(comment);
    if (!sourceUrl) return [key, null];
    try {
      const dataUrl = /^data:image\//i.test(sourceUrl) ? sourceUrl : await CoolapkTauriAPI.getImageDataUrl(sourceUrl);
      return [key, await loadImage(dataUrl)];
    } catch {
      return [key, null];
    }
  }));
  return new Map(entries);
}

async function loadShareEmojiImages(texts: string[]): Promise<Map<string, HTMLImageElement | null>> {
  const names = [...new Set(texts.flatMap(getFeedShareEmojiNames))];
  const entries = await Promise.all(names.map(async (name): Promise<[string, HTMLImageElement | null]> => {
    try {
      const sourceUrl = getEmojiUrl(name);
      if (!sourceUrl) return [name, null];
      if (sourceUrl.startsWith('data:')) {
        return [name, await loadImage(sourceUrl)];
      }
      const dataUrl = await CoolapkTauriAPI.getImageDataUrl(sourceUrl);
      return [name, await loadImage(dataUrl)];
    } catch {
      return [name, null];
    }
  }));
  return new Map(entries);
}

type ShareTextPart =
  | { kind: 'text'; text: string }
  | { kind: 'emoji'; name: string; image: HTMLImageElement | null };

type ShareTextLine = ShareTextPart[];

type ShareCommentLayout = {
  comment: FeedShareComment;
  author: string;
  textLines: ShareTextLine[];
  likes: string;
  avatar: HTMLImageElement | null;
  height: number;
};

const SHARE_TEXT_FONT = '32px system-ui, "Microsoft YaHei", sans-serif';
const SHARE_TITLE_FONT = 'bold 34px system-ui, "Microsoft YaHei", sans-serif';
const SHARE_EMOJI_SIZE = 34;
const SHARE_EMOJI_GAP = 4;

export function getFeedShareEmojiNames(text: string): string[] {
  const names = new Set<string>();
  const pattern = /\[([^\]\r\n]{1,20})\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (EMOJI_MAP[match[1]]) names.add(match[1]);
  }
  return [...names];
}

function splitShareTextParts(text: string, emojiImages: Map<string, HTMLImageElement | null>): ShareTextPart[] {
  const parts: ShareTextPart[] = [];
  const pattern = /\[([^\]\r\n]{1,20})\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) parts.push({ kind: 'text', text: text.slice(cursor, match.index) });
    const name = match[1];
    if (EMOJI_MAP[name]) {
      parts.push({ kind: 'emoji', name, image: emojiImages.get(name) || null });
    } else {
      parts.push({ kind: 'text', text: match[0] });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) });
  return parts;
}

function parseFontSize(font: string, fallback: number = 32): number {
  const match = /(\d+)px/.exec(font);
  return match ? parseInt(match[1], 10) : fallback;
}

function wrapShareText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
  emojiImages: Map<string, HTMLImageElement | null>,
): ShareTextLine[] {
  const lines: ShareTextLine[] = [];
  context.font = font;
  const fontSize = parseFontSize(font, 32);
  const emojiSize = Math.round(fontSize * 1.08);
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph) {
      lines.push([]);
      continue;
    }
    let line: ShareTextLine = [];
    let lineWidth = 0;
    for (const part of splitShareTextParts(paragraph, emojiImages)) {
      if (part.kind === 'emoji') {
        const fallbackText = `[${part.name}]`;
        const partWidth = part.image
          ? emojiSize + SHARE_EMOJI_GAP
          : context.measureText(fallbackText).width;
        if (line.length && lineWidth + partWidth > maxWidth) {
          lines.push(line);
          line = [];
          lineWidth = 0;
        }
        line.push(part);
        lineWidth += partWidth;
        continue;
      }
      for (const character of Array.from(part.text)) {
        const partWidth = context.measureText(character).width;
        if (line.length && lineWidth + partWidth > maxWidth) {
          lines.push(line);
          line = [];
          lineWidth = 0;
        }
        line.push({ kind: 'text', text: character });
        lineWidth += partWidth;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [[]];
}

function drawShareTextLine(
  context: CanvasRenderingContext2D,
  line: ShareTextLine,
  x: number,
  y: number,
  font: string,
): void {
  context.font = font;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  const fontSize = parseFontSize(font, 32);
  const emojiSize = Math.round(fontSize * 1.08);
  const emojiOffsetY = Math.max(0, Math.round((fontSize - emojiSize) / 2) + 1);
  let cursorX = x;
  for (const part of line) {
    if (part.kind === 'emoji' && part.image) {
      context.drawImage(part.image, cursorX, y + emojiOffsetY, emojiSize, emojiSize);
      cursorX += emojiSize + SHARE_EMOJI_GAP;
      continue;
    }
    const text = part.kind === 'emoji' ? `[${part.name}]` : part.text;
    context.fillText(text, cursorX, y);
    cursorX += context.measureText(text).width;
  }
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

function drawDeviceIcon(context: CanvasRenderingContext2D, x: number, y: number, color: string) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  roundedRect(context, x, y, 12, 20, 2.5);
  context.stroke();
  context.beginPath();
  context.arc(x + 6, y + 17, 1, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawTagPill(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { background: string; color: string; border?: string; bold?: boolean; deviceIcon?: boolean },
): number {
  const height = 32;
  const padding = 10;
  const iconGap = options.deviceIcon ? 7 : 0;
  const iconWidth = options.deviceIcon ? 12 : 0;
  context.font = `${options.bold ? 'bold ' : ''}20px system-ui, "Microsoft YaHei", sans-serif`;
  const width = Math.ceil(context.measureText(text).width + padding * 2 + iconWidth + iconGap);
  roundedRect(context, x, y, width, height, 16);
  context.fillStyle = options.background;
  context.fill();
  if (options.border) {
    context.strokeStyle = options.border;
    context.lineWidth = 1;
    context.stroke();
  }
  let textX = x + padding;
  if (options.deviceIcon) {
    drawDeviceIcon(context, textX, y + 6, options.color);
    textX += iconWidth + iconGap;
  }
  context.fillStyle = options.color;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(text, textX, y + height / 2 + 1);
  context.textBaseline = 'top';
  return width;
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

  const cardPadding = 24;
  const contentWidth = width - cardPadding * 2;
  const text = getFeedShareText(feed);
  const title = getFeedShareTitle(feed);
  const author = getFeedShareAuthor(feed);
  const level = getFeedShareLevel(feed);
  const device = getFeedShareDevice(feed);
  const date = formatShareDate(feed.dateline);
  const feedId = feedValue(feed, ['id', 'entityId']);
  const shareComments = getFeedShareComments(options.comments);
  const commentTexts = shareComments.map(getFeedShareCommentText);
  const [emojiImages, qrCodeImage, commentAvatars] = await Promise.all([
    loadShareEmojiImages([title, text, ...commentTexts]),
    loadShareQrCode(feedId),
    loadShareCommentAvatars(shareComments),
  ]);
  const textLines = wrapShareText(context, text, contentWidth, SHARE_TEXT_FONT, emojiImages);
  const titleLines = title ? wrapShareText(context, title, contentWidth, SHARE_TITLE_FONT, emojiImages) : [];
  const commentIndent = SHARE_COMMENT_AVATAR_SIZE + 14;
  const commentContentWidth = contentWidth - commentIndent;
  const commentLayouts: ShareCommentLayout[] = shareComments.map((comment) => {
    const commentText = getFeedShareCommentText(comment);
    const commentTextLines = wrapShareText(context, commentText, commentContentWidth, '23px system-ui, "Microsoft YaHei", sans-serif', emojiImages);
    const key = String(comment.id ?? `${comment.uid ?? ''}:${comment.message ?? ''}`);
    const textBlockHeight = commentTextLines.length * SHARE_COMMENT_LINE_HEIGHT;
    const itemHeight = Math.max(SHARE_COMMENT_AVATAR_SIZE, 30 + textBlockHeight) + 22;
    return {
      comment,
      author: getFeedShareCommentAuthor(comment),
      textLines: commentTextLines,
      likes: getFeedShareCommentLikes(comment),
      avatar: commentAvatars.get(key) || null,
      height: itemHeight,
    };
  });
  const imageSizes = loadedImages.map(({ image }) => {
    const naturalWidth = image.naturalWidth || image.width || contentWidth;
    const naturalHeight = image.naturalHeight || image.height || contentWidth;
    const imageWidth = Math.min(contentWidth, naturalWidth);
    const imageHeight = Math.min(maxImageHeight, Math.max(1, imageWidth * naturalHeight / naturalWidth));
    return { width: imageWidth, height: imageHeight };
  });

  const headerHeight = 100;
  const titleHeight = titleLines.length ? titleLines.length * 42 + 18 : 0;
  const textHeight = textLines.length * 48;
  const imageHeight = imageSizes.reduce((total, size) => total + size.height, 0) + Math.max(0, imageSizes.length - 1) * 24;
  const commentsHeight = commentLayouts.length
    ? 38 + 50 + commentLayouts.reduce((total, layout) => total + layout.height, 0)
    : 0;
  const footerHeight = qrCodeImage ? 140 : 70;
  const contentHeight = headerHeight + titleHeight + textHeight + (imageSizes.length ? 30 + imageHeight : 0) + commentsHeight + footerHeight;
  const height = cardPadding * 2 + contentHeight;

  canvas.width = width;
  canvas.height = Math.ceil(height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  let cursorY = cardPadding;
  const contentX = cardPadding;
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
  if (level) {
    const authorWidth = context.measureText(author).width;
    drawTagPill(context, `Lv.${level}`, contentX + 82 + authorWidth + 14, cursorY + 2, {
      background: accent,
      color: '#ffffff',
      bold: true,
    });
  }
  let metaX = contentX + 82;
  context.fillStyle = secondaryText;
  context.font = '22px system-ui, "Microsoft YaHei", sans-serif';
  if (date) {
    context.fillText(date, metaX, cursorY + 44);
    metaX += context.measureText(date).width + 14;
  }
  if (device) {
    drawTagPill(context, device, metaX, cursorY + 39, {
      background: '#f0f2f4',
      color: '#52606d',
      border: '#e3e6e8',
      deviceIcon: true,
    });
  }
  cursorY += headerHeight;

  if (titleLines.length) {
    context.fillStyle = darkText;
    titleLines.forEach((line) => {
      drawShareTextLine(context, line, contentX, cursorY, SHARE_TITLE_FONT);
      cursorY += 42;
    });
    cursorY += 18;
  }

  context.fillStyle = darkText;
  textLines.forEach((line) => {
    drawShareTextLine(context, line, contentX, cursorY, SHARE_TEXT_FONT);
    cursorY += 48;
  });

  if (loadedImages.length) {
    cursorY += 30;
    loadedImages.forEach(({ image }, index) => {
      const size = imageSizes[index];
      const imageX = contentX + (contentWidth - size.width) / 2;
      drawRoundedImage(context, image, imageX, cursorY, size.width, size.height);
      cursorY += size.height;
      if (index < loadedImages.length - 1) cursorY += 24;
    });
  }

  if (commentLayouts.length) {
    cursorY += 36;
    context.strokeStyle = '#edf1f3';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(contentX, cursorY - 18);
    context.lineTo(contentX + contentWidth, cursorY - 18);
    context.stroke();

    context.fillStyle = darkText;
    context.font = 'bold 24px system-ui, "Microsoft YaHei", sans-serif';
    context.fillText('热门评论', contentX, cursorY);
    const commentTitleWidth = context.measureText('热门评论').width;

    context.fillStyle = secondaryText;
    context.font = '20px system-ui, "Microsoft YaHei", sans-serif';
    context.fillText(`${commentLayouts.length} 条`, contentX + commentTitleWidth + 10, cursorY + 3);
    cursorY += 46;

    commentLayouts.forEach((layout, index) => {
      const commentX = contentX;
      const commentY = cursorY;

      drawAvatar(context, layout.avatar, layout.author, commentX, commentY + 2, SHARE_COMMENT_AVATAR_SIZE);

      context.fillStyle = '#111827';
      context.font = 'bold 21px system-ui, "Microsoft YaHei", sans-serif';
      context.textAlign = 'left';
      context.fillText(layout.author, commentX + commentIndent, commentY + 2);

      if (layout.likes && layout.likes !== '0 赞') {
        const likeText = layout.likes;
        context.font = '500 16px system-ui, "Microsoft YaHei", sans-serif';
        const numWidth = context.measureText(likeText).width;
        const pillWidth = numWidth + 20;
        const pillHeight = 26;
        const pillX = commentX + contentWidth - pillWidth;
        const pillY = commentY;
        roundedRect(context, pillX, pillY, pillWidth, pillHeight, 13);
        context.fillStyle = '#f3f4f6';
        context.fill();

        context.fillStyle = '#4b5563';
        context.font = 'bold 15px system-ui, "Microsoft YaHei", sans-serif';
        context.textAlign = 'center';
        context.fillText(likeText, pillX + pillWidth / 2, pillY + 4);
        context.textAlign = 'left';
      }

      context.fillStyle = '#374151';
      layout.textLines.forEach((line, lineIndex) => {
        drawShareTextLine(
          context,
          line,
          commentX + commentIndent,
          commentY + 34 + lineIndex * SHARE_COMMENT_LINE_HEIGHT,
          '23px system-ui, "Microsoft YaHei", sans-serif'
        );
      });

      cursorY += layout.height;

      if (index < commentLayouts.length - 1) {
        context.strokeStyle = '#f1f4f6';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(commentX + commentIndent, cursorY - 10);
        context.lineTo(commentX + contentWidth, cursorY - 10);
        context.stroke();
      }
    });
  }

  const footerTop = height - cardPadding - footerHeight;
  context.strokeStyle = '#edf1f3';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(contentX, footerTop);
  context.lineTo(contentX + contentWidth, footerTop);
  context.stroke();

  if (qrCodeImage) {
    const qrX = contentX + contentWidth - SHARE_QR_SIZE;
    const qrY = footerTop + 14;
    context.drawImage(qrCodeImage, qrX, qrY, SHARE_QR_SIZE, SHARE_QR_SIZE);

    context.fillStyle = '#10b981';
    context.font = 'bold 22px system-ui, "Microsoft YaHei", sans-serif';
    context.textAlign = 'left';
    context.fillText('来自酷安跨平台桌面版', contentX, footerTop + 24);

    context.fillStyle = '#6b7280';
    context.font = '18px system-ui, "Microsoft YaHei", sans-serif';
    context.fillText('扫码在手机上查看动态', contentX, footerTop + 58);

    context.fillStyle = '#9ca3af';
    context.font = '16px system-ui, "Microsoft YaHei", sans-serif';
    context.fillText(`coolapk.com/feed/${feedId}`, contentX, footerTop + 90);
  } else {
    context.fillStyle = '#10b981';
    context.font = 'bold 20px system-ui, "Microsoft YaHei", sans-serif';
    context.textAlign = 'left';
    context.fillText('来自酷安跨平台桌面版', contentX, footerTop + 30);

    context.fillStyle = '#9ca3af';
    context.font = '17px system-ui, "Microsoft YaHei", sans-serif';
    context.textAlign = 'right';
    context.fillText(feedId ? `coolapk.com/feed/${feedId}` : 'coolapk.com', contentX + contentWidth, footerTop + 30);
  }
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
