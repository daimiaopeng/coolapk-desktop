import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLiveVideoCodec, getLiveVideoCodecSupport, hasDecodedVideoFrame, type LiveVideoCodec } from '../liveVideoCodec';

function box(type: string, payload: Uint8Array = new Uint8Array()): Uint8Array {
  const result = new Uint8Array(8 + payload.length);
  new DataView(result.buffer).setUint32(0, result.length);
  result.set([...type].map(char => char.charCodeAt(0)), 4);
  result.set(payload, 8);
  return result;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function mp4WithCodec(codec: string, configuration?: { type: string; payload: Uint8Array }): Uint8Array {
  const children = configuration ? box(configuration.type, configuration.payload) : new Uint8Array();
  const sampleEntry = new Uint8Array(86 + children.length);
  new DataView(sampleEntry.buffer).setUint32(0, sampleEntry.length);
  sampleEntry.set([...codec].map(char => char.charCodeAt(0)), 4);
  sampleEntry.set(children, 86);
  const stsdPayload = new Uint8Array(8 + sampleEntry.length);
  new DataView(stsdPayload.buffer).setUint32(4, 1);
  stsdPayload.set(sampleEntry, 8);
  return concat(box('ftyp', new Uint8Array(8)), box('moov', box('trak', box('mdia', box('minf', box('stbl', box('stsd', stsdPayload)))))));
}

function webmWithCodec(codec: string): Uint8Array {
  const codecBytes = new TextEncoder().encode(codec);
  const track = concat(new Uint8Array([0x83, 0x81, 0x01]), new Uint8Array([0x86, 0x80 | codecBytes.length]), codecBytes);
  const entry = concat(new Uint8Array([0xae, 0x80 | track.length]), track);
  const tracks = concat(new Uint8Array([0x16, 0x54, 0xae, 0x6b, 0x80 | entry.length]), entry);
  return concat(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x80]), new Uint8Array([0x18, 0x53, 0x80, 0x67, 0x80 | tracks.length]), tracks);
}

afterEach(() => vi.unstubAllGlobals());

describe('Live Photo 视频编码识别', () => {
  it.each([
    ['hvc1', 'HEVC/H.265'],
    ['hev1', 'HEVC/H.265'],
    ['avc1', 'H.264/AVC'],
    ['avc3', 'H.264/AVC'],
    ['vp09', 'VP9'],
    ['av01', 'AV1'],
  ])('从 MP4 stsd 读取 %s', (id, name) => {
    expect(detectLiveVideoCodec(mp4WithCodec(id))).toEqual({ id, name, container: 'mp4' });
  });

  it('从 WebM Video Track 的 CodecID 读取 VP9', () => {
    expect(detectLiveVideoCodec(webmWithCodec('V_VP9'))).toEqual({ id: 'vp09', name: 'VP9', container: 'webm' });
  });

  it('不把 MP4 容器外的字符串猜测成编码', () => {
    expect(detectLiveVideoCodec(concat(box('ftyp', new Uint8Array(8)), new TextEncoder().encode('hvc1')))).toBeNull();
  });

  it('从 hvcC 生成完整的 HEVC codec 字符串', () => {
    const hvcC = new Uint8Array(13);
    hvcC.set([1, 1, 0x60, 0, 0, 0, 0xb0, 0, 0, 0, 0, 0, 93]);
    expect(detectLiveVideoCodec(mp4WithCodec('hvc1', { type: 'hvcC', payload: hvcC }))).toEqual({
      id: 'hvc1', name: 'HEVC/H.265', container: 'mp4', mimeCodec: 'hvc1.1.6.L93.B0',
    });
  });
});

describe('WebView2 视频编码能力判断', () => {
  const hevc: LiveVideoCodec = { id: 'hvc1', name: 'HEVC/H.265', container: 'mp4', mimeCodec: 'hvc1.1.6.L93.B0' };

  it('仅在 MediaCapabilities 明确拒绝且 canPlayType 为空时判定不支持', async () => {
    vi.stubGlobal('navigator', { mediaCapabilities: { decodingInfo: vi.fn().mockResolvedValue({ supported: false }) } });
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue({ canPlayType: vi.fn().mockReturnValue('') }) });
    await expect(getLiveVideoCodecSupport(hevc)).resolves.toBe('unsupported');
  });

  it('能力 API 不可用时保持未知，不提示缺少解码器', async () => {
    vi.stubGlobal('navigator', {});
    await expect(getLiveVideoCodecSupport(hevc)).resolves.toBe('unknown');
  });

  it('只有尺寸和已解码帧都有效时才确认播放', () => {
    const video = { videoWidth: 1920, videoHeight: 1080, getVideoPlaybackQuality: () => ({ totalVideoFrames: 0 }) } as unknown as HTMLVideoElement;
    expect(hasDecodedVideoFrame(video)).toBe(false);
    video.getVideoPlaybackQuality = () => ({ totalVideoFrames: 1 } as VideoPlaybackQuality);
    expect(hasDecodedVideoFrame(video)).toBe(true);
  });
});
