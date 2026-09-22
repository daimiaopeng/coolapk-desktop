<template>
  <main class="mobile-community-page" data-mobile-page="community" @scroll.passive="handleScroll">
    <header class="community-header">
      <button class="icon-button" type="button" aria-label="返回" @click="goBack">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="header-title-wrap">
        <h1>{{ pageTitle }}</h1>
        <span v-if="routeHint" class="header-hint">{{ routeHint }}</span>
      </div>
      <div class="header-actions">
        <button
          v-if="supportsSearch"
          class="icon-button"
          type="button"
          aria-label="搜索"
          @click="searchOpen = !searchOpen"
        >
          <i class="fas fa-search"></i>
        </button>
        <button
          v-if="supportsCreate"
          class="create-button"
          type="button"
          @click="openCreate"
        >
          <i class="fas fa-plus"></i>
          <span>创建</span>
        </button>
      </div>
    </header>

    <form v-if="searchOpen" class="search-bar" @submit.prevent="submitSearch">
      <i class="fas fa-search"></i>
      <input v-model="searchText" type="search" :placeholder="searchPlaceholder" />
      <button v-if="searchText" type="button" aria-label="清除" @click="clearSearch">
        <i class="fas fa-xmark"></i>
      </button>
    </form>

    <nav v-if="tabs.length > 0" class="community-tabs" aria-label="页面栏目">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="['community-tab', { active: activeTab === tab.key }]"
        @click="selectTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="mode === 'create'" class="create-panel">
      <div class="section-heading">
        <span class="heading-mark"></span>
        <div>
          <h2>{{ createMode === 'album' ? '创建专辑' : '创建万物清单' }}</h2>
          <p>{{ createMode === 'album' ? '整理一组你喜欢的应用' : '把产品和想法整理成自己的清单' }}</p>
        </div>
      </div>
      <label class="field-label">名称</label>
      <input v-model="createTitle" class="text-field" maxlength="60" placeholder="请输入名称" />
      <label class="field-label">简介</label>
      <textarea v-model="createDescription" class="text-field textarea-field" maxlength="240" placeholder="简单介绍一下"></textarea>
      <div class="create-actions">
        <button class="secondary-button" type="button" @click="goBack">取消</button>
        <button class="primary-button" type="button" :disabled="creating || !createTitle.trim()" @click="submitCreate">
          <i v-if="creating" class="fas fa-spinner fa-spin"></i>
          {{ creating ? '创建中...' : '确认创建' }}
        </button>
      </div>
    </section>

    <section v-else class="community-content">
      <div v-if="detail" class="detail-card">
        <div class="detail-cover" :class="{ empty: !imageOf(detail) }">
          <AppImage v-if="imageOf(detail)" :src="imageOf(detail)" fit="cover" :alt="titleOf(detail)" />
          <i v-else :class="detailIcon"></i>
        </div>
        <div class="detail-main">
          <h2>{{ titleOf(detail) }}</h2>
          <p v-if="descriptionOf(detail)">{{ descriptionOf(detail) }}</p>
          <div class="detail-stats">
            <span v-for="stat in detailStats" :key="stat.label"><strong>{{ stat.value }}</strong> {{ stat.label }}</span>
          </div>
          <button v-if="detailActionLabel" class="outline-button" type="button" @click="handleDetailAction">
            {{ detailActionLabel }}
          </button>
        </div>
      </div>

      <div v-if="loading && items.length === 0 && !detail" class="state-card">
        <i class="fas fa-spinner fa-spin"></i>
        <span>正在加载{{ pageTitle }}...</span>
      </div>

      <div v-else-if="error && items.length === 0 && !detail" class="state-card error-state">
        <i class="fas fa-cloud-exclamation"></i>
        <strong>加载失败</strong>
        <span>{{ error }}</span>
        <button class="primary-button" type="button" @click="loadCurrent(true)">重新加载</button>
      </div>

      <div v-else-if="items.length === 0 && !loading && !detail" class="state-card empty-state">
        <i :class="emptyIcon"></i>
        <strong>{{ emptyTitle }}</strong>
        <span>{{ emptyDescription }}</span>
        <button v-if="supportsCreate" class="primary-button" type="button" @click="openCreate">{{ createLabel }}</button>
      </div>

      <div v-else-if="items.length > 0" class="community-list">
        <article
          v-for="(item, index) in items"
          :key="itemKey(item, index)"
          class="community-card"
          role="button"
          tabindex="0"
          @click="openItem(item)"
          @keydown.enter="openItem(item)"
        >
          <AppImage v-if="imageOf(item)" class="item-image" :src="imageOf(item)" fit="cover" :alt="titleOf(item)" />
          <div v-else class="item-image image-fallback"><i :class="iconOf(item)"></i></div>
          <div class="item-body">
            <div class="item-title-row">
              <h3>{{ titleOf(item) }}</h3>
              <span v-if="badgeOf(item)" class="item-badge">{{ badgeOf(item) }}</span>
            </div>
            <p v-if="contentOf(item)" class="item-content">{{ contentOf(item) }}</p>
            <div class="item-meta">
              <span v-if="authorOf(item)"><i class="fas fa-user"></i>{{ authorOf(item) }}</span>
              <span v-if="dateOf(item)"><i class="fas fa-clock"></i>{{ dateOf(item) }}</span>
              <span v-if="metricOf(item)"><i class="fas fa-chart-simple"></i>{{ metricOf(item) }}</span>
            </div>
          </div>
          <i class="fas fa-chevron-right item-arrow"></i>
        </article>
      </div>

      <div v-if="detail && detailContent" class="detail-description" v-html="detailContent"></div>

      <div v-if="loading && items.length > 0" class="loading-more">
        <i class="fas fa-spinner fa-spin"></i> 加载更多...
      </div>
      <button v-else-if="error && items.length > 0" class="retry-button" type="button" @click="loadCurrent(false)">加载失败，点击重试</button>
      <div v-else-if="items.length > 0 && noMore" class="no-more">没有更多内容了</div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppImage from '../../../components/common/AppImage.vue';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { normalizeCoolapkRoute } from '../../../utils/coolapkRoute';
import { parseDiscoveryPage, resolveDiscoveryRoute } from '../../../utils/discovery';
import { useAuthStore } from '../../../stores/auth';

type Tab = { key: string; label: string };
type PageMode = 'list' | 'detail' | 'create';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const items = ref<any[]>([]);
const detail = ref<any>(null);
const loading = ref(false);
const error = ref('');
const noMore = ref(false);
const page = ref(1);
const firstItem = ref('');
const lastItem = ref('');
const searchOpen = ref(false);
const searchText = ref(String(route.query.q || ''));
const activeTab = ref(String(route.query.tab || 'all'));
const creating = ref(false);
const createTitle = ref('');
const createDescription = ref('');
const showCreateForm = ref(false);

const path = computed(() => route.path);
const routeParams = computed(() => route.params as Record<string, string>);
const queryTitle = computed(() => String(route.query.title || '').trim());
const mode = computed<PageMode>(() => showCreateForm.value || path.value === '/anylist/create' || path.value === '/albums/create' ? 'create' : isDetailPath.value ? 'detail' : 'list');
const createMode = computed(() => path.value === '/albums/create' || (showCreateForm.value && kind.value === 'albums') ? 'album' : 'anylist');
const isDetailPath = computed(() => /^\/(topic|event|dyh|album)\//.test(path.value) || /^\/anylist\/[^/]+$/.test(path.value));

const kind = computed(() => {
  if (path.value === '/topics') return 'topics';
  if (path.value === '/headline') return 'headline';
  if (path.value === '/page') return 'page';
  if (path.value === '/events') return 'events';
  if (path.value.startsWith('/event/')) return 'event';
  if (path.value.startsWith('/dyh/')) return 'dyh';
  if (path.value === '/my-dyh') return 'my-dyh';
  if (path.value === '/albums') return 'albums';
  if (path.value.startsWith('/album/')) return 'album';
  if (path.value === '/pictures') return 'pictures';
  if (path.value === '/reviews') return 'reviews';
  if (path.value === '/anylist') return 'anylist';
  if (path.value.startsWith('/anylist/')) return 'anylist-detail';
  if (path.value.startsWith('/topic/')) return 'topic';
  if (path.value.startsWith('/node/')) return 'node';
  return 'page';
});

const pageTitle = computed(() => {
  if (queryTitle.value) return queryTitle.value;
  const titles: Record<string, string> = {
    topics: '话题', topic: `#${decodeSegment(routeParams.value.tag || '')}#`, node: '版块', headline: '头条', page: '酷安内容', reviews: '点评',
    events: '活动', event: '活动详情', dyh: '看看号', 'my-dyh': '我的频道', albums: '专辑', album: '专辑详情', pictures: '酷图', anylist: '万物清单', 'anylist-detail': '清单详情',
  };
  return titles[kind.value] || '社区';
});

const routeHint = computed(() => kind.value === 'topic' ? '话题动态' : kind.value === 'node' ? `${routeParams.value.nodeType || '节点'} · 动态` : '');
const supportsSearch = computed(() => ['topics', 'topic', 'headline', 'page', 'albums', 'pictures', 'dyh', 'reviews'].includes(kind.value));
const supportsCreate = computed(() => kind.value === 'anylist' || path.value === '/albums');
const searchPlaceholder = computed(() => kind.value === 'pictures' ? '搜索酷图标签' : kind.value === 'albums' ? '搜索专辑' : '搜索内容');
const createLabel = computed(() => createMode.value === 'album' ? '创建专辑' : '创建清单');
const detailIcon = computed(() => kind.value === 'topic' ? 'fas fa-hashtag' : kind.value === 'dyh' ? 'fas fa-building' : kind.value === 'event' ? 'fas fa-calendar-days' : 'fas fa-layer-group');
const emptyIcon = computed(() => kind.value === 'events' || kind.value === 'event' ? 'fas fa-calendar-days' : kind.value === 'pictures' ? 'fas fa-image' : kind.value === 'topics' || kind.value === 'topic' ? 'fas fa-hashtag' : 'fas fa-inbox');
const emptyTitle = computed(() => kind.value === 'anylist' ? '还没有清单' : `暂无${pageTitle.value}`);
const emptyDescription = computed(() => kind.value === 'anylist' ? '创建一份清单整理你的产品和收藏' : '换个栏目或稍后再试');
const tabs = computed<Tab[]>(() => {
  const map: Record<string, Tab[]> = {
    topics: [{ key: 'all', label: '全部' }, { key: 'hot', label: '热门' }, { key: 'follow', label: '关注' }],
    topic: [{ key: 'all', label: '动态' }, { key: 'hot', label: '热门' }, { key: 'latest', label: '最新' }],
    node: [{ key: 'all', label: '动态' }, { key: 'latest', label: '最新' }],
    headline: [{ key: 'all', label: '头条' }, { key: 'latest', label: '更新' }, { key: 'editor', label: '编辑精选' }],
    dyh: [{ key: 'all', label: '精选' }, { key: 'square', label: '广场' }],
    'my-dyh': [{ key: 'follow', label: '我关注的' }, { key: 'subscribe', label: '订阅' }, { key: 'editor', label: '我管理的' }],
    albums: [{ key: 'hot', label: '热门' }, { key: 'new', label: '最新' }, { key: 'follow', label: '关注' }],
    pictures: [{ key: 'all', label: '推荐' }, { key: 'hot', label: '热门' }],
    reviews: [{ key: 'review', label: '数码测评' }, { key: 'digital', label: '数码' }, { key: 'phone', label: '手机' }, { key: 'computer', label: '电脑' }, { key: 'tablet', label: '平板' }, { key: 'system', label: '系统' }],
    anylist: [{ key: 'mine', label: '我的清单' }],
  };
  return map[kind.value] || [];
});

const detailStats = computed(() => {
  if (!detail.value) return [];
  const value = detail.value;
  const candidates = kind.value === 'topic'
    ? [[value.viewnum ?? value.viewNum, '热度'], [value.commentnum ?? value.commentNum, '讨论'], [value.follownum ?? value.followNum, '关注']]
    : kind.value === 'dyh'
      ? [[value.follownum ?? value.followNum, '关注'], [value.likenum ?? value.likeNum, '获赞']]
      : [[value.itemCount ?? value.apkCount ?? value.apknum, '内容'], [value.commentnum ?? value.replynum, '评论']];
  return candidates.filter(([item]) => item !== undefined && item !== null && item !== '').map(([item, label]) => ({ value: formatCount(item), label }));
});

const detailActionLabel = computed(() => kind.value === 'topic' || kind.value === 'dyh' ? '关注' : '');
const detailContent = computed(() => {
  if (!detail.value) return '';
  const raw = detail.value.content || detail.value.message || detail.value.description || detail.value.intro || '';
  return raw ? escapeHtml(String(raw)).replace(/\n/g, '<br>') : '';
});

function decodeSegment(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function extractPayload(response: any): any {
  return response?.data ?? response;
}

function extractList(response: any): any[] {
  const payload = extractPayload(response);
  if (Array.isArray(payload)) return payload;
  for (const key of ['entities', 'items', 'rows', 'list', 'feeds', 'dataList', 'albums', 'events', 'topics']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function extractCursor(response: any, list: any[]) {
  const payload = extractPayload(response) || {};
  firstItem.value = String(payload.firstItem ?? payload.first_item ?? payload.first ?? list[0]?.id ?? firstItem.value ?? '');
  lastItem.value = String(payload.lastItem ?? payload.last_item ?? payload.last ?? list.at(-1)?.id ?? lastItem.value ?? '');
}

function itemKey(item: any, index: number): string {
  return String(item?.id ?? item?.entityId ?? item?.uid ?? item?.packageName ?? item?.tag ?? item?.title ?? index);
}

function titleOf(item: any): string {
  return String(item?.title ?? item?.name ?? item?.albumName ?? item?.dyhName ?? item?.dyhTitle ?? item?.topicName ?? item?.tag ?? item?.message?.slice?.(0, 60) ?? '未命名内容');
}

function imageOf(item: any): string {
  return String(item?.logo ?? item?.icon ?? item?.avatar ?? item?.userAvatar ?? item?.cover ?? item?.pic ?? item?.image ?? item?.url_image ?? item?.picArr?.[0] ?? '');
}

function contentOf(item: any): string {
  const value = item?.message ?? item?.description ?? item?.intro ?? item?.subTitle ?? item?.content ?? item?.summary ?? '';
  return String(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
}

function descriptionOf(item: any): string { return contentOf(item); }
function authorOf(item: any): string { return String(item?.username ?? item?.userName ?? item?.author ?? item?.user?.username ?? ''); }
function badgeOf(item: any): string { return String(item?.statusText ?? item?.status ?? item?.typeName ?? item?.category ?? ''); }
function iconOf(item: any): string { return item?.type === 'event' ? 'fas fa-calendar-days' : kind.value === 'topic' || kind.value === 'topics' ? 'fas fa-hashtag' : 'fas fa-layer-group'; }
function metricOf(item: any): string {
  const value = item?.viewnum ?? item?.follownum ?? item?.likenum ?? item?.replynum ?? item?.commentnum ?? item?.count;
  return value === undefined || value === null ? '' : formatCount(value);
}
function dateOf(item: any): string {
  const value = item?.dateline ?? item?.updateTime ?? item?.update_time ?? item?.createTime ?? item?.create_time ?? item?.time;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return String(value || '');
  return new Date(numeric * 1000).toLocaleDateString('zh-CN');
}
function formatCount(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? '0');
  if (numeric >= 10000) return `${(numeric / 10000).toFixed(1)}万`;
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)}k`;
  return String(numeric);
}
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)); }

function resetState() {
  page.value = 1;
  firstItem.value = '';
  lastItem.value = '';
  noMore.value = false;
  error.value = '';
  items.value = [];
  detail.value = null;
}

function responseItems(response: any, incoming: any[], refresh: boolean) {
  extractCursor(response, incoming);
  const seen = new Set(items.value.map((item, index) => itemKey(item, index)));
  const unique = incoming.filter((item, index) => !seen.has(itemKey(item, index)));
  items.value = refresh ? incoming : [...items.value, ...unique];
  if (incoming.length === 0 || unique.length === 0) noMore.value = true;
  page.value += 1;
}

async function loadCurrent(refresh = true) {
  if (loading.value || (!refresh && noMore.value)) return;
  loading.value = true;
  error.value = '';
  if (refresh) resetState();
  try {
    const currentPage = page.value;
    let response: any;
    let incoming: any[] = [];
    if (mode.value === 'create') return;
    switch (kind.value) {
      case 'topics':
        response = searchText.value.trim()
          ? await CoolapkTauriAPI.searchFeedTopics(searchText.value.trim(), currentPage)
          : await CoolapkTauriAPI.getTopicHubData(String(route.query.subUrl || ''), currentPage, firstItem.value, lastItem.value);
        incoming = extractList(response);
        if (incoming.length === 0 && currentPage === 1) incoming = extractList(await CoolapkTauriAPI.getHotTopics());
        break;
      case 'topic': {
        const tag = decodeSegment(routeParams.value.tag || '');
        if (currentPage === 1) {
          const header = await Promise.allSettled([CoolapkTauriAPI.getTopicDetail(tag), CoolapkTauriAPI.getTopicDetailV7(tag)]);
          detail.value = extractPayload(header.find((entry) => entry.status === 'fulfilled')?.value) || null;
        }
        response = searchText.value.trim()
          ? await CoolapkTauriAPI.searchByType({ searchType: 'feed', query: searchText.value.trim(), page: currentPage, pageType: 'tag', pageParam: tag, feedType: 'all' })
          : await CoolapkTauriAPI.getTopicFeeds(tag, currentPage, { listType: activeTab.value === 'latest' ? 'lastupdate_desc' : activeTab.value === 'hot' ? 'rank_score' : '', firstItem: firstItem.value, lastItem: lastItem.value });
        incoming = extractList(response);
        break;
      }
      case 'node':
        response = await CoolapkTauriAPI.getNodeFeeds(decodeSegment(routeParams.value.nodeType || ''), decodeSegment(routeParams.value.nodeId || ''), currentPage);
        incoming = extractList(response);
        break;
      case 'headline':
        response = searchText.value.trim()
          ? await CoolapkTauriAPI.searchByType({ searchType: 'feed', query: searchText.value.trim(), page: currentPage, pageType: 'search', feedType: 'all' })
          : activeTab.value === 'editor' ? await CoolapkTauriAPI.getEditorChoiceFeeds(currentPage) : activeTab.value === 'latest' ? await CoolapkTauriAPI.getLatestFeeds(currentPage) : await CoolapkTauriAPI.getHeadlineFeeds(currentPage);
        incoming = extractList(response);
        break;
      case 'page': {
        const target = String(route.query.url || '');
        if (target) {
          response = await CoolapkTauriAPI.getDiscoveryPageData({ url: target, title: pageTitle.value, page: currentPage, firstItem: firstItem.value, lastItem: lastItem.value, pageContext: JSON.stringify({ source: 'mobile-community', target }) });
          const parsed = parseDiscoveryPage(response, currentPage);
          incoming = parsed.items as any[];
          firstItem.value = parsed.firstItem || firstItem.value;
          lastItem.value = parsed.lastItem || lastItem.value;
          if (!parsed.hasMore) noMore.value = true;
        } else {
          response = await CoolapkTauriAPI.getIndexV8FeedsPaged({ page: currentPage, firstItem: firstItem.value, lastItem: lastItem.value });
          incoming = extractList(response);
        }
        break;
      }
      case 'events':
        response = await CoolapkTauriAPI.getEventList(currentPage);
        incoming = extractList(response);
        break;
      case 'event':
        response = await CoolapkTauriAPI.getEventDetail(String(routeParams.value.eventId || ''));
        detail.value = extractPayload(response);
        incoming = extractList(response);
        noMore.value = true;
        break;
      case 'dyh': {
        const id = String(routeParams.value.dyhId || '');
        if (currentPage === 1) detail.value = extractPayload(await CoolapkTauriAPI.getDyhDetail(id));
        response = searchText.value.trim()
          ? await CoolapkTauriAPI.searchByType({ searchType: 'feed', query: searchText.value.trim(), page: currentPage, pageType: 'tag', pageParam: titleOf(detail.value || { title: id }), feedType: 'all' })
          : await CoolapkTauriAPI.getDyhFeeds(id, activeTab.value, currentPage);
        incoming = extractList(response);
        break;
      }
      case 'my-dyh':
        response = activeTab.value === 'subscribe'
          ? await CoolapkTauriAPI.getMyDyhSubscribeList(currentPage)
          : activeTab.value === 'editor'
            ? await CoolapkTauriAPI.getMyDyhEditorList(currentPage)
            : await CoolapkTauriAPI.getMyDyhFollowList(currentPage);
        incoming = extractList(response);
        break;
      case 'albums':
        response = searchText.value.trim() ? await CoolapkTauriAPI.searchAlbums(searchText.value.trim(), currentPage) : await CoolapkTauriAPI.getAlbumList(activeTab.value, currentPage);
        incoming = extractList(response);
        break;
      case 'album':
        if (currentPage === 1) detail.value = extractPayload(await CoolapkTauriAPI.getAlbumDetail(String(routeParams.value.albumId || '')));
        response = await CoolapkTauriAPI.getAlbumReplies(String(routeParams.value.albumId || ''), currentPage);
        incoming = extractList(response);
        break;
      case 'pictures':
        response = await CoolapkTauriAPI.getPictureList(searchText.value.trim(), currentPage);
        incoming = extractList(response);
        break;
      case 'reviews': {
        const boardMap: Record<string, string> = { review: '#/board/数码测评', digital: '#/board/数码', phone: '#/board/手机', computer: '#/board/电脑', tablet: '#/board/平板', system: '#/board/系统' };
        response = searchText.value.trim()
          ? await CoolapkTauriAPI.searchFeeds(searchText.value.trim(), currentPage)
          : await CoolapkTauriAPI.getBoardFeeds(boardMap[activeTab.value] || boardMap.review, currentPage);
        incoming = extractList(response);
        break;
      }
      case 'anylist':
        if (!authStore.isLoggedIn) { noMore.value = true; break; }
        response = await CoolapkTauriAPI.getUserProductAlbums(String(authStore.user?.uid || ''), currentPage);
        incoming = extractList(response);
        break;
      case 'anylist-detail':
        response = await CoolapkTauriAPI.getGoodsListItems(String(authStore.user?.uid || ''), String(routeParams.value.listId || ''), currentPage);
        incoming = extractList(response);
        break;
      default:
        response = await CoolapkTauriAPI.getDiscoveryPageData({ url: String(route.query.url || ''), title: pageTitle.value, page: currentPage, firstItem: firstItem.value, lastItem: lastItem.value });
        incoming = extractList(response);
    }
    if (mode.value === 'detail' && detail.value && kind.value !== 'event' && kind.value !== 'dyh' && kind.value !== 'album') {
      detail.value = extractPayload(response) || detail.value;
    }
    if (kind.value === 'event' && detail.value) {
      const related = incoming.length ? incoming : extractList(detail.value?.feeds || detail.value?.items);
      if (related.length) responseItems(response, related, refresh);
    } else if (!noMore.value || incoming.length > 0) {
      responseItems(response, incoming, refresh);
    }
    if (incoming.length === 0) noMore.value = true;
  } catch (loadError: any) {
    error.value = loadError?.message || `无法加载${pageTitle.value}`;
  } finally {
    loading.value = false;
  }
}

function openItem(item: any) {
  const direct = normalizeCoolapkRoute(String(item?.url ?? item?.href ?? item?.target ?? item?.route ?? ''));
  if (direct) { void router.push(direct); return; }
  const id = String(item?.id ?? item?.entityId ?? item?.feedId ?? item?.dyhId ?? item?.albumId ?? '');
  if (!id) return;
  if (kind.value === 'topics' || kind.value === 'topic') void router.push(`/topic/${encodeURIComponent(String(item?.tag ?? item?.title ?? id))}`);
  else if (kind.value === 'events') void router.push(`/event/${encodeURIComponent(id)}`);
  else if (kind.value === 'dyh') void router.push(`/feed/${encodeURIComponent(id)}`);
  else if (kind.value === 'my-dyh') void router.push(`/dyh/${encodeURIComponent(String(item?.dyhId || item?.id || id))}`);
  else if (kind.value === 'albums') void router.push(`/album/${encodeURIComponent(id)}`);
  else if (kind.value === 'anylist') void router.push(`/anylist/${encodeURIComponent(id)}`);
  else if (item?.feedId || item?.feedType || item?.ttype === 'feed') void router.push(`/feed/${encodeURIComponent(item.feedId || id)}`);
}

function handleDetailAction() {
  if (kind.value === 'topic') void router.push({ path: '/search', query: { q: `#${routeParams.value.tag || ''}` } });
  else if (kind.value === 'dyh') void router.push({ path: '/my-dyh', query: { id: routeParams.value.dyhId } });
}

function selectTab(key: string) {
  if (activeTab.value === key) return;
  activeTab.value = key;
  void router.replace({ query: { ...route.query, tab: key } });
}

function submitSearch() {
  const query = { ...route.query, q: searchText.value.trim() || undefined };
  void router.replace({ query });
}

function clearSearch() { searchText.value = ''; submitSearch(); }
function openCreate() {
  if (kind.value === 'albums') {
    showCreateForm.value = true;
    createTitle.value = '';
    createDescription.value = '';
    return;
  }
  void router.push('/anylist/create');
}
function goBack() {
  if (showCreateForm.value) { showCreateForm.value = false; return; }
  if (window.history.length > 1) router.back(); else void router.push('/');
}

async function submitCreate() {
  const title = createTitle.value.trim();
  if (!title || creating.value) return;
  creating.value = true;
  try {
    if (createMode.value === 'album') {
      const result: any = await CoolapkTauriAPI.createAlbum(title, createDescription.value.trim());
      const id = extractPayload(result)?.id ?? extractPayload(result)?.albumId;
      if (id) await router.push(`/album/${encodeURIComponent(String(id))}`); else await router.push('/albums');
    } else {
      const result: any = await CoolapkTauriAPI.createProductAlbum({ title, description: createDescription.value.trim() });
      const id = extractPayload(result)?.id ?? extractPayload(result)?.albumId;
      if (id) await router.push(`/anylist/${encodeURIComponent(String(id))}`); else await router.push('/anylist');
    }
  } catch (createError: any) {
    error.value = createError?.message || '创建失败，请稍后重试';
  } finally {
    creating.value = false;
    showCreateForm.value = false;
  }
}

function handleScroll(event: Event) {
  const element = event.currentTarget as HTMLElement;
  if (element.scrollHeight - element.scrollTop - element.clientHeight < 360) void loadCurrent(false);
}

watch(() => route.fullPath, () => {
  activeTab.value = String(route.query.tab || (kind.value === 'albums' ? 'hot' : kind.value === 'reviews' ? 'review' : kind.value === 'my-dyh' ? 'follow' : 'all'));
  searchText.value = String(route.query.q || '');
  searchOpen.value = Boolean(searchText.value);
  showCreateForm.value = false;
  resetState();
  void loadCurrent(true);
});

onMounted(() => {
  activeTab.value = String(route.query.tab || (kind.value === 'albums' ? 'hot' : kind.value === 'reviews' ? 'review' : kind.value === 'my-dyh' ? 'follow' : 'all'));
  void loadCurrent(true);
});
</script>

<style scoped>
.mobile-community-page { box-sizing: border-box; min-height: 100%; height: 100%; overflow-y: auto; padding: 0 14px 28px; background: #f4f5f7; color: #1f2329; }
.community-header { position: sticky; top: 0; z-index: 4; display: flex; align-items: center; gap: 8px; min-height: 58px; background: rgba(244,245,247,.96); backdrop-filter: blur(14px); }
.header-title-wrap { min-width: 0; flex: 1; text-align: center; }
.header-title-wrap h1 { margin: 0; overflow: hidden; font-size: 19px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.header-hint { display: block; margin-top: 2px; color: #9199a5; font-size: 11px; }
.header-actions { display: flex; align-items: center; gap: 4px; min-width: 40px; justify-content: flex-end; }
.icon-button, .create-button { border: 0; background: transparent; color: #31353b; cursor: pointer; }
.icon-button { width: 38px; height: 38px; border-radius: 19px; font-size: 17px; }
.icon-button:active { background: #e4e7eb; }
.create-button { display: inline-flex; align-items: center; gap: 4px; color: #0aa66b; font-size: 13px; font-weight: 700; }
.search-bar { display: flex; align-items: center; gap: 8px; margin: 3px 0 12px; padding: 0 12px; height: 42px; border: 1px solid #e0e3e7; border-radius: 14px; background: #fff; color: #8b949e; }
.search-bar input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #20242a; font-size: 14px; }
.search-bar button { border: 0; background: transparent; color: #9299a2; }
.community-tabs { display: flex; gap: 22px; overflow-x: auto; margin: 0 -14px 12px; padding: 0 14px 2px; border-bottom: 1px solid #e4e7ea; scrollbar-width: none; }
.community-tabs::-webkit-scrollbar { display: none; }
.community-tab { position: relative; flex: 0 0 auto; padding: 9px 2px 11px; border: 0; background: transparent; color: #8b929c; font-size: 14px; cursor: pointer; }
.community-tab.active { color: #0aa66b; font-weight: 800; }
.community-tab.active::after { position: absolute; right: 4px; bottom: -1px; left: 4px; height: 3px; border-radius: 3px; background: #0ab474; content: ''; }
.community-content { display: flex; flex-direction: column; gap: 12px; }
.detail-card, .community-card, .create-panel, .state-card, .detail-description { border: 1px solid #e3e6e9; border-radius: 18px; background: #fff; box-shadow: 0 2px 10px rgba(25,35,45,.03); }
.detail-card { display: flex; gap: 14px; padding: 16px; }
.detail-cover { display: grid; place-items: center; flex: 0 0 88px; width: 88px; height: 88px; overflow: hidden; border-radius: 18px; background: #e9f8f2; color: #0ab474; font-size: 30px; }
.detail-cover img { width: 100%; height: 100%; object-fit: cover; }
.detail-main { min-width: 0; flex: 1; }
.detail-main h2 { margin: 0 0 6px; font-size: 20px; }
.detail-main p { display: -webkit-box; margin: 0; overflow: hidden; color: #747d87; font-size: 13px; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.detail-stats { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; color: #9299a2; font-size: 12px; }
.detail-stats strong { color: #24282d; font-size: 14px; }
.outline-button, .primary-button, .secondary-button { border-radius: 10px; padding: 8px 15px; font-size: 13px; cursor: pointer; }
.outline-button { margin-top: 12px; border: 1px solid #0ab474; background: #fff; color: #0aa66b; }
.primary-button { border: 0; background: #0ab474; color: #fff; font-weight: 700; }
.primary-button:disabled { opacity: .55; cursor: not-allowed; }
.secondary-button { border: 1px solid #dfe3e7; background: #fff; color: #69727d; }
.community-list { display: flex; flex-direction: column; gap: 10px; }
.community-card { display: flex; align-items: center; gap: 12px; padding: 12px; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
.community-card:active { transform: scale(.99); }
.item-image { flex: 0 0 68px; width: 68px; height: 68px; overflow: hidden; border-radius: 14px; background: #eef1f3; }
.item-image img { width: 100%; height: 100%; object-fit: cover; }
.image-fallback { display: grid; place-items: center; color: #0ab474; font-size: 23px; }
.item-body { min-width: 0; flex: 1; }
.item-title-row { display: flex; align-items: center; gap: 7px; }
.item-title-row h3 { min-width: 0; margin: 0; overflow: hidden; font-size: 15px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.item-badge { flex: 0 0 auto; padding: 3px 6px; border-radius: 5px; background: #e8f8f1; color: #0aa66b; font-size: 10px; }
.item-content { display: -webkit-box; margin: 6px 0; overflow: hidden; color: #727b85; font-size: 12px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.item-meta { display: flex; flex-wrap: wrap; gap: 9px; color: #9aa2ab; font-size: 11px; }
.item-meta span { display: inline-flex; align-items: center; gap: 3px; }
.item-arrow { flex: 0 0 auto; color: #c4cbd2; font-size: 12px; }
.state-card { display: flex; min-height: 190px; align-items: center; justify-content: center; gap: 8px; padding: 22px; color: #8d96a1; text-align: center; flex-direction: column; }
.state-card > i { margin-bottom: 4px; color: #0ab474; font-size: 27px; }
.state-card strong { color: #4b535c; font-size: 16px; }
.state-card span { max-width: 280px; font-size: 13px; line-height: 1.5; }
.error-state > i { color: #e45b55; }
.state-card .primary-button { margin-top: 6px; }
.loading-more, .no-more, .retry-button { padding: 14px; color: #929ba5; text-align: center; font-size: 12px; }
.retry-button { align-self: center; border: 0; background: transparent; color: #0aa66b; cursor: pointer; }
.create-panel { padding: 18px; }
.section-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.heading-mark { width: 5px; height: 34px; border-radius: 5px; background: #0ab474; }
.section-heading h2 { margin: 0; font-size: 20px; }
.section-heading p { margin: 3px 0 0; color: #89929c; font-size: 12px; }
.field-label { display: block; margin: 12px 0 7px; color: #4e5761; font-size: 13px; font-weight: 700; }
.text-field { box-sizing: border-box; width: 100%; border: 1px solid #dfe4e8; border-radius: 12px; padding: 11px 12px; outline: 0; background: #fafbfc; color: #1f2329; font: inherit; font-size: 14px; }
.text-field:focus { border-color: #0ab474; background: #fff; }
.textarea-field { min-height: 112px; resize: vertical; }
.create-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.detail-description { padding: 16px; color: #4f5862; font-size: 14px; line-height: 1.7; }
@media (min-width: 700px) { .mobile-community-page { max-width: 720px; margin: 0 auto; padding-right: 20px; padding-left: 20px; } .community-card:hover { box-shadow: 0 8px 22px rgba(25,35,45,.08); } }
</style>
