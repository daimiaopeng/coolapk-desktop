<template>
  <div class="feed-detail-page custom-scrollbar">
    <div class="feed-detail-shell">
      <header class="feed-detail-page-header">
        <div>
          <h2>原动态</h2>
          <p>完整正文、图片、操作和评论</p>
        </div>
      </header>

      <LoadingState v-if="loading && !feedDetail" text="正在加载原动态..." />
      <ErrorState
        v-else-if="error && !feedDetail"
        title="原动态加载失败"
        :message="error"
        @retry="fetchDetail"
      />
      <FeedCard v-else-if="feedDetail" :feed="feedDetail" detail-mode />
      <EmptyState v-else title="原动态不存在" description="这条动态可能已经被删除" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAppStore } from '../stores/app';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';

defineOptions({ name: 'FeedDetailPage' });

const route = useRoute();
const appStore = useAppStore();
// 每个动态详情路由拥有独立缓存实例，固定本实例的动态编号。
const feedId = String(route.params.feedId || '');

function normalizeContextFeed(item: any): any {
  if (!item) return null;
  const candidates = [item.feedInfo, item.targetRow, item.targetFeed, item];
  return candidates.find((candidate) => candidate && typeof candidate === 'object' && (
    candidate.message
    || candidate.message_raw_output
    || candidate.message_title
    || candidate.title
    || candidate.note
  )) || null;
}

const feedDetail = ref<any>(normalizeContextFeed(appStore.getFeedDetailContext(feedId)));
const loading = ref(false);
const error = ref('');

async function fetchWebFallback() {
  const response: any = await CoolapkTauriAPI.fetchExternalPage(`https://www.coolapk.com/feed/${feedId}`);
  const raw = response?.data?.html;
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed?.data && typeof parsed.data === 'object' ? parsed.data : null;
}

async function fetchDetail() {
  if (!feedId || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response: any = await CoolapkTauriAPI.getFeedDetail(feedId);
    const detail = response?.data;
    if (!detail) throw new Error('接口没有返回原动态内容');
    feedDetail.value = detail;
    appStore.setFeedDetailContext(feedId, detail);
  } catch (requestError) {
    try {
      const fallback = await fetchWebFallback();
      if (fallback) {
        feedDetail.value = fallback;
        appStore.setFeedDetailContext(feedId, fallback);
        return;
      }
    } catch {
      // 网页兜底失败后显示原始请求错误。
    }
    error.value = requestError instanceof Error ? requestError.message : String(requestError);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void fetchDetail();
});
</script>

<style scoped>
.feed-detail-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background-color: var(--background-secondary);
}

.feed-detail-shell {
  width: min(920px, calc(100% - 40px));
  margin: 0 auto;
  padding: 24px 0 48px;
}

.feed-detail-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.feed-detail-page-header h2 {
  margin: 0 0 4px;
  color: var(--text-primary);
  font-size: var(--font-size-title-lg);
}

.feed-detail-page-header p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}
</style>
