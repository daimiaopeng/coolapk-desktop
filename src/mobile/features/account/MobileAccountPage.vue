<template>
  <section class="mobile-account-page" data-mobile-page="account" data-mobile-feature="account" :data-account-kind="pageConfig.kind">
    <header class="mobile-account-page__header">
      <button type="button" class="mobile-account-page__back" aria-label="返回" @click="goBack">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
      </button>
      <div class="mobile-account-page__heading">
        <h1>{{ pageConfig.title }}</h1>
        <p v-if="pageConfig.subtitle">{{ pageConfig.subtitle }}</p>
      </div>
      <button
        v-if="requiresLogin && authStore.isLoggedIn"
        type="button"
        class="mobile-account-page__refresh"
        :disabled="loading || loadingMore"
        aria-label="刷新"
        @click="load(true)"
      >
        <i class="fas fa-rotate-right" :class="{ 'fa-spin': loading }" aria-hidden="true"></i>
      </button>
    </header>

    <nav v-if="pageConfig.tabs.length" class="mobile-account-page__tabs" aria-label="账户列表分类">
      <button
        v-for="tab in pageConfig.tabs"
        :key="tab.key"
        type="button"
        :class="['mobile-account-page__tab', { 'is-active': activeTab === tab.key }]"
        :aria-current="activeTab === tab.key ? 'page' : undefined"
        @click="selectTab(tab.key)"
      >
        <i v-if="tab.icon" :class="tab.icon" aria-hidden="true"></i>
        {{ tab.label }}
      </button>
    </nav>

    <main ref="scrollTarget" class="mobile-account-page__content" @scroll="handleScroll">
      <div v-if="requiresLogin && !authStore.isLoggedIn" class="mobile-account-page__state mobile-account-page__login">
        <div class="mobile-account-page__state-icon"><i class="fas fa-user-lock" aria-hidden="true"></i></div>
        <h2>登录后查看{{ pageConfig.title }}</h2>
        <p>登录酷安账号后，这里的列表会同步你的真实数据。</p>
        <button type="button" class="mobile-account-page__primary" @click="authStore.openLoginModal()">
          <i class="fas fa-right-to-bracket" aria-hidden="true"></i>
          立即登录
        </button>
      </div>

      <div v-else-if="pageConfig.placeholder" class="mobile-account-page__state">
        <div class="mobile-account-page__state-icon"><i :class="pageConfig.icon" aria-hidden="true"></i></div>
        <h2>{{ pageConfig.title }}</h2>
        <p>{{ pageConfig.placeholder }}</p>
        <button v-if="hiddenFeedId" type="button" class="mobile-account-page__secondary" @click="load(true)">
          重新加载
        </button>
      </div>

      <template v-else>
        <div v-if="loading && !items.length" class="mobile-account-page__state" role="status" aria-live="polite">
          <div class="mobile-account-page__state-icon"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i></div>
          <h2>正在加载</h2>
          <p>正在读取酷安数据…</p>
        </div>

        <div v-else-if="error && !items.length" class="mobile-account-page__state mobile-account-page__state--error" role="alert">
          <div class="mobile-account-page__state-icon"><i class="fas fa-cloud-exclamation" aria-hidden="true"></i></div>
          <h2>加载失败</h2>
          <p>{{ error }}</p>
          <button type="button" class="mobile-account-page__primary" @click="load(true)">重试</button>
        </div>

        <div v-else-if="!items.length" class="mobile-account-page__state">
          <div class="mobile-account-page__state-icon"><i class="far fa-folder-open" aria-hidden="true"></i></div>
          <h2>{{ pageConfig.emptyTitle }}</h2>
          <p>{{ pageConfig.emptyText }}</p>
          <button v-if="requiresLogin && !authStore.isLoggedIn" type="button" class="mobile-account-page__primary" @click="authStore.openLoginModal()">
            立即登录
          </button>
        </div>

        <div v-else class="mobile-account-page__list" role="list">
          <article
            v-for="(item, index) in items"
            :key="itemKey(item, index)"
            class="mobile-account-page__row"
            role="listitem"
            tabindex="0"
            @click="openItem(item)"
            @keydown.enter.prevent="openItem(item)"
          >
            <div class="mobile-account-page__avatar">
              <img v-if="itemImage(item)" :src="itemImage(item)" :alt="itemTitle(item)" referrerpolicy="no-referrer" />
              <i v-else :class="rowIcon(item)" aria-hidden="true"></i>
            </div>
            <div class="mobile-account-page__row-copy">
              <strong>{{ itemTitle(item) }}</strong>
              <span>{{ itemSubtitle(item) }}</span>
              <small v-if="itemTime(item)">{{ itemTime(item) }}</small>
            </div>
            <div class="mobile-account-page__row-actions" @click.stop>
              <button
                v-if="canToggleFollow(item)"
                type="button"
                class="mobile-account-page__row-action"
                :disabled="pendingKey === itemKey(item, index)"
                @click="toggleFollow(item, index)"
              >
                {{ pendingKey === itemKey(item, index) ? '处理中' : isFollowingItem(item) ? '已关注' : '关注' }}
              </button>
              <button
                v-else-if="canUnfollowContent"
                type="button"
                class="mobile-account-page__row-action mobile-account-page__row-action--danger"
                :disabled="pendingKey === itemKey(item, index)"
                @click="unfollowContent(item, index)"
              >
                {{ pendingKey === itemKey(item, index) ? '处理中' : '取消关注' }}
              </button>
              <button
                v-else-if="canRemoveItem"
                type="button"
                class="mobile-account-page__row-action mobile-account-page__row-action--danger"
                :disabled="pendingKey === itemKey(item, index)"
                @click="removeItem(item, index)"
              >
                {{ pendingKey === itemKey(item, index) ? '处理中' : '移出' }}
              </button>
              <i v-else class="fas fa-chevron-right mobile-account-page__row-chevron" aria-hidden="true"></i>
            </div>
          </article>
        </div>

        <div v-if="error && items.length" class="mobile-account-page__inline-error" role="alert">
          <span>{{ error }}</span>
          <button type="button" @click="load(false)">重试</button>
        </div>
        <div v-if="items.length" class="mobile-account-page__pagination">
          <i v-if="loadingMore" class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <button v-else-if="hasMore" type="button" @click="load(false)">加载更多</button>
          <span v-else>已加载全部内容</span>
        </div>
      </template>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { useAuthStore } from '../../../stores/auth';
import { entityImage, normalizeEntityPage, type UserSpaceEntity } from '../../../types/userSpace';

defineOptions({ name: 'MobileAccountPage' });

type AccountKind =
  | 'following'
  | 'blacklist'
  | 'nodes'
  | 'topics'
  | 'contacts'
  | 'recycle'
  | 'hidden'
  | 'devices'
  | 'votes'
  | 'relations';

interface AccountTab { key: string; label: string; icon?: string }

interface PageConfig {
  kind: AccountKind;
  title: string;
  subtitle: string;
  icon: string;
  emptyTitle: string;
  emptyText: string;
  placeholder: string;
  tabs: AccountTab[];
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const scrollTarget = ref<HTMLElement | null>(null);
const items = ref<UserSpaceEntity[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const page = ref(1);
const hasMore = ref(true);
const firstItem = ref('');
const lastItem = ref('');
const pendingKey = ref('');
const activeTab = ref('');
let requestId = 0;

function routeValue(value: unknown): string {
  return String(Array.isArray(value) ? value[0] || '' : value || '').trim();
}

function pathKind(path: string): AccountKind {
  if (/^\/user\/[^/]+\/relations\/(follow|fans)$/.test(path)) return 'relations';
  if (path === '/following') return 'following';
  if (path === '/blacklist') return 'blacklist';
  if (path === '/followed-nodes') return 'nodes';
  if (path === '/followed-topics') return 'topics';
  if (path === '/recent-contacts') return 'contacts';
  if (path === '/recycle-bin') return 'recycle';
  if (path === '/hidden-replies') return 'hidden';
  if (path === '/my-devices') return 'devices';
  return 'votes';
}

const pageKind = computed(() => pathKind(route.path));
const relationType = computed(() => routeValue(route.params.relation) === 'fans' ? 'fans' : 'follow');
const userUid = computed(() => routeValue(route.params.uid));
const hiddenFeedId = computed(() => routeValue(route.query.feedId));
const category = computed(() => routeValue(route.query.category) || routeValue(route.meta.mode));

const pageConfig = computed<PageConfig>(() => {
  const kind = pageKind.value;
  if (kind === 'relations') {
    const fans = relationType.value === 'fans';
    return {
      kind,
      title: fans ? '粉丝列表' : '关注列表',
      subtitle: userUid.value ? `UID ${userUid.value}` : '',
      icon: fans ? 'fas fa-users' : 'fas fa-user-plus',
      emptyTitle: fans ? '暂无粉丝' : '暂无关注用户',
      emptyText: fans ? '还没有酷友关注该用户' : '该用户还没有关注任何人',
      placeholder: userUid.value ? '' : '缺少用户 UID，无法读取关系列表。',
      tabs: [
        { key: 'follow', label: '关注', icon: 'fas fa-user-plus' },
        { key: 'fans', label: '粉丝', icon: 'fas fa-users' },
      ],
    };
  }

  const configs: Record<AccountKind, PageConfig> = {
    following: {
      kind,
      title: ({ feeds: '关注动态', users: '关注酷友', nodes: '关注论坛', topics: '关注话题', collections: '关注收藏单', questions: '关注问题', products: '关注数码吧' } as Record<string, string>)[category.value || 'feeds'] || '我的关注',
      subtitle: '同步账号关注的内容',
      icon: 'fas fa-user-plus', emptyTitle: '暂无关注内容', emptyText: '关注酷友、论坛或话题后会显示在这里', placeholder: '',
      tabs: [
        { key: 'feeds', label: '动态', icon: 'fas fa-stream' },
        { key: 'users', label: '酷友', icon: 'fas fa-user' },
        { key: 'nodes', label: '论坛', icon: 'fas fa-comments' },
        { key: 'topics', label: '话题', icon: 'fas fa-hashtag' },
        { key: 'collections', label: '收藏单', icon: 'fas fa-folder-open' },
        { key: 'questions', label: '问题', icon: 'fas fa-circle-question' },
        { key: 'products', label: '数码吧', icon: 'fas fa-mobile-screen-button' },
      ],
    },
    blacklist: {
      kind,
      title: ({ black: '黑名单', ignore: '屏蔽名单', limit: '限制名单' } as Record<string, string>)[routeValue(route.query.tab) || 'black'] || '黑名单',
      subtitle: '管理拉黑、屏蔽与限制的酷友',
      icon: 'fas fa-user-slash', emptyTitle: '暂无名单内容', emptyText: '当前分类还没有用户', placeholder: '',
      tabs: [
        { key: 'black', label: '拉黑' },
        { key: 'ignore', label: '屏蔽' },
        { key: 'limit', label: '限制' },
      ],
    },
    nodes: { kind, title: '我关注的论坛', subtitle: '同步账号关注的论坛与节点', icon: 'fas fa-comments', emptyTitle: '暂无关注论坛', emptyText: '关注的论坛会显示在这里', placeholder: '', tabs: [] },
    topics: { kind, title: '我关注的话题', subtitle: '同步账号关注的话题', icon: 'fas fa-hashtag', emptyTitle: '暂无关注话题', emptyText: '关注的话题会显示在这里', placeholder: '', tabs: [] },
    contacts: { kind, title: '最近联系人', subtitle: '最近私信联系过的酷友', icon: 'far fa-address-book', emptyTitle: '暂无最近联系人', emptyText: '最近的私信联系人会显示在这里', placeholder: '', tabs: [] },
    recycle: { kind, title: '内容回收站', subtitle: '账号可见的被删或垃圾动态', icon: 'fas fa-trash-can', emptyTitle: '暂无回收站内容', emptyText: '当前账号没有可查看的回收站内容', placeholder: '', tabs: [] },
    hidden: { kind, title: '隐藏的回复', subtitle: hiddenFeedId.value ? `动态 ${hiddenFeedId.value}` : '需要指定动态 ID 才能读取', icon: 'far fa-eye-slash', emptyTitle: '暂无隐藏回复', emptyText: '该动态没有可见的隐藏回复', placeholder: hiddenFeedId.value ? '' : '酷安接口需要指定动态 ID。请从具体动态进入后再查看隐藏回复。', tabs: [] },
    devices: { kind, title: '我的设备', subtitle: '账号拥有的数码设备', icon: 'fas fa-mobile-screen-button', emptyTitle: '暂无已拥有设备', emptyText: '添加或拥有数码产品后会显示在这里', placeholder: '', tabs: [] },
    votes: { kind, title: '我的投票', subtitle: '账号参与过的投票', icon: 'fas fa-square-poll-vertical', emptyTitle: '暂无投票记录', emptyText: '当前客户端没有可确认的个人投票记录接口', placeholder: '酷安当前公开接口没有可确认的“我的投票记录”端点，因此不展示猜测数据。', tabs: [] },
    relations: {} as PageConfig,
  };
  return configs[kind];
});

const requiresLogin = computed(() => !['relations'].includes(pageKind.value));
const canRemoveItem = computed(() => pageKind.value === 'blacklist');
const canUnfollowContent = computed(() => pageKind.value === 'following' && ['collections', 'questions', 'products'].includes(effectiveTab()));

function effectiveTab(): string {
  if (pageKind.value === 'relations') return relationType.value;
  if (pageKind.value === 'following') return category.value || 'feeds';
  if (pageKind.value === 'blacklist') return routeValue(route.query.tab) || 'black';
  return pageKind.value;
}

function entityList(value: unknown): UserSpaceEntity[] {
  const response = value as any;
  const payload = response?.data ?? response;
  const candidates = Array.isArray(payload)
    ? payload
    : ['entities', 'items', 'list', 'rows', 'data'].flatMap(key => Array.isArray(payload?.[key]) ? payload[key] : []);
  const result: UserSpaceEntity[] = [];
  for (const row of candidates) {
    if (row && typeof row === 'object' && Array.isArray((row as any).entities) && !(row as any).entityTemplate) result.push(...(row as any).entities);
    else if (row && typeof row === 'object') result.push(row as UserSpaceEntity);
  }
  return result;
}

function currentUid(): string {
  return String(authStore.user?.uid || '').trim();
}

async function fetchPage(requestedPage: number): Promise<any> {
  const kind = pageKind.value;
  const tab = effectiveTab();
  if (kind === 'relations') {
    return relationType.value === 'fans'
      ? CoolapkTauriAPI.getFansList(userUid.value, requestedPage)
      : CoolapkTauriAPI.getFollowUserList(userUid.value, requestedPage);
  }
  if (kind === 'following') {
    if (tab === 'users') return CoolapkTauriAPI.getFollowUserList(currentUid(), requestedPage);
    if (tab === 'nodes') return CoolapkTauriAPI.getUserForumFollowList(currentUid(), requestedPage);
    if (tab === 'topics') return CoolapkTauriAPI.getFollowedTopics(requestedPage);
    if (tab === 'collections') return CoolapkTauriAPI.getFollowedCollections(requestedPage);
    if (tab === 'questions') return CoolapkTauriAPI.getFollowedQuestions(requestedPage);
    if (tab === 'products') return CoolapkTauriAPI.getFollowedProducts(requestedPage);
    return CoolapkTauriAPI.getFollowingFeeds(requestedPage);
  }
  if (kind === 'blacklist') {
    if (tab === 'ignore') return CoolapkTauriAPI.getIgnoreList(requestedPage);
    if (tab === 'limit') return CoolapkTauriAPI.getLimitList(requestedPage);
    return CoolapkTauriAPI.getBlackList(requestedPage);
  }
  if (kind === 'nodes') return CoolapkTauriAPI.getUserForumFollowList(currentUid(), requestedPage);
  if (kind === 'topics') return CoolapkTauriAPI.getFollowedTopics(requestedPage);
  if (kind === 'contacts') return CoolapkTauriAPI.getRecentChatUsers(requestedPage);
  if (kind === 'recycle') return CoolapkTauriAPI.getSpamFeedList(requestedPage);
  if (kind === 'hidden') return CoolapkTauriAPI.getHiddenReplies(hiddenFeedId.value, requestedPage);
  if (kind === 'devices') return CoolapkTauriAPI.getMyProductList(currentUid(), 'owner', requestedPage);
  return null;
}

async function load(reset = false): Promise<void> {
  if (loading.value || loadingMore.value || pageConfig.value.placeholder || (requiresLogin.value && !authStore.isLoggedIn)) return;
  if (!reset && !hasMore.value) return;
  const request = ++requestId;
  if (reset) {
    page.value = 1;
    firstItem.value = '';
    lastItem.value = '';
    hasMore.value = true;
    items.value = [];
    error.value = '';
    loading.value = true;
  } else loadingMore.value = true;
  const requestedPage = page.value;
  try {
    const response = await fetchPage(requestedPage);
    if (request !== requestId) return;
    const normalized = normalizeEntityPage(response, requestedPage);
    const incoming = normalized.items.length ? normalized.items : entityList(response);
    const known = new Set(items.value.map((item, index) => itemKey(item, index)));
    const fresh = incoming.filter((item, index) => !known.has(itemKey(item, index)));
    items.value = reset ? incoming : [...items.value, ...fresh];
    if (requestedPage === 1) firstItem.value = normalized.firstItem;
    const previousLast = lastItem.value;
    lastItem.value = normalized.lastItem || itemKey(incoming[incoming.length - 1], incoming.length - 1);
    page.value = requestedPage + 1;
    hasMore.value = incoming.length > 0 && normalized.hasMore && fresh.length > 0 && lastItem.value !== previousLast;
  } catch (cause) {
    if (request !== requestId) return;
    error.value = cause instanceof Error ? cause.message : '加载失败，请稍后重试';
  } finally {
    if (request === requestId) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function selectTab(tab: string): void {
  if (pageKind.value === 'relations') {
    if (tab !== relationType.value) void router.replace(`/user/${encodeURIComponent(userUid.value)}/relations/${tab}`);
    return;
  }
  if (pageKind.value === 'following') {
    void router.replace({ path: '/following', query: tab === 'feeds' ? {} : { category: tab } });
    return;
  }
  if (pageKind.value === 'blacklist') void router.replace({ path: '/blacklist', query: { tab } });
}

function itemKey(item: any, index: number): string {
  return String(item?.uid ?? item?.fuid ?? item?.entityId ?? item?.id ?? item?.feedId ?? item?.packageName ?? item?.url ?? `${pageKind.value}-${index}`);
}

function itemTitle(item: any): string {
  return String(item?.username || item?.fusername || item?.displayUsername || item?.userInfo?.username || item?.title || item?.name || item?.collectionTitle || item?.topicName || item?.tag || item?.deviceTitle || item?.model || item?.packageName || item?.message || '未命名内容');
}

function itemSubtitle(item: any): string {
  const value = item?.bio || item?.signature || item?.description || item?.subTitle || item?.intro || item?.model || item?.brandName || item?.ukey || item?.packageName || item?.entityTypeName || item?.message;
  if (value) return String(value);
  if (pageKind.value === 'following' && effectiveTab() === 'feeds') return '关注动态';
  if (pageKind.value === 'recycle') return '回收站动态';
  if (pageKind.value === 'contacts') return '点击进入私信';
  return `UID ${String(item?.uid || item?.fuid || '')}`.trim();
}

function itemTime(item: any): string {
  const value = item?.dateline || item?.lastMessageTime || item?.last_time || item?.time;
  if (!value) return '';
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const timestamp = Number(value) < 2_000_000_000 ? Number(value) * 1000 : Number(value);
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('zh-CN');
  }
  return String(value);
}

function itemImage(item: any): string {
  const image = entityImage(item);
  if (image) return image;
  const uid = String(item?.uid || item?.fuid || item?.userInfo?.uid || '').trim();
  if (!uid || pageKind.value === 'recycle' || (pageKind.value === 'following' && effectiveTab() === 'feeds')) return '';
  const padded = uid.padStart(9, '0');
  return `https://avatar.coolapk.com/data/${padded.slice(0, 3)}/${padded.slice(3, 5)}/${padded.slice(5, 7)}/${uid.slice(-2)}_avatar_middle.jpg`;
}

function rowIcon(item: any): string {
  const type = String(item?.entityType || item?.entity_type || '').toLowerCase();
  if (type.includes('feed') || pageKind.value === 'recycle' || (pageKind.value === 'following' && effectiveTab() === 'feeds')) return 'fas fa-comment-dots';
  if (type.includes('topic') || pageKind.value === 'topics') return 'fas fa-hashtag';
  if (type.includes('product') || pageKind.value === 'devices') return 'fas fa-mobile-screen-button';
  if (pageKind.value === 'contacts') return 'far fa-comment';
  if (pageKind.value === 'nodes' || (pageKind.value === 'following' && effectiveTab() === 'nodes')) return 'fas fa-comments';
  return 'fas fa-user';
}

function isFollowingItem(item: any): boolean {
  const value = item?.isFollow ?? item?.is_follow ?? item?.userInfo?.isFollow;
  return value === true || value === 1 || value === '1';
}

function canToggleFollow(item: any): boolean {
  return pageKind.value === 'relations' || (pageKind.value === 'following' && effectiveTab() === 'users');
}

async function unfollowContent(item: any, index: number): Promise<void> {
  if (!canUnfollowContent.value) return;
  const tab = effectiveTab();
  const target = String(item?.collectionId || item?.questionId || item?.productId || item?.id || item?.entityId || '').trim();
  if (!target) return;
  const key = itemKey(item, index);
  pendingKey.value = key;
  try {
    if (tab === 'collections') await CoolapkTauriAPI.unfollowCollection(target);
    else if (tab === 'questions') await CoolapkTauriAPI.unfollowQuestion(target);
    else await CoolapkTauriAPI.changeProductFollowStatus(target, 0);
    items.value = items.value.filter((entry, entryIndex) => itemKey(entry, entryIndex) !== key);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '取消关注失败，请重试';
  } finally {
    pendingKey.value = '';
  }
}

async function toggleFollow(item: any, index: number): Promise<void> {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const uid = String(item?.uid || item?.fuid || item?.id || '').trim();
  if (!uid) return;
  const key = itemKey(item, index);
  pendingKey.value = key;
  try {
    if (isFollowingItem(item)) await CoolapkTauriAPI.unfollowUser(uid);
    else await CoolapkTauriAPI.followUser(uid);
    item.isFollow = isFollowingItem(item) ? 0 : 1;
    if (item.userInfo) item.userInfo.isFollow = item.isFollow;
    if (pageKind.value === 'following' && effectiveTab() === 'users' && item.isFollow === 0) {
      items.value = items.value.filter((entry, entryIndex) => itemKey(entry, entryIndex) !== key);
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '关注操作失败，请重试';
  } finally {
    pendingKey.value = '';
  }
}

async function removeItem(item: any, index: number): Promise<void> {
  if (pageKind.value !== 'blacklist') return;
  const uid = String(item?.uid || item?.fuid || item?.id || '').trim();
  if (!uid) return;
  const key = itemKey(item, index);
  pendingKey.value = key;
  try {
    const tab = effectiveTab();
    if (tab === 'black') await CoolapkTauriAPI.removeFromBlackList(uid);
    else if (tab === 'ignore') await CoolapkTauriAPI.removeFromIgnoreList(uid);
    items.value = items.value.filter((entry, entryIndex) => itemKey(entry, entryIndex) !== key);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '移出名单失败，请重试';
  } finally {
    pendingKey.value = '';
  }
}

function openItem(item: any): void {
  const url = String(item?.url || '').trim();
  if (url.startsWith('/')) {
    void router.push(url);
    return;
  }
  const uid = String(item?.uid || item?.fuid || item?.userInfo?.uid || '').trim();
  const feedId = String(item?.feedId || (String(item?.entityType || '').toLowerCase().includes('feed') ? item?.entityId : '') || '').trim();
  const type = String(item?.entityType || item?.entity_type || '').toLowerCase();
  if (pageKind.value === 'contacts') {
    if (uid) void router.push({ path: '/messages', query: { uid } });
    return;
  }
  if (feedId || type.includes('feed') || pageKind.value === 'recycle') {
    const id = feedId || String(item?.id || item?.entityId || '').trim();
    if (id) void router.push(`/feed/${encodeURIComponent(id)}`);
    return;
  }
  if (pageKind.value === 'topics' || (pageKind.value === 'following' && effectiveTab() === 'topics')) {
    const tag = String(item?.tag || item?.topicName || item?.title || item?.name || '').trim();
    if (tag) void router.push(`/topic/${encodeURIComponent(tag)}`);
    return;
  }
  if (pageKind.value === 'devices') {
    const id = String(item?.productId || item?.id || item?.entityId || '').trim();
    if (id) void router.push(`/product/${encodeURIComponent(id)}`);
    return;
  }
  if (uid && (pageKind.value === 'relations' || pageKind.value === 'blacklist' || pageKind.value === 'following' && effectiveTab() === 'users')) {
    void router.push(`/user/${encodeURIComponent(uid)}`);
  }
}

function handleScroll(event: Event): void {
  const target = event.target as HTMLElement;
  if (target && target.scrollHeight - target.scrollTop - target.clientHeight < 180) void load(false);
}

function goBack(): void {
  if (window.history.length > 1) router.back();
  else void router.push('/my');
}

function resetFromRoute(): void {
  activeTab.value = effectiveTab();
  void load(true);
}

watch(() => route.fullPath, resetFromRoute);
watch(() => authStore.isLoggedIn, () => void load(true));
onMounted(() => {
  activeTab.value = effectiveTab();
  void load(true);
});
</script>

<style scoped>
:host { --account-green: #0f9d58; --account-bg: #f2f2f6; --account-text: #25262a; --account-muted: #858991; }
.mobile-account-page { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; min-height: 0; width: 100%; height: 100%; overflow: hidden; background: var(--account-bg); color: var(--account-text); }
.mobile-account-page__header { display: flex; flex: 0 0 58px; align-items: center; gap: 8px; padding: max(0px, env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-right, 0px)) 0 max(14px, env(safe-area-inset-left, 0px)); border-bottom: 1px solid #e5e5e8; background: #fff; }
.mobile-account-page__back, .mobile-account-page__refresh { display: grid; flex: 0 0 38px; place-items: center; width: 38px; height: 38px; border: 0; border-radius: 50%; background: transparent; color: #27282c; font-size: 18px; }
.mobile-account-page__back:active, .mobile-account-page__refresh:active { background: #f0f1f2; }
.mobile-account-page__refresh { color: var(--account-green); }
.mobile-account-page__refresh:disabled { opacity: .5; }
.mobile-account-page__heading { flex: 1 1 auto; min-width: 0; }
.mobile-account-page__heading h1 { margin: 0; overflow: hidden; font-size: 19px; font-weight: 700; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.mobile-account-page__heading p { margin: 3px 0 0; overflow: hidden; color: var(--account-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-account-page__tabs { display: flex; flex: 0 0 auto; gap: 6px; overflow-x: auto; padding: 9px max(12px, env(safe-area-inset-left, 0px)); background: #fff; scrollbar-width: none; }
.mobile-account-page__tabs::-webkit-scrollbar { display: none; }
.mobile-account-page__tab { flex: 0 0 auto; min-height: 34px; padding: 0 13px; border: 0; border-radius: 999px; background: #f3f4f5; color: #70747b; font: inherit; font-size: 13px; white-space: nowrap; }
.mobile-account-page__tab.is-active { background: #def5e8; color: var(--account-green); font-weight: 650; }
.mobile-account-page__tab i { margin-right: 5px; }
.mobile-account-page__content { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 12px max(12px, env(safe-area-inset-right, 0px)) calc(92px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px)); -webkit-overflow-scrolling: touch; }
.mobile-account-page__list { display: grid; gap: 8px; max-width: 760px; margin: 0 auto; }
.mobile-account-page__row { display: flex; align-items: center; gap: 11px; min-height: 68px; padding: 10px 12px; border: 1px solid #e8e8eb; border-radius: 17px; outline: 0; background: #fff; box-shadow: 0 2px 8px rgba(35, 42, 48, .025); }
.mobile-account-page__row:focus-visible { border-color: #8fd8af; box-shadow: 0 0 0 3px rgba(15, 157, 88, .13); }
.mobile-account-page__avatar { display: grid; flex: 0 0 46px; place-items: center; width: 46px; height: 46px; overflow: hidden; border-radius: 14px; background: #e4f6ed; color: var(--account-green); font-size: 19px; }
.mobile-account-page__avatar img { width: 100%; height: 100%; object-fit: cover; }
.mobile-account-page__row-copy { display: flex; flex: 1 1 auto; min-width: 0; flex-direction: column; gap: 3px; }
.mobile-account-page__row-copy strong, .mobile-account-page__row-copy span, .mobile-account-page__row-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-account-page__row-copy strong { font-size: 15px; font-weight: 650; }
.mobile-account-page__row-copy span { color: #747980; font-size: 12px; }
.mobile-account-page__row-copy small { color: #b0b3b8; font-size: 11px; }
.mobile-account-page__row-actions { display: flex; flex: 0 0 auto; align-items: center; }
.mobile-account-page__row-action { min-width: 54px; min-height: 31px; padding: 0 10px; border: 1px solid #b9e3cb; border-radius: 999px; background: #effaf3; color: var(--account-green); font: inherit; font-size: 12px; }
.mobile-account-page__row-action--danger { border-color: #f2c6c3; background: #fff4f3; color: #e4554f; }
.mobile-account-page__row-action:disabled { opacity: .55; }
.mobile-account-page__row-chevron { color: #b0b3b8; font-size: 13px; }
.mobile-account-page__state { display: flex; align-items: center; justify-content: center; min-height: 260px; flex-direction: column; gap: 8px; padding: 30px 20px; color: var(--account-muted); text-align: center; }
.mobile-account-page__state-icon { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 20px; background: #e6f6ed; color: var(--account-green); font-size: 24px; }
.mobile-account-page__state--error .mobile-account-page__state-icon { background: #fff0ef; color: #e4554f; }
.mobile-account-page__state h2 { margin: 6px 0 0; color: var(--account-text); font-size: 18px; }
.mobile-account-page__state p { max-width: 330px; margin: 0; font-size: 13px; line-height: 1.6; }
.mobile-account-page__primary, .mobile-account-page__secondary { min-height: 40px; padding: 0 18px; border-radius: 999px; font: inherit; font-size: 13px; }
.mobile-account-page__primary { border: 0; background: var(--account-green); color: #fff; }
.mobile-account-page__secondary { border: 1px solid #cfd4d6; background: #fff; color: #51555a; }
.mobile-account-page__primary i { margin-right: 5px; }
.mobile-account-page__pagination { display: flex; align-items: center; justify-content: center; min-height: 52px; gap: 8px; color: #969aa0; font-size: 12px; }
.mobile-account-page__pagination button, .mobile-account-page__inline-error button { border: 0; background: transparent; color: var(--account-green); font: inherit; }
.mobile-account-page__inline-error { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; color: #d7554d; font-size: 12px; }
button { cursor: pointer; touch-action: manipulation; }
button:disabled { cursor: wait; }
</style>
