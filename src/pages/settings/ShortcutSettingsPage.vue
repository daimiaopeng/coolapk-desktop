<template>
  <div class="settings-section">
    <h3 class="section-title">快捷键列表</h3>

    <div class="setting-group">
      <h4 class="group-title">消息输入</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">私信输入框回车行为</span>
          <span class="row-sub">自定义在私信对话中按下 Enter 时发送消息或插入换行</span>
        </div>
        <select v-model="settingsStore.settings.messageEnterBehavior" class="select-control" aria-label="私信输入框回车行为">
          <option value="send">Enter 发送，Shift+Enter 换行</option>
          <option value="newline">Enter 换行，Ctrl/⌘+Enter 发送</option>
        </select>
      </div>
    </div>

    <div class="setting-group">
      <div v-for="sc in shortcuts" :key="sc.key" class="setting-row">
        <div class="row-info">
          <span class="row-label">{{ sc.label }}</span>
          <span class="row-sub">{{ sc.desc }}</span>
        </div>
        <kbd class="shortcut-kbd">{{ sc.key }}</kbd>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePlatformShortcuts } from '../../utils/shortcuts';
import { useSettingsStore } from '../../stores/settings';

const { formatShortcut } = usePlatformShortcuts();
const settingsStore = useSettingsStore();
const shortcutDefinitions = [
  { label: '全局搜索', desc: '快速唤起搜索框Command Palette', key: 'Ctrl+K' },
  { label: '发布动态', desc: '打开动态发布弹窗', key: 'Ctrl+N' },
  { label: '打开设置', desc: '快速进入桌面端设置中心', key: 'Ctrl+,' },
  { label: '刷新当前流', desc: '重新加载首页信息流', key: 'Ctrl+R' },
  { label: '快速切换页面', desc: '使用数字键快速进入常用页面', key: 'Ctrl+1..9' },
  { label: '折叠侧边栏', desc: '切换侧边栏展开与折叠状态', key: 'Ctrl+Shift+B' },
  { label: '页面前进后退', desc: '使用桌面浏览习惯切换页面历史', key: 'Alt+←/→' },
  { label: '下一条动态', desc: '快速浏览卡片', key: 'J' },
  { label: '上一条动态', desc: '快速浏览卡片', key: 'K' },
  { label: '展开/收起评论', desc: '浏览卡片时展开或收起评论区', key: 'C' },
  { label: '关闭浮层/收起评论', desc: '关闭弹窗、抽屉、全屏图片或收起评论区', key: 'Esc' },
];
const shortcuts = computed(() => shortcutDefinitions.map((shortcut) => ({
  ...shortcut,
  key: formatShortcut(shortcut.key),
})));
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);

  border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-3);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.group-title {
  margin: 0;
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-light);
}

.row-info {
  display: flex;
  flex-direction: column;
}

.row-label {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.row-sub {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.shortcut-kbd {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 4px 10px;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
}

.select-control {
  max-width: 250px;
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 6px 12px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
}

.select-control:hover,
.select-control:focus {
  border-color: var(--brand-primary);
}
</style>
