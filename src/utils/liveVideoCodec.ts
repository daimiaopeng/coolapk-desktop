export interface LiveVideoCodec {
  id: string;
  name: string;
  container: 'mp4' | 'webm';
  mimeCodec?: string;
}

export type LiveVideoCodecSupport = 'supported' | 'unsupported' | 'unknown';

const MP4_CODEC_NAMES: Record<string, string> = {
  hvc1: 'HEVC/H.265',
  hev1: 'HEVC/H.265',
  avc1: 'H.264/AVC',
  avc3: 'H.264/AVC',
  vp09: 'VP9',
  av01: 'AV1',
};

const WEBM_CODEC_NAMES: Record<string, { id: string; name: string }> = {
  V_MPEG4_ISO_AVC: { id: 'avc1', name: 'H.264/AVC' },
  V_MPEGH_ISO_HEVC: { id: 'hvc1', name: 'HEVC/H.265' },
  V_VP9: { id: 'vp09', name: 'VP9' },
  V_AV1: { id: 'av01', name: 'AV1' },
};

const MP4_CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);

function readMp4Box(bytes: Uint8Array, offset: number, end: number): { type: string; contentStart: number; end: number } | null {
  if (offset + 8 > end) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size = view.getUint32(offset);
  const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > end) return null;
    const high = view.getUint32(offset + 8);
    const low = view.getUint32(offset + 12);
    size = high === 0 ? low : 0;
    headerSize = 16;
  } else if (size === 0) {
    size = end - offset;
  }
  if (size < headerSize || offset + size > end) return null;
  return { type, contentStart: offset + headerSize, end: offset + size };
}

function findMp4VideoCodec(bytes: Uint8Array, start = 0, end = bytes.length): LiveVideoCodec | null {
  for (let offset = start; offset + 8 <= end;) {
    const box = readMp4Box(bytes, offset, end);
    if (!box) return null;
    if (box.type === 'stsd' && box.contentStart + 16 <= box.end) {
      const entryOffset = box.contentStart + 8;
      const entrySize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(entryOffset);
      if (entrySize >= 8 && entryOffset + entrySize <= box.end) {
        const id = String.fromCharCode(...bytes.slice(entryOffset + 4, entryOffset + 8));
        const name = MP4_CODEC_NAMES[id];
        if (name) {
          const mimeCodec = readMp4CodecConfiguration(bytes, entryOffset, entrySize, id);
          return mimeCodec ? { id, name, container: 'mp4', mimeCodec } : { id, name, container: 'mp4' };
        }
      }
    } else if (MP4_CONTAINER_BOXES.has(box.type)) {
      const codec = findMp4VideoCodec(bytes, box.contentStart, box.end);
      if (codec) return codec;
    }
    offset = box.end;
  }
  return null;
}

function findMp4SampleEntryBox(bytes: Uint8Array, entryOffset: number, entrySize: number, type: string): number | null {
  // 8 字节 sample entry 头之后是 78 字节 ISO VisualSampleEntry 固定字段。
  const start = entryOffset + 86;
  const end = entryOffset + entrySize;
  for (let offset = start; offset + 8 <= end;) {
    const box = readMp4Box(bytes, offset, end);
    if (!box) return null;
    if (box.type === type) return box.contentStart;
    offset = box.end;
  }
  return null;
}

function reverseBits32(value: number): number {
  let result = 0;
  for (let index = 0; index < 32; index += 1) result = (result * 2) + ((value >>> index) & 1);
  return result >>> 0;
}

function readMp4CodecConfiguration(bytes: Uint8Array, entryOffset: number, entrySize: number, id: string): string | undefined {
  if (id === 'avc1' || id === 'avc3') {
    const offset = findMp4SampleEntryBox(bytes, entryOffset, entrySize, 'avcC');
    if (offset === null || offset + 4 > bytes.length) return undefined;
    return `${id}.${bytes[offset + 1].toString(16).padStart(2, '0')}${bytes[offset + 2].toString(16).padStart(2, '0')}${bytes[offset + 3].toString(16).padStart(2, '0')}`.toUpperCase();
  }
  if (id === 'hvc1' || id === 'hev1') {
    const offset = findMp4SampleEntryBox(bytes, entryOffset, entrySize, 'hvcC');
    if (offset === null || offset + 13 > bytes.length) return undefined;
    const profile = bytes[offset + 1];
    const compatibility = new DataView(bytes.buffer, bytes.byteOffset + offset + 2, 4).getUint32(0);
    const constraint = Array.from(bytes.slice(offset + 6, offset + 12)).map(value => value.toString(16).padStart(2, '0')).join('').replace(/(?:00)+$/, '');
    const profileSpace = ['', 'A', 'B', 'C'][profile >>> 6] || '';
    const tier = (profile & 0x20) === 0 ? 'L' : 'H';
    const profileIdc = profile & 0x1f;
    const level = bytes[offset + 12];
    const suffix = constraint ? `.${constraint.toUpperCase()}` : '';
    return `${id}.${profileSpace}${profileIdc}.${reverseBits32(compatibility).toString(16).toUpperCase()}.${tier}${level}${suffix}`;
  }
  if (id === 'vp09') {
    const offset = findMp4SampleEntryBox(bytes, entryOffset, entrySize, 'vpcC');
    if (offset === null || offset + 4 > bytes.length) return undefined;
    return `vp09.${bytes[offset + 1].toString().padStart(2, '0')}.${bytes[offset + 2].toString().padStart(2, '0')}.${(bytes[offset + 3] & 0x0f).toString().padStart(2, '0')}`;
  }
  if (id === 'av01') {
    const offset = findMp4SampleEntryBox(bytes, entryOffset, entrySize, 'av1C');
    if (offset === null || offset + 3 > bytes.length) return undefined;
    const profile = (bytes[offset + 1] >>> 5) & 0x07;
    const level = bytes[offset + 1] & 0x1f;
    const tier = (bytes[offset + 2] & 0x80) === 0 ? 'M' : 'H';
    const depth = (bytes[offset + 2] & 0x40) === 0 ? 8 : ((bytes[offset + 2] & 0x20) === 0 ? 10 : 12);
    return `av01.${profile}.${level.toString().padStart(2, '0')}${tier}.${depth.toString().padStart(2, '0')}`;
  }
  return undefined;
}

function readEbmlVint(bytes: Uint8Array, offset: number, keepMarker: boolean): { value: number; length: number; unknown: boolean } | null {
  const first = bytes[offset];
  if (first === undefined) return null;
  let length = 1;
  while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length += 1;
  if (length > 8 || offset + length > bytes.length) return null;
  let value = keepMarker ? first : first & (0x7f >> (length - 1));
  for (let index = 1; index < length; index += 1) value = value * 256 + bytes[offset + index];
  const unknown = !keepMarker && Array.from(bytes.slice(offset, offset + length)).every((byte, index) => byte === (index === 0 ? (0xff >> (length - 1)) : 0xff));
  return { value, length, unknown };
}

function readWebmTrackCodec(bytes: Uint8Array, start: number, end: number): LiveVideoCodec | null {
  let trackType = 0;
  let codecId = '';
  for (let offset = start; offset < end;) {
    const id = readEbmlVint(bytes, offset, true);
    if (!id) return null;
    const size = readEbmlVint(bytes, offset + id.length, false);
    if (!size) return null;
    const contentStart = offset + id.length + size.length;
    const contentEnd = size.unknown ? end : contentStart + size.value;
    if (contentEnd > bytes.length) return null;
    if (id.value === 0x83 && contentEnd === contentStart + 1) trackType = bytes[contentStart];
    if (id.value === 0x86) codecId = new TextDecoder().decode(bytes.slice(contentStart, contentEnd));
    offset = contentEnd;
    if (size.unknown) break;
  }
  const codec = trackType === 1 ? WEBM_CODEC_NAMES[codecId] : null;
  return codec ? { ...codec, container: 'webm' } : null;
}

function findWebmVideoCodec(bytes: Uint8Array, start = 0, end = bytes.length): LiveVideoCodec | null {
  for (let offset = start; offset < end;) {
    const id = readEbmlVint(bytes, offset, true);
    if (!id) return null;
    const size = readEbmlVint(bytes, offset + id.length, false);
    if (!size) return null;
    const contentStart = offset + id.length + size.length;
    const contentEnd = size.unknown ? end : contentStart + size.value;
    if (contentEnd > end) return null;
    if (id.value === 0xae) {
      const codec = readWebmTrackCodec(bytes, contentStart, contentEnd);
      if (codec) return codec;
    } else if (id.value === 0x1a45dfa3 || id.value === 0x18538067 || id.value === 0x1654ae6b) {
      const codec = findWebmVideoCodec(bytes, contentStart, contentEnd);
      if (codec) return codec;
    }
    offset = contentEnd;
    if (size.unknown) break;
  }
  return null;
}

export function detectLiveVideoCodec(header: Uint8Array): LiveVideoCodec | null {
  if (header.length >= 8 && String.fromCharCode(...header.slice(4, 8)) === 'ftyp') return findMp4VideoCodec(header);
  if (header.length >= 4 && header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) return findWebmVideoCodec(header);
  return null;
}

export async function getLiveVideoCodecSupport(codec: LiveVideoCodec): Promise<LiveVideoCodecSupport> {
  if (!codec.mimeCodec) return 'unknown';
  const contentType = `${codec.container === 'webm' ? 'video/webm' : 'video/mp4'}; codecs="${codec.mimeCodec}"`;
  if (!navigator.mediaCapabilities?.decodingInfo) return 'unknown';
  try {
    const mediaCapabilities = await navigator.mediaCapabilities.decodingInfo({
      type: 'file',
      video: { contentType, width: 1920, height: 1080, bitrate: 2_000_000, framerate: 30 },
    });
    const canPlay = document.createElement('video').canPlayType(contentType);
    if (mediaCapabilities.supported) return 'supported';
    return canPlay ? 'unknown' : 'unsupported';
  } catch {
    return 'unknown';
  }
}

export function hasDecodedVideoFrame(video: HTMLVideoElement): boolean {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return false;
  const quality = video.getVideoPlaybackQuality?.();
  return !quality || quality.totalVideoFrames > 0;
}

export function waitForDecodedVideoFrame(video: HTMLVideoElement, timeout = 2_000): Promise<boolean> {
  if (hasDecodedVideoFrame(video)) return Promise.resolve(true);
  return new Promise(resolve => {
    let completed = false;
    const finish = (result: boolean) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(hasDecodedVideoFrame(video)), timeout);
    if (typeof video.requestVideoFrameCallback !== 'function') return;
    video.requestVideoFrameCallback((_now, metadata) => finish(metadata.width > 0 && metadata.height > 0 && metadata.presentedFrames > 0));
  });
}
