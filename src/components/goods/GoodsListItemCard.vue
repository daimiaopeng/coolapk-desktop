<template>
  <article class="goods-item-card" :class="{ 'is-voted': isVoted, 'is-clickable': !!buyUrl }" @click="openGoods">
    <div class="goods-item-cover">
      <AppImage
        v-if="cover"
        :src="cover"
        image-class="goods-cover-img"
        fit="cover"
        :alt="title"
      />
      <div v-else class="goods-cover-fallback">
        <i class="fas fa-gift"></i>
      </div>
    </div>

    <div class="goods-item-info">
      <h4 class="goods-item-title">{{ title || '未知商品' }}</h4>
      <div class="goods-item-tags">
        <span v-if="price" class="goods-price">¥{{ price }}</span>
        <span v-if="mallName" class="goods-mall">{{ mallName }}</span>
      </div>
      <p v-if="note" class="goods-note">{{ note }}</p>
      <p v-else-if="subTitle" class="goods-note">{{ subTitle }}</p>
    </div>

    <div class="goods-item-actions">
      <button
        v-if="canVote"
        class="vote-btn"
        :class="{ 'is-active': isVoted }"
        type="button"
        :disabled="voting"
        :title="isVoted ? '取消投票' : '投票支持'"
        @click.stop="handleVote"
      >
        <i class="fas fa-thumbs-up"></i>
        <span>{{ voteNum || 0 }}</span>
      </button>
      <button
        v-if="canManage"
        class="manage-btn"
        type="button"
        title="编辑备注"
        @click.stop="emit('edit', item)"
      >
        <i class="fas fa-pen"></i>
      </button>
      <button
        v-if="canManage"
        class="manage-btn danger"
        type="button"
        title="移除该商品"
        @click.stop="emit('delete', item)"
      >
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import AppImage from '../common/AppImage.vue';
import { useAuthStore } from '../../stores/auth';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';

const props = withDefaults(
  defineProps<{
    item: any;
    goodsListId?: string;
    ownerUid?: string | number;
    canManage?: boolean;
    canVote?: boolean;
  }>(),
  {
    goodsListId: '',
    ownerUid: '',
    canManage: false,
    canVote: true,
  },
);

const emit = defineEmits<{
  (e: 'vote', item: any, value: number): void;
  (e: 'edit', item: any): void;
  (e: 'delete', item: any): void;
}>();

const authStore = useAuthStore();

const cover = computed(() =>
  props.item.product_goods_cover
    || props.item.product_goods_logo
    || props.item.logo
    || props.item.pic
    || '',
);
const title = computed(() =>
  props.item.product_goods_title
    || props.item.title
    || props.item.goods_title
    || '',
);
const price = computed(() => props.item.price || props.item.goods_price || '');
const mallName = computed(() => props.item.mall_name || props.item.mall_title || '');
const note = computed(() => props.item.note || '');
const subTitle = computed(() => props.item.sub_title || '');
const buyUrl = computed(() =>
  props.item.product_goods_url
    || props.item.goods_url
    || props.item.url
    || props.item.goods_buy_url
    || '',
);

function openGoods() {
  const url = buyUrl.value;
  if (!url) return;
  void CoolapkTauriAPI.openUrl(url, 'system');
}

const voteNum = ref(Number(props.item.vote_num || props.item.voteNum || 0));
const isVoted = computed(() => {
  const value = props.item.isVote ?? props.item.is_vote;
  return value === true || value === 1 || value === '1';
});
const voting = ref(false);

async function handleVote() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (voting.value) return;
  const id = String(props.goodsListId);
  const itemId = String(props.item.id ?? props.item.feed_id ?? props.item.entityId ?? '');
  if (!id || !itemId) {
    showToast('缺少投票参数', 'error');
    return;
  }
  const target = !isVoted.value;
  voting.value = true;
  try {
    await CoolapkTauriAPI.voteGoodsListItem(id, itemId, target ? 1 : -1);
    emit('vote', props.item, target ? 1 : -1);
    voteNum.value = Math.max(0, voteNum.value + (target ? 1 : -1));
  } catch (err) {
    showToast(getErrorMessage(err, '投票失败'), 'error');
  } finally {
    voting.value = false;
  }
}
</script>

<style scoped>
.goods-item-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-3);
  transition: all var(--duration-fast) var(--ease-default);
}

.goods-item-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.goods-item-card.is-clickable {
  cursor: pointer;
}

.goods-item-card.is-voted {
  border-color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.goods-item-cover {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  border-radius: var(--radius-control);
  overflow: hidden;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-light);
}

.goods-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.goods-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 22px;
}

.goods-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.goods-item-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.goods-item-tags {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.goods-price {
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  color: var(--danger);
}

.goods-mall {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  background-color: var(--background-secondary);
  padding: 1px 6px;
  border-radius: var(--radius-pill);
}

.goods-note {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.goods-item-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

.vote-btn,
.manage-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-caption);
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  transition: all var(--duration-fast) var(--ease-default);
}

.vote-btn {
  background-color: var(--background-secondary);
  color: var(--text-secondary);
}

.vote-btn:hover:not(:disabled) {
  color: var(--brand-primary);
}

.vote-btn.is-active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.vote-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.manage-btn {
  background-color: transparent;
  color: var(--text-tertiary);
  padding: 4px 8px;
}

.manage-btn:hover {
  color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.manage-btn.danger:hover {
  color: var(--danger);
  background-color: rgba(240, 68, 68, 0.1);
}
</style>