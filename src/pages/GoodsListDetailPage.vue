<template>
  <GoodsListDetailBody :feed-id="feedId" kind="lists" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import GoodsListDetailBody from '../components/goods/GoodsListDetailBody.vue';

const route = useRoute();
const feedId = computed(() => String(route.params.feedId || ''));
</script>