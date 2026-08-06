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
    />

    <FeedContent
      :title="feed.title"
      :message="feed.message || feed.message_raw_output"
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
      :favnum="feed.favnum"
      :sharenum="feed.sharenum"
      :user-action="feed.userAction"
      @open-comment="toggleComments"
      @toggle-fav="toggleFav"
    />

    <div v-if="showComments" class="inline-comment-wrapper" @click.stop>
      <FeedCommentSection
        :feed-uid="feed.id"
        :feed-username="feed.username"
        :comments="comments"
        :loading="commentsLoading"
        :normalize-img="normalizeImg"
        :format-rich-text="formatRichText"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FeedItem } from '../../types/feed';
import FeedHeader from './FeedHeader.vue';
import FeedContent from './FeedContent.vue';
import FeedImageGrid from './FeedImageGrid.vue';
import FeedActionBar from './FeedActionBar.vue';
import FeedCommentSection from './FeedCommentSection.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { renderCoolapkEmoji } from '../../utils/coolapkEmoji';
import { isFavorite, addFavorite, removeFavorite } from '../../utils/favoritesStore';
import { useSettingsStore } from '../../stores/settings';

const settingsStore = useSettingsStore();
const showDeviceInfo = computed(() => settingsStore.settings.showDeviceInfo);

const props = defineProps<{
  feed: FeedItem;
  rankIndex?: number;
}>();

const showComments = ref(false);
const comments = ref<any[]>([]);
const commentsLoading = ref(false);

function toggleFav() {
  const id = String(props.feed.id);
  if (isFavorite(id)) {
    removeFavorite(id);
  } else {
    addFavorite(props.feed);
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
  toggleComments();
}

function normalizeImg(url: string) {
  return url;
}

function formatRichText(text: string) {
  if (!text) return '';
  let html = text.replace(/\n/g, '<br/>');
  html = renderCoolapkEmoji(html);
  return html;
}
</script>

<style scoped>
.feed-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--feed-card-padding);
  margin-bottom: var(--feed-card-gap);
  transition: background-color var(--duration-fast) var(--ease-default);
  cursor: pointer;
}

.feed-card:hover {
  background-color: var(--surface-hover);
}

.quoted-feed-box {
  background: var(--background-secondary, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  border-radius: var(--radius-md, 10px);
  padding: 12px 14px;
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
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
</style>
