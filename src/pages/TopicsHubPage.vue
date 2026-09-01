<template>
  <div class="topics-page" ref="pageRootRef">
    <!-- FLIP 跨平台平滑过渡 Ghost 元素 -->
    <div
      v-if="ghostData"
      class="topic-transition-ghost"
      :style="ghostStyle"
    >
      <div class="ghost-inner">
        <img v-if="ghostData.logo" :src="ghostData.logo" class="ghost-icon" alt="" />
        <div v-else class="ghost-fallback-icon">
          <i class="fas fa-hashtag"></i>
        </div>
        <span class="ghost-title">{{ ghostData.title }}</span>
      </div>
    </div>

    <!-- 视图 1：大网格总览视图 -->
    <div v-if="viewMode === 'grid'" class="topics-main-column grid-mode-layout">
      <!-- 顶栏工具条：动态栏目 -->
      <div class="topics-toolbar-bar">
        <div class="topics-tabs-wrapper custom-scrollbar">
          <button
            v-for="cat in categories"
            :key="cat.key"
            type="button"
            :class="['cat-tab', { active: activeCategoryUrl === cat.url }]"
            @click="switchCategory(cat)"
          >
            {{ cat.title }}
          </button>
        </div>
      </div>

      <div class="topics-scroll-container custom-scrollbar" @scroll="handleScroll">
        <!-- 加载中状态 -->
        <div v-if="loading && page === 1" class="loading-wrapper">
          <LoadingState text="正在加载话题列表..." />
        </div>

        <!-- 空数据状态 -->
        <div v-else-if="rawTopicItems.length === 0" class="empty-wrapper">
          <EmptyState
            title="暂无相关话题"
            description="未能找到相关话题，可尝试切换上方分类标签或刷新"
          />
        </div>

        <!-- 多列话题卡片：网格排列 -->
        <div v-else class="topics-grid">
          <TopicCard
            v-for="(topic, idx) in rawTopicItems"
            :key="topic.id || topic.tag || topic.title || idx"
            :topic="topic"
            layout-mode="card"
            @select="(item, event) => handleOpenTopic(item, event)"
          />
        </div>

        <!-- 底部加载状态 -->
        <div class="pagination-footer" v-if="rawTopicItems.length > 0">
          <div v-if="loading && page > 1" class="loading-more-footer">
            <i class="fas fa-circle-notch fa-spin"></i> 加载更多话题...
          </div>
          <div v-else-if="noMore" class="no-more-footer">已加载完毕所有话题</div>
        </div>
      </div>
    </div>

    <!-- 视图 2：分屏自适应视图（响应式：三栏 / 双栏 / 单栏） -->
    <div v-else class="topics-split-layout" :class="[`columns-${activeColumnCount}`]">
      <!-- 1. 左侧栏：当前栏目下的所有子话题列表（支持调节宽度与一键收起） -->
      <aside
        v-if="showLeftSidebarActual"
        class="split-left-sidebar"
        ref="leftSidebarRef"
        :style="{ width: `${leftSidebarWidth}px`, flex: `0 0 ${leftSidebarWidth}px` }"
        @mouseenter="isSidebarHovered = true"
        @mouseleave="isSidebarHovered = false"
      >
        <!-- 顶部工具栏 -->
        <div class="sidebar-header">
          <button
            type="button"
            class="btn-back-grid"
            title="返回全部话题网格 (ESC)"
            @click="handleBackToGrid"
          >
            <i class="fas fa-arrow-left"></i>
            <span>话题</span>
          </button>

          <!-- 栏目快速切换菜单 -->
          <div class="category-selector-wrapper" ref="categoryPickerRef">
            <button
              type="button"
              class="category-dropdown-btn"
              title="切换当前栏目"
              @click="toggleCategoryPicker"
            >
              <span class="category-name">{{ currentCategoryTitle }}</span>
              <i class="fas fa-chevron-down dropdown-arrow" :class="{ 'is-open': isCategoryPickerOpen }"></i>
            </button>
          </div>

          <!-- 一键收起左侧栏按钮 -->
          <button
            type="button"
            class="btn-collapse-sidebar"
            title="收起左侧话题栏"
            @click="toggleLeftSidebar"
          >
            <i class="fas fa-angles-left"></i>
          </button>

          <!-- 栏目切换浮层（精准贴合左侧栏内部，左右留 8px 安全边距） -->
          <div v-if="isCategoryPickerOpen" class="category-picker-popover" @click.stop>
            <div class="picker-title">切换栏目</div>
            <div class="picker-grid">
              <button
                v-for="cat in categories"
                :key="cat.key"
                type="button"
                :class="['picker-item', { active: activeCategoryUrl === cat.url }]"
                @click="handleSelectCategoryInSidebar(cat)"
              >
                {{ cat.title }}
              </button>
            </div>
          </div>
        </div>

        <!-- 子话题列表 -->
        <div
          ref="sidebarSubtopicsListRef"
          class="sidebar-subtopics-list"
          :class="{ 'show-scrollbar': isSidebarHovered }"
          @scroll.passive="handleSidebarScroll"
        >
          <div v-if="loading && page === 1" class="sidebar-loading">
            <i class="fas fa-circle-notch fa-spin"></i>
            <span>加载中...</span>
          </div>
          <template v-else>
            <div
              v-for="(topic, idx) in rawTopicItems"
              :key="topic.id || topic.tag || topic.title || idx"
              :ref="(el) => setSubtopicItemRef(el, topic)"
              class="subtopic-item-wrap"
            >
              <TopicCard
                :topic="topic"
                layout-mode="list"
                :active="isCurrentActiveTopic(topic)"
                @select="() => handleSwitchSubTopic(topic)"
              />
            </div>
          </template>
        </div>

        <!-- 左侧栏宽度调节手柄 -->
        <div
          class="resizer-handle resizer-handle-left"
          title="按住左右拖拽调整宽度，双击恢复默认"
          @mousedown="startResizeLeft"
          @dblclick="resetLeftWidth"
        >
          <div class="resizer-line"></div>
        </div>
      </aside>

      <!-- 2. 中间栏：话题动态信息流（核心栏目，自动 100% 撑满） -->
      <main class="split-center-main">
        <!-- 单栏模式或左栏收起时的顶部展开快捷条 -->
        <div v-if="!showLeftSidebarActual" class="single-column-top-nav">
          <div class="top-nav-left-actions">
            <button
              v-if="isOneColumnMode"
              type="button"
              class="btn-back-grid-mobile"
              @click="handleBackToGrid"
            >
              <i class="fas fa-arrow-left"></i>
              <span>全部话题</span>
            </button>
            <button
              v-else
              type="button"
              class="btn-expand-left-sidebar"
              title="展开话题栏"
              @click="toggleLeftSidebar"
            >
              <i class="fas fa-angles-right"></i>
              <span>话题</span>
            </button>
          </div>

          <!-- 快速切换子话题下拉 -->
          <div class="mobile-subtopic-selector">
            <button
              type="button"
              class="mobile-subtopic-btn"
              @click="isMobileSubtopicPickerOpen = !isMobileSubtopicPickerOpen"
            >
              <span class="mobile-subtopic-title"># {{ activeTopicTag }} #</span>
              <i class="fas fa-chevron-down dropdown-arrow" :class="{ 'is-open': isMobileSubtopicPickerOpen }"></i>
            </button>

            <div v-if="isMobileSubtopicPickerOpen" class="mobile-picker-popover" @click.stop>
              <div class="mobile-subtopic-list">
                <button
                  v-for="(topic, idx) in rawTopicItems"
                  :key="topic.id || topic.tag || topic.title || idx"
                  type="button"
                  :class="['mobile-subtopic-item', { active: isCurrentActiveTopic(topic) }]"
                  @click="handleSelectSubtopicMobile(topic)"
                >
                  {{ getTopicName(topic) }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <keep-alive :max="20">
          <TopicPage
            v-if="activeTopicTag"
            :key="activeTopicTag"
            :tag-param="activeTopicTag"
            :embedded="true"
            :disable-inline-comments="showRightAsidePanel"
            :active-feed-id="activeFeed?.id"
            @select-feed="handleFeedSelected"
          />
        </keep-alive>
      </main>

      <!-- 3. 右侧栏：当前选中动态的评论互动区（支持宽度调节与一键收起） -->
      <div
        v-if="showRightAsidePanel"
        class="split-right-wrapper"
        :style="{ width: `${visibleRightAsideWidth}px`, flex: `0 0 ${visibleRightAsideWidth}px` }"
      >
        <!-- 右侧栏宽度调节手柄 -->
        <div
          class="resizer-handle resizer-handle-right"
          title="按住左右拖拽调整宽度，双击恢复默认"
          @mousedown="startResizeRight"
          @dblclick="resetRightWidth"
        >
          <div class="resizer-line"></div>
        </div>

        <TopicFeedCommentAside
          :feed="activeFeed"
          :style="{ width: '100%', flex: '1 1 100%' }"
          @close="isRightAsideUserClosed = true"
        />
      </div>

      <!-- 浮动展开评论栏按钮（当右侧栏被收起时展示） -->
      <button
        v-if="canShowFloatingExpandBtn"
        type="button"
        class="floating-expand-aside-btn"
        title="展开评论区"
        @click="isRightAsideUserClosed = false"
      >
        <i class="fas fa-comments"></i>
        <span>展开评论</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useTopicHubStore, type CategoryItem } from '../stores/topicHub';
import TopicCard from '../components/topic/TopicCard.vue';
import TopicPage from './TopicPage.vue';
import TopicFeedCommentAside from '../components/topic/TopicFeedCommentAside.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();
const router = useRouter();
const topicHubStore = useTopicHubStore();
const topicEntryUrl = '/page?url=V11_VERTICAL_TOPIC';

const categories = ref<CategoryItem[]>([]);
const activeCategoryUrl = ref('');
const rawTopicItems = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const noMore = ref(false);
const firstItemCursor = ref('');
const lastItemCursor = ref('');

const viewMode = computed(() => topicHubStore.viewMode);
const activeTopicTag = computed(() => topicHubStore.activeTopicTag);
const activeFeed = computed(() => topicHubStore.activeFeed);

const isCategoryPickerOpen = ref(false);
const isMobileSubtopicPickerOpen = ref(false);
const isRightAsideUserClosed = ref(false);
const isLeftSidebarCollapsed = ref(false);
const isSidebarHovered = ref(false);

// 宽度调节状态（支持持久化）
const DEFAULT_LEFT_WIDTH = 300;
const MIN_LEFT_WIDTH = 220;
const MAX_LEFT_WIDTH = 480;

const DEFAULT_RIGHT_WIDTH = 380;
const MIN_RIGHT_WIDTH = 280;
const MAX_RIGHT_WIDTH = 640;

const leftSidebarWidth = ref(DEFAULT_LEFT_WIDTH);
const rightAsideWidth = ref(DEFAULT_RIGHT_WIDTH);

const pageRootRef = ref<HTMLElement | null>(null);
const categoryPickerRef = ref<HTMLElement | null>(null);
const sidebarSubtopicsListRef = ref<HTMLElement | null>(null);
const subtopicItemRefs = new Map<string, HTMLElement>();

// 窗口与版面自适应监听
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);
const pageContentWidth = ref(viewportWidth.value);
let pageResizeObserver: ResizeObserver | null = null;

const MIN_CENTER_WIDTH = 480;

function updatePageContentWidth() {
  const width = pageRootRef.value?.clientWidth || 0;
  if (width > 0) pageContentWidth.value = width;
}

function handleResize() {
  if (typeof window !== 'undefined') {
    viewportWidth.value = window.innerWidth;
  }
  updatePageContentWidth();
}

// 响应式断点判定：
// 三栏模式: >= 1150px (左子话题 + 中动态流 + 右评论面板)
// 双栏模式: 768px ~ 1149px (去掉右边评论，左子话题 + 中动态流)
// 单栏模式: < 768px (去掉左边和右边，仅展示中间动态信息流)
const isThreeColumnMode = computed(() => viewportWidth.value >= 1150);
const isTwoColumnMode = computed(() => viewportWidth.value >= 768 && viewportWidth.value < 1150);
const isOneColumnMode = computed(() => viewportWidth.value < 768);

const activeColumnCount = computed(() => {
  if (showRightAsidePanel.value && showLeftSidebarActual.value) return 3;
  if (isOneColumnMode.value || (!showLeftSidebarActual.value && (!isThreeColumnMode.value || isRightAsideUserClosed.value))) return 1;
  return 2;
});

// 左侧子话题栏实际展示判定（需屏幕允许且未被手动折叠）
const showLeftSidebarActual = computed(() => {
  return viewportWidth.value >= 768 && !isLeftSidebarCollapsed.value;
});

// 右侧评论区至少需要为中间动态流和自身保留最小宽度，避免超出应用窗口后被裁切。
const availableRightWidth = computed(() => {
  const leftWidth = showLeftSidebarActual.value ? leftSidebarWidth.value : 0;
  return pageContentWidth.value - leftWidth - MIN_CENTER_WIDTH;
});

// 右侧评论区仅在宽度允许三栏且未被手动关闭时展示
const showRightAsidePanel = computed(() => {
  return isThreeColumnMode.value
    && !isRightAsideUserClosed.value
    && availableRightWidth.value >= MIN_RIGHT_WIDTH;
});

// 兼容历史上保存过的较大右栏宽度：随当前窗口可用空间收缩，但不修改用户偏好值。
const visibleRightAsideWidth = computed(() => {
  return Math.min(
    rightAsideWidth.value,
    Math.max(MIN_RIGHT_WIDTH, availableRightWidth.value),
  );
});

// 浮动展开按钮仅在三栏模式且被手动关闭时展示
const canShowFloatingExpandBtn = computed(() => {
  return isThreeColumnMode.value && isRightAsideUserClosed.value;
});

function toggleLeftSidebar() {
  isLeftSidebarCollapsed.value = !isLeftSidebarCollapsed.value;
  try {
    localStorage.setItem('coolapk_topic_hub_left_collapsed', isLeftSidebarCollapsed.value ? '1' : '0');
  } catch {}
}

/* ================= 宽度拖拽调节逻辑 ================= */
let isDraggingLeft = false;
let startLeftX = 0;
let startLeftW = DEFAULT_LEFT_WIDTH;

function startResizeLeft(e: MouseEvent) {
  isDraggingLeft = true;
  startLeftX = e.clientX;
  startLeftW = leftSidebarWidth.value;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  window.addEventListener('mousemove', onMouseMoveLeft);
  window.addEventListener('mouseup', stopResizeLeft);
}

function onMouseMoveLeft(e: MouseEvent) {
  if (!isDraggingLeft) return;
  const delta = e.clientX - startLeftX;
  const newWidth = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, startLeftW + delta));
  leftSidebarWidth.value = newWidth;
}

function stopResizeLeft() {
  if (!isDraggingLeft) return;
  isDraggingLeft = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onMouseMoveLeft);
  window.removeEventListener('mouseup', stopResizeLeft);
  try {
    localStorage.setItem('coolapk_topic_hub_left_width', String(leftSidebarWidth.value));
  } catch {}
}

function resetLeftWidth() {
  leftSidebarWidth.value = DEFAULT_LEFT_WIDTH;
  try {
    localStorage.setItem('coolapk_topic_hub_left_width', String(DEFAULT_LEFT_WIDTH));
  } catch {}
}

let isDraggingRight = false;
let startRightX = 0;
let startRightW = DEFAULT_RIGHT_WIDTH;

function startResizeRight(e: MouseEvent) {
  isDraggingRight = true;
  startRightX = e.clientX;
  startRightW = rightAsideWidth.value;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  window.addEventListener('mousemove', onMouseMoveRight);
  window.addEventListener('mouseup', stopResizeRight);
}

function onMouseMoveRight(e: MouseEvent) {
  if (!isDraggingRight) return;
  // 向左拖拽（delta 为负）增大右侧栏宽度
  const delta = startRightX - e.clientX;
  const newWidth = Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, startRightW + delta));
  rightAsideWidth.value = newWidth;
}

function stopResizeRight() {
  if (!isDraggingRight) return;
  isDraggingRight = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onMouseMoveRight);
  window.removeEventListener('mouseup', stopResizeRight);
  try {
    localStorage.setItem('coolapk_topic_hub_right_width', String(rightAsideWidth.value));
  } catch {}
}

function resetRightWidth() {
  rightAsideWidth.value = DEFAULT_RIGHT_WIDTH;
  try {
    localStorage.setItem('coolapk_topic_hub_right_width', String(DEFAULT_RIGHT_WIDTH));
  } catch {}
}

function loadPersistedSettings() {
  try {
    const savedLeftW = localStorage.getItem('coolapk_topic_hub_left_width');
    if (savedLeftW) {
      const n = Number(savedLeftW);
      if (!isNaN(n) && n >= MIN_LEFT_WIDTH && n <= MAX_LEFT_WIDTH) {
        leftSidebarWidth.value = n;
      }
    }
    const savedRightW = localStorage.getItem('coolapk_topic_hub_right_width');
    if (savedRightW) {
      const n = Number(savedRightW);
      if (!isNaN(n) && n >= MIN_RIGHT_WIDTH && n <= MAX_RIGHT_WIDTH) {
        rightAsideWidth.value = n;
      }
    }
    const savedLeftCollapsed = localStorage.getItem('coolapk_topic_hub_left_collapsed');
    if (savedLeftCollapsed === '1') {
      isLeftSidebarCollapsed.value = true;
    }
  } catch {}
}

function setSubtopicItemRef(el: any, topic: any) {
  if (el) {
    const key = getTopicName(topic);
    subtopicItemRefs.set(key, el);
  }
}

// 动画 Ghost 数据
interface GhostAnimationData {
  title: string;
  logo: string;
  top: number;
  left: number;
  width: number;
  height: number;
  targetTop: number;
  targetLeft: number;
  targetWidth: number;
  targetHeight: number;
  isAnimating: boolean;
}

const ghostData = ref<GhostAnimationData | null>(null);

const ghostStyle = computed(() => {
  if (!ghostData.value) return {};
  const g = ghostData.value;
  return {
    top: `${g.top}px`,
    left: `${g.left}px`,
    width: `${g.width}px`,
    height: `${g.height}px`,
    transition: g.isAnimating ? 'all 320ms cubic-bezier(0.2, 0, 0, 1)' : 'none',
  };
});

const currentCategoryTitle = computed(() => {
  const current = categories.value.find((c) => c.url === activeCategoryUrl.value);
  return current?.title || '推荐';
});

function getTopicName(topic: any): string {
  if (!topic) return '';
  const raw = topic.title || topic.tag || topic.title_format || topic.entityTemplate || '';
  return String(raw).replace(/^#|#$/g, '').trim();
}

function isCurrentActiveTopic(topic: any): boolean {
  return getTopicName(topic) === activeTopicTag.value;
}

function scrollSubtopicIntoView(tagName: string, smooth = true) {
  if (!tagName) return;
  const normalizedTarget = getTopicName(tagName).toLowerCase();

  const doScroll = () => {
    const container = sidebarSubtopicsListRef.value || (document.querySelector('.sidebar-subtopics-list') as HTMLElement);
    if (!container) return;

    // 1. 优先通过 key 查找对应项
    let targetEl: HTMLElement | null = null;
    for (const [key, el] of subtopicItemRefs.entries()) {
      if (getTopicName(key).toLowerCase() === normalizedTarget && el) {
        targetEl = el;
        break;
      }
    }

    // 2. 如果没找到，按 .is-active 元素查找
    if (!targetEl) {
      targetEl = (container.querySelector('.subtopic-item-wrap:has(.is-active)') as HTMLElement)
        || (container.querySelector('.is-active') as HTMLElement);
    }

    // 安全检查：只有真正找到了有效 DOM 元素且不是无效 0 高度时才滚动，绝不无故弹回 0
    if (targetEl && targetEl.offsetTop !== undefined) {
      const itemTop = targetEl.offsetTop;
      const itemH = targetEl.offsetHeight || targetEl.clientHeight || 56;
      const containerH = container.clientHeight || 500;
      const targetScrollTop = Math.max(0, itemTop - (containerH / 2) + (itemH / 2));

      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          top: targetScrollTop,
          behavior: smooth ? 'smooth' : 'auto',
        });
      } else {
        container.scrollTop = targetScrollTop;
      }
    }
  };

  nextTick(() => {
    doScroll();
    setTimeout(doScroll, 80);
    setTimeout(doScroll, 200);
    setTimeout(doScroll, 380);
  });
}

// 打开话题并触发 FLIP 动画与左侧栏视口自动居中滚动（仅从大网格进入时定位）
function handleOpenTopic(topic: any, event: MouseEvent) {
  const cardEl = event.currentTarget as HTMLElement;
  const name = getTopicName(topic);
  const logo = topic.logo || topic.pic || topic.cover || topic.icon || '';

  // 确保当前选中的话题一定包含在左侧子话题列表中
  if (topic && !rawTopicItems.value.some((item) => getTopicName(item) === name)) {
    rawTopicItems.value.push(topic);
  }

  if (cardEl) {
    const rect = cardEl.getBoundingClientRect();
    ghostData.value = {
      title: name,
      logo,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      targetTop: rect.top,
      targetLeft: rect.left,
      targetWidth: rect.width,
      targetHeight: rect.height,
      isAnimating: false,
    };
  }

  topicHubStore.openTopicSplit(topic);

  // 同步推入路由历史，使顶栏全局后退按钮可回退到大网格
  if (route.query.tag !== name) {
    router.push({ path: '/topics', query: { ...route.query, tag: name } });
  }

  // 自动将左侧栏滚动到当前点击的话题位置（居中呈现）
  scrollSubtopicIntoView(name, true);

  // 在 nextTick 获取左侧栏对应项位置并执行 FLIP 位移动画
  nextTick(() => {
    const targetItem = subtopicItemRefs.get(name);
    if (targetItem && ghostData.value && showLeftSidebarActual.value) {
      const targetRect = targetItem.getBoundingClientRect();
      requestAnimationFrame(() => {
        if (ghostData.value) {
          ghostData.value.isAnimating = true;
          ghostData.value.top = targetRect.top;
          ghostData.value.left = targetRect.left;
          ghostData.value.width = targetRect.width;
          ghostData.value.height = targetRect.height;
        }

        setTimeout(() => {
          ghostData.value = null;
        }, 340);
      });
    } else {
      ghostData.value = null;
    }
  });
}

// 切换子话题：保持左侧栏当前滚动位置静止不动，仅切换右侧内容
function handleSwitchSubTopic(topic: any) {
  const name = getTopicName(topic);
  topicHubStore.openTopicSplit(topic);
  if (route.query.tag !== name) {
    router.replace({ path: '/topics', query: { ...route.query, tag: name } });
  }
}

function handleSelectSubtopicMobile(topic: any) {
  isMobileSubtopicPickerOpen.value = false;
  handleSwitchSubTopic(topic);
}

// 返回大网格
function handleBackToGrid() {
  topicHubStore.closeTopicSplit();
  if (route.query.tag) {
    if (window.history.state?.back) {
      router.back();
    } else {
      const nextQuery = { ...route.query };
      delete nextQuery.tag;
      router.replace({ path: '/topics', query: nextQuery });
    }
  }
}

// 监听路由 query.tag 变化（响应顶栏全局后退/前进、鼠标侧键后退）
watch(
  () => route.query.tag,
  (newTag) => {
    if (newTag && typeof newTag === 'string') {
      if (activeTopicTag.value !== newTag) {
        const targetTopic = rawTopicItems.value.find((item) => getTopicName(item) === newTag) || { title: newTag, tag: newTag };
        topicHubStore.openTopicSplit(targetTopic);
      }
    } else if (!newTag && viewMode.value === 'split') {
      topicHubStore.closeTopicSplit();
    }
  },
  { immediate: true }
);

// 中间动态选中事件
function handleFeedSelected(feed: any) {
  topicHubStore.selectFeed(feed);
  if (isThreeColumnMode.value) {
    isRightAsideUserClosed.value = false;
  }
}

// 栏目切换
function switchCategory(cat: CategoryItem) {
  activeCategoryUrl.value = cat.url;
  topicHubStore.setCategories(categories.value, cat.url);
  page.value = 1;
  noMore.value = false;
  firstItemCursor.value = '';
  lastItemCursor.value = '';
  rawTopicItems.value = [];
  fetchTopicData(cat.url, false);
}

function toggleCategoryPicker() {
  isCategoryPickerOpen.value = !isCategoryPickerOpen.value;
}

function handleSelectCategoryInSidebar(cat: CategoryItem) {
  isCategoryPickerOpen.value = false;
  switchCategory(cat);
}

function handleSidebarScroll(e: Event) {
  const target = e.target as HTMLElement;
  if (!target) return;
  if (target.scrollHeight - target.scrollTop - target.clientHeight < 500) {
    if (!loading.value && !noMore.value) {
      fetchTopicData(activeCategoryUrl.value, true);
    }
  }
}

async function fetchTopicData(url: string = topicEntryUrl, isLoadMore = false, allowNestedLoad = false) {
  if (loading.value && !allowNestedLoad) return;
  loading.value = true;

  try {
    const currentPage = isLoadMore ? page.value : 1;
    const res = await CoolapkTauriAPI.getTopicHubData(url, currentPage, isLoadMore ? firstItemCursor.value : '', isLoadMore ? lastItemCursor.value : '');
    if (!isLoadMore && Array.isArray(res?.tabs) && res.tabs.length > 0) {
      const nextCategories = normalizeCategoryList(res.tabs);
      const serverSelectedUrl = normalizeCategoryText(res?.selectedUrl);
      updateCategories(nextCategories, serverSelectedUrl);
      if (url === topicEntryUrl) {
        const defaultCategory = findHotCategory(nextCategories);
        const defaultUrl = defaultCategory?.url || serverSelectedUrl || nextCategories[0]?.url || '';
        if (defaultUrl) {
          activeCategoryUrl.value = defaultUrl;
          if (defaultUrl !== serverSelectedUrl && defaultUrl !== topicEntryUrl) {
            return fetchTopicData(defaultUrl, false, true);
          }
        }
      }
    }
    const dataList = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    const extractedTopics: any[] = [];

    dataList.forEach((item: any) => {
      if (item.entityType === 'card' && Array.isArray(item.entities)) {
        item.entities.forEach((sub: any) => {
          if (isTopicEntity(sub)) {
            extractedTopics.push(sub);
          }
        });
      } else if (isTopicEntity(item)) {
        extractedTopics.push(item);
      }
    });

    const responseFirstItem = normalizeCursor(res?.firstItem);
    const responseLastItem = normalizeCursor(res?.lastItem);
    if (!isLoadMore) {
      firstItemCursor.value = responseFirstItem || itemCursor(extractedTopics[0]);
    }
    if (responseLastItem) {
      lastItemCursor.value = responseLastItem;
    } else if (extractedTopics.length > 0) {
      lastItemCursor.value = itemCursor(extractedTopics[extractedTopics.length - 1]);
    }

    if (dataList.length === 0) {
      noMore.value = true;
    } else {
      const itemsToAdd = isLoadMore ? extractedTopics.filter((item) => {
        const key = topicKey(item);
        return !key || !rawTopicItems.value.some((existing) => topicKey(existing) === key);
      }) : extractedTopics;

      if (isLoadMore) {
        rawTopicItems.value.push(...itemsToAdd);
      } else {
        rawTopicItems.value = itemsToAdd;
      }
      topicHubStore.setTopicItems(rawTopicItems.value);
      page.value = currentPage + 1;

      // 仅当服务端实际返回条目极少且无游标时才判定为结束
      if (dataList.length < 4 && !responseLastItem) {
        noMore.value = true;
      }

      // 🚀 流水线极速预取（Pipeline Pre-load）：
      // 若初次加载后卡片较少（宽屏下少于 60 个且还有更多），0 延迟立即流水线拉取下一页，极速填满视口
      if (page.value <= 4 && !noMore.value && rawTopicItems.value.length > 0 && rawTopicItems.value.length < 80) {
        loading.value = false;
        return fetchTopicData(url, true, true);
      }
    }
  } catch (err) {
    console.warn('获取话题数据失败:', err);
  } finally {
    loading.value = false;
  }
}

function normalizeCategoryText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeCategoryList(value: any): CategoryItem[] {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(value?.entities)
      ? value.entities
      : Array.isArray(value?.data)
        ? value.data
        : [];
  return source.map((item: any, index: number) => {
    const extra = item?.extraData || item?.extra_data || {};
    const title = normalizeCategoryText(item?.title || item?.name || item?.label);
    const url = normalizeCategoryText(item?.url || item?.link || item?.pageUrl || item?.page_url || item?.pageName || item?.page_name || extra?.url || extra?.pageName);
    const key = normalizeCategoryText(item?.id || item?.entityId || item?.entity_id || `${title}-${url}-${index}`);
    return { key, title, url };
  }).filter((item: CategoryItem) => item.title && item.url);
}

function updateCategories(value: any, selectedUrl = ''): void {
  const nextCategories = normalizeCategoryList(value);
  categories.value = nextCategories;
  if (selectedUrl && nextCategories.some((item) => item.url === selectedUrl)) {
    activeCategoryUrl.value = selectedUrl;
  } else if (!activeCategoryUrl.value && nextCategories.length > 0) {
    activeCategoryUrl.value = nextCategories[0].url;
  }
  topicHubStore.setCategories(nextCategories, activeCategoryUrl.value);
}

function findHotCategory(items: CategoryItem[]): CategoryItem | undefined {
  return items.find((item) => item.title === '热门') || items.find((item) => item.title.includes('热门'));
}

function normalizeCursor(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function itemCursor(item: any): string {
  return normalizeCursor(item?.entityId ?? item?.id);
}

function isTopicEntity(item: any): boolean {
  if (!item) return false;
  const type = item.entityType || '';
  if (type === 'topic' || type === 'tag') return true;
  if (item.title && (item.logo || item.pic || item.cover || item.follower_num || item.follownum || item.commentnum || item.hot_num)) {
    return true;
  }
  return false;
}

function topicKey(item: any): string {
  const raw = item?.tag || item?.title || item?.title_format || item?.entityTemplate || '';
  return String(raw).replace(/^#|#$/g, '').trim().toLowerCase();
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 800) {
    if (!loading.value && !noMore.value) {
      fetchTopicData(activeCategoryUrl.value || topicEntryUrl, true);
    }
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && viewMode.value === 'split') {
    handleBackToGrid();
  }
}

function handleClickOutside(e: MouseEvent) {
  if (categoryPickerRef.value && !categoryPickerRef.value.contains(e.target as Node)) {
    isCategoryPickerOpen.value = false;
  }
}

onMounted(() => {
  loadPersistedSettings();
  updatePageContentWidth();
  if (typeof ResizeObserver !== 'undefined' && pageRootRef.value) {
    pageResizeObserver = new ResizeObserver(() => updatePageContentWidth());
    pageResizeObserver.observe(pageRootRef.value);
  }
  fetchTopicData(topicEntryUrl, false);
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  pageResizeObserver?.disconnect();
  pageResizeObserver = null;
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleGlobalKeydown);
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.topics-page {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background);
}

/* FLIP 共享过渡 Ghost 元素 */
.topic-transition-ghost {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background-color: var(--surface);
  border: 1px solid var(--brand-primary, #10b981);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(16, 185, 129, 0.2);
  display: flex;
  align-items: center;
  overflow: hidden;
  box-sizing: border-box;
}

.ghost-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  width: 100%;
}

.ghost-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  object-fit: cover;
}

.ghost-fallback-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.15);
  color: var(--brand-primary, #10b981);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.ghost-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--brand-primary, #10b981);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 视图 1：大网格布局 */
.topics-main-column {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--surface);
  animation: fadeIn 0.25s ease;
}

.topics-scroll-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 0 48px;
  background: var(--background-secondary);
}

.topics-toolbar-bar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  height: auto;
  min-height: 48px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  background-color: var(--surface);
}

.topics-tabs-wrapper {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  min-height: 48px;
  overflow-x: auto;
  padding: 0 16px;
  user-select: none;
}

.cat-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 8px 14px;
  background: transparent;
  border: none;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.cat-tab:hover {
  color: var(--text-primary);
}

.cat-tab.active {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 16px;
}

.cat-tab.active::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  width: 22px;
  height: 3.5px;
  transform: translateX(-50%);
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
}

.topics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-4, 16px);
  padding: 0 16px;
}

/* 视图 2：自适应分屏布局 */
.topics-split-layout {
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background);
  position: relative;
}

/* 1. 左侧子话题栏 */
.split-left-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  position: relative;
  z-index: 60;
  animation: slideInLeft 0.3s cubic-bezier(0.2, 0, 0, 1);
  box-sizing: border-box;
}

.sidebar-header {
  height: 52px;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  background: var(--surface);
  gap: 6px;
  position: relative;
  z-index: 70;
}

.btn-back-grid {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid rgba(16, 185, 129, 0.18);
  background: rgba(16, 185, 129, 0.08);
  color: var(--brand-primary, #10b981);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.btn-back-grid:hover {
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  border-color: var(--brand-primary, #10b981);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  transform: translateX(-2px);
}

.category-selector-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}

.category-dropdown-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  max-width: 100%;
  transition: background 0.15s ease;
}

.category-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-dropdown-btn:hover {
  background: var(--background-secondary);
}

.dropdown-arrow {
  font-size: 10px;
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.dropdown-arrow.is-open {
  transform: rotate(180deg);
}

.btn-collapse-sidebar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.btn-collapse-sidebar:hover {
  background: var(--background-secondary);
  color: var(--brand-primary, #10b981);
}

.category-picker-popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 8px;
  right: 8px;
  width: auto;
  max-height: 300px;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04);
  padding: 10px;
  z-index: 999;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
  box-sizing: border-box;
}

.category-picker-popover::-webkit-scrollbar {
  width: 4px !important;
  background: transparent !important;
}

.category-picker-popover::-webkit-scrollbar-button,
.category-picker-popover::-webkit-scrollbar-track {
  display: none !important;
  background: transparent !important;
}

.category-picker-popover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.16) !important;
  border-radius: 999px !important;
}

.picker-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  padding-left: 2px;
  letter-spacing: 0.5px;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.picker-item {
  height: 32px;
  padding: 0 6px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s ease;
}

.picker-item:hover {
  color: var(--text-primary);
  background: var(--surface-hover, rgba(0, 0, 0, 0.05));
}

.picker-item.active {
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
}

.sidebar-subtopics-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px;
  box-sizing: border-box;
  scrollbar-color: transparent transparent !important;
}

.sidebar-subtopics-list::-webkit-scrollbar {
  width: 4px !important;
  background: transparent !important;
}

.sidebar-subtopics-list::-webkit-scrollbar-button,
.sidebar-subtopics-list::-webkit-scrollbar-track {
  display: none !important;
  background: transparent !important;
}

.sidebar-subtopics-list::-webkit-scrollbar-thumb {
  background: transparent !important;
  border-radius: 999px !important;
  transition: background-color 0.2s ease;
}

/* 鼠标悬停左侧栏时，滑块清晰呈现 */
.sidebar-subtopics-list.show-scrollbar {
  scrollbar-color: rgba(0, 0, 0, 0.28) transparent !important;
}

.sidebar-subtopics-list.show-scrollbar::-webkit-scrollbar-thumb {
  background: var(--text-tertiary, rgba(0, 0, 0, 0.28)) !important;
}

.sidebar-subtopics-list.show-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--brand-primary, #10b981) !important;
}

.subtopic-item-wrap {
  margin-bottom: 3px;
}

.sidebar-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* 左右分割拖拽手柄：平时透明无痕，悬停时提示 */
.resizer-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resizer-handle-left {
  right: -4px;
}

.resizer-handle-right {
  left: -4px;
}

.resizer-line {
  width: 1.5px;
  height: 100%;
  background-color: transparent;
  transition: background-color 0.2s ease;
}

.resizer-handle:hover .resizer-line,
.resizer-handle:active .resizer-line {
  background-color: var(--brand-primary, #10b981);
}

/* 2. 中间动态流主栏：核心主内容自适应占满 */
.split-center-main {
  flex: 1;
  height: 100%;
  min-width: 480px;
  overflow: hidden;
  background: var(--background);
  animation: slideInUp 0.32s cubic-bezier(0.2, 0, 0, 1);
  display: flex;
  flex-direction: column;
}

/* 单栏模式或左栏收起时的顶部导航条 */
.single-column-top-nav {
  width: 100%;
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background-color: var(--surface);
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  box-sizing: border-box;
}

.top-nav-left-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-back-grid-mobile,
.btn-expand-left-sidebar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.btn-expand-left-sidebar:hover,
.btn-back-grid-mobile:hover {
  color: var(--brand-primary, #10b981);
  background: var(--background-secondary);
}

.mobile-subtopic-selector {
  position: relative;
}

.mobile-subtopic-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  background: var(--background-secondary);
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--brand-primary, #10b981);
  cursor: pointer;
}

.mobile-picker-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 200px;
  max-height: 260px;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: 6px;
  z-index: 100;
  scrollbar-width: thin !important;
  scrollbar-color: rgba(0, 0, 0, 0.16) transparent !important;
}

.mobile-picker-popover::-webkit-scrollbar {
  width: 4px !important;
  background: transparent !important;
}

.mobile-picker-popover::-webkit-scrollbar-button,
.mobile-picker-popover::-webkit-scrollbar-track {
  display: none !important;
  background: transparent !important;
}

.mobile-picker-popover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.16) !important;
  border-radius: 999px !important;
}

.mobile-subtopic-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-subtopic-item {
  padding: 8px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-subtopic-item:hover {
  background: var(--surface-hover);
}

.mobile-subtopic-item.active {
  background: rgba(16, 185, 129, 0.15);
  color: var(--brand-primary, #10b981);
  font-weight: 700;
}

/* 3. 右侧评论外层包裹容器 */
.split-right-wrapper {
  position: relative;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

/* 浮动展开按钮 */
.floating-expand-aside-btn {
  position: absolute;
  right: 20px;
  bottom: 24px;
  z-index: 100;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 24px;
  border: none;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.45);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.floating-expand-aside-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(16, 185, 129, 0.5);
}

/* 动画帧定义 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.loading-wrapper,
.empty-wrapper {
  padding: var(--space-10) 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.pagination-footer {
  padding: var(--space-6, 24px) 0;
  text-align: center;
}

.loading-more-footer {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.no-more-footer {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
