<template>
  <AppDialog
    :is-open="isOpen"
    title="添加好物到清单"
    :width="560"
    :close-on-backdrop="!submitting"
    @close="close"
  >
    <div class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        type="text"
        placeholder="搜索京东/淘宝/拼多多好物"
        maxlength="40"
        @keyup.enter="search(true)"
      />
      <AppButton size="sm" icon="fas fa-search" :loading="searching" @click="search(true)">
        搜索
      </AppButton>
    </div>

    <div v-if="searching && results.length === 0" class="picker-state">
      <LoadingState text="正在搜索好物..." />
    </div>

    <div v-else-if="results.length === 0 && searched" class="picker-state">
      <EmptyState title="未找到相关好物" description="换个关键词试试" />
    </div>

    <div v-else-if="!searched" class="picker-state is-tip">
      <i class="fas fa-gift"></i>
      <span>输入关键词搜索商品，选择要加入清单的好物</span>
    </div>

    <div v-else class="picker-list">
      <button
        v-for="goods in results"
        :key="goodsKey(goods)"
        type="button"
        class="picker-item"
        :disabled="submitting"
        @click="pick(goods)"
      >
        <span class="picker-cover">
          <AppImage
            v-if="goodsPic(goods)"
            :src="goodsPic(goods)"
            image-class="picker-cover-img"
            fit="cover"
          />
          <i v-else class="fas fa-gift fallback-icon"></i>
        </span>
        <span class="picker-info">
          <span class="picker-title">{{ goodsTitle(goods) }}</span>
          <span class="picker-meta">
            <span v-if="goodsPrice(goods)" class="picker-price">¥{{ goodsPrice(goods) }}</span>
            <span v-if="goodsMall(goods)" class="picker-mall">{{ goodsMall(goods) }}</span>
          </span>
        </span>
        <span class="picker-add"><i class="fas fa-plus"></i></span>
      </button>
    </div>

    <div v-if="results.length > 0 && !searching" class="picker-footer-hint">
      <AppButton v-if="!noMore" size="sm" variant="ghost" @click="search(false)">
        加载更多
      </AppButton>
      <span v-else class="no-more">没有更多了</span>
    </div>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="close">取消</AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import AppDialog from '../common/AppDialog.vue';
import AppButton from '../common/AppButton.vue';
import AppImage from '../common/AppImage.vue';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';

const props = defineProps<{
  isOpen: boolean;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'pick', goods: any): void;
}>();

const keyword = ref('');
const results = ref<any[]>([]);
const page = ref(1);
const searching = ref(false);
const searched = ref(false);
const noMore = ref(false);
const submitting = ref(false);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      keyword.value = '';
      results.value = [];
      page.value = 1;
      searched.value = false;
      noMore.value = false;
    }
  },
);

function goodsKey(goods: any): string {
  return String(goods?.id ?? goods?.entityId ?? `${goods?.goods_title}-${goods?.mall_title}`);
}

function goodsPic(goods: any): string {
  return goods?.goods_pic || goods?.pic || '';
}

function goodsTitle(goods: any): string {
  return goods?.goods_title || goods?.title || '未知好物';
}

function goodsPrice(goods: any): string {
  return goods?.goods_promo_price || goods?.goods_price || '';
}

function goodsMall(goods: any): string {
  return goods?.mall_title || goods?.mallInfo?.mall_title || goods?.mall_name || '';
}

async function search(isFresh = true) {
  const kw = keyword.value.trim();
  if (!kw) return;
  if (isFresh) {
    page.value = 1;
    noMore.value = false;
    results.value = [];
  } else if (noMore.value) {
    return;
  }
  searching.value = true;
  try {
    const res = await CoolapkTauriAPI.searchGoods({ keyword: kw, page: page.value });
    const list = (res?.data && Array.isArray(res.data)) ? res.data : [];
    if (list.length === 0) {
      noMore.value = true;
    } else {
      if (isFresh) {
        results.value = list;
      } else {
        const existing = new Set(results.value.map(goodsKey));
        results.value.push(...list.filter((i: any) => !existing.has(goodsKey(i))));
      }
      page.value++;
    }
    searched.value = true;
  } catch (err) {
    showToast(getErrorMessage(err, '搜索失败'), 'error');
  } finally {
    searching.value = false;
  }
}

function pick(goods: any) {
  if (submitting.value) return;
  emit('pick', goods);
}

function close() {
  if (submitting.value) return;
  emit('close');
}
</script>

<style scoped>
.search-bar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.search-input {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  padding: 7px 12px;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.search-input:focus {
  border-color: var(--brand-primary);
}

.picker-state {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.picker-state.is-tip {
  flex-direction: column;
  gap: 10px;
  color: var(--text-tertiary);
}

.picker-state.is-tip i {
  font-size: 30px;
}

.picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 320px;
  overflow-y: auto;
}

.picker-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default), background-color var(--duration-fast) var(--ease-default);
}

.picker-item:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--border);
}

.picker-item:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.picker-cover {
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background-color: var(--background-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border: 1px solid var(--border-light);
}

.picker-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fallback-icon {
  font-size: 18px;
}

.picker-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.picker-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.picker-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.picker-price {
  color: var(--danger);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-caption);
}

.picker-mall {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
  background-color: var(--background-secondary);
  padding: 1px 6px;
  border-radius: var(--radius-pill);
}

.picker-add {
  color: var(--brand-primary);
}

.picker-footer-hint {
  padding: var(--space-3) 0 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}
</style>