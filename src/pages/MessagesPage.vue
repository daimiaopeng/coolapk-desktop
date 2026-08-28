<template>
  <div class="messages-page">
    <!-- 左侧会话列表 -->
    <div class="messages-sidebar" :style="{ width: `${sidebarWidth}px` }">
      <div class="sidebar-header">
        <h2>私信</h2>
      </div>
      
      <div class="session-list" v-if="sessions.length">
        <div 
          v-for="session in sessions" 
          :key="session.ukey || session.id" 
          class="session-item"
          data-context-kind="message"
          :data-context-message-ukey="String(session.ukey || (session.isNewConversation ? '' : session.id) || '')"
          :data-context-message-id="String(session.id || '')"
          :data-context-message-new="session.isNewConversation ? 'true' : 'false'"
          :class="{ active: currentSession && (currentSession.ukey === session.ukey || currentSession.id === session.id), unread: isSessionUnread(session) }"
          @click="selectSession(session)"
        >
          <AppAvatar :src="getSessionPartnerAvatar(session)" size="md" />
          <div class="session-info">
            <div class="session-header">
              <span class="username">{{ getUsername(session) }}</span>
              <span class="time">{{ formatTime(getDateline(session)) }}</span>
            </div>
            <div class="last-message" v-html="renderSessionLastMessage(session)"></div>
          </div>
          <span v-if="getSessionUnreadCount(session) > 0" class="session-unread-badge" aria-label="未读消息数">{{ getSessionUnreadLabel(session) }}</span>
        </div>
      </div>
      
      <div class="session-list-status" v-else-if="isNotLoggedIn">
        <EmptyState title="暂无会话" description="登录后同步私信列表" icon="far fa-user" />
      </div>

      <div class="session-list-status" v-else-if="loadingSessions">
        <LoadingState text="加载中..." />
      </div>

      <div class="session-list-status" v-else-if="displaySessionsError">
        <ErrorState title="私信加载失败" :message="displaySessionsError" @retry="loadSessions" />
      </div>
      
      <div class="session-list-status" v-else>
        <EmptyState title="暂无私信" description="去寻找有趣的酷友聊聊吧" />
      </div>
    </div>

    <!-- 左侧会话栏宽度调节手柄 -->
    <div 
      class="sidebar-resizer" 
      title="左右拖拽调整会话列表宽度，双击恢复默认" 
      @mousedown="startResizeSidebar" 
      @dblclick="resetSidebarWidth"
    ></div>

    <!-- 右侧聊天区域 -->
    <div class="messages-main" v-if="currentSession">
      <div class="main-header">
        <div 
          class="header-partner-info clickable-header" 
          @click="navigateToUser(getSessionPartnerUid(currentSession))"
          title="点击查看个人主页"
        >
          <AppAvatar :src="getSessionPartnerAvatar(currentSession)" size="sm" class="header-avatar" />
          <h3 class="header-username">{{ getUsername(currentSession) }}</h3>
          <i class="fas fa-chevron-right header-link-icon"></i>
        </div>
      </div>
      
      <div 
        class="chat-area" 
        :class="{ 'is-ready': isChatPositionReady }" 
        ref="chatAreaRef" 
        @scroll="handleChatScroll"
      >
        <!-- 开发者反馈专属通道提示横幅 -->
        <div v-if="isDeveloperSession" class="developer-feedback-banner">
          <i class="fas fa-lightbulb banner-icon"></i>
          <div class="banner-content">
            <div class="banner-title">酷安桌面版 · 开发者反馈通道</div>
            <div class="banner-desc">欢迎提出使用问题与功能建议。建议附带具体复现步骤或截图，开发者看到后会尽快跟进回复！</div>
          </div>
        </div>

        <div class="chat-status" v-if="loadingHistory">
          <LoadingState text="加载聊天记录..." />
        </div>

        <div class="chat-status" v-else-if="historyError && !chatHistory.length">
          <ErrorState title="聊天记录加载失败" :message="historyError" @retry="retryCurrentSession" />
        </div>
        
        <template v-else>
          <template v-for="(msg, index) in chatHistory" :key="msg.id || msg.dateline || index">
            <!-- 酷安官方系统提醒 / 时间分隔项 (entityType === 'messageExtra') -->
            <div v-if="msg.entityType === 'messageExtra'" class="system-notice-item">
              <div :class="['system-notice-badge', { 'is-warning': isWarningNotice(msg) }]">
                <i v-if="isWarningNotice(msg)" class="fas fa-shield-halved warning-icon"></i>
                <span>{{ getSystemNoticeText(msg) }}</span>
                <button 
                  v-if="getSystemNoticeText(msg).includes('关注')" 
                  class="follow-action-btn" 
                  @click="handleFollowPartner"
                  :disabled="followingPartner"
                >
                  <i class="fas fa-user-plus"></i> {{ followingPartner ? '关注中...' : '关注对方' }}
                </button>
              </div>
            </div>

            <!-- 普通用户对话气泡消息 -->
            <div
              v-else
              class="message-item"
              :class="{ 'is-self': isSelf(msg) }"
            >
              <AppAvatar 
                v-if="!isSelf(msg)" 
                :src="getSessionPartnerAvatar(currentSession)" 
                size="sm" 
                class="msg-avatar clickable-avatar" 
                title="查看个人主页"
                @click="navigateToUser(getSessionPartnerUid(currentSession))"
              />
              <div class="message-content">
                <!-- 纯图片消息 -->
                <div v-if="getPicUrl(msg) && !getMessageText(msg)" class="msg-pic-only-card" @click.stop="openMessageImage(msg)">
                  <AppImage :src="getPicUrl(msg)" fit="contain" image-class="msg-pure-img" />
                </div>
                <!-- 包含文本或文本+图片混合消息 -->
                <div v-else class="bubble-wrapper">
                  <div class="bubble">
                    <div v-if="getPicUrl(msg)" class="msg-pic-container" @click.stop="openMessageImage(msg)">
                      <AppImage :src="getPicUrl(msg)" fit="contain" image-class="msg-img" />
                    </div>
                    <div v-if="getMessageText(msg)" class="msg-text" v-html="renderMessageContent(msg)" @click="handleAnchorClick"></div>
                  </div>
                  <div v-if="getMessageText(msg)" class="bubble-actions">
                    <button class="bubble-action-btn" :title="copiedMsgId === msg.id ? '已复制' : '复制文本'" @click.stop="copyBubbleText(msg)">
                      <i :class="copiedMsgId === msg.id ? 'fas fa-check copied-icon' : 'far fa-copy'"></i>
                    </button>
                  </div>
                </div>
                <div class="msg-time">{{ formatMessageTime(getDateline(msg)) }}</div>
              </div>
              <AppAvatar 
                v-if="isSelf(msg)" 
                :src="authStore.user?.userAvatar" 
                size="sm" 
                class="msg-avatar clickable-avatar" 
                title="查看个人主页"
                @click="navigateToUser(currentUserUid)"
              />
            </div>
          </template>
        </template>
      </div>
      
      <div 
        :class="['input-area', { 'is-fullscreen': isInputFullscreen }]"
        :style="isInputFullscreen ? {} : { height: `${inputAreaHeight}px` }"
      >
        <!-- 顶部拖拽调整高度分割线 -->
        <div 
          v-if="!isInputFullscreen"
          class="input-resizer" 
          title="上下拖拽调整输入框高度，双击恢复默认" 
          @mousedown="startResizeInput" 
          @dblclick="resetInputHeight"
        >
          <div class="resizer-handle-bar"></div>
        </div>

        <!-- 底部功能工具栏 (酷安表情贴图选择、发图、全屏编辑切换) -->
        <div class="input-toolbar">
          <div class="toolbar-left">
            <div class="emoji-picker-container" ref="emojiContainerRef">
              <button 
                :class="['toolbar-btn', { 'is-active': showEmojiPicker }]" 
                title="表情" 
                @click.stop="toggleEmojiPicker"
              >
                <i class="far fa-face-smile"></i>
              </button>

              <!-- 酷安 Emoji 表情包浮动面板 -->
              <div v-if="showEmojiPicker" class="emoji-picker-popover" @click.stop>
                <div class="emoji-picker-header">
                  <span>酷安表情</span>
                  <button class="close-picker-btn" @click="showEmojiPicker = false">&times;</button>
                </div>
                <div class="emoji-grid">
                  <button
                    v-for="(filename, name) in EMOJI_MAP"
                    :key="name"
                    class="emoji-item-btn"
                    :title="String(name)"
                    @click="insertEmoji(String(name))"
                  >
                    <img :src="`${EMOJI_BASE}${filename}`" :alt="String(name)" />
                  </button>
                </div>
              </div>
            </div>

            <button class="toolbar-btn" title="发图" @click="triggerImageSelect" :disabled="sendingImage">
              <i class="far fa-image"></i>
            </button>
            <input type="file" ref="fileInputRef" accept="image/*" style="display: none;" @change="handleImageSelected" />
          </div>

          <div class="toolbar-right">
            <button 
              class="toolbar-btn fullscreen-btn" 
              :class="{ 'is-active': isInputFullscreen }"
              :title="isInputFullscreen ? '退出全屏编辑 (Esc)' : '全屏展开编辑'" 
              @click="toggleInputFullscreen"
            >
              <i :class="isInputFullscreen ? 'fas fa-compress-alt' : 'fas fa-expand-alt'"></i>
              <span class="fullscreen-tip-text">{{ isInputFullscreen ? '退出全屏' : '全屏' }}</span>
            </button>
          </div>
        </div>

        <div
          ref="editorRef"
          class="message-rich-editor"
          contenteditable="true"
          :data-placeholder="isInputFullscreen ? '在此全屏编辑消息内容，支持快捷粘贴或输入长篇文本（按 Esc 退出全屏）...' : '发消息...'"
          @input="handleEditorInput"
          @keydown="handleKeydown"
        ></div>
        
        <div class="input-bottom-bar">
          <div v-if="draftSaved" class="draft-status"><i class="far fa-save"></i> 草稿已自动保存</div>
          <div v-else class="draft-status-placeholder"></div>

          <div class="input-actions">
            <AppButton 
              variant="primary" 
              size="sm"
              @click="sendMessage"
              :disabled="!inputText.trim() || sending || sendingImage"
              :loading="sending || sendingImage"
            >发送</AppButton>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 空状态占位 -->
    <div class="messages-main empty-main" v-else>
      <div v-if="isNotLoggedIn" class="not-login-main-card">
        <div class="not-login-main-icon">
          <i class="fas fa-comments"></i>
        </div>
        <h3 class="not-login-main-title">登录开启私信畅聊</h3>
        <p class="not-login-main-desc">与酷友畅谈数码科技，分享精彩生活动态</p>
        <AppButton variant="primary" size="md" @click="authStore.openLoginModal()">
          <i class="fas fa-sign-in-alt"></i> 立即登录酷安账号
        </AppButton>
      </div>
      <EmptyState v-else title="选择一个会话开始聊天" icon="far fa-comments" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onActivated, onDeactivated, nextTick, computed, watch } from 'vue';

defineOptions({
  name: 'MessagesPage'
});
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import { useAppStore } from '../stores/app';
import { useNotificationStore } from '../stores/notifications';
import AppAvatar from '../components/common/AppAvatar.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import AppButton from '../components/common/AppButton.vue';
import { EMOJI_MAP, EMOJI_BASE } from '../utils/coolapkEmoji';
import { renderCoolapkRichText } from '../utils/richText';
import { coolapkHtmlToPlainText } from '../utils/sanitizeHtml';
import { handleAnchorClick } from '../utils/anchorClick';
import { clearMessageDraft, loadMessageDraft, saveMessageDraft } from '../utils/messageDrafts';
import { requestConfirmation } from '../utils/confirm';
import { showToast } from '../utils/toast';
import {
  getMessageSenderUid,
  getMessageUnreadCount,
  getSelfMessageUnreadCount,
  isMessageSentByCurrentUser,
} from '../utils/messageUnread';

import { DEVELOPER_UID, DEVELOPER_USERNAME } from '../utils/feedback';

import { useRoute, useRouter } from 'vue-router';

// --- 状态管理 ---
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const currentUserUid = computed(() => authStore.user?.uid || '');

const isDeveloperSession = computed(() => {
  const partnerUid = getSessionPartnerUid(currentSession.value);
  return String(partnerUid || '') === DEVELOPER_UID;
});

const navigateToUser = (uid?: string | number) => {
  if (uid === undefined || uid === null || uid === '') return;
  router.push(`/user/${uid}`);
};

const sessions = ref<any[]>([]);
const loadingSessions = ref(false);
const sessionsError = ref('');
const currentSession = ref<any>(null);

const isNotLoggedIn = computed(() => {
  if (!authStore.isLoggedIn) return true;
  const err = sessionsError.value.toLowerCase();
  return err.includes('login') || err.includes('登录') || err.includes('forwardurl') || err.includes('未登录');
});

const displaySessionsError = computed(() => {
  if (!sessionsError.value || isNotLoggedIn.value) return '';
  const err = sessionsError.value;
  if (err.includes('timeout') || err.includes('超时')) return '网络连接超时，请检查网络后重试';
  if (err.startsWith('{') && err.endsWith('}')) {
    try {
      const parsed = JSON.parse(err);
      return parsed.message || parsed.error || '会话列表加载失败';
    } catch {}
  }
  return err;
});

const chatHistory = ref<any[]>([]);
const loadingHistory = ref(false);
const historyError = ref('');
const isChatPositionReady = ref(false);
const chatHistoryCache = new Map<string, any[]>();
let historyRequestSequence = 0;
const MESSAGE_POLL_INTERVAL_MS = 10_000;
let messagePollTimer: number | null = null;
let messagePollingActive = false;

const inputText = ref('');
const draftSaved = ref(false);
const sending = ref(false);
const sendingImage = ref(false);
const followingPartner = ref(false);
const copiedMsgId = ref<number | string | null>(null);
let copyTimer: number | null = null;

async function copyBubbleText(msg: any) {
  const text = getMessageText(msg);
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedMsgId.value = msg.id;
    showToast('已复制文本', 'success');
    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => {
      copiedMsgId.value = null;
    }, 1500);
  } catch {
    showToast('复制失败', 'error');
  }
}

const showEmojiPicker = ref(false);
const emojiContainerRef = ref<HTMLElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const editorRef = ref<HTMLDivElement | null>(null);
const chatAreaRef = ref<HTMLElement | null>(null);

// --- 酷安富文本表情输入框工具函数 ---
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

function syncTextToEditor(text: string) {
  const el = editorRef.value;
  if (!el) return;
  el.innerHTML = '';
  const nodes = parseTextToEditorNodes(text);
  nodes.forEach((n) => el.appendChild(n));
}

function handleEditorInput() {
  const el = editorRef.value;
  if (!el) return;
  inputText.value = getEditorText(el);
}

// --- 栏目拖拽调节与全屏状态 ---
const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 500;

const DEFAULT_INPUT_HEIGHT = 160;
const MIN_INPUT_HEIGHT = 100;
const MAX_INPUT_HEIGHT = 600;

function getStoredNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const val = parseInt(saved, 10);
      if (!Number.isNaN(val) && val >= min && val <= max) return val;
    }
  } catch {}
  return fallback;
}

const sidebarWidth = ref<number>(getStoredNumber('coolapk_messages_sidebar_width', DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH));
const inputAreaHeight = ref<number>(getStoredNumber('coolapk_messages_input_height', DEFAULT_INPUT_HEIGHT, MIN_INPUT_HEIGHT, MAX_INPUT_HEIGHT));
const isInputFullscreen = ref(false);

function toggleInputFullscreen() {
  isInputFullscreen.value = !isInputFullscreen.value;
  void nextTick(() => {
    editorRef.value?.focus();
  });
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (showEmojiPicker.value) {
      showEmojiPicker.value = false;
      return;
    }
    if (isInputFullscreen.value) {
      isInputFullscreen.value = false;
    }
  }
}

function handleClickOutside(event: MouseEvent) {
  if (showEmojiPicker.value && emojiContainerRef.value && !emojiContainerRef.value.contains(event.target as Node)) {
    showEmojiPicker.value = false;
  }
}

// 侧边栏宽度拖拽
let isDraggingSidebar = false;
let startSidebarX = 0;
let startSidebarWidth = DEFAULT_SIDEBAR_WIDTH;

function startResizeSidebar(event: MouseEvent) {
  event.preventDefault();
  isDraggingSidebar = true;
  startSidebarX = event.clientX;
  startSidebarWidth = sidebarWidth.value;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  window.addEventListener('mousemove', onMouseMoveSidebar);
  window.addEventListener('mouseup', stopResizeSidebar);
}

function onMouseMoveSidebar(event: MouseEvent) {
  if (!isDraggingSidebar) return;
  const delta = event.clientX - startSidebarX;
  const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startSidebarWidth + delta));
  sidebarWidth.value = newWidth;
}

function stopResizeSidebar() {
  if (!isDraggingSidebar) return;
  isDraggingSidebar = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onMouseMoveSidebar);
  window.removeEventListener('mouseup', stopResizeSidebar);
  try {
    localStorage.setItem('coolapk_messages_sidebar_width', String(sidebarWidth.value));
  } catch {}
}

function resetSidebarWidth() {
  sidebarWidth.value = DEFAULT_SIDEBAR_WIDTH;
  try {
    localStorage.setItem('coolapk_messages_sidebar_width', String(DEFAULT_SIDEBAR_WIDTH));
  } catch {}
}

// 输入框高度拖拽
let isDraggingInput = false;
let startInputY = 0;
let startInputHeight = DEFAULT_INPUT_HEIGHT;

function startResizeInput(event: MouseEvent) {
  event.preventDefault();
  isDraggingInput = true;
  startInputY = event.clientY;
  startInputHeight = inputAreaHeight.value;
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';

  window.addEventListener('mousemove', onMouseMoveInput);
  window.addEventListener('mouseup', stopResizeInput);
}

function onMouseMoveInput(event: MouseEvent) {
  if (!isDraggingInput) return;
  const delta = startInputY - event.clientY; // 向上拖拽增大输入框高度
  const maxAllowed = typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.8) : MAX_INPUT_HEIGHT;
  const newHeight = Math.min(maxAllowed, Math.max(MIN_INPUT_HEIGHT, startInputHeight + delta));
  inputAreaHeight.value = newHeight;
}

function stopResizeInput() {
  if (!isDraggingInput) return;
  isDraggingInput = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onMouseMoveInput);
  window.removeEventListener('mouseup', stopResizeInput);
  try {
    localStorage.setItem('coolapk_messages_input_height', String(inputAreaHeight.value));
  } catch {}
}

function resetInputHeight() {
  inputAreaHeight.value = DEFAULT_INPUT_HEIGHT;
  try {
    localStorage.setItem('coolapk_messages_input_height', String(DEFAULT_INPUT_HEIGHT));
  } catch {}
}

function getConversationKey(session: any = currentSession.value): string {
  return String(session?.ukey || session?.id || getSessionPartnerUid(session) || '');
}

async function saveCurrentDraft() {
  const key = getConversationKey();
  if (!key) return;
  await saveMessageDraft(currentUserUid.value, key, inputText.value);
  draftSaved.value = Boolean(inputText.value.trim());
}

async function restoreDraft(session: any) {
  const key = getConversationKey(session);
  const savedDraft = key ? await loadMessageDraft(currentUserUid.value, key) : '';
  
  // 检查是否从外部（如一键反馈）带入一次性预填内容
  const routeTargetUid = getRouteTargetUid();
  const sessionPartnerUid = String(getSessionPartnerUid(session) || '');
  const initialText = String(route.query.initialText || route.query.text || '').trim();

  if (initialText && routeTargetUid && sessionPartnerUid === routeTargetUid && !savedDraft) {
    // 仅在当前会话是路由目标会话且没有历史草稿时，填入预设模版
    inputText.value = initialText;
    // 消费后立即清理 URL query 中的 initialText，防止切换会话或清空后反复注入
    const cleanQuery = { ...route.query };
    delete cleanQuery.initialText;
    delete cleanQuery.text;
    delete cleanQuery.open;
    void router.replace({ path: '/messages', query: cleanQuery });
  } else {
    // 读取当前会话专属草稿，没有则为空
    inputText.value = savedDraft || '';
  }

  draftSaved.value = Boolean(inputText.value.trim());
  syncTextToEditor(inputText.value);

  if (inputText.value) {
    void nextTick(() => {
      if (editorRef.value) {
        editorRef.value.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.value);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });
  }
}

watch(inputText, () => {
  draftSaved.value = Boolean(inputText.value.trim());
  void saveCurrentDraft();
});

function sessionsCacheKey() {
  return `coolapk_message_sessions_${currentUserUid.value || 'guest'}`;
}

function restoreSessionsCache() {
  try {
    const cached = sessionStorage.getItem(sessionsCacheKey());
    if (!cached) return;
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed)) sessions.value = parsed.map(normalizeSessionUnreadState);
  } catch {
    sessionStorage.removeItem(sessionsCacheKey());
  }
}

function persistSessionsCache() {
  try {
    sessionStorage.setItem(sessionsCacheKey(), JSON.stringify(sessions.value));
  } catch {
    // 会话缓存写入失败时继续使用内存数据，不影响私信功能。
  }
}

// --- 字段提取工具（基于酷安真实 API 数据结构精确适配） ---
// 酷安 API 中：fromuid = 消息发送者，uid = 消息接收者
// 会话列表中：messageUid / messageUsername / messageUserAvatar = 对方信息

/**
 * 从会话列表项中提取对方（聊天伙伴）的 uid。
 * 会话列表 API 返回 messageUid 字段专门表示对方 uid。
 */
const getSessionPartnerUid = (session: any) => {
  if (!session) return '';
  if (session.messageUid) return session.messageUid;

  // 兼容缺少 messageUid 的旧响应：根据 fromuid（发送者）和 uid（接收者）
  // 排除当前账号，避免自己发消息时把会话错误地指向自己的 UID。
  const senderUid = getMessageSenderUid(session);
  const recipientUid = String(session.uid ?? session.toUid ?? session.to_uid ?? '').trim();
  const myUid = String(currentUserUid.value || '').trim();
  if (myUid && senderUid === myUid && recipientUid) return recipientUid;
  if (myUid && recipientUid === myUid && senderUid) return senderUid;
  return session.fromuid || session.uid || '';
};

const getSessionUnreadCount = (session: any) => {
  return getMessageUnreadCount(session, currentUserUid.value);
};

const getSessionUnreadLabel = (session: any) => {
  const unreadCount = getSessionUnreadCount(session);
  return unreadCount > 99 ? '99+' : String(unreadCount);
};

const isSessionUnread = (session: any) => getSessionUnreadCount(session) > 0;

/** 服务端把自己发出的最后一条消息标为未读时，清除所有相关字段但保留其余会话数据。 */
const normalizeSessionUnreadState = (session: any) => {
  if (!session || !isMessageSentByCurrentUser(session, currentUserUid.value)) return session;
  const normalized = { ...session };
  clearSessionUnreadState(normalized);
  return normalized;
};

const isSameSession = (left: any, right: any) => {
  if (!left || !right) return false;
  const leftKey = getConversationKey(left);
  const rightKey = getConversationKey(right);
  if (leftKey && rightKey && leftKey === rightKey) return true;
  const leftUid = String(getSessionPartnerUid(left) || '');
  const rightUid = String(getSessionPartnerUid(right) || '');
  return Boolean(leftUid && rightUid && leftUid === rightUid);
};

const clearSessionUnreadState = (session: any) => {
  if (!session) return;
  session.isnew = 0;
  session.isNew = false;
  session.unreadNum = 0;
  session.unread_num = 0;
  session.unread_count = 0;
  session.unreadCount = 0;
};

/** 同时清理接口对象、当前会话和列表中的同一会话，避免轮询替换对象后角标残留。 */
const markSessionRead = (session: any) => {
  if (!session) return false;
  const relatedSessions = new Set<any>([session]);
  if (isSameSession(session, currentSession.value)) relatedSessions.add(currentSession.value);
  for (const item of sessions.value) {
    if (isSameSession(session, item)) relatedSessions.add(item);
  }
  const wasUnread = Array.from(relatedSessions).some((item) => isSessionUnread(item));
  relatedSessions.forEach(clearSessionUnreadState);
  return wasUnread;
};

const getRouteTargetUid = () => String(route.query.uid || route.query.targetUid || '').trim();

/**
 * 从会话列表项中提取对方的用户名。
 * 优先使用 messageUsername，其次 fromusername。
 */
const getUsername = (session: any) => {
  if (!session) return '未知酷友';
  return session.messageUsername || session.fromusername || session.username || '未知酷友';
};

/**
 * 从会话列表项中提取对方的头像 URL。
 * 优先使用 messageUserAvatar / fromUserAvatar（对方头像），
 * 而非 userAvatar（可能是自己的头像）。
 */
const getSessionPartnerAvatar = (session: any) => {
  if (!session) return '';
  return session.messageUserAvatar || session.fromUserAvatar
    || session.messageUserInfo?.userAvatar || '';
};

// 会话列表摘要：message 可能为富文本 HTML，转纯文本展示
const getLastMessage = (item: any) =>
  coolapkHtmlToPlainText(item.message || item.lastMessage || item.summary || item.last_message || '');
const getMessageText = (item: any) => item.message || item.text || item.content || '';
const getDateline = (item: any) => item.dateline || item.lastupdate || item.time || item.created_at || 0;

const getPicUrl = (msg: any) => {
  if (!msg) return '';
  const pic = msg.message_pic || msg.pic || msg.image;
  if (!pic) return '';
  // 私信图片消息走官方 showImage 接口（图片数据需登录态 + App Token 认证）
  if (msg.message_pic && msg.id) {
    return `https://api.coolapk.com/v6/message/showImage?id=${msg.id}&type=n`;
  }
  if (pic.startsWith('/')) {
    return `https://image.coolapk.com${pic}`;
  }
  return pic;
};

const renderMessageContent = (msg: any) => {
  if (!msg) return '';
  const text = getMessageText(msg);
  if (!text) return '';
  return renderCoolapkRichText(text);
};

const renderSessionLastMessage = (session: any) => {
  const text = getLastMessage(session);
  if (!text) return '';
  return renderCoolapkRichText(text);
};

const getSystemNoticeText = (msg: any) => {
  if (!msg) return '';
  return msg.title || msg.message || msg.text || '';
};

const isWarningNotice = (msg: any) => {
  const text = getSystemNoticeText(msg);
  return text.includes('交易') || text.includes('防骗') || text.includes('损失') || text.includes('现金') || text.includes('陌生人');
};

// --- 辅助函数 ---
function padZero(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}

/**
 * 会话列表时间显示（紧凑且清晰）：
 * - 今天：14:30
 * - 昨天：昨天
 * - 今年其他日期：08-25
 * - 往年（跨年）：2025-05-23
 */
const formatSessionTime = (time: number | string) => {
  if (!time) return '';
  const date = new Date(typeof time === 'number' && time < 10000000000 ? time * 1000 : time);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());

  // 今天：显示具体时分
  const isToday = year === now.getFullYear() && date.getMonth() === now.getMonth() && day === now.getDate();
  if (isToday) {
    return `${hours}:${minutes}`;
  }

  // 昨天：显示“昨天”
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isYesterday = year === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && day === yesterday.getDate();
  if (isYesterday) {
    return '昨天';
  }

  // 今年其他日期：显示 MM-DD
  if (year === now.getFullYear()) {
    return `${padZero(month)}-${padZero(day)}`;
  }

  // 跨年（非今年）：显示完整 YYYY-MM-DD
  return `${year}-${padZero(month)}-${padZero(day)}`;
};

/**
 * 聊天气泡消息时间显示：
 * - 今天：14:30
 * - 昨天：昨天 14:30
 * - 今年其他日期：08-25 14:30
 * - 往年（跨年）：2025-05-23 14:30
 */
const formatMessageTime = (time: number | string) => {
  if (!time) return '';
  const date = new Date(typeof time === 'number' && time < 10000000000 ? time * 1000 : time);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());
  const timeStr = `${hours}:${minutes}`;

  const isToday = year === now.getFullYear() && date.getMonth() === now.getMonth() && day === now.getDate();
  if (isToday) {
    return timeStr;
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isYesterday = year === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && day === yesterday.getDate();
  if (isYesterday) {
    return `昨天 ${timeStr}`;
  }

  if (year === now.getFullYear()) {
    return `${padZero(month)}-${padZero(day)} ${timeStr}`;
  }

  return `${year}-${padZero(month)}-${padZero(day)} ${timeStr}`;
};

const formatTime = formatSessionTime;

/**
 * 判断一条聊天消息是否是自己发出的。
 * 酷安私信 API 中 fromuid = 发送者，uid = 接收者。
 * 当 fromuid 等于自己的 uid 时，表示这条消息是自己发出的。
 */
const isSelf = (msg: any) => {
  if (!msg || !msg.fromuid) return false;
  const myUid = String(currentUserUid.value || '');
  return String(msg.fromuid) === myUid;
};

const chatScrollMap = new Map<string, number>();

const handleChatScroll = () => {
  if (!currentSession.value || !chatAreaRef.value) return;
  const ukey = currentSession.value.ukey || currentSession.value.id;
  if (ukey) {
    chatScrollMap.set(String(ukey), chatAreaRef.value.scrollTop);
  }
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatAreaRef.value) {
    chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight;
    requestAnimationFrame(() => {
      if (chatAreaRef.value) {
        chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight;
      }
      isChatPositionReady.value = true;
    });
  } else {
    isChatPositionReady.value = true;
  }
};

const restoreScrollPositionOrBottom = async (ukey?: string) => {
  await scrollToBottom();
};

// --- 数据加载 ---
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

const loadSessions = async () => {
  if (!authStore.isLoggedIn) {
    loadingSessions.value = false;
    sessions.value = [];
    currentSession.value = null;
    return;
  }
  if (loadingSessions.value) return;
  if (!sessions.value.length) {
    loadingSessions.value = true;
  }
  sessionsError.value = '';
  try {
    const res = await withTimeout(
      CoolapkTauriAPI.listMessages(1),
      15_000,
      '会话列表请求超时，请检查网络后重试'
    );
    if (res?.data && Array.isArray(res.data)) {
      const rawServerSessions: any[] = res.data;
      // 只抵消列表中明确标记为自己发送的未读数量，不影响未识别发送者的真实未读。
      notificationStore.suppressMessageCount(
        getSelfMessageUnreadCount(rawServerSessions, currentUserUid.value),
      );
      const serverSessions: any[] = rawServerSessions.map(normalizeSessionUnreadState);

      // 检查当前是否有正在活跃打开的临时未建联会话（例如一键反馈）
      const isCurrentTemp = Boolean(currentSession.value?.isNewConversation);
      const targetQueryUid = getRouteTargetUid();

      if (isCurrentTemp || targetQueryUid) {
        const activeTemp = isCurrentTemp ? currentSession.value : sessions.value.find((s) => s?.isNewConversation);
        if (activeTemp) {
          const partnerUid = String(getSessionPartnerUid(activeTemp) || '');
          const serverMatch = serverSessions.find((s) => String(getSessionPartnerUid(s)) === partnerUid);
          if (serverMatch) {
            if (isCurrentTemp) currentSession.value = serverMatch;
            sessions.value = serverSessions;
          } else {
            sessions.value = [activeTemp, ...serverSessions.filter((s) => s.id !== activeTemp.id)];
          }
        } else {
          sessions.value = serverSessions;
        }
      } else {
        // 无指定临时会话时，完全按照真实最新时间排序的列表呈现
        sessions.value = serverSessions;
      }

      // 当前聊天已打开时，即使轮询接口暂时返回旧的未读值，也保持当前会话的即时已读状态。
      if (currentSession.value && isSessionUnread(currentSession.value)) {
        if (markSessionRead(currentSession.value)) notificationStore.markViewed('message');
      }
      persistSessionsCache();

      const queryUid = getRouteTargetUid();
      if (queryUid && String(getSessionPartnerUid(currentSession.value)) !== queryUid) {
        await openTargetConversation(queryUid);
      } else if (!currentSession.value && sessions.value.length > 0) {
        // 默认进入最新一条会话
        await selectSession(sessions.value[0]);
      }
    } else {
      throw new Error('会话列表返回格式不正确');
    }
  } catch (err) {
    console.error('加载会话列表失败', err);
    sessionsError.value = err instanceof Error ? err.message : String(err);
  } finally {
    loadingSessions.value = false;
  }
};

function stopMessagePolling() {
  messagePollingActive = false;
  if (messagePollTimer !== null) {
    window.clearTimeout(messagePollTimer);
    messagePollTimer = null;
  }
}

function scheduleMessagePolling() {
  if (!messagePollingActive || messagePollTimer !== null) return;
  messagePollTimer = window.setTimeout(async () => {
    messagePollTimer = null;
    if (messagePollingActive && !document.hidden && authStore.isLoggedIn) {
      await loadSessions();
    }
    scheduleMessagePolling();
  }, MESSAGE_POLL_INTERVAL_MS);
}

function startMessagePolling() {
  if (messagePollingActive) return;
  messagePollingActive = true;
  scheduleMessagePolling();
}

async function openTargetConversation(uid: string) {
  const targetUid = String(uid || '').trim();
  if (!targetUid) return;

  const found = sessions.value.find((session) => String(getSessionPartnerUid(session)) === targetUid);
  if (found) {
    await selectSession(found);
    return;
  }

  // 优先使用已知开发者昵称或路由传参，瞬时呈现真实名字，消除「酷友_xxxx」闪烁
  const queryUsername = (route.query.username as string) || '';
  const queryAvatar = (route.query.avatar as string) || '';
  const defaultUsername = (targetUid === DEVELOPER_UID ? DEVELOPER_USERNAME : queryUsername) || `酷友_${targetUid.slice(-4)}`;

  const tempSession = {
    id: `new-${targetUid}`,
    messageUid: targetUid,
    messageUsername: defaultUsername,
    messageUserAvatar: queryAvatar,
    lastMessage: '开始对话...',
    dateline: Math.floor(Date.now() / 1000),
    isNewConversation: true,
  };
  sessions.value = [tempSession, ...sessions.value.filter((session) => session.id !== tempSession.id)];
  await selectSession(tempSession);

  // 后台补充用户资料（如真实头像与最新昵称），平滑更新
  try {
    const userProf = await withTimeout(
      CoolapkTauriAPI.getUserProfile(targetUid),
      15_000,
      '用户资料请求超时',
    );
    const userData = userProf?.data || {};
    if (userData.username) tempSession.messageUsername = userData.username;
    if (userData.userAvatar) tempSession.messageUserAvatar = userData.userAvatar;
  } catch {
    // 资料接口失败不影响打开空白会话，仍然可以直接发送私信。
  }
}

const selectSession = async (session: any) => {
  await saveCurrentDraft();
  const requestSequence = ++historyRequestSequence;
  currentSession.value = session;
  isChatPositionReady.value = false;
  // 进入会话即先清理本地角标，不等待聊天记录和下一轮轮询返回。
  if (markSessionRead(session)) notificationStore.markViewed('message');
  await restoreDraft(session);
  historyError.value = '';
  const partnerUid = getSessionPartnerUid(session);
  if (partnerUid && getRouteTargetUid() !== String(partnerUid)) {
    router.replace({ path: '/messages', query: { uid: String(partnerUid) } });
  }

  if (session.isNewConversation) {
    loadingHistory.value = false;
    chatHistory.value = [];
    historyError.value = '';
    isChatPositionReady.value = true;
    return;
  }

  const ukey = session.ukey || session.id;
  if (!ukey) {
    loadingHistory.value = false;
    chatHistory.value = [];
    historyError.value = '该会话缺少聊天标识，请刷新会话列表后重试';
    isChatPositionReady.value = true;
    return;
  }
  const sessionKey = String(ukey);

  // APK 在打开具体会话后调用 message/read；请求与聊天记录加载并行，避免已读状态延迟到下一次轮询。
  void withTimeout(CoolapkTauriAPI.readMessage(sessionKey), 10_000, '标记已读请求超时')
    .then((readResult: any) => {
      markSessionRead(session);
      if (readResult?.data && typeof readResult.data === 'object') {
        notificationStore.applyServerResponse(readResult);
      }
    })
    .catch((err) => {
      console.error('标记会话已读失败', err);
    });

  // 1. 如果缓存中已存在历史记录，直接使用，实现 0 延迟秒切无转圈
  if (chatHistoryCache.has(sessionKey)) {
    chatHistory.value = chatHistoryCache.get(sessionKey) || [];
    loadingHistory.value = false;
    await scrollToBottom();
  } else {
    loadingHistory.value = true;
    chatHistory.value = [];
  }

  // 2. 静默发送 API 请求抓取最新记录并同步更新缓存
  try {
    const res = await withTimeout(
      CoolapkTauriAPI.listChatHistory(sessionKey, 1),
      15_000,
      '聊天记录请求超时，请重试'
    );
    if (requestSequence !== historyRequestSequence) return;
    if (res?.data && Array.isArray(res.data)) {
      const list = [...res.data];
      list.sort((a, b) => {
        const timeA = getDateline(a) || 0;
        const timeB = getDateline(b) || 0;
        return timeA - timeB;
      });
      chatHistory.value = list;
      chatHistoryCache.set(sessionKey, list);
    } else {
      throw new Error('聊天记录返回格式不正确');
    }
  } catch (err) {
    if (requestSequence !== historyRequestSequence) return;
    console.error('加载聊天记录失败', err);
    historyError.value = err instanceof Error ? err.message : String(err);
  } finally {
    if (requestSequence === historyRequestSequence) {
      loadingHistory.value = false;
      await scrollToBottom();
    }
  }
};

const retryCurrentSession = () => {
  if (currentSession.value) void selectSession(currentSession.value);
};

async function deleteSession(detail: { ukey?: string; id?: string; isNew?: boolean }) {
  const session = sessions.value.find((item) => (
    (detail.ukey && String(item.ukey || item.id) === String(detail.ukey))
    || (detail.id && String(item.id) === String(detail.id))
  ));
  if (!session) return;

  const username = getUsername(session);
  const confirmed = await requestConfirmation({
    title: '删除聊天',
    message: `确定删除与“${username}”的聊天吗？删除后将从私信列表移除。`,
    confirmText: '删除',
    danger: true,
  });
  if (!confirmed) return;

  const sessionKey = String(session.ukey || session.id || detail.ukey || '').trim();
  try {
    if (!session.isNewConversation && !detail.isNew) {
      if (!sessionKey) throw new Error('该会话缺少删除标识');
      await CoolapkTauriAPI.deleteMessageChat(sessionKey);
    }

    const index = sessions.value.indexOf(session);
    if (index >= 0) sessions.value.splice(index, 1);
    if (sessionKey) {
      chatHistoryCache.delete(sessionKey);
      chatScrollMap.delete(sessionKey);
    }
    if (currentSession.value === session) {
      currentSession.value = null;
      chatHistory.value = [];
      historyError.value = '';
      await router.replace({ path: '/messages' });
    }
    persistSessionsCache();
    showToast('聊天已删除', 'success');
  } catch (err: any) {
    showToast(err?.message || '删除聊天失败，请稍后重试', 'error');
  }
}

function handleDeleteMessageContext(event: Event) {
  const detail = (event as CustomEvent<{ ukey?: string; id?: string; isNew?: boolean }>).detail;
  if (detail) void deleteSession(detail);
}

function handleMessageCountIncrease() {
  if (authStore.isLoggedIn) void loadSessions();
}

watch(
  () => `${getRouteTargetUid()}|${String(route.query.open || '')}`,
  (value, previousValue) => {
    if (!value || value === previousValue) return;
    const [uid, openToken] = value.split('|');
    if (!uid || (!openToken && String(getSessionPartnerUid(currentSession.value)) === uid)) return;
    void openTargetConversation(uid);
  },
);

onActivated(() => {
  window.addEventListener('coolapk-message-count-increased', handleMessageCountIncrease);
  void loadSessions();
  startMessagePolling();
});

onDeactivated(() => {
  window.removeEventListener('coolapk-message-count-increased', handleMessageCountIncrease);
  stopMessagePolling();
});

// --- 交互事件 ---
const handleKeydown = (e: KeyboardEvent) => {
  // Enter发送，Shift+Enter换行
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // 阻止默认的回车换行
    if (inputText.value.trim() && !sending.value) {
      sendMessage();
    }
  }
};

const handleFollowPartner = async () => {
  if (!currentSession.value || followingPartner.value) return;
  const partnerUid = getSessionPartnerUid(currentSession.value);
  if (!partnerUid) return;

  followingPartner.value = true;
  try {
    await CoolapkTauriAPI.followUser(partnerUid);
    showToast('已成功关注该酷友！', 'success');
  } catch (err: any) {
    showToast(err?.message || '关注操作失败，请稍后重试', 'error');
  } finally {
    followingPartner.value = false;
  }
};

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value;
};

const insertEmoji = (emojiName: string) => {
  const filename = EMOJI_MAP[emojiName];
  const el = editorRef.value;
  const emojiCode = `[${emojiName}]`;
  if (!el) {
    inputText.value += emojiCode;
    showEmojiPicker.value = false;
    return;
  }

  el.focus();
  const sel = window.getSelection();
  const img = createEmojiImg(emojiName, filename);

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

  inputText.value = getEditorText(el);
  showEmojiPicker.value = false;
};

const triggerImageSelect = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

const handleImageSelected = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files && target.files[0];
  if (!file) return;

  if (!currentSession.value) {
    alert('请先选择一个会话再发送图片');
    target.value = '';
    return;
  }
  const targetUid = getSessionPartnerUid(currentSession.value);
  if (!targetUid) {
    alert('未识别到对方的合法酷安账号 UID');
    target.value = '';
    return;
  }

  sendingImage.value = true;
  try {
    // File → ArrayBuffer → Uint8Array → 上传图床
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || 'image/jpeg';
    const fileName = file.name || `image.${contentType.split('/')[1] || 'jpg'}`;
    const res = await CoolapkTauriAPI.uploadImage(bytes, fileName, contentType, 'message', String(targetUid));
    const uploaded: any = res?.data || res;
    let picPath = typeof uploaded === 'string' ? uploaded : (uploaded?.url || uploaded?.data || uploaded?.pic || '');

    // 酷安 message_pic 字段存 /message/ 开头的相对路径
    if (picPath && !picPath.startsWith('/')) {
      const idx = String(picPath).indexOf('/message/');
      picPath = idx >= 0 ? String(picPath).slice(idx) : String(picPath);
    }
    if (!picPath) {
      throw new Error('图片上传成功但未获取到图片地址');
    }

    // 发送图片私信（返回的真实消息带服务端 id，图片显示依赖真实 id）
    const sendRes = await CoolapkTauriAPI.sendPrivateImage(String(targetUid), picPath);
    const realMsg = sendRes?.data && Array.isArray(sendRes.data) ? sendRes.data[0] : null;

    const nowTimestamp = Math.floor(Date.now() / 1000);
    if (realMsg) {
      chatHistory.value.push({ ...realMsg, fromuid: currentUserUid.value, uid: targetUid });
    } else {
      // 乐观更新 UI（与酷安 API 字段一致：uid=接收者，fromuid=发送者）
      chatHistory.value.push({
        id: Date.now(),
        uid: targetUid,
        fromuid: currentUserUid.value,
        message_pic: picPath,
        dateline: nowTimestamp
      });
    }

    // 同步写入缓存
    const ukey = currentSession.value.ukey || currentSession.value.id;
    if (ukey) {
      chatHistoryCache.set(ukey, [...chatHistory.value]);
    }

    // 更新左侧列表摘要与时间
    const sess = currentSession.value;
    if (markSessionRead(sess)) notificationStore.markViewed('message');
    sess.message = '[图片]';
    sess.lastMessage = '[图片]';
    sess.summary = '[图片]';
    sess.last_message = '[图片]';
    sess.dateline = nowTimestamp;
    sess.lastupdate = nowTimestamp;

    if (ukey) {
      chatScrollMap.delete(String(ukey));
    }
    scrollToBottom();
  } catch (err: any) {
    console.error('发送图片失败', err);
    const errMsg = typeof err === 'string'
      ? err
      : (err?.message || JSON.stringify(err) || '图片发送失败，请确认网络与账号权限状态');
    showToast(errMsg, 'error');
  } finally {
    sendingImage.value = false;
    if (target) target.value = '';
  }
};

const appStore = useAppStore();

const openMessageImage = (msg: any) => {
  const url = getPicUrl(msg);
  if (!url) return;
  appStore.openImageViewer([url], 0);
};

const sendMessage = async () => {
  const text = inputText.value.trim();
  if (!text || !currentSession.value) return;
  
  sending.value = true;
  try {
    // 提取对方的真实 uid
    const targetUid = getSessionPartnerUid(currentSession.value);
    if (!targetUid) {
      throw new Error('未识别到对方的合法酷安账号 UID');
    }
    
    // 调用后台原生 API 发送
    await CoolapkTauriAPI.sendPrivateMessage(String(targetUid), text);
    
    // 乐观更新 UI（与酷安 API 字段一致：uid=接收者，fromuid=发送者）
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const newMsg = {
      id: Date.now(),
      uid: targetUid,
      fromuid: currentUserUid.value,
      message: text,
      dateline: nowTimestamp
    };
    
    chatHistory.value.push(newMsg);

    // 同步写入缓存
    const ukey = currentSession.value.ukey || currentSession.value.id;
    if (ukey) {
      chatHistoryCache.set(ukey, [...chatHistory.value]);
    }
    
    // 更新左侧列表的摘要和时间（列表渲染优先读 message 字段）
    const sess = currentSession.value;
    if (markSessionRead(sess)) notificationStore.markViewed('message');
    sess.message = text;
    sess.lastMessage = text;
    sess.summary = text;
    sess.last_message = text;
    sess.dateline = nowTimestamp;
    sess.lastupdate = nowTimestamp;
    
    // 将当前会话置顶
    const idx = sessions.value.findIndex(s => (s.ukey && s.ukey === currentSession.value.ukey) || s.id === currentSession.value.id);
    if (idx > 0) {
      const [s] = sessions.value.splice(idx, 1);
      sessions.value.unshift(s);
    }
    
    if (ukey) {
      chatScrollMap.delete(String(ukey));
    }
    inputText.value = '';
    if (editorRef.value) editorRef.value.innerHTML = '';
    await clearMessageDraft(currentUserUid.value, getConversationKey(currentSession.value));
    draftSaved.value = false;
    scrollToBottom();
  } catch (err: any) {
    console.error('发送消息失败', err);
    const errMsg = typeof err === 'string'
      ? err
      : (err?.message || JSON.stringify(err) || '消息发送失败，请确认网络与账号权限状态');
    showToast(errMsg, 'error');
  } finally {
    sending.value = false;
  }
};

// --- 生命周期 ---
onMounted(() => {
  restoreSessionsCache();
  window.addEventListener('coolapk-context-delete-message', handleDeleteMessageContext);
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('click', handleClickOutside);
  window.addEventListener('coolapk-message-count-increased', handleMessageCountIncrease);
  void loadSessions();
  startMessagePolling();
});

onUnmounted(() => {
  window.removeEventListener('coolapk-context-delete-message', handleDeleteMessageContext);
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('click', handleClickOutside);
  if (isDraggingSidebar) stopResizeSidebar();
  if (isDraggingInput) stopResizeInput();
  window.removeEventListener('coolapk-message-count-increased', handleMessageCountIncrease);
  stopMessagePolling();
  saveCurrentDraft();
});
</script>

<style scoped>
.messages-page {
  display: flex;
  width: 100%;
  height: 100%; /* 占满整个可用区域 */
  background: var(--surface);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

/* 左侧侧边栏 */
.messages-sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-light);
  background: var(--surface);
  flex-shrink: 0;
  min-width: 220px;
  max-width: 500px;
}

.sidebar-resizer {
  width: 6px;
  margin-left: -3px;
  margin-right: -3px;
  cursor: col-resize;
  z-index: 10;
  transition: background-color var(--duration-fast);
  background: transparent;
  flex-shrink: 0;
}

.sidebar-resizer:hover,
.sidebar-resizer:active {
  background-color: var(--brand-primary);
  opacity: 0.6;
}

.sidebar-header {
  padding: var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-light);
  background: var(--surface);
  z-index: 1;
}

.sidebar-header h2 {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.session-list {
  flex: 1;
  overflow-y: auto;
}

.session-list-status .main-header h3 {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.header-partner-info {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast);
}

.header-partner-info:hover {
  background: var(--surface-hover);
}

.header-avatar {
  flex-shrink: 0;
}

.header-link-icon {
  font-size: 11px;
  color: var(--text-tertiary);
  opacity: 0.6;
  transition: transform var(--duration-fast);
}

.header-partner-info:hover .header-link-icon {
  opacity: 1;
  transform: translateX(2px);
  color: var(--brand-primary);
}

.session-list-status {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-4);
}

/* 左侧会话未登录引导状态卡片 */
.not-login-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-6) var(--space-4);
  gap: 10px;
  animation: notLoginPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.not-login-icon-box {
  width: 54px;
  height: 54px;
  border-radius: var(--radius-pill);
  background: var(--brand-soft, rgba(16, 185, 129, 0.12));
  color: var(--brand-primary, #10b981);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  margin-bottom: 4px;
}

.not-login-title {
  font-size: var(--font-size-title-sm, 15px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary);
  margin: 0;
}

.not-login-desc {
  font-size: var(--font-size-caption, 12px);
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.5;
  max-width: 200px;
}

.not-login-btn {
  margin-top: 6px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
  transition: all 0.2s ease;
}

.not-login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
}

/* 右侧主聊天区未登录大卡片 */
.not-login-main-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 24px;
  gap: 12px;
  animation: notLoginPop 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.not-login-main-icon {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-pill);
  background: var(--brand-soft, rgba(16, 185, 129, 0.12));
  color: var(--brand-primary, #10b981);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.2);
  margin-bottom: 6px;
}

.not-login-main-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.not-login-main-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 8px 0;
}

@keyframes notLoginPop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.session-item {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  gap: var(--space-3);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-default);
  border-bottom: 1px solid transparent;
}

.session-item:hover {
  background: var(--surface-hover);
}

.session-item.active {
  background: var(--brand-soft);
  border-left: 3px solid var(--brand-primary);
}

.session-item {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  gap: var(--space-3);
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.15s ease;
  border-bottom: 1px solid transparent;
  position: relative;
}

.session-item:hover {
  background: var(--surface-hover);
}

.session-item:hover .app-avatar {
  transform: scale(1.05);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.session-item.active {
  background: var(--brand-soft);
  border-left: 3px solid var(--brand-primary);
  animation: activeSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes activeSlideIn {
  from {
    border-left-width: 0px;
    opacity: 0.8;
  }
  to {
    border-left-width: 3px;
    opacity: 1;
  }
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-1);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.session-header .username {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-header .time {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  flex-shrink: 0;
  white-space: nowrap;
}

.session-unread-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  background: #ef4444;
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  line-height: 18px;
  box-sizing: border-box;
  flex-shrink: 0;
  margin-left: 2px;
  animation: badgePopIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes badgePopIn {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.session-item.unread .session-header .username {
  font-weight: var(--font-weight-bold);
}

.last-message {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 2px;
}

.last-message :deep(.coolapk-emoji),
.last-message :deep(img.coolapk-emoji) {
  width: 15px !important;
  height: 15px !important;
  max-width: 15px !important;
  max-height: 15px !important;
  min-width: 15px !important;
  min-height: 15px !important;
  vertical-align: middle !important;
  display: inline-block !important;
  margin: 0 1px !important;
}

/* 右侧主聊天区 */
.messages-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--background);
  min-width: 0;
  position: relative;
}

.messages-main.empty-main {
  justify-content: center;
  align-items: center;
  background: var(--surface);
}

.main-header {
  padding: var(--space-4);
  background: var(--surface);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  z-index: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.main-header h3 {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.chat-area {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  opacity: 0;
  transition: opacity 0.12s ease-out;
}

.chat-area.is-ready {
  opacity: 1;
}

.chat-status {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
}

.system-notice-item {
  display: flex;
  justify-content: center;
  margin: var(--space-2) 0;
  width: 100%;
}

.system-notice-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background: var(--background-secondary, rgba(0, 0, 0, 0.04));
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  max-width: 85%;
  transition: all 0.2s ease;
}

.system-notice-badge.is-warning {
  background: rgba(234, 179, 8, 0.12);
  color: #b45309;
  border: 1px solid rgba(234, 179, 8, 0.25);
}

.system-notice-badge .warning-icon {
  color: #d97706;
  font-size: 13px;
  flex-shrink: 0;
}

.message-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  max-width: 75%;
  animation: msgBubblePopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@keyframes msgBubblePopIn {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.message-item.is-self {
  align-self: flex-end;
  justify-content: flex-end;
}

.msg-avatar {
  flex-shrink: 0;
  margin-top: 2px;
}

.msg-avatar.clickable-avatar {
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.msg-avatar.clickable-avatar:hover {
  transform: scale(1.08);
}

.header-partner-info.clickable-header {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast);
}

.header-partner-info.clickable-header:hover {
  background: var(--surface-hover);
}

.header-partner-info.clickable-header:hover .header-username {
  color: var(--brand-primary);
}

.header-partner-info.clickable-header:hover .header-link-icon {
  opacity: 1;
  transform: translateX(3px);
  color: var(--brand-primary);
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.message-item.is-self .message-content {
  align-items: flex-end;
}

.bubble-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.bubble {
  position: relative;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: 1.5;
  word-break: break-word;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: inline-block;
  transition: box-shadow 0.2s ease;
}

.bubble:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 气泡悬浮快捷操作栏 */
.bubble-actions {
  position: absolute;
  top: 50%;
  transform: translateY(-50%) scale(0.85);
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  gap: 3px;
  background: var(--surface);
  border: 1px solid var(--border-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill);
  padding: 2px 4px;
  z-index: 10;
}

.message-item:not(.is-self) .bubble-actions {
  left: calc(100% + 8px);
}

.message-item.is-self .bubble-actions {
  right: calc(100% + 8px);
}

.bubble-wrapper:hover .bubble-actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) scale(1);
}

.bubble-action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 3px 5px;
  font-size: 11px;
  color: var(--text-secondary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.bubble-action-btn:hover {
  color: var(--brand-primary);
  background: var(--surface-hover);
}

.bubble-action-btn:active {
  transform: scale(0.9);
}

.copied-icon {
  color: var(--brand-primary, #10b981);
}

/* 对方消息气泡（左侧，白色/Surface背景 + 左小尖角引出） */
.message-item:not(.is-self) .bubble {
  border-top-left-radius: 2px;
}

.message-item:not(.is-self) .bubble::before {
  content: '';
  position: absolute;
  top: 10px;
  left: -6px;
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-right: 7px solid var(--surface);
}

/* 自己消息气泡（右侧，品牌绿背景 + 右小尖角引出） */
.message-item.is-self .bubble {
  background: var(--brand-primary);
  color: #ffffff;
  border-top-right-radius: 2px;
}

.message-item.is-self .bubble::before {
  content: '';
  position: absolute;
  top: 10px;
  right: -6px;
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 7px solid var(--brand-primary);
}

/* 富文本、超链接与表情图片全局样式 */
.bubble :deep(a) {
  color: var(--brand-primary);
  text-decoration: underline;
  word-break: break-all;
}

.message-item.is-self .bubble :deep(a) {
  color: #ffffff !important;
  font-weight: bold;
  text-decoration: underline;
}

.bubble :deep(.coolapk-emoji) {
  width: 22px;
  height: 22px;
  vertical-align: -5px;
  display: inline-block;
  margin: 0 1px;
}

.msg-pic-only-card {
  max-width: 320px;
  max-height: 480px;
  border-radius: var(--radius-card, 10px);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-light);
  background: transparent;
  display: inline-block;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.msg-pic-only-card:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
}

.msg-pic-only-card :deep(.msg-pure-img) {
  max-width: 320px;
  max-height: 480px;
  width: auto;
  height: auto;
  display: flex;
  background: transparent;
}

.msg-pic-only-card :deep(.msg-pure-img img) {
  max-width: 320px;
  max-height: 480px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: var(--radius-card, 10px);
  display: block;
}

.bubble :deep(.msg-pic-container) {
  max-width: 320px;
  max-height: 380px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--space-1);
  background: transparent;
}

.bubble :deep(.msg-img) {
  max-width: 320px;
  max-height: 380px;
  width: auto;
  height: auto;
  background: transparent;
  display: flex;
}

.bubble :deep(.msg-img img) {
  max-width: 320px;
  max-height: 380px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: var(--radius-sm);
  display: block;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.bubble :deep(.msg-img img:hover) {
  transform: scale(1.03);
}

.msg-time {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin-top: 2px;
}

.input-area {
  background: var(--surface);
  border-top: 1px solid var(--border-light);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  position: relative;
  box-sizing: border-box;
  min-height: 100px;
  transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, padding 0.25s ease;
}

.input-area.is-fullscreen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100% !important;
  z-index: 100;
  padding: var(--space-4);
  border-top: none;
  background: var(--surface);
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.12);
  animation: fullscreenExpand 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fullscreenExpand {
  from {
    opacity: 0.92;
    transform: scaleY(0.97);
    transform-origin: bottom;
  }
  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

.input-resizer {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 8px;
  cursor: row-resize;
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
}

.input-resizer .resizer-handle-bar {
  width: 36px;
  height: 3px;
  border-radius: 2px;
  background: var(--border);
  opacity: 0.6;
  transition: all var(--duration-fast);
}

.input-resizer:hover .resizer-handle-bar,
.input-resizer:active .resizer-handle-bar {
  background: var(--brand-primary);
  width: 52px;
  opacity: 1;
}

.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.toolbar-btn {
  background: transparent;
  border: none;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  transition: all var(--duration-fast);
}

.toolbar-btn:hover,
.toolbar-btn.is-active {
  color: var(--brand-primary);
  background: var(--surface-hover);
}

.toolbar-btn:active {
  transform: scale(0.92);
}

.fullscreen-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
  border-radius: var(--radius-pill);
  padding: 3px 10px;
  transition: all 0.2s ease;
}

.fullscreen-btn.is-active {
  color: var(--brand-primary);
  background: var(--brand-soft);
  font-weight: var(--font-weight-medium);
}

.fullscreen-btn:active {
  transform: scale(0.94);
}

.fullscreen-tip-text {
  font-size: 12px;
}

.emoji-picker-container {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.emoji-picker-popover {
  position: absolute;
  bottom: 36px;
  left: 0;
  width: 320px;
  max-height: 240px;
  background: var(--surface);
  border: 1px solid var(--border-light);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
  border-radius: var(--radius-card);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: emojiSpringPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom left;
}

@keyframes emojiSpringPop {
  0% {
    opacity: 0;
    transform: scale(0.9) translateY(8px);
  }
  70% {
    opacity: 1;
    transform: scale(1.02) translateY(-2px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.emoji-picker-header {
  padding: var(--space-2) var(--space-3);
  background: var(--background-secondary, #f8f9fa);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
}

.close-picker-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: transform 0.15s ease, color 0.15s ease;
}

.close-picker-btn:hover {
  color: var(--text-primary);
  transform: scale(1.15);
}

.close-picker-btn:active {
  transform: scale(0.9);
}

.emoji-grid {
  padding: var(--space-2);
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
  overflow-y: auto;
  max-height: 190px;
}

.emoji-item-btn {
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.15s ease;
}

.emoji-item-btn:hover {
  background: var(--surface-hover);
  transform: scale(1.28);
  z-index: 10;
}

.emoji-item-btn:active {
  transform: scale(1.05);
}

.emoji-item-btn img {
  width: 24px;
  height: 24px;
}

.follow-action-btn {
  margin-left: var(--space-2);
  background: var(--brand-primary);
  color: #ffffff;
  border: none;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
}

.follow-action-btn:hover {
  opacity: 0.92;
  transform: scale(1.02);
}

.follow-action-btn:active {
  transform: scale(0.95);
}

.message-rich-editor {
  width: 100%;
  flex: 1;
  min-height: 50px;
  height: 100%;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--font-size-body);
  color: var(--text-primary);
  outline: none;
  line-height: 1.6;
  padding: 0;
  box-sizing: border-box;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
  user-select: text;
}

.message-rich-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--text-tertiary);
  pointer-events: none;
}

.input-area.is-fullscreen .message-rich-editor {
  font-size: 14.5px;
  line-height: 1.7;
}

.message-rich-editor :deep(.coolapk-emoji),
.message-rich-editor img.coolapk-emoji {
  width: 22px;
  height: 22px;
  vertical-align: -4px;
  display: inline-block;
  margin: 0 1px;
}

.developer-feedback-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: var(--radius-card, 12px);
  margin-bottom: var(--space-3);
  color: var(--text-primary);
  animation: bannerFadeIn 0.25s ease-out;
}

@keyframes bannerFadeIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.developer-feedback-banner .banner-icon {
  font-size: 18px;
  color: var(--brand-primary, #10b981);
  margin-top: 2px;
  flex-shrink: 0;
}

.developer-feedback-banner .banner-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.developer-feedback-banner .banner-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-primary, #10b981);
}

.developer-feedback-banner .banner-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

textarea::placeholder {
  color: var(--text-tertiary);
}

.input-bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  flex-shrink: 0;
}

.draft-status-placeholder {
  flex: 1;
}

.draft-status { 
  color: var(--text-tertiary); 
  font-size: var(--font-size-caption); 
  animation: draftFade 0.2s ease;
}

@keyframes draftFade {
  from { opacity: 0; transform: translateX(-4px); }
  to { opacity: 1; transform: translateX(0); }
}

.draft-status i { margin-right: 5px; color: var(--brand-primary); }

.input-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>
