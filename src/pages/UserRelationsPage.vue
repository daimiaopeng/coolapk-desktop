<template>
  <div class="relations-page-container custom-scrollbar" @scroll="handleScroll">
    <!-- 顶栏与标签切换 -->
    <header class="relations-header">
      <div class="header-left">
        <button class="back-btn" title="返回" @click="router.back()">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="header-tabs">
          <button
            :class="['tab-btn', { active: relation === 'follow' }]"
            @click="switchRelation('follow')"
          >
            关注列表
          </button>
          <button
            :class="['tab-btn', { active: relation === 'fans' }]"
            @click="switchRelation('fans')"
          >
            粉丝列表
          </button>
        </div>
      </div>
    </header>

    <!-- 主体内容区 -->
    <main class="relations-content">
      <!-- 初始加载状态 -->
      <div v-if="loading && !users.length" class="state-wrapper">
        <LoadingState :text="`正在加载${relation === 'fans' ? '粉丝' : '关注'}列表...`" />
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error && !users.length" class="state-wrapper">
        <ErrorState title="列表加载失败" :message="error" @retry="load(true)" />
      </div>

      <!-- 空列表状态 -->
      <div v-else-if="!users.length" class="state-wrapper">
        <EmptyState
          :title="relation === 'fans' ? '暂无粉丝' : '暂无关注用户'"
          :description="relation === 'fans' ? '还没有酷友关注该用户' : '该用户还没有关注任何人'"
        />
      </div>

      <!-- 酷友用户列表 -->
      <div v-else class="user-list">
        <div
          v-for="(user, index) in users"
          :key="String(user.uid || user.id || index)"
          class="user-card"
          @click="openUser(user)"
        >
          <div class="user-card-main">
            <AppAvatar
              :src="getAvatarUrl(user)"
              :plugin-url="user.avatar_plugin_url || user.userInfo?.avatar_plugin_url"
              size="md"
              class="user-avatar"
            />
            <div class="user-meta">
              <div class="user-title-row">
                <span class="user-name">{{ getUserName(user) }}</span>
                <span v-if="user.level || user.userInfo?.level" class="user-level-badge">
                  Lv.{{ user.level || user.userInfo?.level }}
                </span>
                <span v-if="isFriend(user)" class="relation-badge friend">
                  <i class="fas fa-arrows-alt-h"></i> 互相关注
                </span>
                <span v-else-if="isSpecial(user)" class="relation-badge special">
                  <i class="fas fa-star"></i> 特别关注
                </span>
              </div>
              <p class="user-bio">
                <span class="user-uid-label">UID: {{ user.uid || user.fuid }}</span>
                <span v-if="getBio(user)" class="bio-separator">·</span>
                <span v-if="getBio(user)" class="bio-text">{{ getBio(user) }}</span>
              </p>
            </div>
          </div>

          <!-- 关注 / 取消关注交互按钮 -->
          <div class="user-card-action" @click.stop>
            <button
              :class="['follow-action-btn', { 'is-following': isFollowed(user) }]"
              :disabled="user._followingLoading"
              @click="handleFollowToggle(user)"
            >
              <i v-if="user._followingLoading" class="fas fa-circle-notch fa-spin"></i>
              <i v-else-if="isFollowed(user)" class="fas fa-check"></i>
              <i v-else class="fas fa-plus"></i>
              <span>{{ user._followingLoading ? '处理中' : (isFollowed(user) ? '已关注' : '关注') }}</span>
            </button>
          </div>
        </div>

        <!-- 底部加载更多指示器 -->
        <div class="pagination-footer">
          <div v-if="loading && users.length" class="loading-more-text">
            <i class="fas fa-circle-notch fa-spin"></i> 正在加载更多...
          </div>
          <div v-else-if="!hasMore && users.length > 8" class="no-more-text">
            已无更多用户
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import AppAvatar from '../components/common/AppAvatar.vue';
import EmptyState from '../components/common/EmptyState.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { normalizeEntityPage } from '../types/userSpace';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const users = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);
const error = ref('');

const uid = computed(() => String(route.params.uid || ''));
const relation = computed(() => route.params.relation === 'fans' ? 'fans' : 'follow');

function switchRelation(target: 'follow' | 'fans') {
  if (target === relation.value) return;
  void router.replace(`/user/${uid.value}/relations/${target}`);
}

function getUserName(user: any): string {
  const info = user.fUserInfo || user.userInfo || {};
  return String(
    user.fusername ||
    user.username ||
    info.username ||
    info.displayUserName ||
    user.displayUsername ||
    user.name ||
    '酷友'
  );
}

function getAvatarUrl(user: any): string {
  const info = user.fUserInfo || user.userInfo || {};
  const raw = user.fUserAvatar || user.userAvatar || info.userAvatar || info.avatar || user.avatar;
  if (raw && typeof raw === 'string') return raw;
  const targetUid = user.uid || user.fuid || info.uid;
  if (!targetUid) return '';
  const str = String(targetUid).padStart(9, '0');
  return `https://avatar.coolapk.com/data/${str.slice(0, 3)}/${str.slice(3, 5)}/${str.slice(5, 7)}/${String(targetUid).slice(-2)}_avatar_middle.jpg`;
}

function getBio(user: any): string {
  const info = user.fUserInfo || user.userInfo || {};
  return String(user.bio || user.signature || info.bio || info.signature || '').trim();
}

function isFollowed(user: any): boolean {
  const val = user.isFollow ?? user.is_follow ?? user.fUserInfo?.isFollow ?? user.userInfo?.isFollow;
  return val === 1 || val === '1' || val === true;
}

function isFriend(user: any): boolean {
  const val = user.isFriend ?? user.isfriend ?? user.fUserInfo?.isFriend ?? user.userInfo?.isFriend;
  return val === 1 || val === '1' || val === true;
}

function isSpecial(user: any): boolean {
  const val = user.isSpecialFollow ?? user.is_special_follow ?? user.fUserInfo?.isSpecialFollow ?? user.userInfo?.isSpecialFollow;
  return val === 1 || val === '1' || val === true;
}

async function handleFollowToggle(user: any) {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const targetUid = String(user.uid || user.fuid || user.id || '');
  if (!targetUid || user._followingLoading) return;

  const current = isFollowed(user);
  user._followingLoading = true;
  try {
    if (current) {
      await CoolapkTauriAPI.unfollowUser(targetUid);
      user.isFollow = 0;
      if (user.fUserInfo) user.fUserInfo.isFollow = 0;
      if (user.userInfo) user.userInfo.isFollow = 0;
    } else {
      await CoolapkTauriAPI.followUser(targetUid);
      user.isFollow = 1;
      if (user.fUserInfo) user.fUserInfo.isFollow = 1;
      if (user.userInfo) user.userInfo.isFollow = 1;
    }
  } catch (err: any) {
    alert(err?.message || '操作失败，请重试');
  } finally {
    user._followingLoading = false;
  }
}

async function load(refresh = false) {
  if (!uid.value || loading.value || (!refresh && !hasMore.value)) return;
  if (refresh) {
    page.value = 1;
    users.value = [];
    hasMore.value = true;
    error.value = '';
  }
  loading.value = true;
  try {
    const response: any = relation.value === 'fans'
      ? await CoolapkTauriAPI.getFansList(uid.value, page.value)
      : await CoolapkTauriAPI.getFollowUserList(uid.value, page.value);
    const normalized = normalizeEntityPage(response, page.value);
    const list = normalized.items;
    const known = new Set(users.value.map((user) => String(user.uid || user.fuid || user.id || '')));
    const incoming = list.filter((user: any) => !known.has(String(user.uid || user.fuid || user.id || '')));
    users.value = refresh ? incoming : [...users.value, ...incoming];
    page.value = Math.max(page.value + 1, normalized.page + 1);
    hasMore.value = normalized.hasMore;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '用户列表加载失败';
  } finally {
    loading.value = false;
  }
}

function openUser(user: any) {
  const target = user.uid || user.fuid || user.id;
  if (target) void router.push(`/user/${target}`);
}

function handleScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
    if (!loading.value && hasMore.value) {
      void load(false);
    }
  }
}

watch([uid, relation], () => {
  void load(true);
}, { immediate: true });
</script>

<style scoped>
.relations-page-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--background, #f4f6f8);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.relations-header {
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  max-width: var(--feed-max-width, 760px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--surface, #ffffff);
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  backdrop-filter: blur(16px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.15s ease;
}

.back-btn:hover {
  background: var(--surface-hover, rgba(0, 0, 0, 0.05));
  transform: translateX(-2px);
}

.header-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: var(--surface-hover, rgba(0, 0, 0, 0.04));
}

.tab-btn.active {
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, 0.1));
}

.relations-content {
  width: 100%;
  max-width: var(--feed-max-width, 760px);
  padding: 16px;
  flex: 1;
}

.state-wrapper {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  border-radius: var(--radius-card, 12px);
  padding: 48px 24px;
  margin-top: 8px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  border-radius: var(--radius-card, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.user-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  background: var(--surface-hover, #fafafa);
}

.user-card-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}

.user-avatar {
  flex-shrink: 0;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.user-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.user-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-level-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--brand-soft, rgba(16, 185, 129, 0.12));
  color: var(--brand-primary, #10b981);
}

.relation-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.relation-badge.friend {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.relation-badge.special {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.user-bio {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-uid-label {
  flex-shrink: 0;
  color: var(--text-quaternary, #9ca3af);
}

.bio-separator {
  flex-shrink: 0;
  color: var(--text-quaternary, #9ca3af);
}

.bio-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-card-action {
  flex-shrink: 0;
}

.follow-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
}

.follow-action-btn:hover {
  filter: brightness(1.06);
  transform: scale(1.02);
}

.follow-action-btn.is-following {
  background: var(--surface-hover, rgba(0, 0, 0, 0.06));
  color: var(--text-secondary);
  border-color: var(--border, rgba(0, 0, 0, 0.1));
}

.follow-action-btn.is-following:hover {
  color: var(--danger, #ef4444);
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
}

.pagination-footer {
  padding: 20px 0;
  text-align: center;
}

.loading-more-text,
.no-more-text {
  font-size: 13px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
