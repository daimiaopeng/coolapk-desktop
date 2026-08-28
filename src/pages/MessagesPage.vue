<template>
  <div class="messages-page">
    <!-- 左侧会话列表 -->
    <div class="messages-sidebar">
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
            <div class="last-message">{{ getLastMessage(session) }}</div>
          </div>
          <span v-if="getSessionUnreadCount(session) > 0" class="session-unread-badge" aria-label="未读消息数">{{ getSessionUnreadLabel(session) }}</span>
        </div>
      </div>
      
      <div class="session-list-status" v-else-if="loadingSessions">
        <LoadingState text="加载中..." />
      </div>

      <div class="session-list-status" v-else-if="sessionsError">
        <ErrorState title="私信加载失败" :message="sessionsError" @retry="loadSessions" />
      </div>
      
      <div class="session-list-status" v-else>
        <EmptyState title="暂无私信" description="去寻找有趣的酷友聊聊吧" />
      </div>
    </div>

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
      
      <div class="chat-area" ref="chatAreaRef" @scroll="handleChatScroll">
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
                  <AppImage :src="getPicUrl(msg)" image-class="msg-pure-img" />
                </div>
                <!-- 包含文本或文本+图片混合消息 -->
                <div v-else class="bubble">
                  <div v-if="getPicUrl(msg)" class="msg-pic-container" @click.stop="openMessageImage(msg)">
                    <AppImage :src="getPicUrl(msg)" image-class="msg-img" />
                  </div>
                  <div v-if="getMessageText(msg)" class="msg-text" v-html="renderMessageContent(msg)" @click="handleAnchorClick"></div>
                </div>
                <div class="msg-time">{{ formatTime(getDateline(msg)) }}</div>
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
      
      <div class="input-area">
        <!-- 底部功能工具栏 (酷安表情贴图选择、发图) -->
        <div class="input-toolbar">
          <button class="toolbar-btn" title="表情" @click.stop="toggleEmojiPicker">
            <i class="far fa-face-smile"></i>
          </button>
          <button class="toolbar-btn" title="发图" @click="triggerImageSelect" :disabled="sendingImage">
            <i class="far fa-image"></i>
          </button>
          <input type="file" ref="fileInputRef" accept="image/*" style="display: none;" @change="handleImageSelected" />

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

        <textarea
          ref="textareaRef"
          v-model="inputText"
          placeholder="发消息..."
          @keydown="handleKeydown"
        ></textarea>
        <div v-if="draftSaved" class="draft-status"><i class="far fa-save"></i> 草稿已自动保存</div>
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
    
    <!-- 空状态占位 -->
    <div class="messages-main empty-main" v-else>
      <EmptyState title="选择一个会话开始聊天" icon="far fa-comments" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue';

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

import { useRoute, useRouter } from 'vue-router';

// --- 状态管理 ---
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const currentUserUid = computed(() => authStore.user?.uid || '');

const navigateToUser = (uid?: string | number) => {
  if (uid === undefined || uid === null || uid === '') return;
  router.push(`/user/${uid}`);
};

const sessions = ref<any[]>([]);
const loadingSessions = ref(false);
const sessionsError = ref('');
const currentSession = ref<any>(null);

const chatHistory = ref<any[]>([]);
const loadingHistory = ref(false);
const historyError = ref('');
const chatHistoryCache = new Map<string, any[]>();
let historyRequestSequence = 0;
const MESSAGE_POLL_INTERVAL_MS = 10_000;
let messagePollTimer: number | null = null;
let messagePollingActive = false;
let isMessagesPageActive = false;

const inputText = ref('');
const draftSaved = ref(false);
const sending = ref(false);
const sendingImage = ref(false);
const followingPartner = ref(false);

const showEmojiPicker = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const chatAreaRef = ref<HTMLElement | null>(null);

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
  inputText.value = key ? await loadMessageDraft(currentUserUid.value, key) : '';
  draftSaved.value = Boolean(inputText.value.trim());
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
    if (Array.isArray(parsed)) sessions.value = parsed;
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
// 酷安 API 中：uid = 消息发送者，fromuid = 消息接收者
// 会话列表中：messageUid / messageUsername / messageUserAvatar = 对方信息

/**
 * 从会话列表项中提取对方（聊天伙伴）的 uid。
 * 会话列表 API 返回 messageUid 字段专门表示对方 uid。
 */
const getSessionPartnerUid = (session: any) => {
  if (!session) return '';
  return session.messageUid || session.fromuid || session.uid || '';
};

const getSessionUnreadCount = (session: any) => {
  const unreadNum = Number(session?.unreadNum);
  if (Number.isFinite(unreadNum) && unreadNum > 0) return Math.floor(unreadNum);
  return Number(session?.isnew ?? 0) === 1 || Number(session?.isNew ?? 0) === 1 ? 1 : 0;
};

const getSessionUnreadLabel = (session: any) => {
  const unreadCount = getSessionUnreadCount(session);
  return unreadCount > 99 ? '99+' : String(unreadCount);
};

const isSessionUnread = (session: any) => getSessionUnreadCount(session) > 0;

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

const getSystemNoticeText = (msg: any) => {
  if (!msg) return '';
  return msg.title || msg.message || msg.text || '';
};

const isWarningNotice = (msg: any) => {
  const text = getSystemNoticeText(msg);
  return text.includes('交易') || text.includes('防骗') || text.includes('损失') || text.includes('现金') || text.includes('陌生人');
};

// --- 辅助函数 ---
const formatTime = (time: number | string) => {
  if (!time) return '';
  const date = new Date(typeof time === 'number' && time < 10000000000 ? time * 1000 : time);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return `${date.getMonth() + 1}-${date.getDate()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

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
  }
};

const restoreScrollPositionOrBottom = async (ukey: string) => {
  await nextTick();
  if (!chatAreaRef.value) return;
  const targetKey = String(ukey);
  if (chatScrollMap.has(targetKey)) {
    chatAreaRef.value.scrollTop = chatScrollMap.get(targetKey)!;
  } else {
    chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight;
  }
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
      sessions.value = res.data;
      // 当前聊天已打开时，即使轮询接口暂时返回旧的未读值，也保持当前会话的即时已读状态。
      if (currentSession.value && !isSessionUnread(currentSession.value)) {
        markSessionRead(currentSession.value);
      }
      persistSessionsCache();
      const queryUid = getRouteTargetUid();
      if (queryUid && String(getSessionPartnerUid(currentSession.value)) !== queryUid) {
        await openTargetConversation(queryUid);
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

  const tempSession = {
    id: `new-${targetUid}`,
    messageUid: targetUid,
    messageUsername: `酷友_${targetUid.slice(-4)}`,
    messageUserAvatar: '',
    lastMessage: '开始对话...',
    dateline: Math.floor(Date.now() / 1000),
    isNewConversation: true,
  };
  sessions.value = [tempSession, ...sessions.value.filter((session) => session.id !== tempSession.id)];
  await selectSession(tempSession);

  // 先打开可发送的空会话，再后台补充用户资料，避免资料接口慢导致左侧没有目标会话。
  try {
    const userProf = await withTimeout(
      CoolapkTauriAPI.getUserProfile(targetUid),
      15_000,
      '用户资料请求超时',
    );
    const userData = userProf?.data || {};
    tempSession.messageUsername = userData.username || tempSession.messageUsername;
    tempSession.messageUserAvatar = userData.userAvatar || tempSession.messageUserAvatar;
  } catch {
    // 资料接口失败不影响打开空白会话，仍然可以直接发送私信。
  }
}

const selectSession = async (session: any) => {
  await saveCurrentDraft();
  const requestSequence = ++historyRequestSequence;
  currentSession.value = session;
  // 进入会话即先清理本地角标，不等待聊天记录和下一轮轮询返回。
  if (markSessionRead(session)) notificationStore.markViewed('message');
  await restoreDraft(session);
  historyError.value = '';
  const partnerUid = getSessionPartnerUid(session);
  if (partnerUid && getRouteTargetUid() !== String(partnerUid)) {
    router.replace({ path: '/messages', query: { ...route.query, uid: String(partnerUid) } });
  }

  if (session.isNewConversation) {
    loadingHistory.value = false;
    chatHistory.value = [];
    historyError.value = '';
    return;
  }

  const ukey = session.ukey || session.id;
  if (!ukey) {
    loadingHistory.value = false;
    chatHistory.value = [];
    historyError.value = '该会话缺少聊天标识，请刷新会话列表后重试';
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
    restoreScrollPositionOrBottom(sessionKey);
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
      restoreScrollPositionOrBottom(sessionKey);
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

function activateMessagesPage() {
  if (isMessagesPageActive) return;
  isMessagesPageActive = true;
  window.addEventListener('coolapk-message-count-increased', handleMessageCountIncrease);
  if (!sessions.value.length) void loadSessions();
  startMessagePolling();
}

function deactivateMessagesPage() {
  if (!isMessagesPageActive) return;
  isMessagesPageActive = false;
  window.removeEventListener('coolapk-message-count-increased', handleMessageCountIncrease);
  stopMessagePolling();
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

// 页面由侧边栏宿主保持挂载，使用路由状态代替 keep-alive 的激活/停用生命周期。
watch(
  () => route.path,
  (path) => {
    if (path === '/messages') activateMessagesPage();
    else deactivateMessagesPage();
  },
);

watch(
  () => authStore.user?.uid,
  () => {
    if (!authStore.isLoggedIn) {
      sessions.value = [];
      currentSession.value = null;
      chatHistory.value = [];
      return;
    }
    void loadSessions();
  },
);

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
    alert('已成功关注该酷友！');
  } catch (err: any) {
    alert(err?.message || '关注操作失败，请稍后重试');
  } finally {
    followingPartner.value = false;
  }
};

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value;
};

const insertEmoji = (emojiName: string) => {
  inputText.value += `[${emojiName}]`;
  showEmojiPicker.value = false;
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.focus();
    }
  });
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
    alert(errMsg);
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
    await clearMessageDraft(currentUserUid.value, getConversationKey(currentSession.value));
    draftSaved.value = false;
    scrollToBottom();
  } catch (err: any) {
    console.error('发送消息失败', err);
    const errMsg = typeof err === 'string'
      ? err
      : (err?.message || JSON.stringify(err) || '消息发送失败，请确认网络与账号权限状态');
    alert(errMsg);
  } finally {
    sending.value = false;
  }
};

// --- 生命周期 ---
onMounted(() => {
  restoreSessionsCache();
  window.addEventListener('coolapk-context-delete-message', handleDeleteMessageContext);
  if (route.path === '/messages') {
    activateMessagesPage();
  } else {
    // 隐藏的私信页也读取会话列表，进入栏目时直接复用已准备好的内容。
    void loadSessions();
  }
});

onUnmounted(() => {
  window.removeEventListener('coolapk-context-delete-message', handleDeleteMessageContext);
  deactivateMessagesPage();
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
  width: 320px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-light);
  background: var(--surface);
  flex-shrink: 0;
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
}

.session-header .username {
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
}

/* 右侧主聊天区 */
.messages-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--background);
  min-width: 0; /* 允许自适应缩放 */
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
}

.message-item.is-self {
  align-self: flex-end;
  justify-content: flex-end;
}

.msg-avatar {
  flex-shrink: 0;
  margin-top: 2px;
}

.clickable-avatar {
  cursor: pointer;
  transition: transform var(--duration-fast), opacity var(--duration-fast);
}

.clickable-avatar:hover {
  transform: scale(1.08);
  opacity: 0.88;
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

.header-username {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
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

.message-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.message-item.is-self .message-content {
  align-items: flex-end;
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
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: inline-block;
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
  width: 220px;
  height: 160px;
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-light);
  background: var(--surface);
}

.msg-pic-only-card :deep(.msg-pure-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bubble :deep(.msg-pic-container) {
  width: 220px;
  height: 150px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--space-1);
}

.bubble :deep(.msg-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-sm);
  display: block;
  cursor: pointer;
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
}

.input-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: relative;
}

.toolbar-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-xs);
  transition: color var(--duration-fast);
}

.toolbar-btn:hover {
  color: var(--brand-primary);
  background: var(--surface-hover);
}

.emoji-picker-popover {
  position: absolute;
  bottom: 36px;
  left: 0;
  width: 320px;
  max-height: 240px;
  background: var(--surface);
  border: 1px solid var(--border-light);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-card);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
}

.emoji-item-btn:hover {
  background: var(--surface-hover);
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
}

.follow-action-btn:hover {
  opacity: 0.9;
}

textarea {
  width: 100%;
  height: 70px;
  resize: none;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--font-size-body);
  color: var(--text-primary);
  outline: none;
  line-height: 1.5;
}

textarea::placeholder {
  color: var(--text-tertiary);
}

.draft-status { color: var(--text-tertiary); font-size: var(--font-size-caption); }
.draft-status i { margin-right: 5px; color: var(--brand-primary); }

.input-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>
