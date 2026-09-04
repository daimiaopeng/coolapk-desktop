<template>
  <div v-if="isFeed" :class="['discovery-feed-card-wrapper', { 'is-compact': compact }]">
    <FeedCard :feed="entity as any" :max-lines="compact ? 6 : undefined" />
  </div>

  <LiveCard v-else-if="isLive" :entity="entity" :compact="compact" />

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
    <div v-if="title || carouselTitle || subtitle || text" class="discovery-card-copy" @click="emitOpen">
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
        :class="['discovery-pill-btn', { 'is-active': isPillActive(child, index) }]"
        @click="handlePillClick(child, index)"
      >
        <AppImage v-if="getEntityImage(child)" :src="getEntityImage(child)" fit="cover" image-class="discovery-pill-image" />
        <span>{{ child.title || child.productGoodsTitle || child.product_goods_title || child.goodsTitle || child.goods_title || child.name || child.label || child.buttonText || child.button_text || child.text || child.subTitle || '内容' }}</span>
      </button>
    </div>
  </section>

  <section v-else-if="isIconGrid" class="discovery-icon-grid">
    <header v-if="title || subtitle || canExpandIconGrid" class="discovery-group-header">
      <div>
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <div class="discovery-header-actions">
        <button v-if="canExpandIconGrid" type="button" class="discovery-expand-btn" @click="isIconGridExpanded = !isIconGridExpanded">
          <span>{{ isIconGridExpanded ? '收起' : `展开全部 (${props.entity.entities?.length || 0})` }}</span>
          <i :class="isIconGridExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
        </button>
        <button v-if="route" type="button" @click="emitOpen">更多 <i class="fas fa-chevron-right"></i></button>
      </div>
    </header>
    <div :class="['discovery-icon-grid-items', { 'is-category-grid': !isBrandWall }]">
      <button
        v-for="(child, index) in displayedIconGridEntities"
        :key="getEntityKey(child, index)"
        type="button"
        :class="['discovery-icon-grid-item', { 'is-selected': isChildSelected(child), 'is-category-item': !isBrandWall }]"
        :title="getBrandName(child)"
        :aria-label="getBrandName(child)"
        @click="$emit('open', child)"
      >
        <div class="discovery-icon-inner">
          <AppImage v-if="getEntityImage(child)" :src="getEntityImage(child)" fit="contain" image-class="discovery-icon-grid-image" />
          <span v-else :class="['discovery-icon-grid-fallback', { 'is-derived': getEntityFallbackIcon(child) !== 'fas fa-link' }]"><i :class="getEntityFallbackIcon(child)"></i></span>
        </div>
        <span v-if="!isBrandWall" class="discovery-category-label">{{ getBrandName(child) }}</span>
        <span v-else class="discovery-brand-tooltip">{{ getBrandName(child) }}</span>
      </button>
    </div>
  </section>

  <section v-else-if="isDigitalProductGroup" class="discovery-product-group">
    <header v-if="title || subtitle" class="discovery-group-header">
      <div>
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <button v-if="route" type="button" @click="emitOpen">更多 <i class="fas fa-chevron-right"></i></button>
    </header>
    <div class="discovery-product-group-items">
      <DigitalProductCard v-for="(child, index) in entity.entities" :key="getEntityKey(child, index)" :product="child" layout="grid" @open="$emit('open', $event)" />
    </div>
  </section>

  <section v-else-if="isTitleCard" class="discovery-section-title">
    <h3>{{ title || '数码栏目' }}</h3>
    <button v-if="route" type="button" @click="emitOpen">更多 <i class="fas fa-chevron-right"></i></button>
  </section>

  <!-- 紧凑胶囊分段排序条 (如: 热度 / 评分 / 最新) -->
  <div v-else-if="isSortGroup" class="discovery-sort-bar-wrapper">
    <div class="discovery-sort-pill-bar" role="group" aria-label="排序规则">
      <button
        v-for="(child, index) in entity.entities"
        :key="getEntityKey(child, index)"
        type="button"
        :class="['sort-pill-btn', { 'is-active': isSortItemActive(child, index) }]"
        @click="handleSortClick(child, index)"
      >
        <i :class="getSortIcon(child)"></i>
        <span>{{ child.title || child.name || child.label || '排序' }}</span>
      </button>
    </div>
  </div>

  <section v-else-if="hasChildren" :class="['discovery-entity-group', { 'is-grid': isGrid, 'is-compact-grid': isCompactGrid, 'is-review-group': isReviewGroup }]">
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
        :compact="isCompactGrid || isGrid"
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

  <DigitalProductCard v-else-if="entityKind === 'product'" :product="entity" :layout="compact ? 'compact' : 'vertical'" @open="$emit('open', $event)" />

  <TopicCard v-else-if="entityKind === 'topic'" :topic="entity" layout-mode="card" @select="emitOpen" />

  <article v-else-if="entityKind === 'goods'" :class="['discovery-special-card product-card', { 'is-compact': compact, 'is-goods-grid': entityKind === 'goods' }]" @click="emitOpen">
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
    <span v-else :class="['discovery-generic-icon', { 'is-derived': fallbackIcon !== 'fas fa-link' }]"><i :class="fallbackIcon"></i></span>
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
import DigitalProductCard from '../digital/DigitalProductCard.vue';
import TopicCard from '../topic/TopicCard.vue';
import LiveCard from './LiveCard.vue';
import type { DiscoveryEntity } from '../../types/discovery';
import { isDigitalProduct } from '../../utils/digitalProduct';
import {
  getEntityImage,
  getEntityFallbackIcon,
  getEntityKey,
  getEntityText,
  isFeedEntity,
  isGridCard,
  isImageCard,
  resolveDiscoveryRoute,
} from '../../utils/discovery';
import { isLiveEntity } from '../../utils/live';

defineOptions({ name: 'DiscoveryEntityCard' });

const props = defineProps<{ entity: DiscoveryEntity; compact?: boolean }>();
const compact = computed(() => props.compact === true);
const emit = defineEmits<{ (event: 'open', entity: DiscoveryEntity): void }>();
const authStore = useAuthStore();

const title = computed(() => String(props.entity.title ?? props.entity.productGroupTitle ?? props.entity.product_group_title ?? props.entity.seriesTitle ?? props.entity.series_title ?? props.entity.productGoodsTitle ?? props.entity.product_goods_title ?? props.entity.goodsTitle ?? props.entity.goods_title ?? props.entity.name ?? props.entity.label ?? props.entity.buttonText ?? props.entity.button_text ?? props.entity.text ?? ''));
const subtitle = computed(() => String(props.entity.subTitle ?? props.entity.sub_title ?? props.entity.mallName ?? props.entity.mall_name ?? props.entity.mallTitle ?? props.entity.mall_title ?? props.entity.note ?? ''));
const text = computed(() => getEntityText(props.entity));
const price = computed(() => String(props.entity.price ?? props.entity.priceText ?? props.entity.goodsPrice ?? props.entity.goods_price ?? props.entity.productGoodsPrice ?? props.entity.product_goods_price ?? props.entity.goodsPromoPrice ?? props.entity.goods_promo_price ?? '').trim());
const image = computed(() => getEntityImage(props.entity));
const fallbackIcon = computed(() => getEntityFallbackIcon(props.entity));
const route = computed(() => resolveDiscoveryRoute(props.entity));
const hasChildren = computed(() => Array.isArray(props.entity.entities) && props.entity.entities.length > 0);
const isDigitalProductGroup = computed(() => hasChildren.value && props.entity.entities!.every((child) => isDigitalProduct(child)));
const isFeed = computed(() => isFeedEntity(props.entity) && !hasChildren.value);
const isLive = computed(() => isLiveEntity(props.entity));
const isImage = computed(() => isImageCard(props.entity));
const isGrid = computed(() => isGridCard(props.entity) || (Array.isArray(props.entity.entities) && props.entity.entities.length >= 2));
const templateName = computed(() => `${String(props.entity.entityTemplate || '').toLowerCase()} ${String(props.entity.entityType || '').toLowerCase()}`.trim());
const isSelectorLinks = computed(() => hasChildren.value && templateName.value.includes('selectorlink'));
const isIconGrid = computed(() => hasChildren.value && (templateName.value.includes('iconlinkgrid') || templateName.value.includes('icongrid') || templateName.value.includes('icontablinkgrid') || templateName.value.includes('tablinkgrid')));
const isIconGridExpanded = ref(false);
const iconGridThreshold = 20;
const canExpandIconGrid = computed(() => isIconGrid.value && Array.isArray(props.entity.entities) && props.entity.entities.length > iconGridThreshold);
const displayedIconGridEntities = computed(() => {
  if (!Array.isArray(props.entity.entities)) return [];
  if (canExpandIconGrid.value && !isIconGridExpanded.value) {
    return props.entity.entities.slice(0, iconGridThreshold);
  }
  return props.entity.entities;
});

function getBrandName(child: DiscoveryEntity): string {
  return String(child.title || child.name || child.label || child.buttonText || child.button_text || '').trim() || '品牌';
}

function isChildSelected(child: DiscoveryEntity): boolean {
  return Boolean(child.selected === 1 || child.selected === true || child.selected === '1');
}

/** 判断当前 IconGrid 是否为纯品牌墙（否则为品类导航入口） */
const isBrandWall = computed(() => {
  if (!isIconGrid.value) return false;
  const parentText = `${title.value} ${subtitle.value} ${templateName.value}`.toLowerCase();
  if (parentText.includes('brand') || parentText.includes('品牌')) return true;
  const children = props.entity.entities;
  if (!Array.isArray(children) || children.length === 0) return false;
  const brandCount = children.filter((child) => {
    const type = `${String(child.entityType || '')} ${String(child.entityTemplate || '')}`.toLowerCase();
    const url = String(child.url || '').toLowerCase();
    return type.includes('brand') || url.includes('/brand') || url.includes('brand_id');
  }).length;
  return brandCount >= Math.min(children.length, 3);
});
const isTitleCard = computed(() => {
  const template = templateName.value;
  return !hasChildren.value && (template === 'title' || template.includes('sectiontitle') || template.includes('cardtitle') || template.includes('simpletitle') || template.includes('productgrouptitle') || template.includes('product_group_title') || template.includes('series_title') || template.includes('seriestitle'));
});
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
const isSortGroup = computed(() => title.value.trim() === '排序规则' || templateName.value.includes('sort'));
const activeSortIndex = ref(0);

function isSortItemActive(child: DiscoveryEntity, index: number): boolean {
  if (child.selected === 1 || child.selected === true || child.selected === '1') return true;
  return activeSortIndex.value === index;
}

function getSortIcon(entity: DiscoveryEntity): string {
  const itemTitle = String(entity.title || entity.name || entity.label || '').trim();
  if (itemTitle.includes('热度') || itemTitle.includes('最热')) return 'fas fa-fire';
  if (itemTitle.includes('评分') || itemTitle.includes('好评')) return 'fas fa-star';
  if (itemTitle.includes('最新') || itemTitle.includes('发布') || itemTitle.includes('时间')) return 'fas fa-clock';
  if (itemTitle.includes('价格') || itemTitle.includes('从低到高') || itemTitle.includes('从高到低')) return 'fas fa-tag';
  return getEntityFallbackIcon(entity) || 'fas fa-arrow-down-short-wide';
}

function handleSortClick(child: DiscoveryEntity, index: number) {
  activeSortIndex.value = index;
  emit('open', child);
}

const activePillIndex = ref(0);

function isPillActive(child: DiscoveryEntity, index: number): boolean {
  if (child.selected === 1 || child.selected === true || child.selected === '1') return true;
  return activePillIndex.value === index;
}

function handlePillClick(child: DiscoveryEntity, index: number) {
  activePillIndex.value = index;
  emit('open', child);
}

function handleHorizontalScroll(event: WheelEvent) {
  const target = event.currentTarget as HTMLElement;
  if (target && event.deltaY) {
    target.scrollLeft += event.deltaY;
  }
}

const isReviewGroup = computed(() => {
  const groupTitle = title.value.trim();
  return groupTitle.includes('酷友点评') || groupTitle.includes('酷友评论') || templateName.value.includes('review');
});
const entityKind = computed(() => {
  const type = `${String(props.entity.entityType || '').toLowerCase()} ${String(props.entity.entityTemplate || '').toLowerCase()}`;
  if (type.includes('topic')) return 'topic';
  if (type.includes('apk') || type.includes('app')) return 'app';
  if (type.includes('product') || props.entity.productId || props.entity.product_id) return 'product';
  if (props.entity.tag || props.entity.tagName || props.entity.tag_name) return 'topic';
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
.discovery-product-group,
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
.discovery-group-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 700;
}
.discovery-group-header h3::before {
  content: '';
  display: inline-block;
  width: 3.5px;
  height: 14px;
  border-radius: 2px;
  background: var(--brand-primary, #10b981);
}
.discovery-group-header p { color: var(--text-tertiary); font-size: 13px; margin-top: 3px; }
.discovery-group-header button { border: 0; background: none; color: var(--brand-primary); cursor: pointer; font-size: 13.5px; font-weight: 500; }
.discovery-group-header button:hover { text-decoration: underline; }

.discovery-group-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  padding: 4px 14px 16px;
  align-items: stretch;
}
.discovery-product-group-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; padding: 4px 14px 14px; }
.discovery-entity-group.is-grid .discovery-group-items {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.discovery-entity-group.is-compact-grid .discovery-group-items { gap: 10px; }
.goods-collection-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; padding: 4px 14px 14px; }

/* 资讯群组等高卡片与超长展开控制 */
.discovery-feed-card-wrapper {
  width: 100%;
  position: relative;
}
.discovery-feed-card-wrapper.is-compact {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.discovery-feed-card-wrapper.is-compact :deep(.feed-card) {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 14px 16px 8px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  box-sizing: border-box;
}
.discovery-feed-card-wrapper.is-compact :deep(.feed-image-grid) {
  max-height: 160px;
  overflow: hidden;
  margin-top: 6px;
  margin-bottom: 6px;
}
.discovery-feed-card-wrapper.is-compact :deep(.feed-image-grid .grid-item) {
  max-height: 160px;
}
.discovery-feed-card-wrapper.is-compact :deep(.feed-image-grid .grid-img) {
  max-height: 160px;
  object-fit: cover;
}
.discovery-feed-card-wrapper.is-compact :deep(.feed-action-bar) {
  margin-top: auto;
  padding-top: 8px;
}

.discovery-sort-bar-wrapper {
  display: flex;
  align-items: center;
  margin: 2px 0 6px;
  padding: 0 2px;
}

.discovery-sort-pill-bar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background-color: var(--background-secondary, var(--surface-hover));
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: var(--radius-pill, 16px);
}

.sort-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-pill, 14px);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.sort-pill-btn i {
  font-size: 11px;
}

.sort-pill-btn:hover {
  color: var(--text-primary);
}

.sort-pill-btn.is-active {
  background-color: var(--surface);
  color: var(--brand-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.discovery-entity-group.is-review-group { position: relative; padding-bottom: 4px; border-color: rgba(16, 185, 129, .14); background: linear-gradient(180deg, rgba(16, 185, 129, .035), var(--surface) 42%); box-shadow: 0 7px 20px rgba(15, 82, 61, .045); }
.discovery-entity-group.is-review-group .discovery-group-header { padding: 16px 16px 12px; }
.discovery-entity-group.is-review-group .discovery-group-header h3 { display: flex; align-items: center; gap: 9px; font-size: 16px; letter-spacing: .01em; }
.discovery-entity-group.is-review-group .discovery-group-header h3::before { width: 4px; height: 18px; border-radius: 4px; background: linear-gradient(180deg, #34d399, #059669); content: ''; }
.discovery-entity-group.is-review-group .discovery-group-items { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; gap: 12px; padding: 0 14px 14px; }
.discovery-entity-group.is-review-group :deep(.feed-card) { min-width: 0; margin-bottom: 0; padding: 14px; border-color: rgba(15, 23, 42, .08); border-radius: 14px; background: var(--surface-elevated, var(--surface)); box-shadow: 0 2px 10px rgba(15, 23, 42, .045); transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background-color .18s ease; }
.discovery-entity-group.is-review-group :deep(.feed-card:hover) { transform: translateY(-3px); border-color: rgba(16, 185, 129, .38); box-shadow: 0 10px 22px rgba(16, 100, 73, .11); }
.discovery-entity-group.is-review-group :deep(.feed-header) { margin-bottom: 12px; }
.discovery-entity-group.is-review-group :deep(.feed-content-wrapper) { margin-bottom: 12px; }
.discovery-entity-group.is-review-group :deep(.feed-title) { margin-bottom: 7px; font-size: 17px; }
.discovery-entity-group.is-review-group :deep(.feed-body) { font-size: 14px; line-height: 1.58; }
.discovery-entity-group.is-review-group :deep(.feed-image-grid) { gap: 6px; margin-top: 12px; margin-bottom: 12px; }
.discovery-entity-group.is-review-group :deep(.feed-image-grid .grid-item) { border-radius: 10px; box-shadow: none; }
.discovery-entity-group.is-review-group :deep(.feed-action-bar) { margin-top: 12px; padding-top: 10px; }
.discovery-entity-group.is-review-group :deep(.feed-action-bar .action-btn) { min-width: 0; padding: 6px 8px; font-size: 12px; gap: 4px; }

.discovery-selector-card {
  padding: 4px 16px 14px;
}
.discovery-icon-grid {
  padding-bottom: 8px;
  background: var(--surface);
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: var(--radius-card, 12px);
}
.discovery-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.discovery-expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: var(--surface-hover);
  color: var(--brand-primary);
  cursor: pointer;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.15s ease;
}
.discovery-expand-btn:hover {
  background: var(--brand-soft, rgba(16, 185, 129, 0.12));
}
.discovery-icon-grid-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
  padding: 4px 14px 12px;
}
.discovery-icon-grid-items.is-category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 10px;
  padding: 8px 14px 16px;
  align-items: stretch;
}
.discovery-icon-grid-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 44px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  transition: all 0.18s ease;
}
.discovery-icon-grid-item.is-category-item {
  width: 100%;
  max-width: none;
  height: auto;
  min-height: 72px;
  padding: 6px 4px 4px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 7px;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  box-sizing: border-box;
}
.discovery-icon-grid-item.is-category-item:hover {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  transform: none;
}
.discovery-icon-grid-item.is-category-item .discovery-icon-inner {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0.2, 1);
}
.discovery-icon-grid-item.is-category-item .discovery-icon-grid-image :deep(img) {
  width: 48px;
  height: 48px;
  max-width: 48px;
  max-height: 48px;
  object-fit: cover;
  border-radius: 11px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s cubic-bezier(0.2, 0, 0.2, 1), box-shadow 0.2s ease;
}
.discovery-category-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}
.discovery-icon-grid-item.is-category-item:hover .discovery-category-label {
  color: var(--brand-primary);
}
.discovery-icon-grid-item.is-category-item:hover .discovery-icon-grid-image :deep(img) {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
}
.discovery-icon-grid-item:hover {
  background: var(--surface-hover);
  z-index: 10;
}
.discovery-icon-grid-item.is-selected {
  background: var(--brand-soft, rgba(16, 185, 129, 0.12));
}
.discovery-icon-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease;
}
.discovery-icon-grid-item:hover .discovery-icon-inner {
  transform: scale(1.08);
}
.discovery-icon-grid-image, .discovery-icon-grid-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.discovery-icon-grid-image :deep(img) {
  max-width: 48px;
  max-height: 26px;
  width: auto;
  height: auto;
  object-fit: contain;
}
.discovery-icon-grid-fallback {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--surface-hover);
  color: var(--text-tertiary);
  font-size: 14px;
}
.discovery-icon-grid-fallback.is-derived {
  background: var(--brand-soft, rgba(16, 185, 129, 0.1));
  color: var(--brand-primary);
}
.discovery-brand-tooltip {
  position: absolute;
  bottom: calc(100% + 7px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 4px 9px;
  border-radius: 5px;
  background: rgba(23, 25, 28, 0.92);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
  z-index: 30;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.discovery-brand-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 4px;
  border-style: solid;
  border-color: rgba(23, 25, 28, 0.92) transparent transparent transparent;
}
.discovery-icon-grid-item:hover .discovery-brand-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
.discovery-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 32px;
  padding: 6px 4px;
  margin-top: 2px;
}
.discovery-section-title h3 {
  position: relative;
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.discovery-section-title h3::before {
  content: '';
  display: inline-block;
  width: 3.5px;
  height: 14px;
  border-radius: 2px;
  background: var(--brand-primary, #10b981);
}
.discovery-section-title button { border: 0; background: transparent; color: var(--brand-primary); cursor: pointer; font: inherit; font-size: 12px; }
.discovery-selector-card {
  padding: 2px 0 6px;
  background: transparent;
}
.discovery-selector-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
}
.discovery-pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 13px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: 15px;
  background: var(--background-secondary, rgba(0, 0, 0, 0.045));
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  white-space: nowrap;
}
.discovery-pill-btn:hover {
  border-color: var(--brand-primary, #10b981);
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, 0.08));
}
.discovery-pill-btn.is-active {
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-weight: 600;
  border-color: var(--brand-primary, #10b981);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}
.discovery-pill-btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.discovery-pill-image { width: 15px; height: 15px; flex: 0 0 15px; border-radius: 3px; object-fit: cover; margin-right: 5px; }

.discovery-image-card { cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
.discovery-carousel-card { overflow: hidden; border-radius: 12px; }
.carousel-viewport {
  position: relative;
  height: clamp(120px, 12vw, 160px);
  background: var(--surface-muted, #f5f6f7);
  border-radius: 12px;
  overflow: hidden;
}
.discovery-carousel-image { width: 100%; height: 100%; object-fit: cover; }
.discovery-carousel-image :deep(img) { width: 100%; height: 100%; object-fit: cover; }
.carousel-control {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  color: white;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, background-color 0.15s ease;
  z-index: 10;
}
.discovery-carousel-card:hover .carousel-control {
  opacity: 1;
  pointer-events: auto;
}
.carousel-control:hover {
  background: rgba(0, 0, 0, 0.7);
}
.carousel-control.previous { left: 12px; }
.carousel-control.next { right: 12px; }
.carousel-dots { position: absolute; bottom: 10px; left: 50%; display: flex; gap: 5px; transform: translateX(-50%); z-index: 10; }
.carousel-dots span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, 0.6); transition: all 0.2s ease; }
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
.discovery-generic-icon { display: grid; place-items: center; width: 50px; height: 50px; flex: 0 0 50px; border-radius: 10px; background: var(--surface-hover); color: var(--text-tertiary); font-size: 20px; }
.discovery-generic-icon.is-derived { background: var(--brand-soft, rgba(16, 185, 129, .1)); color: var(--brand-primary); }
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
.discovery-generic-card.is-compact .discovery-generic-icon { width: 42px; height: 42px; flex-basis: 42px; border-radius: 8px; font-size: 17px; }
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
  .goods-collection-items,
  .discovery-product-group-items {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .discovery-group-items,
  .discovery-entity-group.is-grid .discovery-group-items,
  .goods-collection-items,
  .discovery-product-group-items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .discovery-icon-grid-items { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .discovery-group-header { padding-inline: 14px; }
}
@media (max-width: 560px) {
  .discovery-entity-group.is-sort-group .discovery-group-items { grid-template-columns: 1fr; }
  .discovery-entity-group.is-review-group .discovery-group-items { grid-template-columns: 1fr; }
}
</style>
