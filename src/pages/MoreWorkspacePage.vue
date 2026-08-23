<template>
  <div class="more-page">
    <FeedTabs
      :active-key="activeSection"
      :tabs="moreTabs"
      :show-manage="false"
      @update:active-key="selectSection"
    />

    <main class="more-content custom-scrollbar">
      <component :is="currentComponent" :key="activeSection" v-bind="currentProps" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import FeedTabs from '../components/feed/FeedTabs.vue';
import MyAlbumsPage from './MyAlbumsPage.vue';
import MyCommentsPage from './MyCommentsPage.vue';
import MyFeedsPage from './MyFeedsPage.vue';
import MyLikesPage from './MyLikesPage.vue';
import MoreDataPage from './MoreDataPage.vue';
import { moreNavs } from '../config/navigation';
import { useSettingsStore } from '../stores/settings';
import type { ConfigPageTab } from '../types/settings';
import type { Component } from 'vue';

const route = useRoute();
const settingsStore = useSettingsStore();

const visibleMoreNavs = computed(() => {
  const visibility = settingsStore.settings.navVisibility;
  return moreNavs.filter((item) => visibility?.[item.key as keyof typeof visibility] !== false);
});

const moreTabs = computed<ConfigPageTab[]>(() => visibleMoreNavs.value.map((item) => ({
  id: item.key,
  title: item.label,
  page_name: item.key,
  url: item.path,
})));

const activeSection = ref(visibleMoreNavs.value[0]?.key || 'my_likes');
const dataModeByKey: Record<string, string> = {
  followed_nodes: 'nodes',
  followed_topics: 'topics',
  recent_contacts: 'contacts',
  recycle_bin: 'recycle',
  hidden_replies: 'hidden',
  my_devices: 'devices',
  my_votes: 'votes',
};
const componentByKey: Record<string, Component> = {
  my_likes: MyLikesPage,
  my_comments: MyCommentsPage,
  my_feeds: MyFeedsPage,
  my_albums: MyAlbumsPage,
  followed_nodes: MoreDataPage,
  followed_topics: MoreDataPage,
  recent_contacts: MoreDataPage,
  recycle_bin: MoreDataPage,
  hidden_replies: MoreDataPage,
  my_devices: MoreDataPage,
  my_votes: MoreDataPage,
};

const currentComponent = computed(() => componentByKey[activeSection.value] || MyLikesPage);
const currentProps = computed(() => ({
  embedded: true,
  ...(dataModeByKey[activeSection.value] ? { mode: dataModeByKey[activeSection.value] } : {}),
}));

function selectSection(key: string) {
  if (visibleMoreNavs.value.some((item) => item.key === key)) activeSection.value = key;
}

watch(() => route.query.section, (section) => {
  if (section) selectSection(String(section));
});

watch(visibleMoreNavs, (items) => {
  if (!items.some((item) => item.key === activeSection.value)) activeSection.value = items[0]?.key || 'my_likes';
});
</script>

<style scoped>
.more-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background-secondary);
}

.more-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.more-content :deep(.page-container) {
  width: 100%;
  height: auto;
  min-height: 100%;
  overflow: visible;
  padding: 0;
}

.more-content :deep(.page-header) {
  margin: 0;
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  background: var(--surface);
}

.more-content :deep(.feed-list) {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
  gap: 10px;
  padding: 10px 12px 24px;
  box-sizing: border-box;
}

.more-content :deep(.feed-list > .feed-card) {
  margin-bottom: 0;
  border-right: 0;
  border-left: 0;
  border-radius: 0;
}

.more-content :deep(.entity-list) {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
  gap: var(--space-2);
  padding: 12px 16px 24px;
  box-sizing: border-box;
}

.more-content :deep(.empty-wrapper) {
  min-height: 260px;
  padding: var(--space-8) 16px;
  box-sizing: border-box;
}
</style>
