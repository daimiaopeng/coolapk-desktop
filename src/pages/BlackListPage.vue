<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="page-header">
      <button class="btn-back" @click="goBack" title="返回上一页">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div class="header-main">
        <h2 class="page-title"><i class="fas fa-user-slash icon"></i> 黑名单</h2>
        <span class="page-subtitle">管理已拉黑、屏蔽与限制的酷友</span>
      </div>
    </div>

    <div class="source-tabs">
      <button
        :class="['source-tab', { active: activeTab === 'black' }]"
        @click="switchTab('black')"
      >
        拉黑
      </button>
      <button
        :class="['source-tab', { active: activeTab === 'ignore' }]"
        @click="switchTab('ignore')"
      >
        屏蔽
      </button>
      <button
        :class="['source-tab', { active: activeTab === 'limit' }]"
        @click="switchTab('limit')"
      >
        限制
      </button>
    </div>

    <!-- 未登录：登录引导 -->
    <div v-if="!authStore.isLoggedIn" class="empty-wrapper">
      <EmptyState title="登录后查看黑名单" description="登录酷安账号后，此处将展示您拉黑与屏蔽的用户" />
      <div class="login-hint">
        <AppButton variant="primary" size="sm" @click="authStore.openLoginModal()">立即登录</AppButton>
      </div>
    </div>

    <!-- 已登录：列表 -->
    <template v-else>
      <div v-if="loading && items.length === 0" class="loading-wrapper">
        <LoadingState text="正在获取名单..." />
      </div>

      <div v-else-if="error && items.length === 0" class="error-wrapper">
        <ErrorState title="名单加载失败" :message="error" @retry="fetchItems(true)" />
      </div>

      <div v-else-if="items.length === 0 && !loading" class="empty-wrapper">
        <EmptyState :title="emptyTitle" description="暂无用户，去逛逛吧" />
      </div>

      <div v-else class="user-list">
        <div v-for="item in items" :key="item.uid" class="user-item">
          <div class="user-info" @click="goUser(item)">
            <AppAvatar :src="item.userAvatar || getAvatarUrlByUid(item.uid)" size="md" />
            <div class="user-text">
              <span class="user-name">{{ item.username || '酷友' }}</span>
              <span class="user-uid">UID {{ item.uid }}</span>
              <span v-if="activeTab === 'limit' && item.bio" class="user-bio">{{ item.bio }}</span>
            </div>
          </div>
          <AppButton
            v-if="activeTab !== 'limit'"
            variant="danger"
            size="sm"
            :loading="removingUid === item.uid"
            :disabled="removingUid !== '' && removingUid !== item.uid"
            @click="removeItem(item)"
          >
            移出
          </AppButton>
        </div>
        <div class="pagination-footer">
          <LoadingState v-if="loadingMore" text="加载更多中..." />
          <div v-else-if="noMore" class="no-more">没有更多内容了</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { navigateBack } from '../utils/navigation';
import AppButton from '../components/common/AppButton.vue';
import AppAvatar from '../components/common/AppAvatar.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<'black' | 'ignore' | 'limit'>('black');
const items = ref<any[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const page = ref(1);
const noMore = ref(false);
const removingUid = ref('');

const emptyTitle = computed(() => {
  if (activeTab.value === 'black') return '暂无拉黑用户';
  if (activeTab.value === 'ignore') return '暂无屏蔽用户';
  return '暂无限制用户';
});

function switchTab(tab: 'black' | 'ignore' | 'limit') {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  page.value = 1;
  noMore.value = false;
  items.value = [];
  error.value = '';
  if (authStore.isLoggedIn) void fetchItems(true);
}

function getAvatarUrlByUid(uid: any) {
  try {
    if (!uid) return '';
    const strUid = String(uid);
    const padded = strUid.padStart(9, '0');
    return `http://avatar.coolapk.com/data/${padded.slice(0, 3)}/${padded.slice(3, 5)}/${padded.slice(5, 7)}/${strUid.slice(-2)}_avatar_middle.jpg`;
  } catch { return ''; }
}

function goBack() {
  navigateBack(router);
}

function goUser(item: any) {
  if (item.uid) router.push(`/user/${item.uid}`);
}

async function fetchItems(isRefresh = false) {
  if (!authStore.isLoggedIn) return;
  if (loading.value || (loadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    items.value = [];
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  error.value = '';

  try {
    const res = activeTab.value === 'black'
      ? await CoolapkTauriAPI.getBlackList(page.value)
      : activeTab.value === 'ignore'
        ? await CoolapkTauriAPI.getIgnoreList(page.value)
        : await CoolapkTauriAPI.getLimitList(page.value);
    const raw = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (raw.length === 0) {
      noMore.value = true;
    } else {
      const mapped = raw
        .map((u: any) => ({
          uid: String(u.uid || u.fuid || ''),
          username: u.username || u.fusername || u.displayUsername || u.userInfo?.username || '酷友',
          userAvatar: u.userAvatar || u.fUserAvatar || u.userInfo?.userAvatar || '',
          bio: u.bio || u.sign || u.userInfo?.bio || ''
        }))
        .filter((u: any) => u.uid);
      if (isRefresh) {
        items.value = mapped;
      } else {
        const existingIds = new Set(items.value.map((i: any) => i.uid));
        items.value.push(...mapped.filter((i: any) => !existingIds.has(i.uid)));
      }
      page.value++;
    }
  } catch (err: any) {
    error.value = err?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function removeItem(item: any) {
  if (removingUid.value) return;
  removingUid.value = item.uid;
  try {
    if (activeTab.value === 'black') {
      await CoolapkTauriAPI.removeFromBlackList(item.uid);
    } else {
      await CoolapkTauriAPI.removeFromIgnoreList(item.uid);
    }
    items.value = items.value.filter((i: any) => i.uid !== item.uid);
    alert('已将该用户移出名单');
  } catch (err: any) {
    alert(err?.message || '移出失败，请稍后重试');
  } finally {
    removingUid.value = '';
  }
}

function handleScroll(e: Event) {
  if (!authStore.isLoggedIn) return;
  const el = e.target as HTMLElement;
  if (!el) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
    if (!loading.value && !loadingMore.value && !noMore.value) {
      void fetchItems(false);
    }
  }
}

watch(
  () => authStore.user?.uid,
  () => {
    if (!authStore.isLoggedIn) return;
    if (items.value.length === 0) void fetchItems(true);
  }
);

onMounted(() => {
  if (authStore.isLoggedIn) void fetchItems(true);
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
  margin-bottom: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.btn-back {
  border: none;
  background: transparent;
  font-size: 18px;
  color: var(--text-primary);
  cursor: pointer;
  padding: 4px 0;
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

.source-tabs {
  display: flex;
  gap: var(--space-5);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-4);
}

.source-tab {
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px 2px;
  margin-bottom: -1px;
}

.source-tab.active {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
  border-bottom: 2px solid var(--brand-primary, #10b981);
}

.login-hint {
  margin-top: var(--space-3);
  text-align: center;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-3) var(--space-4);
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color var(--duration-fast) var(--ease-default);
}

.user-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  background-color: var(--surface-hover);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.user-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-uid {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.user-bio {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.loading-wrapper,
.empty-wrapper,
.error-wrapper {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-8);
  display: flex;
  justify-content: center;
  flex-direction: column;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}
</style>
