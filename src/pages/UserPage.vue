<template>
  <div class="page-container custom-scrollbar">
    <!-- 用户个人头卡 -->
    <div v-if="profile" class="user-banner">
      <div class="user-banner-header">
        <AppAvatar :src="profile.userAvatar" size="xl" class="user-avatar" />
        <div class="user-info-main">
          <div class="user-name-line">
            <h2 class="username">{{ profile.username }}</h2>
            <span class="user-level" v-if="profile.level">Lv.{{ profile.level }}</span>
          </div>
          <div class="user-id">UID: {{ profile.uid }}</div>
          <p class="user-bio">{{ profile.bio || '这个酷友很懒，什么也没留下' }}</p>
        </div>
        <div class="user-actions">
          <AppButton variant="secondary" icon="fas fa-envelope" @click="sendMessage">发送私信</AppButton>
          <AppButton 
            :variant="profile.isFollow ? 'secondary' : 'primary'" 
            :icon="profile.isFollow ? 'fas fa-check' : 'fas fa-plus'" 
            :loading="followLoading"
            @click="toggleFollow"
          >
            {{ profile.isFollow ? '已关注' : '关注' }}
          </AppButton>
        </div>
      </div>
      
      <div class="user-stats">
        <div class="stat-item">
          <span class="stat-value">{{ profile.followNum || 0 }}</span>
          <span class="stat-label">关注</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ profile.fansNum || 0 }}</span>
          <span class="stat-label">粉丝</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ profile.feedNum || 0 }}</span>
          <span class="stat-label">动态</span>
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
          {{ tab.label }}
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
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppAvatar from '../components/common/AppAvatar.vue';
import AppButton from '../components/common/AppButton.vue';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const uid = (route.params.uid as string) || 'me';

const loading = ref(false);
const followLoading = ref(false);
const profile = ref<any>(null);
const userFeeds = ref<any[]>([]);

const activeTab = ref('feed');
const tabs = [
  { key: 'feed', label: '动态' },
  { key: 'coolpic', label: '酷图' }
];

async function fetchUserProfile() {
  try {
    const profRes = await CoolapkTauriAPI.getUserSpace(uid);
    if (profRes && profRes.data) {
      profile.value = profRes.data;
    } else {
      // 如果 getUserSpace 没有返回有效数据，降级尝试 getUserProfile
      const backupProf = await CoolapkTauriAPI.getUserProfile(uid);
      if (backupProf && backupProf.data) {
        profile.value = backupProf.data;
      }
    }
  } catch (err) {
    console.warn('获取用户信息失败:', err);
  }
}

async function fetchFeeds(page: number = 1) {
  loading.value = true;
  userFeeds.value = [];
  try {
    const feedsRes = await CoolapkTauriAPI.getUserFeeds(uid, page, activeTab.value);
    if (feedsRes && feedsRes.data && Array.isArray(feedsRes.data)) {
      userFeeds.value = feedsRes.data;
    }
  } catch (err) {
    console.warn('获取用户动态失败:', err);
  } finally {
    loading.value = false;
  }
}

async function toggleFollow() {
  if (!profile.value) return;
  followLoading.value = true;
  try {
    if (profile.value.isFollow) {
      await CoolapkTauriAPI.unfollowUser(uid);
      profile.value.isFollow = 0;
      if (profile.value.fansNum) profile.value.fansNum--;
    } else {
      await CoolapkTauriAPI.followUser(uid);
      profile.value.isFollow = 1;
      if (profile.value.fansNum !== undefined) profile.value.fansNum++;
    }
  } catch (err) {
    console.error('关注操作失败:', err);
  } finally {
    followLoading.value = false;
  }
}

function sendMessage() {
  // TODO: 跳转到消息页或唤起私信对话框
  console.log('发送私信至 UID:', uid);
}

watch(activeTab, () => {
  fetchFeeds(1);
});

onMounted(async () => {
  await fetchUserProfile();
  await fetchFeeds(1);
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

.user-banner {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  transition: all var(--duration-normal) var(--ease-default);
}

.user-banner:hover {
  box-shadow: var(--shadow-md);
}

.user-banner-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-5);
}

.user-avatar {
  flex-shrink: 0;
  border: 2px solid var(--surface);
  box-shadow: var(--shadow-sm);
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
  background: linear-gradient(135deg, var(--brand-primary), #36cfc9);
  padding: 2px 8px;
  border-radius: 4px;
  line-height: 1.2;
}

.user-id {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
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
  gap: var(--space-2);
  height: 52px;
}

.tab-item {
  padding: 6px 16px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
  white-space: nowrap;
  background: transparent;
  cursor: pointer;
  border: none;
}

.tab-item:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.tab-item.is-active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
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
