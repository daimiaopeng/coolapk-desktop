<template>
  <MobileUserFeature
    :profile="profileView"
    :tabs="tabs"
    :active-tab="activeTab"
    :loading="profileLoading"
    :error="Boolean(profileError)"
    :error-text="profileError || '用户资料加载失败，请稍后重试'"
    :empty="!uid"
    empty-text="缺少用户 UID"
    title="用户主页"
    show-back
    @back="goBack"
    @retry="loadProfile"
    @tab-change="selectTab"
  >
    <template #actions>
      <button
        type="button"
        class="mobile-user-page__primary-action"
        :disabled="followLoading || !uid"
        @click="toggleFollow"
      >
        <i :class="isFollowing ? 'fas fa-check' : 'fas fa-plus'" aria-hidden="true"></i>
        {{ followLoading ? '处理中…' : isFollowing ? '已关注' : '关注' }}
      </button>
      <button type="button" class="mobile-user-page__secondary-action" :disabled="!uid" @click="openMessage">
        <i class="far fa-comment-dots" aria-hidden="true"></i>
        私信
      </button>
    </template>

    <template #relations>
      <button type="button" @click="openRelation('follow')">
        <i class="fas fa-user-group" aria-hidden="true"></i>
        关注 {{ formatCount(profile?.followNum) }}
      </button>
      <button type="button" @click="openRelation('fans')">
        <i class="fas fa-users" aria-hidden="true"></i>
        粉丝 {{ formatCount(profile?.fansNum) }}
      </button>
    </template>

    <template #default>
      <MobileSocialFeature
        variant="activity"
        :loading="contentLoading"
        :error="Boolean(contentError)"
        :error-text="contentError || '用户内容加载失败，请稍后重试'"
        :empty="!contentLoading && !contentError && !contentItems.length"
        empty-text="暂无内容"
      :items="contentViewItems"
        :scroll="false"
        @retry="loadContent(true)"
        @select="openContent"
      />
    </template>

    <template #footer>
      <div class="mobile-user-page__pagination">
        <span v-if="contentError && contentItems.length">{{ contentError }}</span>
        <button v-if="contentError && contentItems.length" type="button" @click="loadContent(true)">重试</button>
        <button v-else-if="hasMore" type="button" :disabled="contentLoading" @click="loadContent(false)">
          {{ contentLoading ? '加载中…' : '加载更多' }}
        </button>
        <span v-else-if="contentItems.length">已到底部</span>
      </div>
    </template>
  </MobileUserFeature>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import MobileSocialFeature from './MobileSocialFeature.vue';
import MobileUserFeature from './MobileUserFeature.vue';
import type { MobileUserProfile } from './types';
import {
  asUserSpaceProfile,
  entityKey,
  normalizeEntityPage,
  type UserSpaceEntity,
  type UserSpaceProfile,
} from '../../../types/userSpace';

defineOptions({ name: 'MobileUserPage' });

const route = useRoute();
const router = useRouter();

const profile = ref<UserSpaceProfile | null>(null);
const profileLoading = ref(false);
const profileError = ref('');
const contentLoading = ref(false);
const contentError = ref('');
const activeTab = ref('feed');
const contentItems = ref<UserSpaceEntity[]>([]);
const page = ref(1);
const firstItem = ref('');
const lastItem = ref('');
const hasMore = ref(true);
const followLoading = ref(false);
let profileRequest = 0;
let contentRequest = 0;

const uid = computed(() => String(route.params.uid || '').trim());
const tabs = [
  { key: 'feed', label: '动态' },
  { key: 'reply', label: '回复' },
  { key: 'rating', label: '点评' },
] as const;

const profileView = computed<MobileUserProfile | undefined>(() => {
  if (!profile.value) return undefined;
  const value = profile.value;
  return {
    id: value.uid,
    uid: value.uid,
    name: value.username || value.displayUserName,
    username: value.username,
    avatar: value.userAvatar || avatarForUid(String(value.uid)),
    cover: value.cover,
    bio: value.signature,
    level: value.level,
    verifiedLabel: value.verifyTitle || value.verify_title,
    stats: [
      { key: 'feed', label: '动态', value: formatCount(value.feedNum) },
      { key: 'follow', label: '关注', value: formatCount(value.followNum) },
      { key: 'fans', label: '粉丝', value: formatCount(value.fansNum) },
    ],
  };
});

const contentViewItems = computed(() => contentItems.value.map((item, index) => {
  const value = item as any;
  return {
    key: entityKey(item, index),
    id: item.id ?? item.entityId,
    title: String(value.title || value.message || value.entityTypeName || '用户内容'),
    subtitle: String(value.description || value.subTitle || value.message || value.entityTypeName || '').replace(/<[^>]+>/g, '').slice(0, 120),
    avatar: String(value.userAvatar || value.user_avatar || value.userInfo?.userAvatar || ''),
    tone: 'blue' as const,
    raw: item,
  };
}));

const isFollowing = computed(() => Boolean(profile.value && (profile.value.isFollow === true || profile.value.isFollow === 1)));

function avatarForUid(value: string): string {
  if (!value || value === '10000') return '';
  const padded = value.padStart(9, '0');
  return `https://avatar.coolapk.com/data/${padded.slice(0, 3)}/${padded.slice(3, 5)}/${padded.slice(5, 7)}/${value.slice(-2)}_avatar_middle.jpg`;
}

function formatCount(value: unknown): string {
  const count = Number(value || 0);
  return Number.isFinite(count) ? count.toLocaleString('zh-CN') : '0';
}

function responsePayload(response: any): any {
  return response?.data ?? response;
}

async function loadProfile(): Promise<void> {
  const targetUid = uid.value;
  if (!targetUid) return;
  const request = ++profileRequest;
  profileLoading.value = true;
  profileError.value = '';
  try {
    let response: any;
    try {
      response = await CoolapkTauriAPI.getUserSpace(targetUid);
    } catch (spaceError) {
      response = await CoolapkTauriAPI.getUserProfile(targetUid).catch(() => { throw spaceError; });
    }
    if (request !== profileRequest || targetUid !== uid.value) return;
    profile.value = asUserSpaceProfile(responsePayload(response), targetUid);
    await loadContent(true);
  } catch (error) {
    if (request !== profileRequest) return;
    profileError.value = error instanceof Error ? error.message : '用户资料加载失败';
    profile.value = null;
  } finally {
    if (request === profileRequest) profileLoading.value = false;
  }
}

async function loadContent(reset = false): Promise<void> {
  const targetUid = uid.value;
  if (!targetUid || contentLoading.value) return;
  if (!reset && !hasMore.value) return;
  if (reset) {
    page.value = 1;
    firstItem.value = '';
    lastItem.value = '';
    hasMore.value = true;
    contentItems.value = [];
  }
  const request = ++contentRequest;
  contentLoading.value = true;
  contentError.value = '';
  const requestedPage = page.value;
  try {
    const response = await CoolapkTauriAPI.getUserTabData(
      targetUid,
      activeTab.value,
      requestedPage,
      firstItem.value,
      lastItem.value,
    );
    if (request !== contentRequest || targetUid !== uid.value) return;
    const result = normalizeEntityPage(response, requestedPage);
    const existing = new Set(contentItems.value.map((item, index) => entityKey(item, index)));
    const incoming = result.items.filter((item, index) => !existing.has(entityKey(item, index)));
    contentItems.value = reset ? result.items : [...contentItems.value, ...incoming];
    if (requestedPage === 1) firstItem.value = result.firstItem;
    const previousLast = lastItem.value;
    lastItem.value = result.lastItem;
    page.value = requestedPage + 1;
    hasMore.value = result.hasMore && incoming.length > 0 && result.lastItem !== previousLast;
  } catch (error) {
    if (request !== contentRequest) return;
    contentError.value = error instanceof Error ? error.message : '用户内容加载失败';
    if (!reset) page.value = Math.max(1, page.value - 1);
  } finally {
    if (request === contentRequest) contentLoading.value = false;
  }
}

async function selectTab(key: string): Promise<void> {
  if (activeTab.value === key) return;
  activeTab.value = key;
  await loadContent(true);
}

async function toggleFollow(): Promise<void> {
  if (!uid.value || followLoading.value) return;
  followLoading.value = true;
  try {
    if (isFollowing.value) await CoolapkTauriAPI.unfollowUser(uid.value);
    else await CoolapkTauriAPI.followUser(uid.value);
    if (profile.value) profile.value = { ...profile.value, isFollow: !isFollowing.value };
  } catch (error) {
    profileError.value = error instanceof Error ? error.message : '关注操作失败，请重试';
  } finally {
    followLoading.value = false;
  }
}

function openMessage(): void {
  void router.push({ path: '/messages', query: { targetUid: uid.value, name: profile.value?.username || '酷友' } });
}

function openRelation(relation: 'follow' | 'fans'): void {
  void router.push(`/user/${encodeURIComponent(uid.value)}/relations/${relation}`);
}

function openContent(item: any): void {
  const source = item?.raw || item;
  const routePath = String(source?.url || '').trim();
  if (routePath.startsWith('/')) {
    void router.push(routePath);
    return;
  }
  const entityId = String(source?.entityId || source?.id || '').trim();
  const entityType = String(source?.entityType || source?.entity_type || '').toLowerCase();
  if (entityId && entityType.includes('feed')) void router.push(`/feed/${encodeURIComponent(entityId)}`);
  else if (routePath) void CoolapkTauriAPI.openUrl(routePath, 'internal');
}

function goBack(): void {
  if (window.history.length > 1) router.back();
  else void router.push('/');
}

watch(uid, () => {
  profile.value = null;
  void loadProfile();
});

onMounted(() => void loadProfile());
</script>

<style scoped>
.mobile-user-page__primary-action,
.mobile-user-page__secondary-action,
.mobile-user-page__relations button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  font: inherit;
  touch-action: manipulation;
}

.mobile-user-page__primary-action { border: 1px solid #0f9d58; background: #0f9d58; color: #fff; }
.mobile-user-page__secondary-action { border: 1px solid #d9dddf; background: #fff; color: #2b2d30; }
.mobile-user-page__primary-action:disabled,
.mobile-user-page__secondary-action:disabled { opacity: .55; }
.mobile-user-page__relations button { min-height: 38px; padding-inline: 0; border: 0; background: transparent; color: #666b71; }
.mobile-user-page__pagination { display: flex; align-items: center; justify-content: center; gap: 10px; color: #85878d; font-size: 12px; }
.mobile-user-page__pagination button { min-height: 36px; padding: 0 18px; border: 1px solid #0f9d58; border-radius: 999px; background: #fff; color: #0f9d58; font: inherit; }
.mobile-user-page__pagination span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
