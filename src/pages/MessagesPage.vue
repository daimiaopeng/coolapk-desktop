<template>
  <div class="messages-page">
    <!-- 左侧会话列表 -->
    <div class="messages-sidebar">
      <div class="sidebar-header">
        <h2>私信</h2>
        <AppButton icon="fas fa-plus" size="sm" variant="secondary">新建私信</AppButton>
      </div>
      
      <div class="session-list" v-if="!loadingSessions && sessions.length">
        <div 
          v-for="session in sessions" 
          :key="session.ukey || session.id" 
          class="session-item"
          :class="{ active: currentSession && (currentSession.ukey === session.ukey || currentSession.id === session.id) }"
          @click="selectSession(session)"
        >
          <AppAvatar :src="getAvatar(session)" size="md" />
          <div class="session-info">
            <div class="session-header">
              <span class="username">{{ getUsername(session) }}</span>
              <span class="time">{{ formatTime(getDateline(session)) }}</span>
            </div>
            <div class="last-message">{{ getLastMessage(session) }}</div>
          </div>
        </div>
      </div>
      
      <div class="session-list-status" v-else-if="loadingSessions">
        <LoadingState text="加载中..." />
      </div>
      
      <div class="session-list-status" v-else>
        <EmptyState title="暂无私信" description="去寻找有趣的酷友聊聊吧" />
      </div>
    </div>

    <!-- 右侧聊天区域 -->
    <div class="messages-main" v-if="currentSession">
      <div class="main-header">
        <h3>{{ getUsername(currentSession) }}</h3>
      </div>
      
      <div class="chat-area" ref="chatAreaRef">
        <div class="chat-status" v-if="loadingHistory">
          <LoadingState text="加载聊天记录..." />
        </div>
        
        <template v-else>
          <div 
            v-for="(msg, index) in chatHistory" 
            :key="msg.id || msg.dateline || index" 
            class="message-item"
            :class="{ 'is-self': isSelf(msg) }"
          >
            <AppAvatar v-if="!isSelf(msg)" :src="getAvatar(msg) || getAvatar(currentSession)" size="sm" class="msg-avatar" />
            <div class="message-content">
              <div class="bubble">{{ getMessageText(msg) }}</div>
              <div class="msg-time">{{ formatTime(getDateline(msg)) }}</div>
            </div>
          </div>
        </template>
      </div>
      
      <div class="input-area">
        <textarea
          v-model="inputText"
          placeholder="发消息..."
          @keydown="handleKeydown"
        ></textarea>
        <div class="input-actions">
          <AppButton 
            variant="primary" 
            size="sm"
            @click="sendMessage"
            :disabled="!inputText.trim() || sending"
            :loading="sending"
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
import { ref, onMounted, nextTick, computed } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import AppAvatar from '../components/common/AppAvatar.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import AppButton from '../components/common/AppButton.vue';

// --- 状态管理 ---
const authStore = useAuthStore();
const currentUserUid = computed(() => authStore.user?.uid || authStore.uid);

const sessions = ref<any[]>([]);
const loadingSessions = ref(false);
const currentSession = ref<any>(null);

const chatHistory = ref<any[]>([]);
const loadingHistory = ref(false);

const inputText = ref('');
const sending = ref(false);

const chatAreaRef = ref<HTMLElement | null>(null);

// --- 字段提取工具（容错处理） ---
const getUid = (item: any) => item.uid || item.fuid || item.tuid || '';
const getUsername = (item: any) => item.username || item.title || item.fusername || item.tusername || '未知用户';
const getAvatar = (item: any) => item.userAvatar || item.avatar || item.face || '';
const getLastMessage = (item: any) => item.lastMessage || item.message || item.summary || item.last_message || '';
const getMessageText = (item: any) => item.message || item.text || item.content || '';
const getDateline = (item: any) => item.dateline || item.lastupdate || item.time || item.created_at || 0;

// --- 辅助函数 ---
const formatTime = (time: number | string) => {
  if (!time) return '';
  // 处理可能是秒级的时间戳
  const date = new Date(typeof time === 'number' && time < 10000000000 ? time * 1000 : time);
  
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return `${date.getMonth() + 1}-${date.getDate()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const isSelf = (msg: any) => {
  const msgUid = String(getUid(msg));
  const myUid = String(currentUserUid.value);
  return msgUid === myUid;
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatAreaRef.value) {
    chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight;
  }
};

// --- 数据加载 ---
const loadSessions = async () => {
  loadingSessions.value = true;
  try {
    const res = await CoolapkTauriAPI.listMessages(1);
    if (res?.data) {
      sessions.value = res.data;
    }
  } catch (err) {
    console.error('加载会话列表失败', err);
  } finally {
    loadingSessions.value = false;
  }
};

const selectSession = async (session: any) => {
  currentSession.value = session;
  loadingHistory.value = true;
  chatHistory.value = [];
  try {
    const ukey = session.ukey || session.id;
    if (!ukey) return;
    
    const res = await CoolapkTauriAPI.listChatHistory(ukey, 1);
    if (res?.data) {
      let history = res.data;
      // 确保消息是按照时间正序排列（旧的在上面，新的在下面）
      if (history.length > 1 && getDateline(history[0]) > getDateline(history[history.length - 1])) {
        history = history.reverse();
      }
      chatHistory.value = history;
    }
  } catch (err) {
    console.error('加载聊天记录失败', err);
  } finally {
    loadingHistory.value = false;
    scrollToBottom();
  }
};

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

const sendMessage = async () => {
  const text = inputText.value.trim();
  if (!text || !currentSession.value) return;
  
  sending.value = true;
  try {
    // 对方的 uid
    const targetUid = getUid(currentSession.value);
    
    // 调用 API 发送
    await CoolapkTauriAPI.sendPrivateMessage(targetUid, text);
    
    // 乐观更新 UI
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const newMsg = {
      id: Date.now(),
      uid: currentUserUid.value,
      message: text,
      dateline: nowTimestamp
    };
    
    chatHistory.value.push(newMsg);
    
    // 更新左侧列表的摘要和时间
    currentSession.value.lastMessage = text;
    currentSession.value.dateline = nowTimestamp;
    
    // 将当前会话置顶
    const idx = sessions.value.findIndex(s => s.ukey === currentSession.value.ukey);
    if (idx > 0) {
      const [s] = sessions.value.splice(idx, 1);
      sessions.value.unshift(s);
    }
    
    inputText.value = '';
    scrollToBottom();
  } catch (err) {
    console.error('发送消息失败', err);
  } finally {
    sending.value = false;
  }
};

// --- 生命周期 ---
onMounted(() => {
  loadSessions();
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

.session-list-status {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.session-item {
  display: flex;
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
  align-items: baseline;
}

.session-header .username {
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

.message-item {
  display: flex;
  gap: var(--space-3);
  max-width: 75%;
}

.message-item.is-self {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg-avatar {
  flex-shrink: 0;
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
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.message-item.is-self .bubble {
  background: var(--brand-primary);
  color: #ffffff;
  border-bottom-right-radius: var(--radius-xs);
}

.message-item:not(.is-self) .bubble {
  border-top-left-radius: var(--radius-xs);
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
}

textarea {
  width: 100%;
  height: 90px;
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

.input-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>
