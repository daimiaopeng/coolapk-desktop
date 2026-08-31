<template>
  <div
    :class="['topic-card', `mode-${layoutMode}`, { 'is-active': active }]"
    @click="handleClick"
  >
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
      <div class="topic-stats" v-if="subStatsText">
        <span>{{ subStatsText }}</span>
      </div>
    </div>

    <div v-if="layoutMode === 'list' && active" class="active-indicator"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import AppImage from '../common/AppImage.vue';

const props = withDefaults(
  defineProps<{
    topic: any;
    layoutMode?: 'card' | 'list';
    active?: boolean;
  }>(),
  {
    layoutMode: 'card',
    active: false,
  }
);

const emit = defineEmits<{
  (e: 'select', topic: any, event: MouseEvent): void;
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

const subStatsText = computed(() => {
  const item = props.topic;
  if (!item) return '';

  if (item.sub_title) return item.sub_title;

  const followers = item.follownum_txt || formatNumber(item.follower_num || item.follownum);
  const comments = item.commentnum_txt || formatNumber(item.commentnum || item.discuss_num);

  const fText = followers && followers !== '0' ? `${followers} 关注` : '';
  const cText = comments && comments !== '0' ? `${comments} 讨论` : '';

  if (fText && cText) {
    return `${fText} · ${cText}`;
  }
  if (fText) return fText;
  if (cText) return cText;

  const hot = item.hot_num_txt || formatNumber(item.hot_num);
  if (hot && hot !== '0') return `${hot} 热度`;
  return '';
});

function formatNumber(num: number | string) {
  const n = Number(num);
  if (isNaN(n)) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function handleClick(event: MouseEvent) {
  emit('select', props.topic, event);
  if (props.layoutMode === 'card') {
    const name = topicName.value;
    if (name) {
      // 父组件可选择拦截或默认处理
    }
  }
}
</script>

<style scoped>
.topic-card {
  position: relative;
  overflow: hidden;
  user-select: none;
  cursor: pointer;
  background-color: var(--surface);
  border: 1px solid var(--border);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              background-color 0.2s ease;
}

/* 网格大卡片模式 */
.topic-card.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border-radius: var(--radius-card, 16px);
  padding: 16px 12px;
}

.topic-card.mode-card:hover {
  transform: translateY(-4px);
  border-color: var(--brand-primary);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--brand-primary);
  background-color: var(--surface-hover);
}

.topic-card.mode-card:active {
  transform: translateY(-1px);
}

.topic-card.mode-card .topic-icon-wrapper {
  width: 68px;
  height: 68px;
  border-radius: 16px;
  margin-bottom: 12px;
}

/* 侧栏紧凑列表模式 */
.topic-card.mode-list {
  display: flex;
  flex-direction: row;
  align-items: center;
  text-align: left;
  border-radius: 12px;
  padding: 8px 12px;
  margin-bottom: 6px;
  gap: 10px;
  border: 1px solid transparent;
  background-color: transparent;
}

.topic-card.mode-list:hover {
  background-color: var(--background-secondary, #f1f5f9);
  transform: translateX(2px);
}

.topic-card.mode-list.is-active {
  background-color: rgba(16, 185, 129, 0.08);
  border-color: transparent;
}

.topic-card.mode-list.is-active .topic-title {
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

.topic-card.mode-list .topic-icon-wrapper {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  margin-bottom: 0;
}

.topic-card.mode-list .topic-stats {
  justify-content: flex-start;
}

.topic-icon-wrapper {
  overflow: hidden;
  background-color: var(--background);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
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
  font-size: 18px;
  color: var(--brand-primary);
}

.topic-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.topic-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
  width: 100%;
}

.topic-stats {
  font-size: 11.5px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background-color: var(--brand-primary, #10b981);
}
</style>

