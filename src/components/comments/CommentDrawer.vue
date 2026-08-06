<template>
  <AppDrawer
    :is-open="isOpen"
    title="动态详情与评论"
    :width="520"
    @close="close"
  >
    <div v-if="feedId" class="comments-container">
      <CommentComposer :feed-id="feedId" @success="refreshReplies" />

      <div class="comments-filter-header">
        <span class="total-count">全部评论</span>
        <div class="filter-tabs">
          <button
            :class="['filter-btn', { 'is-active': sortType === 'hot' }]"
            @click="setSort('hot')"
          >
            按热度
          </button>
          <button
            :class="['filter-btn', { 'is-active': sortType === 'latest' }]"
            @click="setSort('latest')"
          >
            按时间
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading-wrapper">
        <LoadingState text="正在获取精彩评论" />
      </div>

      <div v-else-if="error" class="error-wrapper">
        <ErrorState title="获取评论失败" :message="error" @retry="fetchReplies" />
      </div>

      <div v-else-if="comments.length === 0" class="empty-wrapper">
        <EmptyState title="暂无评论" description="抢沙发，发表第一条评论吧！" />
      </div>

      <div v-else class="comment-list">
        <CommentItem
          v-for="item in comments"
          :key="item.id"
          :comment="item"
        />
      </div>
    </div>
  </AppDrawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useAppStore } from '../../stores/app';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useSettingsStore } from '../../stores/settings';
import AppDrawer from '../common/AppDrawer.vue';
import CommentComposer from './CommentComposer.vue';
import CommentItem from './CommentItem.vue';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';
import ErrorState from '../common/ErrorState.vue';

const appStore = useAppStore();

const feedId = computed(() => appStore.activeCommentFeedId);
const isOpen = computed(() => !!feedId.value);

const loading = ref(false);
const error = ref('');
const comments = ref<any[]>([]);
const sortType = ref<'hot' | 'latest'>(useSettingsStore().settings.commentSort || 'hot');

function close() {
  appStore.closeCommentDrawer();
}

async function fetchReplies() {
  if (!feedId.value) return;
  loading.value = true;
  error.value = '';
  try {
    let res: any;
    if (sortType.value === 'hot') {
      res = await CoolapkTauriAPI.getHotReplies(String(feedId.value), 1);
      if (!res || !res.data || !res.data.length) {
        res = await CoolapkTauriAPI.getFeedReplies(String(feedId.value), 1);
      }
    } else {
      res = await CoolapkTauriAPI.getFeedReplies(String(feedId.value), 1);
    }
    if (res && res.data) {
      comments.value = Array.isArray(res.data) ? res.data : [];
    } else {
      comments.value = [];
    }
  } catch (err: any) {
    error.value = err.message || '获取评论服务失败';
  } finally {
    loading.value = false;
  }
}

function refreshReplies() {
  fetchReplies();
}

function setSort(type: 'hot' | 'latest') {
  sortType.value = type;
  useSettingsStore().settings.commentSort = type;
  fetchReplies();
}

watch(feedId, (newId) => {
  if (newId) {
    fetchReplies();
  } else {
    comments.value = [];
  }
});
</script>

<style scoped>
.comments-container {
  display: flex;
  flex-direction: column;
}

.comments-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
}

.total-count {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.filter-tabs {
  display: flex;
  gap: var(--space-1);
}

.filter-btn {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  background: transparent;
  cursor: pointer;
}

.filter-btn.is-active {
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  font-weight: var(--font-weight-medium);
}
</style>
