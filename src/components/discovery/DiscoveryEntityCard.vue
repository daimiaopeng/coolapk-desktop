<template>
  <FeedCard v-if="isFeed" :feed="entity as any" />

  <article v-else-if="isCarousel" :class="['discovery-carousel-card', { 'is-compact': compact }]">
    <div class="carousel-viewport">
      <AppImage v-if="carouselImage" :src="carouselImage" fit="cover" image-class="discovery-carousel-image" />
      <button v-if="carouselItems.length > 1" type="button" class="carousel-control previous" @click.stop="moveCarousel(-1)">
        <i class="fas fa-chevron-left"></i>
      </button>
      <button v-if="carouselItems.length > 1" type="button" class="carousel-control next" @click.stop="moveCarousel(1)">
        <i class="fas fa-chevron-right"></i>
      </button>
      <div v-if="carouselItems.length > 1" class="carousel-dots">
        <span v-for="(_, index) in carouselItems" :key="index" :class="{ active: index === carouselIndex }"></span>
      </div>
    </div>
    <div class="discovery-card-copy" @click="emitOpen">
      <strong>{{ title || carouselTitle || '精选内容' }}</strong>
      <span v-if="subtitle || text">{{ subtitle || text }}</span>
    </div>
  </article>

  <section v-else-if="isGoodsCollection" class="discovery-entity-group goods-collection">
    <header v-if="title || subtitle" class="discovery-group-header">
      <div>
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <button v-if="route" type="button" @click="emitOpen">更多 <i class="fas fa-chevron-right"></i></button>
    </header>
    <div class="goods-collection-items">
      <DiscoveryEntityCard
        v-for="(child, index) in entity.entities"
        :key="getEntityKey(child, index)"
        :entity="child"
        @open="$emit('open', $event)"
      />
    </div>
  </section>

  <section v-else-if="isSelectorLinks" class="discovery-selector-card">
    <header v-if="title || subtitle" class="discovery-group-header">
      <div>
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <button v-if="route" type="button" @click="emitOpen">更多 <i class="fas fa-chevron-right"></i></button>
    </header>
    <div class="discovery-selector-pills">
      <button
        v-for="(child, index) in entity.entities"
        :key="getEntityKey(child, index)"
        type="button"
        class="discovery-pill-btn"
        @click="$emit('open', child)"
      >
        <AppImage v-if="getEntityImage(child)" :src="getEntityImage(child)" fit="cover" image-class="discovery-pill-image" />
        <span>{{ child.title || child.productGoodsTitle || child.product_goods_title || child.goodsTitle || child.goods_title || child.name || child.label || child.buttonText || child.button_text || child.text || child.subTitle || '内容' }}</span>
      </button>
    </div>
  </section>

  <section v-else-if="hasChildren" :class="['discovery-entity-group', { 'is-grid': isGrid, 'is-compact-grid': isCompactGrid }]">
    <header v-if="title || subtitle" class="discovery-group-header">
      <div>
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <button v-if="route" type="button" @click="emitOpen">更多 <i class="fas fa-chevron-right"></i></button>
    </header>
    <div class="discovery-group-items">
      <DiscoveryEntityCard
        v-for="(child, index) in entity.entities"
        :key="getEntityKey(child, index)"
        :entity="child"
        :compact="isCompactGrid"
        @open="$emit('open', $event)"
      />
    </div>
  </section>

  <article v-else-if="entityKind === 'app'" :class="['discovery-special-card app-card', { 'is-compact': compact }]" @click="emitOpen">
    <AppImage v-if="image" :src="image" fit="cover" image-class="special-card-image" />
    <div class="special-card-copy">
      <strong>{{ title || '应用' }}</strong>
      <span>{{ entity.developer || entity.author || entity.version || '应用详情' }}</span>
      <small v-if="entity.score || entity.rating">评分 {{ entity.score || entity.rating }}</small>
    </div>
    <button type="button" @click.stop="emitOpen">查看</button>
  </article>

  <article v-else-if="entityKind === 'product' || entityKind === 'goods'" :class="['discovery-special-card product-card', { 'is-compact': compact, 'is-goods-grid': entityKind === 'goods' }]" @click="emitOpen">
    <AppImage v-if="image" :src="image" fit="cover" image-class="special-card-image" />
    <div class="special-card-copy">
      <strong>{{ title || '商品' }}</strong>
      <span v-if="text && text !== title">{{ text }}</span>
      <small v-if="!entity.price && !entity.priceText && price" class="goods-price-entity">&#165; {{ price }}</small>
      <small v-if="!entity.price && !entity.priceText && price" class="goods-price-fallback">楼 {{ price }}</small>
      <small v-if="entity.price || entity.priceText">¥ {{ entity.price || entity.priceText }}</small>
    </div>
    <small v-if="!entity.price && !entity.priceText && price" class="goods-price-correct">¥ {{ price }}</small>
    <i class="fas fa-chevron-right discovery-card-arrow"></i>
  </article>

  <article v-else-if="entityKind === 'dyh'" :class="['discovery-special-card dyh-card', { 'is-compact': compact }]" @click="emitOpen">
    <AppImage v-if="image" :src="image" fit="cover" image-class="special-card-image" />
    <div class="special-card-copy">
      <strong>{{ title || '看看号' }}</strong>
      <span>{{ text || '官方账号动态' }}</span>
      <small v-if="entity.follownum || entity.followNum">{{ entity.follownum || entity.followNum }} 关注</small>
    </div>
    <button type="button" @click.stop="toggleDyhFollow">{{ dyhFollowed ? '已关注' : '关注' }}</button>
  </article>

  <article v-else-if="entityKind === 'article' || entityKind === 'question'" :class="['discovery-text-card', { 'is-compact': compact }]" @click="emitOpen">
    <div class="text-card-heading">
      <span class="text-card-badge">{{ entityKind === 'question' ? '问答' : '图文' }}</span>
      <strong>{{ title || '社区内容' }}</strong>
    </div>
    <p v-if="text && text !== title">{{ text }}</p>
    <AppImage v-if="image" :src="image" fit="cover" image-class="text-card-image" />
    <div class="text-card-footer">
      <span v-if="entity.username">{{ entity.username }}</span>
      <span v-if="entity.replynum || entity.commentnum">{{ entity.replynum || entity.commentnum }} 回复</span>
    </div>
  </article>

  <article v-else-if="isImage" :class="['discovery-image-card', { 'is-compact': compact }]" @click="emitOpen">
    <AppImage v-if="image" :src="image" fit="cover" image-class="discovery-card-image" />
    <div class="discovery-card-copy">
      <strong>{{ title || '发现内容' }}</strong>
      <span v-if="subtitle || text">{{ subtitle || text }}</span>
    </div>
  </article>

  <article v-else :class="['discovery-generic-card', { 'is-compact': compact, 'is-untitled': !title }]" @click="emitOpen">
    <AppImage v-if="image" :src="image" fit="cover" image-class="discovery-generic-image" />
    <div class="discovery-generic-copy">
      <strong>{{ title || '未命名内容' }}</strong>
      <span v-if="text && text !== title">{{ text }}</span>
    </div>
    <i v-if="route" class="fas fa-chevron-right discovery-card-arrow"></i>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import FeedCard from '../feed/FeedCard.vue';
import AppImage from '../common/AppImage.vue';
import type { DiscoveryEntity } from '../../types/discovery';
import {
  getEntityImage,
  getEntityKey,
  getEntityText,
  isFeedEntity,
  isGridCard,
  isImageCard,
  resolveDiscoveryRoute,
} from '../../utils/discovery';

defineOptions({ name: 'DiscoveryEntityCard' });

const props = defineProps<{ entity: DiscoveryEntity; compact?: boolean }>();
const compact = computed(() => props.compact === true);
const emit = defineEmits<{ (event: 'open', entity: DiscoveryEntity): void }>();
const authStore = useAuthStore();

const title = computed(() => String(props.entity.title ?? props.entity.productGoodsTitle ?? props.entity.product_goods_title ?? props.entity.goodsTitle ?? props.entity.goods_title ?? props.entity.name ?? props.entity.label ?? props.entity.buttonText ?? props.entity.button_text ?? props.entity.text ?? ''));
const subtitle = computed(() => String(props.entity.subTitle ?? props.entity.sub_title ?? props.entity.mallName ?? props.entity.mall_name ?? props.entity.mallTitle ?? props.entity.mall_title ?? props.entity.note ?? ''));
const text = computed(() => getEntityText(props.entity));
const price = computed(() => String(props.entity.price ?? props.entity.priceText ?? props.entity.goodsPrice ?? props.entity.goods_price ?? props.entity.productGoodsPrice ?? props.entity.product_goods_price ?? props.entity.goodsPromoPrice ?? props.entity.goods_promo_price ?? '').trim());
const image = computed(() => getEntityImage(props.entity));
const route = computed(() => resolveDiscoveryRoute(props.entity));
const isFeed = computed(() => isFeedEntity(props.entity));
const isImage = computed(() => isImageCard(props.entity));
const hasChildren = computed(() => Array.isArray(props.entity.entities) && props.entity.entities.length > 0);
const isGrid = computed(() => isGridCard(props.entity) || (Array.isArray(props.entity.entities) && props.entity.entities.length >= 2));
const templateName = computed(() => String(props.entity.entityTemplate || props.entity.entityType || '').toLowerCase());
const isSelectorLinks = computed(() => hasChildren.value && templateName.value.includes('selectorlink'));
const isGoodsCollection = computed(() => hasChildren.value && props.entity.entities!.some((child) => {
  const type = String(child.entityType || child.entityTemplate || '').toLowerCase();
  return type.includes('goods')
    || Boolean(child.goodsPic || child.goods_pic || child.productGoodsLogo || child.product_goods_cover || child.goodsCover || child.goods_cover || child.goodsTitle || child.goods_title);
}));
const isCompactGrid = computed(() => isGrid.value && (
  templateName.value.includes('icontablinkgrid')
  || templateName.value.includes('linkgrid')
  || templateName.value.includes('topicgrid')
));
const entityKind = computed(() => {
  const type = String(props.entity.entityType || props.entity.entityTemplate || '').toLowerCase();
  if (type.includes('apk') || type.includes('app')) return 'app';
  if (type.includes('product')) return 'product';
  if (type.includes('goods') || type.includes('commodity') || type.includes('merchant') || type.includes('sale') || type.includes('ershou') || type.includes('secondhand')) return 'goods';
  if (type.includes('dyh') || type.includes('official')) return 'dyh';
  if (type.includes('question') || type.includes('qa')) return 'question';
  if (type.includes('article') || type.includes('news')) return 'article';
  return 'generic';
});
const dyhFollowed = ref(props.entity.follow === true || props.entity.follow === 1 || props.entity.following === true || props.entity.following === 1);
const carouselIndex = ref(0);
const carouselItems = computed<DiscoveryEntity[]>(() => {
  if (Array.isArray(props.entity.entities) && props.entity.entities.length) return props.entity.entities;
  const pics = props.entity.picArr || props.entity.pics;
  if (Array.isArray(pics)) return pics.map((pic) => ({ pic: String(pic), title: props.entity.title }));
  return [props.entity];
});
const carouselImage = computed(() => getEntityImage(carouselItems.value[carouselIndex.value] || props.entity));
const carouselTitle = computed(() => String(carouselItems.value[carouselIndex.value]?.title || ''));
const isCarousel = computed(() => isImage.value && (carouselItems.value.length > 1 || String(props.entity.entityTemplate || '').toLowerCase().includes('carousel')));

function emitOpen() {
  emit('open', props.entity);
}

function moveCarousel(delta: number) {
  const count = carouselItems.value.length;
  if (count < 2) return;
  carouselIndex.value = (carouselIndex.value + delta + count) % count;
}

async function toggleDyhFollow() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const id = String(props.entity.dyhId ?? props.entity.dyh_id ?? props.entity.id ?? props.entity.entityId ?? '');
  if (!id) return;
  try {
    if (dyhFollowed.value) await CoolapkTauriAPI.unfollowDyh(id);
    else await CoolapkTauriAPI.followDyh(id);
    dyhFollowed.value = !dyhFollowed.value;
  } catch (error) {
    console.warn('看看号关注操作失败', error);
  }
}
</script>

<style scoped>
.discovery-entity-group,
.discovery-image-card,
.discovery-generic-card,
.discovery-carousel-card,
.discovery-special-card,
.discovery-selector-card {
  background: var(--surface);
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: var(--radius-card, 12px);
  overflow: hidden;
}

.discovery-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
}

.discovery-group-header h3,
.discovery-group-header p { margin: 0; }
.discovery-group-header h3 { color: var(--text-primary); font-size: 17px; font-weight: 700; }
.discovery-group-header p { color: var(--text-tertiary); font-size: 13px; margin-top: 3px; }
.discovery-group-header button { border: 0; background: none; color: var(--brand-primary); cursor: pointer; font-size: 13.5px; font-weight: 500; }
.discovery-group-header button:hover { text-decoration: underline; }

.discovery-group-items {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 4px 14px 14px;
}
.discovery-entity-group.is-grid .discovery-group-items {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.discovery-entity-group.is-compact-grid .discovery-group-items { gap: 10px; }
.goods-collection-items { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 4px 14px 14px; }

.discovery-selector-card {
  padding: 4px 16px 14px;
}
.discovery-selector-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  align-items: center;
  padding-top: 4px;
}
.discovery-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: var(--radius-pill, 9999px);
  background: var(--background-secondary, #f5f7f8);
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all .15s ease;
  user-select: none;
  white-space: nowrap;
}
.discovery-pill-btn:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--brand-soft, #eaf8f0);
}
.discovery-pill-btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.discovery-pill-image { width: 18px; height: 18px; flex: 0 0 18px; border-radius: 4px; object-fit: cover; }

.discovery-image-card { cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
.discovery-carousel-card { overflow: hidden; }
.carousel-viewport { position: relative; height: clamp(140px, 14vw, 220px); background: var(--surface-muted, #f5f6f7); }
.discovery-carousel-image { width: 100%; height: 100%; object-fit: cover; }
.carousel-control { position: absolute; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border: 0; border-radius: 50%; background: rgba(0,0,0,.42); color: white; cursor: pointer; }
.carousel-control.previous { left: 10px; }
.carousel-control.next { right: 10px; }
.carousel-dots { position: absolute; bottom: 10px; left: 50%; display: flex; gap: 5px; transform: translateX(-50%); }
.carousel-dots span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.6); }
.carousel-dots span.active { width: 16px; border-radius: 4px; background: white; }
.discovery-image-card:hover,
.discovery-generic-card:hover,
.discovery-special-card:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0, 0, 0, .06); }
.discovery-card-image { width: 100%; height: 150px; object-fit: cover; }
.discovery-card-copy { display: flex; flex-direction: column; gap: 5px; padding: 12px 14px 14px; }
.discovery-card-copy strong,
.discovery-generic-copy strong { color: var(--text-primary); }
.discovery-card-copy span,
.discovery-generic-copy span { color: var(--text-secondary); font-size: 13px; line-height: 1.5; }

.discovery-generic-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: transform .15s ease, border-color .15s ease, background-color .15s ease, box-shadow .15s ease;
}
.discovery-generic-card:hover {
  border-color: var(--brand-primary);
  background: var(--surface-hover);
}
.discovery-generic-image { width: 50px; height: 50px; flex: 0 0 50px; border-radius: 10px; object-fit: cover; }
.discovery-generic-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; flex: 1; }
.discovery-generic-copy strong {
  font-size: 14.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.discovery-generic-card.is-untitled .discovery-generic-copy strong { display: none; }
.discovery-generic-copy span {
  font-size: 12px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.discovery-generic-copy small {
  display: inline-block;
  align-self: flex-start;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--background-secondary, #f0f2f4);
  color: var(--text-tertiary);
  font-size: 11px;
}
.discovery-card-arrow { color: var(--text-tertiary); font-size: 12px; flex: 0 0 auto; margin-left: auto; }
.discovery-generic-card.is-compact { min-height: 72px; padding: 8px 10px; gap: 9px; border-radius: 10px; }
.discovery-generic-card.is-compact .discovery-generic-image { width: 42px; height: 42px; flex-basis: 42px; border-radius: 8px; }
.discovery-generic-card.is-compact .discovery-generic-copy { gap: 2px; }
.discovery-generic-card.is-compact .discovery-generic-copy strong { font-size: 13.5px; }
.discovery-generic-card.is-compact .discovery-generic-copy span { font-size: 11.5px; }
.discovery-generic-card.is-compact .discovery-generic-copy small { display: none; }

.discovery-special-card { display: flex; align-items: center; gap: 12px; padding: 12px; cursor: pointer; }
.special-card-image { width: 56px; height: 56px; flex: 0 0 56px; border-radius: 10px; object-fit: cover; }
.special-card-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.special-card-copy strong,
.special-card-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.special-card-copy strong { color: var(--text-primary); font-size: 14.5px; font-weight: 600; }
.special-card-copy span { color: var(--text-secondary); font-size: 12.5px; }
.special-card-copy small { color: var(--brand-primary); font-size: 12px; font-weight: 500; }
.goods-price-fallback { display: none !important; }
.goods-price-correct { display: none !important; }
.special-card button { border: 0; border-radius: 8px; background: var(--brand-primary); color: white; padding: 7px 14px; cursor: pointer; font-size: 13px; font-weight: 500; }
.discovery-special-card.is-goods-grid { position: relative; display: flex; align-items: stretch; flex-direction: column; gap: 0; min-width: 0; padding: 0; }
.discovery-special-card.is-goods-grid .special-card-image { width: 100%; height: 150px; flex: 0 0 150px; border-radius: 0; }
.discovery-special-card.is-goods-grid .special-card-copy { min-width: 0; padding: 11px 12px 12px; gap: 5px; }
.discovery-special-card.is-goods-grid .special-card-copy strong { display: -webkit-box; overflow: hidden; white-space: normal; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.35; }
.discovery-special-card.is-goods-grid .special-card-copy span { display: -webkit-box; white-space: normal; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.discovery-special-card.is-goods-grid .discovery-card-arrow { position: absolute; right: 12px; bottom: 13px; }
.discovery-text-card { padding: 16px; background: var(--surface); border: 1px solid var(--border-light, rgba(0,0,0,.08)); border-radius: var(--radius-card, 12px); cursor: pointer; }
.text-card-heading { display: flex; align-items: center; gap: 8px; }
.text-card-heading strong { color: var(--text-primary); font-size: 16px; }
.text-card-badge { padding: 2px 6px; border-radius: 4px; background: var(--brand-primary); color: white; font-size: 11px; }
.discovery-text-card p { margin: 10px 0; color: var(--text-secondary); line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.text-card-image { width: 100%; height: 150px; border-radius: 10px; object-fit: cover; }
.text-card-footer { display: flex; gap: 14px; margin-top: 10px; color: var(--text-tertiary); font-size: 12px; }

@media (max-width: 1180px) {
  .discovery-group-items,
  .discovery-entity-group.is-grid .discovery-group-items,
  .goods-collection-items {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .discovery-group-items,
  .discovery-entity-group.is-grid .discovery-group-items,
  .goods-collection-items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .discovery-group-header { padding-inline: 14px; }
}
</style>
