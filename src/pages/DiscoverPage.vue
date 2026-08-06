<template>
  <div class="page-container custom-scrollbar">
    <!-- 1. 顶栏二级 Channel Sub-Tabs 导航 -->
    <div class="digital-sub-tabs">
      <button
        v-for="sub in subTabs"
        :key="sub.key"
        :class="['sub-tab-item', { active: activeSubTab === sub.key }]"
        @click="switchSubTab(sub.key)"
      >
        <span>{{ sub.label }}</span>
        <span v-if="activeSubTab === sub.key" class="active-indicator"></span>
      </button>
    </div>

    <!-- 2. “我的关注” 选区卡片 -->
    <div class="my-following-devices-card">
      <div class="card-header-row">
        <span class="card-title">我的关注</span>
        <span class="more-link" @click="handleMoreFollow">更多 <i class="fas fa-chevron-right"></i></span>
      </div>
      <div class="devices-grid">
        <div v-for="(dev, idx) in followedDevices" :key="idx" class="device-item-box" @click="searchDevice(dev.name)">
          <div class="device-icon"><i :class="dev.icon"></i></div>
          <span class="device-name">{{ dev.name }}</span>
        </div>
      </div>
    </div>

    <!-- 3. 10 宫格数码品类金刚位导航 -->
    <div class="digital-category-grid">
      <div v-for="(cat, idx) in digitalCategories" :key="idx" class="cat-grid-item" @click="filterCat(cat.name)">
        <div class="cat-icon-wrapper"><i :class="cat.icon"></i></div>
        <span class="cat-label">{{ cat.name }}</span>
      </div>
    </div>

    <!-- 4. 选机中心 Banner 展示块 -->
    <div class="selection-center-banner" @click="filterCat('选机中心')">
      <div class="banner-left-text">
        <div class="banner-main-title">选机中心</div>
        <div class="banner-sub-title">帮你找到最合适的那款 <span class="go-badge">Let's GO</span></div>
      </div>
      <div class="banner-right-icons">
        <i class="fas fa-mobile-alt phone-banner-icon"></i>
      </div>
    </div>

    <!-- 5. 今日热门 手机/数码排行榜单 1~8 -->
    <div class="hot-rank-section">
      <div class="rank-header">
        <span class="section-title">今日热门</span>
        <span class="more-link" @click="filterCat('榜单')">榜单 <i class="fas fa-chevron-right"></i></span>
      </div>

      <div v-if="rankLoading" class="rank-loading-box">
        <LoadingState text="正在获取数码大热热度榜单..." />
      </div>

      <div v-else class="hot-phones-grid">
        <div
          v-for="(item, idx) in hotDevicesList"
          :key="idx"
          class="phone-rank-card"
          @click="searchDevice(item.title)"
        >
          <div :class="['rank-number-tag', `rank-${idx + 1}`]">{{ idx + 1 }}</div>
          <div class="phone-img-wrapper">
            <AppImage :src="item.pic" fit="contain" class="phone-img" />
          </div>
          <div class="phone-info">
            <div class="phone-title">{{ item.title }}</div>
            <div class="phone-heat"><i class="fas fa-fire"></i> {{ item.heatText }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 6. 核心精选数码 / 关注帖流 -->
    <div class="discover-feed-list">
      <div class="feed-section-title">
        <i class="fas fa-microchip icon"></i> 数码动态与热评
      </div>
      <div v-if="feedLoading" class="feed-loading">
        <LoadingState text="正在搜索数码动态..." />
      </div>
      <div v-else class="feeds-column">
        <FeedCard v-for="item in feeds" :key="item.id || item.feedId" :feed="item" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';

const router = useRouter();

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
];

const hotDevicesList = ref<any[]>([]);
const rankLoading = ref(false);
const feeds = ref<any[]>([]);
const feedLoading = ref(false);

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
      feeds.value = list.filter((item: any) => item.id && (item.message || item.title || item.username));

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

onMounted(() => loadDigitalData());
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 900px;
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 1. 顶部 Sub-Tabs 样式 */
.digital-sub-tabs {
  display: flex;
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
