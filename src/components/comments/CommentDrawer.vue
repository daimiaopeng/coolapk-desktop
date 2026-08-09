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
          <AppAvatar :src="feedDetail.userInfo?.userAvatar || feedDetail.userAvatar" size="sm" />
          <div class="detail-author">
            <span class="detail-username">{{ feedDetail.userInfo?.username || feedDetail.username || '酷友' }}</span>
            <span class="detail-dateline">{{ formatDateline(feedDetail.dateline) }}</span>
          </div>
          <button
            v-if="isMyFeedDetail"
            class="detail-delete-btn"
            title="删除动态"
            aria-label="删除动态"
            @click="handleDeleteFeed"
          >
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
        <div v-if="feedDetail.title" class="feed-detail-title">{{ feedDetail.title }}</div>
        <div class="feed-detail-message" v-html="formatRichText(detailMessage || '（无文字内容）')" @click="handleAnchorClick"></div>
        <FeedImageGrid v-if="getDetailImages(feedDetail).length" :images="getDetailImages(feedDetail)" />
        <div v-if="feedDetail.deviceTitle || feedDetail.device_title" class="feed-detail-device">
          <i class="fas fa-mobile-alt"></i> {{ feedDetail.deviceTitle || feedDetail.device_title }}
        </div>
        <!-- 原动态操作栏：点赞/评论/转发/收藏（数量来自权威详情） -->
        <FeedActionBar
          :feed-id="feedId"
          :likenum="actionInfo.likenum"
          :replynum="actionInfo.replynum"
          :favnum="actionInfo.favnum"
          :sharenum="actionInfo.sharenum"
          :user-action="actionInfo.userAction"
          @toggle-fav="toggleFavDetail"
          @forward="openForward"
        />
      </div>
      <div v-else-if="detailError" class="detail-error-box">
        <span>{{ detailDeleted || '动态详情加载失败' }}</span>
        <button v-if="!detailDeleted" type="button" @click="fetchFeedDetail">重试</button>
      </div>

      <div class="more-tab-bar custom-scrollbar">
        <button
          v-for="tab in moreTabs"
          :key="tab.key"
          type="button"
          :class="['more-tab-item', { 'is-active': activeMoreTab === tab.key }]"
          @click="switchMoreTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="activeMoreTab !== 'comments'" class="more-tab-content">
        <div v-if="moreLoading" class="loading-wrapper">
          <LoadingState :text="moreLoadingText" />
        </div>
        <EmptyState
          v-else-if="moreError"
          icon="fas fa-exclamation-circle"
          title="加载失败"
          :description="moreError"
        />
        <template v-else-if="activeMoreTab === 'forward'">
          <EmptyState v-if="!forwardList.length" icon="fas fa-retweet" title="暂无转发" />
          <FeedCard
            v-for="(item, i) in forwardList"
            :key="getItemKey(item, i)"
            :feed="item"
            :rank-index="i"
            @deleted="removeFromList"
          />
        </template>
        <template v-else-if="activeMoreTab === 'like'">
          <EmptyState v-if="!likeList.length" icon="fas fa-heart" title="暂无点赞" />
          <template v-for="(item, i) in likeList" :key="getItemKey(item, i)">
            <div v-if="isUserItem(item)" class="like-user-row" @click="goUser(item)">
              <AppAvatar
                :src="item.userAvatar || item.userInfo?.userAvatar || item.pic"
                size="sm"
              />
              <span class="like-user-name">{{ item.username || item.userInfo?.username || '酷友' }}</span>
              <span class="like-user-arrow"><i class="fas fa-chevron-right"></i></span>
            </div>
            <FeedCard v-else :feed="item" :rank-index="i" @deleted="removeFromList" />
          </template>
        </template>
        <template v-else-if="activeMoreTab === 'history'">
          <EmptyState v-if="!historyList.length" icon="fas fa-history" title="暂无修改记录" />
          <div v-for="(item, i) in historyList" :key="getItemKey(item, i)" class="history-item">
            <div class="history-time">{{ formatHistoryDate(item) }}</div>
            <div class="history-text">{{ formatHistoryContent(item) || fallbackRaw(item) }}</div>
          </div>
        </template>
        <template v-else-if="activeMoreTab === 'question'">
          <EmptyState v-if="!questionList.length" icon="fas fa-comment-dots" title="暂无问答" />
          <template v-for="(item, i) in questionList" :key="getItemKey(item, i)">
            <FeedCard v-if="isFeedLike(item)" :feed="item" :rank-index="i" @deleted="removeFromList" />
            <div v-else class="simple-row">{{ item?.message || item?.content || fallbackRaw(item) }}</div>
          </template>
        </template>
        <template v-else-if="activeMoreTab === 'vote'">
          <EmptyState v-if="!voteList.length" icon="fas fa-poll" title="暂无投票" />
          <template v-for="(item, i) in voteList" :key="getItemKey(item, i)">
            <FeedCard v-if="isFeedLike(item)" :feed="item" :rank-index="i" @deleted="removeFromList" />
            <div v-else class="simple-row">{{ item?.message || item?.content || item?.option || fallbackRaw(item) }}</div>
          </template>
        </template>
      </div>

      <FeedCommentSection
        :feed-uid="feedId"
        :feed-username="feedDetail?.userInfo?.username || feedDetail?.username"
        :comments="comments"
        :loading="loading"
        :normalize-img="normalizeImg"
        :format-rich-text="formatRichText"
        @send-comment="sendComment"
        @delete-comment="removeComment"
      />
    </div>

    <ForwardDialog
      v-model:show="forwardOpen"
      :feed="forwardSource"
      @success="handleForwardSuccess"
    />
  </AppDrawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import AppDrawer from '../common/AppDrawer.vue';
import AppAvatar from '../common/AppAvatar.vue';
import LoadingState from '../common/LoadingState.vue';
import FeedImageGrid from '../feed/FeedImageGrid.vue';
import FeedActionBar from '../feed/FeedActionBar.vue';
import FeedCommentSection from '../feed/FeedCommentSection.vue';
import ForwardDialog from '../overlays/ForwardDialog.vue';
import { renderCoolapkRichText } from '../../utils/richText';
import { handleAnchorClick } from '../../utils/anchorClick';
import { isFavorite, addFavorite, removeFavorite } from '../../utils/favoritesStore';
import { showToast } from '../../utils/toast';
import { requestConfirmation } from '../../utils/confirm';
import { getErrorMessage } from '../../utils/errors';

const appStore = useAppStore();
const router = useRouter();
const authStore = useAuthStore();

const feedId = computed(() => appStore.activeCommentFeedId);
const isOpen = computed(() => !!feedId.value);

const loading = ref(false);
const error = ref('');
const comments = ref<any[]>([]);
const sortType = ref<'hot' | 'latest'>(useSettingsStore().settings.commentSort || 'hot');

const detailLoading = ref(false);
const detailError = ref(false);
const detailDeleted = ref('');
const feedDetail = ref<any>(null);

/** 操作栏数据：优先权威详情，回退上下文动态；收藏数仅详情接口提供 */
const actionInfo = computed(() => {
  const f = feedDetail.value;
  return {
    likenum: Number(f?.likenum ?? 0),
    replynum: Number(f?.replynum ?? 0),
    favnum: Number(f?.favnum ?? f?.favorite_num ?? 0),
    sharenum: Number(f?.sharenum ?? 0),
    userAction: f?.userAction,
  };
});

function toggleFavDetail() {
  const id = String(feedId.value);
  if (isFavorite(id)) {
    removeFavorite(id);
  } else {
    const f = feedDetail.value || {};
    addFavorite({ ...f, id: feedId.value, message: f.message || f.message_raw_output || f.title || '' } as any);
  }
}

const isMyFeedDetail = computed(() => {
  if (!authStore.isLoggedIn || !authStore.user) return false;
  const f = feedDetail.value;
  const feedUid = String(f?.uid ?? f?.userInfo?.uid ?? '');
  return !!feedUid && feedUid === String(authStore.user.uid);
});

const forwardOpen = ref(false);
const forwardSource = computed(() => feedDetail.value || contextFeed.value || { id: feedId.value });

function openForward() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  forwardOpen.value = true;
}

function handleForwardSuccess() {
  if (feedDetail.value) {
    feedDetail.value.sharenum = (Number(feedDetail.value.sharenum) || 0) + 1;
  }
}

async function handleDeleteFeed() {
  if (!feedId.value) return;
  const confirmed = await requestConfirmation({
    title: '删除动态',
    message: '确定要删除这条动态吗？删除后无法恢复。',
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;
  try {
    const res = await CoolapkTauriAPI.deleteFeed(String(feedId.value));
    if (res && res.code === 200) {
      showToast('动态已删除');
      close();
      window.dispatchEvent(new Event('refresh-feeds'));
    } else {
      showToast(res?.message || '删除动态失败', 'error');
    }
  } catch (err: any) {
    showToast(getErrorMessage(err, '删除动态失败'), 'error');
  }
}

function removeComment(id: string | number) {
  comments.value = comments.value.filter((c: any) => String(c.id) !== String(id));
}

function removeFromList(id: string | number) {
  const filter = (list: any[]) => list.filter((item: any) => String(item?.id) !== String(id));
  forwardList.value = filter(forwardList.value);
  likeList.value = filter(likeList.value);
  questionList.value = filter(questionList.value);
  voteList.value = filter(voteList.value);
}

// "更多" Tab：转发 / 点赞 / 修改历史 / 问答 / 投票（评论区保留在 comments tab）
type MoreTabKey = 'comments' | 'forward' | 'like' | 'history' | 'question' | 'vote';

const moreTabs: { key: MoreTabKey; label: string }[] = [
  { key: 'comments', label: '评论' },
  { key: 'forward', label: '转发' },
  { key: 'like', label: '点赞' },
  { key: 'history', label: '修改历史' },
  { key: 'question', label: '问答' },
  { key: 'vote', label: '投票' },
];

const activeMoreTab = ref<MoreTabKey>('comments');
const moreLoading = ref(false);
const moreLoadingText = ref('');
const moreError = ref('');
const forwardList = ref<any[]>([]);
const likeList = ref<any[]>([]);
const historyList = ref<any[]>([]);
const questionList = ref<any[]>([]);
const voteList = ref<any[]>([]);
const loadedMoreTabs = new Set<MoreTabKey>();

// 从调用方上下文（如通知条目）提取动态对象：按内容丰富度挑选
// （feedInfo → targetRow → targetFeed → 条目本身），带正文/备注字段的优先
// 正文候选字段：message / message_raw_output / message_title / title / note（评论类通知正文在 note）
function normalizeContextFeed(item: any): any {
  if (!item) return null;
  const candidates = [item.feedInfo, item.targetRow, item.targetFeed, item];
  const hasContent = (c: any) => !!(
    c &&
    typeof c === 'object' &&
    (c.message || c.message_raw_output || c.message_title || c.title || c.note)
  );
  return candidates.find(hasContent) || candidates.find((c) => c && typeof c === 'object') || null;
}

const contextFeed = computed(() => normalizeContextFeed(appStore.activeCommentFeed));

// 详情正文：兼容 message / 原始输出 / 标题 / 备注等多种字段
const detailMessage = computed(() => {
  const f = feedDetail.value;
  if (!f) return '';
  return (
    f.message ||
    f.message_raw_output ||
    f.message_title ||
    f.title ||
    f.note ||
    (Array.isArray(f.replyRows) && f.replyRows[0]?.message) ||
    ''
  );
});

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
  return renderCoolapkRichText(text);
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
  detailError.value = false;
  try {
    const res: any = await CoolapkTauriAPI.getFeedDetail(String(feedId.value));
    // 权威详情拉取成功则替换，失败时保留上下文里的动态（不置空）
    if (res?.data) {
      feedDetail.value = res.data;
    } else {
      await fetchWebFeedDetail();
    }
  } catch (e) {
    console.warn('获取动态详情失败，尝试网页兜底:', e);
    await fetchWebFeedDetail();
  } finally {
    detailLoading.value = false;
  }
}

// 网页兜底：酷安网页版动态页带 X- 头返回 JSON 详情，可绕过 feed/detail 的验证码风控
async function fetchWebFeedDetail() {
  if (!feedId.value) return;
  try {
    const res: any = await CoolapkTauriAPI.fetchExternalPage(
      `https://www.coolapk.com/feed/${feedId.value}`
    );
    const jsonText = res?.data?.html;
    if (!jsonText) return;
    const parsed = JSON.parse(jsonText);
    const feed = parsed?.data;
    if (feed && typeof feed === 'object' && (feed.message || feed.message_raw_output || feed.title)) {
      feedDetail.value = feed;
      detailError.value = false;
      return;
    }
    // 页面明确提示不存在/已删除
    if (parsed?.message && (parsed.error === -2 || String(parsed.status) === '400')) {
      feedDetail.value = null;
      detailError.value = true;
      detailDeleted.value = parsed.message;
    }
  } catch (err) {
    console.warn('网页兜底获取动态详情失败:', err);
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
    restoreOriginalFeedFromComments();
  }
}

// 兜底还原原动态：详情接口被拦截/空内容时，评论条目里的 targetRow 通常携带原动态全文
function restoreOriginalFeedFromComments() {
  const hasRealContent = (f: any) => !!(
    f &&
    typeof f === 'object' &&
    (f.message || f.message_raw_output || f.message_title || f.title)
  );
  if (hasRealContent(feedDetail.value)) return;
  const withTarget = comments.value.find(
    (c) => c?.targetRow && hasRealContent(c.targetRow)
  );
  if (withTarget?.targetRow) {
    feedDetail.value = withTarget.targetRow;
    detailError.value = false;
  }
}

function getItemKey(item: any, index: number): string {
  return String(item?.id || item?.uid || item?.feedId || `row-${index}`);
}

// 点赞/问答/投票条目可能是用户或 feed，防御式区分
function isUserItem(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const feedLike = !!(item.message || item.title || item.message_raw_output || item.pics || item.picArr || item.entityType);
  return !feedLike && (!!item.uid || !!item.username || !!item.userAvatar);
}

function isFeedLike(item: any): boolean {
  return !!(
    item &&
    typeof item === 'object' &&
    (item.message || item.title || item.message_raw_output || item.pics || item.picArr)
  );
}

function goUser(item: any) {
  const uid = item?.uid || item?.userInfo?.uid;
  if (uid) router.push(`/user/${uid}`);
}

function formatHistoryDate(item: any): string {
  const ts = item?.date || item?.dateline || item?.createTime || item?.create_time;
  return ts ? formatDateline(ts) : '';
}

function formatHistoryContent(item: any): string {
  if (!item || typeof item !== 'object') return '';
  return (
    item.message ||
    item.content ||
    item.text ||
    item.change_content ||
    item.description ||
    (item.title ? `标题：${item.title}` : '') ||
    ''
  );
}

// 字段不确定时的兜底：展示原始信息（截断防溢出）
function fallbackRaw(item: any): string {
  if (!item || typeof item !== 'object') return '（无详细内容）';
  const raw = JSON.stringify(item);
  return raw && raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
}

function switchMoreTab(key: MoreTabKey) {
  activeMoreTab.value = key;
  if (key === 'comments' || loadedMoreTabs.has(key)) return;
  moreError.value = '';
  moreLoading.value = true;
  const textMap: Record<string, string> = {
    forward: '正在加载转发...',
    like: '正在加载点赞...',
    history: '正在加载修改历史...',
    question: '正在加载问答...',
    vote: '正在加载投票...',
  };
  moreLoadingText.value = textMap[key] || '正在加载...';
  fetchMoreData(key).finally(() => {
    moreLoading.value = false;
  });
}

async function fetchMoreData(key: Exclude<MoreTabKey, 'comments'>) {
  if (!feedId.value) return;
  try {
    let res: any;
    const fid = String(feedId.value);
    if (key === 'forward') res = await CoolapkTauriAPI.getFeedForwardList(fid);
    else if (key === 'like') res = await CoolapkTauriAPI.getFeedLikeList(fid);
    else if (key === 'history') res = await CoolapkTauriAPI.getFeedChangeHistory(fid);
    else if (key === 'question') res = await CoolapkTauriAPI.getQuestionAnswers(fid);
    else if (key === 'vote') res = await CoolapkTauriAPI.getVoteComments(fid);
    const list = res?.data;
    if (Array.isArray(list)) {
      if (key === 'forward') forwardList.value = list;
      else if (key === 'like') likeList.value = list;
      else if (key === 'history') historyList.value = list;
      else if (key === 'question') questionList.value = list;
      else if (key === 'vote') voteList.value = list;
      loadedMoreTabs.add(key);
      moreError.value = '';
    } else {
      moreError.value = '暂无数据';
      console.warn(`[更多] ${key} 返回空数据:`, res);
    }
  } catch (err) {
    console.warn(`加载 ${key} 失败:`, err);
    moreError.value = '加载失败，请稍后重试';
  }
}

function resetMoreData() {
  activeMoreTab.value = 'comments';
  moreLoading.value = false;
  moreError.value = '';
  forwardList.value = [];
  likeList.value = [];
  historyList.value = [];
  questionList.value = [];
  voteList.value = [];
  loadedMoreTabs.clear();
}

watch(feedId, (newId) => {
  if (newId) {
    // 先用调用方上下文里的动态立即渲染详情，再尝试拉取权威详情替换
    feedDetail.value = contextFeed.value;
    detailError.value = false;
    detailDeleted.value = '';
    fetchFeedDetail();
    fetchReplies();
  } else {
    comments.value = [];
    feedDetail.value = null;
    detailError.value = false;
    detailDeleted.value = '';
    resetMoreData();
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

.detail-error-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
}

.detail-error-box button {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: var(--radius-control);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  font-size: var(--font-size-caption);
  transition: all var(--duration-fast) var(--ease-default);
}

.detail-error-box button:hover {
  background-color: var(--brand-soft);
}

.feed-detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.detail-delete-btn {
  margin-left: auto;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  color: var(--text-tertiary);
  font-size: 13px;
  transition: all var(--duration-fast) var(--ease-default);
}

.detail-delete-btn:hover {
  color: var(--danger);
  background-color: var(--surface-hover);
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

.more-tab-bar {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  margin-bottom: var(--space-3);
  overflow-x: auto;
  flex-shrink: 0;
}

.more-tab-item {
  flex-shrink: 0;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-default);
}

.more-tab-item:hover {
  color: var(--text-primary);
  background-color: var(--brand-soft);
}

.more-tab-item.is-active {
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  font-weight: var(--font-weight-semibold);
}

.more-tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.like-user-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-default);
}

.like-user-row:hover {
  background-color: var(--surface-hover);
}

.like-user-name {
  flex: 1;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.like-user-arrow {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-3);
}

.history-time {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.history-text {
  font-size: var(--font-size-sub);
  line-height: var(--line-height-sub);
  color: var(--text-primary);
  word-break: break-word;
}

.simple-row {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-3);
  font-size: var(--font-size-sub);
  line-height: var(--line-height-sub);
  color: var(--text-secondary);
  word-break: break-word;
}
</style>
