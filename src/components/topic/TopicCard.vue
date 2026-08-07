<template>
  <div class="topic-card" @click="handleClick">
    <div class="topic-icon-wrapper">
      <AppImage
        v-if="iconUrl"
        :src="iconUrl"
        class="topic-icon"
        fit="cover"
        :alt="topicName"
      />
      <div v-else class="topic-icon-fallback">
        <i class="fas fa-hashtag hashtag-icon"></i>
      </div>
    </div>

    <div class="topic-content">
      <div class="topic-title" :title="topicName">
        {{ topicName }}
      </div>
      <div class="topic-stats" v-if="subText">
        <i class="fas fa-fire fire-icon"></i>
        <span>{{ subText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import AppImage from '../common/AppImage.vue';

const props = defineProps<{
  topic: any;
}>();

const router = useRouter();

const topicName = computed(() => {
  const item = props.topic;
  if (!item) return '';
  const raw = item.title || item.tag || item.title_format || item.entityTemplate || '未知话题';
  return raw.replace(/^#|#$/g, '').trim();
});

const iconUrl = computed(() => {
  const item = props.topic;
  if (!item) return '';
  return item.logo || item.pic || item.cover || item.icon || item.topic_logo || item.img || '';
});

const subText = computed(() => {
  const item = props.topic;
  if (!item) return '';
  
  if (item.sub_title) return item.sub_title;
  if (item.follower_num || item.follownum) return `${formatNumber(item.follower_num || item.follownum)} 关注`;
  if (item.commentnum || item.discuss_num) return `${formatNumber(item.commentnum || item.discuss_num)} 讨论`;
  if (item.hot_num) return `${formatNumber(item.hot_num)} 热度`;
  if (item.hot_num_txt) return item.hot_num_txt;
  return '';
});

function formatNumber(num: number | string) {
  const n = Number(num);
  if (isNaN(n)) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function handleClick() {
  const name = topicName.value;
  if (name) {
    router.push(`/topic/${encodeURIComponent(name)}`);
  }
}
</script>

<style scoped>
.topic-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card, 16px);
  padding: 16px 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  user-select: none;
}

.topic-card:hover {
  transform: translateY(-4px);
  border-color: var(--brand-primary);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--brand-primary);
  background-color: var(--surface-hover);
}

.topic-card:active {
  transform: translateY(-1px);
}

.topic-icon-wrapper {
  width: 68px;
  height: 68px;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 12px;
  background-color: var(--background);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.topic-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.topic-card:hover .topic-icon {
  transform: scale(1.06);
}

.topic-icon-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.25));
}

.hashtag-icon {
  font-size: 22px;
  color: var(--brand-primary);
}

.topic-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topic-title {
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.topic-stats {
  font-size: var(--font-size-xs, 12px);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.fire-icon {
  font-size: 11px;
  color: #f59e0b;
}
</style>
