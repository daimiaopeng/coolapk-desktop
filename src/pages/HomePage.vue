<template>
  <div class="home-page-layout">
    <div class="main-feed-column">
      <FeedTabs v-model:active-key="activeTab" :dynamic-tabs="orderedDynamicTabs" />

      <div class="feed-scroll-container custom-scrollbar" @scroll="handleScroll">
        <!-- 1. 头条 Tab (`digest`) 专属：今日酷安日历 & 金刚位入口 & 关照关注栏 -->
        <div v-if="activeTab === 'digest'" class="headline-header-section">
          <!-- 今日酷安日历与要闻栏 -->
          <div class="today-coolapk-card">
            <div class="calendar-badge">
              <span class="cal-top">今日酷安</span>
              <span class="cal-day">{{ todayDay }}</span>
              <span class="cal-meta">{{ todayYearMonth }} {{ todayWeek }}</span>
            </div>
            <div class="headline-bulletins">
              <div v-for="(b, idx) in topBulletins" :key="idx" class="bulletin-item" @click="handleBulletinClick(b)">
                <span class="bulletin-dot"></span>
                <span class="bulletin-text">{{ b.text }}</span>
              </div>
            </div>
          </div>

          <!-- 5 大快捷金刚图标 -->
          <div class="quick-icons-grid">
            <div class="icon-btn-item" @click="quickFilter('值得看')">
              <div class="icon-circle icon-blue"><i class="fas fa-check-circle"></i></div>
              <span>值得看</span>
            </div>
            <div class="icon-btn-item" @click="quickFilter('热闻')">
              <div class="icon-circle icon-yellow"><i class="fas fa-newspaper"></i></div>
              <span>热闻</span>
            </div>
            <div class="icon-btn-item" @click="quickFilter('活动')">
              <div class="icon-circle icon-red"><i class="fas fa-gift"></i></div>
              <span>活动</span>
            </div>
            <div class="icon-btn-item" @click="quickFilter('AI')">
              <div class="icon-circle icon-cyan"><i class="fas fa-robot"></i></div>
              <span>AI</span>
            </div>
            <div class="icon-btn-item" @click="quickFilter('摄影')">
              <div class="icon-circle icon-teal"><i class="fas fa-camera"></i></div>
              <span>人像摄影</span>
            </div>
          </div>
        </div>

        <!-- 2. 热榜 Tab (`hot`) 专属：周榜/月榜 + 热门搜索词 + 排序名次 -->
        <div v-if="activeTab === 'hot'" class="hot-header-section">
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

        <!-- 3. 快讯 Tab (`latest`) 专属：酷安快讯 Banner -->
        <div v-if="activeTab === 'latest'" class="express-banner">
          <div class="express-banner-content">
            <div class="banner-title"><i class="fas fa-bolt"></i> 酷安快讯</div>
            <div class="banner-sub">每日科技新鲜事 · 7x24小时不间断更新</div>
          </div>
        </div>

        <!-- 看看号 Tab (`dyh`) 专属：看看号卡片网格 -->
        <div v-if="activeTab === 'dyh' && loading && feeds.length === 0" class="skeleton-padding">
          <FeedSkeleton :count="4" />
        </div>

        <div v-else-if="activeTab === 'dyh' && feeds.length === 0 && !loading" class="empty-padding">
          <EmptyState title="暂无看看号" />
        </div>

        <div v-if="activeTab === 'dyh' && !loading" class="dyh-tab-grid">
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
        <div v-if="activeTab !== 'dyh' && loading && feeds.length === 0" class="skeleton-padding">
          <FeedSkeleton :count="4" />
        </div>

        <div v-else-if="activeTab !== 'dyh' && error && feeds.length === 0" class="error-padding">
          <ErrorState title="加载动态失败" :message="error" @retry="loadFeeds(true)" />
        </div>

        <div v-else-if="activeTab !== 'dyh' && feeds.length === 0" class="empty-padding">
          <EmptyState title="暂无动态内容" />
        </div>

        <div v-else-if="activeTab !== 'dyh'" class="feed-list-padding">
          <FeedCard
            v-for="(item, idx) in feeds"
            :key="item.id || idx"
            :feed="item"
            :rank-index="activeTab === 'hot' ? idx + 1 : undefined"
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FeedTabs from '../components/feed/FeedTabs.vue';
import FeedCard from '../components/feed/FeedCard.vue';
import FeedSkeleton from '../components/feed/FeedSkeleton.vue';
import RightSidebar from '../components/layout/RightSidebar.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import AppImage from '../components/common/AppImage.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useSettingsStore } from '../stores/settings';
import { shouldHideFeed } from '../utils/feedFilter';
import { DEFAULT_HOME_TAB_ORDER } from '../stores/settings';

const settingsStore = useSettingsStore();

const route = useRoute();
const router = useRouter();
const activeTab = ref(settingsStore.settings.defaultHomeTab);
const page = ref(1);
const feeds = ref<any[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const error = ref('');
const dynamicTabs = ref<{ key: string; label: string }[]>([]);
const fallbackHomeTabs = [
  { key: 'index_v8', label: '推荐' },
  { key: 'digest', label: '头条' },
  { key: 'hot', label: '热榜' },
  { key: 'latest', label: '快讯' },
  { key: 'cool_picture', label: '酷图' },
  { key: 'secondhand', label: '二手' },
];
const orderedDynamicTabs = computed(() => {
  const source = dynamicTabs.value.length ? dynamicTabs.value : fallbackHomeTabs;
  const order = settingsStore.settings.homeTabOrder || DEFAULT_HOME_TAB_ORDER;
  return [...source].sort((a, b) => {
    const aIndex = order.indexOf(a.key as any);
    const bIndex = order.indexOf(b.key as any);
    return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex);
  });
});

const knownTabMap: Record<string, string> = {
  '关注': 'index_v8',
  '推荐': 'index_v8',
  '头条': 'digest',
  '热榜': 'hot',
  '快讯': 'latest',
  '酷图': 'cool_picture',
  '二手': 'secondhand',
};

// 实时日期计算（对应截图4 “今日酷安”日历块）
const now = new Date();
const todayDay = computed(() => String(now.getDate()).padStart(2, '0'));
const todayYearMonth = computed(() => `${now.getFullYear()}年${now.getMonth() + 1}月`);
const weekNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const todayWeek = computed(() => weekNames[now.getDay()]);

// 简报要闻 (优化展示文本，避免显示 'XXX的动态')
const topBulletins = computed(() => {
  return feeds.value.slice(0, 3).map((item: any) => {
    let rawText = item.title || item.message || '最新酷安精彩动态';
    rawText = rawText.replace(/^[#＃][^#＃]+[#＃]\s*/, '').trim();
    if (rawText.length > 28) rawText = rawText.slice(0, 28) + '...';
    return {
      id: item.id,
      text: rawText || '酷友最新话题热议中'
    };
  });
});

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

function syncTabFromRoute() {
  const path = route.path;
  switch (path) {
    case '/':
      activeTab.value = settingsStore.settings.defaultHomeTab;
      break;
    case '/discover':
      activeTab.value = 'digest';
      break;
    case '/apps':
      activeTab.value = 'secondhand';
      break;
    case '/games':
      activeTab.value = 'hot';
      break;
    case '/topics':
      activeTab.value = 'digest';
      break;
    case '/favorites':
      activeTab.value = 'cool_picture';
      break;
    case '/history':
      activeTab.value = 'latest';
      break;
    case '/following':
      activeTab.value = 'index_v8';
      break;
    default:
      if (!['hot', 'latest', 'digest', 'cool_picture', 'secondhand', 'pictures', 'dyh'].includes(activeTab.value)) {
        activeTab.value = 'index_v8';
      }
      break;
  }
}

const prefetchBuffer = ref<any[]>([]);
const prefetchPage = ref(2);
const isPrefetching = ref(false);

async function fetchTabConfig() {
  try {
    const res: any = await CoolapkTauriAPI.getTabConfig();
    const data = res?.data || [];
    const configCard = data.find(
      (item: any) => item.entityTemplate === 'configCard' && (item.title || '').includes('TAB配置')
    );
    if (configCard && configCard.entities && Array.isArray(configCard.entities)) {
      const tabs = configCard.entities
        .filter((e: any) => e.title)
        .map((e: any) => {
          const label = e.title;
          const mappedKey = knownTabMap[label] || deriveTabKey(e.url);
          return { key: mappedKey, label };
        });
      if (tabs.length > 0) {
        dynamicTabs.value = tabs;
      }
    }
  } catch (err) {
    console.warn('获取 Tab 配置失败，使用默认配置', err);
  }
}

function deriveTabKey(url: string): string {
  if (!url) return '';
  const clean = url.replace(/\?.*$/, '').replace(/\/$/, '');
  const segments = clean.split('/').filter(Boolean);
  return segments[segments.length - 1] || clean;
}

async function fetchTabApi(tab: string, p: number) {
  switch (tab) {
    case 'hot': return await CoolapkTauriAPI.getRankFeeds(activeHotRank.value, p);
    case 'latest': return await CoolapkTauriAPI.getLatestFeeds(p);
    case 'digest': return await CoolapkTauriAPI.getDigestFeeds(p);
    case 'cool_picture': return await CoolapkTauriAPI.getCoolPictureRank(p);
    case 'secondhand': return await CoolapkTauriAPI.getSecondHandFeeds(p);
    case 'pictures': return await CoolapkTauriAPI.getPictureList('', p);
    case 'dyh': return await CoolapkTauriAPI.getDyhList(p);
    default: return await CoolapkTauriAPI.getIndexV8Feeds(p);
  }
}

async function prefetchNextPage() {
  if (isPrefetching.value || noMore.value) return;
  isPrefetching.value = true;
  try {
    const nextP = page.value;
    const res: any = await fetchTabApi(activeTab.value, nextP);
    if (res && res.data && Array.isArray(res.data)) {
      const validItems = res.data.filter((item: any) => item.id && (item.message || item.title || item.pic) && !shouldHideFeed(item, settingsStore.settings));
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
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  error.value = '';

  try {
    let validItems: any[] = [];

    if (!isRefresh && prefetchBuffer.value.length > 0) {
      validItems = prefetchBuffer.value;
      prefetchBuffer.value = [];
      page.value = prefetchPage.value;
    } else {
      const res: any = await fetchTabApi(activeTab.value, page.value);
      if (res && res.data && Array.isArray(res.data)) {
        validItems = res.data.filter((item: any) => item.id && (item.message || item.title || item.pic) && !shouldHideFeed(item, settingsStore.settings));
      }
      page.value++;
    }

    if (validItems.length < 3) {
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

    if (settingsStore.settings.infiniteScroll) {
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

function quickSearch(kw: string) {
  router.push({ path: '/search', query: { q: kw } });
}

function quickFilter(tag: string) {
  quickSearch(tag);
}

function selectHotRank(rankType: HotRankType) {
  if (activeHotRank.value === rankType) {
    void loadFeeds(true);
    return;
  }
  activeHotRank.value = rankType;
}

function handleBulletinClick(item: any) {
  if (item.id) {
    // 引导点击
  }
}

watch(activeTab, () => {
  loadFeeds(true);
});

watch(activeHotRank, () => {
  if (activeTab.value === 'hot') loadFeeds(true);
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

onMounted(() => {
  fetchTabConfig();
  syncTabFromRoute();
  loadFeeds(true);
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
  background: var(--surface-hover, rgba(0,0,0,0.01));
  border-bottom: 1px solid var(--border);
}

.today-coolapk-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%);
  border-radius: 12px;
  padding: 12px 16px;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);
}

.calendar-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 6px 12px;
  min-width: 70px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.cal-top {
  font-size: 10px;
  font-weight: 700;
  background: #ef4444;
  color: #fff;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.cal-day {
  font-size: 26px;
  font-weight: 900;
  line-height: 1.1;
  margin: 2px 0;
}

.cal-meta {
  font-size: 10px;
  opacity: 0.9;
}

.headline-bulletins {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.bulletin-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.bulletin-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #38bdf8;
  flex-shrink: 0;
}

.bulletin-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.95;
}

.quick-icons-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  padding: 4px 0;
}

.icon-btn-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
}

.icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
  transition: transform 0.2s ease;
}

.icon-btn-item:hover .icon-circle {
  transform: translateY(-2px);
}

.icon-blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
.icon-yellow { background: linear-gradient(135deg, #f59e0b, #d97706); }
.icon-red { background: linear-gradient(135deg, #ef4444, #b91c1c); }
.icon-cyan { background: linear-gradient(135deg, #06b6d4, #0891b2); }
.icon-teal { background: linear-gradient(135deg, #14b8a6, #0d9488); }

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
