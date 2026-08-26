<template>
  <article :class="['digital-product-card', `is-${layout}`]">
    <button type="button" class="digital-product-main" @click="$emit('open', product)">
      <AppImage v-if="image" :src="image" fit="contain" image-class="digital-product-image" />
      <span v-else class="digital-product-image-fallback"><i class="fas fa-mobile-screen-button"></i></span>
      <span class="digital-product-copy">
        <span class="digital-product-title-row">
          <strong>{{ title || '未命名产品' }}</strong>
          <em v-if="isNew">新品</em>
        </span>
        <span v-if="subtitle" class="digital-product-subtitle">{{ subtitle }}</span>
        <span class="digital-product-meta">
          <span v-if="rating" class="rating"><i class="fas fa-star"></i>{{ rating }}</span>
          <span v-if="hot" class="hot"><i class="fas fa-fire"></i>{{ hot }}热度</span>
          <span v-if="price" class="price">{{ price }}</span>
        </span>
        <span v-if="layout === 'vertical' && detailLine" class="digital-product-detail">{{ detailLine }}</span>
      </span>
    </button>
    <div v-if="layout === 'vertical' && (configCount || release)" class="digital-product-actions">
      <span v-if="layout === 'vertical' && configCount" class="config-count">{{ configCount }} 个配置</span>
      <span v-if="layout === 'vertical' && release" class="release-time">{{ release }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppImage from '../common/AppImage.vue';
import type { DiscoveryEntity } from '../../types/discovery';
import { getDigitalProductConfigCount, getDigitalProductHot, getDigitalProductImage, getDigitalProductPrice, getDigitalProductRating, getDigitalProductRelease, getDigitalProductSpecs, getDigitalProductSubtitle, getDigitalProductTitle, isDigitalProductNew } from '../../utils/digitalProduct';

const props = withDefaults(defineProps<{ product: DiscoveryEntity; layout?: 'vertical' | 'compact' }>(), { layout: 'vertical' });
defineEmits<{ (event: 'open', product: DiscoveryEntity): void }>();
const layout = computed(() => props.layout);
const title = computed(() => getDigitalProductTitle(props.product));
const image = computed(() => getDigitalProductImage(props.product));
const subtitle = computed(() => getDigitalProductSubtitle(props.product));
const rating = computed(() => getDigitalProductRating(props.product));
const price = computed(() => getDigitalProductPrice(props.product));
const hot = computed(() => getDigitalProductHot(props.product));
const release = computed(() => getDigitalProductRelease(props.product));
const configCount = computed(() => getDigitalProductConfigCount(props.product));
const isNew = computed(() => isDigitalProductNew(props.product));
const detailLine = computed(() => [...getDigitalProductSpecs(props.product), release.value ? `发布于 ${release.value}` : ''].filter(Boolean).join(' · '));
</script>

<style scoped>
.digital-product-card { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 13px; border: 1px solid var(--border-light, rgba(0, 0, 0, .08)); border-radius: 12px; background: var(--surface); transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
.digital-product-card:hover { border-color: var(--brand-green-border, rgba(16, 185, 102, .3)); box-shadow: 0 7px 18px rgba(23, 25, 28, .07); transform: translateY(-1px); }
.digital-product-main { display: flex; align-items: center; gap: 13px; flex: 1; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.digital-product-image, .digital-product-image-fallback { flex: 0 0 72px; width: 72px; height: 72px; border-radius: 11px; overflow: hidden; }
.digital-product-image :deep(img) { width: 100%; height: 100%; object-fit: contain; }
.digital-product-image-fallback { display: grid; place-items: center; background: var(--surface-hover); color: var(--text-tertiary); font-size: 24px; }
.digital-product-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 5px; }
.digital-product-title-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
.digital-product-title-row strong { min-width: 0; overflow: hidden; color: var(--text-primary); font-size: 15px; font-weight: 700; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.digital-product-title-row em { flex: 0 0 auto; padding: 2px 5px; border-radius: 4px; background: var(--brand-soft, rgba(16, 185, 129, .12)); color: var(--brand-primary); font-size: 10px; font-style: normal; }
.digital-product-subtitle, .digital-product-detail { overflow: hidden; color: var(--text-secondary); font-size: 12px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.digital-product-detail { color: var(--text-tertiary); }
.digital-product-meta { display: flex; flex-wrap: wrap; gap: 8px; color: var(--text-tertiary); font-size: 11px; }
.digital-product-meta span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.digital-product-meta .rating { color: #e59b23; }
.digital-product-meta .hot { color: #e56b43; }
.digital-product-meta .price { color: var(--brand-primary); font-weight: 600; }
.digital-product-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.config-count, .release-time { color: var(--text-tertiary); font-size: 11px; white-space: nowrap; }
.digital-product-card.is-compact { display: flex; align-items: stretch; flex-direction: column; gap: 8px; min-width: 0; overflow: hidden; padding: 10px; }
.digital-product-card.is-compact .digital-product-main { align-items: flex-start; flex: 1 1 auto; flex-direction: column; gap: 8px; width: 100%; }
.digital-product-card.is-compact .digital-product-image, .digital-product-card.is-compact .digital-product-image-fallback { flex-basis: 116px; width: 100%; height: 116px; border-radius: 9px; }
.digital-product-card.is-compact .digital-product-copy { width: 100%; min-width: 0; gap: 4px; }
.digital-product-card.is-compact .digital-product-title-row, .digital-product-card.is-compact .digital-product-meta { width: 100%; min-width: 0; }
.digital-product-card.is-compact .digital-product-title-row strong { font-size: 13px; }
.digital-product-card.is-compact .digital-product-subtitle, .digital-product-card.is-compact .digital-product-detail { display: none; }
.digital-product-card.is-compact .digital-product-meta { min-height: 16px; }
@media (max-width: 720px) { .digital-product-card:not(.is-compact) { align-items: flex-start; flex-direction: column; } .digital-product-card:not(.is-compact) .digital-product-actions { justify-content: flex-end; width: 100%; } }
</style>
