import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import FavoriteExportDialog from '../FavoriteExportDialog.vue';

describe('FavoriteExportDialog', () => {
  it('默认选择 JSON，并只提供所有评论开关', async () => {
    const wrapper = mount(FavoriteExportDialog, {
      props: { isOpen: true },
      global: {
        plugins: [createPinia()],
        stubs: {
          Teleport: true,
        },
      },
    });

    const formatInputs = wrapper.findAll('.format-card input');
    expect((formatInputs[0].element as HTMLInputElement).checked).toBe(true);
    expect((formatInputs[1].element as HTMLInputElement).checked).toBe(false);
    const commentInputs = wrapper.findAll('.comment-option input');
    expect(commentInputs).toHaveLength(1);
    expect((commentInputs[0].element as HTMLInputElement).disabled).toBe(false);
    await commentInputs[0].setValue(true);
    expect((commentInputs[0].element as HTMLInputElement).checked).toBe(true);
  });

  it('收藏单模式支持选择一个或多个收藏单', async () => {
    const wrapper = mount(FavoriteExportDialog, {
      props: {
        isOpen: true,
        mode: 'collections',
        collections: [
          { id: '11', title: '摄影', itemNum: 8 },
          { id: '22', title: '旅行', itemNum: 12 },
        ],
      },
      global: {
        plugins: [createPinia()],
        stubs: { Teleport: true },
      },
    });

    expect(wrapper.text()).toContain('选择收藏单');
    expect(wrapper.text()).toContain('摄影');
    expect(wrapper.text()).toContain('12 条内容');
    const cards = wrapper.findAll('.collection-picker-card');
    await cards[0].find('input').setValue(true);
    await cards[1].find('input').setValue(true);
    expect(wrapper.text()).toContain('已选择 2 个');
    expect(cards.every(card => card.classes().includes('selected'))).toBe(true);
  });

  it('选择 HTML 后可选择高清图片或原图', async () => {
    const wrapper = mount(FavoriteExportDialog, {
      props: { isOpen: true },
      global: {
        plugins: [createPinia()],
        stubs: { Teleport: true },
      },
    });

    await wrapper.findAll('.format-card input')[2].setValue(true);
    const qualityInputs = wrapper.findAll('.image-quality-card input');
    expect(qualityInputs).toHaveLength(2);
    expect((qualityInputs[0].element as HTMLInputElement).checked).toBe(true);
    await qualityInputs[1].setValue(true);
    expect((qualityInputs[1].element as HTMLInputElement).checked).toBe(true);
    expect(wrapper.text()).toContain('images/avatars');
  });
});
