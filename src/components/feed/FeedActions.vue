<template>
  <div class="feed-actions">
    <button
      type="button"
      class="action-btn"
      :class="{ 'is-active': item.isLiked }"
      @click.stop="$emit('like', item)"
    >
      <i :class="item.isLiked ? 'fa-solid fa-thumbs-up' : 'fa-regular fa-thumbs-up'"></i>
      <span>{{ item.likenum || 0 }}</span>
    </button>

    <button
      type="button"
      class="action-btn"
      @click.stop="$emit('toggle-comments', item)"
    >
      <i class="fa-regular fa-comment"></i>
      <span>{{ item.replynum || 0 }}</span>
    </button>

    <button
      type="button"
      class="action-btn"
      @click.stop="$emit('fav', item)"
    >
      <i class="fa-regular fa-bookmark"></i>
      <span>{{ item.favnum || '收藏' }}</span>
    </button>

    <button
      type="button"
      class="action-btn"
      @click.stop="$emit('share', item)"
    >
      <i class="fa-solid fa-share"></i>
      <span>{{ item.sharenum || '分享' }}</span>
    </button>

    <button
      type="button"
      class="action-btn"
      @click.stop="$emit('open-detail', item.id)"
    >
      <i class="fa-regular fa-file-lines"></i>
      <span>详情</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  item: any;
}>();

defineEmits<{
  (e: 'like', item: any): void;
  (e: 'toggle-comments', item: any): void;
  (e: 'fav', item: any): void;
  (e: 'share', item: any): void;
  (e: 'open-detail', id: string): void;
}>();
</script>

<style scoped>
.feed-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--divider-color, #edf0f3);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--text-sub, #667085);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: var(--radius-sm, 6px);
  transition: var(--transition-fast);
}

.action-btn:hover {
  background: var(--brand-green-light);
  color: var(--brand-green, #10b966);
}

.action-btn.is-active {
  color: var(--brand-green, #10b966);
  font-weight: 600;
}
</style>
