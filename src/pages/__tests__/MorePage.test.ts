import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import MorePage from '../MorePage.vue';

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('MorePage.vue', () => {
  it('renders correctly with title and featured items', () => {
    const wrapper = mount(MorePage);
    expect(wrapper.text()).toContain('更多服务');
    expect(wrapper.text()).toContain('常用与核心专区');
    expect(wrapper.text()).toContain('我的数码');
    expect(wrapper.text()).toContain('好物推荐');
    expect(wrapper.text()).toContain('酷安中心');
    expect(wrapper.text()).toContain('二手市场');
  });

  it('filters items correctly when searching', async () => {
    const wrapper = mount(MorePage);
    const searchInput = wrapper.find('.hub-search-input');
    await searchInput.setValue('二手');

    expect(wrapper.text()).toContain('搜索结果');
    expect(wrapper.text()).toContain('二手市场');
    expect(wrapper.text()).not.toContain('常用与核心专区');
  });

  it('navigates to the selected path when a card is clicked', async () => {
    const wrapper = mount(MorePage);
    const firstFeaturedBtn = wrapper.find('.featured-btn-item');
    await firstFeaturedBtn.trigger('click');

    expect(mockPush).toHaveBeenCalledWith('/my-products');
  });
});
