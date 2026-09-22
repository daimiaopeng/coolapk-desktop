<template>
  <section class="mobile-utility-page" data-mobile-page="utility" :aria-label="pageTitle">
    <header class="mobile-utility-header">
      <button type="button" aria-label="返回" @click="goBack">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
      </button>
      <div>
        <h1>{{ pageTitle }}</h1>
        <p>{{ pageSubtitle }}</p>
      </div>
      <button type="button" aria-label="更多服务" @click="router.push('/more')">
        <i class="fas fa-ellipsis" aria-hidden="true"></i>
      </button>
    </header>

    <main class="mobile-utility-scroll">
      <section class="mobile-utility-hero">
        <span class="mobile-utility-hero-icon"><i :class="heroIcon"></i></span>
        <div>
          <h2>{{ heroTitle }}</h2>
          <p>{{ heroDescription }}</p>
        </div>
      </section>

      <section v-if="isExternal" class="mobile-utility-card">
        <header><h2>外部内容</h2><span>链接将在当前应用能力范围内打开</span></header>
        <div class="mobile-utility-url">{{ externalUrl || '没有可打开的地址' }}</div>
        <button type="button" class="mobile-utility-primary" :disabled="!externalUrl" @click="openExternal">
          <i class="fas fa-arrow-up-right-from-square"></i> 打开链接
        </button>
      </section>

      <section class="mobile-utility-card">
        <header><h2>{{ sectionTitle }}</h2><span>{{ sectionSubtitle }}</span></header>
        <div class="mobile-utility-grid">
          <button v-for="item in actions" :key="item.key" type="button" @click="open(item.path)">
            <span :class="`tone-${item.tone}`"><i :class="item.icon"></i></span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </button>
        </div>
      </section>

      <section class="mobile-utility-card mobile-utility-note">
        <i class="fas fa-circle-info"></i>
        <p>当前页面继续使用同一条路由、账号和业务状态；返回、打开内容和外部链接不会改变页面身份。</p>
      </section>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../api/coolapk';

defineOptions({ name: 'MobileUtilityPage' });

type UtilityAction = { key: string; label: string; description: string; path: string; icon: string; tone: string };

const route = useRoute();
const router = useRouter();
const path = computed(() => route.path);
const isExternal = computed(() => path.value === '/external');
const externalUrl = computed(() => String(route.query.url || '').trim());
const pageTitle = computed(() => {
  if (path.value.startsWith('/anylist')) return '我的清单';
  if (path.value === '/center') return '酷安中心';
  if (path.value === '/my-dyh') return '我的频道';
  if (path.value.startsWith('/events') || path.value.startsWith('/event/')) return '活动';
  if (path.value.startsWith('/secondhand')) return '二手';
  if (path.value === '/reviews') return '点评';
  if (path.value === '/auth_callback') return '账号登录';
  if (isExternal.value) return '外部页面';
  return '更多功能';
});
const pageSubtitle = computed(() => {
  if (path.value.startsWith('/anylist')) return '整理、创建和查看内容清单';
  if (path.value === '/my-dyh') return '管理你关注的频道和内容';
  if (path.value.startsWith('/secondhand')) return '浏览闲置商品和交易内容';
  if (path.value.startsWith('/events') || path.value.startsWith('/event/')) return '查看酷安活动与报名信息';
  return '移动端功能页面';
});
const heroTitle = computed(() => isExternal.value ? '打开外部地址' : pageTitle.value);
const heroDescription = computed(() => isExternal.value ? '请确认地址来源后再继续操作' : '保持酷安移动端的卡片、触控和返回体验');
const heroIcon = computed(() => {
  if (path.value.startsWith('/anylist')) return 'fas fa-list-check';
  if (path.value === '/center') return 'fas fa-shapes';
  if (path.value === '/my-dyh') return 'fas fa-layer-group';
  if (path.value.startsWith('/secondhand')) return 'fas fa-shop';
  if (path.value.startsWith('/events') || path.value.startsWith('/event/')) return 'fas fa-calendar-days';
  if (path.value === '/reviews') return 'fas fa-face-smile';
  if (isExternal.value) return 'fas fa-arrow-up-right-from-square';
  return 'fas fa-grid-2';
});
const sectionTitle = computed(() => path.value.startsWith('/anylist') ? '清单操作' : '快捷入口');
const sectionSubtitle = computed(() => path.value.startsWith('/anylist') ? '从这里继续你的清单工作' : '常用功能都保持在同一条路由体系中');
const actions = computed<UtilityAction[]>(() => {
  if (path.value.startsWith('/anylist')) {
    return [
      { key: 'create', label: '创建清单', description: '建立新的内容集合', path: '/anylist/create', icon: 'fas fa-plus', tone: 'green' },
      { key: 'all', label: '我的清单', description: '查看已有清单', path: '/anylist', icon: 'fas fa-list', tone: 'blue' },
      { key: 'favorites', label: '我的收藏', description: '从收藏继续整理', path: '/favorites', icon: 'fas fa-star', tone: 'orange' },
      { key: 'history', label: '浏览历史', description: '找回最近看过的内容', path: '/history', icon: 'fas fa-clock', tone: 'purple' },
    ];
  }
  if (path.value.startsWith('/secondhand')) {
    return [
      { key: 'market', label: '闲置首页', description: '浏览最新闲置内容', path: '/secondhand', icon: 'fas fa-shop', tone: 'green' },
      { key: 'brands', label: '品牌专区', description: '按品牌查找', path: '/secondhand/brands', icon: 'fas fa-tags', tone: 'blue' },
      { key: 'list', label: '商品列表', description: '查看列表和筛选', path: '/secondhand/list', icon: 'fas fa-list', tone: 'orange' },
      { key: 'goods', label: '好物推荐', description: '看看大家推荐的商品', path: '/goods', icon: 'fas fa-gift', tone: 'purple' },
    ];
  }
  if (path.value.startsWith('/events') || path.value.startsWith('/event/')) {
    return [
      { key: 'events', label: '全部活动', description: '查看正在进行的活动', path: '/events', icon: 'fas fa-calendar-days', tone: 'green' },
      { key: 'following', label: '我的关注', description: '回到关注动态', path: '/following', icon: 'fas fa-heart', tone: 'pink' },
      { key: 'discover', label: '发现', description: '探索更多内容', path: '/discover', icon: 'fas fa-compass', tone: 'blue' },
      { key: 'more', label: '更多服务', description: '打开全部功能', path: '/more', icon: 'fas fa-grid-2', tone: 'purple' },
    ];
  }
  return [
    { key: 'home', label: '首页', description: '回到推荐动态', path: '/', icon: 'fas fa-house', tone: 'green' },
    { key: 'digital', label: '数码', description: '查看数码内容', path: '/digital', icon: 'fas fa-microchip', tone: 'blue' },
    { key: 'discover', label: '发现', description: '浏览兴趣专区', path: '/discover', icon: 'fas fa-compass', tone: 'orange' },
    { key: 'settings', label: '设置', description: '调整应用偏好', path: '/settings', icon: 'fas fa-gear', tone: 'purple' },
  ];
});

function goBack() {
  if (window.history.length > 1) router.back();
  else void router.push('/');
}
function open(target: string) { void router.push(target); }
function openExternal() { if (externalUrl.value) void CoolapkTauriAPI.openUrl(externalUrl.value, 'internal'); }
</script>

<style scoped>
.mobile-utility-page { display: flex; flex: 1; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: #f2f2f6; color: #28282b; }
.mobile-utility-header { display: grid; grid-template-columns: 42px minmax(0, 1fr) 42px; align-items: center; gap: 8px; min-height: 58px; padding: 0 10px; border-bottom: 1px solid #e8e8eb; background: rgba(255,255,255,.96); }
.mobile-utility-header > button { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 12px; background: transparent; color: #28282b; font-size: 17px; }
.mobile-utility-header h1, .mobile-utility-header p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-utility-header h1 { font-size: 17px; }.mobile-utility-header p { margin-top: 3px; color: #999; font-size: 11px; }
.mobile-utility-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 12px calc(24px + env(safe-area-inset-bottom, 0px)); }
.mobile-utility-hero, .mobile-utility-card { margin-bottom: 12px; border-radius: 21px; background: #fff; }
.mobile-utility-hero { display: flex; align-items: center; gap: 13px; padding: 18px 16px; }.mobile-utility-hero-icon { display: grid; place-items: center; flex: 0 0 52px; width: 52px; height: 52px; border-radius: 17px; background: #e4f6ec; color: #0f9d58; font-size: 24px; }.mobile-utility-hero h2 { margin: 0; font-size: 20px; }.mobile-utility-hero p { margin: 5px 0 0; color: #999; font-size: 12px; }
.mobile-utility-card { overflow: hidden; }.mobile-utility-card > header { padding: 16px; border-bottom: 1px solid #f0f0f1; }.mobile-utility-card h2 { margin: 0; font-size: 18px; }.mobile-utility-card header span { display: block; margin-top: 4px; color: #999; font-size: 12px; }.mobile-utility-url { margin: 14px 16px; padding: 11px; overflow-wrap: anywhere; border-radius: 11px; background: #f5f5f7; color: #666; font-size: 12px; }.mobile-utility-primary { display: block; width: calc(100% - 32px); min-height: 43px; margin: 0 16px 16px; border: 0; border-radius: 13px; background: #0f9d58; color: #fff; font: inherit; }
.mobile-utility-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 14px; }.mobile-utility-grid button { display: grid; grid-template-columns: 34px minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 9px; align-items: center; min-width: 0; padding: 11px 8px; border: 0; border-radius: 14px; background: #f7f7f8; color: #333; text-align: left; }.mobile-utility-grid button > span { display: grid; grid-row: 1 / span 2; place-items: center; width: 34px; height: 34px; border-radius: 11px; background: #e7f7ee; font-size: 16px; }.mobile-utility-grid strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }.mobile-utility-grid small { overflow: hidden; color: #999; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.tone-green { color: #0f9d58; }.tone-blue { color: #278ee8; }.tone-orange { color: #ed7b26; }.tone-purple { color: #8e5ee9; }.tone-pink { color: #e85ac7; }
.mobile-utility-note { display: flex; gap: 10px; padding: 14px 16px; color: #999; font-size: 12px; }.mobile-utility-note i { padding-top: 2px; color: #278ee8; }.mobile-utility-note p { margin: 0; line-height: 1.55; }
@media (min-width: 720px) { .mobile-utility-scroll { width: min(100%, 720px); margin-inline: auto; padding-inline: 24px; } }
</style>
