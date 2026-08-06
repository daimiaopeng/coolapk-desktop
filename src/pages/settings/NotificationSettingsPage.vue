<template>
  <div class="settings-section">
    <h3 class="section-title">通知设置</h3>

    <div class="setting-group">
      <h4 class="group-title">提醒类型</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">回复提醒</span>
          <span class="row-sub">有人评论或回复你的动态时通知</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.notifyReplies" />
      </div>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">@提醒</span>
          <span class="row-sub">有人在动态中提到你时通知</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.notifyAt" />
      </div>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">私信提醒</span>
          <span class="row-sub">收到私信消息时通知</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.notifyPm" />
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">桌面通知</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">系统桌面通知</span>
          <span class="row-sub">应用在后台或最小化到托盘时，通过系统通知气泡提醒新消息</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.desktopNotifications" />
      </div>
      <div v-if="settingsStore.settings.desktopNotifications" class="setting-row">
        <div class="row-info">
          <span class="row-label">通知提示音</span>
          <span class="row-sub">收到新通知时播放提示音</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.notificationSound" />
      </div>
      <div v-if="settingsStore.settings.desktopNotifications" class="setting-row">
        <div class="row-info">
          <span class="row-label">通知轮询间隔</span>
          <span class="row-sub">后台检测新消息的频率，越短越及时但更耗电</span>
        </div>
        <select v-model.number="settingsStore.settings.notificationPollInterval" class="select-control">
          <option :value="1">1 分钟 (推荐)</option>
          <option :value="5">5 分钟</option>
          <option :value="10">10 分钟</option>
          <option :value="30">30 分钟</option>
        </select>
      </div>
      <p class="tray-tip">
        <i class="fas fa-info-circle"></i>
        桌面通知需要系统授权，首次提醒时会自动请求权限。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../../stores/settings';
import AppSwitch from '../../components/common/AppSwitch.vue';

const settingsStore = useSettingsStore();
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
</style>
