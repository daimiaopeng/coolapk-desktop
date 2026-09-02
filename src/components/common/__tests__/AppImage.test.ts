import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getImageDataUrl: vi.fn(),
}));

vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getImageDataUrl: mocks.getImageDataUrl,
  },
}));

import AppImage from '../AppImage.vue';

describe('AppImage', () => {
  beforeEach(() => {
    mocks.getImageDataUrl.mockReset();
    mocks.getImageDataUrl.mockResolvedValue('data:image/jpeg;base64,YWJj');
  });

  it('保留原始图片地址供右键菜单保存', async () => {
    const sourceUrl = 'http://image.coolapk.com/feed/test.jpg';
    const wrapper = mount(AppImage, { props: { src: sourceUrl } });

    await flushPromises();

    const image = wrapper.get('img');
    expect(image.attributes('src')).toBe('data:image/jpeg;base64,YWJj');
    expect(image.attributes('data-original-url')).toBe('https://image.coolapk.com/feed/test.jpg');
    expect(mocks.getImageDataUrl).toHaveBeenCalledWith('https://image.coolapk.com/feed/test.jpg', expect.any(Object));
  });
});
