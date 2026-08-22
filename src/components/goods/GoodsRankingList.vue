<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i :class="[icon, 'icon']"></i> {{ title }}</h2>
        <span class="page-subtitle">{{ subtitle }}</span>
      </div>
      <AppButton
        v-if="kind === 'lists'"
        size="sm"
        icon="fas fa-plus"
        @click="openCreate"
      >
        创建清单
      </AppButton>
      <AppButton
        v-else
        size="sm"
        variant="soft"
        icon="fas fa-trophy"
        @click="openCreate"
      >
        创建好物榜
      </AppButton>
    </div>

    <div v-if="listTypes.length > 0" class="category-chips custom-scrollbar">
      <button
        class="category-chip"
        :class="{ 'is-active': activeType === '' }"
        type="button"
        @click="selectType('')"
      >
        全部
      </button>
      <button
        v-for="type in listTypes"
        :key="typeKey(type)"
        class="category-chip"
        :class="{ 'is-active': activeType === typeKey(type) }"
        type="button"
        @click="selectType(typeKey(type))"
      >
        {{ type.title || type.name || typeKey(type) }}
      </button>
    </div>

    <div v-if="loading && items.length === 0" class="state-wrapper">
      <LoadingState :text="loadingText" />
    </div>

    <div v-else-if="error && items.length === 0" class="state-wrapper">
      <ErrorState title="加载失败" :message="error" @retry="load(true)" />
    </div>

    <div v-else-if="items.length === 0 && allItems.length > 0" class="state-wrapper">
      <EmptyState title="该分类暂无好物" description="切换其他分类看看" />
    </div>

    <div v-else-if="allItems.length === 0" class="state-wrapper">
      <EmptyState title="暂无好物" description="还没有创建或收录好物，去创建第一个吧" />
    </div>

    <div v-else class="list-wrapper">
      <article
        v-for="item in items"
        :key="listKey(item)"
        class="goods-list-card"
        @click="openDetail(item)"
      >
        <div class="list-cover">
          <AppImage
            v-if="listCover(item)"
            :src="listCover(item)"
            image-class="list-cover-img"
            fit="cover"
          />
          <div v-else class="list-cover-fallback">
            <i class="fas fa-gift"></i>
          </div>
        </div>

        <div class="list-info">
          <h4 class="list-title">{{ listTitle(item) }}</h4>
          <p v-if="listMessage(item)" class="list-message">{{ listMessage(item) }}</p>
          <div class="list-stats">
            <span v-if="listItemNum(item) > 0"><i class="fas fa-box-open"></i> {{ listItemNum(item) }} 件好物</span>
            <span v-if="listVoteNum(item) > 0"><i class="fas fa-thumbs-up"></i> {{ listVoteNum(item) }}</span>
            <span v-if="listFollowNum(item) > 0"><i class="far fa-user"></i> {{ listFollowNum(item) }} 关注</span>
            <span v-if="listReplyNum(item) > 0"><i class="far fa-comment"></i> {{ listReplyNum(item) }}</span>
          </div>
        </div>

        <div class="list-arrow">
          <i class="fas fa-chevron-right"></i>
        </div>
      </article>

      <div class="pagination-footer">
        <LoadingState v-if="loading && allItems.length > 0" text="加载更多中..." />
        <button v-else-if="error && allItems.length > 0" class="retry-inline" @click="load(true)">加载失败，点击重试</button>
        <div v-else-if="noMore" class="no-more">没有更多了</div>
      </div>
    </div>

    <CreateGoodsListDialog
      :is-open="createOpen"
      :kind="kind"
      @close="closeCreate"
      @created="handleCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppButton from '../common/AppButton.vue';
import AppImage from '../common/AppImage.vue';
import LoadingState from '../common/LoadingState.vue';
import ErrorState from '../common/ErrorState.vue';
import EmptyState from '../common/EmptyState.vue';
import CreateGoodsListDialog from './CreateGoodsListDialog.vue';
import { useAuthStore } from '../../stores/auth';

const props = withDefaults(
  defineProps<{
    kind: 'lists' | 'ranking';
    title: string;
    subtitle: string;
    icon?: string;
    uid?: string;
    loadingText?: string;
  }>(),
  {
    icon: 'fas fa-gift',
    uid: '',
    loadingText: '正在加载好物...',
  },
);

const router = useRouter();
const authStore = useAuthStore();

const listTypes = ref<any[]>([]);
const activeType = ref('');
const allItems = ref<any[]>([]);
const page = ref(1);
const loading = ref(false);
const error = ref('');
const noMore = ref(false);
const createOpen = ref(false);

const items = computed(() => {
  let list = allItems.value;
  if (props.kind === 'ranking') {
    list = list
      .filter((item) => isVoteList(item))
      .sort((a, b) => listVoteNum(b) - listVoteNum(a));
  }
  if (!activeType.value) return list;
  return list.filter((item) => {
    const info = goodsListInfo(item);
    return String(info?.list_type ?? '') === String(activeType.value);
  });
});

const detailBase = computed(() => (props.kind === 'lists' ? '/goods/lists' : '/goods/ranking'));

function typeKey(type: any): string {
  return String(type?.id ?? type?.entityId ?? type?.title ?? '');
}

function listKey(item: any): string {
  return String(item?.id ?? item?.entityId ?? `${item?.uid}-${item?.dateline}`);
}

function goodsListInfo(item: any): any {
  return item?.goodsListInfo || item || {};
}

function listCover(item: any): string {
  const info = goodsListInfo(item);
  return info.cover || info.coverPic || info.logo || info.pic || item?.pic || item?.logo || '';
}

function listTitle(item: any): string {
  const info = goodsListInfo(item);
  return info.title || item?.title || '未命名好物';
}

function listMessage(item: any): string {
  const info = goodsListInfo(item);
  return info.message || info.description || info.sort_message || '';
}

function listItemNum(item: any): number {
  return Number(goodsListInfo(item)?.item_num || 0);
}

function listVoteNum(item: any): number {
  return Number(goodsListInfo(item)?.vote_num || 0);
}

function isVoteList(item: any): boolean {
  const v = goodsListInfo(item)?.is_open_vote;
  return v === true || v === 1 || v === '1';
}

function listFollowNum(item: any): number {
  return Number(goodsListInfo(item)?.follow_num || 0);
}

function listReplyNum(item: any): number {
  return Number(goodsListInfo(item)?.reply_num || 0);
}

async function loadTypes() {
  try {
    const res = await CoolapkTauriAPI.getGoodsListTypes();
    const data = res?.data;
    listTypes.value = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('加载好物分类失败', err);
  }
}

async function load(isRefresh = false) {
  if (loading.value) return;
  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    error.value = '';
  } else if (noMore.value) {
    return;
  }
  loading.value = true;
  try {
    const uid = props.uid || '';
    const res = await CoolapkTauriAPI.getGoodsList({ uid, page: page.value });
    const list = (res?.data && Array.isArray(res.data)) ? res.data : [];
    if (list.length === 0) {
      noMore.value = true;
    } else {
      if (isRefresh) {
        allItems.value = list;
      } else {
        const existing = new Set(allItems.value.map(listKey));
        allItems.value.push(...list.filter((i: any) => !existing.has(listKey(i))));
      }
      page.value++;
    }
  } catch (err: any) {
    error.value = err?.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function selectType(_type: string) {
  activeType.value = _type;
}

function openDetail(item: any) {
  const id = String(item?.id ?? item?.entityId ?? '');
  if (!id) return;
  router.push(`${detailBase.value}/${id}`);
}

function openCreate() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  createOpen.value = true;
}

function closeCreate() {
  createOpen.value = false;
}

function handleCreated() {
  createOpen.value = false;
  void load(true);
}

function onScrollEvent(e: Event) {
  const el = e.target as HTMLElement;
  const scrollDiff = el && el.scrollHeight
    ? el.scrollHeight - el.scrollTop - el.clientHeight
    : 999;
  if (scrollDiff < 260 && !loading.value && !noMore.value) {
    void load(false);
  }
}

onMounted(() => {
  void loadTypes();
  void load(true);
  window.addEventListener('scroll', onScrollEvent, true);
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScrollEvent, true);
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-main {
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
  gap: var(--space-2);
}

.page-title .icon {
  color: var(--brand-primary);
}

.page-subtitle {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.category-chips {
  display: flex;
  gap: var(--space-2);
  padding: 0 0 var(--space-4) 0;
  overflow-x: auto;
  margin-bottom: var(--space-2);
}

.category-chip {
  flex: 0 0 auto;
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  padding: 5px 14px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.category-chip:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.category-chip.is-active {
  background-color: var(--brand-soft);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.state-wrapper {
  padding: var(--space-10) 0;
}

.list-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.goods-list-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-default);
}

.goods-list-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.list-cover {
  width: 88px;
  height: 88px;
  flex: 0 0 88px;
  border-radius: var(--radius-control);
  overflow: hidden;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-light);
}

.list-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.list-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 30px;
}

.list-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.list-title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.list-message {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.list-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.list-arrow {
  color: var(--text-tertiary);
}

.pagination-footer {
  padding: var(--space-4) 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.retry-inline {
  border: 0;
  background: transparent;
  color: var(--brand-primary);
  font-size: var(--font-size-caption);
  cursor: pointer;
}
</style>