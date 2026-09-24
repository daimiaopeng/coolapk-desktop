import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeedActionBar from '../FeedActionBar.vue';

describe('动态互动入口', () => {
  it('在点赞和转发按钮中展示对应数量', () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedActionBar, {
      props: { feedId: '42', likenum: 12, sharenum: 3 },
    });

    expect(wrapper.find('.like-btn span').text()).toBe('12');
    expect(wrapper.find('.share-btn span').text()).toBe('3');
    expect(wrapper.find('[title="查看点赞用户"]').exists()).toBe(false);
    expect(wrapper.find('[title="查看转发列表"]').exists()).toBe(false);
  });

  it('没有互动数量时不显示列表入口', () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedActionBar, { props: { feedId: '42' } });

    expect(wrapper.find('.like-btn span').text()).toBe('');
    expect(wrapper.find('.share-btn span').text()).toBe('');
    expect(wrapper.find('.comment-btn').text()).toBe('');
    expect(wrapper.find('.fav-btn').text()).toBe('');
  });
});
