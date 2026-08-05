<template>
  <div class="page-container custom-scrollbar">
    <!-- 顶栏返回工具条 -->
    <div class="detail-nav-bar">
      <button class="back-btn" @click="handleGoBack">
        <i class="fas fa-arrow-left"></i>
        <span>返回</span>
      </button>
      <span v-if="profile?.username" class="nav-app-name">{{ profile.username }} 的个人空间</span>
    </div>

    <!-- 调试信息提示 -->
    <div v-if="!profile" class="profile-debug-alert">
      <i class="fas fa-spinner fa-spin"></i> 正在加载 UID 为 {{ effectiveUid || '未识别' }} 的酷安空间信息...
    </div>

    <!-- 用户个人头卡 -->
    <div v-if="profile" class="user-banner-card" style="display: flex !important; visibility: visible !important; min-height: 120px;">
      <!-- 酷安空间背景封面 -->
      <div class="user-cover-wrapper">
        <AppImage v-if="profile.cover" :src="profile.cover" image-class="user-cover-img" />
        <div class="user-cover-placeholder"></div>
      </div>

      <div class="user-banner-body">
        <div class="user-banner-header">
          <AppAvatar 
            :src="profile.userAvatar || getAvatarUrlByUid(profile.uid)" 
            :plugin-url="profile.avatar_plugin_url"
            size="xl" 
            class="user-avatar-overlap" 
          />
          <div class="user-info-main">
            <div class="user-name-line">
              <h2 class="username">{{ profile.username }}</h2>
              <span class="user-level" v-if="profile.level">Lv.{{ profile.level }}</span>
              <span v-if="profile.isDeveloper || profile.verify_title" class="verify-badge">
                <i class="fas fa-check-circle"></i> {{ profile.verify_title || '酷安开发者' }}
              </span>
            </div>

            <!-- 升级经验值进度条 -->
            <div class="level-progress-bar-wrapper" v-if="profile.next_level_percentage">
              <div class="level-progress-fill" :style="{ width: `${profile.next_level_percentage}%` }"></div>
              <span class="level-progress-text">EXP {{ profile.experience || 0 }} / {{ profile.next_level_experience || 0 }}</span>
            </div>

            <div class="user-meta-row">
              <span class="user-id">UID: {{ profile.uid }}</span>
              <span class="user-reg-date" v-if="getRegYears(profile.regdate)">
                <i class="far fa-calendar-alt"></i> {{ getRegYears(profile.regdate) }}
              </span>
              <span v-if="profile.logintime" class="user-last-online">
                <i class="far fa-clock"></i> 活跃于 {{ formatLoginTime(profile.logintime) }}
              </span>
            </div>

            <p class="user-bio">{{ profile.bio || '这个酷友很懒，什么也没留下' }}</p>
          </div>
          
          <div class="user-actions">
            <AppButton variant="secondary" icon="fas fa-envelope" @click="sendMessage">发送私信</AppButton>
            <AppButton 
              v-if="!isSelfUser"
              :variant="profile.isFollow ? 'secondary' : 'primary'" 
              :icon="profile.isFollow ? 'fas fa-check' : 'fas fa-plus'" 
              :loading="followLoading"
              @click="toggleFollow"
            >
              {{ profile.isFollow ? (profile.isSpecialFollow ? '特别关注' : '已关注') : '关注' }}
            </AppButton>
          </div>
        </div>
        
        <!-- 全量统计指标卡片 -->
        <div class="user-stats">
          <div class="stat-item">
            <span class="stat-value">{{ getFollowCount(profile) }}</span>
            <span class="stat-label">关注</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ getFansCount(profile) }}</span>
            <span class="stat-label">粉丝</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ getFeedCount(profile) }}</span>
            <span class="stat-label">动态</span>
          </div>
          <div class="stat-item" v-if="getLikeCount(profile) > 0">
            <span class="stat-value">{{ getLikeCount(profile) }}</span>
            <span class="stat-label">获赞</span>
          </div>
          <div class="stat-item" v-if="profile.replyNum">
            <span class="stat-value">{{ profile.replyNum }}</span>
            <span class="stat-label">互动</span>
          </div>
          <div class="stat-item" v-if="profile.product_owner_count">
            <span class="stat-value">{{ profile.product_owner_count }}</span>
            <span class="stat-label">设备</span>
          </div>
          <div class="stat-item" v-if="profile.apkRatingNum">
            <span class="stat-value">{{ profile.apkRatingNum }}</span>
            <span class="stat-label">点评</span>
          </div>
          <div class="stat-item" v-if="profile.albumNum">
            <span class="stat-value">{{ profile.albumNum }}</span>
            <span class="stat-label">图集</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 标签页 -->
    <div class="user-tabs-container" v-if="profile">
      <div class="user-tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.key"
          :class="['tab-item', { 'is-active': activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          <span class="tab-label">{{ tab.label }}</span>
          <span v-if="activeTab === tab.key" class="coolapk-tab-indicator"></span>
        </button>
      </div>
    </div>

    <!-- 动态列表 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在加载内容..." />
    </div>

    <div v-else-if="userFeeds.length === 0" class="empty-wrapper">
      <EmptyState title="暂无内容" />
    </div>

    <div v-else class="feed-list">
      <FeedCard v-for="item in userFeeds" :key="item.id" :feed="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppAvatar from '../components/common/AppAvatar.vue';
import AppImage from '../components/common/AppImage.vue';
import AppButton from '../components/common/AppButton.vue';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const rawUid = computed(() => (route.params.uid as string) || 'me');

const effectiveUid = computed(() => {
  const rUid = rawUid.value;
  const res = (!rUid || rUid === 'me') ? (authStore.user?.uid || '') : rUid;
  return res;
});

const isSelfUser = computed(() => {
  if (!authStore.user?.uid) return false;
  return String(effectiveUid.value) === String(authStore.user.uid);
});

const loading = ref(false);
const followLoading = ref(false);
const profile = ref<any>(null);
const userFeeds = ref<any[]>([]);

const activeTab = ref('feed');
const tabs = [
  { key: 'feed', label: '动态' },
  { key: 'coolpic', label: '酷图' }
];

const getFollowCount = (p: any) => {
  try {
    return p?.follow ?? p?.followNum ?? p?.follow_num ?? 0;
  } catch { return 0; }
};
const getFansCount = (p: any) => {
  try {
    return p?.fans ?? p?.fansNum ?? p?.fans_num ?? 0;
  } catch { return 0; }
};
const getFeedCount = (p: any) => {
  try {
    return p?.feed ?? p?.feedNum ?? p?.feed_num ?? 0;
  } catch { return 0; }
};
const getLikeCount = (p: any) => {
  try {
    return p?.be_like_num ?? p?.likeNum ?? 0;
  } catch { return 0; }
};

const getRegYears = (regdate: any) => {
  try {
    if (!regdate) return '';
    const numDate = Number(regdate);
    if (isNaN(numDate) || numDate <= 0) return '';
    const regYear = new Date(numDate * 1000).getFullYear();
    const currentYear = new Date().getFullYear();
    const years = currentYear - regYear;
    return years > 0 ? `${years}年酷友 (${regYear}入驻)` : `${regYear}入驻`;
  } catch { return ''; }
};

const getAvatarUrlByUid = (uid: any) => {
  try {
    if (!uid) return '';
    const strUid = String(uid);
    const padded = strUid.padStart(9, '0');
    const p1 = padded.slice(0, 3);
    const p2 = padded.slice(3, 5);
    const p3 = padded.slice(5, 7);
    return `http://avatar.coolapk.com/data/${p1}/${p2}/${p3}/${strUid.slice(-2)}_avatar_middle.jpg`;
  } catch { return ''; }
};

const formatLoginTime = (ts: any) => {
  try {
    if (!ts) return '';
    const numTs = Number(ts);
    if (isNaN(numTs) || numTs <= 0) return '';
    const date = new Date(numTs * 1000);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return '刚刚';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } catch { return ''; }
};

async function fetchUserProfile() {
  const targetUid = effectiveUid.value;
  if (!targetUid) return;

  if (profile.value && String(profile.value.uid) !== String(targetUid)) {
    profile.value = null;
  }

  try {
    const profRes = await CoolapkTauriAPI.getUserSpace(targetUid);
    if (profRes && profRes.data) {
      const spaceData = profRes.data;
      const userInfo = spaceData.userInfo || {};
      const merged = {
        ...spaceData,
        ...userInfo
      };
      if (merged.username || merged.uid) {
        profile.value = merged;
        return;
      }
    }
    
    // 降级尝试 getUserProfile
    const backupProf = await CoolapkTauriAPI.getUserProfile(targetUid);
    if (backupProf && backupProf.data) {
      const backupData = backupProf.data;
      const backupUserInfo = backupData.userInfo || {};
      profile.value = {
        ...backupData,
        ...backupUserInfo
      };
      return;
    }

    // 终极防御兜底：确保界面100%能成功渲染出卡片框架
    profile.value = {
      uid: targetUid,
      username: `酷友_${String(targetUid).slice(-4)}`,
      userAvatar: getAvatarUrlByUid(targetUid),
      level: 1,
      bio: '这个酷友很懒，什么也没留下',
      feed: 0,
      fans: 0,
      follow: 0
    };
  } catch (err) {
    console.warn('获取用户信息异常:', err);
    profile.value = {
      uid: targetUid,
      username: `酷友_${String(targetUid).slice(-4)}`,
      userAvatar: getAvatarUrlByUid(targetUid),
      level: 1,
      bio: '用户信息加载失败，请重试',
      feed: 0,
      fans: 0,
      follow: 0
    };
  }
}

async function fetchFeeds(page: number = 1) {
  const targetUid = effectiveUid.value;
  if (!targetUid) return;

  loading.value = true;
  try {
    const feedsRes = await CoolapkTauriAPI.getUserFeeds(targetUid, page, activeTab.value);
    if (feedsRes && feedsRes.data && Array.isArray(feedsRes.data)) {
      userFeeds.value = feedsRes.data;
    }
  } catch (err) {
    console.warn('获取用户动态异常:', err);
  } finally {
    loading.value = false;
  }
}

async function toggleFollow() {
  if (!profile.value) return;
  followLoading.value = true;
  try {
    if (profile.value.isFollow) {
      await CoolapkTauriAPI.unfollowUser(effectiveUid.value);
      profile.value.isFollow = 0;
      if (profile.value.fansNum) profile.value.fansNum--;
      if (profile.value.fans) profile.value.fans--;
    } else {
      await CoolapkTauriAPI.followUser(effectiveUid.value);
      profile.value.isFollow = 1;
      if (profile.value.fansNum !== undefined) profile.value.fansNum++;
      if (profile.value.fans !== undefined) profile.value.fans++;
    }
  } catch (err) {
    console.error('关注操作失败:', err);
  } finally {
    followLoading.value = false;
  }
}

function sendMessage() {
  const targetUid = effectiveUid.value;
  if (targetUid) {
    router.push(`/messages?uid=${targetUid}`);
  }
}

function handleGoBack() {
  if (window.history.state && window.history.state.back) {
    router.back();
  } else {
    router.push('/home');
  }
}

watch(effectiveUid, (newUid) => {
  if (newUid) {
    fetchUserProfile();
    fetchFeeds(1);
  }
}, { immediate: true });

watch(activeTab, () => {
  fetchFeeds(1);
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.detail-nav-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.back-btn:hover {
  background-color: var(--surface-hover);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.nav-app-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
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
}

.user-banner-card {
  position: relative;
  overflow: hidden;
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  transition: all var(--duration-normal) var(--ease-default);
}

.user-banner-card:hover {
  box-shadow: var(--shadow-md);
}

.user-cover-wrapper {
  width: 100%;
  height: 140px;
  overflow: hidden;
  position: relative;
  background-color: var(--background-secondary);
}

.user-cover-wrapper :deep(.user-cover-img) {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.user-cover-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--brand-soft), var(--brand-primary));
  opacity: 0.35;
  z-index: 0;
}

.user-banner-body {
  padding: var(--space-5) var(--space-6) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.user-banner-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-5);
}

.user-avatar-overlap {
  flex-shrink: 0;
  margin-top: -42px;
  border: 3px solid var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background: var(--surface);
  z-index: 2;
}

.user-info-main {
  flex: 1;
  min-width: 0;
}

.user-name-line {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-1);
}

.username {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-level {
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  font-style: italic;
  color: #fff;
  background: var(--brand-primary);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

.verify-badge {
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  color: #0084ff;
  background: rgba(0, 132, 255, 0.1);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.user-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
}

.user-last-online {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.user-reg-date {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.level-progress-bar-wrapper {
  position: relative;
  width: 220px;
  height: 16px;
  background: var(--background-secondary, rgba(0, 0, 0, 0.06));
  border-radius: var(--radius-pill);
  overflow: hidden;
  margin: 4px 0 8px 0;
}

.level-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-soft), var(--brand-primary));
  border-radius: var(--radius-pill);
  transition: width 0.3s ease;
}

.level-progress-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  color: var(--text-secondary);
}

.user-id {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin-bottom: 0;
}

.user-bio {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
  word-break: break-all;
}

.user-actions {
  display: flex;
  gap: var(--space-3);
  flex-shrink: 0;
}

.user-stats {
  display: flex;
  gap: var(--space-8);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.stat-value {
  font-size: var(--font-size-title);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.stat-label {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
}

.user-tabs-container {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 0 var(--space-4);
  box-shadow: var(--shadow-sm);
}

.user-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  height: 52px;
}

.tab-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 6px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
  white-space: nowrap;
  background: transparent;
  cursor: pointer;
  border: none;
  outline: none;
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.is-active {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 16px;
}

.coolapk-tab-indicator {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 4px;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
  animation: tabSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
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
</style>
