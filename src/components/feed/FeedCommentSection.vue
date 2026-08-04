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
        <img
          class="comment-avatar"
          :src="normalizeImg(c.userAvatar || c.avatar, 'avatar')"
          alt="头像"
          @click="setReplyTarget(c.username || c.userInfo?.username)"
        >

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
            @click="setReplyTarget(c.username || c.userInfo?.username)"
          ></div>

          <!-- 2. 带竖线的多层级楼中楼回复 -->
          <div v-if="c.replyRows && c.replyRows.length > 0" class="sub-reply-thread">
            <div
              v-for="sub in getVisibleSubReplies(c)"
              :key="sub.id || sub.uid"
              class="sub-reply-row"
              @click="setReplyTarget(sub.username || sub.fromUserName)"
            >
              <!-- 子回复头像 -->
              <img
                class="sub-reply-avatar"
                :src="normalizeImg(sub.userAvatar || sub.avatar, 'avatar')"
                alt="头像"
              >
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
                <div class="sub-reply-text" v-html="formatRichText(sub.message || '')"></div>
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
                  共 {{ c.replyRows.length }} 条回复 <i class="fa-solid fa-chevron-down icon-arrow"></i>
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
import Button from '../ui/Button.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';

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
}>();

const inputMsg = ref('');
const sending = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const replyTargetUser = ref('');

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
  props.comments.forEach((rawItem) => {
    const item = {
      ...rawItem,
      replyRows: Array.isArray(rawItem.replyRows) ? [...rawItem.replyRows] : [],
    };

    const isSub = Boolean(
      (item.rrid && String(item.rrid) !== '0') ||
      (item.rid && String(item.rid) !== '0') ||
      (item.replyUsername || item.rusername)
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
  background: var(--bg-subtle, #f8fafc);
  border-radius: var(--radius-lg, 10px);
  border: 1px solid var(--divider-color, #edf0f3);
}

/* 输入框 */
.comment-input-box {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.comment-input {
  flex: 1;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color, #e4e9ef);
  padding: 8px 14px;
  font-size: 0.85rem;
  outline: none;
  background: #ffffff;
  transition: var(--transition-fast);
}

.comment-input:focus {
  border-color: var(--brand-green, #10b966);
  box-shadow: 0 0 0 2px var(--brand-green-light);
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
  color: var(--text-sub, #667085);
}

.empty-icon {
  font-size: 1.1rem;
}

.text-green {
  color: var(--brand-green, #10b966);
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
  color: var(--text-main, #172033);
  cursor: pointer;
}

.comment-username:hover {
  color: var(--brand-green, #10b966);
}

/* 楼主 Badge 标签 (微博/酷安 风格高亮) */
.badge-author {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.68rem;
  background: var(--brand-green, #10b966);
  color: #ffffff;
  padding: 1px 6px;
  border-radius: var(--radius-sm, 4px);
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
  background: var(--bg-app, #f5f7f9);
  color: var(--text-sub, #667085);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
}

.comment-time {
  font-size: 0.76rem;
  color: var(--text-muted, #98a2b3);
}

.comment-text {
  font-size: 0.88rem;
  color: var(--text-main, #172033);
  line-height: 1.6;
  word-break: break-word;
  cursor: pointer;
}

/* 竖线多层级楼中楼 (Threaded Sub-replies) */
.sub-reply-thread {
  margin-top: 8px;
  margin-left: 4px;
  padding-left: 14px;
  border-left: 2px solid var(--border-color, #e4e9ef);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sub-reply-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 8px;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  transition: var(--transition-fast);
}

.sub-reply-row:hover {
  background: var(--bg-hover, #f1f5f9);
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
  color: var(--text-main, #172033);
}

.sub-reply-to {
  color: var(--text-muted, #98a2b3);
  margin: 0 2px;
}

.sub-target-user {
  color: var(--brand-green, #10b966);
  font-weight: 600;
}

.sub-reply-text {
  font-size: 0.85rem;
  color: var(--text-main, #172033);
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
  color: var(--brand-green, #10b966);
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: var(--transition-fast);
}

.sub-more-btn:hover {
  background: var(--brand-green-light);
}

.icon-arrow {
  font-size: 0.7em;
}
</style>
