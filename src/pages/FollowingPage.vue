<template>
  <div class="page-container custom-scrollbar">
    <!-- 头部区域 -->
    <div class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title">
            <i class="fas fa-user-group icon"></i> 我关注的
          </h2>
          <span class="page-subtitle">已关注酷友与粉丝的最新动态列表</span>
        </div>

        <div v-if="authStore.isLoggedIn" class="header-actions">
          <AppButton
            variant="secondary"
            size="sm"
            icon="fas fa-sync-alt"
            :loading="loading"
            @click="loadFollowingFeeds(true)"
          >
            刷新动态
          </AppButton>
        </div>
      </div>
    </div>

    <!-- 未登录引导视图 -->
    <div v-if="!authStore.isLoggedIn" class="empty-wrapper login-guide-wrapper">
      <div class="login-guide-card">
        <i class="fas fa-user-lock guide-icon"></i>
        <h3>解锁关注动态与酷友动态</h3>
        <p>登录酷安账号后，在此处可实时查看您关注的所有酷友的最新动态与信息。</p>
        <AppButton variant="primary" icon="fas fa-sign-in-alt" @click="authStore.openLoginModal()">
          一键调起登录酷安账号
        </AppButton>
      </div>
    </div>

    <!-- 登录后的左右双列布局（左边：关注动态，右边：已关注酷友/粉丝列表侧边栏） -->
    <div v-else class="following-layout">
      <!-- 左栏：关注动态列表 -->
      <div class="following-main">
        <!-- 筛选提示条（如果选中了特定酷友） -->
        <div v-if="selectedUser" class="user-filter-bar">
          <div class="filter-user-info">
            <AppAvatar :src="selectedUser.userInfo?.userAvatar || selectedUser.fUserInfo?.userAvatar || selectedUser.fUserAvatar || selectedUser.userAvatar" size="sm" />
            <span class="filter-text">正在查看 <strong>{{ selectedUser.userInfo?.username || selectedUser.fUserInfo?.username || selectedUser.fusername || selectedUser.username }}</strong> 的动态</span>
          </div>
          <button class="clear-filter-btn" @click="selectUserFilter(null)">
            查看全部动态 <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- 加载中 -->
        <div v-if="loading && feeds.length === 0" class="loading-wrapper">
          <LoadingState text="正在获取关注动态..." />
        </div>

        <!-- 空状态 -->
        <div v-else-if="feeds.length === 0" class="empty-wrapper">
          <EmptyState title="暂无关注动态" description="关注列表中酷友暂未更新动态，去关注更多有趣的酷友吧！" />
        </div>

        <!-- 动态卡片列表 -->
        <div v-else class="feed-list-wrapper">
          <div class="feed-list">
            <FeedCard v-for="item in feeds" :key="item.id" :feed="item" @deleted="handleFeedDeleted" />
          </div>
          <div v-if="loadingMore" class="loading-more-footer">
            <i class="fas fa-circle-notch fa-spin"></i> 正在读取下一页动态...
          </div>
          <div v-else-if="noMore && feeds.length > 5" class="no-more-footer">
            已加载全部关注动态
          </div>
        </div>
      </div>

      <!-- 右栏：已关注酷友/粉丝 侧边栏 -->
      <div class="following-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-header">
            <!-- 酷友 / 粉丝 切换切页 -->
            <div class="sidebar-tabs">
              <button
                :class="['sidebar-tab-btn', { active: sidebarTab === 'users' }]"
                @click="switchSidebarTab('users')"
              >
                已关注 ({{ users.length }})
              </button>
              <button
                :class="['sidebar-tab-btn', { active: sidebarTab === 'fans' }]"
                @click="switchSidebarTab('fans')"
              >
                我的粉丝 ({{ fansUsers.length }})
              </button>
            </div>

            <div class="sidebar-search">
              <i class="fas fa-search search-icon"></i>
              <input
                v-model="userSearchQuery"
                type="text"
                :placeholder="sidebarTab === 'fans' ? '搜索粉丝...' : '搜索已关注酷友...'"
                class="sidebar-search-input"
              />
              <button v-if="userSearchQuery" class="clear-btn" @click="userSearchQuery = ''">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div v-if="(sidebarTab === 'users' ? usersLoading : fansLoading) && currentSourceList.length === 0" class="loading-wrapper">
            <LoadingState text="加载酷友中..." />
          </div>

          <div v-else-if="filteredUsers.length === 0" class="empty-wrapper">
            <EmptyState :title="sidebarTab === 'fans' ? '暂无粉丝' : '未找到匹配酷友'" />
          </div>

          <div v-else class="sidebar-user-list custom-scrollbar" @scroll="onSidebarScroll">
            <!-- 全部动态 汇总 -->
            <div
              v-if="sidebarTab === 'users'"
              :class="['sidebar-user-item', { active: !selectedUid }]"
              @click="selectUserFilter(null)"
            >
              <div class="all-icon-badge"><i class="fas fa-layer-group"></i></div>
              <div class="user-item-meta">
                <span class="user-item-name">全部动态</span>
                <span class="user-item-desc">汇总全部关注酷友动态</span>
              </div>
            </div>

            <!-- 用户列表项 -->
            <div
              v-for="u in filteredUsers"
              :key="getTargetUid(u)"
              :class="['sidebar-user-item', { active: String(selectedUid) === String(getTargetUid(u)) }]"
              @click="selectUserFilter(getTargetUid(u))"
            >
              <AppAvatar
                :src="u.userInfo?.userAvatar || u.fUserInfo?.userAvatar || u.fUserAvatar || u.userAvatar || u.avatar"
                :plugin-url="u.avatar_plugin_url"
                size="sm"
              />
              <div class="user-item-meta">
                <span class="user-item-name">{{ u.userInfo?.username || u.fUserInfo?.username || u.displayUsername || u.fusername || u.username || '酷友' }}</span>
                <span class="user-item-desc">{{ u.userInfo?.bio || u.fUserInfo?.bio || u.bio || u.sign || '酷安酷友' }}</span>
              </div>
              <button
                class="user-profile-btn"
                title="进入酷友主页"
                @click.stop="navigateToUser(getTargetUid(u))"
              >
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { shouldHideFeed } from '../utils/feedFilter';
import FeedCard from '../components/feed/FeedCard.vue';
import AppAvatar from '../components/common/AppAvatar.vue';
import AppButton from '../components/common/AppButton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const router = useRouter();
const route = useRoute();
const initialTab = String(route.query.tab || '');
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const loading = ref(false);
const usersLoading = ref(false);
const fansLoading = ref(false);
const feeds = ref<any[]>([]);
const users = ref<any[]>([]);
const fansUsers = ref<any[]>([]);
const selectedUid = ref<string | null>(null);
const userSearchQuery = ref('');
const sidebarTab = ref<'users' | 'fans'>('users');

function switchSidebarTab(tab: 'users' | 'fans') {
  sidebarTab.value = tab;
  if (tab === 'fans' && fansUsers.value.length === 0) {
    loadFansUsers();
  }
}

const currentSourceList = computed(() => {
  return sidebarTab.value === 'fans' ? fansUsers.value : users.value;
});

const filteredUsers = computed(() => {
  const list = currentSourceList.value;
  if (!userSearchQuery.value.trim()) return list;
  const q = userSearchQuery.value.trim().toLowerCase();
  return list.filter((u: any) => {
    const name = (u.userInfo?.username || u.fUserInfo?.username || u.displayUsername || u.fusername || u.username || '').toLowerCase();
    const bio = (u.userInfo?.bio || u.fUserInfo?.bio || u.bio || u.sign || '').toLowerCase();
    return name.includes(q) || bio.includes(q);
  });
});

const selectedUser = computed(() => {
  if (!selectedUid.value) return null;
  const allKnown = [...users.value, ...fansUsers.value];
  return allKnown.find((u: any) => String(getTargetUid(u)) === String(selectedUid.value));
});

function getTargetUid(u: any): string {
  if (!u) return '';
  const myUid = String(authStore.user?.uid || '');
  const fuidStr = String(u.fuid || '');
  const uidStr = String(u.uid || u.id || u.target_id || '');

  if (fuidStr && fuidStr !== myUid) return fuidStr;
  if (uidStr && uidStr !== myUid) return uidStr;
  return fuidStr || uidStr;
}

async function selectUserFilter(uid: string | null) {
  if (selectedUid.value === uid) return;
  selectedUid.value = uid;

  // 点击后立即瞬间重置到顶部（不带动画）
  const container = document.querySelector('.page-container') as HTMLElement;
  if (container) {
    container.scrollTop = 0;
  }

  await loadFollowingFeeds(true);
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

    const list = extractList(res).filter((i: any) => !shouldHideFeed(i, settingsStore.settings));
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

const usersPage = ref(1);
const usersHasMore = ref(true);
const fansPage = ref(1);
const fansHasMore = ref(true);

async function loadFollowUsers(isRefresh: boolean = true) {
  if (usersLoading.value) return;
  if (isRefresh) {
    usersPage.value = 1;
    usersHasMore.value = true;
    users.value = [];
  }
  if (!usersHasMore.value) return;

  usersLoading.value = true;
  try {
    const myUid = String(authStore.user?.uid || '1451266');
    let p = usersPage.value;
    // 自动连续翻页获取（单次最多同步读取 10 页 / 200 人，确保用户拥有的 50+ 关注酷友全部完整呈现）
    while (p <= 10) {
      const res = await CoolapkTauriAPI.getFollowUserList(myUid, p);
      const list = extractList(res);
      if (list.length === 0) {
        usersHasMore.value = false;
        break;
      }
      const existingUids = new Set(users.value.map(u => getTargetUid(u)));
      const uniqueNew = list.filter(u => !existingUids.has(getTargetUid(u)));
      users.value.push(...uniqueNew);
      p++;
      if (list.length < 20) {
        usersHasMore.value = false;
        break;
      }
    }
    usersPage.value = p;
  } catch (err) {
    console.error('获取关注用户列表失败:', err);
  } finally {
    usersLoading.value = false;
  }
}

async function loadFansUsers(isRefresh: boolean = true) {
  if (fansLoading.value) return;
  if (isRefresh) {
    fansPage.value = 1;
    fansHasMore.value = true;
    fansUsers.value = [];
  }
  if (!fansHasMore.value) return;

  fansLoading.value = true;
  try {
    const myUid = String(authStore.user?.uid || '1451266');
    let p = fansPage.value;
    while (p <= 10) {
      const res = await CoolapkTauriAPI.getFansList(myUid, p);
      const list = extractList(res);
      if (list.length === 0) {
        fansHasMore.value = false;
        break;
      }
      const existingUids = new Set(fansUsers.value.map(u => getTargetUid(u)));
      const uniqueNew = list.filter(u => !existingUids.has(getTargetUid(u)));
      fansUsers.value.push(...uniqueNew);
      p++;
      if (list.length < 20) {
        fansHasMore.value = false;
        break;
      }
    }
    fansPage.value = p;
  } catch (err) {
    console.error('获取粉丝用户列表失败:', err);
  } finally {
    fansLoading.value = false;
  }
}

function onSidebarScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
    if (sidebarTab.value === 'users' && usersHasMore.value && !usersLoading.value) {
      loadFollowUsers(false);
    } else if (sidebarTab.value === 'fans' && fansHasMore.value && !fansLoading.value) {
      loadFansUsers(false);
    }
  }
}

function syncTabFromRoute() {
  if (initialTab === 'fans') {
    switchSidebarTab('fans');
  }
}

function navigateToUser(uid: string | number) {
  if (!uid) return;
  router.push(`/user/${uid}`);
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
    if (!loading.value && !loadingMore.value && !noMore.value) {
      loadFollowingFeeds(false);
    }
  }
}

const onRefreshFeeds = () => {
  if (!loading.value && !loadingMore.value) {
    loadFollowingFeeds(true);
  }
};

function handleFeedDeleted(id: string | number) {
  feeds.value = feeds.value.filter((f: any) => String(f.id) !== String(id));
}

onMounted(() => {
  if (authStore.isLoggedIn) {
    loadFollowUsers();
    loadFollowingFeeds(true);
    syncTabFromRoute();
  }
  window.addEventListener('scroll', onScrollEvent, true);
  window.addEventListener('refresh-feeds', onRefreshFeeds);
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScrollEvent, true);
  window.removeEventListener('refresh-feeds', onRefreshFeeds);
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0;
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-titles {
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

.following-layout {
  display: flex;
  gap: var(--space-5);
  align-items: flex-start;
  width: 100%;
}

.following-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.user-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background-color: var(--brand-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-card);
}

.filter-user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
}

.clear-filter-btn {
  border: none;
  background: transparent;
  color: var(--brand-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.clear-filter-btn:hover {
  text-decoration: underline;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.following-sidebar {
  width: 320px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
}

.sidebar-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 120px);
}

.sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar-tabs {
  display: flex;
  background-color: var(--background);
  border-radius: var(--radius-pill);
  padding: 3px;
  gap: 4px;
  border: 1px solid var(--border);
}

.sidebar-tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 5px 8px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.sidebar-tab-btn.active {
  background-color: var(--brand-primary);
  color: white;
  font-weight: 700;
}

.sidebar-search {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.sidebar-search .search-icon {
  position: absolute;
  left: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.sidebar-search-input {
  width: 100%;
  height: 32px;
  padding: 0 28px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--background);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  transition: all var(--duration-fast);
}

.sidebar-search-input:focus {
  border-color: var(--brand-primary);
}

.clear-btn {
  position: absolute;
  right: 8px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 11px;
}

.sidebar-user-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  padding-right: 4px;
}

.sidebar-user-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast);
  border: 1px solid transparent;
}

.sidebar-user-item:hover {
  background-color: var(--surface-hover);
}

.sidebar-user-item.active {
  background-color: var(--brand-soft);
  border-color: var(--brand-primary);
}

.all-icon-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.user-item-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-user-item.active .user-item-name {
  color: var(--brand-primary);
}

.user-item-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-profile-btn {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px;
  transition: color var(--duration-fast);
}

.user-profile-btn:hover {
  color: var(--brand-primary);
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

@media (max-width: 900px) {
  .following-layout {
    flex-direction: column-reverse;
  }
  .following-sidebar {
    width: 100%;
    position: static;
  }
  .sidebar-card {
    max-height: none;
  }
}
</style>
