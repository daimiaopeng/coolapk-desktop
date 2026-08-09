<template>
  <div class="feed-content-wrapper">
    <h3 v-if="shouldShowTitle" class="feed-title">{{ title }}</h3>
    <div
      :class="['feed-body', { 'is-collapsed': isLongText && !isExpanded }]"
      :style="isLongText && !isExpanded ? { WebkitLineClamp: collapseLines } : undefined"
      v-html="formattedMessage"
      @click="onBodyClick"
    ></div>
    <button v-if="isLongText && !isExpanded" class="expand-btn" @click="handleExpand">
      展开全文
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { renderCoolapkRichText } from '../../utils/richText';
import { handleAnchorClick } from '../../utils/anchorClick';
import { useSettingsStore } from '../../stores/settings';
import { useAppStore } from '../../stores/app';

const props = defineProps<{
  feedId?: string | number;
  title?: string;
  message?: string;
  username?: string;
}>();

const settingsStore = useSettingsStore();

const isExpanded = ref(false);

function onBodyClick(e: Event) {
  const anchor = (e.target as HTMLElement).closest('a');
  if (anchor) {
    const text = anchor.textContent?.trim() || '';
    if (text.includes('查看更多')) {
      isExpanded.value = true;
    }
  }
  handleAnchorClick(e, props.feedId);
}

function handleExpand() {
  isExpanded.value = true;
  if (props.feedId) {
    useAppStore().openCommentDrawer(props.feedId);
  }
}

const collapseLines = computed(() => settingsStore.settings.collapseLines || 0);

// 过滤无实质意义的 Coolapk 默认通用标题（如 "fishVD的动态" 或 "xxx的动态"）
const shouldShowTitle = computed(() => {
  if (!props.title) return false;
  const trimmed = props.title.trim();
  if (trimmed.endsWith('的动态')) return false;
  if (props.username && (trimmed === `${props.username}的动态` || trimmed === `${props.username} 的动态`)) return false;
  return true;
});

const isLongText = computed(() => {
  if (!props.message) return false;
  const lines = collapseLines.value;
  if (lines <= 0) return false;
  return props.message.length > 400 || props.message.split('\n').length > lines || /(?:<a[^>]*>\s*查看更多\s*<\/a>)/i.test(props.message);
});

const formattedMessage = computed(() => {
  if (!props.message) return '';
  // 统一渲染：先安全化（去标签/防注入/换行），再渲染酷安表情
  const html = renderCoolapkRichText(props.message);
  // 过滤结尾由酷安 API 默认带有的 "... 查看更多" 冗余文本，统一使用原生的 "展开全文" 按钮
  return html.replace(/(?:(?:[…\.]|\s)*<a[^>]*>\s*查看更多\s*<\/a>\s*)+$/gi, '');
});
</script>

<style scoped>
.feed-content-wrapper {
  margin-bottom: 10px;
}

.feed-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  line-height: 1.4;
  letter-spacing: -0.2px;
}

.feed-body {
  font-size: 15.5px;
  line-height: 1.65;
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
  border-radius: 10px;
  margin: 8px 0;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.feed-body :deep(a) {
  color: var(--brand-primary, #10b981);
  font-weight: 600;
  text-decoration: none;
  padding: 0 4px;
  border-radius: 4px;
  transition: all 0.18s ease;
}

.feed-body :deep(a):hover {
  background-color: var(--brand-soft, rgba(16, 185, 129, 0.12));
  text-decoration: underline;
}

.feed-body.is-collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.expand-btn {
  color: var(--brand-primary, #10b981);
  font-size: 14px;
  font-weight: 600;
  margin-top: 6px;
  padding: 3px 10px;
  border-radius: 6px;
  background: var(--brand-soft, rgba(16, 185, 129, 0.08));
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.expand-btn:hover {
  background: rgba(16, 185, 129, 0.16);
}
</style>
