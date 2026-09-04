import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeedActionBar from '../FeedActionBar.vue';

describe('动态互动入口', () => {
  it('展示点赞和转发数量，并发出列表打开事件', async () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedActionBar, {
      props: { feedId: '42', likenum: 12, sharenum: 3 },
    });

    expect(wrapper.find('.like-btn span').exists()).toBe(false);
    expect(wrapper.find('.share-btn span').exists()).toBe(false);
    expect(wrapper.find('[title="查看点赞用户"]').text()).toBe('12');
    expect(wrapper.find('[title="查看转发列表"]').text()).toBe('3');

    await wrapper.find('[title="查看点赞用户"]').trigger('click');
    await wrapper.find('[title="查看转发列表"]').trigger('click');
    expect(wrapper.emitted('open-like-list')).toHaveLength(1);
    expect(wrapper.emitted('open-forward-list')).toHaveLength(1);
  });

  it('没有互动数量时不显示列表入口', () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedActionBar, { props: { feedId: '42' } });

    expect(wrapper.find('[title="查看点赞用户"]').exists()).toBe(false);
    expect(wrapper.find('[title="查看转发列表"]').exists()).toBe(false);
    expect(wrapper.find('.comment-btn').text()).toBe('');
    expect(wrapper.find('.fav-btn').text()).toBe('');
  });
});
