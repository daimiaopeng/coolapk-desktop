<template>
  <div class="feed-comment-section">
    <div class="comment-toolbar">
      <strong class="comment-title">评论 <span>{{ sortedComments.length }}</span></strong>
      <div class="comment-sort" aria-label="评论排序">
        <button
          v-for="option in commentSortOptions"
          :key="option.value"
          type="button"
          :class="['comment-sort-button', { 'is-active': commentSortMode === option.value }]"
          :aria-pressed="commentSortMode === option.value"
          @click.stop="commentSortMode = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- 评论发表输入框组件 -->
    <div class="comment-composer-box">
      <!-- 针对楼层的回复目标提示栏 -->
      <div v-if="replyTargetUser" class="comment-reply-target-bar">
        <span class="reply-target-text">
          <i class="fa-solid fa-reply"></i>
          回复 <span class="reply-target-name">@{{ replyTargetUser }}</span>
        </span>
        <button
          type="button"
          class="reply-target-clear-btn"
          title="取消回复"
          aria-label="取消回复"
          @click="clearReplyTarget"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 多行评论富文本输入框 (原生直接显示彩色酷安表情) -->
      <div
        ref="inputRef"
        class="comment-textarea comment-rich-editor custom-scrollbar"
        contenteditable="true"
        role="textbox"
        tabindex="0"
        :data-placeholder="replyTargetUser ? `回复 @${replyTargetUser}...` : '撰写你的精彩评论... (支持直接粘贴截图)'"
        @input="handleEditorInput"
        @paste="handlePaste"
        @keydown="handleKeydown"
      ></div>

      <!-- 已选图片预览列表 -->
      <div v-if="images.length > 0" class="comment-media-preview">
        <div v-for="(img, i) in images" :key="i" class="comment-media-thumb">
          <img :src="img.preview" alt="评论配图" />
          <button
            type="button"
            class="comment-media-remove-btn"
            title="移除图片"
            :disabled="sending"
            @click="removeImage(i)"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div v-if="uploadingImages" class="comment-uploading-tip">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>正在上传配图 {{ uploadedCount }}/{{ images.length }}...</span>
        </div>
      </div>

      <!-- 隐藏的文件选择器 -->
      <input
        ref="imageInputRef"
        type="file"
        accept="image/*"
        multiple
        style="display: none"
        @change="handleImageSelected"
      />

      <!-- 工具栏与表情面板 -->
      <div class="comment-composer-toolbar">
        <div class="composer-tools-left">
          <!-- 表情按钮 -->
          <div ref="emojiContainerRef" class="emoji-picker-container">
            <button
              type="button"
              class="composer-tool-btn"
              :class="{ 'is-active': showEmojiPicker }"
              title="插入表情"
              aria-label="插入表情"
              @click.stop="toggleEmojiPicker"
            >
              <i class="fa-regular fa-face-smile"></i>
              <span>表情</span>
            </button>

            <!-- 酷安表情浮层 -->
            <div
              v-if="showEmojiPicker"
              class="emoji-picker-popover custom-scrollbar"
              @click.stop
            >
              <div class="emoji-picker-header">
                <span>酷安表情</span>
                <button
                  type="button"
                  class="emoji-picker-close"
                  title="关闭表情面板"
                  @click="showEmojiPicker = false"
                >
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div class="emoji-grid">
                <button
                  v-for="(filename, name) in EMOJI_MAP"
                  :key="name"
                  type="button"
                  class="emoji-item-btn"
                  :title="String(name)"
                  @click="insertEmoji(String(name))"
                >
                  <img :src="`${EMOJI_BASE}${filename}`" :alt="String(name)" loading="lazy" />
                </button>
              </div>
            </div>
          </div>

          <!-- 图片按钮 -->
          <button
            type="button"
            class="composer-tool-btn"
            title="添加图片 (最多9张，支持直接Ctrl+V粘贴截图)"
            aria-label="添加图片"
            :disabled="sending"
            @click="triggerImageSelect"
          >
            <i class="fa-regular fa-image"></i>
            <span>图片</span>
          </button>
        </div>

        <div class="composer-tools-right">
          <span v-if="inputMsg.length > 0" class="comment-word-count">
            {{ inputMsg.length }} / 1000
          </span>
          <Button
            variant="primary"
            size="sm"
            icon="fa-solid fa-paper-plane"
            :loading="sending"
            :disabled="(!inputMsg.trim() && images.length === 0) || sending"
            @click="handleSend"
          >
            {{ replyTargetUser ? '回复' : '评论' }}
          </Button>
        </div>
      </div>
    </div>

    <!-- 评论加载中 -->
    <div v-if="loading" class="comment-loading">
      <i class="fa-solid fa-circle-notch fa-spin text-green"></i>
      <span>载入评论楼层中...</span>
    </div>

    <div v-else-if="error" class="comment-error">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>{{ error }}</span>
      <button type="button" @click="$emit('retry-comments')">重试</button>
    </div>

    <!-- 无评论提示 -->
    <div v-else-if="!sortedComments.length" class="comment-empty">
      <i class="fa-regular fa-comments empty-icon"></i>
      <span>暂无评论，快来抢沙发吧~</span>
    </div>

    <!-- 微博/酷安 规范楼中楼树状结构列表 -->
    <div v-else class="comment-list">
      <div
        v-for="c in sortedComments"
        :key="c.id || c.uid"
        class="comment-row"
        data-context-kind="comment"
        :data-context-feed-id="feedId"
        :data-context-comment-id="c.id"
        :data-comment-username="c.username || c.userInfo?.username || '酷友'"
        :data-comment-text="c.message || c.replyRowsText || ''"
      >
        <!-- 1. 一级评论人头像 -->
        <AppAvatar
          class="comment-avatar"
          :src="c.userAvatar || c.avatar || c.userInfo?.userAvatar"
          :size="32"
          alt="头像"
          @click="setReplyTarget(c.username || c.userInfo?.username, c.id)"
        />

        <!-- 一级评论主体 -->
        <div class="comment-main">
          <!-- 名字、楼主标签、时间设备 -->
          <div class="comment-meta">
            <span
              class="comment-username"
              @click="setReplyTarget(c.username || c.userInfo?.username, c.id)"
            >
              {{ c.username || c.userInfo?.username || '酷友' }}
            </span>
            
            <!-- 楼主 Tag -->
            <span v-if="isAuthor(c)" class="badge-author">
              <i class="fa-solid fa-user-pen"></i> 楼主
            </span>

            <span v-if="getCommentUserLevel(c)" class="level-tag">LV{{ getCommentUserLevel(c) }}</span>
            <span v-if="getCommentVerifyTitle(c)" class="verify-tag" :title="getCommentVerifyTitle(c)">
              <i class="fa-solid fa-circle-check"></i>
              {{ getCommentVerifyTitle(c) }}
            </span>
          </div>

          <div v-if="hasCommentDetails(c)" class="comment-detail-row">
            <button
              v-if="displayCommentTime(c)"
              type="button"
              class="comment-time-button"
              :title="isAbsoluteTimeVisible(c) ? '点击恢复相对时间' : '点击查看完整时间'"
              @click.stop="toggleCommentTime(c)"
            >
              <i class="fa-regular fa-clock"></i>
              {{ displayCommentTime(c) }}
            </button>
            <span v-if="getCommentDeviceTitle(c)" class="comment-device" :title="getCommentDeviceTooltip(c)">
              <i class="fa-solid fa-mobile-screen-button"></i>
              {{ getCommentDeviceTitle(c) }}
            </span>
            <span v-if="getCommentFloor(c)" class="comment-secondary-meta">#{{ getCommentFloor(c) }}楼</span>
            <span v-if="getCommentLocation(c)" class="comment-secondary-meta">
              <i class="fa-solid fa-location-dot"></i>
              {{ getCommentLocation(c) }}
            </span>
          </div>

          <!-- 一级评论正文 -->
          <div
            class="comment-text"
            v-html="formatCommentText(c.message || c.replyRowsText || '')"
            @click="handleCommentTextClick($event, c)"
          ></div>

          <FeedImageGrid
            v-if="getCommentImages(c).length"
            class="comment-image-grid"
            :images="getCommentImages(c)"
            variant="comment"
          />

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
              @click.stop="setReplyTarget(c.username || c.userInfo?.username, c.id)"
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
              data-context-kind="comment"
              :data-context-feed-id="feedId"
              :data-context-comment-id="sub.id"
              :data-comment-username="sub.username || sub.fromUserName || '酷友'"
              :data-comment-text="sub.message || ''"
              @click="setReplyTarget(sub.username || sub.fromUserName, sub.id || c.id)"
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
                  <span v-if="getCommentUserLevel(sub)" class="level-tag">LV{{ getCommentUserLevel(sub) }}</span>
                  <span v-if="getCommentVerifyTitle(sub)" class="verify-tag" :title="getCommentVerifyTitle(sub)">
                    <i class="fa-solid fa-circle-check"></i>
                    {{ getCommentVerifyTitle(sub) }}
                  </span>

                  <!-- 被回复人 -->
                  <template v-if="sub.replyUsername || sub.rusername || sub.toUserName">
                    <span class="sub-reply-to">回复</span>
                    <span class="sub-target-user">@{{ sub.replyUsername || sub.rusername || sub.toUserName }}</span>
                  </template>

                </div>
                <div v-if="hasCommentDetails(sub)" class="comment-detail-row sub-detail-row">
                  <button
                    v-if="displayCommentTime(sub)"
                    type="button"
                    class="comment-time-button"
                    :title="isAbsoluteTimeVisible(sub) ? '点击恢复相对时间' : '点击查看完整时间'"
                    @click.stop="toggleCommentTime(sub)"
                  >
                    <i class="fa-regular fa-clock"></i>
                    {{ displayCommentTime(sub) }}
                  </button>
                  <span v-if="getCommentDeviceTitle(sub)" class="comment-device" :title="getCommentDeviceTooltip(sub)">
                    <i class="fa-solid fa-mobile-screen-button"></i>
                    {{ getCommentDeviceTitle(sub) }}
                  </span>
                  <span v-if="getCommentLocation(sub)" class="comment-secondary-meta">
                    <i class="fa-solid fa-location-dot"></i>
                    {{ getCommentLocation(sub) }}
                  </span>
                </div>
                <!-- 子回复正文 -->
                <div class="sub-reply-text" v-html="formatCommentText(sub.message || '')" @click="handleAnchorClick"></div>
                <FeedImageGrid
                  v-if="getCommentImages(sub).length"
                  class="comment-image-grid sub-comment-images"
                  :images="getCommentImages(sub)"
                  variant="comment"
                />
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import AppAvatar from '../common/AppAvatar.vue';
import Button from '../ui/Button.vue';
import FeedImageGrid from './FeedImageGrid.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { EMOJI_MAP, EMOJI_BASE } from '../../utils/coolapkEmoji';
import { clearCommentDraft, loadCommentDraft, saveCommentDraft } from '../../utils/commentDrafts';
import { handleAnchorClick } from '../../utils/anchorClick';
import { showToast } from '../../utils/toast';
import { requestConfirmation } from '../../utils/confirm';
import { getErrorMessage } from '../../utils/errors';
import { renderCoolapkRichText } from '../../utils/richText';
import { verifyWithCaptcha, extractCaptchaParamsFromResponse } from '../../utils/neteaseCaptcha';
import {
  COMMENT_SORT_OPTIONS,
  DEFAULT_COMMENT_SORT_MODE,
  formatCommentAbsoluteTime,
  formatCommentTime,
  getCommentDeviceTitle,
  getCommentImages,
  getCommentLocation,
  getCommentUserLevel,
  getCommentVerifyTitle,
  sortComments,
  type CommentSortMode,
} from '../../utils/commentList';

const props = withDefaults(
  defineProps<{
    feedId?: string | number;
    feedUid?: string | number;
    feedUsername?: string;
    comments: any[];
    loading?: boolean;
    error?: string;
    normalizeImg?: (url: string, type: 'avatar' | 'feed') => string;
    formatRichText?: (text: string) => string;
  }>(),
  {
    feedId: '',
    feedUid: '',
    feedUsername: '',
    loading: false,
    error: '',
    normalizeImg: (url: string) => url,
    formatRichText: (text: string) => renderCoolapkRichText(text),
  }
);

function formatCommentText(text: string): string {
  if (!text) return '';
  return props.formatRichText ? props.formatRichText(text) : renderCoolapkRichText(text);
}

const emit = defineEmits<{
  (e: 'send-comment', text: string): void;
  (e: 'delete-comment', id: string | number): void;
  (e: 'retry-comments'): void;
}>();

const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const inputMsg = ref('');
const sending = ref(false);
const inputRef = ref<HTMLDivElement | null>(null);
const replyTargetUser = ref('');
const replyTargetId = ref('');
const commentSortMode = ref<CommentSortMode>(DEFAULT_COMMENT_SORT_MODE);
const commentSortOptions = COMMENT_SORT_OPTIONS;
const absoluteTimeIds = ref<Set<string>>(new Set());

// 评论配图与酷安表情输入
const MAX_IMAGES = 9;
const images = ref<{ file: File; preview: string }[]>([]);
const uploadingImages = ref(false);
const uploadedCount = ref(0);
const imageInputRef = ref<HTMLInputElement | null>(null);
const showEmojiPicker = ref(false);
const emojiContainerRef = ref<HTMLElement | null>(null);
let restoringDraft = false;

function createEmojiImg(name: string, filename?: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'coolapk-emoji';
  img.src = `${EMOJI_BASE}${filename || EMOJI_MAP[name] || 'coolapk_emotion_1_hahaha.png'}`;
  img.alt = `[${name}]`;
  img.title = name;
  img.setAttribute('data-emoji', `[${name}]`);
  img.setAttribute('contenteditable', 'false');
  return img;
}

function parseTextToEditorNodes(text: string): Node[] {
  if (!text) return [];
  const container = document.createElement('div');
  const rendered = text.replace(/\[([^\]\r\n]{1,20})\]/g, (match, name: string) => {
    const filename = EMOJI_MAP[name];
    if (!filename) return match;
    return `<img class="coolapk-emoji" src="${EMOJI_BASE}${filename}" alt="${match}" title="${name}" data-emoji="${match}" contenteditable="false" />`;
  });
  container.innerHTML = rendered.replace(/\n/g, '<br>');
  return Array.from(container.childNodes);
}

function getEditorText(el: HTMLElement | null): string {
  if (!el) return '';
  let result = '';
  const traverse = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.tagName === 'IMG' && element.getAttribute('data-emoji')) {
        result += element.getAttribute('data-emoji');
      } else if (element.tagName === 'BR') {
        result += '\n';
      } else {
        node.childNodes.forEach(traverse);
        if (element.tagName === 'DIV' || element.tagName === 'P') {
          if (node.nextSibling) result += '\n';
        }
      }
    }
  };
  el.childNodes.forEach(traverse);
  return result;
}

function syncMsgToEditor(text: string) {
  const el = inputRef.value;
  if (!el) return;
  el.innerHTML = '';
  const nodes = parseTextToEditorNodes(text);
  nodes.forEach((n) => el.appendChild(n));
}

function handleEditorInput() {
  const el = inputRef.value;
  if (!el) return;
  inputMsg.value = getEditorText(el);
}

function currentDraftAccount(): string {
  return String(authStore.user?.uid || 'guest');
}

async function restoreDraft() {
  if (!props.feedId) return;
  restoringDraft = true;
  try {
    const draft = await loadCommentDraft(currentDraftAccount(), props.feedId, replyTargetId.value || undefined);
    if (draft) {
      inputMsg.value = draft;
      syncMsgToEditor(draft);
    }
  } finally {
    restoringDraft = false;
  }
}

watch([() => props.feedId, replyTargetId, () => authStore.user?.uid], () => {
  void restoreDraft();
});

watch(inputMsg, (val) => {
  if (!restoringDraft && props.feedId) {
    void saveCommentDraft(currentDraftAccount(), props.feedId, replyTargetId.value || undefined, val);
  }
});

function isAbsoluteTimeVisible(item: any): boolean {
  return absoluteTimeIds.value.has(itemKey(item));
}

function displayCommentTime(item: any): string {
  return isAbsoluteTimeVisible(item)
    ? formatCommentAbsoluteTime(item)
    : formatCommentTime(item);
}

function toggleCommentTime(item: any) {
  const key = itemKey(item);
  const nextSet = new Set(absoluteTimeIds.value);
  if (nextSet.has(key)) nextSet.delete(key);
  else nextSet.add(key);
  absoluteTimeIds.value = nextSet;
}

function getCommentFloor(item: any): string {
  const value = item?.floor ?? item?.rank ?? '';
  return String(value).trim();
}

function getCommentDeviceRom(item: any): string {
  return String(item?.deviceRom ?? item?.device_rom ?? '').trim();
}

function getCommentDeviceTooltip(item: any): string {
  return [
    getCommentDeviceTitle(item),
    getCommentDeviceRom(item),
    String(item?.deviceBuild ?? item?.device_build ?? '').trim(),
  ].filter(Boolean).join(' · ');
}

function hasCommentDetails(item: any): boolean {
  return Boolean(
    displayCommentTime(item)
    || getCommentDeviceTitle(item)
    || getCommentFloor(item)
    || getCommentLocation(item),
  );
}

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

const replyDetails = ref<Record<string, any>>({});
const requestedReplyDetailIds = new Set<string>();
const replyDetailQueue: string[] = [];
let activeReplyDetailRequests = 0;
const MAX_REPLY_DETAIL_CONCURRENCY = 4;

function collectReplyIds(items: any[]): string[] {
  const result: string[] = [];
  const visit = (item: any) => {
    const id = String(item?.id ?? '').trim();
    if (id) result.push(id);
    const children = Array.isArray(item?.replyRows)
      ? item.replyRows
      : Array.isArray(item?.rlist)
        ? item.rlist
        : [];
    children.forEach(visit);
  };
  items.forEach(visit);
  return [...new Set(result)];
}

function mergeReplyDetail(item: any): any {
  const detail = replyDetails.value[String(item?.id ?? '')];
  if (!detail) return item;

  const merged = { ...item };
  Object.entries(detail).forEach(([key, value]) => {
    const hasMeaningfulValue = value !== undefined
      && value !== null
      && value !== ''
      && value !== 0
      && (!Array.isArray(value) || value.length > 0);
    if (hasMeaningfulValue) merged[key] = value;
  });
  return merged;
}

function pumpReplyDetailQueue() {
  while (activeReplyDetailRequests < MAX_REPLY_DETAIL_CONCURRENCY && replyDetailQueue.length > 0) {
    const replyId = replyDetailQueue.shift();
    if (!replyId) continue;
    activeReplyDetailRequests += 1;
    void CoolapkTauriAPI.getReplyDetail(replyId)
      .then((response: any) => {
        if (!response?.data) return;
        replyDetails.value = {
          ...replyDetails.value,
          [replyId]: response.data,
        };
      })
      .catch(() => {
        // 补充元数据失败不影响评论正文、点赞和回复等主要功能。
      })
      .finally(() => {
        activeReplyDetailRequests -= 1;
        pumpReplyDetailQueue();
      });
  }
}

function scheduleReplyDetails(ids: string[]) {
  ids.forEach((id) => {
    if (requestedReplyDetailIds.has(id)) return;
    requestedReplyDetailIds.add(id);
    replyDetailQueue.push(id);
  });
  pumpReplyDetailQueue();
}

watch(
  () => collectReplyIds(props.comments).join(','),
  () => scheduleReplyDetails(collectReplyIds(props.comments)),
  { immediate: true },
);

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
      await CoolapkTauriAPI.likeReply(String(id));
    } else {
      await CoolapkTauriAPI.unlikeReply(String(id));
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

function toggleEmojiPicker() {
  showEmojiPicker.value = !showEmojiPicker.value;
}

function insertEmoji(name: string) {
  const filename = EMOJI_MAP[name];
  const el = inputRef.value;
  const emojiCode = `[${name}]`;
  if (!el) {
    inputMsg.value += emojiCode;
    return;
  }

  el.focus();
  const sel = window.getSelection();
  const img = createEmojiImg(name, filename);

  if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(img);

    const newRange = document.createRange();
    newRange.setStartAfter(img);
    newRange.setEndAfter(img);
    sel.removeAllRanges();
    sel.addRange(newRange);
  } else {
    el.appendChild(img);
  }

  inputMsg.value = getEditorText(el);
}

function triggerImageSelect() {
  if (images.value.length >= MAX_IMAGES) {
    showToast(`最多只能添加 ${MAX_IMAGES} 张配图`, 'warning');
    return;
  }
  imageInputRef.value?.click();
}

function appendImageFiles(files: File[]) {
  if (!files.length) return;
  const remain = MAX_IMAGES - images.value.length;
  if (remain <= 0) {
    showToast(`最多只能添加 ${MAX_IMAGES} 张配图`, 'warning');
    return;
  }
  if (files.length > remain) {
    showToast(`最多只能添加 ${MAX_IMAGES} 张配图，已截取前 ${remain} 张`, 'warning');
  }
  files.slice(0, remain).forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      images.value.push({ file, preview: String(reader.result) });
    };
    reader.readAsDataURL(file);
  });
}

function handleImageSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files ? Array.from(target.files) : [];
  target.value = '';
  if (files.length === 0) return;
  appendImageFiles(files);
}

function handlePaste(e: ClipboardEvent) {
  const clipboardData = e.clipboardData;
  if (!clipboardData) return;

  const imageFiles: File[] = [];
  if (clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
  }

  if (imageFiles.length > 0) {
    e.preventDefault();
    appendImageFiles(imageFiles);
    return;
  }

  const text = clipboardData.getData('text/plain');
  if (text) {
    e.preventDefault();
    const el = inputRef.value;
    if (!el) return;
    const nodes = parseTextToEditorNodes(text);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = document.createDocumentFragment();
      let lastNode: Node | null = null;
      nodes.forEach((n) => {
        lastNode = n;
        frag.appendChild(n);
      });
      range.insertNode(frag);
      if (lastNode) {
        const newRange = document.createRange();
        newRange.setStartAfter(lastNode);
        newRange.setEndAfter(lastNode);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    } else {
      nodes.forEach((n) => el.appendChild(n));
    }
    inputMsg.value = getEditorText(el);
  }
}

function removeImage(index: number) {
  if (sending.value) return;
  images.value.splice(index, 1);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleSend();
  }
}

function resolveUploadedUrl(data: any): string {
  let url = '';
  if (typeof data === 'string') {
    url = data;
  } else if (data && typeof data === 'object') {
    url = data.url || data.pic || data.path || data.filename || '';
  }
  if (!url) throw new Error('上传图片失败：服务端未返回图片地址');
  if (url.startsWith('//')) url = `https:${url}`;
  else if (url.startsWith('/')) url = `https://image.coolapk.com${url}`;
  return url;
}

function buildFinalMessage(text: string): string {
  const base = text.trim();
  if (
    settingsStore.settings.publishDeviceSignature &&
    settingsStore.settings.deviceSignature &&
    base.length > 0
  ) {
    return `${base}\n来自 ${settingsStore.settings.deviceSignature.trim()}`;
  }
  return base;
}

function setReplyTarget(username?: string, replyId?: string | number) {
  if (!username) return;
  replyTargetUser.value = username;
  replyTargetId.value = replyId ? String(replyId) : '';
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function clearReplyTarget() {
  replyTargetUser.value = '';
  replyTargetId.value = '';
}

function handleClickOutside(event: MouseEvent) {
  if (showEmojiPicker.value && emojiContainerRef.value && !emojiContainerRef.value.contains(event.target as Node)) {
    showEmojiPicker.value = false;
  }
}

function handleContextReplyComment(event: Event) {
  const detail = (event as CustomEvent<{ feedId?: string | number; username?: string; commentId?: string | number }>).detail;
  if (String(detail?.feedId || '') !== String(props.feedId || '')) return;
  setReplyTarget(detail?.username || '酷友', detail?.commentId);
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
  window.addEventListener('coolapk-context-reply-comment', handleContextReplyComment);
  if (inputRef.value) {
    Object.defineProperty(inputRef.value, 'value', {
      get() {
        return inputMsg.value;
      },
      set(val: string) {
        inputMsg.value = String(val ?? '');
        syncMsgToEditor(String(val ?? ''));
      },
      configurable: true,
    });
  }
  void restoreDraft();
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
  window.removeEventListener('coolapk-context-reply-comment', handleContextReplyComment);
});

function handleCommentTextClick(e: MouseEvent, c: any) {
  // 点中了评论内的链接则交给统一链接处理，否则视为点击评论（设置为回复对象）
  if ((e.target as HTMLElement).closest('a')) {
    handleAnchorClick(e);
    return;
  }
  setReplyTarget(c.username || c.userInfo?.username, c.id);
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
  const feedIdStr = String(props.feedId || '');

  props.comments.forEach((rawItem) => {
    const enrichedItem = mergeReplyDetail(rawItem);
    const item = {
      ...enrichedItem,
      replyRows: Array.isArray(enrichedItem.replyRows)
        ? enrichedItem.replyRows.map(mergeReplyDetail)
        : Array.isArray(enrichedItem.rlist)
          ? enrichedItem.rlist.map(mergeReplyDetail)
          : [],
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

const sortedComments = computed(() => sortComments(nestedComments.value, commentSortMode.value));

async function handleSend() {
  const rawMsg = inputMsg.value.trim();
  if (!rawMsg && images.value.length === 0) return;
  if (sending.value) return;

  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }

  const currentFeedId = props.feedId;
  if (!currentFeedId) {
    emit('send-comment', rawMsg);
    inputMsg.value = '';
    images.value = [];
    clearReplyTarget();
    return;
  }

  sending.value = true;
  uploadingImages.value = images.value.length > 0;
  uploadedCount.value = 0;

  try {
    let pic = '';
    if (images.value.length > 0) {
      const urls: string[] = [];
      for (const img of images.value) {
        const bytes = new Uint8Array(await img.file.arrayBuffer());
        const contentType = img.file.type || 'image/jpeg';
        const res = await CoolapkTauriAPI.uploadImage(bytes, img.file.name, contentType, 'feed');
        urls.push(resolveUploadedUrl(res?.data));
        uploadedCount.value += 1;
      }
      pic = urls.join(',');
    }

    const finalMessage = buildFinalMessage(rawMsg);
    const targetRid = replyTargetId.value || undefined;

    const executeReply = async (postToken?: string) => {
      if (postToken) {
        return await CoolapkTauriAPI.replyFeed(
          String(currentFeedId),
          finalMessage,
          targetRid,
          pic || undefined,
          postToken
        );
      }
      return await CoolapkTauriAPI.replyFeed(
        String(currentFeedId),
        finalMessage,
        targetRid,
        pic || undefined
      );
    };

    let res: any;
    try {
      res = await executeReply();
    } catch (err: any) {
      const captchaParams = extractCaptchaParamsFromResponse(err);
      if (captchaParams?.captchaId) {
        showToast('正在调起安全滑块验证...', 'info');
        const token = await verifyWithCaptcha(captchaParams.captchaId);
        res = await executeReply(token);
      } else {
        const errMsg = String(err?.message || err || '');
        if (errMsg.includes('网络环境可能异常') || errMsg.includes('err_request_need_upgrade_new_version')) {
          showToast('酷安服务端风控拦截（需官方手机环境），发表失败', 'error');
          return;
        }
        throw err;
      }
    }

    if (res && res.code !== 200) {
      const captchaParams = extractCaptchaParamsFromResponse(res);
      if (captchaParams?.captchaId) {
        showToast('正在调起安全滑块验证...', 'info');
        const token = await verifyWithCaptcha(captchaParams.captchaId);
        res = await executeReply(token);
      } else if (
        String(res.message || res.messageStatus || '').includes('网络环境可能异常') ||
        String(res.message || res.messageStatus || '').includes('err_request_need_upgrade_new_version')
      ) {
        showToast('酷安服务端风控拦截（需官方手机环境），发表失败', 'error');
        return;
      }
    }

    if (res && res.code === 200) {
      await clearCommentDraft(currentDraftAccount(), currentFeedId, targetRid);
      inputMsg.value = '';
      if (inputRef.value) {
        inputRef.value.innerHTML = '';
      }
      images.value = [];
      clearReplyTarget();
      showEmojiPicker.value = false;
      showToast('评论发表成功');
      emit('send-comment', rawMsg);
      emit('retry-comments');
    } else {
      showToast(res?.message || '评论发表失败', 'error');
    }
  } catch (err: any) {
    showToast(getErrorMessage(err, '发表评论异常'), 'error');
  } finally {
    uploadingImages.value = false;
    sending.value = false;
  }
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

.comment-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.comment-title {
  color: var(--text-primary);
  font-size: 0.95rem;
  white-space: nowrap;
}

.comment-title span {
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 500;
}

.comment-sort {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border-radius: 999px;
  background: var(--surface-muted, var(--surface));
  border: 1px solid var(--border-light);
}

.comment-sort-button {
  border: 0;
  border-radius: 999px;
  padding: 5px 12px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 0.78rem;
  cursor: pointer;
  transition: color var(--duration-fast), background var(--duration-fast), box-shadow var(--duration-fast);
}

.comment-sort-button:hover {
  color: var(--text-primary);
}

.comment-sort-button.is-active {
  color: var(--brand-primary);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}

/* 输入框与评论发布工具栏 */
.comment-composer-box {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card, 12px);
  padding: 10px 12px;
  margin-bottom: 14px;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}

.comment-composer-box:focus-within {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.comment-reply-target-bar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 3px 8px;
  background: var(--brand-soft);
  color: var(--brand-primary);
  border-radius: var(--radius-xs, 4px);
  font-size: 0.78rem;
  margin-bottom: 6px;
}

.comment-reply-target-bar .reply-target-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.comment-reply-target-bar .reply-target-name {
  font-weight: 600;
}

.reply-target-clear-btn {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0 2px;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  transition: color var(--duration-fast);
}

.reply-target-clear-btn:hover {
  color: var(--danger, #f04444);
}

.comment-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: vertical;
  min-height: 52px;
  max-height: 160px;
  background: transparent;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--text-primary);
  font-family: inherit;
}

.comment-textarea::placeholder {
  color: var(--text-tertiary);
}

/* 媒体缩略图预览 */
.comment-media-preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
  margin-bottom: 4px;
}

.comment-media-thumb {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: var(--radius-sm, 6px);
  overflow: hidden;
  border: 1px solid var(--border-light);
  background: var(--background);
}

.comment-media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comment-media-remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  border: none;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--duration-fast);
}

.comment-media-remove-btn:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.85);
}

.comment-media-remove-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.comment-uploading-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  align-self: center;
}

/* 工具栏 */
.comment-composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--border-light);
  position: relative;
}

.composer-tools-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.composer-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: var(--radius-control, 6px);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: color var(--duration-fast), background var(--duration-fast);
}

.composer-tool-btn:hover,
.composer-tool-btn.is-active {
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.composer-tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.emoji-picker-container {
  position: relative;
}

.emoji-picker-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 120;
  width: 320px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card, 12px);
  box-shadow: var(--shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.15));
  padding: 10px;
}

.emoji-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.emoji-picker-close {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 2px 4px;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  transition: color var(--duration-fast);
}

.emoji-picker-close:hover {
  color: var(--text-primary);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.emoji-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 2px;
  border: none;
  border-radius: var(--radius-xs, 4px);
  background: transparent;
  cursor: pointer;
  transition: background var(--duration-fast), transform var(--duration-fast);
}

.emoji-item-btn:hover {
  background: var(--surface-hover, rgba(0, 0, 0, 0.05));
  transform: scale(1.15);
}

.emoji-item-btn img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  pointer-events: none;
}

.composer-tools-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.comment-word-count {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* 加载与空提示 */
.comment-loading,
.comment-error,
.comment-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.comment-error { gap: 8px; color: var(--danger); }
.comment-error button { padding: 4px 10px; color: var(--brand-primary); background: var(--brand-soft); border: 0; border-radius: var(--radius-control); cursor: pointer; }

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
  flex-wrap: wrap;
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

.verify-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: min(280px, 45vw);
  padding: 1px 7px;
  border-radius: 999px;
  background: #fff6e8;
  color: #d87a00;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-detail-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 9px;
  min-height: 18px;
}

.sub-detail-row {
  margin-top: 1px;
}

.comment-time-button,
.comment-device,
.comment-secondary-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.76rem;
  color: var(--text-tertiary);
}

.comment-time-button {
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: color var(--duration-fast);
}

.comment-time-button:hover {
  color: var(--brand-primary);
}

.comment-device {
  max-width: min(210px, 40vw);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 0.72rem;
  opacity: 0.82;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast), opacity var(--duration-fast);
}

.comment-device:hover {
  color: var(--text-secondary);
  opacity: 1;
}

.comment-device i {
  font-size: 0.68rem;
}

.comment-image-grid {
  align-self: flex-start;
}

.sub-comment-images {
  max-width: 360px;
}

.comment-text {
  font-size: 0.88rem;
  color: var(--text-primary);
  line-height: 1.6;
  word-break: break-word;
  cursor: pointer;
  user-select: text;
}

.comment-text *,
.sub-reply-text,
.sub-reply-text * {
  user-select: text;
}

.comment-text :deep(a.coolapk-user-link),
.sub-reply-text :deep(a.coolapk-user-link) {
  color: var(--text-primary);
  font-weight: 400;
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
  color: var(--text-primary);
  font-weight: 400;
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

:deep(.coolapk-emoji),
.comment-text :deep(.coolapk-emoji),
.sub-reply-text :deep(.coolapk-emoji) {
  width: 22px !important;
  height: 22px !important;
  max-width: 22px !important;
  max-height: 22px !important;
  min-width: 22px !important;
  min-height: 22px !important;
  display: inline-block !important;
  vertical-align: -4px !important;
  margin: 0 2px !important;
  object-fit: contain !important;
}

.comment-rich-editor {
  min-height: 52px;
  max-height: 180px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  cursor: text;
  box-sizing: border-box;
}

.comment-rich-editor:empty:before,
.comment-rich-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--text-tertiary, #969ba3) !important;
  pointer-events: none;
}

.comment-rich-editor :deep(.coolapk-emoji),
.comment-rich-editor img.coolapk-emoji {
  width: 22px !important;
  height: 22px !important;
  vertical-align: -4px !important;
  margin: 0 2px !important;
  display: inline-block !important;
  user-select: all !important;
  cursor: default;
}
</style>
