<template>
  <div class="settings-section">
    <h3 class="section-title">隐私设置</h3>

    <div class="setting-group">
      <h4 class="group-title">发帖设备信息</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">发帖显示设备信息</span>
          <span class="row-sub">发布动态时在正文末尾自动附加设备签名</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.publishDeviceSignature" />
      </div>

      <div v-if="settingsStore.settings.publishDeviceSignature" class="setting-row">
        <div class="row-info">
          <span class="row-label">设备签名</span>
          <span class="row-sub">自定义附加在动态末尾的设备信息文本</span>
        </div>
        <input
          v-model="settingsStore.settings.deviceSignature"
          type="text"
          class="text-input"
          placeholder="如：酷安桌面版"
          maxlength="40"
        />
      </div>
      <p class="tray-tip">
        <i class="fas fa-info-circle"></i>
        示例效果：{{ settingsStore.settings.publishDeviceSignature && settingsStore.settings.deviceSignature ? `... 来自 ${settingsStore.settings.deviceSignature}` : '未开启' }}
      </p>
    </div>

    <div class="setting-group">
      <h4 class="group-title">账号隐私</h4>
      <p class="tray-tip">
        <i class="fas fa-info-circle"></i>
        “允许通过酷安号搜索我”等账号级隐私设置由酷安官方服务器管理，桌面客户端暂未开放对应接口，请在酷安 App 中设置。
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

.text-input {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 6px 12px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  outline: none;
  width: 220px;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.text-input:hover,
.text-input:focus {
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
