<template>
  <Card class="trending-topics-card" :no-padding="true">
    <template #header>
      <div class="header-row">
        <div class="header-title-group">
          <i class="fa-solid fa-hashtag header-icon"></i>
          <h3 class="card-title">热门话题</h3>
        </div>
        <button type="button" class="more-btn" @click="$emit('more-click')">
          更多 <i class="fa-solid fa-chevron-right icon-arrow"></i>
        </button>
      </div>
    </template>

    <div class="topic-list">
      <button
        v-for="t in topics"
        :key="t"
        type="button"
        class="topic-chip"
        @click="$emit('item-click', t)"
      >
        <span class="hashtag">#</span> {{ t }}
      </button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import Card from '../ui/Card.vue';

withDefaults(
  defineProps<{
    topics?: string[];
  }>(),
  {
    topics: () => ['Android 16', '小米15Ultra', '桌面改造', '数码新玩物', 'Geek 极客日常'],
  }
);

defineEmits<{
  (e: 'more-click'): void;
  (e: 'item-click', topic: string): void;
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
  color: var(--brand-green, #10b966);
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

.topic-list {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.topic-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: var(--radius-sm, 6px);
  border: 0;
  background: transparent;
  color: var(--text-main, #172033);
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: var(--transition-fast);
}

.topic-chip:hover {
  background: var(--brand-green-light);
  color: var(--brand-green, #10b966);
}

.hashtag {
  color: var(--brand-green, #10b966);
  font-weight: 700;
  margin-right: 4px;
}
</style>
