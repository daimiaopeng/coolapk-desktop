<template>
  <div class="page-tab-bar" aria-label="已打开页面">
    <div ref="tabScroll" class="page-tab-scroll custom-scrollbar" @wheel="handleWheel">
      <div
        v-for="tab in tabsStore.tabs"
        :key="tab.id"
        class="page-tab"
        :title="tab.title"
        role="button"
        :aria-current="tab.id === tabsStore.activeId ? 'page' : undefined"
        tabindex="0"
        :data-tab-id="tab.id"
        @click="openTab(tab.id)"
        @keydown.enter.prevent="openTab(tab.id)"
        @keydown.space.prevent="openTab(tab.id)"
        @auxclick.middle.prevent="closeTab(tab.id)"
        @contextmenu.prevent.stop="openContextMenu($event, tab.id)"
        @pointerdown="startPointerDrag($event, tab.id)"
        :class="{ active: tab.id === tabsStore.activeId, dragging: tab.id === draggedId, 'drop-before': dropTarget?.id === tab.id && !dropTarget.after, 'drop-after': dropTarget?.id === tab.id && dropTarget.after }"
      >
        <i :class="[tab.icon, 'page-tab-icon']"></i>
        <span class="page-tab-title">{{ tab.title }}</span>
        <i v-if="tab.pinned && tab.id !== 'home'" class="fas fa-thumbtack page-tab-status" title="已固定"></i>
        <i v-else-if="tab.favorite" class="fas fa-star page-tab-status" title="已收藏"></i>
        <button
          v-if="tab.closable"
          type="button"
          class="page-tab-close"
          :aria-label="`关闭 ${tab.title}`"
          title="关闭标签页"
          @pointerdown.stop
          @click.stop="closeTab(tab.id)"
        >
          <i class="fas fa-xmark"></i>
        </button>
      </div>
    </div>

    <button type="button" class="page-tab-list-button" title="全部标签页" aria-label="全部标签页" @click.stop="toggleTabList">
      <i class="fas fa-chevron-down"></i>
    </button>

    <div v-if="tabListOpen" class="page-tab-menu page-tab-list-menu">
      <div class="page-tab-menu-heading">已打开</div>
      <button v-for="tab in tabsStore.tabs" :key="tab.id" type="button" :class="{ active: tab.id === tabsStore.activeId }" @click="openTabFromList(tab.id)">
        <i :class="tab.icon"></i>
        <span>{{ tab.title }}</span>
        <i v-if="tab.pinned && tab.id !== 'home'" class="fas fa-thumbtack"></i>
        <i v-if="tab.id === tabsStore.activeId" class="fas fa-check"></i>
      </button>
      <template v-if="tabsStore.favoritePages.length">
        <div class="page-tab-menu-divider"></div>
        <div class="page-tab-menu-heading">收藏的页面</div>
        <div v-for="page in tabsStore.favoritePages" :key="page.id" class="saved-page-row">
          <button type="button" @click="openSavedPage(page.id)"><i :class="page.icon"></i><span>{{ page.title }}</span></button>
          <button type="button" class="saved-page-remove" :aria-label="`取消收藏 ${page.title}`" title="取消收藏" @click="removeFavorite(page.id)"><i class="fas fa-star"></i></button>
        </div>
      </template>
    </div>

    <div v-if="contextMenu" class="page-tab-menu page-tab-context-menu" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
      <button v-if="contextTab?.id !== 'home'" type="button" @click="runContextAction('favorite')"><i :class="contextTab?.favorite ? 'fas fa-star' : 'far fa-star'"></i><span>{{ contextTab?.favorite ? '取消收藏此页面' : '收藏此页面' }}</span></button>
      <button v-if="contextTab?.id !== 'home'" type="button" @click="runContextAction('pin')"><i class="fas fa-thumbtack"></i><span>{{ contextTab?.pinned ? '取消固定标签页' : '固定标签页' }}</span></button>
      <div v-if="contextTab?.id !== 'home'" class="page-tab-menu-divider"></div>
      <button type="button" :disabled="!contextTab?.closable" @click="runContextAction('close')"><i class="fas fa-xmark"></i><span>关闭标签页</span></button>
      <button type="button" :disabled="tabsStore.tabs.length <= 1" @click="runContextAction('others')"><i class="far fa-window-restore"></i><span>关闭其他标签页</span></button>
      <button type="button" :disabled="!hasClosableTabsOnRight" @click="runContextAction('right')"><i class="fas fa-arrow-right"></i><span>关闭右侧标签页</span></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePageTabsStore } from '../../stores/pageTabs';

const router = useRouter();
const tabsStore = usePageTabsStore();
const tabListOpen = ref(false);
const tabScroll = ref<HTMLElement | null>(null);
const draggedId = ref('');
const dropTarget = ref<{ id: string; after: boolean } | null>(null);
let suppressClick = false;
let pointerDrag: { id: string; pointerId: number; startX: number; startY: number; active: boolean } | null = null;
const contextMenu = ref<{ id: string; x: number; y: number } | null>(null);
const contextTab = computed(() => tabsStore.tabs.find((tab) => tab.id === contextMenu.value?.id));
const hasClosableTabsOnRight = computed(() => {
  const index = tabsStore.tabs.findIndex((tab) => tab.id === contextMenu.value?.id);
  return index >= 0 && tabsStore.tabs.slice(index + 1).some((tab) => tab.closable);
});

function navigate(route: string | null) {
  if (route) void router.replace(route);
}

function openTab(id: string) {
  if (suppressClick) return;
  navigate(tabsStore.activate(id));
  closeMenus();
}

function startPointerDrag(event: PointerEvent, id: string) {
  if (event.button !== 0) return;
  pointerDrag = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
  suppressClick = false;
  closeMenus();
}

function handlePointerMove(event: PointerEvent) {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  if (!pointerDrag.active) {
    if (Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) < 5) return;
    pointerDrag.active = true;
    draggedId.value = pointerDrag.id;
    suppressClick = true;
    document.body.classList.add('is-page-tab-dragging');
  }
  event.preventDefault();
  const container = tabScroll.value;
  if (container) {
    const scrollBounds = container.getBoundingClientRect();
    if (event.clientX < scrollBounds.left + 36) container.scrollLeft -= 18;
    else if (event.clientX > scrollBounds.right - 36) container.scrollLeft += 18;
  }
  const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.page-tab');
  const targetId = targetElement?.dataset.tabId || '';
  if (!targetElement || !targetId || targetId === pointerDrag.id) {
    dropTarget.value = null;
    return;
  }
  const bounds = targetElement.getBoundingClientRect();
  const after = event.clientX >= bounds.left + bounds.width / 2;
  dropTarget.value = { id: targetId, after };
  tabsStore.move(pointerDrag.id, targetId, after);
}

function endPointerDrag(event: PointerEvent) {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  const wasActive = pointerDrag.active;
  pointerDrag = null;
  draggedId.value = '';
  dropTarget.value = null;
  document.body.classList.remove('is-page-tab-dragging');
  if (wasActive) window.setTimeout(() => { suppressClick = false; }, 0);
}

function handleWheel(event: WheelEvent) {
  const container = tabScroll.value;
  if (!container || container.scrollWidth <= container.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  event.preventDefault();
  container.scrollLeft += event.deltaY;
}

function openTabFromList(id: string) {
  openTab(id);
}

function openSavedPage(id: string) {
  navigate(tabsStore.openSaved(id));
  closeMenus();
}

function removeFavorite(id: string) {
  tabsStore.removeFavorite(id);
}

function closeTab(id: string) {
  navigate(tabsStore.close(id));
  closeMenus();
}

function toggleTabList() {
  contextMenu.value = null;
  tabListOpen.value = !tabListOpen.value;
}

function openContextMenu(event: MouseEvent, id: string) {
  tabListOpen.value = false;
  const menuWidth = 190;
  const menuHeight = 220;
  contextMenu.value = {
    id,
    x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
    y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
  };
}

function runContextAction(action: 'favorite' | 'pin' | 'close' | 'others' | 'right') {
  const id = contextMenu.value?.id;
  if (!id) return;
  if (action === 'favorite') tabsStore.toggleFavorite(id);
  else if (action === 'pin') tabsStore.togglePin(id);
  else if (action === 'close') navigate(tabsStore.close(id));
  else if (action === 'others') navigate(tabsStore.closeOthers(id));
  else navigate(tabsStore.closeRight(id));
  closeMenus();
}

function closeMenus() {
  tabListOpen.value = false;
  contextMenu.value = null;
}

onMounted(() => {
  document.addEventListener('click', closeMenus);
  window.addEventListener('pointermove', handlePointerMove, { passive: false });
  window.addEventListener('pointerup', endPointerDrag);
  window.addEventListener('pointercancel', endPointerDrag);
});
onUnmounted(() => {
  document.removeEventListener('click', closeMenus);
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', endPointerDrag);
  window.removeEventListener('pointercancel', endPointerDrag);
  document.body.classList.remove('is-page-tab-dragging');
});
</script>

<style scoped>
.page-tab-bar {
  position: relative;
  z-index: 700;
  display: flex;
  flex: 0 0 var(--page-tabbar-height, 38px);
  min-width: 0;
  height: var(--page-tabbar-height, 38px);
  padding: 4px 6px 0;
  background: var(--titlebar-background);
  border-bottom: 1px solid var(--border-light);
  user-select: none;
}

.page-tab-scroll {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 3px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.page-tab-scroll::-webkit-scrollbar {
  display: none;
}

.page-tab {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 1 190px;
  min-width: 108px;
  max-width: 220px;
  height: 33px;
  padding: 0 9px;
  gap: 7px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 9px 9px 0 0;
  cursor: default;
  outline: none;
  transition: background-color var(--duration-fast), color var(--duration-fast), border-color var(--duration-fast);
}

.page-tab.dragging {
  opacity: 0.45;
  cursor: grabbing;
}

.page-tab.drop-before::before,
.page-tab.drop-after::after {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 2px;
  content: '';
  background: var(--brand-primary);
  border-radius: 2px;
}

.page-tab.drop-before::before {
  left: -2px;
}

.page-tab.drop-after::after {
  right: -2px;
}

.page-tab:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.page-tab.active {
  color: var(--text-primary);
  background: var(--background);
  border-color: var(--border-light);
}

.page-tab:focus-visible {
  box-shadow: inset 0 0 0 2px var(--brand-primary);
}

.page-tab-icon {
  flex: 0 0 auto;
  width: 15px;
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
}

.page-tab.active .page-tab-icon {
  color: var(--brand-primary);
}

.page-tab-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-tab-status {
  flex: 0 0 auto;
  color: var(--brand-primary);
  font-size: 10px;
}

.page-tab-close {
  display: grid;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  padding: 0;
  place-items: center;
  color: var(--text-tertiary);
  background: transparent;
  border: 0;
  border-radius: 5px;
  opacity: 0;
  cursor: pointer;
}

.page-tab:hover .page-tab-close,
.page-tab.active .page-tab-close,
.page-tab-close:focus-visible {
  opacity: 1;
}

.page-tab-close:hover {
  color: var(--text-primary);
  background: var(--surface-active);
}

.page-tab-list-button {
  display: grid;
  flex: 0 0 32px;
  width: 32px;
  height: 30px;
  margin-left: 4px;
  padding: 0;
  place-items: center;
  color: var(--text-secondary);
  background: transparent;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
}

.page-tab-list-button:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.page-tab-menu {
  position: fixed;
  z-index: 2000;
  min-width: 190px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-dropdown, 0 10px 30px rgba(0, 0, 0, 0.16));
}

.page-tab-list-menu {
  position: absolute;
  top: 37px;
  right: 6px;
  width: min(320px, calc(100vw - 24px));
  max-height: 360px;
  overflow-y: auto;
}

.page-tab-menu button {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 34px;
  padding: 7px 9px;
  gap: 9px;
  color: var(--text-primary);
  background: transparent;
  border: 0;
  border-radius: 7px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.page-tab-menu button:hover,
.page-tab-menu button.active {
  background: var(--surface-hover);
}

.page-tab-menu button:disabled {
  color: var(--text-tertiary);
  opacity: 0.55;
  cursor: not-allowed;
}

.page-tab-menu button i {
  width: 16px;
  text-align: center;
}

.page-tab-menu button span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-tab-menu-heading {
  padding: 5px 9px 4px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 600;
}

.page-tab-menu-divider {
  height: 1px;
  margin: 5px 3px;
  background: var(--border-light);
}

.saved-page-row {
  display: flex;
  align-items: center;
}

.saved-page-row > button:first-child {
  min-width: 0;
}

.saved-page-row .saved-page-remove {
  flex: 0 0 30px;
  width: 30px;
  padding: 0;
  color: var(--brand-primary);
}
</style>
