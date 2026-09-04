<template>
  <FeedCard v-if="!isSponsor && kind === 'feed' && entityId" :feed="entity as any" :highlight-keyword="highlightKeyword" @deleted="$emit('deleted', $event)" />
  <SearchHotListCard v-else-if="!isSponsor && kind === 'hot'" :entity="entity" @search="$emit('search', $event)" />
  <article v-else-if="!isSponsor" class="search-entity-card" role="button" tabindex="0" @click="openEntity" @keydown.enter.prevent="openEntity">
    <AppAvatar v-if="kind === 'user'" :src="image" :alt="title" size="md" />
    <AppImage v-else-if="image" :src="image" :alt="title" image-class="search-entity-image" fit="contain" />
    <div v-else class="search-entity-icon"><i :class="kindIcon"></i></div>
    <div class="search-entity-content">
      <div class="search-entity-title-row">
        <span class="search-entity-kind">{{ kindLabel }}</span>
        <span class="search-entity-title">{{ title || '未命名实体' }}</span>
        <span v-if="entity.verifyTitle || entity.verify_title" class="search-entity-verify">{{ entity.verifyTitle || entity.verify_title }}</span>
      </div>
      <div v-if="subtitle" class="search-entity-subtitle">{{ subtitle }}</div>
      <div class="search-entity-meta">
        <span v-if="kind === 'app' && packageName">{{ packageName }}</span>
        <span v-if="kind === 'user' && (entity.fans !== undefined || entity.fansCount !== undefined)">{{ formatNumber(entity.fans ?? entity.fansCount) }} 粉丝</span>
        <span v-if="kind === 'topic' && (entity.commentnum !== undefined || entity.commentNum !== undefined)">{{ formatNumber(entity.commentnum ?? entity.commentNum) }} 讨论</span>
        <span v-if="entity.versionName || entity.version">{{ entity.versionName || entity.version }}</span>
      </div>
    </div>
    <AppButton v-if="showFollow && kind === 'user'" variant="soft" size="sm" @click.stop="$emit('toggle-follow', entity)">
      {{ followed ? '已关注' : '关注' }}
    </AppButton>
    <i v-else class="fas fa-chevron-right search-entity-arrow"></i>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import AppAvatar from '../common/AppAvatar.vue';
import AppButton from '../common/AppButton.vue';
import AppImage from '../common/AppImage.vue';
import FeedCard from '../feed/FeedCard.vue';
import SearchHotListCard from './SearchHotListCard.vue';
import type { SearchEntity } from '../../types/search';
import {
  getSearchEntityId,
  getSearchEntityImage,
  getSearchEntityKind,
  getSearchEntityPackageName,
  getSearchEntitySubtitle,
  getSearchEntityTitle,
  isSponsorSearchEntity,
  navigateSearchEntity,
} from '../../utils/searchEntities';

const props = withDefaults(defineProps<{ entity: SearchEntity; showFollow?: boolean; followed?: boolean; highlightKeyword?: string }>(), { showFollow: false, followed: false, highlightKeyword: '' });
defineEmits<{
  (event: 'deleted', id: string | number): void;
  (event: 'search', value: string): void;
  (event: 'toggle-follow', entity: SearchEntity): void;
}>();

const router = useRouter();
const kind = computed(() => getSearchEntityKind(props.entity));
const title = computed(() => getSearchEntityTitle(props.entity));
const subtitle = computed(() => getSearchEntitySubtitle(props.entity));
const image = computed(() => getSearchEntityImage(props.entity));
const packageName = computed(() => getSearchEntityPackageName(props.entity));
const entityId = computed(() => getSearchEntityId(props.entity));
const isSponsor = computed(() => isSponsorSearchEntity(props.entity));
const kindLabel = computed(() => ({ user: '用户', topic: '话题', app: '应用', product: '数码', feed: '动态', question: '问答', hot: '热搜', generic: '结果' } as Record<string, string>)[kind.value] || '结果');
const kindIcon = computed(() => ({ user: 'fas fa-user', topic: 'fas fa-hashtag', app: 'fas fa-cube', product: 'fas fa-mobile-screen-button', feed: 'fas fa-align-left', question: 'fas fa-circle-question', hot: 'fas fa-fire', generic: 'fas fa-link' } as Record<string, string>)[kind.value] || 'fas fa-cube');

function formatNumber(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  if (number >= 10000) return `${(number / 10000).toFixed(1)}万`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return String(number);
}

function openEntity() {
  if (!isSponsor.value) navigateSearchEntity(router, props.entity);
}
</script>

<style scoped>
.search-entity-card { display: flex; align-items: center; gap: 14px; min-height: 76px; box-sizing: border-box; padding: 14px 18px; background: var(--surface); border: 1px solid var(--border-light, var(--border)); border-radius: 14px; box-shadow: 0 1px 2px rgba(15, 23, 42, .03); cursor: pointer; transition: border-color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default); }
.search-entity-card:hover, .search-entity-card:focus-visible { background: var(--surface-hover); border-color: var(--brand-primary); box-shadow: 0 5px 16px rgba(15, 23, 42, .07); outline: none; transform: translateY(-1px); }
.search-entity-image { width: 48px; height: 48px; border-radius: 14px; background: var(--background-secondary); }
.search-entity-icon { display: grid; flex: 0 0 48px; place-items: center; width: 48px; height: 48px; color: var(--brand-primary); background: var(--brand-soft); border-radius: 14px; }
.search-entity-content { flex: 1; min-width: 0; }
.search-entity-title-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
.search-entity-kind { flex: 0 0 auto; padding: 2px 6px; color: var(--brand-primary); background: var(--brand-soft); border-radius: var(--radius-xs); font-size: var(--font-size-caption); }
.search-entity-title { overflow: hidden; color: var(--text-primary); font-weight: var(--font-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.search-entity-verify { flex: 0 0 auto; color: var(--brand-primary); font-size: var(--font-size-caption); }
.search-entity-subtitle, .search-entity-meta { overflow: hidden; color: var(--text-secondary); font-size: var(--font-size-caption); text-overflow: ellipsis; white-space: nowrap; }
.search-entity-meta { display: flex; gap: 12px; margin-top: 4px; color: var(--text-tertiary); }
.search-entity-arrow { flex: 0 0 auto; color: var(--text-tertiary); font-size: 12px; }
@media (max-width: 640px) { .search-entity-card { gap: 10px; min-height: 68px; padding: 10px 12px; } .search-entity-image, .search-entity-icon { width: 42px; height: 42px; } .search-entity-icon { flex-basis: 42px; } .search-entity-kind { display: none; } }
</style>
