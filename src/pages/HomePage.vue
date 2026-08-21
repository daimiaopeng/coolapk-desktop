<template>
  <div class="home-page-layout">
    <div class="main-feed-column">
      <div class="feed-toolbar-row">
        <FeedTabs
          v-model:active-key="activeTab"
          :tabs="orderedDynamicTabs"
          @tab-order-updated="handleTabOrderUpdated"
        />
        <FeedLayoutToggle v-model="feedLayout" />
      </div>

      <div ref="feedScrollContainer" class="feed-scroll-container custom-scrollbar" @scroll="handleScroll">
        <!-- 1. 头条 Tab 专属：服务端要闻与动态子栏目 -->
        <div v-if="isHeadlineTab" class="headline-header-section">
          <!-- APK ConfigPage.rawEntities 动态下发的头条子栏目 -->
          <div v-if="headlineSubChannels.length" class="quick-icons-grid">
            <button
              v-for="channel in headlineSubChannels"
              :key="channel.key"
              type="button"
              :class="['icon-btn-item', { selected: selectedHeadlineSubChannelUrl === channel.url }]"
              @click="openHeadlineSubChannel(channel)"
            >
              <span class="icon-circle">
                <AppImage
                  v-if="channel.logo && !failedHeadlineSubChannelLogos.has(channel.key)"
                  :src="channel.logo"
                  fit="contain"
                  image-class="headline-sub-channel-logo"
                  @error="markHeadlineSubChannelLogoFailed(channel.key)"
                />
                <i v-else :class="channel.icon"></i>
              </span>
              <span>{{ channel.title }}</span>
            </button>
          </div>
          <div v-if="headlineNestedSubChannels.length" class="headline-nested-tabs" role="tablist" aria-label="头条子栏目">
            <button
              v-for="channel in headlineNestedSubChannels"
              :key="channel.key"
              type="button"
              :class="['headline-nested-tab', { active: selectedHeadlineNestedSubChannelUrl === channel.url }]"
              @click="openHeadlineNestedSubChannel(channel)"
            >
              {{ channel.title }}
            </button>
          </div>
        </div>

        <!-- 2. 热榜 Tab 专属：周榜/月榜 + 热门搜索词 + 排序名次 -->
        <div v-if="isHotTab" class="hot-header-section">
          <!-- 5 大榜单金刚组 -->
          <div class="hot-ranks-row">
            <button
              v-for="rank in hotRanks"
              :key="rank.key"
              type="button"
              :class="['rank-action-item', { active: activeHotRank === rank.key }]"
              @click="selectHotRank(rank.key)"
            >
              <span :class="['rank-icon-bg', rank.color]"><i :class="rank.icon"></i></span>
              <span>{{ rank.label }}</span>
            </button>
          </div>

          <!-- 热门搜索词 Chips 胶囊标签 -->
          <div v-if="hotKeywords.length" class="hot-search-chips custom-scrollbar">
            <button
              v-for="(kw, idx) in hotKeywords"
              :key="idx"
              class="chip-btn"
              @click="quickSearch(kw)"
            >
              {{ kw }}
            </button>
          </div>
        </div>

        <!-- 3. 快讯 Tab 专属：酷安快讯 Banner -->
        <div v-if="isNewsTab" class="express-banner">
          <div class="express-banner-content">
            <div class="banner-title"><i class="fas fa-bolt"></i> 酷安快讯</div>
            <div class="banner-sub">每日科技新鲜事 · 7x24小时不间断更新</div>
          </div>
        </div>

        <!-- 看看号 Tab 专属：看看号卡片网格 -->
        <div v-if="isDyhTab && loading && feeds.length === 0" class="skeleton-padding">
          <FeedSkeleton :count="4" />
        </div>

        <div v-else-if="isDyhTab && feeds.length === 0 && !loading" class="empty-padding">
          <EmptyState title="暂无看看号" />
        </div>

        <div v-if="isDyhTab && !loading" class="dyh-tab-grid">
          <div
            v-for="item in feeds"
            :key="item.id"
            class="dyh-tab-card"
            @click="openDyh(item.id)"
          >
            <AppImage v-if="item.logo" :src="item.logo" fit="cover" image-class="dyh-tab-logo" />
            <div v-else class="dyh-tab-logo-fallback"><i class="fas fa-building-columns"></i></div>
            <div class="dyh-tab-info">
              <strong class="dyh-tab-name">{{ item.title || item.dyhName }}</strong>
              <span class="dyh-tab-desc">{{ item.description }}</span>
              <span class="dyh-tab-follow"><i class="fas fa-user-plus"></i> {{ formatDyhCount(item.follownum) }} 关注</span>
            </div>
            <i class="fas fa-chevron-right dyh-tab-arrow"></i>
          </div>
          <div v-if="loadingMore" class="loading-more">
            <LoadingState text="加载更多看看号..." />
          </div>
          <div v-else-if="noMore && feeds.length > 0" class="dyh-tab-no-more">没有更多看看号了</div>
        </div>

        <!-- 动态列表与 Loading/Error/Empty 状态 -->
        <div v-if="!isDyhTab && loading && feeds.length === 0" class="skeleton-padding">
          <FeedSkeleton :count="4" />
        </div>

        <div v-else-if="!isDyhTab && error && feeds.length === 0" class="error-padding">
          <ErrorState title="加载动态失败" :message="error" @retry="loadFeeds(true)" />
        </div>

        <div
          v-else-if="!isDyhTab && selectedHeadlineSubChannelUrl && headlineUserItems.length"
          class="headline-ranking-list"
          :style="{ '--headline-ranking-rows': headlineRankingRows }"
        >
          <article
            v-for="(item, index) in headlineUserItems"
            :key="item.uid || item.entityId || item.id || index"
            :class="['headline-ranking-card', { 'is-top-three': index < 3, [`rank-${index + 1}`]: index < 3 }]"
            role="button"
            tabindex="0"
            @click="openHeadlineUser(item)"
            @keydown.enter="openHeadlineUser(item)"
          >
            <div class="headline-rank-number">{{ index + 1 }}</div>
            <AppAvatar
              :src="item.userAvatar || item.userInfo?.userAvatar || item.avatar"
              size="lg"
              class="headline-ranking-avatar"
            />
            <div class="headline-ranking-info">
              <div class="headline-ranking-name-row">
                <strong>{{ getHeadlineUserName(item) }}</strong>
                <span v-if="getHeadlineUserVerify(item)" class="headline-ranking-verify">
                  <i class="fas fa-certificate"></i>{{ getHeadlineUserVerify(item) }}
                </span>
              </div>
              <div class="headline-ranking-tags">
                <span v-if="item.level" class="headline-ranking-level">Lv.{{ item.level }}</span>
                <span v-if="index < 3" class="headline-ranking-top-label">{{ index === 0 ? '榜首' : 'TOP ' + (index + 1) }}</span>
              </div>
              <div class="headline-ranking-stats">
                <span><i class="fas fa-users"></i> 粉丝 {{ formatDyhCount(item.fans || item.fansNum) }}</span>
                <span><i class="fas fa-user-plus"></i> 关注 {{ formatDyhCount(item.follow || item.followNum) }}</span>
              </div>
            </div>
            <i class="fas fa-chevron-right headline-ranking-arrow"></i>
          </article>
        </div>

        <div v-else-if="!isDyhTab && selectedHeadlineSubChannelUrl && headlineDiscoveryItems.length" class="headline-discovery-list">
          <DiscoveryEntityCard
            v-for="(item, index) in headlineDiscoveryItems"
            :key="item.entityId || item.id || item.url || index"
            :entity="item"
          />
        </div>

        <div v-else-if="!isDyhTab && feeds.length === 0" class="empty-padding">
          <EmptyState title="暂无动态内容" />
        </div>

        <div v-else-if="!isDyhTab" :class="['feed-list-padding', { 'is-double-column': isDoubleColumn }]">
          <template v-if="isDoubleColumn">
            <FeedCard
              v-for="entry in feedEntries"
              :key="entry.item.id || entry.index"
              :feed="entry.item"
              :rank-index="isHotTab ? entry.index + 1 : undefined"
              :class="{ 'feed-card-focused': entry.index === navIndex }"
              :ref="(el) => setCardRef(el, entry.index)"
              @deleted="handleFeedDeleted"
            />
          </template>
          <FeedCard
            v-else
            v-for="(item, idx) in feeds"
            :key="item.id || idx"
            :feed="item"
            :rank-index="isHotTab ? idx + 1 : undefined"
            :class="{ 'feed-card-focused': idx === navIndex }"
            :ref="(el) => setCardRef(el, idx)"
            @deleted="handleFeedDeleted"
          />

          <div v-if="loadingMore" class="loading-more">
            <LoadingState text="加载更多动态..." />
          </div>
        </div>
      </div>
    </div>

    <RightSidebar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FeedTabs from '../components/feed/FeedTabs.vue';
import FeedLayoutToggle from '../components/feed/FeedLayoutToggle.vue';
import FeedCard from '../components/feed/FeedCard.vue';
import DiscoveryEntityCard from '../components/discovery/DiscoveryEntityCard.vue';
import FeedSkeleton from '../components/feed/FeedSkeleton.vue';
import RightSidebar from '../components/layout/RightSidebar.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import AppAvatar from '../components/common/AppAvatar.vue';
import AppImage from '../components/common/AppImage.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useSettingsStore } from '../stores/settings';
import { hasFeedRenderableContent, shouldHideFeed } from '../utils/feedFilter';
import { DEFAULT_HOME_TAB_ORDER } from '../stores/settings';
import type { FeedLayout, ConfigPageTab } from '../types/settings';

const settingsStore = useSettingsStore();

const feedLayout = computed<FeedLayout>({
  get: () => settingsStore.settings.feedLayout,
  set: (value) => { settingsStore.settings.feedLayout = value; },
});
const feedEntries = computed(() => feeds.value.map((item, index) => ({ item, index })));

const route = useRoute();
const router = useRouter();
const activeTab = ref('');
let isInitializingHome = true;
const page = ref(1);
const feeds = ref<any[]>([]);
const feedScrollContainer = ref<HTMLElement | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const error = ref('');
const headlineCursor = reactive({ firstItem: '', lastItem: '' });
const headlinePageContext = ref('');
const headlineResolvedUrl = ref('');
const selectedHeadlineSubChannelUrl = ref('');
const failedHeadlineSubChannelLogos = reactive(new Set<string>());
const headlineQuickLinks = ref<any[]>([]);
const headlineDiscoveryItems = ref<any[]>([]);
const headlineUserItems = ref<any[]>([]);
const headlineNestedSubChannels = ref<Array<{ key: string; title: string; url: string }>>([]);
const selectedHeadlineNestedSubChannelUrl = ref('');
const headlineRankingRows = computed(() => Math.max(1, Math.ceil(headlineUserItems.value.length / 2)));

// 动态服务端下发的 Tab 列表（完全对齐 APK ConfigPage 结构）
const serverTabs = ref<ConfigPageTab[]>([]);

const orderedDynamicTabs = computed<ConfigPageTab[]>(() => {
  const source = serverTabs.value;
  if (!source.length) return [];
  const order = settingsStore.settings.homeTabOrder || [];
  if (!order.length) return source;
  
  const visibleSource = source.filter(tab => {
    const key = tab.page_name || tab.url || String(tab.id || tab.title);
    return !order.includes(`__hidden__${key}`);
  });

  return [...visibleSource].sort((a, b) => {
    const aKey = a.page_name || a.url || String(a.id || a.title);
    const bKey = b.page_name || b.url || String(b.id || b.title);
    const aIndex = order.indexOf(aKey);
    const bIndex = order.indexOf(bKey);
    return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex);
  });
});

const currentActiveTabObj = computed<ConfigPageTab | undefined>(() => {
  return orderedDynamicTabs.value.find(
    t => (t.page_name || t.url || String(t.id || t.title)) === activeTab.value
  );
});

// 动态判断当前 Tab 呈现形态（根据服务端 page_name 或 url 路由）
const isHeadlineTab = computed(() => {
  const t = currentActiveTabObj.value;
  if (!t) return activeTab.value === 'digest' || activeTab.value === 'V9_HOME_TAB_HEADLINE' || activeTab.value === '/main/headline';
  return t.page_name === 'V9_HOME_TAB_HEADLINE' || t.url === '/main/headline' || t.title === '头条';
});

const isHotTab = computed(() => {
  const t = currentActiveTabObj.value;
  if (!t) return activeTab.value === 'hot' || activeTab.value === 'V9_HOME_TAB_RANKING';
  return t.page_name === 'V9_HOME_TAB_RANKING' || t.url.includes('RANKING') || t.title === '热榜';
});

const isNewsTab = computed(() => {
  const t = currentActiveTabObj.value;
  if (!t) return activeTab.value === 'latest' || activeTab.value === 'V11_HOME_TAB_NEWS';
  return t.page_name === 'V11_HOME_TAB_NEWS' || t.url.includes('NEWS') || t.title === '快讯';
});

const isDyhTab = computed(() => {
  const t = currentActiveTabObj.value;
  if (!t) return activeTab.value === 'dyh';
  return t.page_name === 'dyh' || t.url === '/user/dyhSubscribe' || t.title === '看看号';
});

const isDoubleColumn = computed(() => feedLayout.value === 'double' && !isDyhTab.value);

const headlineSubChannels = computed(() => {
  const tab = currentActiveTabObj.value;
  const configuredEntities = Array.isArray(tab?.entities)
    ? tab.entities
    : Array.isArray(tab?.rawEntities)
      ? tab.rawEntities
      : Array.isArray(tab?.raw_entities)
        ? tab.raw_entities
      : [];
  const entities = headlineQuickLinks.value.length > 0
    ? headlineQuickLinks.value
    : configuredEntities;
  return entities
    .map((entity, index) => {
      const title = String(entity.title || '').trim();
      const url = String(entity.url || '').trim();
      if (!title || !url) return null;
      return {
        key: String(entity.entityId ?? entity.entity_id ?? entity.id ?? url ?? index),
        title,
        url,
        subTitle: String(entity.subTitle || '').trim(),
        logo: String(entity.logo || entity.pic || '').trim(),
        icon: resolveHeadlineSubChannelIcon(entity),
      };
    })
    .filter((channel): channel is {
      key: string;
      title: string;
      url: string;
      subTitle: string;
      logo: string;
      icon: string;
    } => Boolean(channel));
});

function updateHeadlineQuickLinks(items: any[]) {
  const card = items.find((item) =>
    item?.entityTemplate === 'iconLinkGridCard'
    || item?.entity_template === 'iconLinkGridCard'
  );
  const entities = Array.isArray(card?.entities) ? card.entities : [];
  if (entities.length > 0) {
    headlineQuickLinks.value = entities;
    failedHeadlineSubChannelLogos.clear();
  }
}

function resolveHeadlineSubChannelIcon(entity: any): string {
  const explicitIcon = String(entity.icon || '').trim();
  if (explicitIcon.startsWith('fa-')) return `fas ${explicitIcon}`;
  const value = `${entity.title || ''} ${entity.url || ''}`.toLowerCase();
  if (value.includes('ai') || value.includes('人工智能')) return 'fas fa-robot';
  if (value.includes('活动') || value.includes('gift')) return 'fas fa-gift';
  if (value.includes('摄影') || value.includes('picture') || value.includes('photo')) return 'fas fa-camera';
  if (value.includes('热') || value.includes('hot')) return 'fas fa-newspaper';
  if (value.includes('值得') || value.includes('recommend')) return 'fas fa-check-circle';
  return 'fas fa-layer-group';
}

function markHeadlineSubChannelLogoFailed(key: string) {
  failedHeadlineSubChannelLogos.add(key);
}

function updateHeadlineNestedSubChannels(items: any[]) {
  const card = items.find((item) => {
    const template = String(item?.entityTemplate || item?.entity_template || '').trim();
    return (template === 'iconTabLinkGridCard' || template === 'iconLinkGridCard')
      && Array.isArray(item?.entities)
      && item.entities.some((entity: any) => String(entity?.url || '').trim());
  });
  if (!card || !Array.isArray(card.entities)) return;

  const channels = card.entities
    .map((entity: any, index: number) => {
      const title = String(entity?.title || '').trim();
      const url = String(entity?.url || '').trim();
      if (!title || !url) return null;
      return {
        key: String(entity?.entityId ?? entity?.entity_id ?? entity?.id ?? url ?? index),
        title,
        url,
      };
    })
    .filter((channel: { key: string; title: string; url: string } | null): channel is { key: string; title: string; url: string } => Boolean(channel));

  if (channels.length > 0) {
    headlineNestedSubChannels.value = channels;
    if (!selectedHeadlineNestedSubChannelUrl.value) {
      selectedHeadlineNestedSubChannelUrl.value = channels[0].url;
    }
  }
}

// 热门搜索关键词 Chips
const hotKeywords = ref<string[]>([
  '酷安优惠券', 'ios27', '小米15', '抖音', '酷安', 'scene', '小米17', '电动车', '澎湃os4', 'shizuku'
]);

type HotRankType = 'week' | 'month' | 'favorite' | 'index' | 'picture';
const activeHotRank = ref<HotRankType>('week');
const hotRanks: { key: HotRankType; label: string; icon: string; color: string }[] = [
  { key: 'week', label: '周榜', icon: 'fas fa-thumbs-up', color: 'bg-orange' },
  { key: 'month', label: '月榜', icon: 'fas fa-calendar-alt', color: 'bg-cyan' },
  { key: 'favorite', label: '收藏榜', icon: 'fas fa-star', color: 'bg-yellow' },
  { key: 'index', label: '酷安指数', icon: 'fas fa-chart-line', color: 'bg-purple' },
  { key: 'picture', label: '酷图榜', icon: 'fas fa-chart-bar', color: 'bg-red' },
];

function getTabKey(tab: ConfigPageTab): string {
  return tab.page_name || tab.url || String(tab.id || tab.title);
}

function isHeadlineConfigTab(tab: ConfigPageTab): boolean {
  return tab.page_name === 'V9_HOME_TAB_HEADLINE' || tab.url === '/main/headline' || tab.title === '头条';
}

function isHeadlineFeedSubChannel(url: string): boolean {
  return url.includes('/feed/digestList');
}

function isHotConfigTab(tab: ConfigPageTab): boolean {
  return tab.page_name === 'V9_HOME_TAB_RANKING' || tab.url.includes('RANKING') || tab.title === '热榜';
}

function isNewsConfigTab(tab: ConfigPageTab): boolean {
  return tab.page_name === 'V11_HOME_TAB_NEWS' || tab.url.includes('NEWS') || tab.title === '快讯';
}

function resolveInitialTab(): string {
  const tabs = orderedDynamicTabs.value;
  const preferred = settingsStore.settings.defaultHomeTab;
  const exact = tabs.find((tab) => getTabKey(tab) === preferred);
  if (exact) return getTabKey(exact);

  const semanticTab = preferred === 'hot'
    ? tabs.find(isHotConfigTab)
    : preferred === 'latest'
      ? tabs.find(isNewsConfigTab)
      : tabs.find(isHeadlineConfigTab);
  if (semanticTab) return getTabKey(semanticTab);

  return tabs[0] ? getTabKey(tabs[0]) : 'V9_HOME_TAB_HEADLINE';
}

function syncTabFromRoute() {
  if (route.path === '/') {
    activeTab.value = resolveInitialTab();
  }
}

function getFeedEntityId(item: any): string {
  return String(item?.entityId ?? item?.entity_id ?? item?.id ?? '').trim();
}

function resetHeadlineCursor(options: { preserveNested?: boolean } = {}) {
  const preserveNested = options.preserveNested === true;
  headlineCursor.firstItem = '';
  headlineCursor.lastItem = '';
  headlinePageContext.value = '';
  if (!preserveNested) headlineResolvedUrl.value = '';
  headlineDiscoveryItems.value = [];
  headlineUserItems.value = [];
  if (!preserveNested) {
    headlineNestedSubChannels.value = [];
    selectedHeadlineNestedSubChannelUrl.value = '';
  }
}

function extractHeadlineUserItems(items: any[]): any[] {
  const users: any[] = [];
  const addUser = (item: any) => {
    const type = String(item?.entityType || item?.entity_type || item?.type || '').toLowerCase();
    // 动态实体也会带 uid；只有服务端明确标记为 user 的实体才进入排行榜，
    // 否则“值得看/热闻”等动态栏目会被误渲染成作者排行榜。
    if (!type.includes('user')) return;
    const uid = String(item?.uid || item?.userId || item?.user_id || '').trim();
    if (!item) return;
    if (!uid && !item.username) return;
    const sourceUrl = String(item.url || '').trim();
    const userUrl = /^#?\/u\/(\d+)/i.test(sourceUrl)
      ? `#/user/${sourceUrl.match(/^#?\/u\/(\d+)/i)?.[1]}`
      : sourceUrl || (uid ? `#/user/${encodeURIComponent(uid)}` : '');
    users.push({
      ...item,
      uid: uid || item.uid,
      url: userUrl,
    });
  };

  for (const item of items) {
    addUser(item);
    if (Array.isArray(item?.entities)) {
      for (const child of item.entities) addUser(child);
    }
  }
  return users;
}

function updateHeadlineCursor(items: any[]) {
  const ids = items.map(getFeedEntityId).filter(Boolean);
  if (!ids.length) return;
  if (!headlineCursor.firstItem) headlineCursor.firstItem = ids[0];
  headlineCursor.lastItem = ids[ids.length - 1];
  const lastItem = items[items.length - 1];
  headlinePageContext.value = String(
    lastItem?.pageContext
      ?? lastItem?.page_context
      ?? lastItem?.extraData?.pageContext
      ?? lastItem?.extra_data?.pageContext
      ?? ''
  ).trim();
}

function normalizeHeadlinePageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith('/page?url=')) return trimmed;
  const encodedAction = trimmed.slice('/page?url='.length).split('&')[0];
  try {
    return decodeURIComponent(encodedAction);
  } catch {
    return encodedAction;
  }
}

function findDefaultHeadlineSubPage(items: any[]): string {
  const card = items.find((item) => {
    const template = String(item?.entityTemplate || item?.entity_template || '');
    return (template === 'iconTabLinkGridCard' || template === 'iconLinkGridCard')
      && Array.isArray(item?.entities)
      && item.entities.some((entity: any) => String(entity?.url || '').trim());
  });
  if (!card) return '';
  const entities = card.entities as any[];
  const preferred = entities.find((entity) => String(entity?.title || '').trim() === '全部')
    || entities.find((entity) => String(entity?.url || '').trim());
  return String(preferred?.url || '').trim();
}

async function getHeadlineSubChannelData(
  url: string,
  title: string,
  subTitle: string,
  page: number,
) {
  if (headlineResolvedUrl.value) {
    return await CoolapkTauriAPI.getDiscoveryPageData({
      url: headlineResolvedUrl.value,
      title,
      subTitle,
      page,
      firstItem: headlineCursor.firstItem,
      lastItem: headlineCursor.lastItem,
      pageContext: headlinePageContext.value,
    });
  }

  let currentUrl = normalizeHeadlinePageUrl(url);
  const visited = new Set<string>();
  for (let depth = 0; depth < 4; depth += 1) {
    if (!currentUrl || visited.has(currentUrl)) break;
    visited.add(currentUrl);
    const response: any = await CoolapkTauriAPI.getDiscoveryPageData({
      url: currentUrl,
      title,
      subTitle,
      page,
      firstItem: headlineCursor.firstItem,
      lastItem: headlineCursor.lastItem,
      pageContext: headlinePageContext.value,
    });
    const items = Array.isArray(response?.data) ? response.data : [];
    if (page === 1) updateHeadlineNestedSubChannels(items);
    const nextUrl = page === 1 ? findDefaultHeadlineSubPage(items) : '';
    if (!nextUrl) {
      headlineResolvedUrl.value = currentUrl;
      return response;
    }
    currentUrl = normalizeHeadlinePageUrl(nextUrl);
  }

  headlineResolvedUrl.value = currentUrl;
  return await CoolapkTauriAPI.getDiscoveryPageData({
    url: currentUrl,
    title,
    subTitle,
    page,
    firstItem: headlineCursor.firstItem,
    lastItem: headlineCursor.lastItem,
    pageContext: headlinePageContext.value,
  });
}

const prefetchBuffer = ref<any[]>([]);
const prefetchPage = ref(2);
const isPrefetching = ref(false);

/** 动态从 GET /v6/main/init 获取全量 Tab 配置（完全对齐 APK dt8.m45234 / Card 2） */
async function fetchTabConfig() {
  try {
    const res: any = await CoolapkTauriAPI.getTabConfig();
    const data = res?.data || [];
    // 官方 Card 2 首页配置实体（entityId: 6390 / entityTemplate: configCard / title: 首页）
    const configCard = data.find(
      (item: any) => item.entityId === '6390' || (item.entityTemplate === 'configCard' && (item.title === '首页' || (item.title || '').includes('TAB配置')))
    );

    if (configCard && configCard.entities && Array.isArray(configCard.entities)) {
      serverTabs.value = configCard.entities;
      
    }
  } catch (err) {
    console.warn('获取 Tab 配置失败', err);
  }
}

/** 动态依据 Tab 的 url / page_name 请求数据流 */
async function fetchTabApi(tabKey: string, p: number) {
  const matchedTab = orderedDynamicTabs.value.find(
    t => (t.page_name || t.url || String(t.id || t.title)) === tabKey
  );

  if (matchedTab ? isHeadlineConfigTab(matchedTab) : tabKey === 'digest' || tabKey === 'V9_HOME_TAB_HEADLINE' || tabKey === '/main/headline') {
    const selectedSubChannel = headlineSubChannels.value.find(
      channel => channel.url === selectedHeadlineSubChannelUrl.value
    );
    if (selectedSubChannel) {
      const selectedUrl = selectedSubChannel.url.trim();
      if (selectedUrl.startsWith('/t/')) {
        const tag = decodeURIComponent(selectedUrl.slice(3).split('?')[0]).trim();
        if (tag) {
          return await CoolapkTauriAPI.getTopicFeeds(tag, p);
        }
      }
      // 投票入口直接指向 feed/digestList；APK 返回的是带 vote.options 的动态列表，
      // 不经过 discovery page 的卡片解析，否则会被误识别成普通排行榜实体。
      if (isHeadlineFeedSubChannel(selectedUrl)) {
        return await CoolapkTauriAPI.getBoardFeeds(selectedUrl, p);
      }
      return await getHeadlineSubChannelData(
        selectedUrl,
        selectedSubChannel.title,
        selectedSubChannel.subTitle,
        p,
      );
    }
    return await CoolapkTauriAPI.getIndexV8EntitiesPaged({
      page: p,
      firstItem: headlineCursor.firstItem,
      lastItem: headlineCursor.lastItem,
    });
  }

  const targetUrl = matchedTab ? (matchedTab.url || matchedTab.page_name || '') : tabKey;

  // 1. 如果匹配到具体 URL，调用通用板块/页面数据流
  if (targetUrl) {
    return await CoolapkTauriAPI.getBoardFeeds(targetUrl, p);
  }

  // 2. 默认保底请求
  return await CoolapkTauriAPI.getHeadlineFeeds(p);
}

async function prefetchNextPage() {
  if (isHeadlineTab.value || isPrefetching.value || noMore.value) return;
  isPrefetching.value = true;
  try {
    const nextP = page.value;
    const res: any = await fetchTabApi(activeTab.value, nextP);
    if (res && res.data && Array.isArray(res.data)) {
      const validItems = res.data.filter((item: any) => hasFeedRenderableContent(item) && !shouldHideFeed(item, settingsStore.settings));
      if (validItems.length > 0) {
        prefetchBuffer.value = validItems;
        prefetchPage.value = nextP + 1;
      }
    }
  } catch (e) {
    console.warn('首页静默预取下一页异常:', e);
  } finally {
    isPrefetching.value = false;
  }
}

async function loadFeeds(isRefresh: boolean = false) {
  if (loading.value || (loadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    feeds.value = [];
    prefetchBuffer.value = [];
    if (isHeadlineTab.value) resetHeadlineCursor({ preserveNested: Boolean(selectedHeadlineNestedSubChannelUrl.value) });
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  error.value = '';

  try {
    let validItems: any[] = [];
    let rawItems: any[] = [];

    if (!isRefresh && !isHeadlineTab.value && prefetchBuffer.value.length > 0) {
      validItems = prefetchBuffer.value;
      prefetchBuffer.value = [];
      page.value = prefetchPage.value;
    } else {
      const res: any = await fetchTabApi(activeTab.value, page.value);
      if (res && res.data && Array.isArray(res.data)) {
        rawItems = res.data;
        if (isHeadlineTab.value) updateHeadlineQuickLinks(rawItems);
        validItems = rawItems.filter((item: any) => hasFeedRenderableContent(item) && !shouldHideFeed(item, settingsStore.settings));
        if (
          isHeadlineTab.value
          && selectedHeadlineSubChannelUrl.value
          && !isHeadlineFeedSubChannel(selectedHeadlineSubChannelUrl.value)
        ) {
          const incomingUsers = extractHeadlineUserItems(rawItems);
          const incomingDiscoveryItems = rawItems.filter((item: any) => {
            const template = String(item?.entityTemplate || item?.entity_template || '').trim();
            const entityType = String(item?.entityType || item?.entity_type || '').toLowerCase();
            return template && template !== 'configCard' && !entityType.includes('user');
          });
          if (isRefresh) {
            headlineUserItems.value = incomingUsers;
            headlineDiscoveryItems.value = incomingDiscoveryItems;
          } else {
            const existingUsers = new Set(headlineUserItems.value.map((item) => String(item.uid || item.entityId || item.id)));
            headlineUserItems.value.push(...incomingUsers.filter((item) => !existingUsers.has(String(item.uid || item.entityId || item.id))));
            const existingDiscovery = new Set(headlineDiscoveryItems.value.map((item) => String(item.entityId || item.id || item.url)));
            headlineDiscoveryItems.value.push(...incomingDiscoveryItems.filter((item) => !existingDiscovery.has(String(item.entityId || item.id || item.url))));
          }
        }
      }
      page.value++;
    }

    if (isHeadlineTab.value) {
      if (rawItems.length === 0) noMore.value = true;
      else updateHeadlineCursor(validItems);
    } else if (validItems.length < 3) {
      noMore.value = true;
    }

    const extractedKw = validItems
      .map((item: any) => item.deviceTitle || item.targetType)
      .filter(Boolean);
    if (extractedKw.length > 0) {
      const uniqueKw = Array.from(new Set([...hotKeywords.value, ...extractedKw]));
      hotKeywords.value = uniqueKw.slice(0, 12);
    }

    if (isRefresh) {
      feeds.value = validItems;
    } else {
      const existingIds = new Set(feeds.value.map(i => i.id));
      const uniqueNew = validItems.filter(i => !existingIds.has(i.id));
      feeds.value.push(...uniqueNew);
    }

    if (settingsStore.settings.infiniteScroll && !isHeadlineTab.value) {
      setTimeout(() => {
        prefetchNextPage();
      }, 200);
    }

  } catch (err: any) {
    error.value = err?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function handleScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  if (!settingsStore.settings.infiniteScroll) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 250) {
    if (!loading.value && !loadingMore.value && !noMore.value) {
      loadFeeds(false);
    }
  }
}

function resetFeedScroll() {
  if (!feedScrollContainer.value) return;
  feedScrollContainer.value.scrollTop = 0;
  feedScrollContainer.value.scrollLeft = 0;
}

function quickSearch(kw: string) {
  router.push({ path: '/search', query: { q: kw } });
}

function selectHotRank(rankType: HotRankType) {
  if (activeHotRank.value === rankType) {
    void loadFeeds(true);
    return;
  }
  activeHotRank.value = rankType;
}

function handleTabOrderUpdated() {
  serverTabs.value = [...serverTabs.value];
}

function openHeadlineSubChannel(channel: { title: string; url: string; subTitle: string }) {
  const url = channel.url.trim();
  if (!url) return;
  if (/^https?:\/\//i.test(url)) {
    void CoolapkTauriAPI.openUrl(url, settingsStore.settings.externalLinkMode);
    return;
  }
  selectedHeadlineSubChannelUrl.value = url;
  resetHeadlineCursor();
  void loadFeeds(true);
}

function openHeadlineNestedSubChannel(channel: { title: string; url: string }) {
  const url = channel.url.trim();
  if (!url) return;
  selectedHeadlineNestedSubChannelUrl.value = url;
  headlineResolvedUrl.value = normalizeHeadlinePageUrl(url);
  headlineCursor.firstItem = '';
  headlineCursor.lastItem = '';
  headlinePageContext.value = '';
  headlineDiscoveryItems.value = [];
  headlineUserItems.value = [];
  feeds.value = [];
  page.value = 1;
  noMore.value = false;
  void loadFeeds(true);
}

function getHeadlineUserName(item: any): string {
  return String(item?.displayUsername || item?.username || item?.userInfo?.username || '酷友').trim();
}

function getHeadlineUserVerify(item: any): string {
  const label = String(item?.verify_label || item?.verify_title || '').trim();
  return label.replace(/^酷安认证[:：]\s*/, '');
}

function openHeadlineUser(item: any) {
  const uid = String(item?.uid || item?.entityId || '').trim();
  if (uid) void router.push(`/user/${encodeURIComponent(uid)}`);
}

watch(activeTab, (nextTab, previousTab) => {
  if (nextTab !== previousTab) selectedHeadlineSubChannelUrl.value = '';
  if (isInitializingHome) return;
  resetFeedScroll();
  loadFeeds(true);
});

watch(activeHotRank, () => {
  if (isHotTab.value) loadFeeds(true);
});

const navIndex = ref(-1);
const cardEls: (HTMLElement | null)[] = [];

function setCardRef(el: unknown, idx: number) {
  cardEls[idx] = (el as HTMLElement | null) || null;
}

function handleFeedNav(delta: number) {
  if (feeds.value.length === 0) return;
  let next = navIndex.value + delta;
  if (next < 0) next = 0;
  if (next >= feeds.value.length) next = feeds.value.length - 1;
  if (next === navIndex.value && delta > 0) return;
  navIndex.value = next;
  const el = cardEls[next];
  if (el) {
    el.scrollIntoView({ behavior: settingsStore.settings.reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }
}

const onNavNext = () => handleFeedNav(1);
const onNavPrev = () => handleFeedNav(-1);
const onRefreshFeeds = () => {
  if (!loading.value && !loadingMore.value) loadFeeds(true);
};

function handleFeedDeleted(id: string | number) {
  feeds.value = feeds.value.filter((f: any) => String(f.id) !== String(id));
}

function formatDyhCount(n: any): string {
  const num = Number(n) || 0;
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  return String(num);
}

function openDyh(dyhId: any) {
  if (dyhId) router.push(`/dyh/${String(dyhId)}`);
}

async function initializeHome() {
  await fetchTabConfig();
  syncTabFromRoute();
  isInitializingHome = false;
  await loadFeeds(true);
}

onMounted(() => {
  void initializeHome();
  window.addEventListener('feed-nav-next', onNavNext);
  window.addEventListener('feed-nav-prev', onNavPrev);
  window.addEventListener('refresh-feeds', onRefreshFeeds);
});

onUnmounted(() => {
  window.removeEventListener('feed-nav-next', onNavNext);
  window.removeEventListener('feed-nav-prev', onNavPrev);
  window.removeEventListener('refresh-feeds', onRefreshFeeds);
});
</script>

<style scoped>
.home-page-layout {
  container-type: inline-size;
  container-name: layout;
  display: flex;
  width: 100%;
  height: 100%;
  gap: 0;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
}

@container layout (max-width: 960px) {
  :deep(.right-sidebar) {
    display: none !important;
  }
}

.main-feed-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.feed-toolbar-row {
  display: flex;
  align-items: stretch;
  flex: 0 0 auto;
  min-width: 0;
  background: var(--surface);
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
}

.feed-toolbar-row :deep(.feed-tabs) {
  flex: 1 1 auto;
  min-width: 0;
  border-bottom: 0;
}

.feed-scroll-container {
  flex: 1;
  overflow-y: auto;
  background-color: var(--background-secondary);
}

/* 1. 头条 Tab 头部样式 */
.headline-header-section {
  padding: 14px 16px 4px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--surface, #fff);
  border-bottom: 1px solid var(--border);
}

.quick-icons-grid {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  padding: 4px 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.quick-icons-grid::-webkit-scrollbar {
  display: none;
}

.headline-nested-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border-light, rgba(0, 0, 0, .06));
  scrollbar-width: none;
}

.headline-nested-tabs::-webkit-scrollbar {
  display: none;
}

.headline-nested-tab {
  position: relative;
  flex: 0 0 auto;
  border: 0;
  border-radius: 8px;
  padding: 7px 14px 9px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: color .15s ease, background-color .15s ease;
}

.headline-nested-tab:hover {
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, .08));
}

.headline-nested-tab.active {
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, .1));
  font-weight: 700;
}

.icon-btn-item {
  border: 0;
  background: transparent;
  font: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 0 0 88px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
}

.icon-circle {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--text-secondary);
  transition: transform 0.2s ease;
}

.headline-sub-channel-logo {
  width: 48px;
  height: 48px;
  border-radius: 6px;
}

.icon-btn-item:hover .icon-circle {
  transform: translateY(-2px);
}

.icon-btn-item.selected {
  color: var(--primary);
}

.headline-discovery-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px;
}

.headline-ranking-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(var(--headline-ranking-rows, 10), minmax(92px, auto));
  grid-auto-flow: column;
  gap: 14px;
  padding: 16px;
}

.headline-ranking-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 92px;
  padding: 14px 16px 14px 12px;
  overflow: hidden;
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: 14px;
  background: var(--surface);
  cursor: pointer;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}

.headline-ranking-card:hover,
.headline-ranking-card:focus-visible {
  border-color: var(--brand-primary, #10b981);
  box-shadow: 0 7px 20px rgba(16, 185, 129, .12);
  outline: none;
  transform: translateY(-1px);
}

.headline-ranking-card.is-top-three {
  background: linear-gradient(135deg, var(--surface) 0%, rgba(255, 249, 232, .9) 100%);
}

.headline-ranking-card.rank-2 { background: linear-gradient(135deg, var(--surface) 0%, rgba(243, 247, 251, .95) 100%); }
.headline-ranking-card.rank-3 { background: linear-gradient(135deg, var(--surface) 0%, rgba(255, 244, 235, .9) 100%); }

.headline-rank-number {
  display: grid;
  place-items: center;
  width: 28px;
  flex: 0 0 28px;
  color: var(--text-tertiary);
  font-size: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.rank-1 .headline-rank-number { color: #e5a400; font-size: 24px; }
.rank-2 .headline-rank-number { color: #8b98a5; font-size: 22px; }
.rank-3 .headline-rank-number { color: #c77b4b; font-size: 21px; }

.headline-ranking-avatar {
  flex: 0 0 auto;
}

.headline-ranking-info {
  min-width: 0;
  flex: 1;
}

.headline-ranking-name-row,
.headline-ranking-stats {
  display: flex;
  align-items: center;
  min-width: 0;
}

.headline-ranking-name-row {
  gap: 7px;
}

.headline-ranking-name-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.headline-ranking-verify {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  max-width: 180px;
  overflow: hidden;
  color: #e69a16;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.headline-ranking-tags {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.headline-ranking-level,
.headline-ranking-top-label {
  border-radius: 5px;
  padding: 2px 6px;
  font-size: 11px;
  line-height: 1.2;
}

.headline-ranking-level {
  background: var(--brand-soft, rgba(16, 185, 129, .1));
  color: var(--brand-primary, #10b981);
}

.headline-ranking-top-label {
  background: rgba(235, 174, 37, .14);
  color: #b07800;
}

.headline-ranking-stats {
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.headline-ranking-stats span {
  white-space: nowrap;
}

.headline-ranking-stats i {
  margin-right: 3px;
  color: var(--text-secondary);
}

.headline-ranking-arrow {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: 12px;
}

@container layout (max-width: 720px) {
  .headline-ranking-list {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    grid-auto-flow: row;
  }
}

/* 2. 热榜 Tab 头部样式 */
.hot-header-section {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--surface-hover, rgba(0,0,0,0.01));
  border-bottom: 1px solid var(--border);
}

.hot-ranks-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.rank-action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
}

.rank-action-item.active {
  color: var(--brand-primary);
  font-weight: 700;
  background: var(--brand-soft);
}

.rank-action-item:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
}

.rank-icon-bg {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
  transition: transform 0.2s ease;
}

.rank-action-item:hover .rank-icon-bg {
  transform: scale(1.05);
}

.bg-orange { background: linear-gradient(135deg, #f97316, #ea580c); }
.bg-cyan { background: linear-gradient(135deg, #06b6d4, #0284c7); }
.bg-yellow { background: linear-gradient(135deg, #eab308, #ca8a04); }
.bg-purple { background: linear-gradient(135deg, #a855f7, #7e22ce); }
.bg-red { background: linear-gradient(135deg, #f43f5e, #e11d48); }

.hot-search-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.chip-btn {
  padding: 4px 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.chip-btn:hover {
  background: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

/* 3. 快讯 Banner 样式 */
.express-banner {
  margin: 14px 16px 4px 16px;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  border-radius: 12px;
  padding: 16px 20px;
  color: #fff;
}

.express-banner-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-title {
  font-size: 18px;
  font-weight: 800;
}

.banner-sub {
  font-size: 12px;
  opacity: 0.85;
}

.skeleton-padding, .error-padding, .empty-padding {
  display: flex;
  flex-direction: column;
  gap: var(--feed-card-gap, 12px);
  padding: 12px;
}

.feed-list-padding {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
}

.feed-list-padding :deep(.feed-card) {
  margin-bottom: 0;
  border-right: 0;
  border-left: 0;
  border-radius: 0;
}

.feed-list-padding.is-double-column {
  display: block;
  width: 100%;
  column-count: 2;
  column-gap: 12px;
  column-fill: balance;
  padding: 12px;
}

.feed-list-padding.is-double-column :deep(.feed-card) {
  display: inline-block;
  width: 100%;
  margin-bottom: 0;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: 14px;
  overflow: hidden;
  break-inside: avoid;
}

.feed-list-padding.is-double-column > .loading-more {
  column-span: all;
}

@container layout (max-width: 760px) {
  .feed-list-padding.is-double-column {
    column-count: 1;
  }
}

.dyh-tab-grid {
  padding: var(--space-4);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.dyh-tab-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--background);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
}

.dyh-tab-card:hover {
  border-color: var(--brand-primary);
  transform: translateY(-2px);
}

.dyh-tab-logo {
  width: 44px !important;
  height: 44px !important;
  max-width: none !important;
  max-height: none !important;
  border-radius: 12px !important;
  background: var(--brand-soft) !important;
}

.dyh-tab-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: var(--brand-primary);
  background: var(--brand-soft);
  font-size: 18px;
}

.dyh-tab-info {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.dyh-tab-name {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dyh-tab-desc {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dyh-tab-follow {
  color: var(--text-secondary);
  font-size: 10px;
}

.dyh-tab-follow i {
  margin-right: 3px;
  color: var(--brand-primary);
}

.dyh-tab-arrow {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: 11px;
}

.dyh-tab-no-more {
  grid-column: 1 / -1;
  padding: 12px 0;
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
}

.feed-card-focused {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
  border-radius: var(--radius-card);
}

.loading-more {
  padding: var(--space-4) 0;
}
</style>
