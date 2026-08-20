<template>
  <article class="rating-card" @click="handleCardClick">
    <!-- 头部用户信息 -->
    <FeedHeader
      :uid="feed.uid || feed.userInfo?.uid"
      :avatar="feed.userAvatar || feed.userInfo?.userAvatar || feed.pic"
      :username="feed.username || feed.userInfo?.username"
      :level="feed.userInfo?.level"
      :verify-title="feed.userInfo?.verify_title"
      :dateline="feed.dateline"
      :device="feed.device_title || feed.target_title"
      :show-device-info="showDeviceInfo"
    />

    <!-- 总体星级与机主评分标签 -->
    <div class="rating-score-banner" v-if="starCount > 0 || feed.star">
      <span class="owner-badge">
        <i class="fas fa-mobile-alt"></i> 机主评分
      </span>
      <div class="star-rating-stars">
        <i 
          v-for="i in 5" 
          :key="i" 
          :class="['fas', 'fa-star', { 'active': i <= starCount }]"
        ></i>
      </div>
      <span class="score-text" v-if="scoreText">{{ scoreText }}</span>
    </div>

    <!-- 多维度参数打分项列表 (续航、影像、性能、屏幕等) -->
    <div class="rating-dimensions-row" v-if="subRatings.length > 0">
      <div v-for="item in subRatings" :key="item.label" class="sub-rating-item">
        <span class="sub-label">{{ item.label }}</span>
        <span class="sub-stars">{{ item.score }}★</span>
      </div>
    </div>

    <!-- 点评正文及维度的结构化评语 -->
    <div class="rating-body">
      <div v-if="feed.message" class="message-text" v-html="formattedMessage" @click="handleAnchorClick"></div>
    </div>

    <!-- 点评配图 -->
    <FeedImageGrid :images="feed.pics || feed.picArr || (feed.pic ? [feed.pic] : [])" />

    <!-- 关联的数码设备卡片盒子 -->
    <div class="target-device-card" v-if="targetProduct">
      <div class="device-thumb">
        <AppImage :src="targetProduct.logo || targetProduct.pic" image-class="device-img" />
      </div>
      <div class="device-info">
        <h4 class="device-title">{{ targetProduct.title }}</h4>
        <p class="device-count" v-if="targetProduct.comment_count || targetProduct.hot_num">
          {{ targetProduct.comment_count || targetProduct.hot_num }} 人点评
        </p>
      </div>
      <div class="device-rating-box" v-if="targetProduct.score || targetProduct.rating">
        <span class="big-score">{{ targetProduct.score || targetProduct.rating }}</span>
        <div class="mini-stars">
          <i v-for="i in 5" :key="i" class="fas fa-star active"></i>
        </div>
      </div>
    </div>

    <!-- 底部互动操作栏 -->
    <FeedActionBar
      :feed-id="feed.id"
      :likenum="feed.likenum"
      :replynum="feed.replynum"
      :favnum="favnum"
      :sharenum="feed.sharenum"
      :favorited="isFav"
      :user-action="feed.userAction"
      @open-comment="toggleComments"
      @toggle-fav="toggleFav"
    />

    <!-- 评论区域折叠展示 -->
    <div v-if="showComments" class="inline-comment-wrapper" @click.stop>
      <FeedCommentSection
        :feed-id="feed.id"
        :feed-uid="feed.uid || feed.userInfo?.uid"
        :feed-username="feed.username"
        :comments="comments"
        :loading="commentsLoading"
        :normalize-img="(u) => u"
        :format-rich-text="formatRichText"
      />
    </div>

    <FeedCollectionPickerDialog
      :is-open="collectionPickerOpen"
      :collections="collectionOptions"
      :selected-ids="collectionInitialSelectedIds"
      :loading="collectionPickerLoading"
      :submitting="collectionPickerSubmitting"
      @close="closeCollectionPicker"
      @confirm="confirmCollectionSelection"
    />
  </article>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import FeedHeader from './FeedHeader.vue';
import FeedImageGrid from './FeedImageGrid.vue';
import FeedActionBar from './FeedActionBar.vue';
import FeedCollectionPickerDialog from './FeedCollectionPickerDialog.vue';
import FeedCommentSection from './FeedCommentSection.vue';
import AppImage from '../common/AppImage.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { renderCoolapkRichText } from '../../utils/richText';
import { getReplyData, mergeReplies } from '../../utils/commentList';
import { handleAnchorClick } from '../../utils/anchorClick';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';

const settingsStore = useSettingsStore();
const showDeviceInfo = computed(() => settingsStore.settings.showDeviceInfo);

const props = defineProps<{
  feed: any;
}>();

const authStore = useAuthStore();

const isFav = ref(props.feed.userAction?.collect === 1 || props.feed.userAction?.favorite === 1);
const favnum = ref(props.feed.favnum || 0);
const favoritePending = ref(false);
const collectionPickerOpen = ref(false);
const collectionPickerLoading = ref(false);
const collectionPickerSubmitting = ref(false);
const collectionOptions = ref<any[]>([]);
const collectionInitialSelectedIds = ref<string[]>([]);

const showComments = ref(false);
const comments = ref<any[]>([]);
const commentsLoading = ref(false);

async function toggleFav() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (favoritePending.value) return;

  const id = String(props.feed.id);
  const target = !isFav.value;
  const feedType = String(props.feed.entityType || props.feed.feedType || 'feed');
  const trace = String(props.feed.trace || props.feed.extra_key || '');

  if (target) {
    await openCollectionPicker(id);
    return;
  }

  favoritePending.value = true;
  try {
    await CoolapkTauriAPI.setFeedCloudFavorite(id, target, feedType, trace);
    isFav.value = target;
    favnum.value = Math.max(0, favnum.value + (target ? 1 : -1));
    showToast(target ? '已收藏到云端' : '已取消云端收藏', 'success');
  } catch (err) {
    showToast(getErrorMessage(err, target ? '收藏失败' : '取消收藏失败'), 'error');
  } finally {
    favoritePending.value = false;
  }
}

function collectionId(collection: any): string {
  return String(collection?.id ?? collection?.collectionId ?? collection?.entityId ?? '');
}

function isCollectionSelected(collection: any): boolean {
  const value = collection?.isBeCollected ?? collection?.is_be_collected;
  return value === true || value === 1 || value === '1' || value === 'true';
}

async function openCollectionPicker(feedId: string) {
  if (collectionPickerOpen.value || collectionPickerLoading.value) return;
  favoritePending.value = true;
  collectionPickerLoading.value = true;
  try {
    const options = await CoolapkTauriAPI.getFeedCollectionOptions(feedId);
    const validOptions = options.filter((item: any) => collectionId(item));
    if (validOptions.length === 0) {
      throw new Error('酷安未返回可用收藏夹，请先在酷安创建收藏夹');
    }
    collectionOptions.value = validOptions;
    collectionInitialSelectedIds.value = validOptions
      .filter(isCollectionSelected)
      .map(collectionId);
    collectionPickerOpen.value = true;
  } catch (err) {
    showToast(getErrorMessage(err, '加载收藏夹失败'), 'error');
  } finally {
    collectionPickerLoading.value = false;
    favoritePending.value = false;
  }
}

function closeCollectionPicker() {
  if (collectionPickerSubmitting.value) return;
  collectionPickerOpen.value = false;
  collectionOptions.value = [];
  collectionInitialSelectedIds.value = [];
}

async function confirmCollectionSelection(selectedIds: string[]) {
  if (collectionPickerSubmitting.value) return;
  const ids = Array.from(new Set(selectedIds.filter(Boolean)));
  if (ids.length === 0) {
    showToast('请至少选择一个收藏夹', 'error');
    return;
  }

  const cancelIds = collectionInitialSelectedIds.value.filter((id) => !ids.includes(id));
  const feedType = String(props.feed.entityType || props.feed.feedType || 'feed');
  const trace = String(props.feed.trace || props.feed.extra_key || '');
  collectionPickerSubmitting.value = true;
  favoritePending.value = true;
  try {
    await CoolapkTauriAPI.updateFeedCloudCollections(
      String(props.feed.id),
      ids.join(','),
      cancelIds.join(','),
      feedType,
      trace,
    );
    isFav.value = true;
    favnum.value = Math.max(0, favnum.value + (collectionInitialSelectedIds.value.length === 0 ? 1 : 0));
    showToast('已收藏到云端', 'success');
    collectionPickerOpen.value = false;
  } catch (err) {
    showToast(getErrorMessage(err, '收藏失败'), 'error');
  } finally {
    collectionPickerSubmitting.value = false;
    favoritePending.value = false;
  }
}

const starCount = computed(() => {
  const s = props.feed.star || props.feed.rating_score || props.feed.score;
  if (!s) return 4;
  const num = Number(s);
  return num > 5 ? Math.round(num / 2) : Math.round(num);
});

const scoreText = computed(() => {
  if (props.feed.score_title) return props.feed.score_title;
  const s = starCount.value;
  if (s >= 5) return '极好';
  if (s === 4) return '不错';
  if (s === 3) return '一般';
  if (s === 2) return '较差';
  return '极差';
});

// 解析多维度评分细节
const subRatings = computed(() => {
  if (props.feed.rating_info && Array.isArray(props.feed.rating_info)) {
    return props.feed.rating_info.map((item: any) => ({
      label: item.title || item.name,
      score: item.score || item.star
    }));
  }
  if (props.feed.sub_scores) {
    return props.feed.sub_scores;
  }
  return [
    { label: '续航', score: props.feed.star || 4 },
    { label: '影像', score: props.feed.star || 5 },
    { label: '性能', score: props.feed.star || 4 },
    { label: '屏幕', score: props.feed.star || 4 },
    { label: '外观质感', score: props.feed.star || 4 }
  ];
});

const targetProduct = computed(() => {
  if (props.feed.target_row) return props.feed.target_row;
  if (props.feed.target_title) {
    return {
      title: props.feed.target_title,
      logo: props.feed.target_pic || props.feed.pic,
      score: props.feed.target_score || '8.5',
      comment_count: props.feed.target_comment_count || 1200
    };
  }
  return null;
});

const formattedMessage = computed(() => {
  if (!props.feed.message) return '';
  return renderCoolapkRichText(props.feed.message);
});

async function toggleComments() {
  showComments.value = !showComments.value;
  if (showComments.value && comments.value.length === 0) {
    commentsLoading.value = true;
    try {
      let loadedComments: any[] = [];
      if (settingsStore.settings.commentSort === 'hot') {
        const [hotResult, allResult] = await Promise.allSettled([
          CoolapkTauriAPI.getHotReplies(String(props.feed.id), 1),
          CoolapkTauriAPI.getFeedReplies(String(props.feed.id), 1),
        ]);
        const hotReplies = hotResult.status === 'fulfilled' ? getReplyData(hotResult.value) : [];
        const allReplies = allResult.status === 'fulfilled' ? getReplyData(allResult.value) : [];
        loadedComments = mergeReplies(hotReplies, allReplies);
      } else {
        loadedComments = getReplyData(await CoolapkTauriAPI.getFeedReplies(String(props.feed.id), 1));
      }
      comments.value = loadedComments;
    } catch (err) {
      console.error('Failed to load rating comments', err);
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

function formatRichText(text: string) {
  if (!text) return '';
  return renderCoolapkRichText(text);
}
</script>

<style scoped>
.rating-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--feed-card-padding);
  margin-bottom: var(--feed-card-gap);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: all var(--duration-normal) var(--ease-default);
}

.rating-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-hover);
}

.rating-score-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: -2px;
}

.owner-badge {
  background: linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%);
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.star-rating-stars {
  display: flex;
  gap: 3px;
  color: #d1d5db;
  font-size: 13px;
}

.star-rating-stars .active {
  color: #f59e0b;
}

.score-text {
  font-size: 12px;
  font-weight: 700;
  color: #d97706;
  background: #fef3c7;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

.rating-dimensions-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
  font-size: 12px;
  color: var(--text-tertiary);
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.02));
  padding: 6px 12px;
  border-radius: var(--radius-card-sm, 6px);
}

.sub-rating-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.sub-label {
  color: var(--text-secondary);
}

.sub-stars {
  color: var(--brand-primary, #10b981);
  font-weight: 600;
}

.rating-body {
  font-size: var(--font-size-body);
  color: var(--text-primary);
  line-height: 1.6;
}

.target-device-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--border);
  padding: 10px 14px;
  border-radius: var(--radius-card);
  margin-top: 4px;
  transition: background-color 0.2s;
}

.target-device-card:hover {
  background-color: var(--surface-hover);
}

.device-thumb {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #fff;
}

.device-thumb :deep(.device-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-count {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.device-rating-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.big-score {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}

.mini-stars {
  display: flex;
  gap: 2px;
  font-size: 10px;
  color: #f59e0b;
}

.inline-comment-wrapper {
  margin-top: var(--space-2);
  border-top: 1px solid var(--border);
  padding-top: var(--space-3);
}
</style>
