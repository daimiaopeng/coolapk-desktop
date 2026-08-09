<template>
  <div class="discover-page custom-scrollbar" @scroll="handleDiscoverScroll">
    <section class="discover-hero">
      <div class="hero-copy">
        <div class="hero-kicker">
          <span class="hero-live-dot"></span>
          今日数码雷达
        </div>
        <h1>发现下一件<br><em>值得拥有</em>的好物</h1>
        <p>从真实动态、热度榜单到设备灵感，把每天值得关注的数码内容集中在这里。</p>
        <div class="hero-actions">
          <button class="hero-primary" @click="filterCat('榜单')">
            看今日热榜
            <i class="fas fa-arrow-right"></i>
          </button>
          <button class="hero-secondary" @click="filterCat('手机')">
            <i class="fas fa-search"></i>
            搜索设备
          </button>
        </div>
      </div>

      <div class="hero-visual" aria-hidden="true">
        <div class="hero-grid-lines"></div>
        <div class="hero-orbit hero-orbit-large"></div>
        <div class="hero-orbit hero-orbit-small"></div>
        <div class="hero-device hero-device-phone"><i class="fas fa-mobile-alt"></i></div>
        <div class="hero-device hero-device-camera"><i class="fas fa-camera"></i></div>
        <div class="hero-device hero-device-headphones"><i class="fas fa-headphones"></i></div>
        <div class="hero-signal-card">
          <span class="signal-label">TRENDING NOW</span>
          <strong>智能设备</strong>
          <span class="signal-value"><i class="fas fa-arrow-up"></i> 24.8%</span>
        </div>
      </div>
    </section>

    <nav class="discover-tabs" aria-label="发现栏目">
      <button
        v-for="sub in subTabs"
        :key="sub.key"
        :class="['discover-tab', { active: activeSubTab === sub.key }]"
        @click="switchSubTab(sub.key)"
      >
        <span>{{ sub.label }}</span>
        <span v-if="activeSubTab === sub.key" class="active-indicator"></span>
      </button>
    </nav>

    <section class="following-section">
      <div class="section-heading">
        <div>
          <span class="section-eyebrow">YOUR PICKS</span>
          <h2>我的关注</h2>
        </div>
        <button class="section-link" @click="handleMoreFollow">
          管理关注
          <i class="fas fa-arrow-up-right-from-square"></i>
        </button>
      </div>

      <div class="following-grid">
        <button v-for="(dev, idx) in followedDevices" :key="idx" class="following-item" @click="searchDevice(dev.name)">
          <span class="following-icon"><i :class="dev.icon"></i></span>
          <span class="following-copy">
            <strong>{{ dev.name }}</strong>
            <small>查看相关动态</small>
          </span>
          <i class="fas fa-chevron-right following-arrow"></i>
        </button>
        <button class="following-add" @click="handleMoreFollow">
          <span class="add-icon"><i class="fas fa-plus"></i></span>
          <span>
            <strong>添加设备</strong>
            <small>订阅新内容</small>
          </span>
        </button>
      </div>
    </section>

    <section class="discovery-overview">
      <div class="categories-panel">
        <div class="section-heading compact-heading">
          <div>
            <span class="section-eyebrow">BROWSE BY TYPE</span>
            <h2>探索分类</h2>
          </div>
          <span class="heading-count">10 个分类</span>
        </div>
        <div class="category-grid">
          <button v-for="(cat, idx) in digitalCategories" :key="idx" class="category-item" @click="onCategoryClick(cat)">
            <span class="category-icon"><i :class="cat.icon"></i></span>
            <span class="category-label">{{ cat.name }}</span>
          </button>
        </div>
      </div>

      <button class="selection-banner" @click="filterCat('选机中心')">
        <span class="selection-kicker">SMART PICK</span>
        <strong>选机中心</strong>
        <span class="selection-copy">帮你找到最合适的那一款</span>
        <span class="selection-cta">开始挑选 <i class="fas fa-arrow-right"></i></span>
        <span class="selection-device selection-device-back"><i class="fas fa-mobile-alt"></i></span>
        <span class="selection-device selection-device-front"><i class="fas fa-mobile-screen-button"></i></span>
      </button>
    </section>

    <section v-if="dyhPanelOpen" class="dyh-square-section">
      <div class="section-heading">
        <div>
          <span class="section-eyebrow">OFFICIAL ACCOUNTS</span>
          <h2>看看号广场</h2>
        </div>
        <span class="section-link" @click="dyhPanelOpen = false">收起</span>
      </div>

      <div v-if="dyhLoading && dyhList.length === 0" class="rank-loading-box">
        <LoadingState text="正在加载看看号..." />
      </div>

      <div v-else-if="dyhError && dyhList.length === 0" class="rank-loading-box">
        <span class="dyh-error-text">看看号加载失败，请稍后重试</span>
      </div>

      <div v-else class="dyh-grid">
        <div
          v-for="item in dyhList"
          :key="item.id"
          class="dyh-card"
          @click="openDyh(item.id)"
        >
          <AppImage v-if="item.logo" :src="item.logo" fit="cover" image-class="dyh-logo" />
          <div v-else class="dyh-logo-fallback"><i class="fas fa-building-columns"></i></div>
          <div class="dyh-card-info">
            <strong class="dyh-name">{{ item.title || item.dyhName }}</strong>
            <span class="dyh-desc">{{ item.description }}</span>
            <span class="dyh-follow"><i class="fas fa-user-plus"></i> {{ formatCount(item.follownum) }} 关注</span>
          </div>
          <i class="fas fa-chevron-right dyh-arrow"></i>
        </div>

        <div v-if="dyhLoadingMore" class="dyh-loading-more">
          <LoadingState text="加载更多看看号..." />
        </div>
        <div v-else-if="dyhNoMore" class="dyh-no-more">没有更多看看号了</div>
      </div>
    </section>

    <section class="hot-rank-section">
      <div class="section-heading">
        <div>
          <span class="section-eyebrow">LIVE RANKING</span>
          <h2>今日热门</h2>
        </div>
        <button class="section-link" @click="filterCat('榜单')">
          查看完整榜单
          <i class="fas fa-arrow-right"></i>
        </button>
      </div>

      <div v-if="rankLoading" class="rank-loading-box">
        <LoadingState text="正在获取数码大热热度榜单..." />
      </div>

      <div v-else class="hot-grid">
        <div
          v-for="(item, idx) in hotDevicesList"
          :key="idx"
          class="hot-card"
          @click="searchDevice(item.title)"
        >
          <div class="hot-card-meta">
            <span :class="['rank-number', `rank-${idx + 1}`]">{{ String(idx + 1).padStart(2, '0') }}</span>
            <span class="hot-heat"><i class="fas fa-fire"></i> {{ item.heatText }}</span>
          </div>
          <div class="hot-image-wrap">
            <AppImage v-if="item.pic" :src="item.pic" fit="contain" image-class="hot-image" />
            <div v-else class="hot-image-fallback"><i class="fas fa-mobile-screen-button"></i></div>
          </div>
          <div class="hot-card-info">
            <strong>{{ item.title }}</strong>
            <span>查看设备详情 <i class="fas fa-arrow-right"></i></span>
          </div>
        </div>
      </div>
    </section>

    <section class="discover-feed-list">
      <div class="section-heading feed-heading">
        <div>
          <span class="section-eyebrow">FROM THE COMMUNITY</span>
          <h2>数码动态与热评</h2>
        </div>
        <span class="feed-heading-note"><i class="fas fa-circle"></i> 实时更新</span>
      </div>
      <div v-if="feedLoading" class="feed-loading">
        <LoadingState text="正在搜索数码动态..." />
      </div>
      <div v-else class="feeds-column">
        <FeedCard v-for="item in feeds" :key="item.id || item.feedId" :feed="item" @deleted="handleFeedDeleted" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useSettingsStore } from '../stores/settings';
import { shouldHideFeed } from '../utils/feedFilter';
import FeedCard from '../components/feed/FeedCard.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';

const router = useRouter();
const settingsStore = useSettingsStore();

const activeSubTab = ref('digital');
const subTabs = [
  { key: 'lib', label: '数码库', boardTag: '#/board/数码库' },
  { key: 'digital', label: '数码', boardTag: '#/board/数码' },
  { key: 'phone', label: '手机', boardTag: '#/board/手机' },
  { key: 'rank', label: '排行榜', boardTag: '#/board/排行榜' },
  { key: 'system', label: '系统', boardTag: '#/board/系统' },
  { key: 'tablet', label: '平板', boardTag: '#/board/平板' },
  { key: 'laptop', label: '电脑', boardTag: '#/board/电脑' },
];

const followedDevices = ref([
  { name: '索尼 WF-1000XM4', icon: 'fas fa-headphones' },
  { name: '小米13 Pro', icon: 'fas fa-mobile-alt' },
  { name: '联想拯救者 R9000P', icon: 'fas fa-laptop' },
  { name: '索尼 A7C2', icon: 'fas fa-camera' },
]);

const digitalCategories = [
  { name: '手机', icon: 'fas fa-mobile-alt' },
  { name: '平板', icon: 'fas fa-tablet-alt' },
  { name: '耳机', icon: 'fas fa-headphones-alt' },
  { name: '笔记本', icon: 'fas fa-laptop' },
  { name: '智能家居', icon: 'fas fa-home' },
  { name: '穿戴设备', icon: 'fas fa-stopwatch' },
  { name: '数码配件', icon: 'fas fa-plug' },
  { name: '游戏', icon: 'fas fa-gamepad' },
  { name: '路由器', icon: 'fas fa-wifi' },
  { name: '全部', icon: 'fas fa-th-large' },
  { name: '酷图', icon: 'fas fa-images', action: 'pictures' },
  { name: '看看号', icon: 'fas fa-building-columns', action: 'dyh' },
];

const dyhPanelOpen = ref(false);
const dyhList = ref<any[]>([]);
const dyhLoading = ref(false);
const dyhLoadingMore = ref(false);
const dyhError = ref(false);
const dyhNoMore = ref(false);
const dyhPage = ref(1);

const hotDevicesList = ref<any[]>([]);
const rankLoading = ref(false);
const feeds = ref<any[]>([]);
const feedLoading = ref(false);

function formatCount(n: any): string {
  const num = Number(n) || 0;
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  return String(num);
}

function onCategoryClick(cat: any) {
  if (cat.action === 'pictures') {
    router.push('/pictures');
    return;
  }
  if (cat.action === 'dyh') {
    if (!dyhPanelOpen.value) {
      dyhPanelOpen.value = true;
      if (dyhList.value.length === 0) fetchDyhList(false);
    } else {
      dyhPanelOpen.value = false;
    }
    return;
  }
  filterCat(cat.name);
}

async function fetchDyhList(isLoadMore = false) {
  if (dyhLoading.value || dyhLoadingMore.value || dyhNoMore.value) return;
  if (isLoadMore) {
    dyhLoadingMore.value = true;
  } else {
    dyhLoading.value = true;
    dyhError.value = false;
  }
  try {
    const res: any = await CoolapkTauriAPI.getDyhList(dyhPage.value);
    const list = (res?.data && Array.isArray(res.data)) ? res.data : [];
    if (list.length === 0) {
      dyhNoMore.value = true;
    } else {
      if (isLoadMore) {
        dyhList.value.push(...list);
      } else {
        dyhList.value = list;
      }
      dyhPage.value++;
    }
  } catch (err) {
    if (!isLoadMore) dyhError.value = true;
    console.warn('获取看看号列表失败', err);
  } finally {
    dyhLoading.value = false;
    dyhLoadingMore.value = false;
  }
}

function openDyh(dyhId: any) {
  if (dyhId) router.push(`/dyh/${String(dyhId)}`);
}

function handleFeedDeleted(id: string | number) {
  feeds.value = feeds.value.filter((f: any) => String(f.id) !== String(id));
}

async function loadDigitalData() {
  rankLoading.value = true;
  feedLoading.value = true;
  try {
    // 优先使用板块动态接口（getBoardFeeds），取不到有效列表时回退热榜
    const currentTab = subTabs.find(t => t.key === activeSubTab.value);
    let list: any[] = [];
    if (currentTab?.boardTag) {
      try {
        const boardRes: any = await CoolapkTauriAPI.getBoardFeeds(currentTab.boardTag, 1);
        const boardList = boardRes?.data || [];
        if (Array.isArray(boardList) && boardList.length > 0) {
          list = boardList;
        }
      } catch (e) {
        console.warn(`获取板块(${currentTab.label})动态失败，回退热榜:`, e);
      }
    }
    if (list.length === 0) {
      const res = await CoolapkTauriAPI.getHotFeeds(1);
      list = res?.data || res || [];
    }
    if (Array.isArray(list)) {
      // 从真实 API 热帖中提取热度较高的品牌手机及帖子
      feeds.value = list.filter((item: any) => item.id && (item.message || item.title || item.username) && !shouldHideFeed(item, settingsStore.settings));

      const parsedRanks: any[] = [];
      list.forEach((item: any) => {
        const title = item.deviceTitle || item.targetType || item.title;
        const pic = item.pic || item.userAvatar || (item.pics && item.pics[0]) || '';
        const rawHit = item.hitnum || item.likenum || 18000;
        const heatText = rawHit >= 10000 ? (rawHit / 10000).toFixed(1) + '万' : String(rawHit);
        
        if (title && !parsedRanks.some(r => r.title === title)) {
          parsedRanks.push({ title, pic, heatText });
        }
      });

      // 预设如果接口不足则降级补充典型热议机型，保证排版整齐
      const fallbackList = [
        { title: 'REDMI K100 Pro', heatText: '56.0万' },
        { title: '华为 Mate 80 Pro Max', heatText: '41.8万' },
        { title: 'iPhone 17 Pro Max', heatText: '31.5万' },
        { title: 'REDMI K90 Pro Max', heatText: '24.1万' },
        { title: 'OPPO Find X8 Ultra', heatText: '18.8万' },
        { title: '一加15', heatText: '18.2万' },
        { title: 'iPhone 17', heatText: '15.9万' },
        { title: '华为 nova 16 SE', heatText: '15.5万' },
      ];

      for (let i = parsedRanks.length; i < 8; i++) {
        parsedRanks.push(fallbackList[i] || fallbackList[0]);
      }

      hotDevicesList.value = parsedRanks.slice(0, 8);
    }
  } catch (err) {
    console.warn('获取数码热门榜单失败', err);
  } finally {
    rankLoading.value = false;
    feedLoading.value = false;
  }
}

function switchSubTab(key: string) {
  activeSubTab.value = key;
  loadDigitalData();
}

function searchDevice(name: string) {
  router.push({ path: '/search', query: { q: name } });
}

function filterCat(catName: string) {
  searchDevice(catName);
}

function handleMoreFollow() {
  router.push('/following');
}

function handleDiscoverScroll(e: Event) {
  if (!dyhPanelOpen.value || dyhLoading.value || dyhLoadingMore.value || dyhNoMore.value) return;
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
    fetchDyhList(true);
  }
}

onMounted(() => loadDigitalData());
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 1. 顶部 Sub-Tabs 样式 */
.digital-sub-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 18px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  overflow-x: auto;
}

.sub-tab-item {
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 2px;
}

.sub-tab-item.active {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.active-indicator {
  position: absolute;
  bottom: -9px;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--brand-primary, #10b981);
  border-radius: 2px;
}

/* 2. 我的关注 卡片 */
.my-following-devices-card {
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.more-link {
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
}

.more-link:hover {
  color: var(--brand-primary);
}

.devices-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.device-item-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--background);
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.device-item-box:hover {
  transform: translateY(-2px);
  background: var(--surface-hover);
}

.device-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--brand-soft);
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.device-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 3. 10 宫格品类导航 */
.digital-category-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 12px;
}

.cat-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.cat-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--background-secondary, #f1f5f9);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s ease;
}

.cat-grid-item:hover .cat-icon-wrapper {
  background: var(--brand-soft);
  color: var(--brand-primary);
  transform: scale(1.08);
}

.cat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 4. 选机中心 Banner */
.selection-center-banner {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border-radius: 12px;
  padding: 18px 24px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(30, 27, 75, 0.2);
}

.banner-main-title {
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 1px;
}

.banner-sub-title {
  font-size: 13px;
  opacity: 0.85;
  margin-top: 4px;
}

.go-badge {
  background: #3b82f6;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
}

.phone-banner-icon {
  font-size: 42px;
  color: #60a5fa;
}

/* 5. 今日热门 手机排行榜 Grid */
.hot-rank-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rank-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.hot-phones-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.phone-rank-card {
  position: relative;
  background: var(--background);
  border-radius: 10px;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.phone-rank-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}

.rank-number-tag {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #64748b;
}

.rank-1 { background: #ef4444; }
.rank-2 { background: #f97316; }
.rank-3 { background: #eab308; }
.rank-4 { background: #84cc16; }

.phone-img-wrapper {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.phone-img {
  max-width: 100%;
  max-height: 100%;
}

.phone-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}

.phone-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.2;
}

.phone-heat {
  font-size: 10px;
  color: var(--text-tertiary);
}

.feed-section-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.feed-section-title .icon {
  color: var(--brand-primary);
}
</style>

<style scoped>
.discover-page {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  margin: 0;
  padding: 28px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.discover-page > * {
  flex-shrink: 0;
}

.discover-hero {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  min-height: 248px;
  overflow: hidden;
  border-radius: 24px;
  color: #ffffff;
  background:
    radial-gradient(circle at 82% 24%, rgba(111, 236, 182, 0.28), transparent 26%),
    linear-gradient(124deg, #123a31 0%, #0c6855 62%, #10a66b 100%);
  box-shadow: 0 18px 40px rgba(11, 92, 71, 0.18);
}

.discover-hero::after {
  content: '';
  position: absolute;
  z-index: -1;
  right: -100px;
  bottom: -150px;
  width: 420px;
  height: 420px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  box-shadow: 0 0 0 28px rgba(255, 255, 255, 0.035), 0 0 0 56px rgba(255, 255, 255, 0.025);
}

.hero-copy {
  position: relative;
  z-index: 2;
  align-self: center;
  padding: 34px 36px;
}

.hero-kicker,
.section-eyebrow,
.selection-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-kicker {
  color: rgba(255, 255, 255, 0.72);
}

.hero-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8df2bd;
  box-shadow: 0 0 0 5px rgba(141, 242, 189, 0.14);
}

.hero-copy h1 {
  margin: 14px 0 10px;
  font-size: clamp(28px, 3vw, 40px);
  font-weight: 750;
  line-height: 1.12;
  letter-spacing: -0.04em;
}

.hero-copy h1 em {
  color: #94f0c1;
  font-style: normal;
}

.hero-copy p {
  max-width: 460px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.hero-primary,
.hero-secondary,
.section-link,
.following-item,
.following-add,
.category-item,
.selection-banner {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.hero-primary,
.hero-secondary {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 38px;
  padding: 0 15px;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 650;
  transition: transform var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default);
}

.hero-primary {
  color: #0c4e3e;
  background: #b4f5d2;
}

.hero-secondary {
  color: rgba(255, 255, 255, 0.84);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.hero-primary:hover,
.hero-secondary:hover {
  transform: translateY(-2px);
}

.hero-primary:hover {
  background: #d1fae1;
}

.hero-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.hero-visual {
  position: relative;
  min-height: 248px;
  overflow: hidden;
}

.hero-grid-lines {
  position: absolute;
  inset: 0;
  opacity: 0.26;
  background-image: linear-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.16) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: linear-gradient(to right, transparent, #000 35%);
}

.hero-orbit {
  position: absolute;
  border: 1px solid rgba(180, 245, 210, 0.3);
  border-radius: 50%;
  transform: rotate(-28deg);
}

.hero-orbit-large {
  top: 20px;
  right: 8px;
  width: 290px;
  height: 160px;
}

.hero-orbit-small {
  top: 58px;
  right: 56px;
  width: 195px;
  height: 108px;
  border-color: rgba(180, 245, 210, 0.18);
}

.hero-device {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 17px;
  color: #d9ffea;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 12px 26px rgba(0, 45, 35, 0.18);
  backdrop-filter: blur(10px);
  transform: rotate(-10deg);
}

.hero-device-phone {
  top: 44px;
  right: 112px;
  font-size: 23px;
}

.hero-device-camera {
  top: 128px;
  right: 42px;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  font-size: 18px;
  transform: rotate(12deg);
}

.hero-device-headphones {
  top: 154px;
  right: 174px;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  font-size: 16px;
  transform: rotate(8deg);
}

.hero-signal-card {
  position: absolute;
  right: 22px;
  bottom: 22px;
  display: grid;
  gap: 4px;
  min-width: 142px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  background: rgba(7, 51, 41, 0.5);
  backdrop-filter: blur(12px);
}

.signal-label {
  color: rgba(255, 255, 255, 0.52);
  font-size: 9px;
  letter-spacing: 0.12em;
}

.signal-card strong,
.hero-signal-card strong {
  font-size: 13px;
}

.signal-value {
  color: #98f2c1;
  font-size: 11px;
}

.discover-tabs {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(245, 247, 249, 0.88);
  box-shadow: 0 8px 20px rgba(30, 41, 59, 0.04);
  backdrop-filter: blur(16px);
  scrollbar-width: none;
}

.discover-tabs::-webkit-scrollbar {
  display: none;
}

.discover-tab {
  position: relative;
  flex: 0 0 auto;
  min-width: 78px;
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default);
}

.discover-tab:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.discover-tab.active {
  color: var(--brand-primary);
  background: var(--surface);
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08);
}

.discover-tab .active-indicator {
  position: absolute;
  right: 50%;
  bottom: 4px;
  left: auto;
  width: 18px;
  height: 3px;
  background: var(--brand-primary);
  border-radius: 99px;
  transform: translateX(50%);
}

.following-section,
.categories-panel,
.hot-rank-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(30, 41, 59, 0.035);
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.section-heading h2 {
  margin-top: 5px;
  color: var(--text-primary);
  font-size: 21px;
  font-weight: 750;
  letter-spacing: -0.03em;
}

.section-eyebrow {
  color: var(--text-tertiary);
  font-size: 10px;
}

.section-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 0;
  color: var(--text-tertiary);
  background: transparent;
  font-size: 12px;
  white-space: nowrap;
}

.section-link:hover {
  color: var(--brand-primary);
}

.following-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.following-item,
.following-add {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 70px;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 14px;
  text-align: left;
  transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
}

.following-item {
  gap: 10px;
  color: var(--text-primary);
  background: var(--background);
}

.following-item:hover,
.following-add:hover {
  border-color: var(--brand-primary);
  background: var(--brand-soft);
  transform: translateY(-2px);
}

.following-icon,
.add-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  color: var(--brand-primary);
  background: var(--brand-soft);
  font-size: 15px;
}

.following-copy,
.following-add > span:last-child {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.following-copy strong,
.following-add strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.following-copy small,
.following-add small {
  color: var(--text-tertiary);
  font-size: 10px;
}

.following-arrow {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: 10px;
}

.following-add {
  gap: 10px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px dashed var(--border);
}

.following-add .add-icon {
  color: var(--text-tertiary);
  background: var(--surface-hover);
}

.discovery-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(260px, 0.85fr);
  gap: 22px;
  align-items: stretch;
}

.compact-heading {
  align-items: center;
}

.heading-count {
  color: var(--text-tertiary);
  font-size: 11px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 88px;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 14px;
  color: var(--text-secondary);
  background: var(--background);
  transition: border-color var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
}

.category-item:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  transform: translateY(-2px);
}

.category-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  color: var(--text-primary);
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.07);
  font-size: 15px;
}

.category-item:hover .category-icon {
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.category-label {
  font-size: 11px;
  white-space: nowrap;
}

.selection-banner {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 100%;
  overflow: hidden;
  padding: 28px;
  border-radius: 20px;
  color: #ffffff;
  background: linear-gradient(145deg, #1e1b4b 0%, #312e81 58%, #4338ca 100%);
  box-shadow: 0 12px 26px rgba(49, 46, 129, 0.2);
  text-align: left;
}

.selection-banner::before {
  content: '';
  position: absolute;
  z-index: -1;
  right: -46px;
  bottom: -72px;
  width: 220px;
  height: 220px;
  border: 1px solid rgba(147, 197, 253, 0.34);
  border-radius: 50%;
  box-shadow: 0 0 0 20px rgba(147, 197, 253, 0.08), 0 0 0 42px rgba(147, 197, 253, 0.05);
}

.selection-kicker {
  color: #a5b4fc;
  font-size: 10px;
}

.selection-banner strong {
  margin-top: 22px;
  font-size: 27px;
  font-weight: 750;
  letter-spacing: -0.04em;
}

.selection-copy {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
}

.selection-cta {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: auto;
  padding-top: 28px;
  color: #c7d2fe;
  font-size: 12px;
  font-weight: 650;
}

.selection-device {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #bfdbfe;
  border: 1px solid rgba(191, 219, 254, 0.45);
  background: rgba(147, 197, 253, 0.12);
  box-shadow: 0 16px 28px rgba(15, 23, 42, 0.16);
  transform: rotate(13deg);
}

.selection-device-back {
  right: 62px;
  bottom: 42px;
  width: 72px;
  height: 112px;
  border-radius: 16px;
  opacity: 0.42;
  font-size: 30px;
  transform: rotate(20deg);
}

.selection-device-front {
  right: 24px;
  bottom: 24px;
  width: 76px;
  height: 120px;
  border-radius: 17px;
  font-size: 33px;
}

.hot-rank-section {
  gap: 20px;
}

.dyh-square-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(30, 41, 59, 0.035);
}

.dyh-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dyh-card {
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

.dyh-card:hover {
  border-color: var(--brand-primary);
  transform: translateY(-2px);
}

.dyh-logo {
  width: 44px !important;
  height: 44px !important;
  max-width: none !important;
  max-height: none !important;
  border-radius: 12px !important;
  background: var(--brand-soft) !important;
}

.dyh-logo-fallback {
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

.dyh-card-info {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.dyh-name {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dyh-desc {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dyh-follow {
  color: var(--text-secondary);
  font-size: 10px;
}

.dyh-follow i {
  margin-right: 3px;
  color: var(--brand-primary);
}

.dyh-arrow {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: 11px;
}

.dyh-loading-more,
.dyh-no-more {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}

.dyh-no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}

.dyh-error-text {
  color: var(--text-tertiary);
  font-size: 13px;
}

.hot-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.hot-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 226px;
  flex-direction: column;
  padding: 14px;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  background: var(--background);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default);
}

.hot-card:hover {
  border-color: var(--brand-primary);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
  transform: translateY(-3px);
}

.hot-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rank-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 31px;
  height: 24px;
  border-radius: 7px;
  color: #ffffff;
  background: #64748b;
  font-size: 11px;
  font-weight: 750;
}

.rank-number.rank-1 { background: #ef4444; }
.rank-number.rank-2 { background: #f97316; }
.rank-number.rank-3 { background: #eab308; }
.rank-number.rank-4 { background: #84cc16; }

.hot-heat {
  color: var(--text-tertiary);
  font-size: 10px;
}

.hot-heat i {
  color: #f97316;
  margin-right: 3px;
}

.hot-image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 122px;
  margin: 9px 0 8px;
  overflow: hidden;
  border-radius: 13px;
  background: linear-gradient(145deg, var(--surface), var(--background));
}

.hot-image {
  width: 100% !important;
  height: 122px !important;
  max-width: none !important;
  max-height: none !important;
  background: transparent !important;
}

.hot-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.hot-image-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 78px;
  border: 2px solid var(--border);
  border-radius: 10px;
  color: var(--text-tertiary);
  font-size: 22px;
}

.hot-card-info {
  display: grid;
  gap: 5px;
  margin-top: auto;
}

.hot-card-info strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hot-card-info span {
  color: var(--text-tertiary);
  font-size: 10px;
}

.hot-card-info span i {
  margin-left: 4px;
  color: var(--brand-primary);
}

.discover-feed-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feed-heading {
  padding: 0 4px;
}

.feed-heading-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.feed-heading-note i {
  color: var(--brand-primary);
  font-size: 7px;
}

.feeds-column {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feeds-column :deep(.feed-card) {
  margin-bottom: 0;
}

.rank-loading-box,
.feed-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
}

@media (max-width: 1100px) {
  .discover-page {
    padding: 22px 22px 40px;
  }

  .discover-hero {
    grid-template-columns: minmax(0, 1fr) 300px;
  }

  .following-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .following-add {
    grid-column: span 3;
  }
}

@media (max-width: 820px) {
  .discover-hero {
    grid-template-columns: minmax(0, 1fr) 250px;
  }

  .hero-copy {
    padding: 28px;
  }

  .hero-device-phone {
    right: 68px;
  }

  .hero-device-headphones {
    right: 130px;
  }

  .hero-signal-card {
    right: 14px;
  }

  .discovery-overview {
    grid-template-columns: 1fr;
  }

  .selection-banner {
    min-height: 220px;
  }

  .hot-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .discover-page {
    gap: 16px;
    padding: 16px 14px 32px;
  }

  .discover-hero {
    display: block;
    min-height: 0;
  }

  .hero-copy {
    padding: 26px 22px 28px;
  }

  .hero-copy h1 {
    font-size: 30px;
  }

  .hero-copy p {
    font-size: 13px;
  }

  .hero-visual {
    display: none;
  }

  .discover-tabs {
    margin: 0 -2px;
  }

  .following-section,
  .categories-panel,
  .hot-rank-section {
    padding: 18px;
    border-radius: 16px;
  }

  .following-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .following-add {
    grid-column: span 2;
  }

  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .category-item {
    min-height: 78px;
  }

  .selection-banner {
    min-height: 210px;
    padding: 22px;
  }

  .selection-device-back {
    right: 54px;
  }

  .section-heading {
    align-items: center;
  }

  .section-heading h2 {
    font-size: 19px;
  }

  .section-link {
    font-size: 11px;
  }

  .hot-grid {
    grid-template-columns: 1fr;
  }

  .hot-card {
    min-height: 210px;
  }

  .feed-heading-note {
    display: none;
  }
}
</style>
