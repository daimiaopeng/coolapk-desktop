<template>
  <FeedCard v-if="isFeedEntity" :feed="entity" @deleted="(id) => emit('deleted', id)" />
  <RatingCard v-else-if="isRatingEntity" :feed="entity" />
  <article v-else class="user-entity-card" :class="`entity-${variant}`" @click="openEntity">
    <template v-if="variant === 'collection'">
      <div class="collection-cover-container">
        <AppImage v-if="image" :src="image" :alt="title" image-class="collection-cover" />
        <div v-else class="collection-cover-placeholder">
          <i class="fas fa-folder-open"></i>
        </div>
      </div>
      <div class="entity-body">
        <div class="entity-heading">
          <span class="entity-kind">收藏单</span>
          <h3>{{ title || '未命名收藏单' }}</h3>
        </div>
        <p v-if="text" class="entity-description">{{ text }}</p>
        <div class="entity-meta">
          <span v-if="entity.item_num || entity.itemNum || entity.count">
            {{ entity.item_num || entity.itemNum || entity.count }} 条内容
          </span>
          <span v-if="entity.follownum || entity.followNum">
            {{ entity.follownum || entity.followNum }} 关注
          </span>
          <span v-if="entity.favnum || entity.favNum">
            {{ entity.favnum || entity.favNum }} 收藏
          </span>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'user'">
      <AppAvatar :src="image || avatarFromUid" size="lg" />
      <div class="entity-body">
        <div class="entity-heading"><span class="entity-kind">用户</span><h3>{{ title || '酷友' }}</h3></div>
        <p v-if="text" class="entity-description">{{ text }}</p>
        <div class="entity-meta"><span v-if="entity.followNum">关注 {{ entity.followNum }}</span><span v-if="entity.fansNum">粉丝 {{ entity.fansNum }}</span></div>
      </div>
    </template>

    <template v-else-if="variant === 'gallery'">
      <div v-if="imageList.length" class="entity-gallery">
        <AppImage v-for="(src, index) in imageList.slice(0, 4)" :key="`${src}-${index}`" :src="src" :alt="title" image-class="gallery-image" />
      </div>
      <div class="entity-body"><div class="entity-heading"><span class="entity-kind">{{ kindLabel }}</span><h3>{{ title || '图片内容' }}</h3></div><p v-if="text" class="entity-description">{{ text }}</p><EntityMeta :entity="entity" /></div>
    </template>

    <template v-else-if="variant === 'product'">
      <AppImage v-if="image" :src="image" :alt="title" image-class="entity-cover product-cover" />
      <div class="entity-body"><div class="entity-heading"><span class="entity-kind">{{ kindLabel }}</span><h3>{{ title || '未命名商品' }}</h3></div><p v-if="text" class="entity-description">{{ text }}</p><div class="entity-product-meta"><strong v-if="price">{{ price }}</strong><span v-if="rating">评分 {{ rating }}</span></div><EntityMeta :entity="entity" /></div>
    </template>

    <template v-else>
      <AppImage v-if="image" :src="image" :alt="title" image-class="entity-cover" />
      <div class="entity-body">
        <div class="entity-heading"><span class="entity-kind">{{ kindLabel }}</span><h3>{{ title || '未命名内容' }}</h3></div>
        <p v-if="text" class="entity-description">{{ text }}</p>
        <EntityMeta :entity="entity" />
        <details v-if="isUnknown" class="entity-raw" @click.stop>
          <summary>查看原始 Entity</summary>
          <pre>{{ rawPreview }}</pre>
        </details>
      </div>
    </template>
    <i class="fas fa-chevron-right entity-arrow"></i>
  </article>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue';
import { useRouter } from 'vue-router';
import AppAvatar from '../common/AppAvatar.vue';
import AppImage from '../common/AppImage.vue';
import FeedCard from '../feed/FeedCard.vue';
import RatingCard from '../feed/RatingCard.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import type { UserSpaceEntity } from '../../types/userSpace';

const props = defineProps<{ entity: UserSpaceEntity; tab?: string }>();
const emit = defineEmits<{ (event: 'deleted', id: string | number): void }>();
const router = useRouter();
const entity = computed(() => props.entity as any);
const type = computed(() => String(entity.value.entityType ?? entity.value.entityTypeName ?? entity.value.type ?? '').toLowerCase());
const template = computed(() => String(entity.value.entityTemplate ?? entity.value.template ?? '').toLowerCase());
const title = computed(() => String(entity.value.title ?? entity.value.name ?? entity.value.displayTitle ?? entity.value.username ?? ''));
const text = computed(() => String(entity.value.message ?? entity.value.description ?? entity.value.subTitle ?? entity.value.content ?? ''));
const image = computed(() => String(entity.value.pic ?? entity.value.logo ?? entity.value.userAvatar ?? entity.value.cover ?? entity.value.image ?? ''));
const imageList = computed(() => {
  const source = entity.value.picArr ?? entity.value.pic_arr ?? entity.value.images ?? entity.value.pics ?? [];
  const values = Array.isArray(source) ? source : [];
  return values.map((value: any) => typeof value === 'string' ? value : value?.url || value?.pic || value?.image).filter(Boolean);
});
const targetUrl = computed(() => typeof entity.value.url === 'string' ? entity.value.url : typeof entity.value.actionUrl === 'string' ? entity.value.actionUrl : '');
const avatarFromUid = computed(() => {
  const uid = entity.value.uid;
  if (!uid) return '';
  const value = String(uid).padStart(9, '0');
  return `https://avatar.coolapk.com/data/${value.slice(0, 3)}/${value.slice(3, 5)}/${value.slice(5, 7)}/${String(uid).slice(-2)}_avatar_middle.jpg`;
});
const price = computed(() => String(entity.value.price ?? entity.value.priceMin ?? entity.value.price_min ?? ''));
const rating = computed(() => String(entity.value.ratingAverageScore ?? entity.value.rating_average_score ?? entity.value.score ?? ''));
const isFeedEntity = computed(() => {
  if (props.tab === 'rating' || props.tab === 'collection') return false;
  if (['goods_store', 'goods_rank', 'developer_apps', 'apk_follow', 'collection', 'album'].includes(props.tab || '')) return false;
  if (type.value.includes('collection') || type.value.includes('favorite') || template.value.includes('collection')) return false;
  return (
    ['feed', 'feedreply', 'reply', 'article', 'question', 'qa', 'coolpic', 'picture', 'dyh', 'news', 'ershou', 'second_hand'].some((value) => type.value.includes(value)) ||
    template.value.includes('feed') ||
    Boolean(entity.value.message || entity.value.feed_id)
  );
});
const isRatingEntity = computed(() => props.tab === 'rating' || type.value.includes('rating') || template.value.includes('rating'));
const variant = computed(() => {
  if (['collection'].includes(props.tab || '') || type.value.includes('collection') || type.value.includes('favorite')) return 'collection';
  if (['coolpic', 'album'].includes(props.tab || '')) return 'gallery';
  if (['goods', 'goods_store', 'goods_rank', 'developer_apps', 'apk_follow'].includes(props.tab || '')) return 'product';
  if (props.tab === 'qa') return 'generic';
  if (type.value.includes('user')) return 'user';
  if (type.value.includes('album') || type.value.includes('picture') || type.value.includes('coolpic') || imageList.value.length > 1) return 'gallery';
  if (type.value.includes('goods') || type.value.includes('product') || type.value.includes('apk') || type.value.includes('app')) return 'product';
  return 'generic';
});
const isUnknown = computed(() => !isFeedEntity.value && !isRatingEntity.value && variant.value === 'generic');
const kindLabel = computed(() => {
  const tabLabels: Record<string, string> = { article: '图文', qa: '问答', coolpic: '酷图', ershou: '二手', goods: '好物', goods_store: '商品', goods_rank: '好物榜', collection: '收藏', album: '图集', developer_apps: '应用', apk_follow: '关注的应用', discovery: '发现' };
  if (props.tab && tabLabels[props.tab]) return tabLabels[props.tab];
  if (type.value.includes('question') || type.value.includes('qa')) return '问答';
  if (type.value.includes('article')) return '图文';
  if (type.value.includes('apk') || type.value.includes('app')) return '应用';
  if (type.value.includes('goods') || type.value.includes('product')) return '好物';
  if (type.value.includes('album')) return '图集';
  if (type.value.includes('collection')) return '收藏';
  if (type.value.includes('second') || type.value.includes('ershou')) return '二手';
  return entity.value.entityType || entity.value.entityTemplate || '酷安内容';
});
const rawPreview = computed(() => JSON.stringify(entity.value, (key, value) => {
  if (['entities', 'picArr', 'images', 'pics'].includes(key) && Array.isArray(value)) return `[${value.length} items]`;
  return value;
}, 2));

const EntityMeta = defineComponent({
  props: { entity: { type: Object, required: true } },
  setup(metaProps) {
    return () => h('div', { class: 'entity-meta' }, [
      metaProps.entity.username ? h('span', String(metaProps.entity.username)) : null,
      metaProps.entity.dateline ? h('span', formatDate(metaProps.entity.dateline)) : null,
      metaProps.entity.entityType ? h('span', String(metaProps.entity.entityType)) : null,
    ]);
  },
});

function formatDate(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return String(value);
  return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function openEntity() {
  if (variant.value === 'collection') {
    const collectionId = entity.value.id || entity.value.entityId || entity.value.target_id;
    if (collectionId) {
      return void router.push(`/favorites?collectionId=${collectionId}`);
    }
  }
  const url = targetUrl.value;
  if (!url) return;
  if (url.startsWith('#/')) {
    return void router.push(url.slice(1));
  }
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname === window.location.hostname && parsed.pathname.startsWith('/')) return void router.push(`${parsed.pathname}${parsed.search}`);
    if (/^(www\.|m\.)?coolapk\.com$/i.test(parsed.hostname)) {
      const path = `${parsed.pathname}${parsed.search}`;
      if (/^\/feed\/\d+/.test(parsed.pathname)) return void router.push(`/feed/${parsed.pathname.split('/')[2]}`);
      if (/^\/user\/\d+/.test(parsed.pathname)) return void router.push(`/user/${parsed.pathname.split('/')[2]}`);
      if (/^\/topic\//.test(parsed.pathname)) return void router.push(`/topic/${encodeURIComponent(parsed.pathname.slice('/topic/'.length))}`);
      if (/^\/album\/\d+/.test(parsed.pathname)) return void router.push(`/album/${parsed.pathname.split('/')[2]}`);
      if (/^\/app\//.test(parsed.pathname)) return void router.push(`/app/${parsed.pathname.slice('/app/'.length)}`);
      if (/^\/collection\/\d+/.test(parsed.pathname)) return void router.push(`/favorites?collectionId=${parsed.pathname.split('/')[2]}`);
      return void CoolapkTauriAPI.openUrl(`https://www.coolapk.com${path}`);
    }
  } catch {
    // 服务端异常 URL 不执行任何跳转。
  }
}
</script>

<style scoped>
.user-entity-card { display: flex; align-items: center; gap: 14px; padding: 16px; background: var(--surface); border: 1px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: border-color .15s ease, transform .15s ease; }
.user-entity-card:hover { border-color: var(--primary); transform: translateY(-1px); }
.collection-cover-container { width: 56px; height: 56px; border-radius: 10px; overflow: hidden; flex: 0 0 auto; background: var(--background-secondary, rgba(0, 0, 0, 0.04)); display: flex; align-items: center; justify-content: center; }
.collection-cover { width: 56px; height: 56px; object-fit: cover; }
.collection-cover-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.2) 100%); display: flex; align-items: center; justify-content: center; color: var(--brand-primary, #10b981); font-size: 22px; }
.entity-cover { width: 84px; height: 64px; border-radius: 8px; flex: 0 0 auto; object-fit: cover; }
.product-cover { width: 72px; height: 72px; }
.entity-gallery { display: grid; grid-template-columns: repeat(2, 42px); gap: 4px; flex: 0 0 auto; }
.gallery-image { width: 42px; height: 42px; border-radius: 6px; object-fit: cover; }
.entity-body { min-width: 0; flex: 1; }
.entity-heading { display: flex; align-items: center; gap: 8px; }
.entity-heading h3 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; color: var(--text-primary); }
.entity-kind { color: var(--primary); font-size: 12px; white-space: nowrap; }
.entity-description { margin: 7px 0 0; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entity-meta, .entity-product-meta { display: flex; gap: 12px; margin-top: 8px; color: var(--text-tertiary); font-size: 12px; }
.entity-product-meta strong { color: var(--primary); }
.entity-arrow { color: var(--text-tertiary); }
.entity-raw { margin-top: 8px; color: var(--text-tertiary); font-size: 11px; }
.entity-raw pre { max-height: 180px; overflow: auto; margin: 6px 0 0; padding: 8px; background: var(--background-secondary); white-space: pre-wrap; word-break: break-all; }
</style>
