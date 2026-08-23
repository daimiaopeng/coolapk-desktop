<template>
  <div class="feed-detail-page custom-scrollbar">
    <div class="feed-detail-shell">
      <LoadingState v-if="loading && !feedDetail" text="正在加载原动态..." />
      <ErrorState
        v-else-if="error && !feedDetail"
        title="原动态加载失败"
        :message="error"
        @retry="fetchDetail"
      />
      <FeedCard
        v-else-if="feedDetail"
        :feed="feedDetail"
        detail-mode
        :auto-open-comments="!loading"
      />
      <EmptyState v-else title="原动态不存在" description="这条动态可能已经被删除" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAppStore } from '../stores/app';
import FeedCard from '../components/feed/FeedCard.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';

defineOptions({ name: 'FeedDetailPage' });

const props = defineProps<{
  feedId: string;
}>();

const appStore = useAppStore();
// 路由缓存通常会为每个动态保留独立实例；同时监听参数可兼容热更新或组件复用。
const feedId = computed(() => String(props.feedId || ''));

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

const feedDetail = ref<any>(normalizeContextFeed(appStore.getFeedDetailContext(feedId.value)));
// 有通知摘要时也先等待完整动态返回，再自动加载评论，避免拿摘要字段请求出空列表。
const loading = ref(Boolean(feedId.value));
const error = ref('');
let requestVersion = 0;

async function fetchDetail() {
  if (!feedId.value) return;
  const requestedFeedId = feedId.value;
  const currentRequest = ++requestVersion;
  loading.value = true;
  error.value = '';
  try {
    const response: any = await CoolapkTauriAPI.getFeedDetail(requestedFeedId);
    const detail = response?.data;
    if (!detail) throw new Error('接口没有返回原动态内容');
    if (currentRequest !== requestVersion || requestedFeedId !== feedId.value) return;
    feedDetail.value = detail;
    appStore.setFeedDetailContext(requestedFeedId, detail);
  } catch (requestError) {
    if (currentRequest === requestVersion) {
      error.value = requestError instanceof Error ? requestError.message : String(requestError);
    }
  } finally {
    if (currentRequest === requestVersion) loading.value = false;
  }
}

onMounted(() => {
  void fetchDetail();
});

watch(feedId, (nextFeedId) => {
  feedDetail.value = normalizeContextFeed(appStore.getFeedDetailContext(nextFeedId));
  error.value = '';
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
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0 0 32px;
}

.feed-detail-shell :deep(.feed-card) {
  width: 100%;
  max-width: 100%;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  box-shadow: none;
  margin-bottom: 0;
}
</style>
