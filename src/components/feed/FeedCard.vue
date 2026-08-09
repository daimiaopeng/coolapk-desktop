<template>
  <article class="feed-card" @click="handleCardClick">
    <FeedHeader
      :uid="feed.uid || feed.userInfo?.uid"
      :avatar="feed.userAvatar || feed.userInfo?.userAvatar || feed.pic"
      :username="feed.username || feed.userInfo?.username"
      :level="feed.userInfo?.level || feed.level"
      :verify-title="feed.userInfo?.verify_title || feed.verifyTitle"
      :dateline="feed.dateline || feed.infoHtml"
      :device="feed.device_title || feed.deviceTitle"
      :rank-index="rankIndex"
      :recommend-source="feed.recommendSource || feed.targetType"
      :show-device-info="showDeviceInfo"
      :entity-type="feed.entityType"
      :entity-id="feed.entityId || feed.id"
      @more="toggleMoreMenu"
    />

    <div v-if="moreMenuOpen" class="more-menu-backdrop" @click.stop="moreMenuOpen = false"></div>
    <div v-if="moreMenuOpen" class="more-menu" @click.stop>
      <button v-if="isMyFeed" class="more-menu-item is-danger" @click="handleDeleteFeed">
        <i class="fas fa-trash-alt"></i> 删除动态
      </button>
    </div>

    <FeedContent
      :feed-id="feed.id"
      :title="feed.title"
      :message="feed.message || feed.message_raw_output"
      :username="feed.username || feed.userInfo?.username"
    />

    <FeedImageGrid :images="feed.pics || feed.picArr || (feed.pic ? [feed.pic] : [])" />

    <!-- 被回复的原动态 / 被引用的卡片预览 -->
    <div v-if="feed.targetRow || feed.replyRows?.length" class="quoted-feed-box">
      <div class="quoted-header" v-if="feed.targetRow?.username || feed.targetRow?.userInfo?.username">
        <span class="quoted-author">@{{ feed.targetRow?.username || feed.targetRow?.userInfo?.username }}</span>
      </div>
      <div class="quoted-message">
        {{ feed.targetRow?.message || feed.targetRow?.title || feed.replyRows?.[0]?.message || '原动态内容' }}
      </div>
      <FeedImageGrid 
        v-if="feed.targetRow?.pics || feed.targetRow?.pic" 
        :images="feed.targetRow?.pics || (feed.targetRow?.pic ? [feed.targetRow?.pic] : [])" 
      />
    </div>

    <FeedActionBar
      :feed-id="feed.id"
      :likenum="feed.likenum"
      :replynum="feed.replynum"
      :favnum="favnum"
      :sharenum="feed.sharenum"
      :user-action="feed.userAction"
      @open-comment="toggleComments"
      @toggle-fav="toggleFav"
      @forward="openForwardDialog"
    />

    <div v-if="showComments" class="inline-comment-wrapper" @click.stop>
      <FeedCommentSection
        :feed-uid="feed.id"
        :feed-username="feed.username"
        :comments="comments"
        :loading="commentsLoading"
        :normalize-img="normalizeImg"
        :format-rich-text="formatRichText"
        @delete-comment="removeComment"
      />
    </div>

    <ForwardDialog v-model:show="forwardOpen" :feed="feed" @success="handleForwardSuccess" />
  </article>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { FeedItem } from '../../types/feed';
import FeedHeader from './FeedHeader.vue';
import FeedContent from './FeedContent.vue';
import FeedImageGrid from './FeedImageGrid.vue';
import FeedActionBar from './FeedActionBar.vue';
import FeedCommentSection from './FeedCommentSection.vue';
import ForwardDialog from '../overlays/ForwardDialog.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { renderCoolapkRichText } from '../../utils/richText';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { showToast } from '../../utils/toast';
import { requestConfirmation } from '../../utils/confirm';
import { getErrorMessage } from '../../utils/errors';

const settingsStore = useSettingsStore();
const router = useRouter();
const showDeviceInfo = computed(() => settingsStore.settings.showDeviceInfo);

const props = defineProps<{
  feed: FeedItem;
  rankIndex?: number;
}>();

const emit = defineEmits<{
  (e: 'deleted', id: string | number): void;
}>();

const authStore = useAuthStore();

const isMyFeed = computed(() => {
  if (!authStore.isLoggedIn || !authStore.user) return false;
  const feedUid = String(props.feed.uid ?? props.feed.userInfo?.uid ?? '');
  return !!feedUid && feedUid === String(authStore.user.uid);
});

const forwardOpen = ref(false);
const moreMenuOpen = ref(false);

function openForwardDialog() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  forwardOpen.value = true;
}

function handleForwardSuccess() {
  props.feed.sharenum = (Number(props.feed.sharenum) || 0) + 1;
}

function toggleMoreMenu() {
  if (!isMyFeed.value) return;
  moreMenuOpen.value = !moreMenuOpen.value;
}

async function handleDeleteFeed() {
  const confirmed = await requestConfirmation({
    title: '删除动态',
    message: '确定要删除这条动态吗？删除后无法恢复。',
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;
  moreMenuOpen.value = false;
  try {
    const res = await CoolapkTauriAPI.deleteFeed(String(props.feed.id));
    if (res && res.code === 200) {
      showToast('动态已删除');
      emit('deleted', props.feed.id);
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

const isFav = ref(props.feed.userAction?.favorite === 1);
const favnum = ref(props.feed.favnum || 0);

const showComments = ref(false);
const comments = ref<any[]>([]);
const commentsLoading = ref(false);

async function toggleFav() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const id = String(props.feed.id);
  const target = !isFav.value;
  isFav.value = target;
  favnum.value = Math.max(0, favnum.value + (target ? 1 : -1));
  try {
    if (target) {
      await CoolapkTauriAPI.favoriteFeed(id);
    } else {
      await CoolapkTauriAPI.unfavoriteFeed(id);
    }
  } catch (err) {
    isFav.value = !target;
    favnum.value = Math.max(0, favnum.value + (target ? -1 : 1));
    console.warn('Failed to toggle favorite', err);
  }
}

async function toggleComments() {
  showComments.value = !showComments.value;
  if (showComments.value && comments.value.length === 0) {
    commentsLoading.value = true;
    try {
      let res: any;
      if (settingsStore.settings.commentSort === 'hot') {
        res = await CoolapkTauriAPI.getHotReplies(String(props.feed.id), 1);
        if (!res || !res.data || !res.data.length) {
          res = await CoolapkTauriAPI.getFeedReplies(String(props.feed.id), 1);
        }
      } else {
        res = await CoolapkTauriAPI.getFeedReplies(String(props.feed.id), 1);
      }
      if (res && res.data) {
        comments.value = res.data;
      }
    } catch (err) {
      console.error('Failed to load comments', err);
    } finally {
      commentsLoading.value = false;
    }
  }
}

function handleCardClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest('a') || target.closest('button') || target.closest('.grid-item') || target.closest('.inline-comment-wrapper')) {
    return;
  }

  const entityType = props.feed.entityType;
  if (entityType === 'product') {
    const productId = props.feed.entityId || props.feed.id;
    if (productId) {
      router.push(`/product/${productId}`);
      return;
    }
  }
  if (entityType === 'dyh') {
    const dyhId = props.feed.entityId || props.feed.id;
    if (dyhId) {
      router.push(`/dyh/${dyhId}`);
      return;
    }
  }
  if (entityType === 'album') {
    const albumId = props.feed.entityId || props.feed.id;
    if (albumId) {
      router.push(`/album/${albumId}`);
      return;
    }
  }

  toggleComments();
}

function normalizeImg(url: string) {
  return url;
}

function formatRichText(text: string) {
  if (!text) return '';
  return renderCoolapkRichText(text);
}
</script>

<style scoped>
.feed-card {
  position: relative;
  background-color: var(--surface);
  border-radius: var(--radius-card, 14px);
  border: 1px solid var(--border);
  padding: 16px 18px;
  margin-bottom: var(--feed-card-gap, 12px);
  transition: background-color 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}

.feed-card:hover {
  background-color: var(--surface-hover);
  border-color: var(--border-dark, rgba(0, 0, 0, 0.12));
}

.quoted-feed-box {
  background: var(--background-secondary, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  border-left: 3px solid var(--brand-primary, #10b981);
  border-radius: 10px;
  padding: 10px 14px;
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.quoted-feed-box:hover {
  background: var(--surface-hover, rgba(0, 0, 0, 0.05));
}

.quoted-author {
  font-weight: 600;
  color: var(--brand-primary, #10b981);
}

.quoted-message {
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.inline-comment-wrapper {
  margin-top: 12px;
  border-top: 1px solid var(--border-light);
  padding-top: 4px;
  cursor: default;
}

.more-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.more-menu {
  position: absolute;
  top: 40px;
  right: 12px;
  z-index: 21;
  min-width: 132px;
  padding: var(--space-1);
  background-color: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  box-shadow: var(--shadow-dropdown);
  display: flex;
  flex-direction: column;
}

.more-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  text-align: left;
  transition: background-color var(--duration-fast) var(--ease-default);
}

.more-menu-item:hover {
  background-color: var(--surface-hover);
}

.more-menu-item.is-danger {
  color: var(--danger);
}

.more-menu-item.is-danger:hover {
  background-color: var(--danger);
  color: var(--text-inverse);
}
</style>
