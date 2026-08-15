<template>
  <div class="feed-content-wrapper">
    <h3 v-if="shouldShowTitle" class="feed-title">{{ title }}</h3>
    <div
      ref="bodyRef"
      :class="['feed-body', { 'is-collapsed': shouldCollapse }]"
      :style="shouldCollapse ? { WebkitLineClamp: collapseLines } : undefined"
      v-html="formattedMessage"
      @click="onBodyClick"
    ></div>
    <button
      v-if="shouldShowExpandButton"
      class="expand-btn"
      :disabled="expanding"
      @click.stop="handleExpand"
    >
      {{ expanding ? '正在加载全文...' : expandError ? '全文加载失败，重试' : '展开全文' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { renderCoolapkRichText } from '../../utils/richText';
import { handleAnchorClick } from '../../utils/anchorClick';
import { useSettingsStore } from '../../stores/settings';
import { hasFeedMoreSuffix, stripFeedMoreSuffix } from '../../utils/feedContent';
import { preloadFeedFullText } from '../../utils/feedFullTextCache';

const props = defineProps<{
  feedId?: string | number;
  title?: string;
  message?: string;
  username?: string;
  forceExpanded?: boolean;
}>();

const settingsStore = useSettingsStore();

const bodyRef = ref<HTMLElement | null>(null);
const isExpanded = ref(false);
const expanding = ref(false);
const expandError = ref(false);
const isOverflowing = ref(false);
const fullMessage = ref('');

const currentMessage = computed(() => fullMessage.value || props.message || '');
const needsRemoteFullText = computed(() => hasFeedMoreSuffix(props.message || ''));
const collapseLines = computed(() => settingsStore.settings.collapseLines || 0);
const hasEnoughTextLines = computed(() => {
  if (collapseLines.value <= 0) return false;
  return currentMessage.value.split(/\r?\n/).length > collapseLines.value;
});

function checkOverflow() {
  if (needsRemoteFullText.value) {
    isOverflowing.value = true;
    return;
  }
  if (!bodyRef.value || collapseLines.value <= 0) {
    isOverflowing.value = false;
    return;
  }
  const el = bodyRef.value;
  // jsdom 没有真实布局，scrollHeight/clientHeight 都可能为 0；换行数
  // 同时也是真实内容是否超过折叠行数的稳定下限，长行仍交给布局高度判断。
  const lineCount = currentMessage.value.split(/\r?\n/).length;
  const hasEnoughLines = lineCount > collapseLines.value;
  // 只有在元素真实内容高度大于可视高度（发生了 CSS line-clamp 截断）时才判定为需要展开
  isOverflowing.value = hasEnoughLines || el.scrollHeight > el.clientHeight + 4;
}

const shouldCollapse = computed(() => {
  if (isExpanded.value) return false;
  if (collapseLines.value <= 0) return false;
  return true;
});

const shouldShowExpandButton = computed(() => {
  if (expanding.value || expandError.value) return true;
  if (isExpanded.value) return false;
  if (collapseLines.value <= 0) return false;
  return needsRemoteFullText.value || hasEnoughTextLines.value || isOverflowing.value;
});

function onBodyClick(e: Event) {
  const anchor = (e.target as HTMLElement).closest('a');
  if (anchor) {
    const text = anchor.textContent?.trim() || '';
    if (text.includes('查看更多')) {
      e.preventDefault();
      e.stopPropagation();
      void handleExpand();
      return;
    }
  }
  handleAnchorClick(e, props.feedId);
}

async function handleExpand() {
  isExpanded.value = true;
  expandError.value = false;
  if (!needsRemoteFullText.value || !props.feedId || fullMessage.value || expanding.value) return;

  expanding.value = true;
  try {
    fullMessage.value = await preloadFeedFullText(props.feedId);
  } catch (error) {
    console.warn('加载动态完整正文失败：', error);
    expandError.value = true;
  } finally {
    expanding.value = false;
  }
}

// 过滤无实质意义的 Coolapk 默认通用标题（如 "fishVD的动态" 或 "xxx的动态"）
const shouldShowTitle = computed(() => {
  if (!props.title) return false;
  const trimmed = props.title.trim();
  if (trimmed.endsWith('的动态')) return false;
  if (props.username && (trimmed === `${props.username}的动态` || trimmed === `${props.username} 的动态`)) return false;
  return true;
});

const formattedMessage = computed(() => {
  if (!currentMessage.value) return '';
  // 统一渲染：先安全化（去标签/防注入/换行），再渲染酷安表情
  return renderCoolapkRichText(stripFeedMoreSuffix(currentMessage.value));
});

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    checkOverflow();
    if (bodyRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        checkOverflow();
      });
      resizeObserver.observe(bodyRef.value);
    }
  });
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch([formattedMessage, collapseLines], () => {
  nextTick(() => {
    checkOverflow();
  });
});

watch(
  () => [props.feedId, props.message],
  () => {
    const feedId = props.feedId;
    const sourceMessage = props.message || '';
    fullMessage.value = '';
    expandError.value = false;
    isExpanded.value = Boolean(props.forceExpanded);

    nextTick(() => {
      checkOverflow();
    });

    if (!feedId || !hasFeedMoreSuffix(sourceMessage)) return;
    // 列表接口出现“查看更多”时立即在后台排队加载全文。
    // 用户点击前若已完成即可瞬时展开；仍在加载时也会复用同一个请求。
    void preloadFeedFullText(feedId)
      .then((message) => {
        if (String(props.feedId) === String(feedId) && props.message === sourceMessage) {
          fullMessage.value = message;
        }
      })
      .catch(() => {
        // 后台预取失败保持静默，用户主动点击时仍可重试并看到错误状态。
      });
  },
  { immediate: true }
);
</script>

<style scoped>
.feed-content-wrapper {
  margin-bottom: 10px;
  user-select: text;
}

.feed-content-wrapper * {
  user-select: text;
}

.feed-title {
  font-size: calc(var(--font-size-body, 15px) + 2px);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  line-height: 1.4;
  letter-spacing: -0.2px;
}

.feed-body {
  font-size: var(--font-size-body, 15.5px);
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
  -webkit-line-clamp: 12;
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
