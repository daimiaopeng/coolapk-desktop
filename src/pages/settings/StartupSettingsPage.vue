<template>
  <div class="settings-section">
    <h3 class="section-title">启动与行为设置</h3>

    <div class="setting-group">
      <h4 class="group-title">启动</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">启动后默认页签</span>
          <span class="row-sub">应用启动后首页自动进入的栏目</span>
        </div>
        <select v-model="settingsStore.settings.defaultHomeTab" class="select-control">
          <option value="index_v8">推荐</option>
          <option value="digest">头条</option>
          <option value="hot">热榜</option>
          <option value="latest">快讯</option>
          <option value="cool_picture">酷图</option>
          <option value="secondhand">二手</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">启动时检查更新</span>
          <span class="row-sub">应用启动后自动向 GitHub Release 检测最新版本</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.checkUpdateOnStartup" />
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">立即检查更新</span>
          <span class="row-sub">手动检测最新版本并重新弹出更新提示</span>
        </div>
        <button class="check-update-button" type="button" @click="checkNow">检查更新</button>
      </div>

      <p v-if="updateTipHidden" class="tray-tip">
        <i class="fas fa-info-circle"></i>
        已忽略更新提醒（忽略此版本或忽略所有更新），更新提示将不再自动弹出。
      </p>
      <button v-if="updateTipHidden" class="reset-update-button" type="button" @click="reopenTip">
        重新启用更新提醒
      </button>
    </div>

    <div class="setting-group">
      <h4 class="group-title">窗口行为</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">关闭主窗口到系统托盘</span>
          <span class="row-sub">点击关闭按钮后最小化到托盘常驻，而非直接退出程序</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.closeToTray" />
      </div>
      <p v-if="settingsStore.settings.closeToTray" class="tray-tip">
        <i class="fas fa-info-circle"></i>
        开启后可在系统托盘图标左键恢复窗口、右键菜单中选择“退出”来彻底关闭应用。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import AppSwitch from '../../components/common/AppSwitch.vue';

const settingsStore = useSettingsStore();

const updateTipHidden = computed(
  () => settingsStore.settings.ignoreAllUpdates || Boolean(settingsStore.settings.ignoredUpdateVersion)
);

function checkNow() {
  window.dispatchEvent(new Event('check-for-update'));
}

function reopenTip() {
  settingsStore.resetUpdateNotifications();
  window.dispatchEvent(new Event('check-for-update'));
}
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 720px;
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
  gap: 2px;
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

.select-control {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 6px 12px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.select-control:hover {
  border-color: var(--brand-primary);
}

.tray-tip {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.check-update-button,
.reset-update-button {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-green-border);
  border-radius: var(--radius-control);
  padding: 6px 16px;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-default);
}

.check-update-button:hover,
.reset-update-button:hover {
  background-color: var(--brand-soft-hover);
}

.reset-update-button {
  align-self: flex-start;
}
</style>
