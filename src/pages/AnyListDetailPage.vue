<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="top-nav-bar">
      <div class="nav-title-box">
        <span class="nav-title">清单详情</span>
      </div>
      <div class="nav-right-actions">
        <button class="btn-create-album" @click="openCreate">创建清单</button>
      </div>
    </div>

    <div v-if="loading" class="state-wrapper">
      <LoadingState text="正在加载清单详情..." />
    </div>

    <div v-else-if="error" class="state-wrapper">
      <ErrorState title="加载失败" message="无法获取该万物清单，可能已被删除或需要登录" @retry="loadDetail" />
    </div>

    <template v-else-if="albumTitle || albumItems.length">
      <div class="album-header-card">
        <div class="album-header-top">
          <AppImage
            v-if="albumCover"
            :src="albumCover"
            class="album-cover"
            fit="cover"
            :alt="albumTitle"
          />
          <div v-else class="album-cover album-cover-fallback">
            <i class="fas fa-list-ul"></i>
          </div>
          <div class="album-head-info">
            <h2 class="album-title">{{ albumTitle }}</h2>
            <p v-if="albumDescription" class="album-desc">{{ albumDescription }}</p>
            <div v-if="albumMetaText" class="album-meta">{{ albumMetaText }}</div>
          </div>
        </div>
      </div>

      <div v-if="feedMessage" class="feed-detail-box">
        <FeedCard :feed="feedDetail" @deleted="handleFeedDeleted" />
      </div>

      <div v-if="albumItems.length" class="album-section-card">
        <h3 class="section-title">清单商品（{{ albumItems.length }}）</h3>
        <div class="item-list">
          <div v-for="(item, index) in albumItems" :key="item.id || item.item_id || index" class="album-item">
            <AppImage
              v-if="itemLogo(item)"
              :src="itemLogo(item)"
              class="item-logo"
              fit="cover"
              :alt="itemName(item)"
            />
            <div v-else class="item-logo item-logo-fallback">
              <i class="fas fa-box"></i>
            </div>
            <div class="item-info">
              <span class="item-name">{{ itemName(item) }}</span>
              <span v-if="itemDesc(item)" class="item-desc">{{ itemDesc(item) }}</span>
            </div>
            <span class="item-rank">#{{ index + 1 }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="!feedMessage" class="empty-wrapper">
        <EmptyState title="清单暂无商品" description="该清单还没有添加任何商品条目" />
      </div>
    </template>

    <div v-else class="empty-wrapper">
      <EmptyState title="未找到该清单" description="该清单可能已被删除或ID不正确" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import FeedCard from '../components/feed/FeedCard.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';
import type { AnyListAlbum, AnyListItem } from '../types/anylist';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const albumId = ref(route.params.listId as string);
const loading = ref(false);
const error = ref(false);

const albumInfo = ref<AnyListAlbum | null>(null);
const goodsItems = ref<AnyListItem[]>([]);
const feedDetail = ref<any>(null);

const myUid = computed(() => String(authStore.user?.uid || ''));

const albumTitle = computed(() => albumInfo.value?.title || feedDetail.value?.title || '万物清单');
const albumDescription = computed(() => albumInfo.value?.description || '');
const albumCover = computed(() => albumInfo.value?.pic || albumInfo.value?.cover || albumInfo.value?.logo || '');

const albumMetaText = computed(() => {
  const info = albumInfo.value;
  if (!info) return '';
  const count = Array.isArray(info.productItems) ? info.productItems.length : 0;
  const parts: string[] = [];
  if (count > 0) parts.push(`${count} 件商品`);
  const raw = info.update_time ?? info.updateTime ?? info.create_time ?? info.createTime;
  if (raw) {
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) {
      const date = new Date(num * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      parts.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
    }
  }
  return parts.join(' · ');
});

const feedMessage = computed(() => {
  const feed = feedDetail.value;
  return feed?.message || feed?.title || '';
});

const albumItems = computed<AnyListItem[]>(() => {
  const fromAlbum = Array.isArray(albumInfo.value?.productItems) ? albumInfo.value!.productItems! : [];
  const merged = [...fromAlbum, ...goodsItems.value];
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = String(item.item_id || item.id || item.item_name || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

function itemLogo(item: AnyListItem): string {
  return item.item_logo || item.pic || item.logo || '';
}

function itemName(item: AnyListItem): string {
  return item.item_name || item.title || item.name || '未命名商品';
}

function itemDesc(item: AnyListItem): string {
  return item.item_description || item.description || '';
}

async function loadDetail() {
  if (!albumId.value) return;
  loading.value = true;
  error.value = false;
  albumInfo.value = null;
  goodsItems.value = [];
  feedDetail.value = null;
  try {
    const feedPromise = CoolapkTauriAPI.getFeedDetail(albumId.value).catch(() => null);

    let album: AnyListAlbum | null = null;
    if (myUid.value) {
      const res = await CoolapkTauriAPI.getUserProductAlbums(myUid.value, 1).catch(() => null);
      const list = (res && res.data && Array.isArray(res.data)) ? res.data : [];
      album = list.find((item: any) => String(item.id || item.entityId) === albumId.value) || null;
    }
    albumInfo.value = album;

    if (myUid.value) {
      const itemsRes = await CoolapkTauriAPI.getGoodsListItems(myUid.value, albumId.value, 1).catch(() => null);
      const items = (itemsRes && itemsRes.data && Array.isArray(itemsRes.data)) ? itemsRes.data : [];
      goodsItems.value = items;
    }

    const feedRes = await feedPromise;
    if (feedRes?.data && typeof feedRes.data === 'object') {
      feedDetail.value = feedRes.data;
    }
  } catch (err) {
    error.value = true;
    console.warn('获取清单详情失败', err);
  } finally {
    loading.value = false;
  }
}

function handleFeedDeleted(id: string | number) {
  if (feedDetail.value && String(feedDetail.value.id) === String(id)) {
    feedDetail.value = null;
  }
}

function openCreate() {
  router.push({ path: '/anylist/create' });
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    // 详情页当前无分页列表，预留滚动占位
  }
}

void loadDetail();
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width, 860px);
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.top-nav-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  margin-bottom: 2px;
}

.nav-title-box {
  flex: 1;
  text-align: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--brand-primary, #10b981);
}

.nav-right-actions {
  flex-shrink: 0;
}

.btn-create-album {
  height: 30px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-create-album:hover {
  border-color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.state-wrapper {
  padding: var(--space-10) 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.album-header-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.album-header-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.album-cover {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--background-secondary);
}

.album-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: var(--brand-primary);
  background: linear-gradient(135deg, var(--brand-soft), var(--brand-soft-hover));
}

.album-head-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.album-title {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.album-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin: 0;
}

.album-meta {
  color: var(--text-tertiary);
  font-size: 12px;
}

.feed-detail-box {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.album-section-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.album-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background-color: var(--background);
  border-radius: 10px;
}

.item-logo {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--background-secondary);
}

.item-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--text-tertiary);
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.item-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-rank {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--brand-primary);
}

.empty-wrapper {
  padding: var(--space-8) 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>