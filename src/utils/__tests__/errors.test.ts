import { describe, expect, it } from 'vitest';
import { getErrorMessage } from '../errors';

describe('getErrorMessage', () => {
  it('keeps string rejections returned by Tauri invoke', () => {
    expect(getErrorMessage('酷安服务端拒绝删除', '删除失败')).toBe('酷安服务端拒绝删除');
  });

  it('falls back for values without a useful message', () => {
    expect(getErrorMessage(null, '删除失败')).toBe('删除失败');
  });
});
