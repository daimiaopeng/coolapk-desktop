<template>
  <section
    :class="['mobile-message-feature', `mobile-message-feature--${surface}`, { 'mobile-message-feature--static': !scroll }]"
    :data-scroll="scroll ? 'enabled' : 'disabled'"
    :data-mobile-state="featureState"
    data-mobile-feature="message"
    :aria-busy="loading"
    aria-label="私信"
  >
    <header
      v-if="showBack || title || subtitle || $slots.header || $slots.actions"
      class="mobile-message-feature__header"
      data-mobile-surface="header"
    >
      <button
        v-if="showBack"
        type="button"
        class="mobile-message-feature__back"
        :aria-label="backLabel"
        @click="handleBack"
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span v-if="backLabel">{{ backLabel }}</span>
      </button>

      <slot name="header" :title="title" :subtitle="subtitle" :back="handleBack">
        <div class="mobile-message-feature__heading">
          <h1 v-if="title">{{ title }}</h1>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </slot>

      <div v-if="$slots.actions" class="mobile-message-feature__actions">
        <slot name="actions" />
      </div>
    </header>

    <div v-if="$slots.toolbar" class="mobile-message-feature__toolbar" data-mobile-surface="toolbar">
      <slot name="toolbar" />
    </div>

    <main
      :class="['mobile-message-feature__conversation', { 'mobile-message-feature__conversation--scroll': scroll }]"
      data-mobile-surface="chat"
      data-route-surface
      data-feature-content
    >
      <div v-if="loading" class="mobile-message-feature__state" role="status" aria-live="polite">
        <slot name="loading">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>正在加载消息…</span>
        </slot>
      </div>

      <div v-else-if="error" class="mobile-message-feature__state mobile-message-feature__state--error" role="alert">
        <slot name="error">
          <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
          <strong>{{ errorText }}</strong>
          <button type="button" class="mobile-message-feature__retry" @click="handleRetry">重试</button>
        </slot>
      </div>

      <div
        v-else-if="empty || (surface === 'list' && conversations && !conversations.length && !$slots.default)"
        class="mobile-message-feature__state"
      >
        <slot name="empty">
          <i class="far fa-comment-dots" aria-hidden="true"></i>
          <span>{{ emptyText }}</span>
        </slot>
      </div>

      <div
        v-else-if="surface === 'list' && conversations?.length && !$slots.default"
        class="mobile-message-feature__conversation-list"
        role="list"
      >
        <button
          v-for="conversation in conversations"
          :key="conversationKey(conversation)"
          type="button"
          class="mobile-message-feature__conversation-item"
          :class="{ 'is-active': isActive(conversation) }"
          data-mobile-conversation
          role="listitem"
          @click="selectConversation(conversation)"
        >
          <span class="mobile-message-feature__avatar">
            <img
              v-if="conversation.avatar"
              :src="conversation.avatar"
              :alt="conversation.title"
              referrerpolicy="no-referrer"
            />
            <i v-else class="fas fa-user" aria-hidden="true"></i>
            <i v-if="conversation.online" class="mobile-message-feature__online" aria-label="在线"></i>
          </span>
          <span class="mobile-message-feature__conversation-copy">
            <strong>{{ conversation.title }}</strong>
            <small>{{ conversation.preview || '暂无消息' }}</small>
          </span>
          <span class="mobile-message-feature__conversation-meta">
            <time v-if="conversation.time">{{ conversation.time }}</time>
            <em v-if="conversation.unread">{{ unreadLabel(conversation.unread) }}</em>
          </span>
        </button>
      </div>

      <div v-else class="mobile-message-feature__content">
        <slot :surface="surface" :select-conversation="selectConversation" />
      </div>
    </main>

    <footer v-if="$slots.composer" class="mobile-message-feature__composer" data-mobile-surface="composer">
      <slot name="composer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface MobileConversation {
  id?: string | number;
  key?: string | number;
  title: string;
  preview?: string;
  time?: string;
  avatar?: string;
  unread?: number | boolean;
  online?: boolean;
}

defineOptions({ name: 'MobileMessageFeature' });

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    /** Use list for a conversation list and chat for a single conversation surface. */
    surface?: 'list' | 'chat';
    loading?: boolean;
    error?: boolean;
    errorText?: string;
    empty?: boolean;
    emptyText?: string;
    /** Disable the adapter scroll container when the shared page owns scrolling. */
    scroll?: boolean;
    showBack?: boolean;
    backLabel?: string;
    conversations?: readonly MobileConversation[];
    activeConversationId?: string | number;
  }>(),
  {
    title: '',
    subtitle: '',
    surface: 'chat',
    loading: false,
    error: false,
    errorText: '消息加载失败，请稍后重试',
    empty: false,
    emptyText: '暂时没有私信',
    scroll: true,
    showBack: false,
    backLabel: '返回',
    conversations: undefined,
    activeConversationId: undefined,
  },
);

const emit = defineEmits<{
  back: [];
  retry: [];
  'select-conversation': [conversation: MobileConversation];
}>();

const featureState = computed(() => {
  if (props.loading) return 'loading';
  if (props.error) return 'error';
  if (props.empty || (props.surface === 'list' && props.conversations && !props.conversations.length)) return 'empty';
  return 'ready';
});

function handleBack() {
  emit('back');
}

function handleRetry() {
  emit('retry');
}

function conversationKey(conversation: MobileConversation): string {
  return String(conversation.key ?? conversation.id ?? conversation.title);
}

function isActive(conversation: MobileConversation): boolean {
  return props.activeConversationId !== undefined
    && String(props.activeConversationId) === conversationKey(conversation);
}

function selectConversation(conversation: MobileConversation) {
  emit('select-conversation', conversation);
}

function unreadLabel(unread: number | boolean): string {
  if (unread === true) return '新';
  const value = Number(unread);
  return value > 99 ? '99+' : String(value);
}
</script>

<style scoped>
:host {
  --mobile-message-green: #0f9d58;
  --mobile-message-green-soft: #e5f7ee;
  --mobile-message-bg: #f2f2f6;
  --mobile-message-text: #202124;
  --mobile-message-muted: #85878d;
  --mobile-message-divider: #e5e5e8;
}

.mobile-message-feature {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--mobile-message-bg);
  color: var(--mobile-message-text);
}

.mobile-message-feature__header {
  display: flex;
  flex: 0 0 56px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: max(0px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) 0
    max(12px, env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--mobile-message-divider);
  background: #fff;
}

.mobile-message-feature__heading {
  flex: 1 1 auto;
  min-width: 0;
}

.mobile-message-feature__heading h1 {
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-message-feature__heading p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--mobile-message-muted);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-message-feature__back,
.mobile-message-feature__actions :deep(button) {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 40px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: var(--mobile-message-text);
  font: inherit;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-message-feature__back {
  gap: 6px;
  padding: 0 4px;
  font-size: 14px;
}

.mobile-message-feature__back i {
  font-size: 18px;
}

.mobile-message-feature__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.mobile-message-feature__toolbar {
  flex: 0 0 auto;
  min-width: 0;
  overflow-x: auto;
  padding: 8px max(12px, env(safe-area-inset-left, 0px)) 2px;
  border-bottom: 1px solid var(--mobile-message-divider);
  background: #fff;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-message-feature__toolbar::-webkit-scrollbar {
  display: none;
}

.mobile-message-feature__conversation {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 12px max(12px, env(safe-area-inset-left, 0px)) calc(24px + env(safe-area-inset-bottom, 0px))
    max(12px, env(safe-area-inset-right, 0px));
}

.mobile-message-feature__conversation--scroll {
  overflow: auto;
  overscroll-behavior: contain;
}

.mobile-message-feature--static .mobile-message-feature__conversation {
  overflow: hidden;
}

.mobile-message-feature__content,
.mobile-message-feature__conversation-list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.mobile-message-feature__conversation-list {
  gap: 1px;
  overflow: hidden;
  border-radius: 16px;
  background: var(--mobile-message-divider);
}

.mobile-message-feature__conversation-item {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  min-height: 76px;
  padding: 10px 12px;
  border: 0;
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-message-feature__conversation-item:active,
.mobile-message-feature__conversation-item.is-active {
  background: #f0faf5;
}

.mobile-message-feature__avatar {
  position: relative;
  display: grid;
  flex: 0 0 46px;
  place-items: center;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--mobile-message-green-soft);
  color: var(--mobile-message-green);
  font-size: 18px;
}

.mobile-message-feature__avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-message-feature__online {
  position: absolute;
  right: 0;
  bottom: 1px;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--mobile-message-green);
}

.mobile-message-feature__conversation-copy {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.mobile-message-feature__conversation-copy strong,
.mobile-message-feature__conversation-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-message-feature__conversation-copy strong {
  font-size: 15px;
  font-weight: 600;
}

.mobile-message-feature__conversation-copy small {
  color: var(--mobile-message-muted);
  font-size: 12px;
}

.mobile-message-feature__conversation-meta {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  color: var(--mobile-message-muted);
  font-size: 11px;
}

.mobile-message-feature__conversation-meta em {
  display: inline-grid;
  min-width: 18px;
  min-height: 18px;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  background: #e3483b;
  color: #fff;
  font-size: 10px;
  font-style: normal;
}

.mobile-message-feature__state {
  display: grid;
  flex: 1 1 auto;
  place-items: center;
  gap: 9px;
  min-height: 190px;
  padding: 28px 18px;
  color: var(--mobile-message-muted);
  font-size: 14px;
  text-align: center;
}

.mobile-message-feature__state > i {
  color: var(--mobile-message-green);
  font-size: 24px;
}

.mobile-message-feature__state--error > i {
  color: #e3483b;
}

.mobile-message-feature__state strong {
  color: var(--mobile-message-text);
  font-size: 14px;
  font-weight: 500;
}

.mobile-message-feature__retry {
  min-width: 84px;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--mobile-message-green);
  border-radius: 999px;
  background: #fff;
  color: var(--mobile-message-green);
  font: inherit;
  touch-action: manipulation;
}

.mobile-message-feature__composer {
  flex: 0 0 auto;
  min-width: 0;
  padding: 8px max(12px, env(safe-area-inset-left, 0px)) max(10px, env(safe-area-inset-bottom, 0px))
    max(12px, env(safe-area-inset-right, 0px));
  border-top: 1px solid var(--mobile-message-divider);
  background: #fff;
}

.mobile-message-feature__composer :deep(button),
.mobile-message-feature__composer :deep(input),
.mobile-message-feature__composer :deep(textarea),
.mobile-message-feature__composer :deep([contenteditable='true']) {
  min-height: 40px;
  touch-action: manipulation;
}

.mobile-message-feature__content :deep([data-mobile-message-row]),
.mobile-message-feature__content :deep([data-mobile-chat-bubble]) {
  min-width: 0;
}

.mobile-message-feature__content :deep([data-mobile-message-row]) {
  min-height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

@media (min-width: 720px) {
  .mobile-message-feature__conversation > *,
  .mobile-message-feature__toolbar > * {
    max-width: 720px;
    margin-inline: auto;
  }
}
</style>
