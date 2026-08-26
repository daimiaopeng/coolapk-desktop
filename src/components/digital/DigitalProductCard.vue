<template>
  <article :class="['digital-product-card', `is-${layout}`]">
    <!-- 网格卡片视图 (Grid) -->
    <template v-if="layout === 'grid'">
      <button type="button" class="grid-card-btn" @click="$emit('open', product)">
        <div class="grid-thumb-box">
          <AppImage v-if="image" :src="image" fit="contain" image-class="grid-product-img" />
          <span v-else class="grid-img-fallback"><i class="fas fa-mobile-screen-button"></i></span>
          <span v-if="isNew" class="grid-badge new">新品</span>
          <span v-if="rating" class="grid-badge rating"><i class="fas fa-star"></i> {{ rating }}</span>
        </div>
        <div class="grid-info-box">
          <strong class="grid-title" :title="title">{{ title || '未命名产品' }}</strong>
          <div v-if="subtitle" class="grid-subtitle-row">
            <span class="grid-category-badge" :title="subtitle">{{ subtitle }}</span>
          </div>
          <div v-if="specs.length" class="product-specs-tags">
            <span v-for="(spec, idx) in specs.slice(0, 3)" :key="idx" class="spec-tag">{{ spec }}</span>
          </div>
          <div class="grid-footer">
            <div class="grid-price-wrap">
              <span v-if="price" class="grid-price">{{ price }}</span>
              <span v-else class="grid-price-empty">暂无报价</span>
            </div>
            <div class="grid-meta-wrap">
              <span v-if="hot" class="grid-hot" title="热度"><i class="fas fa-fire"></i> {{ hot }}</span>
              <span v-else-if="release" class="grid-release">{{ release }}</span>
            </div>
          </div>
        </div>
      </button>
    </template>

    <!-- 列表视图 (Vertical / List) -->
    <template v-else-if="layout === 'vertical'">
      <button type="button" class="digital-product-main" @click="$emit('open', product)">
        <div class="list-thumb-box">
          <AppImage v-if="image" :src="image" fit="contain" image-class="digital-product-image" />
          <span v-else class="digital-product-image-fallback"><i class="fas fa-mobile-screen-button"></i></span>
        </div>
        <div class="digital-product-copy">
          <div class="digital-product-title-row">
            <strong>{{ title || '未命名产品' }}</strong>
            <em v-if="isNew">新品</em>
            <span v-if="configCount" class="config-count-badge">{{ configCount }} 个配置</span>
          </div>
          <span v-if="subtitle" class="digital-product-subtitle">{{ subtitle }}</span>
          <div v-if="specs.length" class="product-specs-tags">
            <span v-for="(spec, idx) in specs" :key="idx" class="spec-tag">{{ spec }}</span>
          </div>
        </div>
      </button>
      <div class="digital-product-actions">
        <div class="list-price-box">
          <span v-if="price" class="list-price">{{ price }}</span>
          <span v-else class="list-price-empty">暂无报价</span>
        </div>
        <div class="list-meta-box">
          <span v-if="rating" class="rating"><i class="fas fa-star"></i> {{ rating }}</span>
          <span v-if="hot" class="hot"><i class="fas fa-fire"></i> {{ hot }}热度</span>
          <span v-if="release" class="release-time">{{ release }}</span>
        </div>
      </div>
    </template>

    <!-- 紧凑视图 (Compact) -->
    <template v-else>
      <button type="button" class="digital-product-main" @click="$emit('open', product)">
        <AppImage v-if="image" :src="image" fit="contain" image-class="digital-product-image" />
        <span v-else class="digital-product-image-fallback"><i class="fas fa-mobile-screen-button"></i></span>
        <span class="digital-product-copy">
          <span class="digital-product-title-row">
            <strong>{{ title || '未命名产品' }}</strong>
            <em v-if="isNew">新品</em>
          </span>
          <span class="digital-product-meta">
            <span v-if="rating" class="rating"><i class="fas fa-star"></i>{{ rating }}</span>
            <span v-if="hot" class="hot"><i class="fas fa-fire"></i>{{ hot }}</span>
            <span v-if="price" class="price">{{ price }}</span>
          </span>
        </span>
      </button>
    </template>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppImage from '../common/AppImage.vue';
import type { DiscoveryEntity } from '../../types/discovery';
import {
  getDigitalProductConfigCount,
  getDigitalProductHot,
  getDigitalProductImage,
  getDigitalProductPrice,
  getDigitalProductRating,
  getDigitalProductRelease,
  getDigitalProductSpecs,
  getDigitalProductSubtitle,
  getDigitalProductTitle,
  isDigitalProductNew,
} from '../../utils/digitalProduct';

const props = withDefaults(
  defineProps<{ product: DiscoveryEntity; layout?: 'vertical' | 'compact' | 'grid' }>(),
  { layout: 'vertical' }
);
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
const specs = computed(() => getDigitalProductSpecs(props.product));
</script>

<style scoped>
/* 通用卡片基础样式 */
.digital-product-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.digital-product-card:hover {
  border-color: var(--brand-green-border, rgba(16, 185, 102, 0.35));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

/* 规格胶囊标签通配样式 */
.product-specs-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.spec-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--surface-hover, rgba(0, 0, 0, 0.04));
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.35;
  white-space: nowrap;
}

/* 1. 网格卡片模式 (is-grid) */
.digital-product-card.is-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: transform 0.22s cubic-bezier(0.2, 0, 0.2, 1), box-shadow 0.22s ease, border-color 0.22s ease;
}

.digital-product-card.is-grid:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  border-color: var(--brand-primary, #10b981);
}

.grid-card-btn {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.grid-thumb-box {
  position: relative;
  width: 100%;
  height: 148px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  overflow: hidden;
}

.grid-product-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  transition: transform 0.3s cubic-bezier(0.2, 0, 0.2, 1);
}

.grid-product-img :deep(img) {
  width: auto;
  height: auto;
  max-width: 135px;
  max-height: 135px;
  object-fit: contain;
  mix-blend-mode: multiply;
}

[data-theme='dark'] .grid-product-img :deep(img) {
  mix-blend-mode: normal;
}

.digital-product-card.is-grid:hover .grid-product-img {
  transform: scale(1.04);
}

.grid-img-fallback {
  font-size: 38px;
  color: var(--text-tertiary);
}

.grid-badge {
  position: absolute;
  top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
}

.grid-badge.new {
  left: 8px;
  background: var(--brand-primary, #10b981);
  color: #fff;
}

.grid-badge.rating {
  right: 8px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(4px);
  color: #d97706;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.grid-info-box {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  padding: 12px 14px 14px;
  gap: 7px;
}

.grid-title {
  color: var(--text-primary);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.grid-subtitle-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.grid-category-badge {
  display: inline-flex;
  align-items: center;
  padding: 1.5px 7px;
  border-radius: 4px;
  background: var(--surface-hover, rgba(0, 0, 0, 0.04));
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.35;
  font-weight: 500;
}

.grid-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
}

.grid-price-wrap {
  display: flex;
  align-items: baseline;
}

.grid-price {
  color: var(--brand-primary, #10b981);
  font-size: 16px;
  font-weight: 700;
}

.grid-price-empty {
  display: inline-flex;
  align-items: center;
  padding: 1.5px 7px;
  border-radius: 4px;
  background: var(--surface-hover, rgba(0, 0, 0, 0.035));
  color: var(--text-tertiary);
  font-size: 11.5px;
  font-weight: 500;
}

.grid-meta-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.grid-hot {
  color: #ea580c;
  display: inline-flex;
  align-items: center;
  gap: 3.5px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 7.5px;
  border-radius: 10px;
  background: rgba(234, 88, 12, 0.08);
}

.grid-release {
  color: var(--text-tertiary);
}

/* 2. 列表视图模式 (is-vertical) */
.digital-product-card.is-vertical {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  gap: 20px;
}

.digital-product-main {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.list-thumb-box {
  position: relative;
  flex: 0 0 76px;
  width: 76px;
  height: 76px;
  border-radius: 10px;
  background: var(--surface-hover, rgba(0, 0, 0, 0.02));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.digital-product-image {
  width: 100%;
  height: 100%;
}

.digital-product-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.digital-product-image-fallback {
  font-size: 26px;
  color: var(--text-tertiary);
}

.digital-product-copy {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  gap: 6px;
}

.digital-product-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.digital-product-title-row strong {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.digital-product-title-row em {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--brand-soft, rgba(16, 185, 129, 0.12));
  color: var(--brand-primary);
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
}

.config-count-badge {
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--surface-hover);
  color: var(--text-tertiary);
  font-size: 11px;
}

.digital-product-subtitle {
  color: var(--text-secondary);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.digital-product-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
  text-align: right;
}

.list-price-box {
  display: flex;
  align-items: baseline;
}

.list-price {
  color: var(--brand-primary, #10b981);
  font-size: 17px;
  font-weight: 700;
}

.list-price-empty {
  color: var(--text-tertiary);
  font-size: 12px;
}

.list-meta-box {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.list-meta-box .rating {
  color: #d97706;
  font-weight: 600;
}

.list-meta-box .hot {
  color: #ea580c;
}

.list-meta-box .release-time {
  color: var(--text-tertiary);
}

/* 3. 紧凑模式 (is-compact) */
.digital-product-card.is-compact {
  display: flex;
  flex-direction: column;
  padding: 10px;
}

.digital-product-card.is-compact .digital-product-main {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.digital-product-card.is-compact .digital-product-image {
  width: 100%;
  height: 100px;
}

@media (max-width: 720px) {
  .digital-product-card.is-vertical {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .digital-product-actions {
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
    align-items: center;
    border-top: 1px solid var(--border-light, rgba(0, 0, 0, 0.05));
    padding-top: 8px;
  }
}
</style>
