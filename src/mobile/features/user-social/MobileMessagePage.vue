<template>
  <MobileMessageFeature
    :surface="selectedSession ? 'chat' : 'list'"
    :title="selectedSession ? sessionName(selectedSession) : '私信'"
    :subtitle="selectedSession ? '点击头像查看个人主页' : `${sessions.length} 个会话`"
    :loading="listLoading || historyLoading"
    :error="Boolean(listError || (selectedSession && historyError && !messages.length))"
    :error-text="listError || historyError || '消息加载失败，请稍后重试'"
    :empty="!selectedSession && !listLoading && !sessions.length"
    empty-text="暂时没有私信"
    :show-back="Boolean(selectedSession)"
    :scroll="false"
    @back="closeSession"
    @retry="selectedSession ? loadHistory(true) : loadSessions(true)"
  >
    <template #actions>
      <button type="button" aria-label="刷新私信" :disabled="listLoading" @click="loadSessions(true)">
        <i class="fas fa-rotate" :class="{ 'fa-spin': listLoading }" aria-hidden="true"></i>
      </button>
    </template>

    <template #default>
      <div v-if="selectedSession" class="mobile-message-page__chat">
        <button v-if="historyHasMore && !historyLoading" type="button" class="mobile-message-page__older" @click="loadOlderHistory">
          加载更早消息
        </button>
        <span v-else-if="historyLoadingMore" class="mobile-message-page__hint">正在加载更早消息…</span>
        <button v-else-if="historyLoadError" type="button" class="mobile-message-page__older" @click="loadOlderHistory">
          {{ historyLoadError }}，点击重试
        </button>

        <div v-for="message in messages" :key="messageKey(message)" class="mobile-message-page__message" :class="{ 'is-self': isSelf(message) }">
          <button v-if="!isSelf(message)" type="button" class="mobile-message-page__avatar" @click="openPartner">
            <img v-if="partnerAvatar" :src="partnerAvatar" :alt="sessionName(selectedSession)" referrerpolicy="no-referrer" />
            <i v-else class="fas fa-user" aria-hidden="true"></i>
          </button>
          <div class="mobile-message-page__bubble-wrap">
            <div v-if="messageText(message)" class="mobile-message-page__bubble">{{ messageText(message) }}</div>
            <img v-if="messageImage(message)" class="mobile-message-page__image" :src="messageImage(message)" alt="聊天图片" @click="openImage(messageImage(message))" />
            <time>{{ formatTime(message.dateline || message.time || '') }}</time>
          </div>
          <button v-if="isSelf(message)" type="button" class="mobile-message-page__avatar" @click="openCurrentUser">
            <img v-if="authStore.user?.userAvatar" :src="authStore.user.userAvatar" alt="我" referrerpolicy="no-referrer" />
            <i v-else class="fas fa-user" aria-hidden="true"></i>
          </button>
        </div>
        <div v-if="!historyLoading && !messages.length" class="mobile-message-page__empty-chat">还没有聊天记录，发一条消息吧</div>
      </div>

      <div v-else class="mobile-message-page__list">
        <button v-for="session in sessions" :key="sessionKey(session)" type="button" class="mobile-message-page__session" @click="openSession(session)">
          <span class="mobile-message-page__session-avatar">
            <img v-if="partnerAvatarFor(session)" :src="partnerAvatarFor(session)" :alt="sessionName(session)" referrerpolicy="no-referrer" />
            <i v-else class="fas fa-user" aria-hidden="true"></i>
          </span>
          <span class="mobile-message-page__session-copy">
            <strong>{{ sessionName(session) }}</strong>
            <small>{{ plainText(session.message || session.lastMessage || session.summary || session.last_message || '') || '暂无消息' }}</small>
          </span>
          <span class="mobile-message-page__session-meta">
            <time>{{ formatTime(session.dateline || session.lastupdate || session.time || '') }}</time>
            <em v-if="sessionUnread(session)">{{ sessionUnread(session) > 99 ? '99+' : sessionUnread(session) }}</em>
          </span>
        </button>
        <button v-if="hasMoreSessions" type="button" class="mobile-message-page__load-more" :disabled="listLoading" @click="loadSessions(false)">
          {{ listLoading ? '加载中…' : '加载更多会话' }}
        </button>
        <button v-else-if="sessions.length" type="button" class="mobile-message-page__load-more is-ended" disabled>已到底部</button>
      </div>
    </template>

    <template #composer>
      <form class="mobile-message-page__composer" @submit.prevent="sendMessage">
        <input v-model="draft" type="text" maxlength="1000" placeholder="输入消息…" :disabled="sending" />
        <button type="submit" :disabled="sending || !draft.trim()">{{ sending ? '发送中…' : '发送' }}</button>
      </form>
      <p v-if="sendError" class="mobile-message-page__send-error">{{ sendError }}</p>
    </template>
  </MobileMessageFeature>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { useAuthStore } from '../../../stores/auth';
import { useNotificationStore } from '../../../stores/notifications';
import MobileMessageFeature from './MobileMessageFeature.vue';

defineOptions({ name: 'MobileMessagePage' });

type MessageRecord = Record<string, any>;
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const sessions = ref<MessageRecord[]>([]);
const selectedSession = ref<MessageRecord | null>(null);
const messages = ref<MessageRecord[]>([]);
const listLoading = ref(false);
const listError = ref('');
const historyLoading = ref(false);
const historyLoadingMore = ref(false);
const historyError = ref('');
const historyLoadError = ref('');
const historyPage = ref(1);
const historyFirstItem = ref('');
const historyLastItem = ref('');
const historyHasMore = ref(false);
const listPage = ref(1);
const hasMoreSessions = ref(true);
const draft = ref('');
const sending = ref(false);
const sendError = ref('');
let listRequest = 0;
let historyRequest = 0;

const currentUid = computed(() => String(authStore.user?.uid || '').trim());
const partnerUid = computed(() => selectedSession.value ? sessionPartnerUid(selectedSession.value) : '');
const partnerAvatar = computed(() => selectedSession.value ? partnerAvatarFor(selectedSession.value) : '');

function payload(response: any): any { return response?.data ?? response; }
function sessionKey(session: MessageRecord): string { return String(session.ukey || session.id || session.messageUid || `${session.fromuid || ''}-${session.uid || ''}`); }
function sessionPartnerUid(session: MessageRecord): string {
  if (session.messageUid) return String(session.messageUid);
  const sender = String(session.fromuid || session.fromUid || '').trim();
  const recipient = String(session.uid || session.toUid || session.to_uid || '').trim();
  if (sender === currentUid.value && recipient) return recipient;
  if (recipient === currentUid.value && sender) return sender;
  return sender || recipient;
}
function sessionName(session: MessageRecord): string { return String(session.messageUsername || session.fromusername || session.username || '未知酷友'); }
function partnerAvatarFor(session: MessageRecord): string { return String(session.messageUserAvatar || session.fromUserAvatar || session.messageUserInfo?.userAvatar || ''); }
function sessionUnread(session: MessageRecord): number { return Math.max(0, Number(session.unread_count ?? session.unreadCount ?? session.unreadNum ?? session.isnew ?? 0) || 0); }
function plainText(value: unknown): string { return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
function messageKey(message: MessageRecord): string { return String(message.entityId || message.id || `${message.dateline || ''}-${message.fromuid || ''}-${message.message || ''}`); }
function messageText(message: MessageRecord): string { return plainText(message.message || message.text || message.content || ''); }
function messageImage(message: MessageRecord): string {
  const value = String(message.message_pic || message.messagePic || message.pic || message.image || '');
  if (!value) return '';
  if (message.message_pic && message.id) return `https://api.coolapk.com/v6/message/showImage?id=${message.id}&type=n`;
  return value.startsWith('/') ? `https://image.coolapk.com${value}` : value;
}
function isSelf(message: MessageRecord): boolean { return String(message.fromuid || message.fromUid || '') === currentUid.value; }
function formatTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(typeof value === 'number' || /^\d+$/.test(String(value)) ? Number(value) * (Number(value) < 10_000_000_000 ? 1000 : 1) : String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function loadSessions(reset = true): Promise<void> {
  if (listLoading.value) return;
  if (!reset && !hasMoreSessions.value) return;
  if (reset) { listPage.value = 1; hasMoreSessions.value = true; sessions.value = []; }
  const request = ++listRequest;
  listLoading.value = true;
  listError.value = '';
  const requestedPage = listPage.value;
  try {
    const response = await CoolapkTauriAPI.listMessages(requestedPage);
    if (request !== listRequest) return;
    const rows = Array.isArray(payload(response)) ? payload(response) : [];
    const existing = new Set(sessions.value.map(sessionKey));
    const incoming = rows.filter((row: MessageRecord) => !existing.has(sessionKey(row)));
    sessions.value = [...sessions.value, ...incoming];
    listPage.value = requestedPage + 1;
    hasMoreSessions.value = rows.length > 0 && incoming.length > 0 && rows.length >= 20;
    if (rows.length) notificationStore.suppressMessageCount(rows.reduce((sum: number, row: MessageRecord) => sum + (isSelf(row) ? sessionUnread(row) : 0), 0));
  } catch (error) {
    if (request !== listRequest) return;
    listError.value = error instanceof Error ? error.message : '私信列表加载失败';
    if (!reset) listPage.value = Math.max(1, listPage.value - 1);
  } finally {
    if (request === listRequest) listLoading.value = false;
  }
}

async function openSession(session: MessageRecord): Promise<void> {
  selectedSession.value = session;
  messages.value = [];
  historyPage.value = 1;
  historyFirstItem.value = '';
  historyLastItem.value = '';
  historyHasMore.value = true;
  historyError.value = '';
  historyLoadError.value = '';
  const ukey = String(session.ukey || session.id || '').trim();
  if (ukey) void CoolapkTauriAPI.readMessage(ukey).then(() => { notificationStore.markViewed('message'); }).catch(() => undefined);
  await loadHistory(true);
}

async function loadHistory(reset = true): Promise<void> {
  const session = selectedSession.value;
  const ukey = String(session?.ukey || session?.id || '').trim();
  if (!session || !ukey || (historyLoading.value && reset) || historyLoadingMore.value) return;
  const request = ++historyRequest;
  const requestedPage = reset ? 1 : historyPage.value;
  if (reset) { messages.value = []; historyPage.value = 1; historyFirstItem.value = ''; historyLastItem.value = ''; historyHasMore.value = true; }
  if (reset) historyLoading.value = true; else historyLoadingMore.value = true;
  historyError.value = '';
  historyLoadError.value = '';
  try {
    const response = await CoolapkTauriAPI.listChatHistory(ukey, requestedPage, historyFirstItem.value, historyLastItem.value);
    if (request !== historyRequest || selectedSession.value !== session) return;
    const rows = Array.isArray(payload(response)) ? payload(response) : [];
    const sorted = [...rows].sort((a, b) => Number(a.dateline || 0) - Number(b.dateline || 0));
    const existing = new Set(messages.value.map(messageKey));
    const incoming = sorted.filter((row) => !existing.has(messageKey(row)));
    messages.value = reset ? sorted : [...incoming, ...messages.value];
    const cursors = messages.value.filter((row) => row.entityId || row.entity_id || row.id);
    historyFirstItem.value = String(cursors[0]?.entityId || cursors[0]?.entity_id || cursors[0]?.id || '');
    historyLastItem.value = '';
    historyPage.value = requestedPage + 1;
    historyHasMore.value = rows.length > 0 && incoming.length > 0;
  } catch (error) {
    if (request !== historyRequest) return;
    if (reset) historyError.value = error instanceof Error ? error.message : '聊天记录加载失败';
    else historyLoadError.value = error instanceof Error ? error.message : '加载更早消息失败';
  } finally {
    if (request === historyRequest) { historyLoading.value = false; historyLoadingMore.value = false; }
  }
}

function loadOlderHistory(): void { if (historyHasMore.value) void loadHistory(false); }
function closeSession(): void { selectedSession.value = null; draft.value = ''; sendError.value = ''; }
function openPartner(): void { if (partnerUid.value) void router.push(`/user/${encodeURIComponent(partnerUid.value)}`); }
function openCurrentUser(): void { if (currentUid.value) void router.push(`/user/${encodeURIComponent(currentUid.value)}`); }
function openImage(url: string): void { if (url) void CoolapkTauriAPI.openUrl(url, 'system'); }

async function sendMessage(): Promise<void> {
  const text = draft.value.trim();
  if (!text || !partnerUid.value || !selectedSession.value || sending.value) return;
  sending.value = true;
  sendError.value = '';
  try {
    await CoolapkTauriAPI.sendPrivateMessage(partnerUid.value, text);
    messages.value.push({ id: `local-${Date.now()}`, fromuid: currentUid.value, uid: partnerUid.value, message: text, dateline: Math.floor(Date.now() / 1000) });
    selectedSession.value = { ...selectedSession.value, message: text, lastMessage: text, dateline: Math.floor(Date.now() / 1000) };
    draft.value = '';
  } catch (error) {
    sendError.value = error instanceof Error ? error.message : '消息发送失败，请重试';
  } finally { sending.value = false; }
}

async function openQueryTarget(): Promise<void> {
  const targetUid = String(route.query.targetUid || route.query.uid || '').trim();
  if (!targetUid) return;
  const existing = sessions.value.find((session) => sessionPartnerUid(session) === targetUid);
  if (existing) { await openSession(existing); return; }
  try {
    const response = await CoolapkTauriAPI.getUserProfile(targetUid);
    const user = payload(response) || {};
    await openSession({ id: `new-${targetUid}`, ukey: '', messageUid: targetUid, messageUsername: user.username || String(route.query.name || '酷友'), messageUserAvatar: user.userAvatar || user.avatar || '' });
  } catch { await openSession({ id: `new-${targetUid}`, ukey: '', messageUid: targetUid, messageUsername: String(route.query.name || '酷友') }); }
}

watch(() => [route.query.targetUid, route.query.uid], () => void openQueryTarget());
onMounted(async () => { await loadSessions(true); await openQueryTarget(); });
</script>

<style scoped>
.mobile-message-page__list,
.mobile-message-page__chat { display: flex; flex: 1; flex-direction: column; gap: 8px; min-width: 0; }
.mobile-message-page__list { overflow: auto; }
.mobile-message-page__session { display: flex; align-items: center; gap: 11px; min-height: 76px; padding: 10px 12px; border: 0; border-radius: 14px; background: #fff; color: #202124; font: inherit; text-align: left; touch-action: manipulation; }
.mobile-message-page__session:active { background: #f0faf5; }
.mobile-message-page__session-avatar, .mobile-message-page__avatar { display: grid; place-items: center; flex: 0 0 46px; width: 46px; height: 46px; overflow: hidden; border: 0; border-radius: 50%; background: #e5f7ee; color: #0f9d58; }
.mobile-message-page__session-avatar img, .mobile-message-page__avatar img { width: 100%; height: 100%; object-fit: cover; }
.mobile-message-page__session-copy { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }
.mobile-message-page__session-copy strong, .mobile-message-page__session-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-message-page__session-copy small, .mobile-message-page__session-meta { color: #85878d; font-size: 12px; }
.mobile-message-page__session-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.mobile-message-page__session-meta em { min-width: 18px; padding: 2px 5px; border-radius: 999px; background: #e3483b; color: #fff; font-size: 10px; font-style: normal; text-align: center; }
.mobile-message-page__load-more, .mobile-message-page__older { min-height: 38px; border: 1px solid #0f9d58; border-radius: 999px; background: #fff; color: #0f9d58; font: inherit; }
.mobile-message-page__load-more.is-ended { border-color: transparent; color: #85878d; }
.mobile-message-page__chat { overflow: auto; padding: 2px 0 8px; }
.mobile-message-page__older, .mobile-message-page__hint { align-self: center; padding: 0 14px; color: #85878d; font-size: 12px; }
.mobile-message-page__message { display: flex; align-items: flex-end; gap: 8px; max-width: 92%; }
.mobile-message-page__message.is-self { align-self: flex-end; }
.mobile-message-page__bubble-wrap { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mobile-message-page__bubble { padding: 10px 12px; border-radius: 16px 16px 16px 4px; background: #fff; color: #202124; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.is-self .mobile-message-page__bubble { border-radius: 16px 16px 4px; background: #0f9d58; color: #fff; }
.mobile-message-page__bubble-wrap time { padding: 0 4px; color: #999da2; font-size: 10px; }
.is-self .mobile-message-page__bubble-wrap { align-items: flex-end; }
.mobile-message-page__image { max-width: min(220px, 60vw); max-height: 220px; border-radius: 12px; object-fit: contain; }
.mobile-message-page__empty-chat { padding: 32px 12px; color: #85878d; text-align: center; }
.mobile-message-page__composer { display: flex; gap: 8px; }
.mobile-message-page__composer input { flex: 1; min-width: 0; min-height: 42px; padding: 0 12px; border: 1px solid #d9dddf; border-radius: 12px; font: inherit; }
.mobile-message-page__composer button { min-width: 64px; border: 0; border-radius: 12px; background: #0f9d58; color: #fff; font: inherit; }
.mobile-message-page__composer button:disabled { opacity: .5; }
.mobile-message-page__send-error { margin: 5px 0 0; color: #e3483b; font-size: 12px; }
</style>
