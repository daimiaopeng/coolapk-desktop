<template>
  <section
    :class="['mobile-feed-page', `mobile-feed-page--${mode}`]"
    data-mobile-page="feed"
    :data-feed-id="effectiveFeedId || undefined"
    aria-label="酷安动态"
  >
    <header class="mobile-feed-page__header">
      <slot name="header" :mode="mode" :active-tab="currentTabKey">
        <template v-if="mode === 'detail'">
          <div class="mobile-feed-page__detail-toolbar">
            <button type="button" aria-label="返回" @click="goBack">
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
            </button>
            <button v-if="displayFeed" type="button" class="mobile-feed-page__detail-author" @click="openUser(feedUid(displayFeed))">
              <span class="mobile-feed-page__detail-avatar">
                <img v-if="feedAvatar(displayFeed)" :src="feedAvatar(displayFeed)" alt="" referrerpolicy="no-referrer" />
                <i v-else class="fas fa-user" aria-hidden="true"></i>
              </span>
              <span>
                <strong>{{ feedUsername(displayFeed) }}</strong>
                <small>{{ formatTime(displayFeed.dateline || displayFeed.createTime || displayFeed.created_at) }}<template v-if="feedDevice(displayFeed)"> · {{ feedDevice(displayFeed) }}</template></small>
              </span>
            </button>
            <strong v-else class="mobile-feed-page__detail-title">动态详情</strong>
            <button v-if="displayFeed" type="button" aria-label="更多操作" @click="emit('more', displayFeed)">
              <i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>
            </button>
            <button v-else type="button" aria-label="刷新" @click="refresh">
              <i class="fas fa-rotate-right" aria-hidden="true"></i>
            </button>
          </div>
        </template>
        <template v-else>
          <div v-if="mode === 'home'" class="mobile-feed-page__home-channel-row">
            <nav class="mobile-feed-page__tabs" role="tablist" aria-label="首页频道">
              <button
                v-for="tab in effectiveTabs"
                :key="tab.key"
                type="button"
                role="tab"
                :aria-selected="currentTabKey === tab.key"
                :class="['mobile-feed-page__tab', { active: currentTabKey === tab.key }]"
                :disabled="tab.disabled"
                @click="selectTab(tab.key)"
              >
                {{ tab.title }}
                <span v-if="tab.badge !== undefined" class="mobile-feed-page__tab-badge">{{ tab.badge }}</span>
              </button>
            </nav>
            <button type="button" class="mobile-feed-page__home-channel-button" aria-label="管理首页频道" @click="channelSheetOpen = true">
              <i class="fas fa-bars" aria-hidden="true"></i>
            </button>
          </div>

          <template v-else>
            <div class="mobile-feed-page__toolbar">
              <div class="mobile-feed-page__title-wrap">
                <h1>{{ title || '动态' }}</h1>
              </div>
              <button
                type="button"
                class="mobile-feed-page__refresh-button"
                :disabled="effectiveLoading"
                aria-label="刷新动态"
                @click="refresh"
              >
                <i :class="['fas', effectiveLoading ? 'fa-circle-notch fa-spin' : 'fa-rotate-right']" aria-hidden="true"></i>
              </button>
            </div>
          </template>

          <nav v-if="mode !== 'home'" class="mobile-feed-page__tabs" role="tablist" aria-label="动态频道">
            <button
              v-for="tab in effectiveTabs"
              :key="tab.key"
              type="button"
              role="tab"
              :aria-selected="currentTabKey === tab.key"
              :class="['mobile-feed-page__tab', { active: currentTabKey === tab.key }]"
              :disabled="tab.disabled"
              @click="selectTab(tab.key)"
            >
              {{ tab.title }}
              <span v-if="tab.badge !== undefined" class="mobile-feed-page__tab-badge">{{ tab.badge }}</span>
            </button>
          </nav>
        </template>
      </slot>
    </header>

    <main ref="scrollRef" class="mobile-feed-page__scroll" @scroll.passive="handleScroll">
      <slot name="before" :mode="mode" :feed="displayFeed" :feeds="displayFeeds" />

      <div v-if="effectiveLoading && !displayItems.length" class="mobile-feed-page__state" aria-live="polite">
        <slot name="loading" :mode="mode">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>{{ mode === 'detail' ? '正在加载动态…' : '正在加载动态列表…' }}</span>
        </slot>
      </div>

      <div v-else-if="effectiveError && !displayItems.length" class="mobile-feed-page__state mobile-feed-page__state--error" role="alert">
        <slot name="error" :error="effectiveError" :retry="refresh">
          <i class="fas fa-cloud-exclamation" aria-hidden="true"></i>
          <span>{{ effectiveError }}</span>
          <button type="button" @click="refresh">重试</button>
        </slot>
      </div>

      <div v-else-if="!displayItems.length" class="mobile-feed-page__state mobile-feed-page__state--empty">
        <slot name="empty" :mode="mode">
          <i class="far fa-comment-alt" aria-hidden="true"></i>
          <strong>{{ mode === 'detail' ? '动态不存在' : '暂无动态' }}</strong>
          <span>{{ mode === 'detail' ? '这条动态可能已被删除或设置为不可见' : '下拉刷新试试吧' }}</span>
        </slot>
      </div>

      <template v-else>
        <section class="mobile-feed-page__list" :aria-label="mode === 'detail' ? '动态详情' : '动态列表'">
          <template v-for="(item, index) in displayItems" :key="feedKey(item, index)">
            <slot
              v-if="mode === 'detail' && $slots.detail"
              name="detail"
              :feed="item"
              :index="index"
              :open-user="openUser"
              :open-feed="openFeed"
            />
            <slot
              v-else-if="$slots.feed"
              name="feed"
              :feed="item"
              :index="index"
              :open-user="openUser"
              :open-feed="openFeed"
            />
            <article
              v-else
              :class="['mobile-feed-card', { 'mobile-feed-card--detail': mode === 'detail' }]"
              :data-feed-id="feedKey(item, index)"
              @click="handleCardClick(item)"
            >
              <header class="mobile-feed-card__author-row">
                <button type="button" class="mobile-feed-card__author" @click.stop="openUser(feedUid(item))">
                  <span class="mobile-feed-card__avatar">
                    <img
                      v-if="feedAvatar(item)"
                      :src="feedAvatar(item)"
                      :alt="feedUsername(item)"
                      referrerpolicy="no-referrer"
                    />
                    <i v-else class="fas fa-user" aria-hidden="true"></i>
                  </span>
                  <span class="mobile-feed-card__author-copy">
                    <strong>{{ feedUsername(item) }}</strong>
                    <span class="mobile-feed-card__meta">
                      {{ formatTime(item.dateline || item.createTime || item.created_at) }}
                      <template v-if="feedDevice(item)"> · {{ feedDevice(item) }}</template>
                    </span>
                  </span>
                </button>

                <button
                  v-if="feedUid(item)"
                  type="button"
                  :class="['mobile-feed-card__follow', { active: isFollowed(item) }]"
                  @click.stop="toggleFollow(item)"
                >
                  {{ isFollowed(item) ? '已关注' : '关注' }}
                </button>
                <button
                  type="button"
                  class="mobile-feed-card__more"
                  aria-label="更多操作"
                  @click.stop="emit('more', item)"
                >
                  <i class="fas fa-ellipsis" aria-hidden="true"></i>
                </button>
              </header>

              <FeedContent
                :feed-id="item.id"
                :title="feedTitle(item)"
                :message="feedMessage(item)"
                :username="feedUsername(item)"
                :force-expanded="mode === 'detail'"
                :max-lines="mode === 'detail' ? undefined : 8"
                :question-mode="isQuestion(item)"
                :answer-mode="isAnswer(item)"
              />

              <div v-if="feedTopics(item).length" class="mobile-feed-card__topics" aria-label="话题">
                <button
                  v-for="topic in feedTopics(item)"
                  :key="topic"
                  type="button"
                  class="mobile-feed-card__topic"
                  @click.stop="openTopic(topic)"
                >
                  #{{ topic }}#
                </button>
              </div>

              <div v-if="feedRelations(item).length" class="mobile-feed-card__relations" aria-label="关联内容">
                <button
                  v-for="(relation, relationIndex) in feedRelations(item)"
                  :key="relationKey(relation, relationIndex)"
                  type="button"
                  class="mobile-feed-card__relation"
                  @click.stop="openRelation(relation)"
                >
                  <span class="mobile-feed-card__relation-media">
                    <img
                      v-if="relationImage(relation)"
                      :src="relationImage(relation)"
                      :alt="relationTitle(relation)"
                      referrerpolicy="no-referrer"
                    />
                    <i v-else :class="relationIcon(relation)" aria-hidden="true"></i>
                  </span>
                  <span class="mobile-feed-card__relation-copy">
                    <strong>{{ relationTitle(relation) }}</strong>
                    <small>{{ relationSubtitle(relation) }}</small>
                  </span>
                  <span v-if="relationRating(relation)" class="mobile-feed-card__relation-rating">
                    <i class="fas fa-star" aria-hidden="true"></i>{{ relationRating(relation) }}
                  </span>
                  <i class="fas fa-chevron-right mobile-feed-card__relation-arrow" aria-hidden="true"></i>
                </button>
              </div>

              <div v-if="feedImages(item).length" class="mobile-feed-card__media">
                <FeedImageGrid
                  :images="feedImages(item)"
                  :content-id="item.id"
                  content-type="feed"
                />
              </div>

              <div class="mobile-feed-card__actions" :class="{ 'mobile-feed-card__actions--detail': mode === 'detail' }">
                <button
                  v-if="mode === 'detail'"
                  type="button"
                  class="mobile-feed-card__write"
                  @click.stop="openComposer"
                >
                  <i class="far fa-pen-to-square" aria-hidden="true"></i>
                  <span>写评论</span>
                </button>
                <button
                  type="button"
                  :class="['mobile-feed-card__action', { active: isLiked(item) }]"
                  @click.stop="toggleLike(item)"
                >
                  <i :class="isLiked(item) ? 'fas fa-heart' : 'far fa-heart'" aria-hidden="true"></i>
                  <span>{{ formatCount(feedLikeCount(item)) }}</span>
                </button>
                <button type="button" class="mobile-feed-card__action" @click.stop="openComments(item)">
                  <i class="far fa-comment" aria-hidden="true"></i>
                  <span>{{ formatCount(feedReplyCount(item)) }}</span>
                </button>
                <button
                  type="button"
                  :class="['mobile-feed-card__action', { active: isFavorited(item) }]"
                  @click.stop="toggleFavorite(item)"
                >
                  <i :class="isFavorited(item) ? 'fas fa-bookmark' : 'far fa-bookmark'" aria-hidden="true"></i>
                  <span>{{ formatCount(feedFavoriteCount(item)) }}</span>
                </button>
                <button type="button" class="mobile-feed-card__action" @click.stop="shareFeed(item)">
                  <i class="fas fa-share" aria-hidden="true"></i>
                  <span>{{ mode === 'detail' ? '转发' : formatCount(feedShareCount(item)) }}</span>
                </button>
              </div>
            </article>
          </template>
        </section>

        <section v-if="mode === 'detail' && displayFeed && !$slots.comments" class="mobile-feed-comments" aria-label="评论">
          <header class="mobile-feed-comments__header">
            <h2>共 {{ formatCount(commentTotal) }} 回复</h2>
            <div class="mobile-feed-comments__sort" role="tablist" aria-label="评论排序">
              <button
                v-for="option in commentSortOptions"
                :key="option.value"
                type="button"
                role="tab"
                :aria-selected="commentSortMode === option.value"
                :class="{ active: commentSortMode === option.value && !commentAuthorOnly }"
                @click="changeCommentSort(option.value)"
              >
                {{ option.label }}
              </button>
              <button
                type="button"
                role="tab"
                :aria-selected="commentAuthorOnly"
                :class="{ active: commentAuthorOnly }"
                @click="changeCommentAuthorOnly"
              >
                楼主
              </button>
            </div>
          </header>

          <div v-if="effectiveCommentLoading && !displayComments.length" class="mobile-feed-comments__state">
            <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>正在加载评论…
          </div>
          <div v-else-if="effectiveCommentError && !displayComments.length" class="mobile-feed-comments__state is-error" role="alert">
            <span>{{ effectiveCommentError }}</span>
            <button type="button" @click="loadComments(true)">重试</button>
          </div>
          <div v-else-if="!displayComments.length" class="mobile-feed-comments__state">
            <i class="far fa-comments" aria-hidden="true"></i>暂无评论，来抢沙发吧
          </div>
          <template v-else>
            <article v-for="(comment, commentIndex) in displayComments" :key="commentKey(comment, commentIndex)" class="mobile-feed-comment">
              <button type="button" class="mobile-feed-comment__avatar" @click="openUser(commentUid(comment))">
                <img v-if="commentAvatar(comment)" :src="commentAvatar(comment)" alt="" referrerpolicy="no-referrer" />
                <i v-else class="fas fa-user" aria-hidden="true"></i>
              </button>
              <div class="mobile-feed-comment__body">
                <div class="mobile-feed-comment__meta">
                  <button type="button" class="mobile-feed-comment__user" @click="openUser(commentUid(comment))">
                    {{ commentUsername(comment) }}
                  </button>
                  <span v-if="commentLevel(comment)" class="mobile-feed-comment__level">Lv.{{ commentLevel(comment) }}</span>
                  <span v-if="commentIsAuthor(comment)" class="mobile-feed-comment__author-badge">楼主</span>
                  <time>{{ formatCommentTimeValue(comment) }}</time>
                </div>
                <div class="mobile-feed-comment__text" v-html="commentHtml(comment)"></div>
                <div v-if="commentImages(comment).length" class="mobile-feed-comment__images">
                  <img
                    v-for="image in commentImages(comment).slice(0, 9)"
                    :key="image"
                    :src="image"
                    alt=""
                    loading="lazy"
                    referrerpolicy="no-referrer"
                  />
                </div>
                <div class="mobile-feed-comment__actions">
                  <button type="button" :class="{ active: isCommentLiked(comment) }" @click="toggleCommentLike(comment)">
                    <i :class="isCommentLiked(comment) ? 'fas fa-thumbs-up' : 'far fa-thumbs-up'" aria-hidden="true"></i>
                    {{ formatCount(commentLikeCount(comment)) }}
                  </button>
                  <button type="button" @click="beginReply(comment)">
                    <i class="far fa-comment" aria-hidden="true"></i> 回复
                  </button>
                </div>
                <div v-if="commentReplies(comment).length" class="mobile-feed-comment__replies">
                  <div v-for="(reply, replyIndex) in commentReplies(comment).slice(0, 3)" :key="commentKey(reply, replyIndex)" class="mobile-feed-comment__reply">
                    <strong>{{ commentUsername(reply) }}</strong>
                    <span v-html="commentHtml(reply)"></span>
                  </div>
                  <button
                    v-if="commentHasMoreReplies(comment)"
                    type="button"
                    class="mobile-feed-comment__more-replies"
                    @click="emit('load-replies', comment)"
                  >
                    查看更多回复
                  </button>
                </div>
              </div>
            </article>
            <button
              v-if="effectiveCommentHasMore"
              type="button"
              class="mobile-feed-comments__load-more"
              :disabled="effectiveCommentLoadingMore"
              @click="loadComments(false)"
            >
              {{ effectiveCommentLoadingMore ? '正在加载…' : '加载更多评论' }}
            </button>
          </template>
        </section>

        <slot
          v-if="mode === 'detail' && displayFeed && $slots.comments"
          name="comments"
          :feed="displayFeed"
          :comments="displayComments"
          :loading="effectiveCommentLoading"
          :error="effectiveCommentError"
          :sort="commentSortMode"
          :reload="loadComments"
        />

        <div v-if="mode !== 'detail'" class="mobile-feed-page__load-more" aria-live="polite">
          <span v-if="effectiveLoadingMore">正在加载更多…</span>
          <button v-else-if="effectiveHasMore" type="button" @click="loadMore">加载更多</button>
          <span v-else>没有更多内容了</span>
        </div>
      </template>
    </main>

    <div v-if="mode === 'detail' && displayFeed" class="mobile-feed-page__composer-dock">
      <button type="button" class="mobile-feed-page__composer-entry" @click="openComposer">
        <i class="far fa-pen-to-square" aria-hidden="true"></i>
        <span>{{ replyTarget ? `回复 @${replyTargetName}` : '写评论' }}</span>
      </button>
      <button type="button" aria-label="评论" @click="openComments(displayFeed)"><i class="far fa-comment"></i></button>
      <button type="button" aria-label="点赞" :class="{ active: isLiked(displayFeed) }" @click="toggleLike(displayFeed)"><i :class="isLiked(displayFeed) ? 'fas fa-heart' : 'far fa-heart'"></i></button>
      <button type="button" aria-label="收藏" :class="{ active: isFavorited(displayFeed) }" @click="toggleFavorite(displayFeed)"><i :class="isFavorited(displayFeed) ? 'fas fa-star' : 'far fa-star'"></i></button>
      <button type="button" aria-label="转发" @click="shareFeed(displayFeed)"><i class="fas fa-share"></i></button>
    </div>

    <div v-if="composerOpen" class="mobile-feed-page__composer-backdrop" @click.self="composerOpen = false">
      <form class="mobile-feed-page__composer" @submit.prevent="submitComment">
        <div class="mobile-feed-page__composer-heading">
          <strong>{{ replyTarget ? `回复 @${replyTargetName}` : '写评论' }}</strong>
          <button type="button" aria-label="关闭评论编辑器" @click="composerOpen = false"><i class="fas fa-xmark"></i></button>
        </div>
        <textarea
          ref="composerRef"
          v-model="composerText"
          rows="4"
          maxlength="1000"
          placeholder="说点什么…"
          @keydown.stop
        ></textarea>
        <div class="mobile-feed-page__composer-footer">
          <span>{{ composerText.length }}/1000</span>
          <button type="submit" :disabled="!composerText.trim() || submittingComment">
            {{ submittingComment ? '发送中…' : '发送' }}
          </button>
        </div>
      </form>
    </div>

    <Transition name="mobile-feed-sheet">
      <div v-if="channelSheetOpen" class="mobile-feed-channel-sheet" @click.self="channelSheetOpen = false">
        <section class="mobile-feed-channel-sheet__panel" role="dialog" aria-modal="true" aria-label="我的频道">
          <header>
            <h2>我的频道</h2>
            <button type="button" @click="channelSheetOpen = false">完成</button>
          </header>
          <div class="mobile-feed-channel-sheet__grid">
            <button
              v-for="tab in channelOptions"
              :key="tab.key"
              type="button"
              :class="{ active: currentTabKey === tab.key }"
              @click="selectTabFromSheet(tab.key)"
            >
              {{ tab.title }}
              <i v-if="currentTabKey === tab.key" class="fas fa-check" aria-hidden="true"></i>
            </button>
          </div>
          <button type="button" class="mobile-feed-channel-sheet__more" @click="emit('open-channel-manager')">
            更多频道 · 点击添加新频道
          </button>
        </section>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import FeedContent from '../../../components/feed/FeedContent.vue';
import FeedImageGrid from '../../../components/feed/FeedImageGrid.vue';
import { useAppStore } from '../../../stores/app';
import { useAuthStore } from '../../../stores/auth';
import { extractFeedImageInputs } from '../../../utils/livePhoto';
import { renderCoolapkRichText } from '../../../utils/richText';
import {
  COMMENT_SORT_OPTIONS,
  getCommentImages,
  getCommentReplyRequestOptions,
  getCommentUserLevel,
  getReplyData,
  getReplyPageCursor,
  hasMoreReplyPages,
  mergeReplies,
  sortComments,
  formatCommentTime,
  type CommentSortMode,
} from '../../../utils/commentList';
import { showToast } from '../../../utils/toast';
import type { FeedItem } from '../../../types/feed';

type MobileFeedMode = 'home' | 'feed' | 'detail';
type MobileFeedTab = {
  key: string;
  title: string;
  badge?: string | number;
  disabled?: boolean;
};

const DEFAULT_TABS: readonly MobileFeedTab[] = [
  { key: 'follow', title: '关注' },
  { key: 'recommend', title: '推荐' },
  { key: 'hot', title: '热榜' },
  { key: 'headline', title: '头条' },
  { key: 'news', title: '快讯' },
];

// 首页频道顺序与官方 APK 首页保持一致；“推荐”不是首页默认频道，
// 它仍保留在频道管理中并由服务端配置覆盖。
const DEFAULT_HOME_TABS: readonly MobileFeedTab[] = [
  { key: 'topic', title: '话题' },
  { key: 'follow', title: '关注' },
  { key: 'headline', title: '头条' },
  { key: 'hot', title: '热榜' },
  { key: 'news', title: '快讯' },
  { key: 'device', title: '新机' },
];

const props = withDefaults(defineProps<{
  mode?: MobileFeedMode;
  title?: string;
  feedId?: string | number;
  feed?: FeedItem | null;
  feeds?: readonly FeedItem[];
  loading?: boolean;
  loadingMore?: boolean;
  error?: string;
  hasMore?: boolean;
  tabs?: readonly MobileFeedTab[];
  activeTab?: string;
  comments?: readonly any[];
  commentLoading?: boolean;
  commentLoadingMore?: boolean;
  commentError?: string;
  commentHasMore?: boolean;
  commentTotal?: number;
}>(), {
  mode: 'feed',
  title: '',
  feedId: '',
  feed: undefined,
  feeds: undefined,
  loading: undefined,
  loadingMore: undefined,
  error: '',
  hasMore: undefined,
  tabs: undefined,
  activeTab: undefined,
  comments: undefined,
  commentLoading: undefined,
  commentLoadingMore: undefined,
  commentError: '',
  commentHasMore: undefined,
  commentTotal: undefined,
});

const emit = defineEmits<{
  (event: 'update:activeTab', key: string): void;
  (event: 'tab-change', key: string): void;
  (event: 'refresh'): void;
  (event: 'load-more'): void;
  (event: 'open-feed', feed: FeedItem): void;
  (event: 'open-user', uid: string): void;
  (event: 'open-topic', topic: string): void;
  (event: 'open-comment', feed: FeedItem): void;
  (event: 'toggle-like', payload: { feed: FeedItem; liked: boolean }): void;
  (event: 'toggle-favorite', payload: { feed: FeedItem; favorited: boolean }): void;
  (event: 'share', feed: FeedItem): void;
  (event: 'follow', payload: { uid: string; followed: boolean }): void;
  (event: 'more', feed: FeedItem): void;
  (event: 'comment-sort-change', payload: { mode: CommentSortMode; authorOnly: boolean }): void;
  (event: 'comment-reply', comment: any): void;
  (event: 'load-replies', comment: any): void;
  (event: 'open-channel-manager'): void;
}>();

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();

const scrollRef = ref<HTMLElement | null>(null);
const composerRef = ref<HTMLTextAreaElement | null>(null);
const channelSheetOpen = ref(false);
const composerOpen = ref(false);
const composerText = ref('');
const submittingComment = ref(false);
const localLoading = ref(false);
const localLoadingMore = ref(false);
const localError = ref('');
const localHasMore = ref(true);
const localFeeds = ref<FeedItem[]>([]);
const localFeed = ref<FeedItem | null>(null);
const localComments = ref<any[]>([]);
const localCommentLoading = ref(false);
const localCommentLoadingMore = ref(false);
const localCommentError = ref('');
const localCommentHasMore = ref(true);
const selectedTab = ref(props.activeTab || props.tabs?.[0]?.key || (props.mode === 'home' ? 'headline' : DEFAULT_TABS[0].key));
const commentSortMode = ref<CommentSortMode>('default');
const commentAuthorOnly = ref(false);
const commentPage = ref(0);
const commentFirstItem = ref('');
const commentLastItem = ref('');
const replyTarget = ref('');
const replyTargetName = ref('');
const likedFeedIds = ref(new Set<string>());
const favoritedFeedIds = ref(new Set<string>());
const followedUserIds = ref(new Set<string>());
const likedCommentIds = ref(new Set<string>());
const feedPage = ref(0);
const feedFirstItem = ref('');
const feedLastItem = ref('');
let feedRequestVersion = 0;
let detailRequestVersion = 0;
let commentRequestVersion = 0;

const mode = computed(() => props.mode || 'feed');
const effectiveTabs = computed(() => {
  if (props.tabs?.length) return props.tabs;
  return mode.value === 'home' ? DEFAULT_HOME_TABS : DEFAULT_TABS;
});
const channelOptions = computed(() => {
  const known = new Map(effectiveTabs.value.map((tab) => [tab.key, tab]));
  const extra: MobileFeedTab[] = [
    { key: 'topic', title: '话题' },
    { key: 'device', title: '新机' },
    { key: 'game', title: '游戏' },
    { key: 'photo', title: '摄影' },
    { key: 'car', title: '汽车' },
    { key: 'tutorial', title: '教程' },
    { key: 'coupon', title: '神券' },
  ];
  extra.forEach((tab) => { if (!known.has(tab.key)) known.set(tab.key, tab); });
  return [...known.values()];
});
const currentTabKey = computed(() => props.activeTab || selectedTab.value);
const effectiveFeedId = computed(() => String(
  props.feedId
    || route.params.feedId
    || route.params.questionId
    || route.params.liveId
    || (props.feed ? feedKey(props.feed, 0) : '')
    || '',
).trim());
const displayFeed = computed(() => props.feed !== undefined ? props.feed : localFeed.value);
const displayFeeds = computed(() => props.feeds !== undefined ? [...props.feeds] : localFeeds.value);
const displayItems = computed<FeedItem[]>(() => mode.value === 'detail'
  ? (displayFeed.value ? [displayFeed.value] : [])
  : displayFeeds.value);
const effectiveLoading = computed(() => props.loading ?? localLoading.value);
const effectiveLoadingMore = computed(() => props.loadingMore ?? localLoadingMore.value);
const effectiveError = computed(() => props.error || localError.value);
const effectiveHasMore = computed(() => props.hasMore ?? localHasMore.value);
const effectiveComments = computed(() => props.comments !== undefined ? [...props.comments] : localComments.value);
const displayComments = computed(() => sortComments(effectiveComments.value, commentSortMode.value));
const effectiveCommentLoading = computed(() => props.commentLoading ?? localCommentLoading.value);
const effectiveCommentLoadingMore = computed(() => props.commentLoadingMore ?? localCommentLoadingMore.value);
const effectiveCommentError = computed(() => props.commentError || localCommentError.value);
const effectiveCommentHasMore = computed(() => props.commentHasMore ?? localCommentHasMore.value);
const commentTotal = computed(() => Number(props.commentTotal ?? displayFeed.value?.replynum ?? displayComments.value.length ?? 0));
const commentSortOptions = COMMENT_SORT_OPTIONS;

function feedKey(feed: FeedItem, index: number): string {
  return String(feed?.id ?? feed?.entityId ?? feed?.feedId ?? `feed-${index}`);
}

function feedUid(feed: FeedItem): string {
  return String(feed?.uid ?? feed?.userInfo?.uid ?? feed?.userId ?? '').trim();
}

function feedUsername(feed: FeedItem): string {
  return String(feed?.username ?? feed?.userInfo?.username ?? '酷友').trim() || '酷友';
}

function feedAvatar(feed: FeedItem): string {
  const direct = feed?.userAvatar || feed?.userInfo?.userAvatar || feed?.avatar;
  if (direct) return String(direct);
  const uid = feedUid(feed);
  if (!uid || uid === '10000') return '';
  const padded = uid.padStart(9, '0');
  return `https://avatar.coolapk.com/data/${padded.slice(0, 3)}/${padded.slice(3, 5)}/${padded.slice(5, 7)}/${uid.slice(-2)}_avatar_middle.jpg`;
}

function feedDevice(feed: FeedItem): string {
  return String(feed?.deviceTitle ?? feed?.device_title ?? feed?.device ?? '').trim();
}

function feedTitle(feed: FeedItem): string {
  return String(feed?.title ?? feed?.messageTitle ?? feed?.message_title ?? '').trim();
}

function feedMessage(feed: FeedItem): string {
  return String(feed?.message ?? feed?.message_raw_output ?? feed?.note ?? '').trim();
}

function feedLikeCount(feed: FeedItem): number {
  return Number(feed?.likenum ?? feed?.likeNum ?? feed?.like_num ?? 0) || 0;
}

function feedReplyCount(feed: FeedItem): number {
  return Number(feed?.replynum ?? feed?.replyNum ?? feed?.reply_num ?? 0) || 0;
}

function feedFavoriteCount(feed: FeedItem): number {
  return Number(feed?.favnum ?? feed?.favoriteNum ?? feed?.favorite_num ?? 0) || 0;
}

function feedShareCount(feed: FeedItem): number {
  return Number(feed?.sharenum ?? feed?.shareNum ?? feed?.share_num ?? 0) || 0;
}

function feedTopics(feed: FeedItem): string[] {
  const source = feedMessage(feed).replace(/<[^>]+>/g, ' ');
  const result: string[] = [];
  const pattern = /#([^#\n]{1,42})#/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const value = String(match[1]).trim();
    if (value && !result.includes(value)) result.push(value);
  }
  return result.slice(0, 8);
}

function feedRelations(feed: FeedItem): any[] {
  const values = [feed?.relationRows, feed?.relation_rows, feed?.productRows, feed?.product_rows, feed?.targetRows, feed?.target_rows, feed?.extraRows, feed?.extra_rows];
  const result: any[] = [];
  values.forEach((value) => {
    if (!Array.isArray(value)) return;
    value.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const key = relationKey(item, result.length);
      if (!result.some((existing) => relationKey(existing, 0) === key)) result.push(item);
    });
  });
  return result.slice(0, mode.value === 'detail' ? 3 : 2);
}

function relationKey(item: any, index: number): string {
  return String(item?.id ?? item?.entityId ?? item?.productId ?? item?.packageName ?? item?.url ?? `relation-${index}`);
}

function relationTitle(item: any): string {
  return String(item?.title ?? item?.name ?? item?.productName ?? item?.product_name ?? item?.packageName ?? '关联内容');
}

function relationSubtitle(item: any): string {
  return String(item?.subTitle ?? item?.subtitle ?? item?.description ?? item?.message ?? item?.model ?? item?.device ?? '').trim();
}

function relationImage(item: any): string {
  return String(item?.logo ?? item?.image ?? item?.pic ?? item?.cover ?? item?.icon ?? item?.productLogo ?? '').trim();
}

function relationRating(item: any): string {
  const value = Number(item?.score ?? item?.rating ?? item?.scoreStar ?? item?.score_star ?? 0);
  return value > 0 ? value.toFixed(1).replace(/\.0$/, '') : '';
}

function relationIcon(item: any): string {
  const type = String(item?.entityType ?? item?.type ?? '').toLowerCase();
  if (type.includes('app')) return 'fas fa-cube';
  if (type.includes('topic')) return 'fas fa-hashtag';
  if (type.includes('product') || type.includes('device')) return 'fas fa-mobile-screen-button';
  return 'fas fa-link';
}

function feedImages(feed: FeedItem): unknown[] {
  return extractFeedImageInputs(feed);
}

function isQuestion(feed: FeedItem): boolean {
  return Boolean(feed?.questionId || feed?.question_id || String(feed?.entityType || '').toLowerCase().includes('question'));
}

function isAnswer(feed: FeedItem): boolean {
  return Boolean(feed?.answerId || feed?.answer_id || String(feed?.entityType || '').toLowerCase().includes('answer'));
}

function formatCount(value: unknown): string {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return '0';
  if (number >= 10000) return `${(number / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return String(Math.round(number));
}

function formatTime(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '刚刚';
  const timestamp = number > 10_000_000_000 ? number / 1000 : number;
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  if (seconds < 2_592_000) return `${Math.floor(seconds / 86400)}天前`;
  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

function isLiked(feed: FeedItem): boolean {
  return likedFeedIds.value.has(feedKey(feed, 0)) || Number(feed?.userAction?.like ?? feed?.user_action?.like ?? 0) === 1;
}

function isFavorited(feed: FeedItem): boolean {
  return favoritedFeedIds.value.has(feedKey(feed, 0)) || Number(feed?.userAction?.favorite ?? feed?.userAction?.collect ?? feed?.user_action?.favorite ?? 0) === 1;
}

function isFollowed(feed: FeedItem): boolean {
  const uid = feedUid(feed);
  return Boolean(uid && (followedUserIds.value.has(uid) || Number((feed as any)?.userAction?.follow ?? (feed as any)?.user_action?.follow ?? 0) === 1));
}

function setFeedIdInSet(target: typeof likedFeedIds, key: string, value: boolean): void {
  const next = new Set(target.value);
  if (value) next.add(key); else next.delete(key);
  target.value = next;
}

async function toggleLike(feed: FeedItem): Promise<void> {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const id = feedKey(feed, 0);
  const next = !isLiked(feed);
  setFeedIdInSet(likedFeedIds, id, next);
  emit('toggle-like', { feed, liked: next });
  try {
    if (next) await CoolapkTauriAPI.likeFeed(id);
    else await CoolapkTauriAPI.unlikeFeed(id);
  } catch (error) {
    setFeedIdInSet(likedFeedIds, id, !next);
    showToast(error instanceof Error ? error.message : '点赞失败，请稍后重试', 'error');
  }
}

async function toggleFavorite(feed: FeedItem): Promise<void> {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const id = feedKey(feed, 0);
  const next = !isFavorited(feed);
  setFeedIdInSet(favoritedFeedIds, id, next);
  emit('toggle-favorite', { feed, favorited: next });
  try {
    if (next) await CoolapkTauriAPI.favoriteFeed(id);
    else await CoolapkTauriAPI.unfavoriteFeed(id);
    showToast(next ? '已收藏' : '已取消收藏', 'success');
  } catch (error) {
    setFeedIdInSet(favoritedFeedIds, id, !next);
    showToast(error instanceof Error ? error.message : '收藏操作失败，请稍后重试', 'error');
  }
}

async function toggleFollow(feed: FeedItem): Promise<void> {
  const uid = feedUid(feed);
  if (!uid) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const next = !isFollowed(feed);
  setFeedIdInSet(followedUserIds, uid, next);
  emit('follow', { uid, followed: next });
  try {
    if (next) await CoolapkTauriAPI.followUser(uid);
    else await CoolapkTauriAPI.unfollowUser(uid);
    showToast(next ? '已关注' : '已取消关注', 'success');
  } catch (error) {
    setFeedIdInSet(followedUserIds, uid, !next);
    showToast(error instanceof Error ? error.message : '关注操作失败，请稍后重试', 'error');
  }
}

function openUser(uid: string): void {
  const value = String(uid || '').trim();
  if (!value) return;
  emit('open-user', value);
  void router.push(`/user/${encodeURIComponent(value)}`);
}

function goBack(): void {
  if (window.history.length > 1) router.back();
  else void router.push('/');
}

function openFeed(feed: FeedItem): void {
  emit('open-feed', feed);
  const id = feedKey(feed, 0);
  if (!id || id.startsWith('feed-')) return;
  const questionId = feed?.questionId ?? feed?.question_id;
  void router.push(questionId ? `/question/${encodeURIComponent(String(questionId))}` : `/feed/${encodeURIComponent(id)}`);
}

function handleCardClick(feed: FeedItem): void {
  if (mode.value !== 'detail') openFeed(feed);
}

function openTopic(topic: string): void {
  emit('open-topic', topic);
  void router.push(`/topic/${encodeURIComponent(topic)}`);
}

function openRelation(item: any): void {
  const url = String(item?.url ?? item?.targetUrl ?? item?.target_url ?? '').trim();
  const productId = item?.productId ?? item?.product_id ?? item?.id;
  const packageName = item?.packageName ?? item?.package_name;
  if (url.startsWith('/')) {
    void router.push(url);
    return;
  }
  if (packageName) {
    void router.push(`/app/${encodeURIComponent(String(packageName))}`);
    return;
  }
  if (productId) {
    void router.push(`/product/${encodeURIComponent(String(productId))}`);
  }
}

function shareFeed(feed: FeedItem): void {
  emit('share', feed);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.coolapk.com';
  const url = `${origin}/#/feed/${encodeURIComponent(feedKey(feed, 0))}`;
  if (typeof navigator !== 'undefined' && navigator.share) {
    void navigator.share({ title: feedTitle(feed) || `${feedUsername(feed)} 的动态`, url }).catch(() => undefined);
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(url).then(() => showToast('动态链接已复制', 'success')).catch(() => showToast('分享链接已准备', 'info'));
  }
}

function openComments(feed: FeedItem): void {
  emit('open-comment', feed);
  if (mode.value === 'detail') {
    const element = document.querySelector('.mobile-feed-comments');
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  void router.push(`/feed/${encodeURIComponent(feedKey(feed, 0))}`);
}

function openComposer(): void {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  composerOpen.value = true;
  void nextTick(() => composerRef.value?.focus());
}

function beginReply(comment: any): void {
  replyTarget.value = String(comment?.id ?? comment?.entityId ?? '').trim();
  replyTargetName.value = commentUsername(comment);
  emit('comment-reply', comment);
  openComposer();
}

async function submitComment(): Promise<void> {
  const feedId = effectiveFeedId.value;
  const message = composerText.value.trim();
  if (!feedId || !message || submittingComment.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  submittingComment.value = true;
  try {
    await CoolapkTauriAPI.replyFeed(feedId, message, replyTarget.value || undefined);
    composerText.value = '';
    replyTarget.value = '';
    replyTargetName.value = '';
    composerOpen.value = false;
    showToast('评论已发送', 'success');
    if (props.comments === undefined) await loadComments(true);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '评论发送失败，请稍后重试', 'error');
  } finally {
    submittingComment.value = false;
  }
}

function commentKey(comment: any, index: number): string {
  return String(comment?.id ?? comment?.entityId ?? `${comment?.uid ?? ''}-${comment?.dateline ?? ''}-${index}`);
}

function commentUid(comment: any): string {
  return String(comment?.uid ?? comment?.userInfo?.uid ?? comment?.userId ?? '').trim();
}

function commentUsername(comment: any): string {
  return String(comment?.username ?? comment?.userInfo?.username ?? comment?.user_name ?? '酷友');
}

function commentAvatar(comment: any): string {
  const direct = comment?.userAvatar ?? comment?.userInfo?.userAvatar ?? comment?.avatar;
  if (direct) return String(direct);
  const uid = commentUid(comment);
  if (!uid || uid === '10000') return '';
  const padded = uid.padStart(9, '0');
  return `https://avatar.coolapk.com/data/${padded.slice(0, 3)}/${padded.slice(3, 5)}/${padded.slice(5, 7)}/${uid.slice(-2)}_avatar_middle.jpg`;
}

function commentLevel(comment: any): string {
  return getCommentUserLevel(comment);
}

function commentIsAuthor(comment: any): boolean {
  return commentUid(comment) !== '' && commentUid(comment) === feedUid(displayFeed.value || ({} as FeedItem));
}

function commentHtml(comment: any): string {
  return renderCoolapkRichText(String(comment?.message ?? comment?.message_raw_output ?? comment?.content ?? comment?.replyRowsText ?? ''));
}

function commentImages(comment: any): string[] {
  return getCommentImages(comment);
}

function commentReplies(comment: any): any[] {
  return Array.isArray(comment?.replyRows) ? comment.replyRows : Array.isArray(comment?.reply_rows) ? comment.reply_rows : [];
}

function commentHasMoreReplies(comment: any): boolean {
  return Boolean(comment?.replyRowsMore ?? comment?.reply_rows_more ?? comment?.hasMoreReplies);
}

function commentLikeCount(comment: any): number {
  return Number(comment?.likenum ?? comment?.likeNum ?? comment?.like_num ?? 0) || 0;
}

function isCommentLiked(comment: any): boolean {
  return likedCommentIds.value.has(commentKey(comment, 0)) || Number(comment?.userAction?.like ?? comment?.user_action?.like ?? 0) === 1;
}

async function toggleCommentLike(comment: any): Promise<void> {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const id = commentKey(comment, 0);
  if (!id || id.startsWith('-')) return;
  const next = !isCommentLiked(comment);
  setFeedIdInSet(likedCommentIds, id, next);
  try {
    if (next) await CoolapkTauriAPI.likeReply(id);
    else await CoolapkTauriAPI.unlikeReply(id);
  } catch (error) {
    setFeedIdInSet(likedCommentIds, id, !next);
    showToast(error instanceof Error ? error.message : '评论点赞失败', 'error');
  }
}

function formatCommentTimeValue(comment: any): string {
  return formatCommentTime(comment) || formatTime(comment?.dateline ?? comment?.createTime);
}

function changeCommentSort(value: CommentSortMode): void {
  commentSortMode.value = value;
  commentAuthorOnly.value = false;
  emit('comment-sort-change', { mode: value, authorOnly: false });
  if (props.comments === undefined) void loadComments(true);
}

function changeCommentAuthorOnly(): void {
  commentAuthorOnly.value = !commentAuthorOnly.value;
  emit('comment-sort-change', { mode: commentSortMode.value, authorOnly: commentAuthorOnly.value });
  if (props.comments === undefined) void loadComments(true);
}

function selectTab(key: string): void {
  if (key === currentTabKey.value) return;
  selectedTab.value = key;
  emit('update:activeTab', key);
  emit('tab-change', key);
  if (props.feeds === undefined && mode.value !== 'detail') {
    void loadFeeds(true);
  }
}

function selectTabFromSheet(key: string): void {
  selectTab(key);
  channelSheetOpen.value = false;
}

function refresh(): void {
  emit('refresh');
  if (mode.value === 'detail') {
    void loadDetail(true);
    return;
  }
  if (props.feeds === undefined) void loadFeeds(true);
}

function loadMore(): void {
  emit('load-more');
  if (props.feeds === undefined) void loadFeeds(false);
}

function handleScroll(event: Event): void {
  if (mode.value === 'detail') return;
  const target = event.currentTarget as HTMLElement;
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 280) loadMore();
}

function readFeedRows(response: any): FeedItem[] {
  const data = response?.data;
  const candidates = [
    Array.isArray(data) ? data : null,
    data?.feeds,
    data?.feedRows,
    data?.feed_rows,
    data?.rows,
    data?.items,
    response?.feeds,
    response?.rows,
    response?.items,
  ];
  return (candidates.find(Array.isArray) || []).filter((item: unknown) => item && typeof item === 'object') as FeedItem[];
}

function readCursor(response: any, rows: FeedItem[]): { first: string; last: string } {
  const data = response?.data;
  const first = String(response?.firstItem ?? response?.first_item ?? data?.firstItem ?? data?.first_item ?? rows[0]?.id ?? '').trim();
  const last = String(response?.lastItem ?? response?.last_item ?? data?.lastItem ?? data?.last_item ?? rows.at(-1)?.id ?? '').trim();
  return { first, last };
}

function dedupeFeeds(rows: FeedItem[], existing: FeedItem[]): FeedItem[] {
  const seen = new Set(existing.map((item, index) => feedKey(item, index)));
  return rows.filter((item, index) => {
    const key = feedKey(item, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function requestFeedPage(page: number): Promise<any> {
  const tab = effectiveTabs.value.find((item) => item.key === currentTabKey.value);
  const key = `${tab?.key || ''} ${tab?.title || ''}`.toLowerCase();
  if (key.includes('follow') || key.includes('关注')) return CoolapkTauriAPI.getFollowingFeeds(page);
  if (key.includes('hot') || key.includes('热榜')) return CoolapkTauriAPI.getHotFeeds(page);
  if (key.includes('headline') || key.includes('头条')) return CoolapkTauriAPI.getHeadlineFeeds(page);
  if (key.includes('news') || key.includes('快讯')) return CoolapkTauriAPI.getLatestFeeds(page);
  if (key.includes('topic') || key.includes('话题')) return CoolapkTauriAPI.getDigestFeeds(page);
  if (key.includes('device') || key.includes('新机')) {
    return CoolapkTauriAPI.getDiscoveryPageData({
      url: 'V11_HOME_NEW',
      title: '新机',
      page,
      firstItem: feedFirstItem.value,
      lastItem: feedLastItem.value,
      pageContext: JSON.stringify({ source: 'mobile-home', tab: 'device' }),
    });
  }
  return CoolapkTauriAPI.getIndexV8FeedsPaged({ page, firstItem: feedFirstItem.value, lastItem: feedLastItem.value });
}

async function loadFeeds(reset: boolean): Promise<void> {
  if (props.feeds !== undefined || mode.value === 'detail') return;
  if (localLoading.value || localLoadingMore.value) return;
  if (!reset && !localHasMore.value) return;
  if (reset) {
    feedPage.value = 0;
    feedFirstItem.value = '';
    feedLastItem.value = '';
    localFeeds.value = [];
    localHasMore.value = true;
    localError.value = '';
  }
  const page = feedPage.value + 1;
  const requestVersion = ++feedRequestVersion;
  if (page === 1) localLoading.value = true;
  else localLoadingMore.value = true;
  try {
    const response = await requestFeedPage(page);
    if (requestVersion !== feedRequestVersion) return;
    const rows = readFeedRows(response);
    const before = localFeeds.value;
    const added = dedupeFeeds(rows, before);
    localFeeds.value = [...before, ...added];
    const cursor = readCursor(response, rows);
    if (page === 1) feedFirstItem.value = cursor.first;
    const unchanged = Boolean(cursor.last && cursor.last === feedLastItem.value);
    feedLastItem.value = cursor.last;
    feedPage.value = page;
    const responseHasMore = response?.hasMore ?? response?.has_more ?? response?.data?.hasMore ?? response?.data?.has_more;
    localHasMore.value = responseHasMore === false ? false : Boolean(rows.length && added.length && !unchanged);
  } catch (error) {
    if (requestVersion === feedRequestVersion) localError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (requestVersion === feedRequestVersion) {
      localLoading.value = false;
      localLoadingMore.value = false;
    }
  }
}

function normalizeContextFeed(value: any): FeedItem | null {
  if (!value || typeof value !== 'object') return null;
  const candidates = [value.feedInfo, value.targetRow, value.targetFeed, value];
  return (candidates.find((item) => item && typeof item === 'object' && (item.message || item.message_raw_output || item.note || item.username || item.uid)) || null) as FeedItem | null;
}

async function loadDetail(force = false): Promise<void> {
  if (mode.value !== 'detail' || props.feed !== undefined) {
    if (mode.value === 'detail' && props.comments === undefined && displayFeed.value && !localComments.value.length) void loadComments(true);
    return;
  }
  const id = effectiveFeedId.value;
  if (!id) {
    localError.value = '缺少动态 ID';
    return;
  }
  if (!force) localFeed.value = normalizeContextFeed(appStore.getFeedDetailContext(id));
  const requestVersion = ++detailRequestVersion;
  localLoading.value = true;
  localError.value = '';
  try {
    const response = await CoolapkTauriAPI.getFeedDetail(id);
    if (requestVersion !== detailRequestVersion) return;
    const detail = normalizeContextFeed(response?.data || response);
    if (!detail) throw new Error('接口没有返回原动态内容');
    localFeed.value = detail;
    appStore.setFeedDetailContext(id, detail);
    if (props.comments === undefined) void loadComments(true);
  } catch (error) {
    if (requestVersion === detailRequestVersion && !localFeed.value) localError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (requestVersion === detailRequestVersion) localLoading.value = false;
  }
}

async function loadComments(reset: boolean): Promise<void> {
  if (mode.value !== 'detail' || props.comments !== undefined) return;
  const id = effectiveFeedId.value;
  if (!id || localCommentLoading.value || localCommentLoadingMore.value) return;
  if (!reset && !localCommentHasMore.value) return;
  if (reset) {
    commentPage.value = 0;
    commentFirstItem.value = '';
    commentLastItem.value = '';
    localComments.value = [];
    localCommentHasMore.value = true;
    localCommentError.value = '';
  }
  const page = commentPage.value + 1;
  const requestVersion = ++commentRequestVersion;
  const previous = localComments.value;
  if (page === 1) localCommentLoading.value = true;
  else localCommentLoadingMore.value = true;
  try {
    const options = getCommentReplyRequestOptions(commentSortMode.value, commentAuthorOnly.value);
    const response = await CoolapkTauriAPI.getFeedReplies(id, page, {
      ...options,
      firstItem: commentFirstItem.value,
      lastItem: commentLastItem.value,
    });
    if (requestVersion !== commentRequestVersion) return;
    const pageReplies = getReplyData(response);
    const merged = mergeReplies(previous, pageReplies);
    localComments.value = merged;
    const cursor = getReplyPageCursor(pageReplies);
    if (page === 1) commentFirstItem.value = cursor.firstItem;
    commentLastItem.value = cursor.lastItem || commentLastItem.value;
    commentPage.value = page;
    localCommentHasMore.value = hasMoreReplyPages(pageReplies, previous, merged, commentTotal.value);
  } catch (error) {
    if (requestVersion === commentRequestVersion) localCommentError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (requestVersion === commentRequestVersion) {
      localCommentLoading.value = false;
      localCommentLoadingMore.value = false;
    }
  }
}

onMounted(() => {
  if (mode.value === 'detail') {
    void loadDetail();
    if (props.feed !== undefined && props.comments === undefined) void loadComments(true);
  } else if (props.feeds === undefined) {
    void loadFeeds(true);
  }
});

watch(() => props.activeTab, (value) => {
  if (value) selectedTab.value = value;
});

watch([() => props.mode, () => props.feedId, () => route.fullPath], ([nextMode, nextFeedId], previous) => {
  if (nextMode !== 'detail' || (previous && nextFeedId === previous[1])) return;
  if (props.feed === undefined) {
    localFeed.value = null;
    localComments.value = [];
    void loadDetail(true);
  }
});
</script>

<style scoped>
.mobile-feed-page {
  --mobile-feed-green: #0f9d58;
  --mobile-feed-green-soft: #e4f7ee;
  --mobile-feed-bg: #f2f2f6;
  --mobile-feed-text: #242426;
  --mobile-feed-muted: #929298;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--mobile-feed-bg);
  color: var(--mobile-feed-text);
}

.mobile-feed-page__header {
  z-index: 2;
  flex: 0 0 auto;
  border-bottom: 1px solid #e8e8eb;
  background: rgba(255, 255, 255, .97);
  box-shadow: 0 1px 3px rgba(30, 30, 35, .03);
}

.mobile-feed-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 13px 0 17px;
}

.mobile-feed-page__detail-toolbar {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 0 10px 0 6px;
}

.mobile-feed-page__detail-toolbar > button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #242426;
  font: inherit;
  font-size: 17px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-feed-page__detail-toolbar > button:active {
  background: var(--mobile-feed-green-soft);
}

.mobile-feed-page__detail-author {
  display: flex !important;
  align-items: center;
  justify-content: flex-start !important;
  gap: 8px;
  width: auto !important;
  min-width: 0;
  text-align: left;
}

.mobile-feed-page__detail-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--mobile-feed-green-soft);
  color: var(--mobile-feed-green);
}

.mobile-feed-page__detail-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-feed-page__detail-author > span:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.mobile-feed-page__detail-author strong,
.mobile-feed-page__detail-author small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-feed-page__detail-author strong {
  font-size: 14px;
}

.mobile-feed-page__detail-title {
  overflow: hidden;
  font-size: 17px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-feed-page__detail-author small {
  color: #b2b2b6;
  font-size: 11px;
}

.mobile-feed-page__title-wrap { display: flex; align-items: center; min-width: 0; gap: 8px; }
.mobile-feed-page__title-wrap h1 { margin: 0; font-size: 18px; font-weight: 750; line-height: 1.25; }
.mobile-feed-page__home-channel-row {
  display: flex;
  align-items: stretch;
  min-width: 0;
  min-height: 43px;
  border-top: 1px solid #f2f2f4;
}
.mobile-feed-page__home-channel-row .mobile-feed-page__tabs {
  flex: 1 1 auto;
  min-width: 0;
}
.mobile-feed-page__home-channel-button {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  min-height: 43px;
  padding: 0;
  border: 0;
  border-left: 1px solid #f0f0f2;
  background: #fff;
  color: #444448;
  font: inherit;
  font-size: 18px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.mobile-feed-page__home-channel-button:active { background: #f5f5f6; }
.mobile-feed-page__channel-button,
.mobile-feed-page__refresh-button {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #737379;
  font: inherit;
  font-size: 16px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.mobile-feed-page__channel-button:active,
.mobile-feed-page__refresh-button:active,
.mobile-feed-card__more:active,
.mobile-feed-card__follow:active { transform: scale(.94); }
.mobile-feed-page__refresh-button:disabled { opacity: .45; }

.mobile-feed-page__tabs {
  display: flex;
  gap: 24px;
  min-width: 0;
  padding: 0 17px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.mobile-feed-page__tabs::-webkit-scrollbar { display: none; }
.mobile-feed-page__tab {
  position: relative;
  flex: 0 0 auto;
  min-height: 43px;
  padding: 0 1px;
  border: 0;
  background: transparent;
  color: #85858b;
  font: inherit;
  font-size: 15px;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.mobile-feed-page__tab::after { position: absolute; right: 0; bottom: 0; left: 0; height: 3px; border-radius: 99px 99px 0 0; background: transparent; content: ''; }
.mobile-feed-page__tab.active { color: var(--mobile-feed-text); font-weight: 700; }
.mobile-feed-page__tab.active::after { background: var(--mobile-feed-green); box-shadow: 0 -1px 7px rgba(15, 157, 88, .25); }
.mobile-feed-page__tab-badge { margin-left: 3px; color: var(--mobile-feed-green); font-size: 10px; }

.mobile-feed-page__scroll {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0 calc(18px + env(safe-area-inset-bottom, 0px));
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}
.mobile-feed-page--detail .mobile-feed-page__scroll { padding-top: 0; padding-bottom: 12px; }

.mobile-feed-page__state,
.mobile-feed-comments__state {
  display: grid;
  place-items: center;
  gap: 9px;
  min-height: 240px;
  padding: 24px;
  color: var(--mobile-feed-muted);
  font-size: 13px;
  text-align: center;
}
.mobile-feed-page__state > i { font-size: 23px; }
.mobile-feed-page__state--error { color: #d84d46; }
.mobile-feed-page__state--empty strong { color: #505057; font-size: 16px; }
.mobile-feed-page__state button,
.mobile-feed-comments__state button { min-height: 38px; padding: 0 17px; border: 0; border-radius: 999px; background: var(--mobile-feed-green); color: #fff; font: inherit; touch-action: manipulation; }
.mobile-feed-page__state--empty span { color: #a2a2a8; }

.mobile-feed-page__list { display: grid; gap: 8px; }
.mobile-feed-card {
  width: 100%;
  box-sizing: border-box;
  padding: 14px 14px 10px;
  border: 1px solid #e8e8eb;
  border-radius: 17px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(25, 25, 30, .035);
  touch-action: pan-y;
}
.mobile-feed-page--home .mobile-feed-card,
.mobile-feed-page--feed .mobile-feed-card { margin-inline: 8px; width: calc(100% - 16px); }
.mobile-feed-card--detail { padding: 17px 16px 12px; border: 0; border-radius: 0; box-shadow: none; }
.mobile-feed-card__author-row { display: flex; align-items: center; gap: 8px; min-width: 0; margin-bottom: 13px; }
.mobile-feed-card__author { display: flex; flex: 1 1 auto; align-items: center; min-width: 0; gap: 10px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; touch-action: manipulation; }
.mobile-feed-card__avatar { display: grid; place-items: center; flex: 0 0 41px; width: 41px; height: 41px; overflow: hidden; border-radius: 50%; background: #e4f7ee; color: var(--mobile-feed-green); font-size: 17px; }
.mobile-feed-card__avatar img { width: 100%; height: 100%; object-fit: cover; }
.mobile-feed-card__author-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.mobile-feed-card__author-copy strong { overflow: hidden; color: #29292c; font-size: 15px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.mobile-feed-card__meta { overflow: hidden; color: #a0a0a5; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-feed-card__follow { flex: 0 0 auto; min-width: 54px; min-height: 31px; padding: 0 11px; border: 1px solid var(--mobile-feed-green); border-radius: 999px; background: transparent; color: var(--mobile-feed-green); font: inherit; font-size: 12px; touch-action: manipulation; }
.mobile-feed-card__follow.active { border-color: #d4d4d8; color: #9a9aa0; }
.mobile-feed-card__more { display: inline-grid; place-items: center; flex: 0 0 36px; width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; color: #a2a2a7; font-size: 17px; touch-action: manipulation; }

.mobile-feed-card :deep(.feed-content-wrapper) { margin-bottom: 8px; }
.mobile-feed-card :deep(.feed-title) { margin: 0 0 8px; color: #212124; font-size: 18px; line-height: 1.45; }
.mobile-feed-card :deep(.feed-body) { color: #252529; font-size: 16px; line-height: 1.65; word-break: break-word; }
.mobile-feed-card :deep(.feed-body a) { color: var(--mobile-feed-green); text-decoration: none; }
.mobile-feed-card :deep(.expand-btn) { min-height: 36px; margin-top: 6px; padding: 0 10px; border: 0; border-radius: 999px; background: var(--mobile-feed-green-soft); color: var(--mobile-feed-green); font: inherit; font-size: 13px; }
.mobile-feed-card :deep(.question-title-badge),
.mobile-feed-card :deep(.answer-title-badge) { border-radius: 6px; background: var(--mobile-feed-green-soft); color: var(--mobile-feed-green); }

.mobile-feed-card__topics { display: flex; flex-wrap: wrap; gap: 5px; margin: 1px 0 8px; }
.mobile-feed-card__topic { padding: 3px 4px; border: 0; background: transparent; color: var(--mobile-feed-green); font: inherit; font-size: 14px; touch-action: manipulation; }
.mobile-feed-card__topic:active { opacity: .65; }

.mobile-feed-card__relations { display: grid; gap: 7px; margin: 8px 0 10px; }
.mobile-feed-card__relation { display: flex; align-items: center; min-width: 0; gap: 10px; padding: 10px; border: 1px solid #ececef; border-radius: 13px; background: #f8f8fa; color: inherit; font: inherit; text-align: left; touch-action: manipulation; }
.mobile-feed-card__relation:active { background: #f0f8f4; }
.mobile-feed-card__relation-media { display: grid; place-items: center; flex: 0 0 40px; width: 40px; height: 40px; overflow: hidden; border-radius: 9px; background: #e8f5ee; color: var(--mobile-feed-green); }
.mobile-feed-card__relation-media img { width: 100%; height: 100%; object-fit: cover; }
.mobile-feed-card__relation-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 3px; }
.mobile-feed-card__relation-copy strong { overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-feed-card__relation-copy small { overflow: hidden; color: #929299; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-feed-card__relation-rating { flex: 0 0 auto; color: #ea8b0c; font-size: 13px; font-weight: 700; }
.mobile-feed-card__relation-rating i { margin-right: 3px; }
.mobile-feed-card__relation-arrow { flex: 0 0 auto; color: #b8b8bd; font-size: 12px; }

.mobile-feed-card__media { min-width: 0; margin-top: 9px; }
.mobile-feed-card__media :deep(.feed-image-grid) { gap: 5px; margin-bottom: 7px; }
.mobile-feed-card__media :deep(.grid-item) { overflow: hidden; border-radius: 11px; }

.mobile-feed-card__actions { display: flex; align-items: center; justify-content: space-between; gap: 2px; margin-top: 5px; padding-top: 7px; border-top: 1px solid #f0f0f2; }
.mobile-feed-card__actions--detail { margin-top: 13px; padding: 6px 4px; border: 1px solid #ebebee; border-radius: 16px; background: #fafafd; }
.mobile-feed-card__action,
.mobile-feed-card__write { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-width: 44px; min-height: 42px; padding: 0 7px; border: 0; border-radius: 12px; background: transparent; color: #89898f; font: inherit; font-size: 13px; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.mobile-feed-card__action { flex: 1 1 0; }
.mobile-feed-card__action i { font-size: 16px; }
.mobile-feed-card__action.active { color: #ef4e54; }
.mobile-feed-card__action:nth-last-child(2).active { color: #ef9b17; }
.mobile-feed-card__action:active,
.mobile-feed-card__write:active { background: #eff7f3; transform: scale(.97); }
.mobile-feed-card__write { flex: 1.4 1 0; justify-content: flex-start; padding-inline: 12px; border-radius: 999px; background: #f1f1f4; color: #77777d; }

.mobile-feed-comments { margin-top: 8px; padding: 16px 14px calc(12px + env(safe-area-inset-bottom, 0px)); background: #fff; }
.mobile-feed-comments__header { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; margin-bottom: 10px; }
.mobile-feed-comments__header h2 { flex: 0 0 auto; margin: 0; font-size: 18px; }
.mobile-feed-comments__sort { display: flex; align-items: center; max-width: 65%; overflow-x: auto; padding: 3px; border-radius: 999px; background: #f2f2f5; scrollbar-width: none; }
.mobile-feed-comments__sort::-webkit-scrollbar { display: none; }
.mobile-feed-comments__sort button { flex: 0 0 auto; min-height: 30px; padding: 0 9px; border: 0; border-radius: 999px; background: transparent; color: #8d8d93; font: inherit; font-size: 12px; white-space: nowrap; touch-action: manipulation; }
.mobile-feed-comments__sort button.active { background: #fff; color: #333337; box-shadow: 0 1px 4px rgba(20, 20, 25, .08); }
.mobile-feed-comment { display: flex; gap: 9px; min-width: 0; padding: 13px 0; border-top: 1px solid #f1f1f3; }
.mobile-feed-comment__avatar { display: grid; place-items: center; flex: 0 0 34px; width: 34px; height: 34px; overflow: hidden; padding: 0; border: 0; border-radius: 50%; background: #e4f7ee; color: var(--mobile-feed-green); font-size: 14px; touch-action: manipulation; }
.mobile-feed-comment__avatar img { width: 100%; height: 100%; object-fit: cover; }
.mobile-feed-comment__body { flex: 1; min-width: 0; }
.mobile-feed-comment__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; line-height: 1.3; }
.mobile-feed-comment__user { padding: 0; border: 0; background: transparent; color: #4b4b51; font: inherit; font-size: 13px; font-weight: 650; touch-action: manipulation; }
.mobile-feed-comment__meta time { color: #b0b0b5; font-size: 10px; }
.mobile-feed-comment__level,
.mobile-feed-comment__author-badge { padding: 1px 5px; border-radius: 5px; background: #edf7f2; color: var(--mobile-feed-green); font-size: 10px; }
.mobile-feed-comment__author-badge { background: #fff0e4; color: #e88724; }
.mobile-feed-comment__text { margin-top: 5px; color: #333337; font-size: 14px; line-height: 1.6; word-break: break-word; }
.mobile-feed-comment__text :deep(a) { color: var(--mobile-feed-green); }
.mobile-feed-comment__images { display: grid; grid-template-columns: repeat(3, 64px); gap: 5px; margin-top: 7px; }
.mobile-feed-comment__images img { width: 64px; height: 64px; border-radius: 7px; object-fit: cover; }
.mobile-feed-comment__actions { display: flex; gap: 14px; margin-top: 6px; }
.mobile-feed-comment__actions button { min-height: 34px; padding: 0; border: 0; background: transparent; color: #a1a1a7; font: inherit; font-size: 11px; touch-action: manipulation; }
.mobile-feed-comment__actions button.active { color: var(--mobile-feed-green); }
.mobile-feed-comment__actions i { margin-right: 3px; }
.mobile-feed-comment__replies { margin-top: 8px; padding: 8px 10px; border-radius: 9px; background: #f5f5f7; }
.mobile-feed-comment__reply { color: #66666c; font-size: 12px; line-height: 1.55; }
.mobile-feed-comment__reply + .mobile-feed-comment__reply { margin-top: 4px; }
.mobile-feed-comment__reply strong { margin-right: 5px; color: #55555b; }
.mobile-feed-comment__more-replies { margin-top: 5px; padding: 0; border: 0; background: transparent; color: var(--mobile-feed-green); font: inherit; font-size: 12px; }
.mobile-feed-comments__load-more { display: block; width: 100%; min-height: 44px; margin-top: 5px; border: 0; border-radius: 12px; background: #f5f5f7; color: #77777d; font: inherit; font-size: 13px; touch-action: manipulation; }

.mobile-feed-page__load-more { display: grid; place-items: center; min-height: 48px; color: #a1a1a6; font-size: 12px; }
.mobile-feed-page__load-more button { min-height: 38px; padding: 0 18px; border: 0; border-radius: 999px; background: #fff; color: var(--mobile-feed-green); font: inherit; box-shadow: 0 1px 5px rgba(20, 20, 25, .07); touch-action: manipulation; }

.mobile-feed-page__composer-dock { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; min-height: 58px; padding: 5px 9px max(5px, env(safe-area-inset-bottom, 0px)); border-top: 1px solid #e7e7ea; background: rgba(255, 255, 255, .97); box-shadow: 0 -3px 14px rgba(20, 20, 25, .06); }
.mobile-feed-page__composer-dock > button { display: inline-grid; place-items: center; flex: 0 0 41px; width: 41px; height: 42px; border: 0; border-radius: 12px; background: transparent; color: #74747a; font: inherit; font-size: 16px; touch-action: manipulation; }
.mobile-feed-page__composer-dock > button.active { color: var(--mobile-feed-green); }
.mobile-feed-page__composer-entry { display: flex !important; flex: 1 1 auto !important; align-items: center; justify-content: flex-start !important; gap: 7px; width: auto !important; padding: 0 15px; border-radius: 999px !important; background: #f1f1f4 !important; color: #8e8e94 !important; font-size: 13px !important; }
.mobile-feed-page__composer-entry i { font-size: 15px; }
.mobile-feed-page__composer-backdrop,
.mobile-feed-channel-sheet { position: fixed; z-index: 50; inset: 0; display: flex; align-items: flex-end; justify-content: center; background: rgba(20, 20, 26, .38); }
.mobile-feed-page__composer { width: min(100%, 680px); box-sizing: border-box; padding: 14px 15px max(15px, env(safe-area-inset-bottom, 0px)); border-radius: 20px 20px 0 0; background: #fff; box-shadow: 0 -8px 32px rgba(20, 20, 25, .17); }
.mobile-feed-page__composer-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
.mobile-feed-page__composer-heading strong { font-size: 17px; }
.mobile-feed-page__composer-heading button { width: 34px; height: 34px; border: 0; border-radius: 10px; background: #f3f3f5; color: #7d7d82; font-size: 16px; }
.mobile-feed-page__composer textarea { display: block; width: 100%; box-sizing: border-box; min-height: 100px; resize: vertical; padding: 10px; border: 1px solid #e3e3e6; border-radius: 12px; outline: none; background: #fafafd; color: #252529; font: inherit; font-size: 15px; line-height: 1.55; }
.mobile-feed-page__composer textarea:focus { border-color: var(--mobile-feed-green); box-shadow: 0 0 0 3px rgba(15, 157, 88, .1); }
.mobile-feed-page__composer-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; color: #a0a0a5; font-size: 12px; }
.mobile-feed-page__composer-footer button { min-width: 70px; min-height: 37px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--mobile-feed-green); color: #fff; font: inherit; touch-action: manipulation; }
.mobile-feed-page__composer-footer button:disabled { opacity: .45; }

.mobile-feed-channel-sheet { z-index: 60; }
.mobile-feed-channel-sheet__panel { width: min(100%, 720px); max-height: min(78vh, 680px); overflow: auto; padding: 20px 17px max(18px, env(safe-area-inset-bottom, 0px)); border-radius: 22px 22px 0 0; background: #fff; box-shadow: 0 -8px 36px rgba(20, 20, 25, .18); }
.mobile-feed-channel-sheet__panel header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.mobile-feed-channel-sheet__panel h2 { margin: 0; font-size: 20px; }
.mobile-feed-channel-sheet__panel header button { border: 0; background: transparent; color: var(--mobile-feed-green); font: inherit; font-size: 14px; }
.mobile-feed-channel-sheet__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.mobile-feed-channel-sheet__grid button { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 43px; padding: 0 4px; border: 1px solid #ebebee; border-radius: 12px; background: #fafafd; color: #55555b; font: inherit; font-size: 13px; touch-action: manipulation; }
.mobile-feed-channel-sheet__grid button.active { border-color: rgba(15, 157, 88, .3); background: var(--mobile-feed-green-soft); color: var(--mobile-feed-green); }
.mobile-feed-channel-sheet__more { width: 100%; min-height: 44px; margin-top: 14px; border: 0; border-radius: 12px; background: #f4f4f6; color: #77777d; font: inherit; font-size: 13px; }
.mobile-feed-sheet-enter-active, .mobile-feed-sheet-leave-active { transition: opacity .2s ease; }
.mobile-feed-sheet-enter-active .mobile-feed-channel-sheet__panel, .mobile-feed-sheet-leave-active .mobile-feed-channel-sheet__panel { transition: transform .24s ease; }
.mobile-feed-sheet-enter-from, .mobile-feed-sheet-leave-to { opacity: 0; }
.mobile-feed-sheet-enter-from .mobile-feed-channel-sheet__panel, .mobile-feed-sheet-leave-to .mobile-feed-channel-sheet__panel { transform: translateY(100%); }

@media (min-width: 720px) {
  .mobile-feed-page__scroll { width: min(100%, 720px); margin-inline: auto; }
  .mobile-feed-page__header { width: min(100%, 720px); margin-inline: auto; }
  .mobile-feed-page__composer-dock { width: min(100%, 720px); margin-inline: auto; }
  .mobile-feed-page--home .mobile-feed-card,
  .mobile-feed-page--feed .mobile-feed-card { margin-inline: 0; width: 100%; }
}
</style>
