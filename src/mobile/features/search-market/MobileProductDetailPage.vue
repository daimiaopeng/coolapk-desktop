<template>
  <section class="mobile-product-detail-page" data-mobile-page="product-detail" aria-label="产品详情">
    <main class="mobile-product-detail-scroll">
      <div class="mobile-detail-topbar">
        <button type="button" class="mobile-detail-back" aria-label="返回" @click="goBack">
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
        <strong>{{ isApp ? '应用详情' : '产品详情' }}</strong>
      </div>
      <div v-if="loading" class="mobile-detail-state" role="status" aria-live="polite">
        <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
        <strong>正在加载详情…</strong>
        <span>请稍候，正在获取酷安产品信息</span>
      </div>

      <div v-else-if="error" class="mobile-detail-state is-error" role="alert">
        <i class="fas fa-cloud-exclamation" aria-hidden="true"></i>
        <strong>详情加载失败</strong>
        <span>{{ error }}</span>
        <button type="button" class="mobile-detail-button primary" @click="loadDetail">重试</button>
      </div>

      <div v-else-if="!detail" class="mobile-detail-state" role="status">
        <i class="fas fa-box-open" aria-hidden="true"></i>
        <strong>没有找到{{ isApp ? '该应用' : '该产品' }}</strong>
        <span>{{ identifier ? '服务端没有返回可展示的详情' : '缺少应用包名或产品 ID' }}</span>
      </div>

      <template v-else>
        <section class="mobile-detail-hero" aria-labelledby="mobile-detail-title">
          <div class="mobile-detail-hero-main">
            <AppImage :src="iconUrl" :alt="title" image-class="mobile-detail-icon" />
            <div class="mobile-detail-title-block">
              <span class="mobile-detail-kind">{{ isApp ? '应用' : '数码产品' }}</span>
              <h1 id="mobile-detail-title">{{ title }}</h1>
              <p v-if="subtitle" class="mobile-detail-subtitle">{{ subtitle }}</p>
              <p v-if="isApp && packageName" class="mobile-detail-package">{{ packageName }}</p>
            </div>
          </div>

          <div class="mobile-detail-stats" aria-label="评分与统计">
            <div v-if="score" class="mobile-detail-stat">
              <strong><i class="fas fa-star" aria-hidden="true"></i> {{ score }}</strong>
              <span>评分</span>
            </div>
            <div v-if="ratingCount" class="mobile-detail-stat">
              <strong>{{ formatCount(ratingCount) }}</strong>
              <span>评分人数</span>
            </div>
            <div v-if="downloadCount" class="mobile-detail-stat">
              <strong>{{ formatCount(downloadCount) }}</strong>
              <span>{{ isApp ? '下载量' : '讨论' }}</span>
            </div>
            <div v-if="followCount" class="mobile-detail-stat">
              <strong>{{ formatCount(followCount) }}</strong>
              <span>{{ isApp ? '关注' : '关注人数' }}</span>
            </div>
          </div>

          <div class="mobile-detail-actions" aria-label="详情操作">
            <button
              v-if="isApp"
              type="button"
              class="mobile-detail-button primary"
              :disabled="downloadPending"
              @click="enqueueDownload"
            >
              <i :class="downloadPending ? 'fas fa-circle-notch fa-spin' : 'fas fa-download'" aria-hidden="true"></i>
              {{ downloadPending ? '正在加入…' : '下载应用' }}
            </button>
            <button
              v-else-if="productLink"
              type="button"
              class="mobile-detail-button primary"
              @click="openProductLink"
            >
              <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
              打开外链
            </button>

            <button
              v-if="isApp"
              type="button"
              class="mobile-detail-button"
              :class="{ active: appFollowed }"
              :disabled="actionPending === 'follow'"
              @click="toggleAppFollow"
            >
              <i :class="appFollowed ? 'fas fa-check' : 'fas fa-plus'" aria-hidden="true"></i>
              {{ appFollowed ? '已关注' : '关注' }}
            </button>
            <button
              v-if="isApp"
              type="button"
              class="mobile-detail-button"
              :class="{ active: appFavorited }"
              :disabled="actionPending === 'favorite'"
              @click="toggleAppFavorite"
            >
              <i :class="appFavorited ? 'fas fa-star' : 'far fa-star'" aria-hidden="true"></i>
              {{ appFavorited ? '已收藏' : '收藏' }}
            </button>
            <button
              v-if="!isApp"
              type="button"
              class="mobile-detail-button"
              :class="{ active: productFollowed }"
              :disabled="actionPending === 'follow'"
              @click="toggleProductFollow"
            >
              <i :class="productFollowed ? 'fas fa-check' : 'fas fa-plus'" aria-hidden="true"></i>
              {{ productFollowed ? '已关注' : '关注' }}
            </button>
            <button
              v-if="!isApp"
              type="button"
              class="mobile-detail-button"
              :class="{ active: productWished }"
              :disabled="actionPending === 'wish'"
              @click="toggleProductWish"
            >
              <i :class="productWished ? 'fas fa-heart' : 'far fa-heart'" aria-hidden="true"></i>
              {{ productWished ? '已想要' : '想要' }}
            </button>
            <button
              v-if="!isApp"
              type="button"
              class="mobile-detail-button"
              :class="{ active: productBought }"
              :disabled="actionPending === 'buy'"
              @click="toggleProductBought"
            >
              <i :class="productBought ? 'fas fa-check-circle' : 'far fa-check-circle'" aria-hidden="true"></i>
              {{ productBought ? '已购' : '标记已购' }}
            </button>
            <button v-if="isApp && appLink" type="button" class="mobile-detail-button" @click="openAppLink">
              <i class="fas fa-link" aria-hidden="true"></i>
              外链
            </button>
          </div>
        </section>

        <section v-if="!isApp" class="mobile-detail-rating-entry" aria-labelledby="mobile-detail-rating-entry-title">
          <button
            type="button"
            class="mobile-detail-rating-trigger"
            :aria-expanded="ratingPanelOpen"
            @click="toggleRatingPanel"
          >
            <span class="mobile-detail-rating-trigger-main">
              <span class="mobile-detail-rating-trigger-score">
                <i class="fas fa-star" aria-hidden="true"></i>
                {{ score || '暂无评分' }}
              </span>
              <span id="mobile-detail-rating-entry-title" class="mobile-detail-rating-trigger-label">
                {{ ratingCount ? `${formatCount(ratingCount)} 人评分` : '查看用户评分' }} · 评分与点评
              </span>
            </span>
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>

          <div v-if="ratingPanelOpen" class="mobile-detail-rating-panel">
            <div class="mobile-detail-rating-heading">
              <h2><i class="fas fa-star" aria-hidden="true"></i> 评分与点评</h2>
              <button type="button" class="mobile-detail-rating-refresh" :disabled="ratingLoading" @click="refreshRatings">
                <i :class="ratingLoading ? 'fas fa-circle-notch fa-spin' : 'fas fa-rotate-right'" aria-hidden="true"></i>
                刷新
              </button>
            </div>

            <div class="mobile-detail-rating-summary">
              <strong>{{ score || '暂无' }}</strong>
              <span>综合评分</span>
              <span v-if="ratingCount">{{ formatCount(ratingCount) }} 人评分</span>
            </div>

            <div class="mobile-detail-my-rating">
              <div class="mobile-detail-my-rating-heading">
                <strong>我的评分</strong>
                <span v-if="!authStore.isLoggedIn">登录后可以评分和点评</span>
              </div>
              <div v-if="authStore.isLoggedIn" class="mobile-detail-star-picker" aria-label="选择评分">
                <button
                  v-for="star in 5"
                  :key="star"
                  type="button"
                  class="mobile-detail-star-button"
                  :class="{ active: star <= myRating }"
                  :disabled="ratingPending"
                  :aria-label="`${star} 星`"
                  @click="setProductRating(star)"
                >
                  <i :class="star <= myRating ? 'fas fa-star' : 'far fa-star'" aria-hidden="true"></i>
                </button>
                <span>{{ myRating ? `${myRating} 星` : '点击星星评分' }}</span>
                <button v-if="myRating" type="button" class="mobile-detail-clear-rating" :disabled="ratingPending" @click="clearProductRating">
                  取消评分
                </button>
              </div>
              <button v-else type="button" class="mobile-detail-login-rating" @click="requireLogin">立即登录</button>
            </div>

            <div class="mobile-detail-rating-list-heading">
              <strong>用户点评</strong>
              <div class="mobile-detail-rating-filters" role="tablist" aria-label="点评筛选">
                <button
                  v-for="filter in ratingListFilters"
                  :key="filter.key"
                  type="button"
                  :class="{ active: activeRatingFilter === filter.key }"
                  role="tab"
                  :aria-selected="activeRatingFilter === filter.key"
                  @click="selectRatingFilter(filter.key)"
                >
                  {{ filter.label }}
                </button>
              </div>
            </div>

            <div v-if="ratingLoading && ratings.length === 0" class="mobile-detail-rating-state" role="status">
              <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> 正在加载点评…
            </div>
            <div v-else-if="ratingError && ratings.length === 0" class="mobile-detail-rating-state is-error" role="alert">
              <span>{{ ratingError }}</span>
              <button type="button" class="mobile-detail-rating-retry" @click="refreshRatings">重试</button>
            </div>
            <div v-else-if="ratings.length" class="mobile-detail-rating-list">
              <RatingCard v-for="(item, index) in ratings" :key="ratingKey(item, index)" :feed="item" />
              <button v-if="!ratingsNoMore" type="button" class="mobile-detail-rating-more" :disabled="ratingLoading" @click="loadMoreRatings">
                {{ ratingLoading ? '正在加载…' : '加载更多点评' }}
              </button>
              <span v-else class="mobile-detail-rating-end">没有更多点评了</span>
            </div>
            <div v-else class="mobile-detail-rating-state">暂无用户点评</div>
          </div>
        </section>

        <section class="mobile-detail-section" aria-labelledby="mobile-detail-intro-title">
          <h2 id="mobile-detail-intro-title"><i class="fas fa-align-left" aria-hidden="true"></i> 简介</h2>
          <p class="mobile-detail-description">{{ description || '暂无简介' }}</p>
        </section>

        <section class="mobile-detail-section" aria-labelledby="mobile-detail-media-title">
          <div class="mobile-detail-section-heading">
            <h2 id="mobile-detail-media-title"><i class="fas fa-images" aria-hidden="true"></i> 截图</h2>
            <span v-if="screenshots.length">{{ screenshots.length }} 张</span>
          </div>
          <div v-if="screenshots.length" class="mobile-detail-screenshots" aria-label="产品截图">
            <AppImage
              v-for="(image, index) in screenshots"
              :key="`${image}-${index}`"
              :src="image"
              :alt="`${title} 截图 ${index + 1}`"
              image-class="mobile-detail-screenshot"
              fit="cover"
            />
          </div>
          <p v-else class="mobile-detail-muted">暂无截图</p>
        </section>

        <section class="mobile-detail-section" aria-labelledby="mobile-detail-dynamic-title">
          <div class="mobile-detail-section-heading">
            <h2 id="mobile-detail-dynamic-title"><i class="fas fa-align-left" aria-hidden="true"></i> 动态摘要</h2>
            <span v-if="dynamicItems.length">{{ dynamicItems.length }} 条</span>
          </div>
          <p v-if="dynamicSummary" class="mobile-detail-summary">{{ dynamicSummary }}</p>
          <div v-if="dynamicItems.length" class="mobile-detail-dynamic-list">
            <article v-for="(item, index) in dynamicItems" :key="`${item.title}-${index}`" class="mobile-detail-dynamic-item">
              <strong>{{ item.title }}</strong>
              <span v-if="item.meta">{{ item.meta }}</span>
            </article>
          </div>
          <p v-else-if="!dynamicSummary" class="mobile-detail-muted">暂无动态摘要</p>
        </section>
      </template>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppImage from '../../../components/common/AppImage.vue';
import RatingCard from '../../../components/feed/RatingCard.vue';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { useAuthStore } from '../../../stores/auth';
import { useDownloadStore } from '../../../stores/downloads';
import type { ProductMedia } from '../../../types/product';
import { showToast } from '../../../utils/toast';

defineOptions({ name: 'MobileProductDetailPage' });

type DetailRecord = Record<string, any>;
type DetailMode = 'app' | 'product';
type DynamicItem = { title: string; meta: string };
type RatingFilterKey = 'all' | 'owner';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const downloadStore = useDownloadStore();

const detail = ref<DetailRecord | null>(null);
const loading = ref(false);
const error = ref('');
const actionPending = ref<'follow' | 'favorite' | 'wish' | 'buy' | ''>('');
const downloadPending = ref(false);
const appFollowed = ref(false);
const appFavorited = ref(false);
const productFollowed = ref(false);
const ratingPanelOpen = ref(false);
const ratingLoading = ref(false);
const ratingError = ref('');
const ratings = ref<DetailRecord[]>([]);
const ratingsPage = ref(1);
const ratingsNoMore = ref(false);
const activeRatingFilter = ref<RatingFilterKey>('all');
const ratingPending = ref(false);
const myRating = ref(0);
const buyChecked = ref(false);
const requestVersion = ref(0);

const packageName = computed(() => routeParam(route.params.packageName));
const productId = computed(() => routeParam(route.params.productId));
const identifier = computed(() => packageName.value || productId.value);
const mode = computed<DetailMode>(() => packageName.value ? 'app' : 'product');
const isApp = computed(() => mode.value === 'app');

const title = computed(() => firstText(detail.value, ['title', 'appName', 'shorttitle', 'name']) || identifier.value || '未命名产品');
const subtitle = computed(() => firstText(detail.value, isApp.value
  ? ['developername', 'developerName', 'category_title', 'category']
  : ['brand_name', 'brandName', 'subTitle', 'device_info', 'model']) || '');
const iconUrl = computed(() => firstText(detail.value, isApp.value
  ? ['apkRomIcon', 'logo', 'icon', 'pic', 'appIcon']
  : ['logo', 'product_logo', 'pic', 'icon', 'image']) || '');
const description = computed(() => stripMarkup(firstText(detail.value, ['description', 'intro', 'summary', 'subTitle', 'device_info'])));
const score = computed(() => firstText(detail.value, isApp.value
  ? ['score', 'rating', 'ratingScore']
  : ['rating_average_score', 'rating', 'score', 'ratingScore']));
const ratingCount = computed(() => firstValue(detail.value, isApp.value
  ? ['votenum', 'score_count', 'rating_count', 'ratingCount']
  : ['rating_count', 'rating_num', 'votenum', 'score_count']));
const downloadCount = computed(() => firstValue(detail.value, isApp.value
  ? ['downCount', 'downCountFormatted', 'down_count', 'download_count']
  : ['feed_comment_num', 'comment_count', 'feed_num', 'discussion_count']));
const followCount = computed(() => firstValue(detail.value, isApp.value
  ? ['follow_num', 'followCount', 'fans_num']
  : ['follow_num', 'followCount', 'fans_num']));
const appLink = computed(() => firstText(detail.value, ['url', 'webUrl', 'web_url', 'link', 'downloadUrl', 'download_url']));
const productLink = computed(() => firstText(detail.value, ['url', 'webUrl', 'web_url', 'link', 'official_url', 'officialUrl']));

const productWished = computed(() => flag(readAction(detail.value, ['wish', 'is_wish', 'isWished'])));
const productBought = computed(() => flag(readAction(detail.value, ['buy', 'buy_status', 'buyStatus', 'is_buy', 'isBought'])));
const ratingListFilters: Array<{ key: RatingFilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'owner', label: '机主' },
];

const screenshots = computed(() => normalizeMedia(
  detail.value?.screenList
    ?? detail.value?.screenshots
    ?? detail.value?.screenArr
    ?? detail.value?.screen
    ?? detail.value?.images
    ?? detail.value?.mediaList
    ?? detail.value?.media,
));

const dynamicSummary = computed(() => stripMarkup(firstText(detail.value, [
  'feedSummary', 'feed_summary', 'dynamicSummary', 'dynamic_summary', 'latestSummary', 'latest_summary', 'discussionSummary',
])));

const dynamicItems = computed<DynamicItem[]>(() => normalizeDynamicItems(
  detail.value?.feedRows
    ?? detail.value?.feed_rows
    ?? detail.value?.feeds
    ?? detail.value?.feedList
    ?? detail.value?.recentFeeds
    ?? detail.value?.latestFeeds
    ?? detail.value?.dynamic,
));

function routeParam(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
}

function firstText(source: DetailRecord | null, keys: string[]): string {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function firstValue(source: DetailRecord | null, keys: string[]): string | number {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function readAction(source: DetailRecord | null, keys: string[]): unknown {
  if (!source) return undefined;
  const containers = [source.userAction, source.user_action, source];
  for (const container of containers) {
    if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
    for (const key of keys) {
      const value = (container as DetailRecord)[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }
  return undefined;
}

function setUserAction(values: DetailRecord): void {
  if (!detail.value) return;
  detail.value.userAction = {
    ...(detail.value.userAction || {}),
    ...values,
  };
}

function normalizeRating(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  const fivePointScore = number > 5 ? number / 2 : number;
  return Math.max(1, Math.min(5, Math.round(fivePointScore)));
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s{3,}/g, '  ').trim();
}

function formatCount(value: string | number): string {
  if (value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1).replace(/\.0$/, '')}万`;
  if (number >= 1000) return `${(number / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(number);
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
}

function normalizeMedia(value: unknown): string[] {
  const rows = toArray(value);
  return rows.map((row) => {
    if (typeof row === 'string') return row.trim();
    const media = row as ProductMedia;
    return String(media.url || media.pic || media.image || media.imageUrl || media.cover || media.media_info || '').trim();
  }).filter(Boolean);
}

function normalizeDynamicItems(value: unknown): DynamicItem[] {
  return toArray(value).map((row) => {
    if (typeof row === 'string') return { title: stripMarkup(row), meta: '' };
    const item = row as DetailRecord;
    const itemTitle = stripMarkup(firstText(item, ['title', 'message', 'content', 'description', 'summary', 'message_title']));
    const meta = firstText(item, ['dateline_desc', 'dateline', 'time', 'date', 'username', 'user_name']);
    return { title: itemTitle, meta };
  }).filter((item) => item.title);
}

function normalizeRows(response: any): DetailRecord[] {
  const candidates = [
    response?.data,
    response?.data?.data,
    response?.data?.entities,
    response?.data?.rows,
    response?.entities,
    response?.rows,
  ];
  const rows = candidates.find((value) => Array.isArray(value));
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
}

function ratingKey(item: DetailRecord, index: number): string {
  return String(item.id ?? item.entityId ?? item.uid ?? `${item.dateline ?? ''}-${index}`);
}

function unwrapDetail(response: any): DetailRecord | null {
  let data = response?.data ?? response;
  if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) data = data.data;
  return data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length ? data : null;
}

async function loadDetail() {
  const currentIdentifier = identifier.value;
  const currentMode = mode.value;
  const version = ++requestVersion.value;
  detail.value = null;
  error.value = '';
  ratingPanelOpen.value = false;
  ratingError.value = '';
  ratings.value = [];
  ratingsPage.value = 1;
  ratingsNoMore.value = false;
  if (!currentIdentifier) return;
  loading.value = true;
  try {
    const response = currentMode === 'app'
      ? await CoolapkTauriAPI.getAppDetail(currentIdentifier)
      : await CoolapkTauriAPI.getProductDetail(currentIdentifier);
    if (version !== requestVersion.value) return;
    const nextDetail = unwrapDetail(response);
    if (!nextDetail) {
      error.value = `未找到${currentMode === 'app' ? '应用' : '产品'}详情`;
      return;
    }
    detail.value = nextDetail;
    appFollowed.value = flag(readAction(nextDetail, ['follow', 'is_followed', 'isFollowed', 'followed']));
    appFavorited.value = flag(readAction(nextDetail, ['favorite', 'fav', 'is_favorite', 'isFavorited', 'favorited']));
    productFollowed.value = flag(readAction(nextDetail, ['follow', 'is_followed', 'isFollowed', 'followed']));
    myRating.value = normalizeRating(readAction(nextDetail, ['rating', 'star', 'rating_score', 'ratingScore']));
    buyChecked.value = flag(readAction(nextDetail, ['buy', 'buy_status', 'buyStatus', 'is_buy', 'isBought']));
  } catch (cause) {
    if (version === requestVersion.value) error.value = cause instanceof Error ? cause.message : '网络请求失败，请稍后重试';
  } finally {
    if (version === requestVersion.value) loading.value = false;
  }
}

function requireLogin(): boolean {
  if (authStore.isLoggedIn) return true;
  authStore.openLoginModal();
  return false;
}

async function toggleAppFavorite() {
  if (!requireLogin() || !packageName.value || actionPending.value) return;
  const previous = appFavorited.value;
  appFavorited.value = !previous;
  actionPending.value = 'favorite';
  try {
    if (previous) await CoolapkTauriAPI.unfavoriteApk(packageName.value);
    else await CoolapkTauriAPI.favoriteApk(packageName.value);
    showToast(appFavorited.value ? '已收藏应用' : '已取消收藏', 'success');
  } catch (cause) {
    appFavorited.value = previous;
    showToast(cause instanceof Error ? cause.message : '收藏操作失败', 'error');
  } finally {
    actionPending.value = '';
  }
}

function toggleAppFollow() {
  showToast('当前 API 未提供应用关注操作', 'info');
}

async function toggleProductFollow() {
  if (!requireLogin() || !productId.value || actionPending.value) return;
  const target = !productFollowed.value;
  actionPending.value = 'follow';
  try {
    await CoolapkTauriAPI.changeProductFollowStatus(productId.value, target ? 1 : 0);
    productFollowed.value = target;
    setUserAction({ follow: target ? 1 : 0 });
    showToast(target ? '已关注产品' : '已取消关注产品', 'success');
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : '关注操作失败', 'error');
  } finally {
    actionPending.value = '';
  }
}

async function toggleProductWish() {
  if (!requireLogin() || !productId.value || actionPending.value) return;
  const target = !productWished.value;
  actionPending.value = 'wish';
  try {
    await CoolapkTauriAPI.changeProductWishStatus(productId.value, target ? 1 : 0);
    setUserAction({ wish: target ? 1 : 0 });
    showToast(target ? '已加入想要清单' : '已移出想要清单', 'success');
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : '想要操作失败', 'error');
  } finally {
    actionPending.value = '';
  }
}

async function toggleProductBought() {
  if (!requireLogin() || !productId.value || actionPending.value) return;
  const target = !productBought.value;
  const uid = String(authStore.user?.uid || '');
  if (!uid) {
    showToast('当前账号缺少 UID，无法更新已购状态', 'error');
    return;
  }
  actionPending.value = 'buy';
  try {
    const star = myRating.value || normalizeRating(score.value) || 1;
    await CoolapkTauriAPI.changeRatingStatus(productId.value, star, uid, target ? 1 : 0);
    buyChecked.value = target;
    setUserAction({ buy: target ? 1 : 0, rating: myRating.value || star });
    showToast(target ? '已标记为已购' : '已取消已购标记', 'success');
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : '已购操作失败', 'error');
  } finally {
    actionPending.value = '';
  }
}

function toggleRatingPanel() {
  ratingPanelOpen.value = !ratingPanelOpen.value;
  if (ratingPanelOpen.value && ratings.value.length === 0 && !ratingLoading.value) {
    void loadRatings(true);
  }
}

async function loadRatings(reset = false) {
  if (!productId.value || ratingLoading.value || (!reset && ratingsNoMore.value)) return;
  if (reset) {
    ratingsPage.value = 1;
    ratingsNoMore.value = false;
    ratingError.value = '';
    ratings.value = [];
  }
  ratingLoading.value = true;
  try {
    const isOwner = activeRatingFilter.value === 'owner' ? 1 : 0;
    const response = await CoolapkTauriAPI.getProductRatingList(
      productId.value,
      0,
      isOwner,
      ratingsPage.value,
    );
    const nextRows = normalizeRows(response);
    if (nextRows.length === 0) {
      ratingsNoMore.value = true;
    } else {
      ratings.value = reset ? nextRows : [...ratings.value, ...nextRows];
      ratingsPage.value += 1;
    }
  } catch (cause) {
    ratingError.value = cause instanceof Error ? cause.message : '点评加载失败，请稍后重试';
  } finally {
    ratingLoading.value = false;
  }
}

function refreshRatings() {
  void loadRatings(true);
}

function loadMoreRatings() {
  void loadRatings(false);
}

function selectRatingFilter(key: RatingFilterKey) {
  if (activeRatingFilter.value === key && ratings.value.length > 0) return;
  activeRatingFilter.value = key;
  void loadRatings(true);
}

async function setProductRating(star: number) {
  if (!requireLogin() || !productId.value || ratingPending.value) return;
  const uid = String(authStore.user?.uid || '');
  if (!uid) {
    showToast('当前账号缺少 UID，无法提交评分', 'error');
    return;
  }
  ratingPending.value = true;
  try {
    await CoolapkTauriAPI.changeRatingStatus(productId.value, star, uid, buyChecked.value ? 1 : 0);
    myRating.value = star;
    setUserAction({ rating: star, buy: buyChecked.value ? 1 : 0 });
    showToast(`已评分 ${star} 星`, 'success');
    if (ratingPanelOpen.value) void loadRatings(true);
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : '评分失败', 'error');
  } finally {
    ratingPending.value = false;
  }
}

async function clearProductRating() {
  if (!requireLogin() || !productId.value || ratingPending.value) return;
  const uid = String(authStore.user?.uid || '');
  if (!uid) {
    showToast('当前账号缺少 UID，无法取消评分', 'error');
    return;
  }
  ratingPending.value = true;
  try {
    await CoolapkTauriAPI.changeRatingStatus(productId.value, 0, uid);
    myRating.value = 0;
    buyChecked.value = false;
    setUserAction({ rating: 0, buy: 0 });
    showToast('已取消评分', 'success');
    if (ratingPanelOpen.value) void loadRatings(true);
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : '取消评分失败', 'error');
  } finally {
    ratingPending.value = false;
  }
}

async function enqueueDownload() {
  if (!isApp.value || !packageName.value || downloadPending.value) return;
  downloadPending.value = true;
  try {
    const task = downloadStore.enqueue({
      title: title.value,
      packageName: packageName.value,
      versionName: firstText(detail.value, ['apkversionname', 'versionName', 'version', 'version_name']),
      versionCode: firstValue(detail.value, ['versioncode', 'versionCode', 'version_code']),
      apkId: firstValue(detail.value, ['aid', 'id', 'apkid', 'apkId', 'entityId']),
      logoUrl: iconUrl.value,
      extraAnalysisData: firstText(detail.value, ['extraAnalysisData', 'extra_analysis_data']),
      total: Number(firstValue(detail.value, ['apksize', 'apkSize', 'size'])) || 0,
    });
    showToast(task.status === 'completed' ? '该版本已经下载完成' : '已加入下载队列', 'success');
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : '加入下载队列失败', 'error');
  } finally {
    downloadPending.value = false;
  }
}

function openAppLink() {
  if (appLink.value) void CoolapkTauriAPI.openUrl(appLink.value, 'system');
}

function openProductLink() {
  if (productLink.value) void CoolapkTauriAPI.openUrl(productLink.value, 'system');
}

function goBack() {
  if (window.history.length > 1) router.back();
  else void router.push('/');
}

watch([packageName, productId], () => { void loadDetail(); }, { immediate: true });

onBeforeUnmount(() => {
  requestVersion.value += 1;
});
</script>

<style scoped>
.mobile-product-detail-page {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  background: var(--background-secondary, #f2f2f6);
  color: var(--text-primary, #1f2937);
}

.mobile-product-detail-scroll {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 12px calc(24px + env(safe-area-inset-bottom, 0px));
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.mobile-detail-topbar {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: 8px;
  max-width: 720px;
  margin: 0 auto 4px;
  color: var(--text-primary, #1f2937);
}

.mobile-detail-topbar strong {
  font-size: 16px;
}

.mobile-detail-back {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 17px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-detail-back:active {
  background: var(--surface-hover, #e2e8f0);
}

.mobile-detail-hero,
.mobile-detail-section {
  margin: 0 auto 12px;
  max-width: 720px;
  border: 1px solid var(--border-light, rgba(15, 23, 42, .08));
  border-radius: 18px;
  background: var(--surface, #fff);
  box-shadow: 0 4px 16px rgba(15, 23, 42, .04);
}

.mobile-detail-hero {
  padding: 16px;
}

.mobile-detail-hero-main {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 14px;
}

.mobile-detail-icon {
  flex: 0 0 76px;
  width: 76px;
  height: 76px;
  border-radius: 18px;
}

.mobile-detail-title-block {
  min-width: 0;
  flex: 1 1 auto;
}

.mobile-detail-kind {
  color: var(--brand-primary, #10b981);
  font-size: 12px;
  font-weight: 700;
}

.mobile-detail-title-block h1 {
  margin: 3px 0 4px;
  overflow-wrap: anywhere;
  font-size: 21px;
  line-height: 1.25;
}

.mobile-detail-subtitle,
.mobile-detail-package {
  margin: 0;
  overflow: hidden;
  color: var(--text-secondary, #64748b);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-detail-package {
  margin-top: 3px;
  color: var(--text-tertiary, #94a3b8);
  font-size: 11px;
}

.mobile-detail-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light, rgba(15, 23, 42, .08));
}

.mobile-detail-stat {
  min-width: 0;
  text-align: center;
}

.mobile-detail-stat strong,
.mobile-detail-stat span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-detail-stat strong {
  color: var(--text-primary, #1f2937);
  font-size: 15px;
}

.mobile-detail-stat strong i {
  color: #f59e0b;
  font-size: 12px;
}

.mobile-detail-stat span {
  margin-top: 3px;
  color: var(--text-tertiary, #94a3b8);
  font-size: 11px;
}

.mobile-detail-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}

.mobile-detail-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 44px;
  gap: 7px;
  padding: 8px 10px;
  border: 1px solid var(--border-light, rgba(15, 23, 42, .1));
  border-radius: 12px;
  background: var(--surface-hover, #f8fafc);
  color: var(--text-primary, #334155);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-detail-button.primary {
  border-color: var(--brand-primary, #10b981);
  background: var(--brand-primary, #10b981);
  color: #fff;
}

.mobile-detail-button.active {
  border-color: color-mix(in srgb, var(--brand-primary, #10b981) 35%, transparent);
  background: var(--brand-soft, rgba(16, 185, 129, .1));
  color: var(--brand-primary, #10b981);
}

.mobile-detail-button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.mobile-detail-button:active {
  transform: scale(.98);
}

.mobile-detail-rating-entry {
  max-width: 720px;
  margin: 0 auto 12px;
  overflow: hidden;
  border: 1px solid var(--border-light, rgba(15, 23, 42, .08));
  border-radius: 18px;
  background: var(--surface, #fff);
  box-shadow: 0 4px 16px rgba(15, 23, 42, .04);
}

.mobile-detail-rating-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 68px;
  gap: 12px;
  padding: 13px 16px;
  border: 0;
  background: transparent;
  color: var(--text-primary, #1f2937);
  cursor: pointer;
  font: inherit;
  text-align: left;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-detail-rating-trigger:active {
  background: var(--surface-hover, #f8fafc);
}

.mobile-detail-rating-trigger-main {
  display: flex;
  align-items: baseline;
  min-width: 0;
  flex-wrap: wrap;
  gap: 8px;
}

.mobile-detail-rating-trigger-score {
  color: #f59e0b;
  font-size: 20px;
  font-weight: 800;
}

.mobile-detail-rating-trigger-label {
  color: var(--text-secondary, #64748b);
  font-size: 13px;
}

.mobile-detail-rating-trigger > i {
  flex: 0 0 auto;
  color: var(--text-tertiary, #94a3b8);
  font-size: 13px;
}

.mobile-detail-rating-panel {
  padding: 0 16px 16px;
  border-top: 1px solid var(--border-light, rgba(15, 23, 42, .08));
}

.mobile-detail-rating-heading,
.mobile-detail-rating-list-heading,
.mobile-detail-my-rating-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mobile-detail-rating-heading h2 {
  margin: 14px 0 0;
  font-size: 16px;
}

.mobile-detail-rating-heading h2 i {
  margin-right: 5px;
  color: #f59e0b;
}

.mobile-detail-rating-refresh,
.mobile-detail-clear-rating,
.mobile-detail-rating-retry,
.mobile-detail-login-rating {
  border: 0;
  background: transparent;
  color: var(--brand-primary, #10b981);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.mobile-detail-rating-refresh {
  margin-top: 14px;
  padding: 4px 0;
}

.mobile-detail-rating-refresh:disabled,
.mobile-detail-clear-rating:disabled,
.mobile-detail-rating-more:disabled {
  cursor: wait;
  opacity: .55;
}

.mobile-detail-rating-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-hover, #f8fafc);
}

.mobile-detail-rating-summary strong {
  color: #f59e0b;
  font-size: 26px;
}

.mobile-detail-rating-summary span {
  color: var(--text-tertiary, #94a3b8);
  font-size: 12px;
}

.mobile-detail-my-rating {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--border-light, rgba(15, 23, 42, .08));
  border-radius: 12px;
}

.mobile-detail-my-rating-heading strong,
.mobile-detail-rating-list-heading > strong {
  color: var(--text-primary, #1f2937);
  font-size: 14px;
}

.mobile-detail-my-rating-heading span {
  color: var(--text-tertiary, #94a3b8);
  font-size: 12px;
}

.mobile-detail-star-picker {
  display: flex;
  align-items: center;
  min-width: 0;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 10px;
}

.mobile-detail-star-picker > span {
  margin-left: 7px;
  color: var(--text-secondary, #64748b);
  font-size: 12px;
}

.mobile-detail-star-button {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-tertiary, #cbd5e1);
  cursor: pointer;
  font-size: 18px;
}

.mobile-detail-star-button.active {
  color: #f59e0b;
}

.mobile-detail-star-button:disabled {
  cursor: wait;
  opacity: .55;
}

.mobile-detail-clear-rating {
  margin-left: auto;
  padding: 4px 0;
}

.mobile-detail-login-rating {
  display: block;
  margin-top: 10px;
  padding: 6px 0;
}

.mobile-detail-rating-list-heading {
  margin-top: 16px;
}

.mobile-detail-rating-filters {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border-radius: 999px;
  background: var(--surface-hover, #f8fafc);
}

.mobile-detail-rating-filters button {
  padding: 4px 9px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}

.mobile-detail-rating-filters button.active {
  background: var(--surface, #fff);
  color: var(--brand-primary, #10b981);
  box-shadow: 0 1px 4px rgba(15, 23, 42, .12);
  font-weight: 700;
}

.mobile-detail-rating-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
  gap: 7px;
  color: var(--text-tertiary, #94a3b8);
  font-size: 12px;
  text-align: center;
}

.mobile-detail-rating-state.is-error {
  flex-wrap: wrap;
  color: #ef4444;
}

.mobile-detail-rating-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.mobile-detail-rating-list :deep(.rating-card) {
  margin: 0;
  border: 1px solid var(--border-light, rgba(15, 23, 42, .08));
  border-radius: 14px;
  box-shadow: none;
}

.mobile-detail-rating-more {
  min-height: 38px;
  border: 1px solid var(--border-light, rgba(15, 23, 42, .1));
  border-radius: 10px;
  background: var(--surface-hover, #f8fafc);
  color: var(--brand-primary, #10b981);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.mobile-detail-rating-end {
  color: var(--text-tertiary, #94a3b8);
  font-size: 11px;
  text-align: center;
}

.mobile-detail-section {
  padding: 16px;
}

.mobile-detail-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mobile-detail-section h2 {
  margin: 0 0 11px;
  color: var(--text-primary, #1f2937);
  font-size: 16px;
}

.mobile-detail-section-heading h2 {
  margin-bottom: 0;
}

.mobile-detail-section h2 i {
  margin-right: 6px;
  color: var(--brand-primary, #10b981);
  font-size: 14px;
}

.mobile-detail-section-heading > span {
  color: var(--text-tertiary, #94a3b8);
  font-size: 12px;
}

.mobile-detail-description,
.mobile-detail-summary {
  margin: 0;
  color: var(--text-secondary, #475569);
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.mobile-detail-screenshots {
  display: flex;
  min-width: 0;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-detail-screenshots::-webkit-scrollbar {
  display: none;
}

.mobile-detail-screenshot {
  flex: 0 0 142px;
  width: 142px;
  height: 214px;
  border-radius: 12px;
}

.mobile-detail-dynamic-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.mobile-detail-dynamic-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 12px;
  background: var(--surface-hover, #f8fafc);
}

.mobile-detail-dynamic-item strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-detail-dynamic-item span {
  flex: 0 0 auto;
  color: var(--text-tertiary, #94a3b8);
  font-size: 11px;
}

.mobile-detail-muted {
  margin: 12px 0 0;
  color: var(--text-tertiary, #94a3b8);
  font-size: 13px;
}

.mobile-detail-summary + .mobile-detail-dynamic-list {
  margin-top: 12px;
}

.mobile-detail-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 55vh;
  flex-direction: column;
  gap: 8px;
  color: var(--text-secondary, #64748b);
  text-align: center;
}

.mobile-detail-state > i {
  margin-bottom: 4px;
  color: var(--brand-primary, #10b981);
  font-size: 28px;
}

.mobile-detail-state strong {
  color: var(--text-primary, #334155);
  font-size: 16px;
}

.mobile-detail-state span {
  max-width: 280px;
  font-size: 13px;
}

.mobile-detail-state.is-error > i {
  color: #ef4444;
}

.mobile-detail-state .mobile-detail-button {
  min-width: 112px;
  margin-top: 8px;
}

@media (max-width: 360px) {
  .mobile-detail-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 12px;
  }
}
</style>
