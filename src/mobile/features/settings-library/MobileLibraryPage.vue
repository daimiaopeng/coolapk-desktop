<template>
  <section class="mobile-library-page" data-mobile-page="library" :aria-label="pageTitle">
    <header class="mobile-library-page__header"><div><p>酷安个人资料库</p><h1>{{ pageTitle }}</h1></div><button type="button" aria-label="刷新" :disabled="loading" @click="load(true)"><i :class="loading ? 'fas fa-circle-notch fa-spin' : 'fas fa-rotate-right'"></i></button></header>
    <nav class="mobile-library-page__tabs" aria-label="资料库入口"><button v-for="entry in entries" :key="entry.path" type="button" :class="{ active: route.path === entry.path }" @click="router.push(entry.path)"><i :class="entry.icon"></i>{{ entry.label }}</button></nav>
    <form v-if="kind === 'albums'" class="mobile-library-page__search" @submit.prevent="load(true)"><i class="fas fa-magnifying-glass"></i><input v-model="search" type="search" placeholder="搜索专辑" /><button type="submit">搜索</button></form>
    <nav v-if="subtabs.length" class="mobile-library-page__subtabs" aria-label="当前资料库筛选"><button v-for="tab in subtabs" :key="tab.key" type="button" :class="{ active: activeSubtab === tab.key }" @click="selectSubtab(tab.key)">{{ tab.label }}</button></nav>
    <main ref="scrollElement" class="mobile-library-page__scroll" @scroll.passive="onScroll">
      <div v-if="requiresLogin && !authStore.isLoggedIn" class="mobile-library-page__state"><i class="fas fa-lock"></i><strong>登录后查看{{ pageTitle }}</strong><button type="button" @click="authStore.openLoginModal()">立即登录</button></div>
      <div v-else-if="loading && !items.length" class="mobile-library-page__state"><i class="fas fa-circle-notch fa-spin"></i><strong>正在加载…</strong></div>
      <div v-else-if="error && !items.length" class="mobile-library-page__state is-error"><i class="fas fa-triangle-exclamation"></i><strong>{{ error }}</strong><button type="button" @click="load(true)">重试</button></div>
      <div v-else-if="!items.length" class="mobile-library-page__state"><i class="fas fa-box-open"></i><strong>暂无{{ pageTitle }}</strong><span>这里会展示酷安账号同步的内容</span></div>
      <section v-else class="mobile-library-page__list" aria-label="内容列表">
        <button v-for="(item, index) in items" :key="itemKey(item, index)" type="button" class="mobile-library-page__card" @click="openItem(item)">
          <span class="mobile-library-page__thumb"><img v-if="itemImage(item)" :src="itemImage(item)" alt="" referrerpolicy="no-referrer" /><i v-else :class="itemIcon"></i></span>
          <span class="mobile-library-page__copy"><strong>{{ itemTitle(item) }}</strong><small>{{ itemSubtitle(item) }}</small></span><i class="fas fa-chevron-right"></i>
        </button>
      </section>
      <footer v-if="items.length" class="mobile-library-page__footer"><span v-if="loading">正在加载更多…</span><span v-else-if="noMore">没有更多了</span></footer>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { useAuthStore } from '../../../stores/auth';
import { normalizeCoolapkRoute } from '../../../utils/coolapkRoute';

defineOptions({ name: 'MobileLibraryPage' });
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const scrollElement = ref<HTMLElement | null>(null);
const items = ref<any[]>([]);
const loading = ref(false);
const error = ref('');
const noMore = ref(false);
const page = ref(1);
const search = ref('');
const firstItem = ref('');
const lastItem = ref('');
let requestId = 0;

const entries = [
  { path: '/favorites', label: '收藏', icon: 'fas fa-star' }, { path: '/history', label: '历史', icon: 'fas fa-clock' },
  { path: '/albums', label: '专辑', icon: 'fas fa-layer-group' }, { path: '/pictures', label: '酷图', icon: 'fas fa-image' },
  { path: '/my-albums', label: '我的专辑', icon: 'fas fa-folder-open' }, { path: '/my-likes', label: '我的点赞', icon: 'fas fa-heart' },
];
const kind = computed(() => route.path.slice(1).split('/')[0] || 'favorites');
const pageTitle = computed(() => ({ favorites: '我的收藏', history: '浏览历史', albums: '专辑', pictures: '酷图', 'my-albums': '我的专辑', 'my-likes': '我的点赞' }[kind.value] || '资料库'));
const requiresLogin = computed(() => ['favorites', 'history', 'my-albums', 'my-likes'].includes(kind.value));
const itemIcon = computed(() => kind.value === 'pictures' ? 'fas fa-image' : kind.value.includes('album') ? 'fas fa-layer-group' : kind.value === 'history' ? 'fas fa-clock' : 'fas fa-bookmark');
const subtabs = computed(() => {
  if (kind.value === 'history') return [{ key: 'all', label: '全部' }, { key: 'feed', label: '动态' }, { key: 'user', label: '用户' }, { key: 'topic', label: '话题' }, { key: 'apk', label: '应用' }, { key: 'recent', label: '最近访问' }];
  if (kind.value === 'albums') return [{ key: 'hot', label: '热门' }, { key: 'new', label: '最新' }];
  if (kind.value === 'pictures') return [{ key: '', label: '全部' }, { key: '手机', label: '手机' }, { key: '摄影', label: '摄影' }, { key: '动漫', label: '动漫' }, { key: '风景', label: '风景' }];
  return [];
});
const activeSubtab = computed(() => kind.value === 'history' ? (route.query.view === 'recent' ? 'recent' : String(route.query.type || 'all')) : kind.value === 'albums' ? String(route.query.tab || 'hot') : String(route.query.tag || ''));

function responseList(response: any): any[] { const data = response?.data ?? response; if (Array.isArray(data)) return data; for (const key of ['items', 'rows', 'list', 'entities', 'feeds']) if (Array.isArray(data?.[key])) return data[key]; return []; }
function itemKey(item: any, index: number) { return String(item?.id ?? item?.entityId ?? item?.feed_id ?? item?.albumId ?? `${kind.value}-${index}`); }
function itemTitle(item: any) { return String(item?.title ?? item?.name ?? item?.albumName ?? item?.feed_title ?? item?.goods_title ?? item?.message ?? '未命名内容').replace(/<[^>]+>/g, '').slice(0, 80); }
function itemSubtitle(item: any) { return String(item?.description ?? item?.intro ?? item?.username ?? item?.userInfo?.username ?? item?.dateline ?? item?.time ?? '点击查看详情').replace(/<[^>]+>/g, '').slice(0, 80); }
function itemImage(item: any) {
  const firstPicture = Array.isArray(item?.pics) ? item.pics[0] : Array.isArray(item?.picArr) ? item.picArr[0] : '';
  const value = item?.cover ?? item?.pic ?? item?.logo ?? item?.icon ?? item?.userAvatar ?? item?.user_avatar ?? item?.avatar ?? firstPicture;
  return typeof value === 'string' ? value : String(value?.url ?? value?.pic ?? value?.image ?? '');
}
function reset() { items.value = []; page.value = 1; noMore.value = false; error.value = ''; firstItem.value = ''; lastItem.value = ''; }
function selectSubtab(key: string) {
  const query = Object.fromEntries(Object.entries(route.query).filter(([, value]) => value !== null).map(([name, value]) => [name, String(value)]));
  if (kind.value === 'history') { if (key === 'recent') { delete query.type; query.view = 'recent'; } else { delete query.view; query.type = key; } }
  else if (kind.value === 'albums') query.tab = key;
  else if (kind.value === 'pictures') query.tag = key;
  void router.replace({ path: route.path, query });
}

async function load(refresh = false) {
  if (requiresLogin.value && !authStore.isLoggedIn) return;
  if (loading.value || (noMore.value && !refresh)) return;
  if (refresh) reset();
  loading.value = true;
  const currentRequest = ++requestId;
  try {
    const uid = String(authStore.user?.uid || '');
    let response: any;
    if (kind.value === 'favorites') response = route.query.collectionId ? await CoolapkTauriAPI.getCollectionItemList(String(route.query.collectionId), page.value) : await CoolapkTauriAPI.getFavoriteList('feed', page.value, firstItem.value, lastItem.value);
    else if (kind.value === 'history') response = route.query.view === 'recent' ? await CoolapkTauriAPI.getRecentHistory(page.value, firstItem.value, lastItem.value) : await CoolapkTauriAPI.getHitHistory(page.value, String(route.query.type === 'all' ? '' : route.query.type || ''), firstItem.value, lastItem.value);
    else if (kind.value === 'albums') response = search.value.trim() ? await CoolapkTauriAPI.searchAlbums(search.value.trim(), page.value) : await CoolapkTauriAPI.getAlbumList(String(route.query.tab || 'hot'), page.value);
    else if (kind.value === 'pictures') response = await CoolapkTauriAPI.getPictureList(String(route.query.tag || ''), page.value);
    else if (kind.value === 'my-albums') response = await CoolapkTauriAPI.getUserAlbumList(uid, page.value);
    else response = await CoolapkTauriAPI.getUserLikeList(uid, page.value);
    if (currentRequest !== requestId) return;
    const incoming = responseList(response);
    const known = new Set(items.value.map((item, index) => itemKey(item, index)));
    const fresh = incoming.filter((item, index) => !known.has(itemKey(item, index)));
    items.value.push(...fresh);
    const nextLast = String(response?.lastItem ?? response?.data?.lastItem ?? (fresh.at(-1) ? itemKey(fresh.at(-1), fresh.length - 1) : lastItem.value));
    if (!firstItem.value && fresh.length) firstItem.value = itemKey(fresh[0], 0);
    const unchangedCursor = nextLast === lastItem.value && Boolean(lastItem.value);
    lastItem.value = nextLast;
    noMore.value = incoming.length === 0 || fresh.length === 0 || unchangedCursor || (kind.value !== 'favorites' && incoming.length < 10);
    page.value += 1;
  } catch (loadError) { if (currentRequest === requestId) error.value = loadError instanceof Error ? loadError.message : '加载失败，请稍后重试'; }
  finally { if (currentRequest === requestId) loading.value = false; }
}
function onScroll(event: Event) { const target = event.currentTarget as HTMLElement; if (target.scrollTop + target.clientHeight >= target.scrollHeight - 180) void load(); }
function openItem(item: any) {
  const id = String(item?.id ?? item?.entityId ?? item?.feed_id ?? item?.albumId ?? item?.album_id ?? '');
  if (kind.value === 'albums' || kind.value === 'my-albums') { if (id) void router.push(`/album/${encodeURIComponent(id)}`); return; }
  if (kind.value === 'pictures' && id) { void router.push(`/feed/${encodeURIComponent(id)}`); return; }
  const type = String(item?.entityType ?? item?.entity_type ?? item?.type ?? '').toLowerCase();
  if (type.includes('user') && id) void router.push(`/user/${encodeURIComponent(id)}`);
  else if ((type.includes('topic') || type.includes('tag')) && id) void router.push(`/topic/${encodeURIComponent(String(item?.title || id))}`);
  else if (id) void router.push(`/feed/${encodeURIComponent(id)}`);
  else { const target = normalizeCoolapkRoute(String(item?.url ?? item?.href ?? '')); if (target) void router.push(target); }
}
watch(() => route.fullPath, () => { search.value = String(route.query.q || ''); void load(true); });
watch(() => [authStore.isLoggedIn, authStore.user?.uid], () => { if (requiresLogin.value) void load(true); });
onMounted(() => { search.value = String(route.query.q || ''); void load(true); });
</script>

<style scoped>
.mobile-library-page__subtabs{display:flex;gap:6px;padding:8px 12px 2px;overflow-x:auto;scrollbar-width:none}.mobile-library-page__subtabs::-webkit-scrollbar{display:none}.mobile-library-page__subtabs button{flex:0 0 auto;padding:6px 11px;border:0;border-radius:999px;background:#fff;color:#888;font:inherit;font-size:12px}.mobile-library-page__subtabs button.active{background:#dff4e7;color:#0f9d58;font-weight:700}
.mobile-library-page{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:#f2f2f6;color:#262629}.mobile-library-page__header{display:flex;align-items:center;gap:12px;padding:14px;background:#fff}.mobile-library-page__header>div{flex:1}.mobile-library-page__header p{margin:0 0 2px;color:#999;font-size:11px}.mobile-library-page h1{margin:0;font-size:22px}.mobile-library-page__header button{width:38px;height:38px;border:0;border-radius:12px;background:#e7f6ed;color:#0f9d58}.mobile-library-page__tabs{display:flex;gap:2px;padding:0 8px;overflow-x:auto;background:#fff;scrollbar-width:none}.mobile-library-page__tabs::-webkit-scrollbar{display:none}.mobile-library-page__tabs button{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;min-height:44px;padding:0 9px;border:0;background:transparent;color:#888;font:inherit;font-size:12px}.mobile-library-page__tabs button.active{border-bottom:3px solid #0f9d58;color:#0f9d58;font-weight:700}.mobile-library-page__search{display:flex;align-items:center;gap:8px;margin:10px 12px 2px;padding:0 11px;min-height:42px;border:1px solid #e1e1e5;border-radius:14px;background:#fff;color:#999}.mobile-library-page__search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit}.mobile-library-page__search button{border:0;background:transparent;color:#0f9d58;font:inherit}.mobile-library-page__scroll{flex:1;min-height:0;overflow-y:auto;padding:10px 10px calc(22px + env(safe-area-inset-bottom,0px))}.mobile-library-page__list{display:grid;gap:8px}.mobile-library-page__card{display:flex;align-items:center;gap:11px;min-width:0;padding:12px;border:0;border-radius:16px;background:#fff;text-align:left}.mobile-library-page__thumb{display:grid;place-items:center;flex:0 0 48px;width:48px;height:48px;overflow:hidden;border-radius:13px;background:#e6f6ed;color:#0f9d58}.mobile-library-page__thumb img{width:100%;height:100%;object-fit:cover}.mobile-library-page__copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:5px}.mobile-library-page__copy strong,.mobile-library-page__copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mobile-library-page__copy strong{font-size:15px}.mobile-library-page__copy small{color:#999;font-size:12px}.mobile-library-page__card>i{color:#c5c5c9}.mobile-library-page__state{display:grid;place-items:center;gap:9px;min-height:240px;padding:24px;color:#999;text-align:center}.mobile-library-page__state i{color:#0f9d58;font-size:30px}.mobile-library-page__state strong{color:#555}.mobile-library-page__state button{min-height:36px;padding:0 15px;border:0;border-radius:999px;background:#0f9d58;color:#fff;font:inherit}.mobile-library-page__state.is-error{color:#d94b42}.mobile-library-page__footer{padding:16px;color:#999;text-align:center;font-size:12px}
</style>
