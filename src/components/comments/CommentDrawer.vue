<template>
  <AppDrawer
    :is-open="isOpen"
    title="动态详情与评论"
    :width="520"
    @close="close"
  >
    <div v-if="feedId" class="comments-container">
      <!-- 动态详情区（getFeedDetail） -->
      <div v-if="detailLoading" class="loading-wrapper">
        <LoadingState text="正在获取动态详情..." />
      </div>
      <div v-else-if="feedDetail" class="feed-detail-card">
        <div class="feed-detail-header">
          <AppAvatar :src="feedDetail.userInfo?.userAvatar" size="sm" />
          <div class="detail-author">
            <span class="detail-username">{{ feedDetail.userInfo?.username || '酷友' }}</span>
            <span class="detail-dateline">{{ formatDateline(feedDetail.dateline) }}</span>
          </div>
        </div>
        <div v-if="feedDetail.title" class="feed-detail-title">{{ feedDetail.title }}</div>
        <div class="feed-detail-message" v-html="feedDetail.message || '（无文字内容）'"></div>
        <FeedImageGrid v-if="getDetailImages(feedDetail).length" :images="getDetailImages(feedDetail)" />
        <div v-if="feedDetail.deviceTitle" class="feed-detail-device">
          <i class="fas fa-mobile-alt"></i> {{ feedDetail.deviceTitle }}
        </div>
      </div>

      <FeedCommentSection
        :feed-uid="feedId"
        :feed-username="feedDetail?.userInfo?.username || feedDetail?.username"
        :comments="comments"
        :loading="loading"
        :normalize-img="normalizeImg"
        :format-rich-text="formatRichText"
        @send-comment="sendComment"
      />
    </div>
  </AppDrawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useAppStore } from '../../stores/app';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useSettingsStore } from '../../stores/settings';
import AppDrawer from '../common/AppDrawer.vue';
import AppAvatar from '../common/AppAvatar.vue';
import LoadingState from '../common/LoadingState.vue';
import FeedImageGrid from '../feed/FeedImageGrid.vue';
import FeedCommentSection from '../feed/FeedCommentSection.vue';
import { renderCoolapkEmoji } from '../../utils/coolapkEmoji';

const appStore = useAppStore();

const feedId = computed(() => appStore.activeCommentFeedId);
const isOpen = computed(() => !!feedId.value);

const loading = ref(false);
const error = ref('');
const comments = ref<any[]>([]);
const sortType = ref<'hot' | 'latest'>(useSettingsStore().settings.commentSort || 'hot');

const detailLoading = ref(false);
const feedDetail = ref<any>(null);

function close() {
  appStore.closeCommentDrawer();
}

function formatDateline(ts: any): string {
  if (!ts) return '';
  const num = Number(ts);
  if (!Number.isFinite(num)) return String(ts || '');
  const d = new Date(num * 1000);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { hour12: false });
}

function getDetailImages(feed: any): string[] {
  if (!feed) return [];
  const arr = feed.pics || feed.picArr || [];
  if (Array.isArray(arr) && arr.length) return arr;
  if (feed.pic) return [feed.pic];
  return [];
}

function normalizeImg(url: string) {
  return url;
}

function formatRichText(text: string) {
  if (!text) return '';
  let html = text.replace(/\n/g, '<br/>');
  html = renderCoolapkEmoji(html);
  return html;
}

async function sendComment(text: string) {
  if (!feedId.value) return;
  try {
    await CoolapkTauriAPI.replyFeed(String(feedId.value), text);
    fetchReplies();
  } catch (err: any) {
    console.error('评论发布失败:', err);
  }
}

async function fetchFeedDetail() {
  if (!feedId.value) return;
  detailLoading.value = true;
  try {
    const res: any = await CoolapkTauriAPI.getFeedDetail(String(feedId.value));
    feedDetail.value = res?.data || null;
  } catch (e) {
    console.warn('获取动态详情失败:', e);
    feedDetail.value = null;
  } finally {
    detailLoading.value = false;
  }
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

watch(feedId, (newId) => {
  if (newId) {
    fetchFeedDetail();
    fetchReplies();
  } else {
    comments.value = [];
    feedDetail.value = null;
  }
});
</script>

<style scoped>
.comments-container {
  display: flex;
  flex-direction: column;
}

.feed-detail-card {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.feed-detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.detail-author {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-username {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.detail-dateline {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.feed-detail-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.feed-detail-message {
  font-size: var(--font-size-sub);
  line-height: var(--line-height-sub);
  color: var(--text-primary);
  word-break: break-word;
}

.feed-detail-device {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
