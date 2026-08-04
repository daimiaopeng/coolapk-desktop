<template>
  <Card class="hot-ranking-card" :no-padding="true">
    <template #header>
      <div class="header-row">
        <div class="header-title-group">
          <i class="fa-solid fa-fire header-icon"></i>
          <h3 class="card-title">24小时热门榜</h3>
        </div>
        <button type="button" class="more-btn" @click="$emit('more-click')">
          更多 <i class="fa-solid fa-chevron-right icon-arrow"></i>
        </button>
      </div>
    </template>

    <div class="rank-list">
      <div
        v-for="(item, idx) in list.slice(0, 6)"
        :key="idx"
        class="rank-item"
        @click="$emit('item-click', item.title || item.message)"
      >
        <span class="rank-num" :class="{ 'top-three': idx < 3 }">{{ idx + 1 }}</span>
        <span class="rank-title" :title="item.title || item.message">{{ item.title || item.message }}</span>
      </div>

      <div v-if="!list.length" class="empty-hint">
        热门榜单加载中...
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import Card from '../ui/Card.vue';

defineProps<{
  list: any[];
}>();

defineEmits<{
  (e: 'more-click'): void;
  (e: 'item-click', query: string): void;
}>();
</script>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  color: #ff5722;
  font-size: 0.9rem;
}

.card-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-main, #172033);
}

.more-btn {
  border: 0;
  background: transparent;
  font-size: 0.78rem;
  color: var(--text-sub, #667085);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: var(--transition-fast);
}

.more-btn:hover {
  color: var(--brand-green, #10b966);
}

.icon-arrow {
  font-size: 0.7em;
}

.rank-list {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm, 6px);
  transition: var(--transition-fast);
}

.rank-item:hover {
  background: var(--bg-hover, #f1f5f9);
}

.rank-item:hover .rank-title {
  color: var(--brand-green, #10b966);
}

.rank-num {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--bg-app, #f5f7f9);
  color: var(--text-sub, #667085);
  font-size: 0.72rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rank-num.top-three {
  background: var(--brand-green-light);
  color: var(--brand-green, #10b966);
}

.rank-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-main, #172033);
  transition: var(--transition-fast);
}

.empty-hint {
  font-size: 0.8rem;
  color: var(--text-muted, #98a2b3);
  text-align: center;
  padding: 12px 0;
}
</style>
