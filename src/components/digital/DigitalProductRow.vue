<template>
  <div class="digital-product-row">
    <DigitalProductCard v-for="(product, index) in products" :key="getEntityKey(product, index)" :product="product" layout="compact" @open="$emit('open', $event)" />
    <div v-if="more" class="row-more">
      <DigitalSeriesMore :label="moreLabel" @open="$emit('open', more)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import DigitalProductCard from './DigitalProductCard.vue';
import DigitalSeriesMore from './DigitalSeriesMore.vue';
import type { DiscoveryEntity } from '../../types/discovery';
import { getDigitalEntityTitle } from '../../utils/digitalProduct';
import { getEntityKey } from '../../utils/discovery';

const props = defineProps<{ products: DiscoveryEntity[]; more?: DiscoveryEntity }>();
defineEmits<{ (event: 'open', entity: DiscoveryEntity): void }>();
const moreLabel = props.more ? getDigitalEntityTitle(props.more) : '';
</script>

<style scoped>
.digital-product-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.row-more { display: grid; min-height: 166px; place-items: center; border: 1px dashed var(--brand-green-border, rgba(16, 185, 102, .32)); border-radius: 12px; background: var(--brand-soft, rgba(16, 185, 129, .06)); }
.row-more :deep(.digital-series-more) { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; flex-direction: column; gap: 10px; font-size: 13px; }
@media (max-width: 980px) { .digital-product-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) { .digital-product-row { grid-template-columns: 1fr; } }
</style>
