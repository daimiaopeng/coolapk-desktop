<template>
  <AppDialog :is-open="show" :title="dialogTitle" :width="560" @close="close">
    <div class="interaction-dialog">
      <p class="interaction-description">{{ dialogDescription }}</p>

      <div v-if="loading && !items.length" class="interaction-state">
        <LoadingState :text="loadingText" />
      </div>

      <div v-else-if="error && !items.length" class="interaction-state">
        <ErrorState title="列表加载失败" :message="error" @retry="reload" />
      </div>

      <div v-else-if="!items.length" class="interaction-state">
        <EmptyState :title="emptyTitle" :description="emptyDescription" />
      </div>

      <div v-else class="interaction-list">
        <article v-for="(item, index) in items" :key="getFeedInteractionKey(item, index)" class="interaction-item">
          <button
            type="button"
            class="interaction-avatar-button"
            :disabled="!item.uid"
            :aria-label="`查看${item.username}的主页`"
            @click.stop="openUser(item.uid)"
          >
            <AppAvatar :src="item.avatar" :plugin-url="item.pluginUrl" :alt="item.username" size="md" />
          </button>

          <div class="interaction-content">
            <button
              type="button"
              class="interaction-user-name"
              :disabled="!item.uid"
              @click.stop="openUser(item.uid)"
            >
              {{ item.username }}
            </button>
            <div class="interaction-meta">
              <span>{{ formatFeedInteractionDate(item.dateline) || interactionActionText }}</span>
              <span v-if="formatFeedInteractionDate(item.dateline)">· {{ interactionActionText }}</span>
            </div>
            <p v-if="mode === 'forwards'" class="interaction-message">{{ item.message || '转发了这条动态' }}</p>
          </div>

          <i v-if="item.uid" class="fas fa-chevron-right interaction-arrow" aria-hidden="true"></i>
        </article>
      </div>

      <div class="interaction-footer">
        <LoadingState v-if="loading && items.length" text="正在加载更多..." />
        <button v-else-if="error && items.length" type="button" class="interaction-retry" @click="loadMore">加载失败，点击重试</button>
        <button v-else-if="!noMore" type="button" class="interaction-load-more" @click="loadMore">加载更多</button>
        <span v-else-if="items.length" class="interaction-no-more">没有更多了</span>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppAvatar from '../common/AppAvatar.vue';
import AppDialog from '../common/AppDialog.vue';
import EmptyState from '../common/EmptyState.vue';
import ErrorState from '../common/ErrorState.vue';
import LoadingState from '../common/LoadingState.vue';
import { getErrorMessage } from '../../utils/errors';
import {
  extractFeedInteractionRows,
  FEED_INTERACTION_PAGE_SIZE,
  formatFeedInteractionDate,
  getFeedInteractionKey,
  hasMoreFeedInteractions,
  type FeedInteractionItem,
  type FeedInteractionMode,
} from '../../utils/feedInteractions';

const props = defineProps<{
  show: boolean;
  mode: FeedInteractionMode;
  feedId: string | number;
  feedType?: string;
}>();

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void;
}>();

const router = useRouter();
const items = ref<FeedInteractionItem[]>([]);
const loading = ref(false);
const error = ref('');
const page = ref(1);
const noMore = ref(false);
let requestVersion = 0;

const dialogTitle = computed(() => props.mode === 'likes' ? '点赞用户' : '转发列表');
const dialogDescription = computed(() => props.mode === 'likes' ? '给这条动态点过赞的用户' : '转发这条动态的用户及转发内容');
const loadingText = computed(() => props.mode === 'likes' ? '正在加载点赞用户...' : '正在加载转发列表...');
const emptyTitle = computed(() => props.mode === 'likes' ? '暂无点赞用户' : '暂无转发记录');
const emptyDescription = computed(() => props.mode === 'likes' ? '这条动态还没有人点赞' : '这条动态还没有被转发');
const interactionActionText = computed(() => props.mode === 'likes' ? '点赞了这条动态' : '转发了这条动态');

function close() {
  requestVersion += 1;
  emit('update:show', false);
}

function openUser(uid: string) {
  if (uid) void router.push(`/user/${encodeURIComponent(uid)}`);
}

function mergeRows(rows: FeedInteractionItem[], reset: boolean): FeedInteractionItem[] {
  const existing = new Set(reset ? [] : items.value.map((item, index) => getFeedInteractionKey(item, index)));
  return rows.filter((item, index) => {
    const key = getFeedInteractionKey(item, index);
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });
}

async function loadPage(reset: boolean) {
  if (!props.show || (!reset && (loading.value || noMore.value))) return;
  const requestedPage = reset ? 1 : page.value;
  const requestedMode = props.mode;
  const requestedFeedId = String(props.feedId);
  const requestedFeedType = String(props.feedType || 'feed');
  const version = ++requestVersion;
  loading.value = true;
  error.value = '';
  if (reset) {
    items.value = [];
    page.value = 1;
    noMore.value = false;
  }

  try {
    const response = requestedMode === 'likes'
      ? await CoolapkTauriAPI.getFeedLikeList(requestedFeedId, requestedPage)
      : await CoolapkTauriAPI.getFeedForwardList(requestedFeedId, requestedFeedType, requestedPage);
    const rows = extractFeedInteractionRows(response);
    if (version !== requestVersion || !props.show || requestedMode !== props.mode || requestedFeedId !== String(props.feedId)) return;
    const uniqueRows = mergeRows(rows, reset);
    items.value = reset ? uniqueRows : [...items.value, ...uniqueRows];
    page.value = requestedPage + 1;
    noMore.value = rows.length === 0 || uniqueRows.length === 0 || !hasMoreFeedInteractions(response, rows.length) || rows.length < FEED_INTERACTION_PAGE_SIZE;
  } catch (requestError) {
    if (version === requestVersion) error.value = getErrorMessage(requestError, '互动列表加载失败');
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}

function reload() {
  void loadPage(true);
}

function loadMore() {
  void loadPage(false);
}

watch(
  () => [props.show, props.mode, String(props.feedId), props.feedType] as const,
  ([show]) => {
    if (show) void loadPage(true);
    else requestVersion += 1;
  },
  { immediate: true },
);
</script>

<style scoped>
.interaction-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.interaction-description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.interaction-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 12px 0;
}

.interaction-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.interaction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 10px 8px;
  border: 1px solid var(--border-light, var(--border));
  border-radius: var(--radius-control, 10px);
  background: var(--surface);
  transition: background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
}

.interaction-item:hover {
  border-color: var(--brand-primary);
  background: var(--surface-hover);
}

.interaction-avatar-button {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.interaction-avatar-button:disabled,
.interaction-user-name:disabled {
  cursor: default;
}

.interaction-content {
  min-width: 0;
  flex: 1;
}

.interaction-user-name {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.interaction-user-name:hover:not(:disabled) {
  color: var(--brand-primary);
}

.interaction-meta {
  display: flex;
  gap: 5px;
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.interaction-message {
  margin: 7px 0 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.interaction-arrow {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: 12px;
}

.interaction-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  text-align: center;
}

.interaction-load-more,
.interaction-retry {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill, 999px);
  background: var(--surface);
  color: var(--brand-primary);
  font-size: 12px;
  cursor: pointer;
}

.interaction-load-more:hover,
.interaction-retry:hover {
  border-color: var(--brand-primary);
  background: var(--brand-soft);
}

.interaction-no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}
</style>
