<template>
  <div :class="['page-container', { 'is-embedded': embedded }]" class="custom-scrollbar" @scroll="handleScroll">
    <div v-if="!embedded" class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title"><i class="far fa-comment-dots icon"></i> 我的评论</h2>
          <span class="page-subtitle">同步酷安账号发布过的评论</span>
        </div>
        <AppButton v-if="authStore.isLoggedIn" variant="secondary" size="sm" icon="fas fa-sync-alt" :loading="loading" @click="load(true)">刷新</AppButton>
      </div>
    </div>

    <div v-if="!authStore.isLoggedIn" class="empty-wrapper">
      <EmptyState title="登录后查看我的评论" description="登录酷安账号后，此处会读取真实的评论记录" />
      <AppButton variant="primary" size="sm" @click="authStore.openLoginModal()">立即登录</AppButton>
    </div>
    <template v-else>
      <LoadingState v-if="loading && items.length === 0" text="正在读取评论记录..." />
      <ErrorState v-else-if="error && items.length === 0" title="加载评论记录失败" :message="error" @retry="load(true)" />
      <EmptyState v-else-if="!items.length" title="暂无评论记录" description="你发布过的评论会出现在这里" />
      <div v-else class="entity-list">
        <UserEntityCard v-for="(item, index) in items" :key="item.id || item.entityId || index" :entity="item" tab="reply" @deleted="removeItem" />
        <div class="pagination-footer">
          <LoadingState v-if="loadingMore" text="正在加载更多..." />
          <div v-else-if="noMore" class="no-more">已加载全部评论记录</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import UserEntityCard from '../components/user/UserEntityCard.vue';
import AppButton from '../components/common/AppButton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const { embedded = false } = defineProps<{ embedded?: boolean }>();
const items = ref<any[]>([]);
const page = ref(1);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const error = ref('');

async function load(refresh = false) {
  if (!authStore.user?.uid || loading.value || loadingMore.value) return;
  if (refresh) {
    page.value = 1;
    noMore.value = false;
    items.value = [];
    error.value = '';
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  try {
    const res = await CoolapkTauriAPI.getMyComments(String(authStore.user.uid), page.value);
    const incoming = Array.isArray(res?.data) ? res.data.map(normalizeComment) : [];
    if (!incoming.length) noMore.value = true;
    else {
      const ids = new Set(items.value.map((item) => String(item.id || item.entityId)));
      items.value.push(...incoming.filter((item: any) => !ids.has(String(item.id || item.entityId))));
      page.value++;
    }
  } catch (err: any) {
    error.value = err?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function normalizeComment(item: any) {
  const url = String(item?.url || '');
  const feedId = item?.feedId ?? item?.feed_id ?? url.match(/\/feed\/(\d+)/)?.[1];
  return { ...item, feedId };
}

function removeItem(id: string | number) {
  items.value = items.value.filter((item) => String(item.id) !== String(id));
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 180) void load(false);
}

watch(() => authStore.user?.uid, () => void load(true));
onMounted(() => { if (authStore.isLoggedIn) void load(true); });
</script>

<style scoped>
.page-container { width: 100%; height: 100%; overflow-y: auto; padding: var(--space-5); box-sizing: border-box; }
.page-container.is-embedded { height: auto; overflow: visible; padding: 0; }
.page-header { margin-bottom: var(--space-5); }
.header-main { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.header-titles { display: flex; flex-direction: column; gap: 4px; }
.page-title { margin: 0; display: flex; align-items: center; gap: var(--space-3); color: var(--text-primary); font-size: var(--font-size-title-lg); }
.page-title .icon { color: var(--brand-primary); }
.page-subtitle { color: var(--text-tertiary); font-size: var(--font-size-sub); }
.entity-list { width: 100%; max-width: var(--feed-max-width); margin: 0 auto; }
.empty-wrapper { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); padding: var(--space-10) 0; }
.pagination-footer { padding: var(--space-5) 0; text-align: center; }
.no-more { color: var(--text-tertiary); font-size: var(--font-size-caption); }
</style>
