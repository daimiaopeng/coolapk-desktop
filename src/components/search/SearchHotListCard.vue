<template>
  <section v-if="rows.length" class="search-hot-card" @click.stop>
    <div class="search-hot-card-header">
      <span><i class="fas fa-fire"></i>{{ getSearchEntityTitle(entity) || '热门搜索' }}</span>
      <span v-if="entity.subtitle || entity.subTitle" class="search-hot-card-subtitle">{{ entity.subtitle || entity.subTitle }}</span>
    </div>
    <button v-for="(item, index) in rows" :key="`${getSearchEntityTitle(item)}-${index}`" type="button" class="search-hot-row" @click="$emit('search', getSearchEntityTitle(item))">
      <span :class="['search-hot-rank', { 'is-top': index < 3 }]">{{ index + 1 }}</span>
      <span class="search-hot-title">{{ getSearchEntityTitle(item) }}</span>
      <span v-if="item.hotNum || item.hotnum" class="search-hot-number">{{ item.hotNum || item.hotnum }}</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SearchEntity } from '../../types/search';
import { getSearchEntityTitle, isSponsorSearchEntity } from '../../utils/searchEntities';

const props = defineProps<{ entity: SearchEntity }>();
defineEmits<{ (event: 'search', value: string): void }>();

const rows = computed(() => {
  const children = Array.isArray(props.entity.entities) ? props.entity.entities.filter((item: SearchEntity) => item && !isSponsorSearchEntity(item)) : [];
  if (children.length) return children;
  return isSponsorSearchEntity(props.entity) || !getSearchEntityTitle(props.entity) ? [] : [props.entity];
});
</script>

<style scoped>
.search-hot-card { overflow: hidden; background: var(--surface); border: 1px solid var(--border-light, var(--border)); border-radius: 14px; box-shadow: 0 1px 2px rgba(15, 23, 42, .03); }
.search-hot-card-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px 10px; color: var(--text-primary); font-weight: var(--font-weight-semibold); border-bottom: 1px solid var(--border-light); }
.search-hot-card-header i { color: var(--danger); }
.search-hot-card-subtitle { margin-left: auto; color: var(--text-tertiary); font-size: var(--font-size-caption); font-weight: var(--font-weight-regular); }
.search-hot-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 18px; color: var(--text-primary); background: transparent; border: 0; text-align: left; cursor: pointer; transition: background var(--duration-fast) var(--ease-default); }
.search-hot-row:hover { background: var(--surface-hover); }
.search-hot-rank { width: 20px; color: var(--text-tertiary); font-weight: var(--font-weight-semibold); text-align: center; }
.search-hot-rank.is-top { color: var(--danger); }
.search-hot-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-hot-number { color: var(--text-tertiary); font-size: var(--font-size-caption); }
</style>
