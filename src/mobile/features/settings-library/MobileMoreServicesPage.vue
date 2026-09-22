<template>
  <section class="mobile-more-page" data-mobile-page="more" aria-label="更多服务">
    <div class="mobile-more-scroll">
      <header class="mobile-more-header">
        <div class="mobile-more-title-row"><span class="mobile-more-logo"><i class="fas fa-shapes"></i></span><h1>更多服务</h1><span class="mobile-more-count">共 {{ allItems.length }} 个专区与功能</span></div>
        <label class="mobile-more-search"><i class="fas fa-magnifying-glass"></i><input v-model="query" type="search" placeholder="快速查找专区、服务或功能…" /><button v-if="query" type="button" aria-label="清除" @click="query = ''"><i class="fas fa-xmark"></i></button></label>
      </header>

      <section v-if="!query" class="mobile-more-section">
        <h2><i class="fas fa-fire"></i> 常用与核心专区</h2>
        <div class="mobile-more-feature-grid"><button v-for="item in featured" :key="item.key" type="button" @click="open(item.path)"><span :class="`tone-${item.tone}`"><i :class="item.icon"></i></span><strong>{{ item.label }}</strong></button></div>
      </section>

      <section v-for="group in visibleGroups" :key="group.key" class="mobile-more-section">
        <h2><i :class="group.icon"></i> {{ group.label }}<small>{{ group.items.length }}</small></h2>
        <div class="mobile-more-list"><button v-for="item in group.items" :key="item.key" type="button" @click="open(item.path)"><span class="mobile-more-item-icon"><i :class="item.icon"></i></span><span>{{ item.label }}</span><i class="fas fa-chevron-right"></i></button></div>
      </section>

      <div v-if="!visibleGroups.length && query" class="mobile-more-empty"><i class="fas fa-magnifying-glass"></i><p>未找到相关功能</p></div>
      <div class="mobile-more-bottom-space"></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

defineOptions({ name: 'MobileMoreServicesPage' });
const router = useRouter();
const query = ref('');
type Item = { key: string; label: string; path: string; icon: string; tone?: string };
type Group = { key: string; label: string; icon: string; items: Item[] };
const featured: Item[] = [
  { key: 'my-products', label: '我的数码', path: '/my-products', icon: 'fas fa-box-open', tone: 'blue' },
  { key: 'goods', label: '好物推荐', path: '/goods', icon: 'fas fa-gift', tone: 'red' },
  { key: 'center', label: '酷安中心', path: '/center', icon: 'fas fa-shapes', tone: 'green' },
  { key: 'albums', label: '我的专辑', path: '/albums', icon: 'fas fa-layer-group', tone: 'purple' },
];
const groups: Group[] = [
  { key: 'content', label: '内容与互动', icon: 'fas fa-compass', items: [
    { key: 'favorites', label: '我的收藏', path: '/favorites', icon: 'fas fa-star' }, { key: 'history', label: '浏览历史', path: '/history', icon: 'fas fa-clock' }, { key: 'following', label: '我的关注', path: '/following', icon: 'fas fa-heart' },
  ] },
  { key: 'account', label: '账号与工具', icon: 'fas fa-toolbox', items: [
    { key: 'messages', label: '私信', path: '/messages', icon: 'fas fa-comment' }, { key: 'downloads', label: '下载管理', path: '/downloads', icon: 'fas fa-download' }, { key: 'settings', label: '设置', path: '/settings', icon: 'fas fa-gear' },
  ] },
  { key: 'explore', label: '酷安专区', icon: 'fas fa-grid-2', items: [
    { key: 'apps', label: '应用', path: '/apps', icon: 'fas fa-cube' }, { key: 'digital', label: '数码', path: '/digital', icon: 'fas fa-microchip' }, { key: 'secondhand', label: '二手', path: '/secondhand', icon: 'fas fa-shop' }, { key: 'topics', label: '话题', path: '/topics', icon: 'fas fa-hashtag' },
  ] },
];
const allItems = computed(() => [...featured, ...groups.flatMap((group) => group.items)]);
const visibleGroups = computed(() => { const value = query.value.trim().toLowerCase(); if (!value) return groups; return groups.map((group) => ({ ...group, items: group.items.filter((item) => item.label.toLowerCase().includes(value)) })).filter((group) => group.items.length); });
function open(path: string) { void router.push(path); }
</script>

<style scoped>
.mobile-more-page { display: flex; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: #f2f2f6; color: #262629; }.mobile-more-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 12px calc(24px + env(safe-area-inset-bottom, 0px)); }.mobile-more-header { padding: 8px 4px 14px; }.mobile-more-title-row { display: flex; align-items: center; gap: 10px; }.mobile-more-title-row h1 { margin: 0; font-size: 26px; }.mobile-more-logo { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: #e4f6ec; color: #0f9d58; font-size: 21px; }.mobile-more-count { padding: 5px 9px; border-radius: 999px; background: #fff; color: #999; font-size: 11px; }.mobile-more-search { display: flex; align-items: center; gap: 10px; min-height: 47px; margin-top: 16px; padding: 0 13px; border: 1px solid #dedee1; border-radius: 15px; background: #fff; color: #999; }.mobile-more-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #333; font: inherit; font-size: 14px; }.mobile-more-search button { border: 0; background: transparent; color: #999; }.mobile-more-section { margin-bottom: 12px; padding: 16px 13px; border-radius: 22px; background: #fff; }.mobile-more-section h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; font-size: 19px; }.mobile-more-section h2 > i { color: #f27918; }.mobile-more-section h2 small { margin-left: auto; color: #aaa; font-size: 11px; font-weight: 400; }.mobile-more-feature-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px 14px; }.mobile-more-feature-grid button { display: flex; flex-direction: column; align-items: center; gap: 9px; border: 0; background: transparent; color: #28282a; font: inherit; }.mobile-more-feature-grid button span { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 17px; background: #e7f7ee; font-size: 25px; }.mobile-more-feature-grid button strong { font-size: 14px; }.tone-blue { color: #278ee8; }.tone-red { color: #ed5c50; }.tone-green { color: #0f9d58; }.tone-purple { color: #8e5ee9; }.mobile-more-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }.mobile-more-list button { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 48px; padding: 0 8px; border: 0; border-radius: 13px; background: #f7f7f8; color: #444; font: inherit; font-size: 13px; text-align: left; }.mobile-more-list button span:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.mobile-more-list button > i { color: #bbb; font-size: 10px; }.mobile-more-item-icon { display: grid; place-items: center; width: 28px; color: #0f9d58; }.mobile-more-empty { display: grid; place-items: center; min-height: 240px; color: #999; }.mobile-more-empty i { font-size: 30px; }.mobile-more-bottom-space { height: 20px; }
@media (min-width: 720px) { .mobile-more-scroll { width: min(100%, 720px); margin: 0 auto; padding-inline: 24px; }.mobile-more-feature-grid { grid-template-columns: repeat(4, 1fr); } }
</style>
