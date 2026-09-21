import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import FeedCollectionPickerDialog from '../FeedCollectionPickerDialog.vue';

describe('FeedCollectionPickerDialog', () => {
  it('管理已有收藏时允许清空全部收藏夹并确认', async () => {
    const wrapper = mount(FeedCollectionPickerDialog, {
      props: {
        isOpen: true,
        collections: [{ id: '1', title: '默认收藏夹', isBeCollected: 1 }],
        selectedIds: ['1'],
        allowEmptySelection: true,
      },
      global: {
        stubs: {
          AppDialog: { template: '<div><slot/><slot name="footer"/></div>' },
          AppButton: { template: '<button @click="$emit(\'click\')"><slot/></button>' },
        },
      },
    });

    await wrapper.find('.collection-picker-item').trigger('click');
    expect(wrapper.text()).toContain('取消全部收藏');
    await wrapper.findAll('button').at(-1)!.trigger('click');
    expect(wrapper.emitted('confirm')?.at(-1)).toEqual([[]]);
  });
});
