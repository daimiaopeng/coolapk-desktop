<template>
  <div class="user-home-card-rows">
    <template v-for="(row, rowIndex) in normalizedRows" :key="rowKey(row, rowIndex)">
      <!-- 1. 关注的人 (横向头像滑动卡片) -->
      <section v-if="row.kind === 'user'" class="home-section-card">
        <div class="section-header clickable" @click="handleSectionHeaderClick(row)">
          <div class="section-header-left">
            <h3 class="section-title">{{ row.displayTitle }}</h3>
            <p v-if="row.subtitle" class="section-subtitle">{{ row.subtitle }}</p>
          </div>
          <i class="fas fa-chevron-right section-action-icon"></i>
        </div>
        <div class="home-follow-user-list custom-scrollbar-hidden">
          <button
            v-for="(entity, entityIndex) in row.entities"
            :key="entityKey(entity, entityIndex)"
            class="home-follow-user"
            type="button"
            @click="openEntity(entity)"
          >
            <AppAvatar :src="avatarFor(entity)" size="lg" />
            <span class="home-follow-user-name">{{ userNameFor(entity) }}</span>
          </button>
        </div>
      </section>

      <!-- 2. 关注的板块 (横向图标滑动卡片) -->
      <section v-else-if="row.kind === 'topic'" class="home-section-card">
        <div class="section-header clickable" @click="handleSectionHeaderClick(row)">
          <div class="section-header-left">
            <h3 class="section-title">{{ row.displayTitle }}</h3>
            <p v-if="row.subtitle" class="section-subtitle">{{ row.subtitle }}</p>
          </div>
          <i class="fas fa-chevron-right section-action-icon"></i>
        </div>
        <div class="home-follow-topic-list custom-scrollbar-hidden">
          <button
            v-for="(entity, entityIndex) in row.entities"
            :key="entityKey(entity, entityIndex)"
            class="home-follow-topic"
            type="button"
            @click="openEntity(entity)"
          >
            <AppImage
              v-if="imageFor(entity)"
              :src="imageFor(entity)"
              :alt="topicNameFor(entity)"
              image-class="home-follow-topic-image"
              fit="contain"
            />
            <span v-else class="home-follow-topic-icon-fallback">
              <i class="fas fa-layer-group"></i>
            </span>
            <span class="home-follow-topic-name">{{ topicNameFor(entity) }}</span>
          </button>
        </div>
      </section>

      <!-- 3. 热门动态列表（与 APK 保持一致规范：支持无限下拉向下刷动态） -->
      <div v-else class="home-feed-group">
        <div
          class="home-feed-section-header clickable"
          @click="handleSectionHeaderClick(row)"
        >
          <span class="home-feed-section-title">{{ row.displayTitle }}</span>
          <i class="fas fa-chevron-right section-action-icon"></i>
        </div>
        <div class="home-feed-items">
          <UserEntityCard
            v-for="(entity, entityIndex) in allRowFeeds(row)"
            :key="entityKey(entity, entityIndex)"
            :entity="entity"
            :tab="row.tab"
            @deleted="(id) => emit('deleted', id)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import UserEntityCard from './UserEntityCard.vue';
import AppAvatar from '../common/AppAvatar.vue';
import AppImage from '../common/AppImage.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { entityKey, extractUserSpaceItems } from '../../types/userSpace';
import type { UserSpaceEntity } from '../../types/userSpace';

const props = defineProps<{
  rows: UserSpaceEntity[];
  extraFeeds?: UserSpaceEntity[];
  uid?: string;
  isSelf?: boolean;
}>();

const emit = defineEmits<{
  (event: 'deleted', id: string | number): void;
  (event: 'switch-tab', tabKey: string): void;
}>();

const router = useRouter();

interface HomeRow {
  title: string;
  displayTitle: string;
  subtitle: string;
  url: string;
  tab: string;
  emptyText: string;
  entities: UserSpaceEntity[];
  kind: 'user' | 'topic' | 'generic';
  original: UserSpaceEntity;
}

function formatDisplayTitle(rawTitle: string, kind: HomeRow['kind'], isSelf: boolean): string {
  const trimmed = rawTitle.trim();
  if (kind === 'generic' || kind === 'feed' || trimmed.endsWith('的动态') || trimmed.includes('热门动态')) {
    return isSelf ? '热门动态' : (trimmed.includes('TA') ? trimmed : '热门动态');
  }
  if (kind === 'user') {
    if (!trimmed) return isSelf ? '我关注的人' : 'TA关注的人';
    return isSelf ? trimmed.replace(/^TA/g, '我') : trimmed;
  }
  if (kind === 'topic') {
    if (!trimmed) return isSelf ? '我关注的板块' : 'TA关注的板块';
    return isSelf ? trimmed.replace(/^TA/g, '我') : trimmed;
  }
  return trimmed || '内容列表';
}

function allRowFeeds(row: HomeRow): UserSpaceEntity[] {
  const base = row.entities || [];
  const extras = props.extraFeeds || [];
  if (!extras.length) return base;
  const existing = new Set(base.map((item, index) => entityIdentity(item, index)));
  const incoming = extras.filter((item, index) => !existing.has(entityIdentity(item, index)));
  return [...base, ...incoming];
}

const normalizedRows = computed(() => {
  const result: HomeRow[] = [];
  const groupedLeafRows = new Map<string, HomeRow>();
  const isSelf = Boolean(props.isSelf);

  for (const row of props.rows) {
    const source = (row || {}) as any;
    const entities = extractUserSpaceItems([source]);

    // APK 规则：无实体内容的空卡片一律跳过不展示，不渲染带“暂无内容”的无效卡片
    if (!entities.length) continue;

    const kind = rowKind(source, entities);
    const rawTitle = String(source.title ?? source.name ?? source.label ?? '');
    const displayTitle = formatDisplayTitle(rawTitle, kind, isSelf);

    const normalized: HomeRow = {
      title: rawTitle,
      displayTitle,
      subtitle: String(source.subTitle ?? source.subtitle ?? source.description ?? ''),
      url: typeof source.url === 'string' ? source.url : typeof source.actionUrl === 'string' ? source.actionUrl : '',
      tab: String(source.tab ?? source.tabKey ?? source.entityTemplate ?? ''),
      emptyText: String(source.emptyText ?? ''),
      entities,
      kind,
      original: row,
    };
    const groupKey = displayTitle.trim().replace(/\s+/g, ' ');

    // user/space 可能把同一主页分区拆成多条叶子 Entity；按标题合并，避免重复的大卡片。
    if (groupKey && !groupedLeafRows.has(groupKey)) {
      groupedLeafRows.set(groupKey, normalized);
      result.push(normalized);
      continue;
    }
    if (groupKey && groupedLeafRows.has(groupKey)) {
      const existing = groupedLeafRows.get(groupKey)!;
      const existingKeys = new Set(existing.entities.map((entity, index) => entityIdentity(entity, index)));
      for (const entity of normalized.entities) {
        const key = entityIdentity(entity, existing.entities.length);
        if (!existingKeys.has(key)) {
          existing.entities.push(entity);
          existingKeys.add(key);
        }
      }
      continue;
    }
    result.push(normalized);
  }
  return result;
});

function handleSectionHeaderClick(row: HomeRow) {
  if (row.kind === 'user') {
    const targetUid = props.uid || (row.original as any).uid;
    if (targetUid) {
      void router.push(`/user/${targetUid}/relations/follow`);
      return;
    }
  }
  if (row.kind === 'generic') {
    emit('switch-tab', 'feed');
    return;
  }
  if (row.url) {
    void openUrl(row.url);
  }
}

function entityIdentity(entity: UserSpaceEntity, index: number): string {
  const source = entity as any;
  if (source.uid ?? source.userId) return `user:${source.uid ?? source.userId}`;
  return entityKey(entity, index);
}

function rowKey(row: HomeRow, index: number): string {
  return entityKey(row.original, index);
}

function rowKind(source: Record<string, any>, entities: UserSpaceEntity[]): HomeRow['kind'] {
  const title = String(source.title ?? source.name ?? source.label ?? '').trim();
  const tab = String(source.tab ?? source.tabKey ?? '').toLowerCase();
  const template = String(source.entityTemplate ?? source.template ?? '').toLowerCase();
  const firstEntity = (entities[0] || {}) as any;
  const entityType = String(firstEntity.entityType ?? firstEntity.entityTypeName ?? firstEntity.type ?? '').toLowerCase();

  // 1. 板块 / 话题 / 节点横排卡片
  if (
    template.includes('node') ||
    template.includes('topic') ||
    tab.includes('node') ||
    tab.includes('topic') ||
    title.includes('关注的板块') ||
    title.includes('关注节点') ||
    title.includes('关注的话题') ||
    entityType === 'topic' ||
    entityType === 'node'
  ) {
    return 'topic';
  }

  // 2. 关注用户横排头像：必须是明确的用户列表模板或“关注的人”标题，且实体本身不是动态 (没有 message/feed_id)
  const isUserListHeader = (
    template.includes('userlist') ||
    template.includes('followuser') ||
    tab.includes('follow') ||
    title.includes('关注的人') ||
    title.includes('关注用户') ||
    title.includes('关注的酷友') ||
    title.includes('粉丝')
  );

  const hasFeedContent = entities.some((e: any) => Boolean(e?.message || e?.message_title || e?.feed_id || e?.replynum !== undefined || e?.likenum !== undefined));

  if ((isUserListHeader || entityType === 'user') && !hasFeedContent) {
    return 'user';
  }

  return 'generic';
}

function userNameFor(entity: UserSpaceEntity): string {
  const source = entity as any;
  return String(source.username ?? source.userName ?? source.displayUserName ?? source.title ?? source.name ?? '酷友');
}

function topicNameFor(entity: UserSpaceEntity): string {
  const source = entity as any;
  return String(source.nodeTitle ?? source.nodeName ?? source.topicName ?? source.title ?? source.name ?? '未命名板块');
}

function imageFor(entity: UserSpaceEntity): string {
  const source = entity as any;
  const value = source.logo ?? source.icon ?? source.nodeLogo ?? source.topicLogo ?? source.pic ?? source.image ?? source.cover;
  return typeof value === 'string' ? value : String(value?.url ?? value?.src ?? '');
}

function avatarFor(entity: UserSpaceEntity): string {
  const source = entity as any;
  if (source.userAvatar || source.avatar || source.avatarUrl) return String(source.userAvatar ?? source.avatar ?? source.avatarUrl);
  const uid = source.uid ?? source.userId;
  if (!uid) return '';
  const value = String(uid).padStart(9, '0');
  return `https://avatar.coolapk.com/data/${value.slice(0, 3)}/${value.slice(3, 5)}/${value.slice(5, 7)}/${String(uid).slice(-2)}_avatar_middle.jpg`;
}

async function openUrl(url: string) {
  if (!url) return;
  if (url.startsWith('/')) {
    void router.push(url);
    return;
  }
  try {
    const parsed = new URL(url);
    if (!['www.coolapk.com', 'm.coolapk.com', 'coolapk.com'].includes(parsed.hostname.toLowerCase()) && !parsed.hostname.toLowerCase().endsWith('.coolapk.com')) return;
    await CoolapkTauriAPI.openUrl(parsed.toString());
  } catch {
    // 服务端下发的异常链接不执行跳转。
  }
}

async function openEntity(entity: UserSpaceEntity) {
  const source = entity as any;
  const uid = source.uid ?? source.userId;
  if (uid && (source.username || source.userName || source.entityType === 'user')) {
    void router.push(`/user/${uid}`);
    return;
  }
  if (typeof source.url === 'string') await openUrl(source.url);
}
</script>

<style scoped>
.user-home-card-rows { display: flex; flex-direction: column; gap: var(--space-4); }
.home-section-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 16px; box-shadow: var(--shadow-sm); }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-header.clickable { cursor: pointer; }
.section-header.clickable:hover .section-title { color: var(--brand-primary, #10b981); }
.section-header.clickable:hover .section-action-icon { color: var(--brand-primary, #10b981); transform: translateX(2px); }
.section-title { margin: 0; color: var(--text-primary); font-size: 16px; font-weight: 700; }
.section-subtitle { margin: 4px 0 0; color: var(--text-tertiary); font-size: 12px; }
.section-action-icon { font-size: 13px; color: var(--text-tertiary); transition: transform 0.2s ease, color 0.2s ease; }

.home-feed-group { display: flex; flex-direction: column; gap: 8px; }
.home-feed-section-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 2px 4px; }
.home-feed-section-header.clickable { cursor: pointer; }
.home-feed-section-header.clickable:hover .home-feed-section-title { color: var(--brand-primary, #10b981); }
.home-feed-section-header.clickable:hover .section-action-icon { color: var(--brand-primary, #10b981); transform: translateX(2px); }
.home-feed-section-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.home-feed-items { display: flex; flex-direction: column; gap: 12px; }

.home-follow-user-list,
.home-follow-topic-list { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 4px; }
.home-follow-user { display: flex; flex: 0 0 76px; flex-direction: column; align-items: center; gap: 6px; padding: 0; border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; }
.home-follow-user :deep(.app-avatar) { border: 1px solid var(--border-light); }
.home-follow-user-name { width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: 12px; }
.home-follow-topic {
  display: flex;
  flex: 0 0 76px;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.home-follow-topic:hover, .home-follow-user:hover { color: var(--brand-primary); }

.home-follow-topic-image {
  width: 48px;
  height: 48px;
  background-color: transparent !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.home-follow-topic-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: transparent;
}

.home-follow-topic-icon-fallback {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  background: transparent;
  color: var(--brand-primary);
  font-size: 24px;
}

.home-follow-topic-name {
  width: 76px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-size: 12px;
}
</style>
