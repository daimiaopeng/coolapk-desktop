<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i class="fas fa-user-group icon"></i> 我关注的</h2>
        <span class="page-subtitle">已关注酷友的最新动态与信息列表</span>
      </div>

      <!-- 选项卡导航 -->
      <div class="tab-subnav">
        <button
          :class="['subnav-btn', { active: activeTab === 'feeds' }]"
          @click="switchTab('feeds')"
        >
          <i class="fas fa-stream"></i>
          关注动态
        </button>
        <button
          :class="['subnav-btn', { active: activeTab === 'users' }]"
          @click="switchTab('users')"
        >
          <i class="fas fa-users"></i>
          已关注酷友
        </button>
      </div>
    </div>

    <!-- 图 2 同款：【我关注的人】水平微缩滚动横卡 -->
    <div v-if="authStore.isLoggedIn && users.length > 0" class="following-users-bar">
      <div class="bar-header">
        <span class="bar-title">我关注的人</span>
        <span class="bar-more" @click="switchTab('users')">
          <i class="fas fa-chevron-right"></i>
        </span>
      </div>
      <div class="users-scroll-list custom-scrollbar">
        <!-- 全部 / 汇总 选项 -->
        <div 
          :class="['user-item-pill', { active: !selectedUid }]"
          @click="selectUserFilter(null)"
        >
          <div class="avatar-ring">
            <div class="all-icon-avatar"><i class="fas fa-layer-group"></i></div>
          </div>
          <span class="user-name">全部动态</span>
        </div>

        <!-- 关注酷友列表单项 -->
        <div 
          v-for="u in users" 
          :key="getTargetUid(u)" 
          :class="['user-item-pill', { active: String(selectedUid) === String(getTargetUid(u)) }]"
          @click="selectUserFilter(getTargetUid(u))"
        >
          <div class="avatar-ring">
            <AppAvatar 
              :src="u.fUserAvatar || u.userAvatar" 
              :plugin-url="u.avatar_plugin_url"
              size="md" 
            />
          </div>
          <span class="user-name">{{ u.fusername || u.username || '酷友' }}</span>
        </div>
      </div>
    </div>

    <!-- 未登录引导视图 -->
    <div v-if="!authStore.isLoggedIn" class="empty-wrapper login-guide-wrapper">
      <div class="login-guide-card">
        <i class="fas fa-user-lock guide-icon"></i>
        <h3>解锁关注动态与酷友动态</h3>
        <p>登录酷安账号后，在此处可实时看您关注的所有酷友的最新动态与信息。</p>
        <AppButton variant="primary" icon="fas fa-sign-in-alt" @click="authStore.openLoginModal()">
          一键调起登录酷安账号
        </AppButton>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-else-if="loading" class="loading-wrapper">
      <LoadingState :text="activeTab === 'feeds' ? '正在获取关注人的动态...' : '正在获取已关注酷友列表...'" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="activeTab === 'feeds' && feeds.length === 0" class="empty-wrapper">
      <EmptyState title="暂无关注动态" description="可能您的关注列表中酷友暂未更新动态，去关注更多有趣的酷友吧！" />
    </div>
    <div v-else-if="activeTab === 'users' && users.length === 0" class="empty-wrapper">
      <EmptyState title="暂无关注的酷友" description="在酷安社区发现并关注你感兴趣的酷友吧" />
    </div>

    <!-- Tab 1: 关注动态列表 -->
    <div v-else-if="activeTab === 'feeds'" class="feed-list-wrapper">
      <div class="feed-list">
        <FeedCard v-for="item in feeds" :key="item.id" :feed="item" />
      </div>
      <!-- 底部触底无限加载更多指示器 -->
      <div v-if="loadingMore" class="loading-more-footer">
        <i class="fas fa-circle-notch fa-spin"></i> 正在读取下一页关注动态...
      </div>
      <div v-else-if="noMore && feeds.length > 5" class="no-more-footer">
        已加载全部关注动态
      </div>
    </div>

    <!-- Tab 2: 已关注酷友用户列表 -->
    <div v-else class="user-grid">
      <div v-for="u in users" :key="getTargetUid(u)" class="user-card">
        <div class="user-info-area" @click="navigateToUser(getTargetUid(u))">
          <AppAvatar :src="u.fUserAvatar || u.userAvatar" size="md" />
          <div class="user-text">
            <span class="username">{{ u.fusername || u.username || '酷友' }}</span>
            <span class="subtext">{{ u.bio || '暂无个性签名' }}</span>
          </div>
        </div>
        <div class="card-actions">
          <AppButton variant="secondary" size="sm" icon="fas fa-paper-plane" @click="handleSendMessage(getTargetUid(u))">
            私信
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import FeedCard from '../components/feed/FeedCard.vue';
import AppAvatar from '../components/common/AppAvatar.vue';
import AppButton from '../components/common/AppButton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<'feeds' | 'users'>('feeds');
const loading = ref(false);
const feeds = ref<any[]>([]);
const users = ref<any[]>([]);

function switchTab(tab: 'feeds' | 'users') {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  if (tab === 'feeds' && feeds.value.length === 0) {
    loadFollowingFeeds();
  } else if (tab === 'users' && users.value.length === 0) {
    loadFollowUsers();
  }
}

const selectedUid = ref<string | null>(null);

function getTargetUid(u: any): string {
  if (!u) return '';
  const myUid = String(authStore.user?.uid || '');
  const fuidStr = String(u.fuid || '');
  const uidStr = String(u.uid || '');
  const idStr = String(u.id || u.target_id || '');

  if (fuidStr && fuidStr !== myUid) return fuidStr;
  if (uidStr && uidStr !== myUid) return uidStr;
  return fuidStr || uidStr || idStr;
}

async function selectUserFilter(uid: string | null) {
  if (selectedUid.value === uid) return;
  selectedUid.value = uid;
  activeTab.value = 'feeds';
  loadFollowingFeeds(true);
}

function extractList(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.rows)) return res.rows;
  if (Array.isArray(res.data?.rows)) return res.data.rows;
  if (Array.isArray(res.data?.list)) return res.data.list;
  return [];
}

const page = ref(1);
const loadingMore = ref(false);
const noMore = ref(false);

async function loadFollowingFeeds(isRefresh: boolean = false) {
  if (loading.value || (loadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    feeds.value = [];
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }

  try {
    const res = selectedUid.value
      ? await CoolapkTauriAPI.getUserFeeds(selectedUid.value, page.value, 'feed')
      : await CoolapkTauriAPI.getFollowingFeeds(page.value);

    const list = extractList(res);
    if (list.length < 3) {
      noMore.value = true;
    }

    if (isRefresh) {
      feeds.value = list;
    } else {
      const existingIds = new Set(feeds.value.map(i => i.id));
      const uniqueNew = list.filter(i => !existingIds.has(i.id));
      feeds.value.push(...uniqueNew);
    }
    page.value++;
  } catch (err) {
    console.error('获取关注动态失败:', err);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadFollowUsers() {
  try {
    const myUid = authStore.user?.uid || '1451266';
    const res = await CoolapkTauriAPI.getFollowUserList(myUid, 1);
    users.value = extractList(res);
  } catch (err) {
    console.error('获取关注用户列表失败:', err);
  }
}

function navigateToUser(uid: string | number) {
  if (!uid) return;
  router.push(`/user/${uid}`);
}

function handleSendMessage(uid: string | number) {
  router.push('/messages');
}

function onScrollEvent(e: Event) {
  const el = e.target as HTMLElement;
  let scrollDiff = 999;
  if (el && el.scrollHeight) {
    scrollDiff = el.scrollHeight - el.scrollTop - el.clientHeight;
  } else {
    const docEl = document.documentElement;
    scrollDiff = docEl.scrollHeight - window.scrollY - window.innerHeight;
  }

  if (scrollDiff < 260) {
    if (!loading.value && !loadingMore.value && !noMore.value && activeTab.value === 'feeds') {
      loadFollowingFeeds(false);
    }
  }
}

onMounted(() => {
  loadFollowUsers();
  loadFollowingFeeds(true);
  window.addEventListener('scroll', onScrollEvent, true);
});

import { onUnmounted } from 'vue';
onUnmounted(() => {
  window.removeEventListener('scroll', onScrollEvent, true);
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
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title .icon {
  color: var(--brand-primary);
}

.page-subtitle {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
}

/* 图 2 同款：【我关注的人】横排滚动组件样式 */
.following-users-bar {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  border-radius: var(--radius-lg, 16px);
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
}

.bar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.bar-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.bar-more {
  font-size: 13px;
  color: var(--text-tertiary, #999);
  cursor: pointer;
  transition: color 0.2s;
}

.bar-more:hover {
  color: var(--brand-primary, #10b981);
}

.users-scroll-list {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 6px;
}

.user-item-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  flex-shrink: 0;
  width: 64px;
}

.avatar-ring {
  padding: 2px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.user-item-pill.active .avatar-ring {
  border-color: var(--brand-primary, #10b981);
  transform: scale(1.05);
}

.all-icon-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--brand-soft, rgba(16, 185, 129, 0.1));
  color: var(--brand-primary, #10b981);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.user-name {
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 64px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.user-item-pill.active .user-name {
  color: var(--brand-primary, #10b981);
  font-weight: 600;
}

.login-guide-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.login-guide-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 420px;
  padding: 40px 30px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.04);
}

.guide-icon {
  font-size: 42px;
  color: var(--brand-primary, #10b981);
  margin-bottom: 16px;
}

.login-guide-card h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.login-guide-card p {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.tab-subnav {
  display: flex;
  background-color: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-pill);
  padding: 3px;
  gap: 4px;
}

.subnav-btn {
  border: none;
  background: transparent;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all var(--duration-fast);
}

.subnav-btn.active {
  background-color: var(--brand-primary);
  color: white;
  font-weight: bold;
}

.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.user-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  transition: all var(--duration-fast);
}

.user-card:hover {
  border-color: var(--brand-soft);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.user-info-area {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  flex: 1;
  overflow: hidden;
}

.user-text {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.username {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.subtext {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
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
</style>
