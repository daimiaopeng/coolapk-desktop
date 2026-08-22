<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="top-nav-bar">
      <div class="nav-title-box">
        <span class="nav-title">我的动态号</span>
      </div>
      <div class="nav-right-actions">
        <button class="btn-create-dyh" @click="openDyhHub">发现更多</button>
      </div>
    </div>

    <div v-if="!authStore.isLoggedIn" class="login-prompt">
      <EmptyState title="登录后查看我的动态号" description="登录账号后即可查看你关注、订阅和管理的动态号">
        <button class="btn-login" @click="authStore.openLoginModal()">立即登录</button>
      </EmptyState>
    </div>

    <template v-else>
      <div class="dyh-tabs custom-scrollbar">
        <button
          v-for="tab in dyhTabs"
          :key="tab.key"
          :class="['dyh-tab-item', { active: activeTab === tab.key }]"
          @click="selectTab(tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span v-if="activeTab === tab.key" class="tab-line"></span>
        </button>
      </div>

      <div v-if="loading && list.length === 0" class="loading-wrapper">
        <LoadingState text="正在加载动态号列表..." />
      </div>

      <div v-else-if="error && list.length === 0" class="error-wrapper">
        <ErrorState title="加载失败" message="无法获取动态号列表，请确认已登录后重试" @retry="refreshCurrent" />
      </div>

      <div v-else-if="list.length === 0 && !loading" class="empty-wrapper">
        <EmptyState :title="emptyTitle" :description="emptyDescription">
          <button class="btn-create-dyh" @click="openDyhHub">去发现动态号</button>
        </EmptyState>
      </div>

      <div v-else class="dyh-list">
        <article
          v-for="dyh in list"
          :key="dyh.id || dyh.entityId || dyh.title"
          class="dyh-card"
          @click="openDyh(dyh)"
        >
          <div class="dyh-avatar-wrapper">
            <AppImage
              v-if="dyhAvatar(dyh)"
              :src="dyhAvatar(dyh)"
              class="dyh-avatar"
              fit="cover"
              :alt="dyhTitle(dyh)"
            />
            <div v-else class="dyh-avatar-fallback">
              <i class="fas fa-building-columns"></i>
            </div>
          </div>

          <div class="dyh-info">
            <h3 class="dyh-card-title">{{ dyhTitle(dyh) }}</h3>
            <p v-if="dyhDesc(dyh)" class="dyh-card-desc">{{ dyhDesc(dyh) }}</p>
            <div class="dyh-card-meta">
              <span v-if="dyhFollownum(dyh)">{{ dyhFollownum(dyh) }} 关注</span>
              <span v-if="isFollowed(dyh)" class="is-followed">已关注</span>
            </div>
          </div>

          <button
            class="btn-unfollow"
            @click.stop="toggleUnfollow(dyh)"
            :disabled="unfollowingId === String(dyh.id || dyh.entityId)"
          >
            <i class="fas fa-minus"></i> 取消关注
          </button>
        </article>

        <div class="pagination-footer">
          <LoadingState v-if="loading && page > 1" text="加载更多中..." />
          <button v-else-if="error && list.length > 0" class="retry-inline" @click="refreshCurrent">加载失败，点击重试</button>
          <div v-else-if="noMore" class="no-more">没有更多动态号了</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';
import type { DyhEntity } from '../types/content';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref('follow');
const dyhTabs = [
  { key: 'follow', label: '我关注的' },
  { key: 'subscribe', label: '我订阅的' },
  { key: 'manage', label: '我管理的' },
];

const list = ref<DyhEntity[]>([]);
const page = ref(1);
const loading = ref(false);
const noMore = ref(false);
const error = ref(false);
const unfollowingId = ref('');

const emptyTitle = computed(() => {
  if (activeTab.value === 'follow') return '还没有关注的动态号';
  if (activeTab.value === 'subscribe') return '还没有订阅的动态号';
  return '还没有管理的动态号';
});

const emptyDescription = computed(() => {
  if (activeTab.value === 'manage') return '在动态号详情页关注或订阅后，即可在此管理';
  return '在动态号详情页点击关注/订阅后，会出现在这里';
});

function dyhAvatar(dyh: DyhEntity): string {
  return dyh.dyhAvatar || dyh.avatar || dyh.userAvatar || dyh.logo || dyh.pic || '';
}

function dyhTitle(dyh: DyhEntity): string {
  return dyh.dyhName || dyh.dyhTitle || dyh.title || dyh.name || String(dyh.id || '未命名动态号');
}

function dyhDesc(dyh: DyhEntity): string {
  return dyh.dyhDescription || dyh.description || '';
}

function dyhFollownum(dyh: DyhEntity): string {
  const n = Number(dyh.follownum ?? dyh.fans ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

function isFollowed(dyh: DyhEntity): boolean {
  return !!(dyh.isFollow ?? dyh.isFollowed ?? dyh.is_follow ?? dyh.follow ?? false);
}

async function fetchList(isLoadMore = false) {
  if (!authStore.isLoggedIn || loading.value || noMore.value) return;
  loading.value = true;
  if (!isLoadMore) error.value = false;
  try {
    let res: any;
    if (activeTab.value === 'follow') {
      res = await CoolapkTauriAPI.getMyDyhFollowList(page.value);
    } else if (activeTab.value === 'subscribe') {
      res = await CoolapkTauriAPI.getMyDyhSubscribeList(page.value);
    } else {
      res = await CoolapkTauriAPI.getMyDyhEditorList(page.value);
    }
    const newList = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (newList.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        list.value.push(...newList);
      } else {
        list.value = newList;
      }
      page.value++;
    }
  } catch (err) {
    error.value = true;
    console.warn('获取动态号列表失败', err);
  } finally {
    loading.value = false;
  }
}

function selectTab(key: string) {
  if (activeTab.value === key) return;
  activeTab.value = key;
  page.value = 1;
  noMore.value = false;
  error.value = false;
  list.value = [];
  void fetchList(false);
}

function refreshCurrent() {
  page.value = 1;
  noMore.value = false;
  list.value = [];
  void fetchList(false);
}

function openDyh(dyh: DyhEntity) {
  const id = dyh.id || dyh.entityId;
  if (id) {
    router.push({ path: `/dyh/${id}` });
  }
}

function openDyhHub() {
  router.push({ path: '/search', query: { q: '动态号' } });
}

async function toggleUnfollow(dyh: DyhEntity) {
  const id = String(dyh.id || dyh.entityId || '');
  if (!id || unfollowingId.value) return;
  unfollowingId.value = id;
  try {
    await CoolapkTauriAPI.unfollowDyh(id);
    list.value = list.value.filter((item: DyhEntity) => String(item.id || item.entityId) !== id);
  } catch (err) {
    console.warn('取消关注动态号失败', err);
  } finally {
    unfollowingId.value = '';
  }
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    if (!loading.value && !noMore.value) {
      void fetchList(true);
    }
  }
}

void fetchList(false);
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width, 860px);
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.top-nav-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  margin-bottom: 2px;
}

.nav-title-box {
  flex: 1;
  text-align: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--brand-primary, #10b981);
}

.nav-right-actions {
  flex-shrink: 0;
}

.btn-create-dyh {
  height: 30px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-create-dyh:hover {
  border-color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.btn-login {
  height: 34px;
  padding: 0 22px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.login-prompt {
  padding: var(--space-10) 0;
}

.dyh-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  overflow-x: auto;
}

.dyh-tab-item {
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 2px;
  white-space: nowrap;
}

.dyh-tab-item.active {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.tab-line {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  background: var(--brand-primary, #10b981);
  border-radius: 2px;
}

.loading-wrapper,
.error-wrapper,
.empty-wrapper {
  padding: var(--space-8) 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.dyh-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dyh-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.dyh-card:hover {
  background-color: var(--surface-hover);
  border-color: var(--brand-primary);
}

.dyh-avatar-wrapper {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background-color: var(--background);
}

.dyh-avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--brand-soft), var(--brand-soft-hover));
  font-size: 22px;
  color: var(--brand-primary);
}

.dyh-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dyh-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.dyh-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dyh-card-meta {
  display: flex;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.dyh-card-meta .is-followed {
  color: var(--brand-primary);
}

.btn-unfollow {
  flex-shrink: 0;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--background-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-unfollow:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
}

.btn-unfollow:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}

.retry-inline {
  border: 0;
  background: transparent;
  color: var(--brand-primary, #10b981);
  font-size: 12px;
  cursor: pointer;
}
</style>