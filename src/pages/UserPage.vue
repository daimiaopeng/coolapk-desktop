<template>
  <div class="user-page-wrapper custom-scrollbar" @scroll="handleUserPageScroll">
    <!-- 全屏加载阻断 -->
    <div v-if="loadingProfile && !profile" class="loading-wrapper-full">
      <LoadingState text="正在获取酷友个人主页..." />
    </div>

    <!-- 用户资料不存在防护 -->
    <div v-else-if="!profile" class="empty-wrapper-full">
      <EmptyState title="未找到酷友空间" description="该用户不存在或个人主页暂不可访问" />
    </div>

    <!-- 正常主卡片与全套 Tab 页面 -->
    <template v-else>
      <div class="app-style-user-card">
        <!-- 极高大图背景 + 沉浸式透明遮罩 -->
        <div class="banner-cover-area">
          <AppImage v-if="profile.cover" :src="profile.cover" image-class="banner-cover-img" />
          <div class="banner-cover-placeholder" v-else></div>
          <div class="banner-cover-gradient"></div>

          <!-- 悬浮顶部返回与交互 Bar -->
          <div class="banner-top-bar">
            <button class="icon-circle-btn" @click="handleGoBack" title="返回">
              <i class="fas fa-arrow-left"></i>
            </button>
            <div class="top-bar-right">
              <button class="icon-circle-btn" title="搜索">
                <i class="fas fa-search"></i>
              </button>
              <button class="icon-circle-btn" title="更多设置">
                <i class="fas fa-ellipsis-v"></i>
              </button>
            </div>
          </div>

          <!-- 沉浸式大图上方的 Hero 全量内容区 -->
          <div class="banner-hero-content">
            <!-- 1. 头像与行动按钮组 -->
            <div class="banner-avatar-row">
              <AppAvatar 
                :src="profile.userAvatar || getAvatarUrlByUid(profile.uid)" 
                :plugin-url="profile.avatar_plugin_url"
                size="xl" 
                class="app-hero-avatar" 
              />
              <div class="banner-actions">
                <template v-if="isSelfUser">
                  <button class="app-btn btn-secondary-glass">
                    <i class="fas fa-edit"></i> 编辑资料
                  </button>
                  <button class="app-btn btn-icon-glass" title="二维码">
                    <i class="fas fa-qrcode"></i>
                  </button>
                </template>
                <template v-else>
                  <button 
                    :class="['app-btn', profile.isFollow ? 'btn-following' : 'btn-follow-primary']"
                    :disabled="followLoading"
                    @click="toggleFollow"
                  >
                    <i :class="profile.isFollow ? 'fas fa-check' : 'fas fa-plus'"></i>
                    {{ profile.isFollow ? (profile.isSpecialFollow ? '特别关注' : '已关注') : '关注' }}
                  </button>
                  <button class="app-btn btn-icon-glass" @click="sendMessage" title="私信">
                    <i class="far fa-envelope"></i>
                  </button>
                  <button
                    :class="['app-btn', isBlacklisted ? 'btn-blacklisted' : 'btn-danger-glass']"
                    :disabled="blacklistLoading"
                    @click="toggleBlacklist"
                    :title="isBlacklisted ? '取消拉黑' : '拉黑该用户'"
                  >
                    <i class="fas fa-ban"></i>
                    {{ isBlacklisted ? '已拉黑' : '拉黑' }}
                  </button>
                  <button
                    :class="['app-btn', isIgnored ? 'btn-ignored' : 'btn-danger-ghost']"
                    :disabled="ignoreLoading"
                    @click="toggleIgnore"
                    :title="isIgnored ? '取消屏蔽' : '屏蔽该用户'"
                  >
                    <i class="fas fa-eye-slash"></i>
                    {{ isIgnored ? '已屏蔽' : '屏蔽' }}
                  </button>
                  <router-link to="/blacklist" class="blacklist-manage-link" title="黑名单管理">
                    <i class="fas fa-list"></i> 黑名单管理
                  </router-link>
                </template>
              </div>
            </div>

            <!-- 2. 用户信息包（全白字半透明沉浸展示） -->
            <div class="user-details-area-immersive">
              <!-- 名字与等级 -->
              <div class="username-title-row">
                <h1 class="app-username">{{ profile.username }}</h1>
                <span class="app-user-level" v-if="profile.level">Lv.{{ profile.level }}</span>
                <span v-if="profile.isDeveloper || profile.verify_title" class="app-verify-tag">
                  <i class="fas fa-check-circle"></i> {{ profile.verify_title || '酷安认证开发者' }}
                </span>
              </div>

              <!-- 个性签名 -->
              <p class="app-user-bio">
                <i class="fas fa-pen bio-icon"></i>
                {{ profile.bio || '点击设置我的签名' }}
              </p>

              <!-- 获赞·关注·粉丝 高对比度白字行 -->
              <div class="app-stats-row">
                <div class="stat-cell">
                  <span class="num">{{ getLikeCount(profile) }}</span>
                  <span class="label">获赞</span>
                </div>
                <div class="stat-cell">
                  <span class="num">{{ getFollowCount(profile) }}</span>
                  <span class="label">关注</span>
                </div>
                <div class="stat-cell">
                  <span class="num">{{ getFansCount(profile) }}</span>
                  <span class="label">粉丝</span>
                </div>
              </div>

              <!-- 活跃状态与属性 Chip 标签组 -->
              <div class="app-chips-row">
                <span class="chip-item chip-online">
                  <span class="chip-status-dot"></span>
                  {{ formatLoginTime(profile.logintime) }}活跃
                </span>
                <span class="chip-item chip-glass" v-if="getGenderAgeTag(profile)">
                  <i :class="getGenderIcon(profile)"></i>
                  {{ getGenderAgeTag(profile) }}
                </span>
                <span class="chip-item chip-glass" v-if="getAstroTag(profile)">
                  <i class="fas fa-meteor chip-icon-astro"></i>
                  {{ getAstroTag(profile) }}
                </span>
                <span class="chip-item chip-glass" v-if="getCityTag(profile)">
                  <i class="fas fa-location-dot chip-icon-location"></i>
                  {{ getCityTag(profile) }}
                </span>
              </div>

              <!-- 他的装备 / 我的装备 高斯模糊毛玻璃通栏 Card -->
              <div class="equipment-entry-bar-glass" @click="activeTab = 'home'">
                <div class="equipment-left">
                  <i class="fas fa-laptop-code equipment-icon"></i>
                  <span class="equipment-title">{{ isSelfUser ? '我的装备' : '他的装备' }}</span>
                </div>
                <div class="equipment-right">
                  <span class="equipment-count">{{ profile.product_owner_count || 0 }}个装备</span>
                  <i class="fas fa-chevron-right arrow-icon"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- App 官方全系 Tab 栏 -->
        <div class="app-tab-navigation">
          <div class="tab-scroll-container custom-scrollbar-hidden">
            <button 
              v-for="tab in tabs" 
              :key="tab.key"
              :class="['app-tab-item', { 'active': activeTab === tab.key }]"
              @click="activeTab = tab.key"
            >
              <span class="tab-text">{{ tab.label }}</span>
              <span v-if="activeTab === tab.key" class="tab-indicator"></span>
            </button>
          </div>
        </div>
      </div>

    <!-- 各 Tab 内容展示区 -->
    <div class="tab-content-container">
      <!-- 1. 「主页」聚合视图 (关注的人 + 关注的板块 + 热门动态) -->
      <div v-if="activeTab === 'home'" class="home-aggregated-view">
        <!-- 我的卡片配置 -->
        <div v-if="isSelfUser && configEntries.length > 0" class="home-section-card">
          <div class="section-header">
            <h3 class="section-title">我的卡片配置</h3>
          </div>
          <div class="config-grid">
            <div v-for="entry in configEntries" :key="entry.key" class="config-item">
              <span class="config-key">{{ entry.key }}</span>
              <span class="config-value">{{ entry.value }}</span>
            </div>
          </div>
        </div>
        <!-- 模块 1：他/我关注的人 -->
        <div class="home-section-card">
          <div class="section-header">
            <h3 class="section-title">{{ isSelfUser ? '我关注的人' : '他关注的人' }}</h3>
            <i class="fas fa-chevron-right section-arrow"></i>
          </div>

          <div v-if="followNodes.length > 0" class="follow-nodes-row custom-scrollbar-hidden">
            <span class="node-chip node-chip-all">全部</span>
            <span v-for="node in followNodes" :key="node.id" class="node-chip">
              {{ node.title }}<span v-if="node.count > 0" class="node-count">{{ node.count }}</span>
            </span>
          </div>
          <div class="follow-users-grid custom-scrollbar-hidden" v-if="followingUsers.length > 0">
            <div v-for="user in followingUsers" :key="user.uid" class="follow-user-item" @click="openUserProfile(user)">
              <AppAvatar :src="user.userAvatar" size="lg" />
              <span class="follow-user-name">{{ user.username }}</span>
            </div>
          </div>
          <div v-else class="section-loading-placeholder">
            <div v-for="n in 5" :key="n" class="placeholder-user-item">
              <div class="placeholder-avatar"></div>
              <div class="placeholder-text"></div>
            </div>
          </div>
        </div>

        <!-- 模块 2：他/我关注的板块 -->
        <div class="home-section-card">
          <div class="section-header">
            <h3 class="section-title">{{ isSelfUser ? '我关注的板块' : '他关注的板块' }}</h3>
            <i class="fas fa-chevron-right section-arrow"></i>
          </div>
          <div class="follow-topics-grid custom-scrollbar-hidden" v-if="followTopics.length > 0">
            <div v-for="topic in followTopics" :key="topic.id || topic.name" class="follow-topic-item" @click="openFollowTopic(topic)">
              <div class="topic-icon-wrapper" :style="{ background: topic.bg }">
                <AppImage v-if="topic.icon" :src="topic.icon" image-class="topic-icon" />
                <i v-else :class="['fas', topic.fallbackIcon || 'fa-layer-group', 'topic-fallback-icon']"></i>
              </div>
              <span class="topic-name">{{ topic.name }}</span>
            </div>
          </div>
          <div v-else class="empty-section-tip">
            <span>{{ loadingTopics ? '正在加载关注板块...' : '暂无关注的板块' }}</span>
          </div>
        </div>

        <!-- 模块 2.5：常用设备（仅自己可见，点击一键应用到设备信息） -->
        <div v-if="isSelfUser && commonDevices.length > 0" class="home-section-card">
          <div class="section-header">
            <h3 class="section-title">我的常用设备</h3>
            <span class="section-sub-hint">点击设备一键应用到设置</span>
          </div>
          <div class="common-devices-grid">
            <button
              v-for="d in commonDevices"
              :key="d.name"
              class="common-device-item"
              :disabled="d.applying"
              @click="applyCommonDevice(d)"
              :title="d.name"
            >
              <i class="fas fa-mobile-alt common-device-icon"></i>
              <span class="common-device-name">{{ d.name }}</span>
              <span class="common-device-count">{{ d.count }} 次</span>
              <i v-if="d.applying" class="fas fa-spinner fa-spin common-device-spinner"></i>
            </button>
          </div>
        </div>

        <!-- 模块 3：热门动态 -->
        <div class="home-section-card no-padding">
          <div class="section-header with-padding">
            <h3 class="section-title">{{ isSelfUser ? '我的热门动态' : '他的热门动态' }}</h3>
            <i class="fas fa-chevron-right section-arrow"></i>
          </div>
          <div v-if="loadingFeeds" class="loading-wrapper">
            <LoadingState text="加载热门动态中..." />
          </div>
          <div v-else-if="userFeeds.length === 0" class="empty-wrapper">
            <EmptyState title="暂无热门动态" />
          </div>
          <div v-else class="feed-list">
            <FeedCard v-for="item in userFeeds.slice(0, 5)" :key="item.id" :feed="item" @deleted="handleFeedDeleted" />
          </div>
        </div>
      </div>

      <!-- 2. 「点评」视图 (带机主评分、多维参数打分及二级筛选) -->
      <div v-else-if="activeTab === 'rating'" class="rating-tab-view">
        <!-- 二级筛选分类条 (全部 / 只看应用 / 只看数码) -->
        <div class="sub-filter-row">
          <span class="filter-label">筛选</span>
          <div class="filter-pills">
            <button 
              v-for="f in ratingFilters" 
              :key="f.key"
              :class="['filter-pill', { 'active': activeRatingFilter === f.key }]"
              @click="activeRatingFilter = f.key"
            >
              {{ f.label }}
            </button>
          </div>
        </div>

        <div v-if="loadingFeeds" class="loading-wrapper">
          <LoadingState text="正在获取酷友点评..." />
        </div>
        <div v-else-if="userFeeds.length === 0" class="empty-wrapper">
          <EmptyState title="暂无点评记录" />
        </div>
        <div v-else class="feed-list">
          <RatingCard v-for="item in userFeeds" :key="item.id" :feed="item" />
        </div>
      </div>

      <!-- 3. 常规动态/回复/图文/二手 Tab 视图 -->
      <div v-else class="standard-feed-tab-view">
        <div v-if="loadingFeeds" class="loading-wrapper">
          <LoadingState text="正在加载内容..." />
        </div>
        <div v-else-if="userFeeds.length === 0" class="empty-wrapper">
          <EmptyState title="暂无相关内容" />
        </div>
        <div v-else class="feed-list">
          <FeedCard v-for="item in userFeeds" :key="item.id" :feed="item" @deleted="handleFeedDeleted" />
        </div>
      </div>

      <!-- 底部无限加载更多指示器 -->
      <div v-if="userFeedsLoadingMore" class="loading-more-footer">
        <i class="fas fa-circle-notch fa-spin"></i> 正在读取下一页动态...
      </div>
      <div v-else-if="userFeedsNoMore && userFeeds.length > 5" class="no-more-footer">
        已无更多动态内容
      </div>
    </div>
  </template>
</div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppAvatar from '../components/common/AppAvatar.vue';
import AppImage from '../components/common/AppImage.vue';
import FeedCard from '../components/feed/FeedCard.vue';
import RatingCard from '../components/feed/RatingCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { findPresetByDeviceTitle } from '../utils/devicePresets';
import { showToast } from '../utils/toast';
import { requestConfirmation } from '../utils/confirm';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const rawUid = computed(() => (route.params.uid as string) || 'me');

const effectiveUid = computed(() => {
  const rUid = rawUid.value;
  return String((!rUid || rUid === 'me') ? (authStore.user?.uid || '') : rUid);
});

const isSelfUser = computed(() => {
  if (!authStore.user?.uid) return false;
  return String(effectiveUid.value) === String(authStore.user.uid);
});

const loadingProfile = ref(false);
const loadingFeeds = ref(false);
const followLoading = ref(false);

const profile = ref<any>(null);
const userFeeds = ref<any[]>([]);

function handleFeedDeleted(id: string | number) {
  userFeeds.value = userFeeds.value.filter((f: any) => String(f.id) !== String(id));
}
const followingUsers = ref<any[]>([]);
const loadConfig = ref<any>(null);

const configEntries = computed<{ key: string; value: string }[]>(() => {
  const data = loadConfig.value;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ({
      key: k,
      value: typeof v === 'object' ? JSON.stringify(v) : String(v)
    }));
});

const activeTab = ref('home');
const tabs = [
  { key: 'home', label: '主页' },
  { key: 'feed', label: '动态' },
  { key: 'reply', label: '回复' },
  { key: 'rating', label: '点评' },
  { key: 'picture', label: '图文' },
  { key: 'ershou', label: '二手' }
];

const activeRatingFilter = ref('all');
const ratingFilters = [
  { key: 'all', label: '全部' },
  { key: 'app', label: '只看应用' },
  { key: 'digital', label: '只看数码' }
];

const followTopics = ref<any[]>([]);
const loadingTopics = ref(false);

// ---- 常用设备：统计自己动态里的发帖设备（deviceTitle），点击一键应用到设备信息 ----
interface CommonDevice {
  name: string;
  count: number;
  applying: boolean;
}

const commonDevices = computed<CommonDevice[]>(() => {
  if (!isSelfUser.value) return [];
  const counter = new Map<string, number>();
  for (const f of userFeeds.value) {
    const title = (f && (f.deviceTitle || f.device_title)) as string | undefined;
    if (title && typeof title === 'string' && title.trim()) {
      const t = title.trim();
      counter.set(t, (counter.get(t) || 0) + 1);
    }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, applying: false }));
});

function applyCommonDevice(device: CommonDevice) {
  const preset = findPresetByDeviceTitle(device.name);
  if (!preset) {
    showToast(`暂不支持机型模板：${device.name}`, 'error');
    return;
  }
  device.applying = true;
  const f = settingsStore.settings.deviceFingerprint;
  f.customFingerprint = true;
  f.model = preset.model;
  f.androidVersion = preset.androidVersion;
  f.build = preset.build;
  showToast(`已应用设备：${preset.label}`);
  setTimeout(() => {
    device.applying = false;
  }, 600);
}

const getFollowCount = (p: any) => p?.follow ?? p?.followNum ?? p?.follow_num ?? 0;
const getFansCount = (p: any) => p?.fans ?? p?.fansNum ?? p?.fans_num ?? 0;
const getLikeCount = (p: any) => p?.be_like_num ?? p?.likeNum ?? 0;

const getGenderIcon = (p: any) => {
  if (p?.gender === 1 || p?.gender === '1') return 'fas fa-mars gender-mars';
  if (p?.gender === 0 || p?.gender === '0' || p?.gender === 2) return 'fas fa-venus gender-venus';
  return 'fas fa-mars gender-mars';
};

const getGenderAgeTag = (p: any) => {
  const ageGroup = p?.age_group || p?.ageGroup || '95后';
  if (p?.gender === 1 || p?.gender === '1') return ageGroup;
  if (p?.gender === 0 || p?.gender === '0' || p?.gender === 2) return ageGroup;
  return ageGroup;
};

const getAstroTag = (p: any) => p?.astro || '天蝎座';

const getCityTag = (p: any) => {
  const city = p?.city || p?.province || p?.location;
  return city ? String(city).trim() : '';
};

const getAvatarUrlByUid = (uid: any) => {
  try {
    if (!uid) return '';
    const strUid = String(uid);
    const padded = strUid.padStart(9, '0');
    return `http://avatar.coolapk.com/data/${padded.slice(0, 3)}/${padded.slice(3, 5)}/${padded.slice(5, 7)}/${strUid.slice(-2)}_avatar_middle.jpg`;
  } catch { return ''; }
};

const formatLoginTime = (ts: any) => {
  try {
    if (!ts) return '刚刚';
    const numTs = Number(ts);
    if (isNaN(numTs) || numTs <= 0) return '刚刚';
    const date = new Date(numTs * 1000);
    const diffSec = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return '刚刚';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } catch { return '刚刚'; }
};

async function fetchUserProfile() {
  const targetUid = effectiveUid.value;
  if (!targetUid) return;

  loadingProfile.value = true;
  loadingTopics.value = true;
  try {
    const profRes = await CoolapkTauriAPI.getUserSpace(targetUid);
    if (profRes && profRes.data) {
      const spaceData = profRes.data;
      profile.value = {
        ...spaceData,
        ...(spaceData.userInfo || {})
      };

      // 从 spaceData.homeTabCardRows 中精准解析主页的各个组件卡片
      const homeCards = spaceData.homeTabCardRows || [];
      if (Array.isArray(homeCards)) {
        // 1. 解析 TA关注的人 卡片
        const followUsersCard = homeCards.find((c: any) => c.title && c.title.includes('关注的人'));
        if (followUsersCard && Array.isArray(followUsersCard.entities)) {
          followingUsers.value = followUsersCard.entities.map((u: any) => ({
            uid: u.uid || u.fuid,
            username: u.username || u.fusername || u.displayUsername || '酷友',
            userAvatar: u.userAvatar || u.fUserAvatar || u.avatar || getAvatarUrlByUid(u.uid || u.fuid)
          }));
        }

        // 2. 解析 TA关注的板块 卡片
        const followTopicsCard = homeCards.find((c: any) => c.title && c.title.includes('关注的板块'));
        if (followTopicsCard && Array.isArray(followTopicsCard.entities)) {
          followTopics.value = followTopicsCard.entities.map((b: any) => ({
            id: b.id || b.target_id,
            name: b.title || b.name || b.short_title || '板块',
            icon: b.logo || b.pic || b.icon || '',
            bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            fallbackIcon: 'fa-layer-group'
          }));
        }
      }
    } else {
      const backupProf = await CoolapkTauriAPI.getUserProfile(targetUid);
      if (backupProf && backupProf.data) {
        profile.value = {
          ...backupProf.data,
          ...(backupProf.data.userInfo || {})
        };
      }
    }
  } catch (err) {
    console.warn('获取用户信息异常:', err);
  } finally {
    loadingProfile.value = false;
    loadingTopics.value = false;
  }
}

async function fetchFollowingUsers() {
  const targetUid = effectiveUid.value;
  if (!targetUid) return;
  // 如果已经在 fetchUserProfile 的 homeTabCardRows 中拉到了，不再重复覆盖
  if (followingUsers.value.length > 0) return;

  try {
    const res = await CoolapkTauriAPI.getFollowUserList(targetUid, 1);
    const list = res?.data || res;
    if (Array.isArray(list) && list.length > 0) {
      followingUsers.value = list.slice(0, 10).map((u: any) => ({
        uid: u.uid || u.fuid,
        username: u.fusername || u.username || u.fUserInfo?.username || '酷友',
        userAvatar: u.fUserAvatar || u.userAvatar || u.fUserInfo?.userAvatar || getAvatarUrlByUid(u.uid || u.fuid)
      }));
    }
  } catch (e) {
    console.warn('获取关注列表接口异常:', e);
  }
}

const userFeedsPage = ref(1);
const userFeedsLoadingMore = ref(false);
const userFeedsNoMore = ref(false);

const followNodes = ref<any[]>([]);

async function fetchFollowNodes() {
  const targetUid = effectiveUid.value;
  if (!targetUid) return;
  try {
    const res = await CoolapkTauriAPI.getUserFollowNodes(targetUid);
    const list = res?.data || res;
    if (Array.isArray(list)) {
      followNodes.value = list.map((n: any) => ({
        id: n.id || n.nid,
        title: n.title || n.name || '未命名分组',
        count: Number(n.count || n.userCount || 0),
      }));
    }
  } catch (e) {
    console.warn('获取关注分组异常:', e);
  }
}

async function fetchTabFeeds(isRefresh: boolean = true) {
  const targetUid = effectiveUid.value;
  if (!targetUid) return;

  if (loadingFeeds.value || (userFeedsLoadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    userFeedsPage.value = 1;
    userFeedsNoMore.value = false;
    userFeeds.value = [];
    loadingFeeds.value = true;
  } else {
    if (userFeedsNoMore.value) return;
    userFeedsLoadingMore.value = true;
  }

  try {
    let list: any[] = [];
    if (activeTab.value === 'rating') {
      try {
        const ratingRes = await CoolapkTauriAPI.getUserRatingList(targetUid, userFeedsPage.value);
        list = (ratingRes && ratingRes.data && Array.isArray(ratingRes.data)) ? ratingRes.data : [];
      } catch (ratingErr) {
        console.warn('获取评分列表异常，回退到动态接口', ratingErr);
      }
    }
    if (list.length === 0) {
      const fetchType = activeTab.value === 'home' ? 'feed' : activeTab.value;
      const feedsRes = await CoolapkTauriAPI.getUserFeeds(targetUid, userFeedsPage.value, fetchType);
      list = (feedsRes && feedsRes.data && Array.isArray(feedsRes.data)) ? feedsRes.data : [];
    }

    if (list.length < 3) {
      userFeedsNoMore.value = true;
    }

    if (isRefresh) {
      userFeeds.value = list;
    } else {
      const existingIds = new Set(userFeeds.value.map((i: any) => i.id));
      const uniqueNew = list.filter((i: any) => !existingIds.has(i.id));
      userFeeds.value.push(...uniqueNew);
    }
    userFeedsPage.value++;
  } catch (err) {
    console.warn('获取动态列表异常:', err);
  } finally {
    loadingFeeds.value = false;
    userFeedsLoadingMore.value = false;
  }
}

function handleUserPageScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 220) {
    if (!loadingFeeds.value && !userFeedsLoadingMore.value && !userFeedsNoMore.value) {
      fetchTabFeeds(false);
    }
  }
}

async function toggleFollow() {
  if (!profile.value) return;
  followLoading.value = true;
  try {
    if (profile.value.isFollow) {
      await CoolapkTauriAPI.unfollowUser(effectiveUid.value);
      profile.value.isFollow = 0;
    } else {
      await CoolapkTauriAPI.followUser(effectiveUid.value);
      profile.value.isFollow = 1;
    }
  } catch (err) {
    console.error('关注失败:', err);
  } finally {
    followLoading.value = false;
  }
}

const isBlacklisted = ref(false);
const isIgnored = ref(false);
const blacklistLoading = ref(false);
const ignoreLoading = ref(false);

async function toggleBlacklist() {
  const uid = effectiveUid.value;
  if (!uid || blacklistLoading.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (!isBlacklisted.value) {
    const confirmed = await requestConfirmation({
      title: '拉黑用户',
      message: '确定要拉黑该用户吗？',
      confirmText: '拉黑',
      danger: true
    });
    if (!confirmed) return;
  }
  blacklistLoading.value = true;
  try {
    if (isBlacklisted.value) {
      await CoolapkTauriAPI.removeFromBlackList(uid);
      isBlacklisted.value = false;
      alert('已取消拉黑该用户');
    } else {
      await CoolapkTauriAPI.addToBlackList(uid);
      isBlacklisted.value = true;
      alert('已成功拉黑该用户');
    }
  } catch (err: any) {
    alert(err?.message || '拉黑操作失败，请稍后重试');
  } finally {
    blacklistLoading.value = false;
  }
}

async function toggleIgnore() {
  const uid = effectiveUid.value;
  if (!uid || ignoreLoading.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (!isIgnored.value) {
    const confirmed = await requestConfirmation({
      title: '屏蔽用户',
      message: '确定要屏蔽该用户吗？',
      confirmText: '屏蔽',
      danger: true
    });
    if (!confirmed) return;
  }
  ignoreLoading.value = true;
  try {
    if (isIgnored.value) {
      await CoolapkTauriAPI.removeFromIgnoreList(uid);
      isIgnored.value = false;
      alert('已取消屏蔽该用户');
    } else {
      await CoolapkTauriAPI.addToIgnoreList(uid);
      isIgnored.value = true;
      alert('已成功屏蔽该用户');
    }
  } catch (err: any) {
    alert(err?.message || '屏蔽操作失败，请稍后重试');
  } finally {
    ignoreLoading.value = false;
  }
}

function sendMessage() {
  if (effectiveUid.value) {
    router.push(`/messages?uid=${effectiveUid.value}`);
  }
}

function openUserProfile(user: any) {
  const uid = user?.uid || user?.id;
  if (uid) {
    router.push(`/user/${uid}`);
  }
}

function openFollowTopic(topic: any) {
  const name = topic?.name || topic?.title || topic?.tag;
  if (name) {
    router.push(`/topic/${encodeURIComponent(name)}`);
  }
}

async function fetchLoadConfig() {
  if (!isSelfUser.value) {
    loadConfig.value = null;
    return;
  }
  try {
    const res = await CoolapkTauriAPI.getLoadConfig();
    const data = res?.data || null;
    loadConfig.value = (data && typeof data === 'object' && Object.keys(data).length > 0) ? data : null;
  } catch (err) {
    console.warn('获取我的卡片配置失败', err);
  }
}

function handleGoBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/home');
  }
}

watch(effectiveUid, (newUid) => {
  isBlacklisted.value = false;
  isIgnored.value = false;
  if (newUid) {
    fetchUserProfile();
    fetchFollowingUsers();
    fetchFollowNodes();
    fetchLoadConfig();
    fetchTabFeeds();
  }
}, { immediate: true });

watch(activeTab, () => {
  fetchTabFeeds();
});
</script>

<style scoped>
.user-page-wrapper {
  width: 100%;
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: 40px;
}

.profile-debug-alert {
  padding: var(--space-4) var(--space-5);
  background-color: var(--surface);
  border: 1px dashed var(--brand-primary);
  border-radius: var(--radius-card);
  color: var(--brand-primary);
  font-size: var(--font-size-sub);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-4);
}

/* App 原生沉浸式 Header 整体卡片 */
.app-style-user-card {
  position: relative;
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 100%;
}

.banner-cover-area {
  position: relative;
  width: 100%;
  min-height: 420px;
  background-color: #2a2a2a;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  flex-shrink: 0;
}

.banner-cover-area :deep(.banner-cover-img) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.banner-cover-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e3a8a 0%, #065f46 100%);
}

.banner-cover-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.55) 60%, rgba(0, 0, 0, 0.85) 100%);
  z-index: 1;
}

.banner-top-bar {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.top-bar-right {
  display: flex;
  gap: 10px;
}

.icon-circle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-circle-btn:hover {
  background: rgba(0, 0, 0, 0.6);
  transform: scale(1.05);
}

.banner-hero-content {
  position: relative;
  z-index: 5;
  padding: 80px 20px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.banner-avatar-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 4px;
}

.app-hero-avatar {
  border: 3px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  background-color: var(--surface);
}

.banner-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.blacklist-manage-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.blacklist-manage-link:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
}

.btn-danger-glass {
  background: rgba(239, 68, 68, 0.85);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.btn-danger-glass:hover {
  background: rgba(220, 38, 38, 0.95);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.btn-danger-ghost {
  background: rgba(239, 68, 68, 0.35);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(239, 68, 68, 0.6);
}

.btn-danger-ghost:hover {
  background: rgba(239, 68, 68, 0.55);
}

.btn-blacklisted,
.btn-ignored {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.app-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 18px;
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-follow-primary {
  background: #10b981;
  color: #ffffff;
}

.btn-follow-primary:hover {
  background: #059669;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-following {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.btn-secondary-glass {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.btn-icon-glass {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

/* 沉浸式详情描述行 */
.user-details-area-immersive {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.username-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-username {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.app-user-level {
  font-size: 11px;
  font-weight: 800;
  font-style: italic;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
}

.app-verify-tag {
  font-size: 11px;
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.25);
  backdrop-filter: blur(8px);
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.app-user-bio {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.bio-icon {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.app-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 2px;
}

.stat-cell {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.stat-cell .num {
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.stat-cell .label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

.app-chips-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.chip-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.chip-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.9);
  display: inline-block;
  animation: pulse-dot 2s infinite ease-in-out;
}

@keyframes pulse-dot {
  0% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.15); }
  100% { opacity: 0.5; transform: scale(0.9); }
}

.gender-mars {
  color: #60a5fa;
  font-size: 11px;
}

.gender-venus {
  color: #f472b6;
  font-size: 11px;
}

.chip-icon-astro {
  color: #f59e0b;
  font-size: 10px;
}

.chip-icon-location {
  color: #38bdf8;
  font-size: 10px;
}

.chip-glass {
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.chip-glass:hover {
  background: rgba(255, 255, 255, 0.28);
  border-color: rgba(255, 255, 255, 0.4);
}

.chip-online {
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

/* 他的装备 Card 毛玻璃入口条 */
.equipment-entry-bar-glass {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  padding: 9px 14px;
  border-radius: 12px;
  margin-top: 2px;
  cursor: pointer;
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transition: all 0.2s ease;
}

.equipment-entry-bar-glass:hover {
  background: rgba(255, 255, 255, 0.24);
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
}

.equipment-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.equipment-icon {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.equipment-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.equipment-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.95);
}

/* App 风格全系 Tab 栏 */
.app-tab-navigation {
  border-top: 1px solid var(--border);
  padding: 0 16px;
}

.tab-scroll-container {
  display: flex;
  align-items: center;
  gap: 20px;
  overflow-x: auto;
  white-space: nowrap;
}

.app-tab-item {
  position: relative;
  height: 48px;
  background: transparent;
  border: none;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  padding: 0 4px;
  transition: color 0.2s;
}

.app-tab-item:hover {
  color: var(--text-primary);
}

.app-tab-item.active {
  font-size: 16px;
  font-weight: 700;
  color: #10b981;
}

.tab-indicator {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  background: #10b981;
  border-radius: 3px;
}

/* 各 Tab 内容与聚合模块 */
.tab-content-container {
  margin-top: 8px;
}

.home-aggregated-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.home-section-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.home-section-card.no-padding {
  padding: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-header.with-padding {
  padding: 16px 16px 0 16px;
  margin-bottom: 8px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.section-arrow {
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
}

.section-sub-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.common-devices-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.common-device-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.common-device-item:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.common-device-item:disabled {
  opacity: 0.6;
  cursor: default;
}

.common-device-icon {
  color: var(--brand-primary);
  font-size: 14px;
}

.common-device-name {
  font-weight: 600;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.common-device-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.common-device-spinner {
  font-size: 12px;
  color: var(--brand-primary);
}

.config-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  font-size: var(--font-size-caption);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.02));
  min-width: 0;
}

.config-key {
  flex-shrink: 0;
  min-width: 90px;
  color: var(--text-tertiary);
  word-break: break-all;
}

.config-value {
  min-width: 0;
  color: var(--text-primary);
  word-break: break-all;
}

.follow-users-grid {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.follow-nodes-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.node-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--background);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-pill);
  padding: 3px 10px;
  cursor: default;
}

.node-chip-all {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  background: var(--brand-soft);
  font-weight: var(--font-weight-medium);
}

.node-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.follow-user-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 64px;
  flex-shrink: 0;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-default);
}

.follow-user-item:hover {
  opacity: 0.75;
}

.follow-user-name {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.section-loading-placeholder {
  display: flex;
  gap: 16px;
}

.placeholder-user-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.placeholder-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--background-secondary);
}

.placeholder-text {
  width: 40px;
  height: 10px;
  border-radius: 4px;
  background: var(--background-secondary);
}

.follow-topics-grid {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.follow-topic-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 76px;
  flex-shrink: 0;
  background: var(--background-secondary, rgba(0, 0, 0, 0.02));
  padding: 10px 8px;
  border-radius: 10px;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.follow-topic-item:hover {
  border-color: var(--brand-primary);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.12);
}

.topic-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.topic-fallback-icon {
  color: #ffffff;
  font-size: 18px;
}

.topic-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.topic-name {
  font-size: 11px;
  color: var(--text-primary);
  font-weight: 500;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.2;
}

.loading-more-footer,
.no-more-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 0 24px;
  font-size: 12px;
  color: var(--text-tertiary, rgba(0, 0, 0, 0.35));
  user-select: none;
}

.no-more-footer::before,
.no-more-footer::after {
  content: '';
  width: 48px;
  height: 1px;
  background: var(--border-light, rgba(0, 0, 0, 0.08));
}

/* 点评 Tab Filter */
.sub-filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 0 4px;
}

.filter-label {
  font-size: 13px;
  color: var(--text-tertiary);
}

.filter-pills {
  display: flex;
  gap: 8px;
}

.filter-pill {
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-pill.active {
  background: var(--background-secondary, #e5e7eb);
  color: var(--text-primary);
  font-weight: 700;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.loading-wrapper,
.empty-wrapper {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-8);
  display: flex;
  justify-content: center;
}

.custom-scrollbar-hidden::-webkit-scrollbar {
  display: none;
}
.custom-scrollbar-hidden {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
