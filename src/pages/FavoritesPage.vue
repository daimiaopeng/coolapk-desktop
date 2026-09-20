<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <!-- 分类快捷标签栏与操作栏 -->
    <div v-if="authStore.isLoggedIn" class="category-toolbar">
      <div class="category-tabs">
        <button
          :class="['cat-tab', { active: activeSubTab === 'all' }]"
          @click="switchSubTab('all')"
        >
          <i class="far fa-bookmark"></i>
          <span>全部收藏</span>
        </button>
        <button
          :class="['cat-tab', { active: activeSubTab === 'collections' }]"
          @click="switchSubTab('collections')"
        >
          <i class="fas fa-folder-open"></i>
          <span>收藏单</span>
          <span v-if="collections.length" class="tab-badge">{{ collections.length }}</span>
        </button>
      </div>

      <div v-if="activeSubTab === 'collections' && !activeCollectionId" class="toolbar-actions">
        <!-- 搜索筛选框 -->
        <div v-if="collections.length > 3" class="filter-search-wrap">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model.trim="collectionFilterKeyword"
            type="text"
            placeholder="搜索收藏单..."
            class="filter-search-input"
          />
          <button
            v-if="collectionFilterKeyword"
            class="search-clear-btn"
            title="清空搜索"
            @click="collectionFilterKeyword = ''"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <button class="btn-create-collection" @click="openCollectionEditor()">
          <i class="fas fa-plus"></i>
          <span>新建收藏单</span>
        </button>
      </div>
    </div>

    <!-- 云端收藏：未登录状态 -->
    <div v-if="!authStore.isLoggedIn" class="empty-wrapper">
      <EmptyState title="登录后查看云端收藏" description="登录酷安账号后，此处将同步展示您在酷安上真实收藏的动态" />
      <div class="login-hint">
        <AppButton variant="primary" size="sm" @click="authStore.openLoginModal()">立即登录</AppButton>
      </div>
    </div>

    <template v-else>
      <!-- 收藏单内容视图 (详情页) -->
      <div v-if="activeSubTab === 'collections' && activeCollectionId" class="collection-detail">
        <!-- 面包屑导航 -->
        <div class="collection-breadcrumb">
          <button class="breadcrumb-back-btn" @click="backToCollections">
            <i class="fas fa-arrow-left"></i>
            <span>返回收藏单列表</span>
          </button>
          <span class="breadcrumb-divider">/</span>
          <span class="breadcrumb-title">{{ collectionDetail.title || activeCollectionTitle }}</span>
        </div>

        <!-- 收藏单 Hero 信息卡 -->
        <div class="collection-hero-card">
          <div class="hero-cover-container">
            <AppImage
              v-if="collectionCover(collectionDetail)"
              :src="collectionCover(collectionDetail)"
              class="hero-cover"
              fit="cover"
              :alt="collectionDetail.title || activeCollectionTitle"
            />
            <div
              v-else
              class="hero-cover hero-cover-fallback"
              :style="{ background: getCollectionGradient(collectionDetail.title || activeCollectionTitle) }"
            >
              <i class="fas fa-folder-open"></i>
            </div>
          </div>

          <div class="hero-main-content">
            <div class="hero-title-row">
              <h2 class="hero-title">{{ collectionDetail.title || activeCollectionTitle }}</h2>
              <span v-if="isDefaultCollection(collectionDetail)" class="hero-tag tag-default">
                <i class="fas fa-crown"></i> 默认收藏单
              </span>
              <span v-else-if="collectionDetail.isOpen === 1 || collectionDetail.isOpen === true" class="hero-tag tag-public">
                <i class="fas fa-globe"></i> 公开
              </span>
              <span v-else-if="collectionDetail.isOpen === 0 || collectionDetail.isOpen === false" class="hero-tag tag-private">
                <i class="fas fa-lock"></i> 私密
              </span>
            </div>

            <p v-if="collectionDetail.description" class="hero-desc">{{ collectionDetail.description }}</p>

            <div class="hero-stats">
              <div class="stat-pill">
                <i class="fas fa-layer-group"></i>
                <span class="stat-value">{{ collectionItemNum }}</span>
                <span class="stat-label">内容</span>
              </div>
              <div class="stat-pill">
                <i class="fas fa-heart"></i>
                <span class="stat-value">{{ collectionFavnum }}</span>
                <span class="stat-label">收藏</span>
              </div>
              <div class="stat-pill">
                <i class="fas fa-user-plus"></i>
                <span class="stat-value">{{ collectionFollownum }}</span>
                <span class="stat-label">关注</span>
              </div>
            </div>
          </div>

          <div class="hero-actions-toolbar">
            <!-- 关注操作 -->
            <button
              type="button"
              :class="['toolbar-btn', 'btn-follow', { 'is-active': collectionFollowed }]"
              :disabled="collectionFollowPending"
              @click="toggleFollowCollection"
            >
              <i v-if="collectionFollowPending" class="fas fa-spinner fa-spin"></i>
              <i v-else :class="collectionFollowed ? 'fas fa-check' : 'fas fa-plus'"></i>
              <span>{{ collectionFollowed ? '已关注' : '关注' }}</span>
            </button>

            <!-- 点赞操作 -->
            <button
              type="button"
              :class="['toolbar-btn', 'btn-like', { 'is-active': collectionLiked }]"
              :disabled="collectionLikePending"
              @click="toggleLikeCollection"
            >
              <i v-if="collectionLikePending" class="fas fa-spinner fa-spin"></i>
              <i v-else :class="collectionLiked ? 'fas fa-thumbs-up' : 'far fa-thumbs-up'"></i>
              <span>{{ collectionLiked ? '已点赞' : '点赞' }}</span>
            </button>

            <!-- 编辑操作：仅非默认且有管理权限的收藏单展示 -->
            <button
              v-if="canManageCollection(collectionDetail)"
              type="button"
              class="toolbar-btn btn-edit"
              title="编辑收藏单"
              @click="openCollectionEditor(collectionDetail)"
            >
              <i class="fas fa-pen"></i>
              <span>编辑</span>
            </button>

            <!-- 方案 B：更多操作下拉菜单 (···) -->
            <div v-if="hasCollectionMoreActions" class="hero-more-menu-wrap">
              <button
                type="button"
                :class="['toolbar-btn', 'btn-more', { 'is-active': collectionMoreMenuOpen }]"
                title="更多操作"
                aria-label="更多操作"
                @click.stop="collectionMoreMenuOpen = !collectionMoreMenuOpen"
              >
                <i class="fas fa-ellipsis-h"></i>
              </button>

              <!-- 遮罩：点击外部收起下拉菜单 -->
              <div
                v-if="collectionMoreMenuOpen"
                class="hero-menu-backdrop"
                @click.stop="collectionMoreMenuOpen = false"
              ></div>

              <!-- 下拉气泡菜单 -->
              <transition name="menu-pop">
                <div v-if="collectionMoreMenuOpen" class="hero-dropdown-menu" @click.stop>
                  <button
                    type="button"
                    class="dropdown-menu-item"
                    :disabled="collectionCleanupPending"
                    @click="handleMenuCleanup"
                  >
                    <i v-if="collectionCleanupPending" class="fas fa-spinner fa-spin"></i>
                    <i v-else class="fas fa-broom"></i>
                    <span>清理失效内容</span>
                  </button>

                  <template v-if="canManageCollection(collectionDetail)">
                    <div class="dropdown-menu-divider"></div>
                    <button
                      type="button"
                      class="dropdown-menu-item is-danger"
                      :disabled="collectionActionLoading"
                      @click="handleMenuDelete"
                    >
                      <i v-if="collectionActionLoading" class="fas fa-spinner fa-spin"></i>
                      <i v-else class="fas fa-trash-alt"></i>
                      <span>删除收藏单</span>
                    </button>
                  </template>
                </div>
              </transition>
            </div>
          </div>
        </div>

        <div v-if="collectionItemsLoading && collectionItems.length === 0" class="loading-wrapper">
          <LoadingState text="正在获取收藏单内容..." />
        </div>

        <div v-else-if="collectionItemsError && collectionItems.length === 0" class="error-wrapper">
          <ErrorState title="内容加载失败" :message="collectionItemsError" @retry="fetchCollectionItems(true)" />
        </div>

        <div v-else-if="collectionItems.length === 0 && !collectionItemsLoading" class="empty-wrapper">
          <EmptyState title="收藏单暂无内容" description="在此收藏单中收藏的动态将显示在这里" />
        </div>

        <div v-else class="feed-list">
          <div v-for="item in collectionItems" :key="item.id" class="collection-feed-item">
            <RatingCard
              v-if="isRatingFeedEntity(item)"
              :feed="item"
              cloud-favorite
              @favorite-changed="handleFavoriteChanged"
            />
            <FeedCard
              v-else
              :feed="item"
              cloud-favorite
              @deleted="handleFeedDeleted"
              @favorite-changed="handleFavoriteChanged"
            />
            <div v-if="collectionItemId(item)" class="collection-item-quick-action">
              <button
                type="button"
                class="btn-remove-collection-item"
                title="从当前收藏单移除"
                :disabled="collectionItemActionId === collectionItemId(item)"
                @click.stop="removeCollectionItem(item)"
              >
                <i v-if="collectionItemActionId === collectionItemId(item)" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-folder-minus"></i>
                <span>移出收藏单</span>
              </button>
            </div>
          </div>
          <div class="pagination-footer">
            <LoadingState v-if="collectionItemsLoadingMore" text="加载更多中..." />
            <div v-else-if="collectionItemsNoMore" class="no-more">没有更多内容了</div>
          </div>
        </div>
      </div>

      <!-- 收藏单列表视图 (卡片网格) -->
      <div v-else-if="activeSubTab === 'collections'" class="collection-grid-view">
        <div v-if="collectionsLoading" class="loading-wrapper">
          <LoadingState text="正在获取收藏单..." />
        </div>

        <div v-else-if="collections.length === 0" class="empty-wrapper">
          <EmptyState title="暂无收藏单" description="在酷安上创建的收藏单会显示在这里" />
        </div>

        <div v-else-if="filteredCollections.length === 0" class="empty-wrapper">
          <EmptyState
            title="未找到匹配的收藏单"
            :description="`没有找到包含 “${collectionFilterKeyword}” 的收藏单`"
          />
        </div>

        <div v-else class="collection-cards">
          <div
            v-for="collection in filteredCollections"
            :key="collection.id"
            class="collection-card"
            @click="openCollection(collection)"
          >
            <div class="collection-cover-wrapper">
              <AppImage
                v-if="collectionCover(collection)"
                :src="collectionCover(collection)"
                class="collection-cover-img"
                fit="cover"
                :alt="collection.title"
              />
              <div
                v-else
                class="collection-cover-fallback"
                :style="{ background: getCollectionGradient(collection.title || collection.id) }"
              >
                <div class="fallback-glass-icon">
                  <i class="fas fa-folder-open"></i>
                </div>
              </div>

              <!-- 封面状态角标 (左上角) -->
              <div class="cover-badge-group">
                <span v-if="isDefaultCollection(collection)" class="cover-badge badge-default">
                  <i class="fas fa-crown"></i> 默认
                </span>
                <span v-else-if="collection.isOpen === 1 || collection.isOpen === true" class="cover-badge badge-public">
                  <i class="fas fa-globe"></i> 公开
                </span>
                <span v-else-if="collection.isOpen === 0 || collection.isOpen === false" class="cover-badge badge-private">
                  <i class="fas fa-lock"></i> 私密
                </span>
              </div>

              <!-- 封面条目数角标 (右下角) -->
              <div class="cover-count-pill">
                <i class="fas fa-layer-group"></i>
                <span>{{ collection.itemNum ?? 0 }}</span>
              </div>

              <!-- 悬浮操作按钮组 (右上角，悬停浮现) -->
              <div v-if="canManageCollection(collection)" class="collection-card-actions">
                <button
                  type="button"
                  class="collection-action-btn"
                  title="编辑收藏单"
                  @click.stop="openCollectionEditor(collection)"
                >
                  <i class="fas fa-pen"></i>
                </button>
                <button
                  type="button"
                  class="collection-action-btn is-danger"
                  title="删除收藏单"
                  @click.stop="deleteCollection(collection)"
                >
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>

            <!-- 卡片信息区 -->
            <div class="collection-info">
              <div class="collection-title-wrap">
                <span class="collection-title" :title="collection.title">{{ collection.title }}</span>
              </div>

              <p v-if="collection.description" class="collection-desc" :title="collection.description">
                {{ collection.description }}
              </p>

              <div class="collection-meta-row">
                <span class="meta-item">
                  <i class="far fa-file-lines"></i>
                  <span>{{ collection.itemNum ? `${collection.itemNum} 条` : '0 条内容' }}</span>
                </span>
                <span v-if="collection.favnum || collection.favNum" class="meta-item">
                  <i class="far fa-heart"></i>
                  <span>{{ collection.favnum || collection.favNum }}</span>
                </span>
                <span v-if="collection.follownum || collection.followNum" class="meta-item">
                  <i class="far fa-user"></i>
                  <span>{{ collection.follownum || collection.followNum }}</span>
                </span>
              </div>
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
          <template v-for="item in cloudFeeds" :key="item.id">
            <RatingCard
              v-if="isRatingFeedEntity(item)"
              :feed="item"
              cloud-favorite
              @favorite-changed="handleFavoriteChanged"
            />
            <FeedCard
              v-else
              :feed="item"
              cloud-favorite
              @deleted="handleFeedDeleted"
              @favorite-changed="handleFavoriteChanged"
            />
          </template>
          <div class="pagination-footer">
            <LoadingState v-if="loadingMore" text="加载更多收藏中..." />
            <div v-else-if="noMore" class="no-more">没有更多收藏了</div>
          </div>
        </div>
      </template>
    </template>

    <!-- 编辑/新建收藏单弹窗 -->
    <AppDialog :is-open="collectionEditorOpen" :title="editingCollectionId ? '编辑收藏单' : '新建收藏单'" :width="500" :close-on-backdrop="!collectionActionLoading" @close="closeCollectionEditor">
      <form class="collection-form" @submit.prevent="saveCollection">
        <div class="form-item">
          <label class="form-label">标题 <span class="required-star">*</span></label>
          <input
            v-model.trim="collectionForm.title"
            required
            maxlength="80"
            placeholder="给收藏单起个名字"
            class="form-input"
          />
        </div>

        <div class="form-item">
          <label class="form-label">描述</label>
          <textarea
            v-model.trim="collectionForm.description"
            maxlength="300"
            rows="3"
            placeholder="可选，介绍这个收藏单的内容"
            class="form-textarea"
          ></textarea>
        </div>

        <div class="form-item">
          <label class="collection-visibility-toggle">
            <input v-model="collectionForm.isOpen" type="checkbox" />
            <div class="toggle-text">
              <span class="toggle-title">公开收藏单</span>
              <span class="toggle-subtitle">其他人可以查看和关注该收藏单</span>
            </div>
          </label>
        </div>

        <div class="form-item">
          <label class="form-label">封面</label>
          <div class="cover-upload-section">
            <div v-if="collectionForm.cover" class="cover-preview-wrapper">
              <AppImage :src="collectionForm.cover" class="collection-form-cover" fit="cover" alt="收藏单封面预览" />
              <button type="button" class="btn-remove-cover" title="清除封面" @click="collectionForm.cover = ''">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="upload-btn-wrap">
              <label class="btn-upload-file">
                <i v-if="collectionCoverUploading" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-cloud-arrow-up"></i>
                <span>{{ collectionForm.cover ? '更换封面' : '上传封面' }}</span>
                <input type="file" accept="image/*" :disabled="collectionActionLoading || collectionCoverUploading" @change="uploadCollectionCover" />
              </label>
              <span class="form-hint">支持 JPG、PNG 格式，不超过 10MB</span>
            </div>
          </div>
        </div>

        <p v-if="collectionActionError" class="form-error">{{ collectionActionError }}</p>
        <div class="dialog-actions">
          <AppButton variant="secondary" type="button" :disabled="collectionActionLoading" @click="closeCollectionEditor">取消</AppButton>
          <AppButton variant="primary" type="submit" :loading="collectionActionLoading">保存</AppButton>
        </div>
      </form>
    </AppDialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FeedCard from '../components/feed/FeedCard.vue';
import RatingCard from '../components/feed/RatingCard.vue';
import AppButton from '../components/common/AppButton.vue';
import AppDialog from '../components/common/AppDialog.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import { requestConfirmation } from '../utils/confirm';
import { getErrorMessage } from '../utils/errors';
import { showToast } from '../utils/toast';
import { isRatingFeedEntity } from '../utils/rating';

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
const firstItem = ref('');
const lastItem = ref('');

const collections = ref<any[]>([]);
const collectionsLoading = ref(false);
const collectionFilterKeyword = ref('');
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

const filteredCollections = computed(() => {
  const keyword = collectionFilterKeyword.value.trim().toLowerCase();
  if (!keyword) return collections.value;
  return collections.value.filter((item) => {
    const title = String(item?.title || item?.name || '').toLowerCase();
    const desc = String(item?.description || item?.summary || '').toLowerCase();
    return title.includes(keyword) || desc.includes(keyword);
  });
});

const COLLECTION_GRADIENTS = [
  'linear-gradient(135deg, #10b981 0%, #047857 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
  'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
  'linear-gradient(135deg, #64748b 0%, #334155 100%)',
];

function getCollectionGradient(titleOrId?: string): string {
  const str = String(titleOrId || '').trim();
  if (!str) return COLLECTION_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return COLLECTION_GRADIENTS[Math.abs(hash) % COLLECTION_GRADIENTS.length];
}

function handleFeedDeleted(id: string | number) {
  const filter = (list: any[]) => list.filter((f: any) => String(f.id) !== String(id));
  cloudFeeds.value = filter(cloudFeeds.value);
  collectionItems.value = filter(collectionItems.value);
}

function handleFavoriteChanged(payload: { id: string | number; favorited: boolean }) {
  if (payload.favorited) return;
  const filter = (list: any[]) => list.filter((f: any) => String(f.id) !== String(payload.id));
  cloudFeeds.value = filter(cloudFeeds.value);
  collectionItems.value = filter(collectionItems.value);
}
const collectionLiked = ref(false);
const collectionFollowPending = ref(false);
const collectionLikePending = ref(false);
const collectionEditorOpen = ref(false);
const editingCollectionId = ref('');
const collectionActionLoading = ref(false);
const collectionCoverUploading = ref(false);
const collectionCleanupPending = ref(false);
const collectionItemActionId = ref('');
const collectionActionError = ref('');
const collectionMoreMenuOpen = ref(false);
const collectionForm = ref({ title: '', description: '', cover: '', isOpen: true });

function firstValue(obj: any, keys: string[]) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function toBool(value: any) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function collectionId(collection: any): string { return String(collection?.id || collection?.collectionId || collection?.entityId || '').trim(); }
function collectionCover(collection: any): string { return String(firstValue(collection, ['cover', 'coverPic', 'cover_pic', 'pic', 'logo']) || '').trim(); }
function isDefaultCollection(collection: any): boolean {
  if (toBool(firstValue(collection, ['defaultCollected', 'default_collected', 'isDefault', 'is_default', 'isDefaultCollection']))) return true;
  const title = String(collection?.title || collection?.name || '').trim().toLowerCase();
  return (
    title === '默认收藏' ||
    title === '默认收藏夹' ||
    title === '默认收藏单' ||
    title.startsWith('默认收藏') ||
    title === 'default collection' ||
    title === 'default favorites'
  );
}
function isOwnerCollection(collection: any): boolean {
  if (!collectionId(collection)) return false;
  const ownerUid = String(firstValue(collection, ['uid', 'userId', 'user_id']) || collection?.userInfo?.uid || '').trim();
  const myUid = String(authStore.user?.uid || '').trim();
  return !ownerUid || !myUid || ownerUid === myUid;
}
function canManageCollection(collection: any): boolean {
  if (!collectionId(collection) || isDefaultCollection(collection)) return false;
  return isOwnerCollection(collection);
}

const hasCollectionMoreActions = computed(() => {
  return isOwnerCollection(collectionDetail.value);
});

function handleMenuCleanup() {
  collectionMoreMenuOpen.value = false;
  void clearInvalidCollectionItems();
}

function handleMenuDelete() {
  collectionMoreMenuOpen.value = false;
  void deleteCollection(collectionDetail.value);
}
function collectionItemId(item: any): string {
  return String(
    item?.collectionItem?.id ||
    item?.collectionItem?.itemId ||
    item?.collectionItem?.item_id ||
    item?.collection_item_info?.id ||
    item?.collection_item_info?.itemId ||
    item?.collection_item_info?.item_id ||
    item?.collectionItemId ||
    item?.collection_item_id ||
    ''
  ).trim();
}
function responseData(response: any): any { return response?.data?.data ?? response?.data ?? response; }

function backToCollections() {
  resetCollectionState();
  const { collectionId: _collectionId, collectionTitle: _collectionTitle, ...query } = route.query;
  void router.push({ path: route.path, query });
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
    // 酷安 APK 的“我的收藏单”调用使用空 uid，让服务端按当前会话返回默认收藏单。
    // 显式传当前 uid 会只返回用户创建的收藏单，即使 showDefault=1 也不会带默认单。
    const res = await CoolapkTauriAPI.getCollectionList('', 1);
    collections.value = (res && res.data && Array.isArray(res.data)) ? res.data : [];
  } catch (err) {
    console.warn('获取收藏单失败', err);
  } finally {
    collectionsLoading.value = false;
  }
}

function openCollectionEditor(collection?: any) {
  const id = collectionId(collection);
  const openValue = firstValue(collection, ['isOpen', 'is_open', 'isOpened', 'is_opened']);
  editingCollectionId.value = id;
  collectionForm.value = {
    title: String(collection?.title || collection?.name || '').trim(),
    description: String(collection?.description || collection?.summary || '').trim(),
    cover: collectionCover(collection),
    isOpen: openValue === undefined ? true : toBool(openValue),
  };
  collectionActionError.value = '';
  collectionEditorOpen.value = true;
}

function closeCollectionEditor() {
  if (collectionActionLoading.value || collectionCoverUploading.value) return;
  collectionEditorOpen.value = false;
  collectionActionError.value = '';
}

async function uploadCollectionCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    collectionActionError.value = '请选择图片文件';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    collectionActionError.value = '封面不能超过 10MB';
    return;
  }
  collectionCoverUploading.value = true;
  collectionActionError.value = '';
  try {
    const res: any = await CoolapkTauriAPI.uploadImage(new Uint8Array(await file.arrayBuffer()), file.name, file.type, 'feed_image');
    const data = responseData(res);
    const url = String(data?.url || data?.imageUrl || data || '').trim();
    if (!url) throw new Error('上传接口未返回图片地址');
    collectionForm.value.cover = url;
    showToast('封面上传成功', 'success');
  } catch (err) {
    collectionActionError.value = getErrorMessage(err, '封面上传失败');
    showToast(collectionActionError.value, 'error');
  } finally {
    collectionCoverUploading.value = false;
  }
}

async function saveCollection() {
  const title = collectionForm.value.title.trim();
  if (!title) {
    collectionActionError.value = '收藏单标题不能为空';
    return;
  }
  if (collectionActionLoading.value || collectionCoverUploading.value) return;
  collectionActionLoading.value = true;
  collectionActionError.value = '';
  try {
    const description = collectionForm.value.description.trim();
    const cover = collectionForm.value.cover.trim();
    const isOpen = collectionForm.value.isOpen ? 1 : 0;
    const saved = editingCollectionId.value
      ? await CoolapkTauriAPI.updateCollection(editingCollectionId.value, title, description, cover, isOpen)
      : await CoolapkTauriAPI.createCollection({ title, description, cover, isOpen, sourceId: '' });
    const savedData = responseData(saved);
    const savedId = String(savedData?.id || savedData?.collectionId || editingCollectionId.value || '').trim();
    if (editingCollectionId.value) {
      const targetId = editingCollectionId.value;
      const index = collections.value.findIndex(item => collectionId(item) === targetId);
      const updated = { ...(index >= 0 ? collections.value[index] : {}), ...(savedData && typeof savedData === 'object' ? savedData : {}), id: targetId, title, description, cover, isOpen };
      if (index >= 0) collections.value[index] = updated;
      if (activeCollectionId.value === targetId) {
        collectionDetail.value = { ...collectionDetail.value, ...updated };
        activeCollectionTitle.value = title;
      }
    }
    collectionEditorOpen.value = false;
    await fetchCollections();
    if (savedId && activeCollectionId.value === savedId) await fetchCollectionDetail();
    showToast(editingCollectionId.value ? '收藏单已更新' : '收藏单已创建', 'success');
  } catch (err) {
    collectionActionError.value = getErrorMessage(err, editingCollectionId.value ? '更新收藏单失败' : '创建收藏单失败');
    showToast(collectionActionError.value, 'error');
  } finally {
    collectionActionLoading.value = false;
  }
}

async function deleteCollection(collection: any) {
  const id = collectionId(collection);
  if (!id || !canManageCollection(collection) || collectionActionLoading.value) return;
  const confirmed = await requestConfirmation({ title: '删除收藏单', message: `确定删除“${collection?.title || activeCollectionTitle.value || '收藏单'}”吗？删除后会取消其中内容的归属。`, confirmText: '删除', danger: true });
  if (!confirmed) return;
  collectionActionLoading.value = true;
  try {
    await CoolapkTauriAPI.deleteCollection(id);
    collections.value = collections.value.filter(item => collectionId(item) !== id);
    if (activeCollectionId.value === id) backToCollections();
    showToast('收藏单已删除', 'success');
  } catch (err) {
    showToast(getErrorMessage(err, '删除收藏单失败'), 'error');
  } finally {
    collectionActionLoading.value = false;
  }
}

async function clearInvalidCollectionItems() {
  if (!activeCollectionId.value || collectionCleanupPending.value) return;
  const confirmed = await requestConfirmation({ title: '清理失效内容', message: '确定清理这个收藏单中的失效内容吗？酷安会在后台处理，通常需要几分钟。', confirmText: '确认清理', danger: true });
  if (!confirmed) return;
  collectionCleanupPending.value = true;
  try {
    await CoolapkTauriAPI.clearCollectionInvalidItems(activeCollectionId.value);
    showToast('清理请求已提交', 'success');
    await fetchCollectionItems(true);
  } catch (err) {
    showToast(getErrorMessage(err, '清理失效内容失败'), 'error');
  } finally {
    collectionCleanupPending.value = false;
  }
}

async function removeCollectionItem(item: any) {
  const itemId = collectionItemId(item);
  if (!itemId || collectionItemActionId.value) return;
  const confirmed = await requestConfirmation({ title: '移除收藏内容', message: '确定只从当前收藏单移除这条内容吗？原内容不会被删除。', confirmText: '移除', danger: true });
  if (!confirmed) return;
  collectionItemActionId.value = itemId;
  try {
    await CoolapkTauriAPI.removeCollectionItem(itemId);
    collectionItems.value = collectionItems.value.filter(current => collectionItemId(current) !== itemId);
    collectionItemNum.value = Math.max(0, collectionItemNum.value - 1);
    const current = collections.value.find(collection => collectionId(collection) === activeCollectionId.value);
    if (current) current.itemNum = collectionItemNum.value;
    showToast('已从收藏单移除', 'success');
  } catch (err) {
    showToast(getErrorMessage(err, '移除收藏内容失败'), 'error');
  } finally {
    collectionItemActionId.value = '';
  }
}

function openCollection(collection: any) {
  const id = collectionId(collection);
  if (!id) return;
  void router.push({
    path: route.path,
    query: {
      ...route.query,
      collectionId: id,
      collectionTitle: collection.title || '收藏单',
    },
  });
}

function activateCollection(collection: any) {
  activeCollectionId.value = collectionId(collection);
  activeCollectionTitle.value = collection.title || '收藏单';
  collectionDetail.value = { ...collection };
  collectionFavnum.value = Number(firstValue(collection, ['favnum', 'favNum']) ?? 0);
  collectionFollownum.value = Number(firstValue(collection, ['follownum', 'followNum']) ?? 0);
  collectionItemNum.value = Number(firstValue(collection, ['itemNum', 'feedNum']) ?? 0);
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
  collectionMoreMenuOpen.value = false;
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
  if (!collectionCover(collectionDetail.value) && collectionCover(source)) {
    collectionDetail.value = { ...collectionDetail.value, cover: collectionCover(source) };
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
    firstItem.value = '';
    lastItem.value = '';
    cloudFeeds.value = [];
    loading.value = true;
  } else {
    if (noMore.value) return;
    loadingMore.value = true;
  }
  cloudError.value = '';

  try {
    const res = await CoolapkTauriAPI.getFavoriteList('feed', page.value, firstItem.value, lastItem.value);
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
      firstItem.value = String(cloudFeeds.value[0]?.id || '');
      lastItem.value = String(cloudFeeds.value[cloudFeeds.value.length - 1]?.id || '');
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

/* 顶部工具栏与选项卡 */
.category-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
}

.category-tabs {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.cat-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  font-size: var(--font-size-sub);
  font-weight: 550;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.cat-tab:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--border-light);
}

.cat-tab.active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(16, 183, 104, 0.12);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 7px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: var(--radius-pill);
  background: rgba(16, 183, 104, 0.15);
  color: var(--brand-primary);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.filter-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 200px;
}

.filter-search-wrap .search-icon {
  position: absolute;
  left: 11px;
  color: var(--text-tertiary);
  font-size: 12.5px;
  pointer-events: none;
}

.filter-search-input {
  width: 100%;
  height: 34px;
  padding: 0 28px 0 32px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all 0.18s ease;
}

.filter-search-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.search-clear-btn {
  position: absolute;
  right: 8px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  font-size: 11px;
}

.search-clear-btn:hover {
  color: var(--text-primary);
}

.btn-create-collection {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 16px;
  background: linear-gradient(135deg, var(--brand-primary), #0ea05b);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-pill);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(16, 185, 102, 0.25);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-create-collection:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(16, 185, 102, 0.35);
  filter: brightness(1.05);
}

.btn-create-collection:active {
  transform: translateY(0);
}

/* 收藏单卡片网格 */
.collection-grid-view {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.collection-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: var(--space-4);
  width: 100%;
}

.collection-card {
  position: relative;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.collection-card:hover {
  transform: translateY(-4px);
  border-color: rgba(16, 183, 104, 0.4);
  box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.03);
}

.collection-cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background-color: var(--background-secondary);
  overflow: hidden;
  border-bottom: 1px solid var(--border-light);
}

.collection-cover-img {
  width: 100%;
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.collection-card:hover .collection-cover-img {
  transform: scale(1.04);
}

.collection-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.collection-card:hover .collection-cover-fallback {
  transform: scale(1.04);
}

.fallback-glass-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.cover-badge-group {
  position: absolute;
  top: 9px;
  left: 9px;
  display: flex;
  gap: 6px;
  z-index: 1;
}

.cover-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.cover-badge.badge-default {
  background: rgba(16, 185, 129, 0.85);
  color: #ffffff;
}

.cover-badge.badge-public {
  background: rgba(0, 0, 0, 0.45);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.cover-badge.badge-private {
  background: rgba(0, 0, 0, 0.55);
  color: #fcd34d;
  border: 1px solid rgba(252, 211, 77, 0.3);
}

.cover-count-pill {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 550;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  z-index: 1;
}

.collection-card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transform: translateY(-3px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 2;
}

.collection-card:hover .collection-card-actions {
  opacity: 1;
  transform: translateY(0);
}

.collection-action-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.16s ease;
  font-size: 12px;
}

.collection-action-btn:hover {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  transform: scale(1.08);
}

.collection-action-btn.is-danger:hover {
  background: var(--danger);
  border-color: var(--danger);
  transform: scale(1.08);
}

.collection-info {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.collection-title-wrap {
  display: flex;
  align-items: center;
}

.collection-title {
  font-size: 14.5px;
  font-weight: 650;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.35;
  transition: color 0.15s ease;
}

.collection-card:hover .collection-title {
  color: var(--brand-primary);
}

.collection-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 2px;
}

.meta-item {
  font-size: 12px;
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 详情页面包屑与 Hero Header */
.collection-detail {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.collection-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--space-4);
  font-size: 13.5px;
}

.breadcrumb-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 4px 8px;
  margin-left: -8px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 550;
  transition: all 0.16s ease;
}

.breadcrumb-back-btn:hover {
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.breadcrumb-divider {
  color: var(--text-tertiary);
  font-size: 12px;
}

.breadcrumb-title {
  color: var(--text-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.collection-hero-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 18px 24px;
  margin-bottom: var(--space-5);
  background: linear-gradient(135deg, var(--surface) 0%, rgba(16, 185, 129, 0.025) 100%);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
}

.hero-cover-container {
  flex-shrink: 0;
  width: 84px;
  height: 84px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.15));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-cover {
  width: 100%;
  height: 100%;
}

.hero-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #ffffff;
}

.hero-main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.hero-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
}

.hero-tag.tag-default {
  background: rgba(16, 183, 104, 0.12);
  color: var(--brand-primary);
}

.hero-tag.tag-public {
  background: rgba(47, 128, 237, 0.12);
  color: #2f80ed;
}

.hero-tag.tag-private {
  background: rgba(245, 159, 0, 0.12);
  color: #d97706;
}

.hero-desc {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--background);
  border: 1px solid var(--border-light);
  font-size: 12.5px;
  color: var(--text-secondary);
}

.stat-pill i {
  color: var(--brand-primary);
  font-size: 11.5px;
}

.stat-value {
  font-weight: 650;
  color: var(--text-primary);
}

.stat-label {
  color: var(--text-tertiary);
  font-size: 12px;
}

/* Option B: 主操作突出 + 更多菜单收纳 (···) */
.hero-actions-toolbar {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--background);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  transform: translateY(-1px);
}

.toolbar-btn:active:not(:disabled) {
  transform: translateY(0);
}

.toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 关注按钮高亮 */
.toolbar-btn.btn-follow {
  background: linear-gradient(135deg, var(--brand-primary), #0ea05b);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(16, 185, 102, 0.25);
}

.toolbar-btn.btn-follow:hover:not(:disabled) {
  filter: brightness(1.06);
  color: #ffffff;
}

.toolbar-btn.btn-follow.is-active {
  background: var(--brand-soft);
  border-color: rgba(16, 183, 104, 0.3);
  color: var(--brand-primary);
  box-shadow: none;
}

/* 点赞按钮高亮 */
.toolbar-btn.btn-like.is-active {
  background: rgba(16, 183, 104, 0.12);
  border-color: rgba(16, 183, 104, 0.3);
  color: var(--brand-primary);
}

/* 更多按钮 (···) */
.toolbar-btn.btn-more {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  font-size: 13px;
}

.toolbar-btn.btn-more.is-active {
  background: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

/* 更多菜单容器与遮罩 */
.hero-more-menu-wrap {
  position: relative;
  display: inline-flex;
}

.hero-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: transparent;
}

.hero-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 100;
  min-width: 156px;
  padding: 6px;
  background: var(--surface-elevated, var(--surface));
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.14), 0 4px 10px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 2px;
  transform-origin: top right;
}

.dropdown-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.dropdown-menu-item:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--brand-primary);
}

.dropdown-menu-item i {
  width: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
  transition: color 0.15s ease;
}

.dropdown-menu-item:hover:not(:disabled) i {
  color: var(--brand-primary);
}

.dropdown-menu-item.is-danger {
  color: var(--danger, #ef4444);
}

.dropdown-menu-item.is-danger i {
  color: var(--danger, #ef4444);
}

.dropdown-menu-item.is-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger, #ef4444);
}

.dropdown-menu-item.is-danger:hover:not(:disabled) i {
  color: var(--danger, #ef4444);
}

.dropdown-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dropdown-menu-divider {
  height: 1px;
  background: var(--border-light, var(--border));
  margin: 4px 6px;
}

/* 菜单淡入弹出动效 */
.menu-pop-enter-active,
.menu-pop-leave-active {
  transition: opacity 0.16s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.95);
}

/* 详情列表与移除操作（浮动在卡片右上角，零占用空间） */
.collection-feed-item {
  position: relative;
  width: 100%;
}

.collection-item-quick-action {
  position: absolute;
  top: 14px;
  right: 52px;
  z-index: 5;
  display: flex;
  align-items: center;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.collection-feed-item:hover .collection-item-quick-action,
.collection-feed-item:focus-within .collection-item-quick-action {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

@media (hover: none) {
  .collection-item-quick-action {
    opacity: 0.8;
    pointer-events: auto;
  }
}

.btn-remove-collection-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-tertiary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.16s ease;
}

.btn-remove-collection-item:hover {
  color: var(--danger);
  background: rgba(240, 68, 68, 0.08);
  border-color: rgba(240, 68, 68, 0.3);
  transform: translateY(-1px);
}

/* 弹窗样式 */
.collection-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: var(--font-size-sub);
  font-weight: 600;
  color: var(--text-primary);
}

.required-star {
  color: var(--danger);
}

.form-input,
.form-textarea {
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--background);
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
  transition: all 0.16s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.collection-visibility-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-control);
  background: var(--background);
  border: 1px solid var(--border-light);
  cursor: pointer;
}

.collection-visibility-toggle input {
  margin-top: 3px;
  accent-color: var(--brand-primary);
  width: 16px;
  height: 16px;
}

.toggle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.toggle-subtitle {
  font-size: 12px;
  color: var(--text-tertiary);
}

.cover-upload-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cover-preview-wrapper {
  position: relative;
  width: 100%;
  max-height: 160px;
  border-radius: var(--radius-control);
  overflow: hidden;
  border: 1px solid var(--border);
}

.collection-form-cover {
  width: 100%;
  height: 160px;
  object-fit: cover;
}

.btn-remove-cover {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  transition: background 0.15s ease;
}

.btn-remove-cover:hover {
  background: var(--danger);
}

.upload-btn-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-upload-file {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-control);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.16s ease;
}

.btn-upload-file input[type='file'] {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.btn-upload-file:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.form-hint {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
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

.loading-wrapper,
.error-wrapper,
.empty-wrapper {
  padding: var(--space-10) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
