<template>
  <div class="settings-section">
    <h3 class="section-title">快捷键列表</h3>

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
const shortcuts = [
  { label: '全局搜索', desc: '快速唤起搜索框Command Palette', key: 'Ctrl + K' },
  { label: '发布动态', desc: '打开动态发布弹窗', key: 'Ctrl + N' },
  { label: '打开设置', desc: '快速进入桌面端设置中心', key: 'Ctrl + ,' },
  { label: '刷新当前流', desc: '重新加载首页信息流', key: 'Ctrl + R' },
  { label: '快速切换页面', desc: '使用数字键快速进入常用页面', key: 'Ctrl + 1..9' },
  { label: '折叠侧边栏', desc: '切换侧边栏展开与折叠状态', key: 'Ctrl + Shift + B' },
  { label: '页面前进后退', desc: '使用桌面浏览习惯切换页面历史', key: 'Alt + ← / →' },
  { label: '下一条动态', desc: '快速浏览卡片', key: 'J' },
  { label: '上一条动态', desc: '快速浏览卡片', key: 'K' },
  { label: '关闭浮层', desc: '关闭弹窗、抽屉或全屏图片', key: 'Esc' },
];
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
</style>
