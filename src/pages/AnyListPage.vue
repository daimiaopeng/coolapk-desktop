<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="top-nav-bar">
      <div class="nav-title-box">
        <span class="nav-title">万物清单</span>
      </div>
      <div class="nav-right-actions">
        <button class="btn-create-album" @click="openCreate">
          <i class="fas fa-plus"></i> 创建清单
        </button>
      </div>
    </div>

    <div v-if="!authStore.isLoggedIn" class="login-prompt">
      <EmptyState title="登录后查看万物清单" description="万物清单按账号维度保存，登录后可浏览和创建你的清单">
        <button class="btn-login" @click="authStore.openLoginModal()">立即登录</button>
      </EmptyState>
    </div>

    <template v-else>
      <div class="anylist-tabs custom-scrollbar">
        <button
          v-for="tab in listTabs"
          :key="tab.key"
          :class="['anylist-tab-item', { active: activeTab === tab.key }]"
          @click="selectTab(tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span v-if="activeTab === tab.key" class="tab-line"></span>
        </button>
      </div>

      <div v-if="loading && albums.length === 0" class="loading-wrapper">
        <LoadingState text="正在加载万物清单..." />
      </div>

      <div v-else-if="error && albums.length === 0" class="error-wrapper">
        <ErrorState title="加载失败" message="无法获取万物清单列表" @retry="refreshCurrent" />
      </div>

      <div v-else-if="albums.length === 0 && !loading" class="empty-wrapper">
        <EmptyState title="还没有万物清单" description="创建属于你的第一份产品清单吧">
          <button class="btn-create-album" @click="openCreate">
            <i class="fas fa-plus"></i> 创建清单
          </button>
        </EmptyState>
      </div>

      <div v-else class="album-list">
        <article
          v-for="album in albums"
          :key="album.id || album.entityId || album.title"
          class="album-card"
          @click="openAlbum(album)"
        >
          <div class="album-cover-wrapper">
            <AppImage
              v-if="albumCover(album)"
              :src="albumCover(album)"
              class="album-cover"
              fit="cover"
              :alt="album.title || '清单封面'"
            />
            <div v-else class="album-cover album-cover-fallback">
              <i class="fas fa-list-ul"></i>
            </div>
          </div>

          <div class="album-info">
            <h3 class="album-title">{{ album.title || '未命名清单' }}</h3>
            <p v-if="album.description" class="album-desc">{{ album.description }}</p>
            <div class="album-meta">
              <span v-if="albumItemCount(album)">
                <i class="fas fa-box"></i> {{ albumItemCount(album) }} 件商品
              </span>
              <span v-if="albumDateline(album)">
                <i class="fas fa-clock"></i> {{ albumDateline(album) }}
              </span>
            </div>
          </div>
          <i class="fas fa-chevron-right album-arrow"></i>
        </article>

        <div class="pagination-footer">
          <LoadingState v-if="loading && page > 1" text="加载更多中..." />
          <button v-else-if="error && albums.length > 0" class="retry-inline" @click="refreshCurrent">加载失败，点击重试</button>
          <div v-else-if="noMore" class="no-more">没有更多清单了</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';
import type { AnyListAlbum } from '../types/anylist';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref('mine');
const listTabs = [
  { key: 'mine', label: '我的清单' },
];

const albums = ref<AnyListAlbum[]>([]);
const page = ref(1);
const loading = ref(false);
const noMore = ref(false);
const error = ref(false);

const myUid = computed(() => String(authStore.user?.uid || ''));

function albumCover(album: AnyListAlbum): string {
  return album.pic || album.cover || album.logo || '';
}

function albumItemCount(album: AnyListAlbum): number {
  if (Array.isArray(album.productItems)) return album.productItems.length;
  return 0;
}

function albumDateline(album: AnyListAlbum): string {
  const raw = album.update_time ?? album.updateTime ?? album.create_time ?? album.createTime ?? album.dateline;
  if (!raw) return '';
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return '';
  const date = new Date(num * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function fetchAlbums(isLoadMore = false) {
  if (!myUid.value || loading.value || noMore.value) return;
  loading.value = true;
  if (!isLoadMore) error.value = false;
  try {
    const res = await CoolapkTauriAPI.getUserProductAlbums(myUid.value, page.value);
    const newList = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (newList.length === 0) {
      noMore.value = true;
    } else {
      if (isLoadMore) {
        albums.value.push(...newList);
      } else {
        albums.value = newList;
      }
      page.value++;
    }
  } catch (err) {
    error.value = true;
    console.warn('获取万物清单失败', err);
  } finally {
    loading.value = false;
  }
}

function selectTab(key: string) {
  if (activeTab.value === key) return;
  activeTab.value = key;
  page.value = 1;
  noMore.value = false;
  albums.value = [];
  void fetchAlbums(false);
}

function refreshCurrent() {
  page.value = 1;
  noMore.value = false;
  albums.value = [];
  void fetchAlbums(false);
}

function openAlbum(album: AnyListAlbum) {
  const id = album.id || album.entityId;
  if (id) {
    router.push({ path: `/anylist/${id}` });
  }
}

function openCreate() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  router.push({ path: '/anylist/create' });
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    if (!loading.value && !noMore.value) {
      void fetchAlbums(true);
    }
  }
}

void fetchAlbums(false);
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-create-album:hover {
  border-color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.btn-login {
  height: 34px;
  padding: 0 22px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.login-prompt {
  padding: var(--space-10) 0;
}

.anylist-tabs {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  overflow-x: auto;
}

.anylist-tab-item {
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 2px;
  white-space: nowrap;
}

.anylist-tab-item.active {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.tab-line {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  background: var(--brand-primary, #10b981);
  border-radius: 2px;
}

.loading-wrapper,
.error-wrapper,
.empty-wrapper {
  padding: var(--space-8) 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.album-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.album-card {
  display: flex;
  align-items: stretch;
  gap: 14px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.album-card:hover {
  background-color: var(--surface-hover);
  border-color: var(--brand-primary);
}

.album-cover-wrapper {
  width: 96px;
  min-height: 72px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background-color: var(--background-secondary);
}

.album-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--brand-primary);
  background: linear-gradient(135deg, var(--brand-soft), var(--brand-soft-hover));
}

.album-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.album-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.4;
}

.album-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.album-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: auto;
  color: var(--text-tertiary);
  font-size: 11px;
}

.album-meta i {
  margin-right: 4px;
}

.album-arrow {
  align-self: center;
  color: var(--text-disabled);
  font-size: 12px;
  flex-shrink: 0;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}

.retry-inline {
  border: 0;
  background: transparent;
  color: var(--brand-primary, #10b981);
  font-size: 12px;
  cursor: pointer;
}
</style>