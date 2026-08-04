<template>
  <article class="feed-card" @click="handleCardClick">
    <FeedHeader
      :uid="feed.uid || feed.userInfo?.uid"
      :avatar="feed.userAvatar || feed.userInfo?.userAvatar || feed.pic"
      :username="feed.username || feed.userInfo?.username"
      :level="feed.userInfo?.level"
      :verify-title="feed.userInfo?.verify_title"
      :dateline="feed.dateline"
      :device="feed.device_title"
    />

    <FeedContent
      :title="feed.title"
      :message="feed.message || feed.message_raw_output"
    />

    <FeedImageGrid :images="feed.pics || feed.picArr || (feed.pic ? [feed.pic] : [])" />

    <FeedActionBar
      :feed-id="feed.id"
      :likenum="feed.likenum"
      :replynum="feed.replynum"
      :favnum="feed.favnum"
      :sharenum="feed.sharenum"
      :user-action="feed.userAction"
      @open-comment="toggleComments"
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
import { ref } from 'vue';
import type { FeedItem } from '../../types/feed';
import FeedHeader from './FeedHeader.vue';
import FeedContent from './FeedContent.vue';
import FeedImageGrid from './FeedImageGrid.vue';
import FeedActionBar from './FeedActionBar.vue';
import FeedCommentSection from './FeedCommentSection.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { renderCoolapkEmoji } from '../../utils/coolapkEmoji';

const props = defineProps<{
  feed: FeedItem;
}>();

const showComments = ref(false);
const comments = ref<any[]>([]);
const commentsLoading = ref(false);

async function toggleComments() {
  showComments.value = !showComments.value;
  if (showComments.value && comments.value.length === 0) {
    commentsLoading.value = true;
    try {
      const res = await CoolapkTauriAPI.getFeedReplies(String(props.feed.id), 1);
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
  padding: 20px;
  margin-bottom: 12px;
  transition: background-color var(--duration-fast) var(--ease-default);
  cursor: pointer;
}

.feed-card:hover {
  background-color: var(--surface-hover);
}

.inline-comment-wrapper {
  margin-top: 12px;
  border-top: 1px solid var(--border-light);
  padding-top: 4px;
  cursor: default;
}
</style>
