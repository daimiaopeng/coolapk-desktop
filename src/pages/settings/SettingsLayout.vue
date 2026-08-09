<template>
  <div class="settings-page-container">
    <div class="settings-layout-card">
      <aside class="settings-sidebar">
        <h2 class="settings-title">设置中心</h2>
        <nav class="settings-menu">
          <router-link
            v-for="item in settingsMenu"
            :key="item.path"
            :to="item.path"
            class="settings-menu-item"
            active-class="is-active"
          >
            <i :class="[item.icon, 'menu-icon']"></i>
            <span>{{ item.label }}</span>
          </router-link>
        </nav>
      </aside>

      <section class="settings-content custom-scrollbar">
        <router-view></router-view>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const settingsMenu = [
  { path: '/settings/account', label: '账号与安全', icon: 'fas fa-user-shield' },
  { path: '/settings/notifications', label: '通知设置', icon: 'fas fa-bell' },
  { path: '/settings/privacy', label: '隐私设置', icon: 'fas fa-lock' },
  { path: '/settings/content', label: '内容偏好', icon: 'fas fa-sliders-h' },
  { path: '/settings/downloads', label: '下载与缓存', icon: 'fas fa-download' },
  { path: '/settings/appearance', label: '外观设置', icon: 'fas fa-palette' },
  { path: '/settings/shortcuts', label: '快捷键', icon: 'fas fa-keyboard' },
  { path: '/settings/startup', label: '启动与行为', icon: 'fas fa-power-off' },
  { path: '/settings/device', label: '设备信息', icon: 'fas fa-mobile-alt' },
  { path: '/settings/about', label: '关于酷安', icon: 'fas fa-info-circle' },
];
</script>

<style scoped>
.settings-page-container {
  width: 100%;
  height: 100%;
  padding: var(--space-4);
  display: flex;
}

.settings-layout-card {
  flex: 1;
  min-width: 0;
  height: 100%;
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  display: flex;
  overflow: hidden;
}

.settings-sidebar {
  width: 170px;
  background-color: var(--background);
  border-right: 1px solid var(--border);
  padding: var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.settings-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-5);
}

.settings-menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.settings-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 40px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-control);
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: all var(--duration-fast) var(--ease-default);
}

.settings-menu-item:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.settings-menu-item.is-active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.menu-icon {
  font-size: 15px;
  width: 18px;
  text-align: center;
}

.settings-content {
  flex: 1;
  padding: var(--space-6);
  overflow-y: auto;
}
</style>
