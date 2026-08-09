<template>
  <div class="feed-comment-section">
    <!-- 评论发表输入框 -->
    <div class="comment-input-box">
      <input
        ref="inputRef"
        v-model="inputMsg"
        type="text"
        class="comment-input"
        :placeholder="replyTargetUser ? `回复 @${replyTargetUser}:` : '撰写你的精彩评论...'"
        @keydown.enter="handleSend"
      >
      <Button
        variant="primary"
        size="sm"
        icon="fa-solid fa-paper-plane"
        :loading="sending"
        @click="handleSend"
      >
        评论
      </Button>
    </div>

    <!-- 评论加载中 -->
    <div v-if="loading" class="comment-loading">
      <i class="fa-solid fa-circle-notch fa-spin text-green"></i>
      <span>载入评论楼层中...</span>
    </div>

    <!-- 无评论提示 -->
    <div v-else-if="!nestedComments || !nestedComments.length" class="comment-empty">
      <i class="fa-regular fa-comments empty-icon"></i>
      <span>暂无评论，快来抢沙发吧~</span>
    </div>

    <!-- 微博/酷安 规范楼中楼树状结构列表 -->
    <div v-else class="comment-list">
      <div v-for="c in nestedComments" :key="c.id || c.uid" class="comment-row">
        <!-- 1. 一级评论人头像 -->
        <AppAvatar
          class="comment-avatar"
          :src="c.userAvatar || c.avatar || c.userInfo?.userAvatar"
          :size="32"
          alt="头像"
          @click="setReplyTarget(c.username || c.userInfo?.username)"
        />

        <!-- 一级评论主体 -->
        <div class="comment-main">
          <!-- 名字、楼主标签、时间设备 -->
          <div class="comment-meta">
            <span
              class="comment-username"
              @click="setReplyTarget(c.username || c.userInfo?.username)"
            >
              {{ c.username || c.userInfo?.username || '酷友' }}
            </span>
            
            <!-- 楼主 Tag -->
            <span v-if="isAuthor(c)" class="badge-author">
              <i class="fa-solid fa-user-pen"></i> 楼主
            </span>

            <span v-if="c.userLevel" class="level-tag">LV{{ c.userLevel }}</span>
            <span class="comment-time">{{ c.infoHtml || c.dateline || '刚刚' }}</span>
          </div>

          <!-- 一级评论正文 -->
          <div
            class="comment-text"
            v-html="formatRichText(c.message || c.replyRowsText || '')"
            @click="handleCommentTextClick($event, c)"
          ></div>

          <div class="comment-actions">
            <button
              type="button"
              :class="['comment-like-btn', { 'is-liked': isLiked(c) }]"
              :disabled="isLikePending(c)"
              aria-label="点赞评论"
              @click.stop="toggleLike(c)"
            >
              <i :class="[isLiked(c) ? 'fa-solid fa-heart' : 'fa-regular fa-heart']"></i>
              <span>{{ getLikeCount(c) > 0 ? formatLikeCount(getLikeCount(c)) : '赞' }}</span>
            </button>
            <button
              type="button"
              class="comment-reply-btn"
              @click.stop="setReplyTarget(c.username || c.userInfo?.username)"
            >
              <i class="fa-regular fa-comment"></i>
              回复
            </button>
            <button
              v-if="isOwn(c)"
              type="button"
              class="comment-delete-btn"
              aria-label="删除评论"
              @click.stop="handleDeleteComment(c)"
            >
              <i class="fa-solid fa-trash-can"></i>
              删除
            </button>
          </div>

          <!-- 2. 带竖线的多层级楼中楼回复 -->
          <div v-if="c.replyRows && c.replyRows.length > 0" class="sub-reply-thread">
            <div
              v-for="sub in getVisibleSubReplies(c)"
              :key="sub.id || sub.uid"
              class="sub-reply-row"
              @click="setReplyTarget(sub.username || sub.fromUserName)"
            >
              <!-- 子回复头像 -->
              <AppAvatar
                class="sub-reply-avatar"
                :src="sub.userAvatar || sub.avatar || sub.userInfo?.userAvatar"
                :size="28"
                alt="头像"
              />
              <div class="sub-reply-main">
                <!-- 子回复 meta -->
                <div class="sub-reply-meta">
                  <span class="sub-user">{{ sub.username || sub.fromUserName || '酷友' }}</span>
                  <span v-if="isAuthor(sub)" class="badge-author sub-badge">楼主</span>
                  <span v-if="sub.userLevel" class="level-tag">LV{{ sub.userLevel }}</span>

                  <!-- 被回复人 -->
                  <template v-if="sub.replyUsername || sub.rusername || sub.toUserName">
                    <span class="sub-reply-to">回复</span>
                    <span class="sub-target-user">@{{ sub.replyUsername || sub.rusername || sub.toUserName }}</span>
                  </template>

                  <span class="comment-time">{{ sub.infoHtml || sub.dateline || '' }}</span>
                </div>
                <!-- 子回复正文 -->
                <div class="sub-reply-text" v-html="formatRichText(sub.message || '')" @click="handleAnchorClick"></div>
                <div class="sub-reply-actions">
                  <button
                    type="button"
                    :class="['comment-like-btn', 'sub-like-btn', { 'is-liked': isLiked(sub) }]"
                    :disabled="isLikePending(sub)"
                    aria-label="点赞回复"
                    @click.stop="toggleLike(sub)"
                  >
                    <i :class="[isLiked(sub) ? 'fa-solid fa-heart' : 'fa-regular fa-heart']"></i>
                    <span>{{ getLikeCount(sub) > 0 ? formatLikeCount(getLikeCount(sub)) : '赞' }}</span>
                  </button>
                  <button
                    v-if="isOwn(sub)"
                    type="button"
                    class="comment-delete-btn sub-delete-btn"
                    aria-label="删除回复"
                    @click.stop="handleDeleteSubReply(c, sub)"
                  >
                    <i class="fa-solid fa-trash-can"></i>
                    删除
                  </button>
                </div>
              </div>
            </div>

            <!-- 楼中楼展开 / 收起按钮 -->
            <div
              v-if="c.replyRows.length > 2 || (c.replyRowsCount && c.replyRowsCount > 2)"
              class="sub-more-btn-wrap"
            >
              <button
                type="button"
                class="sub-more-btn"
                @click.stop="toggleExpandSub(String(c.id))"
              >
                <template v-if="!expandedFloorIds.has(String(c.id))">
                  展开剩下的 {{ getRemainingSubCount(c) }} 条回复 <i class="fa-solid fa-chevron-down icon-arrow"></i>
                </template>
                <template v-else>
                  收起回复 <i class="fa-solid fa-chevron-up icon-arrow"></i>
                </template>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import AppAvatar from '../common/AppAvatar.vue';
import Button from '../ui/Button.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { handleAnchorClick } from '../../utils/anchorClick';
import { showToast } from '../../utils/toast';
import { requestConfirmation } from '../../utils/confirm';
import { getErrorMessage } from '../../utils/errors';

const props = defineProps<{
  feedUid?: string | number;
  feedUsername?: string;
  comments: any[];
  loading?: boolean;
  normalizeImg: (url: string, type: 'avatar' | 'feed') => string;
  formatRichText: (text: string) => string;
}>();

const emit = defineEmits<{
  (e: 'send-comment', text: string): void;
  (e: 'delete-comment', id: string | number): void;
}>();

const authStore = useAuthStore();
const inputMsg = ref('');
const sending = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const replyTargetUser = ref('');

const myUid = computed(() => (authStore.isLoggedIn ? String(authStore.user?.uid ?? '') : ''));

function isOwn(item: any): boolean {
  const uid = String(item?.uid ?? item?.userInfo?.uid ?? '');
  return !!uid && !!myUid.value && uid === myUid.value;
}

async function handleDeleteComment(comment: any) {
  const confirmed = await requestConfirmation({
    title: '删除评论',
    message: '确定要删除这条评论吗？',
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;
  try {
    const res = await CoolapkTauriAPI.deleteReply(String(comment.id));
    if (res && res.code === 200) {
      showToast('评论已删除');
      emit('delete-comment', comment.id);
    } else {
      showToast(res?.message || '删除评论失败', 'error');
    }
  } catch (err: any) {
    showToast(getErrorMessage(err, '删除评论失败'), 'error');
  }
}

async function handleDeleteSubReply(floor: any, sub: any) {
  const confirmed = await requestConfirmation({
    title: '删除回复',
    message: '确定要删除这条回复吗？',
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;
  try {
    const res = await CoolapkTauriAPI.deleteReply(String(sub.id));
    if (res && res.code === 200) {
      showToast('回复已删除');
      const source = props.comments.find((c: any) => String(c.id) === String(floor.id));
      if (source && Array.isArray(source.replyRows)) {
        source.replyRows = source.replyRows.filter((r: any) => String(r.id) !== String(sub.id));
      }
    } else {
      showToast(res?.message || '删除回复失败', 'error');
    }
  } catch (err: any) {
    showToast(getErrorMessage(err, '删除回复失败'), 'error');
  }
}

type LikeState = { liked: boolean; count: number };

const likeStates = ref<Record<string, LikeState>>({});
const likePending = ref<Record<string, boolean>>({});

function itemKey(item: any): string {
  return String(item?.id ?? `${item?.uid ?? 'unknown'}:${item?.dateline ?? item?.infoHtml ?? ''}`);
}

function initialLikeState(item: any): LikeState {
  const like = item?.userAction?.like;
  const count = Number(item?.likenum ?? item?.likeNum ?? item?.like_num ?? 0);
  return {
    liked: like === 1 || like === '1' || like === true,
    count: Number.isFinite(count) ? Math.max(0, count) : 0,
  };
}

function getLikeState(item: any): LikeState {
  const key = itemKey(item);
  return likeStates.value[key] || initialLikeState(item);
}

function isLiked(item: any): boolean {
  return getLikeState(item).liked;
}

function getLikeCount(item: any): number {
  return getLikeState(item).count;
}

function isLikePending(item: any): boolean {
  return likePending.value[itemKey(item)] === true;
}

function formatLikeCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

async function toggleLike(item: any) {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }

  const id = item?.id;
  if (id === undefined || id === null || String(id).trim() === '') return;

  const key = itemKey(item);
  if (isLikePending(item)) return;

  const previous = getLikeState(item);
  const next: LikeState = {
    liked: !previous.liked,
    count: Math.max(0, previous.count + (previous.liked ? -1 : 1)),
  };
  likeStates.value = { ...likeStates.value, [key]: next };
  likePending.value = { ...likePending.value, [key]: true };

  try {
    if (next.liked) {
      await CoolapkTauriAPI.likeFeed(String(id));
    } else {
      await CoolapkTauriAPI.unlikeFeed(String(id));
    }
  } catch (error) {
    likeStates.value = { ...likeStates.value, [key]: previous };
    console.error('Failed to toggle comment like', error);
  } finally {
    const pending = { ...likePending.value };
    delete pending[key];
    likePending.value = pending;
  }
}

// 维护楼中楼展开的 ID 集合 (Set)
const expandedFloorIds = ref<Set<string>>(new Set());

/**
 * 展开/收起楼中楼
 * 酷安 API 的楼中楼数据完全内嵌在每条评论的 replyRows 字段中，
 * 无需额外的异步 API 调用
 */
function toggleExpandSub(floorId: string) {
  const nextSet = new Set(expandedFloorIds.value);
  if (nextSet.has(floorId)) {
    nextSet.delete(floorId);
  } else {
    nextSet.add(floorId);
  }
  expandedFloorIds.value = nextSet;
}

function getRemainingSubCount(floor: any) {
  const total = floor.replyRowsCount || (floor.replyRows ? floor.replyRows.length : 0);
  const remaining = total - 2;
  if (remaining > 0) return remaining;
  return floor.replyRows ? Math.max(0, floor.replyRows.length - 2) : 0;
}

function getVisibleSubReplies(floor: any) {
  if (!floor.replyRows || !floor.replyRows.length) return [];
  const floorId = String(floor.id);
  if (expandedFloorIds.value.has(floorId)) {
    return floor.replyRows;
  }
  return floor.replyRows.slice(0, 2);
}

function setReplyTarget(username?: string) {
  if (!username) return;
  replyTargetUser.value = username;
  if (!inputMsg.value.startsWith(`回复 @${username}:`)) {
    inputMsg.value = `回复 @${username}: `;
  }
  inputRef.value?.focus();
}

function handleCommentTextClick(e: MouseEvent, c: any) {
  // 点中了评论内的链接则交给统一链接处理，否则视为点击评论（设置为回复对象）
  if ((e.target as HTMLElement).closest('a')) {
    handleAnchorClick(e);
    return;
  }
  setReplyTarget(c.username || c.userInfo?.username);
}

/**
 * 判断是否为原动态作者 (楼主)
 */
function isAuthor(commentItem: any) {
  const authorUid = String(props.feedUid || '');
  const authorName = String(props.feedUsername || '');
  const itemUid = String(commentItem.uid || commentItem.userInfo?.uid || '');
  const itemName = String(commentItem.username || commentItem.userInfo?.username || '');

  if (commentItem.isAuthor || commentItem.is_author === 1 || commentItem.isFeedAuthor) {
    return true;
  }

  if (authorUid && itemUid && authorUid === itemUid) return true;
  if (authorName && itemName && authorName === itemName) return true;
  return false;
}

/**
 * 自动树形构建算法 (Tree Aggregation)：
 * 将平铺的回复数组聚合成真实的【一级楼层 -> 二级楼中楼 (replyRows)】嵌套树！
 */
const nestedComments = computed(() => {
  if (!props.comments || !props.comments.length) return [];

  const topMap = new Map<string, any>();
  const topList: any[] = [];
  const orphanSubs: any[] = [];

  // 第一遍扫描：识别一级楼层与已有 replyRows
  const feedIdStr = String(props.feedUid || '');

  props.comments.forEach((rawItem) => {
    const item = {
      ...rawItem,
      replyRows: Array.isArray(rawItem.replyRows) ? [...rawItem.replyRows] : [],
    };

    const ridStr = String(item.rid || '0');
    const rridStr = String(item.rrid || '0');

    // 只有当 rid/rrid 既不为 '0' 也不等于原动态 feedId 时，才是楼中楼二层回复
    const isSub = Boolean(
      (rridStr !== '0' && rridStr !== feedIdStr) ||
      (ridStr !== '0' && ridStr !== feedIdStr)
    );

    if (!isSub) {
      topMap.set(String(item.id), item);
      topList.push(item);
    } else {
      orphanSubs.push(item);
    }
  });

  // 第二遍扫描：将游离的二级回复按 parent ID (rid/rrid) 挂载到父级楼层中
  orphanSubs.forEach((subItem) => {
    const parentId = String(subItem.rrid || subItem.rid || '');
    if (parentId && topMap.has(parentId)) {
      const parent = topMap.get(parentId);
      parent.replyRows.push(subItem);
    } else {
      // 如果找不到父级，自身升格为楼层，但内嵌其回复关系
      topList.push({
        ...subItem,
        replyRows: subItem.replyRows || []
      });
    }
  });

  return topList;
});

function handleSend() {
  const val = inputMsg.value.trim();
  if (!val) return;
  emit('send-comment', val);
  inputMsg.value = '';
  replyTargetUser.value = '';
}
</script>

<style scoped>
.feed-comment-section {
  margin-top: 14px;
  padding: 14px;
  background: var(--background);
  border-radius: var(--radius-card);
  border: 1px solid var(--border-light);
}

/* 输入框 */
.comment-input-box {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.comment-input {
  flex: 1;
  border-radius: var(--radius-control);
  border: 1px solid var(--border);
  padding: 8px 14px;
  font-size: 0.85rem;
  outline: none;
  background: var(--surface);
  color: var(--text-primary);
  transition: all var(--duration-fast);
}

.comment-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

/* 加载与空提示 */
.comment-loading,
.comment-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 1.1rem;
}

.text-green {
  color: var(--brand-primary);
}

/* 评论列表 */
.comment-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.comment-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.comment-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  cursor: pointer;
}

.comment-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
}

.comment-username {
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
}

.comment-username:hover {
  color: var(--brand-primary);
}

/* 楼主 Badge 标签 (微博/酷安 风格高亮) */
.badge-author {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.68rem;
  background: var(--brand-primary);
  color: var(--text-inverse, #ffffff);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  font-weight: 600;
  line-height: 1.3;
}

.badge-author.sub-badge {
  font-size: 0.65rem;
  padding: 0 4px;
  margin-right: 4px;
}

.level-tag {
  font-size: 0.68rem;
  background: var(--background-secondary);
  color: var(--text-secondary);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
}

.comment-time {
  font-size: 0.76rem;
  color: var(--text-tertiary);
}

.comment-text {
  font-size: 0.88rem;
  color: var(--text-primary);
  line-height: 1.6;
  word-break: break-word;
  cursor: pointer;
}

.comment-actions,
.sub-reply-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 5px;
}

.comment-like-btn,
.comment-reply-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 0.75rem;
  line-height: 1.4;
  cursor: pointer;
  transition: color 0.15s ease, transform 0.15s ease;
}

.comment-like-btn:hover,
.comment-reply-btn:hover,
.comment-like-btn.is-liked {
  color: var(--brand-primary);
}

.comment-delete-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 0.75rem;
  line-height: 1.4;
  cursor: pointer;
  transition: color 0.15s ease;
}

.comment-delete-btn:hover {
  color: var(--danger);
}

.sub-delete-btn {
  font-size: 0.7rem;
}

.comment-like-btn.is-liked i {
  animation: comment-like-pop 0.25s ease;
}

.comment-like-btn:disabled {
  cursor: wait;
  opacity: 0.7;
}

.sub-reply-actions {
  margin-top: 3px;
}

.sub-like-btn {
  font-size: 0.7rem;
}

@keyframes comment-like-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* 竖线多层级楼中楼 (Threaded Sub-replies) */
.sub-reply-thread {
  margin-top: 8px;
  margin-left: 4px;
  padding-left: 14px;
  border-left: 2px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sub-reply-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--duration-fast);
}

.sub-reply-row:hover {
  background: var(--surface-hover);
}

.sub-reply-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  margin-top: 2px;
}

.sub-reply-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sub-reply-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.8rem;
}

.sub-user {
  font-weight: 700;
  color: var(--text-primary);
}

.sub-reply-to {
  color: var(--text-tertiary);
  margin: 0 2px;
}

.sub-target-user {
  color: var(--brand-primary);
  font-weight: 600;
}

.sub-reply-text {
  font-size: 0.85rem;
  color: var(--text-primary);
  line-height: 1.55;
  word-break: break-word;
}

.sub-more-btn-wrap {
  margin-top: 4px;
  padding-left: 4px;
}

/* 可点击的展开/收起按钮样式 */
.sub-more-btn {
  border: 0;
  background: transparent;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.78rem;
  color: var(--brand-primary);
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: var(--duration-fast);
}

.sub-more-btn:hover {
  background: var(--brand-soft);
}

.icon-arrow {
  font-size: 0.7em;
}

.icon-arrow {
  font-size: 0.7em;
}
</style>
