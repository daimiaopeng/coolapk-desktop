<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="page-header">
      <div class="header-main">
        <div class="header-titles">
          <h2 class="page-title">
            <i class="far fa-bookmark icon"></i> 我的收藏
          </h2>
          <span class="page-subtitle">同步自酷安账号的真实收藏</span>
        </div>

        <div v-if="authStore.isLoggedIn" class="header-actions">
          <AppButton
            variant="secondary"
            size="sm"
            icon="fas fa-sync-alt"
            :loading="loading"
            @click="fetchCloudFavorites(true)"
          >
            刷新收藏
          </AppButton>
        </div>
      </div>

      <!-- 分类快捷标签栏 -->
      <div v-if="authStore.isLoggedIn" class="category-tabs">
        <button
          :class="['cat-tab', { active: activeSubTab === 'all' }]"
          @click="switchSubTab('all')"
        >
          <i class="far fa-bookmark"></i> 全部收藏
        </button>
        <button
          :class="['cat-tab', { active: activeSubTab === 'collections' }]"
          @click="switchSubTab('collections')"
        >
          <i class="fas fa-folder-open"></i> 收藏单
        </button>
      </div>
    </div>

    <!-- 云端收藏：酷安账号真实收藏 -->
    <div v-if="!authStore.isLoggedIn" class="empty-wrapper">
      <EmptyState title="登录后查看云端收藏" description="登录酷安账号后，此处将同步展示您在酷安上真实收藏的动态" />
      <div class="login-hint">
        <AppButton variant="primary" size="sm" @click="authStore.openLoginModal()">立即登录</AppButton>
      </div>
    </div>

    <template v-else>

        <!-- 收藏单内容视图 -->
        <div v-if="activeSubTab === 'collections' && activeCollectionId" class="collection-detail">
          <div class="collection-detail-header">
            <span class="collection-detail-title">{{ activeCollectionTitle }}</span>
          </div>

          <div class="collection-detail-info">
            <AppImage
              v-if="collectionDetail.cover"
              :src="collectionDetail.cover"
              class="collection-detail-cover"
              fit="cover"
              :alt="collectionDetail.title || activeCollectionTitle"
            />
            <div v-else class="collection-detail-cover collection-detail-cover-fallback">
              <i class="fas fa-folder-open"></i>
            </div>
            <div class="collection-detail-main">
              <span class="collection-detail-name">{{ collectionDetail.title || activeCollectionTitle }}</span>
              <span v-if="collectionDetail.description" class="collection-detail-desc">{{ collectionDetail.description }}</span>
              <div class="collection-detail-stats">
                <span class="stat-item"><i class="fas fa-heart"></i> {{ collectionFavnum }} 收藏</span>
                <span class="stat-item"><i class="fas fa-user-plus"></i> {{ collectionFollownum }} 关注</span>
                <span class="stat-item"><i class="fas fa-file-alt"></i> {{ collectionItemNum }} 内容</span>
              </div>
            </div>
            <div class="collection-detail-actions">
              <AppButton
                variant="secondary"
                size="sm"
                :icon="collectionFollowed ? 'fas fa-check' : 'fas fa-plus'"
                :loading="collectionFollowPending"
                @click="toggleFollowCollection"
              >
                {{ collectionFollowed ? '已关注' : '关注' }}
              </AppButton>
              <AppButton
                variant="soft"
                size="sm"
                :icon="collectionLiked ? 'fas fa-thumbs-up' : 'far fa-thumbs-up'"
                :loading="collectionLikePending"
                @click="toggleLikeCollection"
              >
                {{ collectionLiked ? '已点赞' : '点赞' }}
              </AppButton>
            </div>
          </div>

          <div v-if="collectionItemsLoading && collectionItems.length === 0" class="loading-wrapper">
            <LoadingState text="正在获取收藏单内容..." />
          </div>

          <div v-else-if="collectionItemsError && collectionItems.length === 0" class="error-wrapper">
            <ErrorState title="内容加载失败" :message="collectionItemsError" @retry="fetchCollectionItems(true)" />
          </div>

          <div v-else-if="collectionItems.length === 0 && !collectionItemsLoading" class="empty-wrapper">
            <EmptyState title="收藏单暂无内容" />
          </div>

          <div v-else class="feed-list">
            <FeedCard v-for="item in collectionItems" :key="item.id" :feed="item" @deleted="handleFeedDeleted" />
            <div class="pagination-footer">
              <LoadingState v-if="collectionItemsLoadingMore" text="加载更多中..." />
              <div v-else-if="collectionItemsNoMore" class="no-more">没有更多内容了</div>
            </div>
          </div>
        </div>

        <!-- 收藏单列表视图 -->
        <div v-else-if="activeSubTab === 'collections'" class="collection-grid">
          <div v-if="collectionsLoading" class="loading-wrapper">
            <LoadingState text="正在获取收藏单..." />
          </div>

          <div v-else-if="collections.length === 0" class="empty-wrapper">
            <EmptyState title="暂无收藏单" description="在酷安上创建的收藏单会显示在这里" />
          </div>

          <div v-else class="collection-cards">
            <div
              v-for="collection in collections"
              :key="collection.id"
              class="collection-card"
              @click="openCollection(collection)"
            >
              <AppImage
                v-if="collection.cover"
                :src="collection.cover"
                class="collection-cover"
                fit="cover"
                :alt="collection.title"
              />
              <div v-else class="collection-cover collection-cover-fallback">
                <i class="fas fa-folder-open"></i>
              </div>
              <div class="collection-info">
                <span class="collection-title">{{ collection.title }}</span>
                <span class="collection-meta">
                  <template v-if="collection.itemNum">{{ collection.itemNum }} 条内容</template>
                  <template v-else>收藏单</template>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 全部收藏视图 -->
        <template v-else>
          <div v-if="loading && cloudFeeds.length === 0" class="loading-wrapper">
            <LoadingState text="正在获取云端收藏..." />
          </div>

          <div v-else-if="cloudError && cloudFeeds.length === 0" class="error-wrapper">
            <ErrorState title="收藏加载失败" :message="cloudError" @retry="fetchCloudFavorites(true)" />
          </div>

          <div v-else-if="cloudFeeds.length === 0 && !loading" class="empty-wrapper">
            <EmptyState title="暂无云端收藏" description="在酷安上收藏过的动态将显示在这里" />
          </div>

          <div v-else class="feed-list">
            <FeedCard v-for="item in cloudFeeds" :key="item.id" :feed="item" @deleted="handleFeedDeleted" />
            <div class="pagination-footer">
              <LoadingState v-if="loadingMore" text="加载更多收藏中..." />
              <div v-else-if="noMore" class="no-more">没有更多收藏了</div>
            </div>
          </div>
        </template>
      </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FeedCard from '../components/feed/FeedCard.vue';
import AppButton from '../components/common/AppButton.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const activeSubTab = ref<'all' | 'collections'>('all');

const cloudFeeds = ref<any[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const cloudError = ref('');
const page = ref(1);
const noMore = ref(false);

const collections = ref<any[]>([]);
const collectionsLoading = ref(false);
const activeCollectionId = ref('');
const activeCollectionTitle = ref('');
const collectionItems = ref<any[]>([]);
const collectionItemsLoading = ref(false);
const collectionItemsLoadingMore = ref(false);
const collectionItemsError = ref('');
const collectionItemsPage = ref(1);
const collectionItemsNoMore = ref(false);
const collectionDetail = ref<any>({});
const collectionFavnum = ref(0);
const collectionFollownum = ref(0);
const collectionItemNum = ref(0);
const collectionFollowed = ref(false);

function handleFeedDeleted(id: string | number) {
  const filter = (list: any[]) => list.filter((f: any) => String(f.id) !== String(id));
  cloudFeeds.value = filter(cloudFeeds.value);
  collectionItems.value = filter(collectionItems.value);
}
const collectionLiked = ref(false);
const collectionFollowPending = ref(false);
const collectionLikePending = ref(false);

function firstValue(obj: any, keys: string[]) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function toBool(value: any) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function switchSubTab(tab: 'all' | 'collections') {
  if (activeSubTab.value === tab && !activeCollectionId.value) return;
  activeSubTab.value = tab;
  if (activeCollectionId.value) {
    resetCollectionState();
    const { collectionId: _collectionId, collectionTitle: _collectionTitle, ...query } = route.query;
    void router.push({ path: route.path, query });
  }
  if (tab === 'all') {
    if (cloudFeeds.value.length === 0) void fetchCloudFavorites(true);
  } else {
    if (collections.value.length === 0) void fetchCollections();
  }
}

async function fetchCollections() {
  const uid = authStore.user?.uid;
  if (!uid) return;
  collectionsLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getCollectionList(String(uid), 1);
    collections.value = (res && res.data && Array.isArray(res.data)) ? res.data : [];
  } catch (err) {
    console.warn('获取收藏单失败', err);
  } finally {
    collectionsLoading.value = false;
  }
}

function openCollection(collection: any) {
  void router.push({
    path: route.path,
    query: {
      ...route.query,
      collectionId: String(collection.id),
      collectionTitle: collection.title || '收藏单',
    },
  });
}

function activateCollection(collection: any) {
  activeCollectionId.value = String(collection.id);
  activeCollectionTitle.value = collection.title || '收藏单';
  collectionDetail.value = { ...collection };
  collectionFavnum.value = Number(firstValue(collection, ['favnum', 'favNum']) ?? 0);
  collectionFollownum.value = Number(firstValue(collection, ['follownum', 'followNum']) ?? 0);
  collectionItemNum.value = Number(firstValue(collection, ['itemNum']) ?? 0);
  collectionFollowed.value = toBool(firstValue(collection, ['isFollowed', 'isFollow', 'is_followed']));
  collectionLiked.value = toBool(firstValue(collection, ['isLiked', 'isLike', 'is_liked']));
  void fetchCollectionDetail();
  void fetchCollectionItems(true);
}

function resetCollectionState() {
  activeCollectionId.value = '';
  activeCollectionTitle.value = '';
  collectionDetail.value = {};
  collectionFavnum.value = 0;
  collectionFollownum.value = 0;
  collectionItemNum.value = 0;
  collectionFollowed.value = false;
  collectionLiked.value = false;
  collectionItems.value = [];
  collectionItemsPage.value = 1;
  collectionItemsNoMore.value = false;
}

watch(
  () => route.query.collectionId,
  (value) => {
    const collectionId = Array.isArray(value) ? value[0] : value;
    if (!collectionId) {
      if (activeCollectionId.value) resetCollectionState();
      return;
    }
    if (activeCollectionId.value === String(collectionId)) return;

    const titleValue = route.query.collectionTitle;
    const collectionTitle = Array.isArray(titleValue) ? titleValue[0] : titleValue;
    const source = collections.value.find(item => String(item.id) === String(collectionId)) || {
      id: String(collectionId),
      title: collectionTitle || '收藏单',
    };
    activeSubTab.value = 'collections';
    activateCollection(source);
  },
  { immediate: true }
);

function applyCollectionDetail(detail: any, fallback: any) {
  const source = detail && Object.keys(detail).length > 0 ? detail : fallback;
  collectionFavnum.value = Number(firstValue(source, ['favnum', 'favNum']) ?? collectionFavnum.value);
  collectionFollownum.value = Number(firstValue(source, ['follownum', 'followNum']) ?? collectionFollownum.value);
  collectionItemNum.value = Number(firstValue(source, ['itemNum']) ?? collectionItemNum.value);
  collectionFollowed.value = toBool(
    firstValue(source, ['isFollowed', 'isFollow', 'is_followed']) ??
    firstValue(source.userAction, ['isFollowed', 'isFollow'])
  );
  collectionLiked.value = toBool(
    firstValue(source, ['isLiked', 'isLike', 'is_liked']) ??
    firstValue(source.userAction, ['isLiked', 'isLike'])
  );
  if (!collectionDetail.value.title && source.title) {
    collectionDetail.value = { ...collectionDetail.value, title: source.title };
  }
  if (!collectionDetail.value.description && source.description) {
    collectionDetail.value = { ...collectionDetail.value, description: source.description };
  }
  if (!collectionDetail.value.cover && source.cover) {
    collectionDetail.value = { ...collectionDetail.value, cover: source.cover };
  }
}

async function fetchCollectionDetail() {
  if (!activeCollectionId.value) return;
  try {
    const res = await CoolapkTauriAPI.getCollectionDetail(activeCollectionId.value);
    const detail = res && res.data ? res.data : {};
    collectionDetail.value = { ...collectionDetail.value, ...detail };
    applyCollectionDetail(detail, collections.value.find(c => String(c.id) === activeCollectionId.value) || {});
  } catch (err) {
    console.warn('获取收藏单详情失败', err);
    applyCollectionDetail({}, collections.value.find(c => String(c.id) === activeCollectionId.value) || {});
  }
}

async function toggleFollowCollection() {
  if (!activeCollectionId.value || collectionFollowPending.value) return;
  collectionFollowPending.value = true;
  try {
    const action = collectionFollowed.value ? CoolapkTauriAPI.unfollowCollection : CoolapkTauriAPI.followCollection;
    const res = await action(activeCollectionId.value);
    if (res && res.code === 200) {
      collectionFollowed.value = !collectionFollowed.value;
      collectionFollownum.value = Math.max(0, collectionFollownum.value + (collectionFollowed.value ? 1 : -1));
    } else {
      console.warn('关注操作失败', res);
      alert('操作失败，请稍后重试');
    }
  } catch (err) {
    console.warn('关注操作失败', err);
    alert('操作失败，请检查网络');
  } finally {
    collectionFollowPending.value = false;
  }
}

async function toggleLikeCollection() {
  if (!activeCollectionId.value || collectionLikePending.value) return;
  collectionLikePending.value = true;
  try {
    const action = collectionLiked.value ? CoolapkTauriAPI.unlikeCollection : CoolapkTauriAPI.likeCollection;
    const res = await action(activeCollectionId.value);
    if (res && res.code === 200) {
      collectionLiked.value = !collectionLiked.value;
      collectionFavnum.value = Math.max(0, collectionFavnum.value + (collectionLiked.value ? 1 : -1));
    } else {
      console.warn('点赞操作失败', res);
      alert('操作失败，请稍后重试');
    }
  } catch (err) {
    console.warn('点赞操作失败', err);
    alert('操作失败，请检查网络');
  } finally {
    collectionLikePending.value = false;
  }
}

async function fetchCollectionItems(isRefresh = false) {
  if (!activeCollectionId.value) return;
  if (collectionItemsLoading.value || (collectionItemsLoadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    collectionItemsPage.value = 1;
    collectionItemsNoMore.value = false;
    collectionItems.value = [];
    collectionItemsLoading.value = true;
  } else {
    if (collectionItemsNoMore.value) return;
    collectionItemsLoadingMore.value = true;
  }
  collectionItemsError.value = '';

  try {
    const res = await CoolapkTauriAPI.getCollectionItemList(activeCollectionId.value, collectionItemsPage.value);
    const newItems = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (newItems.length === 0) {
      collectionItemsNoMore.value = true;
    } else {
      if (isRefresh) {
        collectionItems.value = newItems;
      } else {
        const existingIds = new Set(collectionItems.value.map(i => i.id));
        collectionItems.value.push(...newItems.filter((i: any) => !existingIds.has(i.id)));
      }
      collectionItemsPage.value++;
    }
  } catch (err: any) {
    collectionItemsError.value = err?.message || '加载失败，请检查网络';
  } finally {
    collectionItemsLoading.value = false;
    collectionItemsLoadingMore.value = false;
  }
}

async function fetchCloudFavorites(isRefresh = false) {
  const uid = authStore.user?.uid;
  if (!uid) return;
  if (loading.value || (loadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    cloudFeeds.value = [];
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  cloudError.value = '';

  try {
    const res = await CoolapkTauriAPI.getFavoriteList('feed', page.value);
    const newFeeds = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (newFeeds.length === 0) {
      noMore.value = true;
    } else {
      if (isRefresh) {
        cloudFeeds.value = newFeeds;
      } else {
        const existingIds = new Set(cloudFeeds.value.map(i => i.id));
        cloudFeeds.value.push(...newFeeds.filter((i: any) => !existingIds.has(i.id)));
      }
      page.value++;
    }
  } catch (err: any) {
    cloudError.value = err?.message || '加载失败，请检查网络';
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    if (activeSubTab.value === 'collections' && activeCollectionId.value) {
      if (!collectionItemsLoading.value && !collectionItemsLoadingMore.value && !collectionItemsNoMore.value) {
        fetchCollectionItems(false);
      }
    } else if (activeSubTab.value === 'all') {
      if (!loading.value && !loadingMore.value && !noMore.value) {
        fetchCloudFavorites(false);
      }
    }
  }
}

watch(
  () => authStore.user?.uid,
  () => {
    if (authStore.isLoggedIn) {
      void fetchCloudFavorites(true);
      void fetchCollections();
    }
  }
);

onMounted(() => {
  if (authStore.isLoggedIn) {
    void fetchCloudFavorites(true);
    void fetchCollections();
  }
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0;
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title .icon {
  color: var(--brand-primary);
}

.page-subtitle {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.category-tabs {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.cat-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cat-tab:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.cat-tab.active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

.collection-grid {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.collection-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-4);
  width: 100%;
}

.collection-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.collection-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.collection-cover {
  width: 100%;
  height: 110px;
  object-fit: cover;
  background-color: var(--background);
}

.collection-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: var(--brand-primary);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.2));
}

.collection-info {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.collection-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-meta {
  font-size: 12px;
  color: var(--text-tertiary);
}

.collection-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: var(--space-4);
}

.collection-detail-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-detail-info {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  margin-bottom: var(--space-4);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.collection-detail-cover {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 10px;
  background-color: var(--background);
}

.collection-detail-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--brand-primary);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.2));
}

.collection-detail-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.collection-detail-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-detail-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.collection-detail-stats {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 2px;
}

.stat-item {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-item i {
  color: var(--brand-primary);
  font-size: 11px;
}

.collection-detail-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.login-hint {
  margin-top: var(--space-3);
  text-align: center;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}
</style>
