import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { describe, expect, it } from 'vitest';
import MobileSharedFeature from '../MobileSharedFeature.vue';
import MobileFeedFeature from '../feed/MobileFeedFeature.vue';
import MobileFeedDetailFeature from '../feed/MobileFeedDetailFeature.vue';
import MobileHomeFeature from '../feed/MobileHomeFeature.vue';
import MobileDownloadsFeature from '../settings-library/MobileDownloadsFeature.vue';
import MobileLibraryFeature from '../settings-library/MobileLibraryFeature.vue';
import MobileSettingsFeature from '../settings-library/MobileSettingsFeature.vue';
import MobileMarketFeature from '../search-market/MobileMarketFeature.vue';
import MobileProductFeature from '../search-market/MobileProductFeature.vue';
import MobileSearchFeature from '../search-market/MobileSearchFeature.vue';
import MobileMessageFeature from '../user-social/MobileMessageFeature.vue';
import MobileSocialFeature from '../user-social/MobileSocialFeature.vue';
import MobileUserFeature from '../user-social/MobileUserFeature.vue';

const featureCases: Array<[string, Component, string]> = [
  ['shared', MobileSharedFeature, 'shared'],
  ['home', MobileHomeFeature, 'home'],
  ['feed', MobileFeedFeature, 'feed'],
  ['feed detail', MobileFeedDetailFeature, 'feed-detail'],
  ['search', MobileSearchFeature, 'search'],
  ['market', MobileMarketFeature, 'market'],
  ['product', MobileProductFeature, 'product'],
  ['user', MobileUserFeature, 'user'],
  ['social', MobileSocialFeature, 'social'],
  ['message', MobileMessageFeature, 'message'],
  ['settings', MobileSettingsFeature, 'settings'],
  ['library', MobileLibraryFeature, 'library'],
  ['downloads', MobileDownloadsFeature, 'downloads'],
];

describe('Mobile feature adapters', () => {
  it.each(featureCases)('renders the %s adapter surface and shared slot', (_name, component, feature) => {
    const wrapper = mount(component, {
      slots: { default: '<div data-test="shared-page">共享页面</div>' },
    });

    expect(wrapper.attributes('data-mobile-feature')).toBe(feature);
    expect(wrapper.find('[data-test="shared-page"]').text()).toBe('共享页面');
  });
});
