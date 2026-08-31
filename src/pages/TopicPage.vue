<template>
  <div
    ref="pageContainerRef"
    :class="['page-container', 'custom-scrollbar', { 'is-embedded': embedded }]"
    @scroll="handleScroll"
  >
    <!-- 1. 话题头部卡片 -->
    <div v-if="topicDetail" class="topic-header-card">
      <div class="header-content">
        <div class="topic-icon-wrapper">
          <AppImage
            v-if="topicLogo"
            :src="topicLogo"
            class="topic-icon"
            fit="cover"
            :alt="tag"
          />
          <div v-else class="topic-icon-fallback">
            <span class="hashtag">#</span>
          </div>
        </div>

        <div class="topic-info">
          <h2 class="topic-title">{{ tag }}</h2>
          <div class="topic-stats-text">
            <span>{{ formatNumber(viewCount) }}热度</span>
            <span class="dot">·</span>
            <span>{{ formatNumber(commentCount) }}讨论</span>
            <span class="dot">·</span>
            <span>{{ formatNumber(followerCount) }}关注</span>
          </div>
        </div>

        <div class="topic-actions">
          <button
            :class="['btn-follow', { followed: isFollowed }]"
            :disabled="followPending"
            :aria-pressed="isFollowed"
            @click="toggleFollow"
          >
            {{ isFollowed ? '已关注' : '关注' }}
          </button>
        </div>
      </div>

      <!-- 简介文案 -->
      <div v-if="cleanedDescription" class="topic-description">
        {{ cleanedDescription }}
      </div>
    </div>

    <!-- 保留「正在加载话题概况...」大白框转圈 -->
    <div v-else-if="headerLoading" class="topic-header-card skeleton-header">
      <LoadingState text="正在加载话题概况..." />
    </div>

    <!-- APK 话题页由 tabList 下发栏目，展示方式与设备页 Tab 保持一致。 -->
    <div v-if="topicTabs.length > 1" class="topic-sub-tabs custom-scrollbar">
      <button
        v-for="tab in topicTabs"
        :key="tab.key"
        :class="['topic-tab-item', { active: activeTopicTabKey === tab.key }]"
        type="button"
        @click="changeTopicTab(tab.key)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="activeTopicTabKey === tab.key" class="tab-line"></span>
      </button>
    </div>

    <!-- 4. 排序筛选与搜索工具条 -->
    <EntityFilterBar
      v-if="isDiscussionTab(activeTopicTab)"
      v-model:sort="currentSort"
      v-model:search-keyword="searchKeyword"
      :sort-options="sortOptions"
      :search-sort-options="FEED_SEARCH_SORT_OPTIONS"
      :feed-type="searchFeedType"
      :feed-type-options="TOPIC_FEED_TYPE_OPTIONS"
      show-feed-type
      :target-title="tag"
      scope-type="tag"
      :scope-param="tag"
      :auto-navigate-search="false"
      @change="changeSort"
      @search="handleTopicSearch"
      @clear="handleTopicClear"
      @change-feed-type="handleTopicFeedTypeChange"
    />

    <!-- 5. Feed 动态列表加载中转圈 -->
    <div v-if="feedsLoading && page === 1" class="loading-wrapper">
      <LoadingState :text="loadingText" />
    </div>

    <!-- 仅在请求彻底完成且确实无数据时才展示空状态，绝不提前闪现 -->
    <div v-else-if="!feedsLoading && topicFeeds.length === 0" class="empty-wrapper">
      <EmptyState :title="emptyStateTitle" />
    </div>

    <div v-else class="feed-list">
      <template v-for="(item, index) in topicFeeds" :key="topicItemKey(item, index)">
        <FeedCard
          v-if="isTopicFeedItem(item)"
          :feed="item"
          :class="{ 'is-active-feed': String(item.id) === String(currentActiveFeedId) }"
          :highlight-keyword="searchKeyword"
          :disable-inline-comments="disableInlineComments"
          @click="handleFeedCardClick(item)"
          @open-comment="handleFeedCardClick(item)"
          @deleted="handleFeedDeleted"
        />
        <DiscoveryEntityCard v-else :entity="item" @open="openTopicEntity" />
      </template>

      <div class="pagination-footer">
        <LoadingState v-if="feedsLoading && page > 1" text="加载更多中..." />
        <div v-else-if="noMore" class="no-more">没有更多动态了</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, onDeactivated, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import FeedCard from '../components/feed/FeedCard.vue';
import DiscoveryEntityCard from '../components/discovery/DiscoveryEntityCard.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import EntityFilterBar from '../components/common/EntityFilterBar.vue';
import { showToast } from '../utils/toast';
import { normalizeCoolapkPageRoute, normalizeCoolapkRoute } from '../utils/coolapkRoute';
import { resolveDiscoveryRoute } from '../utils/discovery';
import {
  FEED_SEARCH_SORT_OPTIONS,
  TOPIC_FEED_TYPE_OPTIONS,
  resolveFeedSearchSort,
} from '../utils/coolapkFeedSearch';

const props = withDefaults(
  defineProps<{
    tagParam?: string;
    embedded?: boolean;
    activeFeedId?: string | number;
    disableInlineComments?: boolean;
  }>(),
  {
    tagParam: '',
    embedded: false,
    activeFeedId: '',
    disableInlineComments: false,
  }
);

const emit = defineEmits<{
  (e: 'select-feed', feed: any): void;
}>();

interface TopicSortOption {
  key: string;
  label: string;
  listType: string;
  url: string;
}

interface TopicTab {
  key: string;
  label: string;
  pageName: string;
  url: string;
  subTitle: string;
  kind: 'discussion' | 'device' | 'feature' | 'rating' | 'generic';
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
function decodeTopicTag(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// 固定当前缓存页面的话题参数，返回时恢复原页面实例。
const tag = ref(props.tagParam || decodeTopicTag((route?.params?.tag as string) || ''));

const currentActiveFeedId = computed(() => props.activeFeedId);

function handleFeedCardClick(item: any) {
  emit('select-feed', item);
}

watch(
  () => props.tagParam,
  (newTag) => {
    if (newTag && newTag !== tag.value) {
      tag.value = newTag;
      page.value = 1;
      topicFeeds.value = [];
      noMore.value = false;
      void initializeTopic();
    }
  }
);

const topicDetail = ref<any>(null);
const headerLoading = ref(true);
const topicTabs = ref<TopicTab[]>([]);
const activeTopicTabKey = ref('feed');
const searchKeyword = ref('');
const searchFeedType = ref('all');

const topicFeeds = ref<any[]>([]);

function handleFeedDeleted(id: string | number) {
  topicFeeds.value = topicFeeds.value.filter((f: any) => String(f.id) !== String(id));
}
const feedsLoading = ref(true);
const page = ref(1);
const noMore = ref(false);
const isFollowed = ref(false);
const followPending = ref(false);

const currentSort = ref('default');
const FALLBACK_SORT_OPTIONS: TopicSortOption[] = [
  { key: 'default', label: '默认', listType: '', url: '' },
  { key: 'latest', label: '最新', listType: 'dateline_desc', url: '' },
  { key: 'hot', label: '热度', listType: 'popular', url: '' },
];
const sortOptions = ref<TopicSortOption[]>([...FALLBACK_SORT_OPTIONS]);
let feedRequestId = 0;

const activeTopicTab = computed(() => {
  return topicTabs.value.find((tab) => tab.key === activeTopicTabKey.value) || topicTabs.value[0] || null;
});

const loadingText = computed(() => {
  const tab = activeTopicTab.value;
  if (!tab || tab.kind === 'discussion') return '正在获取话题动态...';
  return `正在获取${tab.label}...`;
});

const emptyStateTitle = computed(() => {
  const tab = activeTopicTab.value;
  if (!tab || tab.kind === 'discussion') return '暂无相关话题动态';
  if (tab.kind === 'rating') return '暂无评分';
  return `暂无${tab.label || '相关内容'}`;
});

const topicLogo = computed(() => {
  if (!topicDetail.value) return '';
  return topicDetail.value.logo || topicDetail.value.pic || topicDetail.value.cover || topicDetail.value.icon || '';
});

const followerCount = computed(() => {
  if (!topicDetail.value) return 0;
  return topicDetail.value.follower_num || topicDetail.value.follownum || topicDetail.value.follow_num || 0;
});

const commentCount = computed(() => {
  if (!topicDetail.value) return 0;
  return topicDetail.value.commentnum || topicDetail.value.discuss_num || topicDetail.value.replynum || 0;
});

const viewCount = computed(() => {
  if (!topicDetail.value) return 0;
  return topicDetail.value.view_num || topicDetail.value.hot_num || topicDetail.value.click || 0;
});

const cleanedDescription = computed(() => {
  const desc = String(topicDetail.value?.description || topicDetail.value?.intro || '').trim();
  if (desc.includes('禁发红包') || desc.includes('必封') || desc.includes('人头车')) return '';
  return desc;
});

function formatNumber(num: number | string) {
  const n = Number(num);
  if (isNaN(n) || n <= 0) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function readFollowedState(detail: any) {
  const userAction = detail?.userAction || detail?.user_action;
  const value = userAction?.follow ?? detail?.followed ?? detail?.isFollowed ?? detail?.is_follow ?? detail?.follow;
  return value === true || Number(value) === 1;
}

function readQueryParameter(rawUrl: unknown, name: string): string {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';
  const candidates = [raw];
  const hashIndex = raw.indexOf('#');
  if (hashIndex >= 0) candidates.push(raw.slice(hashIndex + 1));
  for (const candidate of candidates) {
    const queryIndex = candidate.indexOf('?');
    if (queryIndex < 0) continue;
    const value = new URLSearchParams(candidate.slice(queryIndex + 1)).get(name);
    if (value) return value;
  }
  return '';
}

function normalizeSortKey(label: string, listType: string, index: number): string {
  if (listType === 'hot' || listType === 'popular' || /热度|热门/.test(label)) return 'hot';
  if (listType === 'dateline_desc' || /最新回复/.test(label)) return 'latest-reply';
  if (listType === 'lastupdate_desc' || /最新/.test(label)) return 'latest';
  if (!listType && /默认|综合/.test(label)) return 'default';
  return `sort-${index}`;
}

function normalizeSortOptions(rawOptions: unknown): TopicSortOption[] {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions
    .map((rawOption: any, index): TopicSortOption => {
      const label = String(rawOption?.title || rawOption?.name || '').trim();
      const url = String(rawOption?.url || rawOption?.link || rawOption?.requestArg || rawOption?.request_arg || '').trim();
      const listType = readQueryParameter(url, 'listType') || (
        /最新回复|最新/.test(label) ? 'dateline_desc' : /热度|热门/.test(label) ? 'popular' : ''
      );
      return { key: normalizeSortKey(label, listType, index), label, listType, url };
    })
    .filter((option) => option.label.length > 0);
}

function applyServerSortOptions(response: any) {
  const serverOptions = normalizeSortOptions(response?.sortOptions);
  if (serverOptions.length === 0) return;
  sortOptions.value = serverOptions;
  if (!serverOptions.some((option) => option.key === currentSort.value)) {
    currentSort.value = serverOptions[0].key;
  }
}

function topicTabKind(pageName: string, label: string, url: string): TopicTab['kind'] {
  const text = `${pageName} ${label} ${url}`.toLowerCase();
  if (/评分|beta|rating|score/.test(text)) return 'rating';
  if (/新特性|特性|feature|changelog|更新日志/.test(text)) return 'feature';
  if (/机型|设备|device|model/.test(text)) return 'device';
  if (/讨论|discussion|tagfeed|feed/.test(text)) return 'discussion';
  return 'generic';
}

function defaultTopicTab(): TopicTab {
  return { key: 'feed', label: '讨论', pageName: 'feed', url: '', subTitle: '', kind: 'discussion' };
}

function normalizeTopicTabs(detail: any): TopicTab[] {
  const tabSource = detail?.tabList || detail?.tabApiList || detail?.tab_list || detail?.tab_api_list || detail?.tabs || detail?.pages;
  const rawTabs = Array.isArray(tabSource)
    ? tabSource
    : Array.isArray(tabSource?.data)
      ? tabSource.data
      : Array.isArray(tabSource?.entities)
        ? tabSource.entities
        : [];
  if (!Array.isArray(rawTabs)) {
    return [defaultTopicTab()];
  }
  const seen = new Set<string>();
  const tabs = rawTabs.map((rawTab: any, index: number): TopicTab | null => {
    const item = typeof rawTab === 'string' ? { title: rawTab } : rawTab || {};
    const pageName = String(item.pageName || item.page_name || item.page || item.type || item.kind || '').trim();
    const label = String(item.title || item.name || item.label || item.tabTitle || item.tab_title || pageName || '').trim();
    const url = String(item.url || item.link || item.pageUrl || item.page_url || item.apiUrl || item.api_url || item.requestArg || item.request_arg || item.requestUrl || item.request_url || item.targetUrl || item.target_url || item.api || '').trim();
    const visible = item.page_visibility !== 0 && item.page_visibility !== '0' && item.page_visibility !== false
      && item.pageVisibility !== 0 && item.pageVisibility !== '0' && item.pageVisibility !== false
      && item.visibility !== 0 && item.visibility !== '0' && item.visibility !== false
      && item.status !== 0 && item.status !== '0' && item.status !== false
      && item.hidden !== true && item.hide !== true && item.isShow !== false && item.is_show !== false
      && item.visible !== false && item.enabled !== false;
    if (!visible || !label) return null;
    const baseKey = pageName || url || `tab-${index}`;
    const key = seen.has(baseKey) ? `${baseKey}-${index}` : baseKey;
    seen.add(key);
    const kind = topicTabKind(pageName, label, url);
    return {
      key,
      label,
      pageName,
      url,
      subTitle: String(item.subTitle || item.sub_title || item.subtitle || '').trim(),
      kind,
    };
  }).filter((tab): tab is TopicTab => tab !== null);
  return tabs.length > 0 ? tabs : [defaultTopicTab()];
}

function applyTopicTabs(detail: any) {
  const tabs = normalizeTopicTabs(detail);
  const selected = String(detail?.selectedTab || detail?.selected_tab || '').trim();
  const selectedTab = tabs.find((tab) => tab.key === selected || tab.pageName === selected || tab.url === selected || tab.label === selected);
  topicTabs.value = tabs;
  activeTopicTabKey.value = selectedTab?.key || tabs[0]?.key || 'feed';
}

function isDiscussionTab(tab: TopicTab | null): boolean {
  if (!tab) return true;
  return tab.kind === 'discussion';
}

function getTopicTabUrl(tab: TopicTab): string {
  const rawUrl = tab.url.trim();
  if (rawUrl) {
    if (rawUrl.startsWith('/v6/')) return rawUrl;
    if (rawUrl.startsWith('#')) return rawUrl;
    if (rawUrl.startsWith('/')) return `#${rawUrl}`;
    if (rawUrl.startsWith('topic/') || rawUrl.startsWith('feed/')) return `#/${rawUrl}`;
    return rawUrl;
  }
  const type = tab.pageName || 'feed';
  return `#/topic/tagFeedList?tag=${encodeURIComponent(tag.value)}&type=${encodeURIComponent(type)}`;
}

function readFeedCursor(feed: any): string {
  const value = feed?.id ?? feed?.feedId ?? feed?.feed_id ?? feed?.entityId ?? '';
  return value === null || value === undefined ? '' : String(value);
}

function isTopicFeedItem(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const type = String(item.entityType || item.entity_type || item.entityTemplate || item.entity_template || '').toLowerCase();
  return ['feed', 'feed_reply', 'feedreply', 'article', 'news'].includes(type) || type.startsWith('feed_') || Boolean(item.message || item.message_raw_output || item.username || item.userInfo || item.user_info);
}

function isTopicDisplayItem(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  return Boolean(item.title || item.description || item.subTitle || item.sub_title || item.message || item.pic || item.logo || item.cover || item.url);
}

function appendTopicRows(value: any, output: any[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const isFeed = isTopicFeedItem(value);
  if (!isFeed) {
    const nested = value.feed || value.ratingFeed || value.rating_feed;
    if (nested && typeof nested === 'object') {
      appendTopicRows(nested, output);
      return;
    }
    if (Array.isArray(value.entities)) {
      value.entities.forEach((child: any) => appendTopicRows(child, output));
      if (value.entities.length > 0) return;
    }
  }
  if (isFeed || isTopicDisplayItem(value)) output.push(value);
}

function extractTopicRows(response: any): any[] {
  const data = response?.data;
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.entities)
        ? data.entities
        : Array.isArray(response?.rows)
          ? response.rows
          : [];
  const output: any[] = [];
  rows.forEach((row: any) => appendTopicRows(row, output));
  return output;
}

function topicItemKey(item: any, index: number): string {
  const value = item?.id ?? item?.entityId ?? item?.feedId ?? item?.feed_id ?? item?.url;
  return value === undefined || value === null || String(value).trim() === ''
    ? `${item?.entityType || item?.entityTemplate || 'topic'}-${index}`
    : String(value);
}

function openTopicEntity(entity: any) {
  const routeInfo = resolveDiscoveryRoute(entity);
  if (!routeInfo) return;
  if (routeInfo.kind === 'web') {
    void CoolapkTauriAPI.openUrl(routeInfo.target, 'internal');
    return;
  }
  const pageRoute = normalizeCoolapkPageRoute(routeInfo.target);
  if (pageRoute) {
    const pageUrl = new URL(pageRoute, 'https://www.coolapk.com');
    void router.push({ path: '/page', query: { url: pageUrl.searchParams.get('url') || '', title: routeInfo.title || '' } });
    return;
  }
  const nativeRoute = normalizeCoolapkRoute(routeInfo.target);
  if (nativeRoute) {
    void router.push(nativeRoute);
  } else if (routeInfo.target.startsWith('/')) {
    void router.push(routeInfo.target);
  }
}

async function fetchTopicHeader() {
  if (!tag.value) return;
  headerLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getTopicDetail(tag.value);
    if (res && res.data) {
      let detail = res.data;
      if (normalizeTopicTabs(detail).length <= 1) {
        const legacyRes = await CoolapkTauriAPI.getTopicDetailV7(tag.value).catch(() => null);
        const legacyDetail = legacyRes?.data;
        if (legacyDetail && normalizeTopicTabs(legacyDetail).length > normalizeTopicTabs(detail).length) {
          detail = { ...legacyDetail, ...detail, tabList: legacyDetail.tabList || legacyDetail.tabApiList };
        }
      }
      topicDetail.value = detail;
      isFollowed.value = readFollowedState(detail);
      applyTopicTabs(detail);
    } else {
      topicDetail.value = {
        title: tag.value,
        description: '',
        follownum: 0,
        commentnum: 0,
        view_num: 0,
      };
      isFollowed.value = false;
      applyTopicTabs(null);
    }
  } catch (err) {
    topicDetail.value = {
      title: tag.value,
      description: '',
      follownum: 0,
      commentnum: 0,
      view_num: 0,
    };
    isFollowed.value = false;
    applyTopicTabs(null);
  } finally {
    headerLoading.value = false;
  }
}

async function fetchFeeds(isLoadMore = false) {
  if (!tag.value || (isLoadMore && (feedsLoading.value || noMore.value))) return;

  const requestId = ++feedRequestId;
  feedsLoading.value = true;
  try {
    const sortOption = sortOptions.value.find((option) => option.key === currentSort.value) || FALLBACK_SORT_OPTIONS[0];
    const firstItem = isLoadMore && topicFeeds.value.length > 0 ? readFeedCursor(topicFeeds.value[0]) : '';
    const lastItem = isLoadMore && topicFeeds.value.length > 0 ? readFeedCursor(topicFeeds.value[topicFeeds.value.length - 1]) : '';
    const tab = activeTopicTab.value;
    const kw = searchKeyword.value.trim();

    let res: any;
    if (kw) {
      const searchSort = resolveFeedSearchSort(currentSort.value);
      res = await CoolapkTauriAPI.searchByType({
        searchType: 'feed',
        query: kw,
        page: page.value,
        firstItem,
        lastItem,
        pageType: 'tag',
        pageParam: tag.value,
        feedType: searchFeedType.value,
        sort: searchSort.sort,
        isStrict: searchSort.isStrict,
      });
    } else {
      res = !tab || isDiscussionTab(tab)
        ? await CoolapkTauriAPI.getTopicFeeds(tag.value, page.value, {
          listType: sortOption.listType,
          firstItem,
          lastItem,
          blockStatus: 1,
        })
        : tab.kind === 'device'
          ? await CoolapkTauriAPI.getDeviceFeedList(tag.value, page.value, { firstItem, lastItem })
        : await CoolapkTauriAPI.getTopicTabData({
          url: getTopicTabUrl(tab),
          title: tab.label,
          subTitle: tab.subTitle,
          page: page.value,
          firstItem,
          lastItem,
          pageContext: JSON.stringify({ source: 'desktop-topic', tag: tag.value, tab: tab.pageName || tab.key }),
        });
    }

    if (requestId !== feedRequestId) return;
    if (!kw) applyServerSortOptions(res);
    const newFeeds = extractTopicRows(res);
    
    if (newFeeds.length === 0) {
      noMore.value = true;
    } else {
      const existingKeys = new Set(topicFeeds.value.map((item, index) => topicItemKey(item, index)));
      const itemsToAdd = isLoadMore
        ? newFeeds.filter((item, index) => {
          const key = topicItemKey(item, index);
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        })
        : newFeeds;
      if (isLoadMore) {
        topicFeeds.value.push(...itemsToAdd);
      } else {
        topicFeeds.value = itemsToAdd;
        const firstFeed = itemsToAdd.find((item) => isTopicFeedItem(item));
        if (firstFeed) {
          emit('select-feed', firstFeed);
        }
      }
      page.value++;
      if (itemsToAdd.length === 0) noMore.value = true;
    }
  } catch (err) {
    if (requestId === feedRequestId) console.warn('获取话题动态失败', err);
  } finally {
    if (requestId === feedRequestId) feedsLoading.value = false;
  }
}

function handleTopicSearch(payload: { keyword: string }) {
  const keyword = payload.keyword.trim();
  if (!FEED_SEARCH_SORT_OPTIONS.some((option) => option.key === currentSort.value)) {
    currentSort.value = 'default';
  }
  searchKeyword.value = keyword;
  if (!keyword) searchFeedType.value = 'all';
  page.value = 1;
  noMore.value = false;
  topicFeeds.value = [];
  void fetchFeeds(false);
}

function handleTopicClear() {
  searchKeyword.value = '';
  currentSort.value = 'default';
  searchFeedType.value = 'all';
  page.value = 1;
  noMore.value = false;
  topicFeeds.value = [];
  void fetchFeeds(false);
}

function handleTopicFeedTypeChange(feedType: string) {
  searchFeedType.value = feedType;
  if (!searchKeyword.value.trim()) return;
  page.value = 1;
  noMore.value = false;
  topicFeeds.value = [];
  void fetchFeeds(false);
}


function changeSort(sortKey: string) {
  currentSort.value = sortKey;
  page.value = 1;
  noMore.value = false;
  topicFeeds.value = [];
  void fetchFeeds(false);
}

function changeTopicTab(tabKey: string) {
  if (activeTopicTabKey.value === tabKey) return;
  activeTopicTabKey.value = tabKey;
  currentSort.value = 'default';
  searchFeedType.value = 'all';
  sortOptions.value = [...FALLBACK_SORT_OPTIONS];
  page.value = 1;
  noMore.value = false;
  topicFeeds.value = [];
  void fetchFeeds(false);
}

const pageContainerRef = ref<HTMLElement | null>(null);
let savedScrollTop = 0;

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  savedScrollTop = target.scrollTop;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 300) {
    if (!feedsLoading.value && !noMore.value) {
      fetchFeeds(true);
    }
  }
}

onActivated(() => {
  if (pageContainerRef.value && savedScrollTop > 0) {
    nextTick(() => {
      if (pageContainerRef.value) {
        pageContainerRef.value.scrollTop = savedScrollTop;
      }
    });
  }
});

async function toggleFollow() {
  if (followPending.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const target = !isFollowed.value;
  const previous = isFollowed.value;
  isFollowed.value = target;
  followPending.value = true;
  try {
    if (target) {
      await CoolapkTauriAPI.followTag(tag.value);
    } else {
      await CoolapkTauriAPI.unfollowTag(tag.value);
    }
    if (topicDetail.value) {
      const userAction = topicDetail.value.userAction || topicDetail.value.user_action || {};
      topicDetail.value = { ...topicDetail.value, userAction: { ...userAction, follow: target ? 1 : 0 } };
    }
  } catch (err) {
    isFollowed.value = previous;
    console.warn(target ? '关注话题失败' : '取消关注失败', err);
    showToast(target ? '关注话题失败' : '取消关注失败', 'error');
  } finally {
    followPending.value = false;
  }
}

function focusSearch() {
  const kw = searchKeyword.value.trim();
  if (!tag.value) return;
  const query: Record<string, string> = {
    tab: 'feed',
    pageType: 'tag',
    pageParam: tag.value,
  };
  if (kw) query.q = kw;
  void router.push({ path: '/search', query });
}

async function initializeTopic() {
  await fetchTopicHeader();
  await fetchFeeds(false);
}

onMounted(() => {
  void initializeTopic();
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.page-container.is-embedded {
  padding: 8px 12px;
}

/* 1. 话题 Header */
.topic-header-card {
  background-color: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.topic-icon-wrapper {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background-color: var(--background);
}

.topic-icon-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.25));
  font-size: 26px;
  font-weight: bold;
  color: var(--brand-primary);
}

.topic-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topic-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.topic-stats-text {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  opacity: 0.5;
}

.btn-follow {
  padding: 6px 18px;
  border-radius: 18px;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-follow.followed {
  background: var(--background-secondary);
  color: var(--text-secondary);
}

.btn-follow:disabled {
  opacity: 0.65;
  cursor: wait;
}

.topic-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  background-color: var(--background);
  padding: 10px 12px;
  border-radius: 8px;
}

.topic-sub-link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--background-secondary, #f8fafc);
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.sub-link-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-badge {
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 600;
}

.sub-title {
  font-weight: 600;
  color: var(--text-primary);
}

.arrow-icon {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 2. Sub-Tabs 分类栏 */
.topic-sub-tabs {
  display: flex;
  align-items: center;
  gap: 20px;
  background-color: var(--surface);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  border-radius: var(--radius-card, 12px);
  padding: 0 16px;
  height: 48px;
  min-height: 48px;
  flex: 0 0 48px;
  position: sticky;
  top: 0;
  z-index: 20;
  overflow-x: auto;
  user-select: none;
  scrollbar-width: none;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.04));
  box-sizing: border-box;
}

.topic-sub-tabs::-webkit-scrollbar {
  display: none;
}

.topic-tab-item {
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0 4px;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.topic-tab-item:hover {
  color: var(--text-primary);
}

.topic-tab-item.active {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 16px;
}

.tab-line {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 3.5px;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
}

/* 3. 优惠券 Banner */
.coupon-live-banner {
  background: #fdf2f8;
  border: 1px solid #fbcfe8;
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  color: #be185d;
  font-size: 13px;
}

.highlight {
  color: #db2777;
  font-weight: 700;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.feed-list :deep(.feed-card) {
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.feed-list :deep(.feed-card.is-active-feed) {
  border-color: var(--brand-primary, #10b981) !important;
  box-shadow: 0 0 0 1.5px var(--brand-primary, #10b981), 0 4px 14px rgba(16, 185, 129, 0.12) !important;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}
</style>
