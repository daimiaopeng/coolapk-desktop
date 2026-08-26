<template>
  <div class="topics-page">
    <div class="topics-main-column">
      <!-- 顶栏工具条：动态栏目与刷新按钮 -->
      <div class="topics-toolbar-bar">
        <div class="topics-tabs-wrapper">
          <button
            v-for="cat in categories"
            :key="cat.key"
            type="button"
            :class="['cat-tab', { active: activeCategoryUrl === cat.url }]"
            @click="switchCategory(cat)"
          >
            {{ cat.title }}
          </button>
        </div>
      </div>

      <div class="topics-scroll-container custom-scrollbar" @scroll="handleScroll">
        <!-- 加载中状态 -->
        <div v-if="loading && page === 1" class="loading-wrapper">
          <LoadingState text="正在加载话题列表..." />
        </div>

        <!-- 空数据状态 -->
        <div v-else-if="rawTopicItems.length === 0" class="empty-wrapper">
          <EmptyState
            title="暂无相关话题"
            description="未能找到相关话题，可尝试切换上方分类标签或刷新"
          />
        </div>

        <!-- 多列话题卡片：保持桌面端之前的网格排列，同时继续支持到底部加载更多 -->
        <div v-else class="topics-grid">
          <TopicCard
            v-for="(topic, idx) in rawTopicItems"
            :key="topic.id || topic.tag || topic.title || idx"
            :topic="topic"
          />
        </div>

        <!-- 底部加载状态 -->
        <div class="pagination-footer" v-if="rawTopicItems.length > 0">
          <div v-if="loading && page > 1" class="loading-more-footer">
            <i class="fas fa-circle-notch fa-spin"></i> 加载更多话题...
          </div>
          <div v-else-if="noMore" class="no-more-footer">已加载完毕所有话题</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import TopicCard from '../components/topic/TopicCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

interface CategoryItem {
  key: string;
  title: string;
  url: string;
}

const topicEntryUrl = '/page?url=V11_VERTICAL_TOPIC';
const categories = ref<CategoryItem[]>([]);
const activeCategoryUrl = ref('');
const rawTopicItems = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const noMore = ref(false);
const firstItemCursor = ref('');
const lastItemCursor = ref('');

async function fetchTopicData(url: string = topicEntryUrl, isLoadMore = false, allowNestedLoad = false) {
  if (loading.value && !allowNestedLoad) return;
  loading.value = true;

  try {
    const currentPage = isLoadMore ? page.value : 1;
    const res = await CoolapkTauriAPI.getTopicHubData(url, currentPage, isLoadMore ? firstItemCursor.value : '', isLoadMore ? lastItemCursor.value : '');
    if (!isLoadMore && Array.isArray(res?.tabs) && res.tabs.length > 0) {
      const nextCategories = normalizeCategoryList(res.tabs);
      const serverSelectedUrl = normalizeCategoryText(res?.selectedUrl);
      updateCategories(nextCategories, serverSelectedUrl);
      if (url === topicEntryUrl) {
        const defaultCategory = findHotCategory(nextCategories);
        const defaultUrl = defaultCategory?.url || serverSelectedUrl || nextCategories[0]?.url || '';
        if (defaultUrl) {
          activeCategoryUrl.value = defaultUrl;
          if (defaultUrl !== serverSelectedUrl && defaultUrl !== topicEntryUrl) {
            return fetchTopicData(defaultUrl, false, true);
          }
        }
      }
    }
    const dataList = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    const extractedTopics: any[] = [];

    dataList.forEach((item: any) => {
      if (item.entityType === 'card' && Array.isArray(item.entities)) {
        item.entities.forEach((sub: any) => {
          if (isTopicEntity(sub)) {
            extractedTopics.push(sub);
          }
        });
      } else if (isTopicEntity(item)) {
        extractedTopics.push(item);
      }
    });

    const responseFirstItem = normalizeCursor(res?.firstItem);
    const responseLastItem = normalizeCursor(res?.lastItem);
    if (!isLoadMore) {
      firstItemCursor.value = responseFirstItem || itemCursor(extractedTopics[0]);
    }
    lastItemCursor.value = responseLastItem || itemCursor(extractedTopics[extractedTopics.length - 1]);

    if (extractedTopics.length === 0) {
      noMore.value = true;
    } else {
      const itemsToAdd = isLoadMore ? extractedTopics.filter((item) => {
        const key = topicKey(item);
        return !key || !rawTopicItems.value.some((existing) => topicKey(existing) === key);
      }) : extractedTopics;
      if (isLoadMore) {
        rawTopicItems.value.push(...itemsToAdd);
      } else {
        rawTopicItems.value = itemsToAdd;
      }
      page.value = currentPage + 1;
      if (itemsToAdd.length === 0) noMore.value = true;
    }
  } catch (err) {
    console.warn('获取话题数据失败:', err);
  } finally {
    loading.value = false;
  }
}

function normalizeCategoryText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeCategoryList(value: any): CategoryItem[] {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(value?.entities)
      ? value.entities
      : Array.isArray(value?.data)
        ? value.data
        : [];
  return source.map((item: any, index: number) => {
    const extra = item?.extraData || item?.extra_data || {};
    const title = normalizeCategoryText(item?.title || item?.name || item?.label);
    const url = normalizeCategoryText(item?.url || item?.link || item?.pageUrl || item?.page_url || item?.pageName || item?.page_name || extra?.url || extra?.pageName);
    const key = normalizeCategoryText(item?.id || item?.entityId || item?.entity_id || `${title}-${url}-${index}`);
    return { key, title, url };
  }).filter((item: CategoryItem) => item.title && item.url);
}

function updateCategories(value: any, selectedUrl = ''): void {
  const nextCategories = normalizeCategoryList(value);
  categories.value = nextCategories;
  if (selectedUrl && nextCategories.some((item) => item.url === selectedUrl)) {
    activeCategoryUrl.value = selectedUrl;
  } else if (!activeCategoryUrl.value && nextCategories.length > 0) {
    activeCategoryUrl.value = nextCategories[0].url;
  }
}

function findHotCategory(items: CategoryItem[]): CategoryItem | undefined {
  return items.find((item) => item.title === '热门') || items.find((item) => item.title.includes('热门'));
}

function normalizeCursor(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function itemCursor(item: any): string {
  return normalizeCursor(item?.entityId ?? item?.id);
}

function isTopicEntity(item: any): boolean {
  if (!item) return false;
  const type = item.entityType || '';
  if (type === 'topic' || type === 'tag') return true;
  if (item.title && (item.logo || item.pic || item.cover || item.follower_num || item.follownum || item.commentnum || item.hot_num)) {
    return true;
  }
  return false;
}

function topicKey(item: any): string {
  const raw = item?.tag || item?.title || item?.title_format || item?.entityTemplate || '';
  return String(raw).replace(/^#|#$/g, '').trim().toLowerCase();
}

function switchCategory(cat: CategoryItem) {
  activeCategoryUrl.value = cat.url;
  page.value = 1;
  noMore.value = false;
  firstItemCursor.value = '';
  lastItemCursor.value = '';
  rawTopicItems.value = [];
  fetchTopicData(cat.url, false);
}

function refreshCurrent() {
  page.value = 1;
  noMore.value = false;
  firstItemCursor.value = '';
  lastItemCursor.value = '';
  rawTopicItems.value = [];
  fetchTopicData(activeCategoryUrl.value || topicEntryUrl, false);
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    if (!loading.value && !noMore.value) {
      fetchTopicData(activeCategoryUrl.value || topicEntryUrl, true);
    }
  }
}

onMounted(() => {
  fetchTopicData(topicEntryUrl, false);
});
</script>

<style scoped>
.topics-page { display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; background: var(--background); }
.topics-main-column { display: flex; flex: 1; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; background: var(--surface); }
.topics-scroll-container { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 16px 0 48px; background: var(--background-secondary); }

.topics-toolbar-bar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  height: auto;
  min-height: 48px;
  padding: 0;
  flex: 0 0 auto;
  margin-bottom: 0;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  background-color: var(--surface);
}

.topics-tabs-wrapper {
  display: flex;
  align-items: center;
  align-content: center;
  flex-wrap: wrap;
  column-gap: 0;
  row-gap: 0;
  min-height: 48px;
  height: auto;
  flex: 0 0 auto;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 0 16px;
  user-select: none;
}

.cat-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--duration-fast, 0.15s) var(--ease-default, ease);
}

.cat-tab:hover {
  color: var(--text-primary);
}

.cat-tab.active {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 16px;
}

.cat-tab.active::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  width: 22px;
  height: 3.5px;
  transform: translateX(-50%);
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
}

.loading-wrapper,
.empty-wrapper {
  padding: var(--space-10) 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.topics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-4, 16px);
  padding: 0 16px;
}

.cat-tab-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.pagination-footer {
  padding: var(--space-6, 24px) 0;
  text-align: center;
}

.no-more {
  font-size: var(--font-size-xs, 12px);
  color: var(--text-secondary);
}
</style>
