<template>
  <div class="feed-content-wrapper">
    <h3 v-if="title" class="feed-title">{{ title }}</h3>
    <div
      :class="['feed-body', { 'is-collapsed': isLongText && !isExpanded }]"
      :style="isLongText && !isExpanded ? { WebkitLineClamp: collapseLines } : undefined"
      v-html="formattedMessage"
      @click="handleAnchorClick"
    ></div>
    <button v-if="isLongText && !isExpanded" class="expand-btn" @click="isExpanded = true">
      展开全文
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { renderCoolapkRichText } from '../../utils/richText';
import { handleAnchorClick } from '../../utils/anchorClick';
import { useSettingsStore } from '../../stores/settings';

const props = defineProps<{
  title?: string;
  message?: string;
}>();

const settingsStore = useSettingsStore();

const isExpanded = ref(false);

const collapseLines = computed(() => settingsStore.settings.collapseLines || 0);

const isLongText = computed(() => {
  if (!props.message) return false;
  const lines = collapseLines.value;
  if (lines <= 0) return false;
  return props.message.length > 400 || props.message.split('\n').length > lines;
});

const formattedMessage = computed(() => {
  if (!props.message) return '';
  // 统一渲染：先安全化（去标签/防注入/换行），再渲染酷安表情
  return renderCoolapkRichText(props.message);
});
</script>

<style scoped>
.feed-content-wrapper {
  margin-bottom: var(--space-3);
}

.feed-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  line-height: 1.4;
}

.feed-body {
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-primary);
  word-break: break-word;
  position: relative;
}

.feed-body :deep(div),
.feed-body :deep(p) {
  margin: 6px 0;
  clear: both;
}

.feed-body :deep(img):not(.coolapk-emoji) {
  max-width: 100%;
  border-radius: var(--radius-sm);
  margin: 8px 0;
  display: block;
}

.feed-body :deep(a) {
  color: var(--brand-primary);
  font-weight: 550;
}

.feed-body.is-collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.expand-btn {
  color: var(--brand-primary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  margin-top: var(--space-2);
  padding: 0;
  cursor: pointer;
}

.expand-btn:hover {
  text-decoration: underline;
}
</style>
