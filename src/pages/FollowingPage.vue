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

    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-wrapper">
      <LoadingState :text="activeTab === 'feeds' ? '正在获取关注人的动态...' : '正在获取已关注酷友列表...'" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="activeTab === 'feeds' && feeds.length === 0" class="empty-wrapper">
      <EmptyState title="暂无关注动态" description="去关注更多有趣的酷友，他们的最新精选动态将展示在此处" />
    </div>
    <div v-else-if="activeTab === 'users' && users.length === 0" class="empty-wrapper">
      <EmptyState title="暂无关注的酷友" description="在酷安社区发现并关注你感兴趣的酷友吧" />
    </div>

    <!-- Tab 1: 关注动态列表 -->
    <div v-else-if="activeTab === 'feeds'" class="feed-list">
      <FeedCard v-for="item in feeds" :key="item.id" :feed="item" />
    </div>

    <!-- Tab 2: 已关注酷友用户列表 -->
    <div v-else class="user-grid">
      <div v-for="u in users" :key="u.fuid || u.uid" class="user-card">
        <div class="user-info-area" @click="navigateToUser(u.fuid || u.uid)">
          <AppAvatar :src="u.fUserAvatar || u.userAvatar" size="md" />
          <div class="user-text">
            <span class="username">{{ u.fusername || u.username || '酷友' }}</span>
            <span class="subtext">{{ u.bio || '暂无个性签名' }}</span>
          </div>
        </div>
        <div class="card-actions">
          <AppButton variant="secondary" size="sm" icon="fas fa-paper-plane" @click="handleSendMessage(u.fuid || u.uid)">
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

async function loadFollowingFeeds() {
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getFollowingFeeds(1);
    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      feeds.value = list;
    }
  } catch (err) {
    console.error('获取关注动态失败:', err);
  } finally {
    loading.value = false;
  }
}

async function loadFollowUsers() {
  loading.value = true;
  try {
    const myUid = authStore.user?.uid || '1451266';
    const res = await CoolapkTauriAPI.getFollowUserList(myUid, 1);
    const list = res?.data || res || [];
    if (Array.isArray(list)) {
      users.value = list;
    }
  } catch (err) {
    console.error('获取关注用户列表失败:', err);
  } finally {
    loading.value = false;
  }
}

function navigateToUser(uid: string | number) {
  if (!uid) return;
  router.push(`/user/${uid}`);
}

function handleSendMessage(uid: string | number) {
  router.push('/messages');
}

onMounted(() => {
  loadFollowingFeeds();
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
</style>
