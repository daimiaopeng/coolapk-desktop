<template>
  <div v-if="visible" class="channel-manager-overlay" @click.self="$emit('close')">
    <div class="channel-manager-dialog">
      <!-- 弹窗顶栏 -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <i class="fas fa-th-large"></i>
          </div>
          <div>
            <h3 class="header-title">频道管理</h3>
            <p class="header-desc">
              {{ isEditing ? '按住卡片直接拖拽排序，点击 × 移出频道' : '点击九宫格卡片快速直达频道' }}
            </p>
          </div>
        </div>

        <button class="close-btn" title="关闭" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- 弹窗主体内容区 -->
      <div class="dialog-body custom-scrollbar">
        <!-- 分组 1：我的频道 -->
        <div class="channel-section">
          <div class="section-header">
            <div class="section-title-wrap">
              <span class="section-title">我的频道</span>
              <span class="channel-badge">{{ activeChannels.length }} 个</span>
            </div>
            <button
              :class="['edit-toggle-btn', { 'is-active': isEditing }]"
              @click="toggleEditMode"
            >
              <i :class="isEditing ? 'fas fa-check' : 'fas fa-pen'"></i>
              <span>{{ isEditing ? '完成' : '编辑排序' }}</span>
            </button>
          </div>

          <!-- 九宫格 FLIP 动画平滑网格容器 -->
          <TransitionGroup
            name="channel-flip"
            tag="div"
            class="channel-grid"
            ref="gridContainer"
          >
            <div
              v-for="(item, idx) in activeChannels"
              :key="getTabKey(item)"
              :ref="(el) => setTileRef(el, idx)"
              :class="[
                'channel-tile',
                {
                  'is-current': !isEditing && activeKey === getTabKey(item),
                  'is-editing': isEditing,
                  'is-fixed': isFixedTab(item),
                  'is-placeholder': draggingItemKey === getTabKey(item),
                }
              ]"
              @pointerdown="onPointerDown($event, idx, item)"
              @click="handleTileClick(item)"
            >
              <!-- 当前浏览中徽标 -->
              <span v-if="!isEditing && activeKey === getTabKey(item)" class="current-indicator">
                <i class="fas fa-eye"></i> 正在看
              </span>

              <!-- 频道主体内容 -->
              <div class="tile-content">
                <span class="tile-label">{{ item.title }}</span>
                <span v-if="isFixedTab(item) && isEditing" class="fixed-tag">固定</span>
              </div>

              <!-- 编辑模式操作角标 -->
              <div v-if="isEditing" class="tile-edit-actions" @pointerdown.stop>
                <button
                  v-if="!isFixedTab(item)"
                  class="remove-tag-btn"
                  title="移出我的频道"
                  @click.stop="removeToHidden(idx)"
                >
                  <i class="fas fa-times"></i>
                </button>
                <div v-else class="lock-box">
                  <i class="fas fa-lock lock-icon" title="核心固定频道"></i>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>

        <!-- 分组 2：更多推荐频道（如果有隐藏/未添加的频道） -->
        <div v-if="hiddenChannels.length > 0" class="channel-section hidden-section">
          <div class="section-header">
            <div class="section-title-wrap">
              <span class="section-title">点击添加更多频道</span>
              <span class="channel-badge text-secondary">{{ hiddenChannels.length }} 个可用</span>
            </div>
          </div>

          <TransitionGroup name="channel-flip" tag="div" class="channel-grid">
            <div
              v-for="(item, idx) in hiddenChannels"
              :key="getTabKey(item)"
              class="channel-tile is-hidden-tile"
              @click="addToActive(idx)"
            >
              <div class="tile-content">
                <i class="fas fa-plus add-icon"></i>
                <span class="tile-label">{{ item.title }}</span>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </div>

      <!-- 弹窗底栏 -->
      <div class="dialog-footer">
        <button class="footer-btn secondary-btn" @click="resetToDefault">
          <i class="fas fa-undo"></i>
          <span>恢复默认</span>
        </button>

        <div class="footer-right">
          <button class="footer-btn primary-btn" @click="saveAndClose">
            <i class="fas fa-check"></i>
            <span>{{ isEditing ? '保存排序' : '确定' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 绝对精准跟手的悬浮卡片（Floating Mirror Overlay） -->
    <div
      v-if="isDragging && floatingItem"
      class="channel-floating-mirror"
      :style="floatingStyle"
    >
      <div class="tile-content">
        <span class="tile-label">{{ floatingItem.title }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import { CoolapkTauriAPI } from '../../api/coolapk';
import type { ConfigPageTab } from '../../types/settings';

const props = defineProps<{
  visible: boolean;
  tabs: ConfigPageTab[];
  activeKey?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectTab', key: string): void;
  (e: 'updated'): void;
}>();

const settingsStore = useSettingsStore();
const isEditing = ref(false);
const activeChannels = ref<ConfigPageTab[]>([]);
const hiddenChannels = ref<ConfigPageTab[]>([]);

// 独立浮动克隆层状态（杜绝鼠标与卡片错位漂移）
const isDragging = ref(false);
const floatingItem = ref<ConfigPageTab | null>(null);
const draggingItemKey = ref<string | null>(null);
const pointerPos = ref({ x: 0, y: 0 });
const grabOffset = ref({ x: 0, y: 0 });
const tileDimension = ref({ width: 0, height: 0 });

const tileElements = ref<(HTMLElement | null)[]>([]);
const gridContainer = ref<HTMLElement | null>(null);
let activePointerId: number | null = null;
let currentHoverIndex: number = -1;

function setTileRef(el: any, idx: number) {
  if (el) {
    tileElements.value[idx] = (el.$el || el) as HTMLElement;
  }
}

function getTabKey(tab: ConfigPageTab): string {
  return tab.page_name || tab.url || String(tab.id || tab.title);
}

function isFixedTab(tab: ConfigPageTab): boolean {
  return (
    tab.page_fixed === 1 ||
    tab.page_name === 'V9_HOME_TAB_HEADLINE' ||
    tab.url === '/main/headline' ||
    tab.title === '头条'
  );
}

const floatingStyle = computed(() => {
  if (!isDragging.value) return {};
  const x = pointerPos.value.x - grabOffset.value.x;
  const y = pointerPos.value.y - grabOffset.value.y;
  return {
    position: 'fixed' as const,
    left: '0px',
    top: '0px',
    width: `${tileDimension.value.width}px`,
    height: `${tileDimension.value.height}px`,
    transform: `translate3d(${x}px, ${y}px, 0px) scale(1.08)`,
    zIndex: 9999,
  };
});

function initChannels() {
  const all = [...props.tabs];
  const savedOrder = settingsStore.settings.homeTabOrder || [];

  if (!savedOrder.length) {
    activeChannels.value = all;
    hiddenChannels.value = [];
    return;
  }

  const map = new Map(all.map(t => [getTabKey(t), t]));
  const actives: ConfigPageTab[] = [];
  const addedKeys = new Set<string>();

  for (const k of savedOrder) {
    if (k.startsWith('__hidden__')) continue;
    const tab = map.get(k);
    if (tab) {
      actives.push(tab);
      addedKeys.add(k);
    }
  }

  // 补全新增未排序的 tab
  const hiddens: ConfigPageTab[] = [];
  for (const t of all) {
    const k = getTabKey(t);
    if (!addedKeys.has(k)) {
      if (savedOrder.includes(`__hidden__${k}`)) {
        hiddens.push(t);
      } else {
        actives.push(t);
      }
    }
  }

  activeChannels.value = actives;
  hiddenChannels.value = hiddens;
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      isEditing.value = false;
      cleanupDrag();
      initChannels();
    }
  },
  { immediate: true }
);

function toggleEditMode() {
  isEditing.value = !isEditing.value;
  cleanupDrag();
}

function handleTileClick(tab: ConfigPageTab) {
  if (!isEditing.value) {
    const key = getTabKey(tab);
    emit('selectTab', key);
    emit('close');
  }
}

// 移到隐藏列表
function removeToHidden(index: number) {
  if (index < 0 || index >= activeChannels.value.length) return;
  const [removed] = activeChannels.value.splice(index, 1);
  if (removed) {
    hiddenChannels.value.push(removed);
  }
}

// 从隐藏列表添加回我的频道
function addToActive(index: number) {
  if (index < 0 || index >= hiddenChannels.value.length) return;
  const [added] = hiddenChannels.value.splice(index, 1);
  if (added) {
    activeChannels.value.push(added);
  }
}

// --- 完美跟手的 Pointer 悬浮克隆拖拽机制 ---

function onPointerDown(e: PointerEvent, index: number, item: ConfigPageTab) {
  if (!isEditing.value || e.button !== 0) return;

  const targetEl = e.currentTarget as HTMLElement;
  const rect = targetEl.getBoundingClientRect();

  activePointerId = e.pointerId;
  targetEl.setPointerCapture(e.pointerId);

  isDragging.value = true;
  floatingItem.value = item;
  draggingItemKey.value = getTabKey(item);
  currentHoverIndex = index;

  tileDimension.value = { width: rect.width, height: rect.height };
  grabOffset.value = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  pointerPos.value = { x: e.clientX, y: e.clientY };

  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return;
  e.preventDefault();

  pointerPos.value = { x: e.clientX, y: e.clientY };

  // 检测鼠标正落在哪个卡槽位置
  const targetIndex = findHoveredTileIndex(e.clientX, e.clientY);
  if (targetIndex !== -1 && targetIndex !== currentHoverIndex) {
    const fromIdx = currentHoverIndex;
    const list = [...activeChannels.value];
    const [movedItem] = list.splice(fromIdx, 1);
    list.splice(targetIndex, 0, movedItem);

    activeChannels.value = list;
    currentHoverIndex = targetIndex;
  }
}

function findHoveredTileIndex(clientX: number, clientY: number): number {
  for (let i = 0; i < tileElements.value.length; i++) {
    const el = tileElements.value[i];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return i;
    }
  }
  return -1;
}

function onPointerUp(e: PointerEvent) {
  cleanupDrag();
}

function cleanupDrag() {
  isDragging.value = false;
  floatingItem.value = null;
  draggingItemKey.value = null;
  activePointerId = null;
  currentHoverIndex = -1;

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
}

onUnmounted(() => {
  cleanupDrag();
});

function resetToDefault() {
  settingsStore.settings.homeTabOrder = [];
  isEditing.value = false;
  cleanupDrag();
  initChannels();
  emit('updated');
}

function saveAndClose() {
  const resultKeys = activeChannels.value.map(t => getTabKey(t));
  for (const h of hiddenChannels.value) {
    resultKeys.push(`__hidden__${getTabKey(h)}`);
  }
  settingsStore.settings.homeTabOrder = resultKeys;

  // 官方格式：构造 home_tab_config 数组同步至酷安云端账号
  const cloudConfig = [
    ...activeChannels.value.map(t => ({
      id: String(t.id || ''),
      title: t.title,
      page_visibility: '1',
    })),
    ...hiddenChannels.value.map(t => ({
      id: String(t.id || ''),
      title: t.title,
      page_visibility: '0',
    })),
  ];

  try {
    void CoolapkTauriAPI.updateHomeTabConfig(JSON.stringify(cloudConfig));
  } catch (e) {
    console.warn('云端同步频道配置失败', e);
  }

  emit('updated');
  emit('close');
}
</script>

<style scoped>
.channel-manager-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.channel-manager-dialog {
  width: 520px;
  max-width: 92vw;
  max-height: 85vh;
  background: var(--surface, #ffffff);
  border-radius: 16px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border-light, rgba(0, 0, 0, 0.08));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popScale 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 顶栏 */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-box {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.header-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.header-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--text-primary);
}

/* 主体内容 */
.dialog-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.channel-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.channel-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--bg-subtle, rgba(0, 0, 0, 0.05));
  color: var(--text-secondary);
}

.edit-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.12));
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.edit-toggle-btn:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  color: var(--text-primary);
}

.edit-toggle-btn.is-active {
  background: #10b981;
  border-color: #10b981;
  color: #ffffff;
}

/* 九宫格 Grid 布局 */
.channel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  position: relative;
}

@media (max-width: 480px) {
  .channel-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* FLIP 平滑让位动画（核心） */
.channel-flip-move {
  transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1);
}

.channel-flip-enter-active,
.channel-flip-leave-active {
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.channel-flip-enter-from,
.channel-flip-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

/* 九宫格磁贴卡片 */
.channel-tile {
  position: relative;
  height: 44px;
  border-radius: 10px;
  background: var(--bg-subtle, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.channel-tile:hover:not(.is-editing) {
  background: var(--bg-hover, rgba(0, 0, 0, 0.06));
  border-color: var(--border-medium, rgba(0, 0, 0, 0.15));
  transform: translateY(-1px);
}

.channel-tile.is-current {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.4);
}

.channel-tile.is-current .tile-label {
  color: #10b981;
  font-weight: 700;
}

.current-indicator {
  position: absolute;
  top: -8px;
  left: 6px;
  background: #10b981;
  color: #ffffff;
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 3px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.tile-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.tile-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fixed-tag {
  font-size: 10px;
  color: var(--text-tertiary, #999);
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
}

/* 编辑模式 */
.channel-tile.is-editing {
  cursor: grab;
  border-style: dashed;
  border-color: rgba(16, 185, 129, 0.5);
}

.channel-tile.is-editing:hover {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.04);
}

/* 占位槽位样式（保持布局稳定） */
.channel-tile.is-placeholder {
  opacity: 0.2;
  border: 1.5px dashed #10b981;
  background: rgba(16, 185, 129, 0.05);
}

/* 绝对置顶悬浮镜像层（绝对精准跟随鼠标，零漂移） */
.channel-floating-mirror {
  pointer-events: none;
  background: var(--surface, #ffffff);
  border-radius: 10px;
  border: 1.5px solid #10b981;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.25), 0 0 0 2px rgba(16, 185, 129, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  will-change: transform;
}

.channel-floating-mirror .tile-label {
  font-size: 14px;
  font-weight: 600;
  color: #10b981;
}

.tile-edit-actions {
  position: absolute;
  top: -6px;
  right: -6px;
}

.remove-tag-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ef4444;
  color: #ffffff;
  border: 1.5px solid var(--surface, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4);
  transition: transform 0.15s ease;
}

.remove-tag-btn:hover {
  transform: scale(1.2);
}

.lock-box {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--surface);
  border-radius: 50%;
  padding: 2px;
}

.lock-icon {
  font-size: 10px;
  color: var(--text-tertiary, #aaa);
}

/* 隐藏待添加频道 */
.is-hidden-tile {
  border-style: dashed;
  background: transparent;
  color: var(--text-secondary);
}

.is-hidden-tile:hover {
  border-color: #10b981;
  color: #10b981;
  background: rgba(16, 185, 129, 0.04);
}

.add-icon {
  font-size: 11px;
  color: #10b981;
}

/* 底栏 */
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-top: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  background: var(--bg-subtle, rgba(0, 0, 0, 0.01));
}

.footer-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.secondary-btn {
  background: transparent;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.12));
  color: var(--text-secondary);
}

.secondary-btn:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  color: var(--text-primary);
}

.primary-btn {
  background: #10b981;
  border: none;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
}

.primary-btn:hover {
  background: #059669;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popScale {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
