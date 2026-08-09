<template>
  <div class="settings-section">
    <h3 class="section-title">设备信息</h3>

    <div class="setting-group">
      <h4 class="group-title">当前状态</h4>
      <div class="status-box">
        <div class="status-row">
          <span class="status-key">登录状态</span>
          <span :class="['status-value', deviceInfo?.loggedIn ? 'status-on' : 'status-off']">
            {{ deviceInfo?.loggedIn ? '已登录（设备码固定）' : '未登录（设备码随机）' }}
          </span>
        </div>
        <div class="status-row">
          <span class="status-key">设备码（X-App-Device）</span>
          <code class="status-code" :title="deviceInfo?.deviceCode">{{ deviceInfo?.deviceCode || '加载中...' }}</code>
        </div>
        <p class="tray-tip">
          <i class="fas fa-info-circle"></i>
          未登录时设备码为随机生成（每台电脑首次生成后固定）；登录后使用账号绑定的固定设备码（默认与 SDK 官方一致，可被写操作校验通过），请勿手动修改。
        </p>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">自定义设备指纹</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">启用自定义设备信息</span>
          <span class="row-sub">自定义请求头中的机型、版本与系统信息（关闭后使用客户端默认值）</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.deviceFingerprint.customFingerprint" />
      </div>
    </div>

    <template v-if="settingsStore.settings.deviceFingerprint.customFingerprint">
      <div class="setting-group">
        <h4 class="group-title">机型模板</h4>
        <div class="setting-row">
          <div class="row-info">
            <span class="row-label">预设机型</span>
            <span class="row-sub">一键套用常见机型模板，或选择"自定义"手动输入</span>
          </div>
          <select v-model="presetModel" class="text-input select-input" @change="applyPreset">
            <option value="">自定义机型</option>
            <option v-for="p in DEVICE_PRESETS" :key="p.model" :value="p.model">
              {{ p.label }}（{{ p.model }}）
            </option>
          </select>
        </div>

        <div class="setting-row">
          <div class="row-info">
            <span class="row-label">机型型号</span>
            <span class="row-sub">内嵌于 User-Agent，如 23113RKC6C（小米 14）</span>
          </div>
          <input
            v-model="settingsStore.settings.deviceFingerprint.model"
            type="text"
            class="text-input"
            placeholder="如：23113RKC6C"
            maxlength="40"
          />
        </div>

        <div class="field-row">
          <div class="row-info">
            <span class="row-label">Android 版本</span>
            <span class="row-sub">UA 中的 Android 版本号</span>
          </div>
          <input
            v-model="settingsStore.settings.deviceFingerprint.androidVersion"
            type="text"
            class="text-input small-input"
            placeholder="16"
            maxlength="8"
          />
          <div class="row-info">
            <span class="row-label">Build 号</span>
            <span class="row-sub">UA 中的 Build 版本</span>
          </div>
          <input
            v-model="settingsStore.settings.deviceFingerprint.build"
            type="text"
            class="text-input"
            placeholder="AQ3A.250226.002"
            maxlength="40"
          />
        </div>
      </div>

      <div class="setting-group">
        <h4 class="group-title">应用与系统信息</h4>
        <div class="field-row">
          <div class="row-info">
            <span class="row-label">App 版本（X-App-Version）</span>
            <span class="row-sub">不得低于酷安官方最低支持版本</span>
          </div>
          <input
            v-model="settingsStore.settings.deviceFingerprint.appVersion"
            type="text"
            class="text-input small-input"
            placeholder="16.2.0"
            maxlength="20"
          />
          <div class="row-info">
            <span class="row-label">版本号（X-App-Code）</span>
            <span class="row-sub">同步作用于 X-App-Supported</span>
          </div>
          <input
            v-model="settingsStore.settings.deviceFingerprint.appCode"
            type="text"
            class="text-input small-input"
            placeholder="2604201"
            maxlength="12"
          />
        </div>

        <div class="field-row">
          <div class="row-info">
            <span class="row-label">SDK Int（X-Sdk-Int）</span>
            <span class="row-sub">Android SDK 版本号</span>
          </div>
          <input
            v-model="settingsStore.settings.deviceFingerprint.sdkInt"
            type="text"
            class="text-input small-input"
            placeholder="36"
            maxlength="4"
          />
          <div class="row-info">
            <span class="row-label">语言（X-Sdk-Locale）</span>
            <span class="row-sub">如 zh-CN / en-US</span>
          </div>
          <input
            v-model="settingsStore.settings.deviceFingerprint.locale"
            type="text"
            class="text-input small-input"
            placeholder="zh-CN"
            maxlength="16"
          />
        </div>

        <div class="setting-row">
          <div class="row-info">
            <span class="row-label">暗色模式（X-Dark-Mode）</span>
            <span class="row-sub">模拟客户端深浅色状态，与界面主题相互独立</span>
          </div>
          <AppSwitch
            :model-value="settingsStore.settings.deviceFingerprint.darkMode === '1'"
            @update:model-value="(v: boolean) => (settingsStore.settings.deviceFingerprint.darkMode = v ? '1' : '0')"
          />
        </div>
      </div>

      <div class="setting-group">
        <h4 class="group-title">预览</h4>
        <div class="preview-box">
          <div class="preview-row">
            <span class="preview-key">User-Agent</span>
            <code class="preview-value">{{ previewUserAgent }}</code>
          </div>
          <div class="preview-row">
            <span class="preview-key">X-App-Version</span>
            <code class="preview-value">{{ fingerprint.appVersion || '16.2.0' }}</code>
            <span class="preview-key">X-App-Code</span>
            <code class="preview-value">{{ fingerprint.appCode || '2604201' }}</code>
          </div>
          <div class="preview-row">
            <span class="preview-key">X-Sdk-Int</span>
            <code class="preview-value">{{ fingerprint.sdkInt || '36' }}</code>
            <span class="preview-key">X-Sdk-Locale</span>
            <code class="preview-value">{{ fingerprint.locale || 'zh-CN' }}</code>
            <span class="preview-key">X-Dark-Mode</span>
            <code class="preview-value">{{ fingerprint.darkMode }}</code>
          </div>
          <p v-if="versionWarning" class="version-warning">
            <i class="fas fa-exclamation-triangle"></i>
            {{ versionWarning }}
          </p>
        </div>
      </div>

      <div class="setting-group">
        <button class="reset-button" @click="resetToDefault">
          <i class="fas fa-undo"></i>
          恢复默认设置
        </button>
      </div>
    </template>

    <div class="setting-group">
      <h4 class="group-title">注意事项</h4>
      <p class="tray-tip">
        <i class="fas fa-info-circle"></i>
        设备码（X-App-Device）与请求令牌（X-App-Token）绑定账号，不支持自定义。修改机型、版本等字段后，若酷安返回"网络环境异常"或"请升级客户端"，说明该组合被服务端拒绝，请恢复默认或改用其他机型模板。
      </p>
      <p class="tray-tip">
        <i class="fas fa-info-circle"></i>
        修改立即生效，无需重启客户端，作用于所有请求（含发布动态、评论、点赞等）。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useSettingsStore, buildDeviceUserAgent } from '../../stores/settings';
import AppSwitch from '../../components/common/AppSwitch.vue';
import { DEVICE_PRESETS } from '../../utils/devicePresets';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../../stores/auth';
import type { DeviceFingerprintSettings } from '../../types/settings';

/** 当前生效设备信息（Rust 端查询）：登录态 + 设备码 */
const deviceInfo = ref<{ loggedIn: boolean; deviceCode: string } | null>(null);

const authStore = useAuthStore();

async function loadDeviceInfo() {
  try {
    const res = await invoke<any>('get_device_info');
    if (res && res.code === 200) {
      deviceInfo.value = res.data;
    }
  } catch (err) {
    console.warn('获取设备信息失败:', err);
  }
}
onMounted(loadDeviceInfo);
// 登录/登出/切换账号后刷新设备码状态
watch(
  () => authStore.user?.uid,
  () => loadDeviceInfo()
);

const settingsStore = useSettingsStore();

const fingerprint = computed(() => settingsStore.settings.deviceFingerprint);
const previewUserAgent = computed(() => buildDeviceUserAgent(fingerprint.value));

const presetModel = computed({
  get: () => {
    const f = fingerprint.value;
    return DEVICE_PRESETS.some((p) => p.model === f.model.trim()) ? f.model.trim() : '';
  },
  set: () => {
    // 仅通过 applyPreset 写入，避免 v-model 直接改动模型字段
  },
});

function applyPreset() {
  const f = fingerprint.value;
  const preset = DEVICE_PRESETS.find((p) => p.model === f.model.trim());
  if (!preset) return;
  f.androidVersion = preset.androidVersion;
  f.build = preset.build;
}

const versionWarning = computed(() => {
  const f = fingerprint.value;
  const code = Number(f.appCode);
  if (!Number.isNaN(code) && code > 0 && code < 2604201) {
    return `版本号 ${f.appCode} 低于当前官方版本 2604201，服务端可能拒绝请求（err_request_need_upgrade_new_version）。`;
  }
  const version = f.appVersion.trim();
  if (version) {
    const major = Number(version.split('.')[0]);
    if (!Number.isNaN(major) && major > 0 && major < 16) {
      return `App 版本 ${version} 低于当前官方主版本 16，服务端可能拒绝请求。`;
    }
  }
  return '';
});

function resetToDefault() {
  const defaults: DeviceFingerprintSettings = {
    customFingerprint: true,
    model: '23113RKC6C',
    androidVersion: '16',
    build: 'AQ3A.250226.002',
    appVersion: '16.2.0',
    appCode: '2604201',
    sdkInt: '36',
    locale: 'zh-CN',
    darkMode: '0',
  };
  Object.assign(settingsStore.settings.deviceFingerprint, defaults);
}
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 760px;
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
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-light);
}

.field-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-light);
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 120px;
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

.small-input {
  width: 130px;
}

.select-input {
  width: 230px;
  cursor: pointer;
}

.text-input:hover,
.text-input:focus {
  border-color: var(--brand-primary);
}

.preview-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}

.preview-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.preview-key {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.preview-value {
  font-family: var(--font-mono, Consolas, monospace);
  font-size: var(--font-size-caption);
  color: var(--text-primary);
  background-color: var(--surface);
  border-radius: var(--radius-control);
  padding: 2px 8px;
  word-break: break-all;
}

.version-warning {
  font-size: var(--font-size-caption);
  color: #e0533d;
  margin: var(--space-2) 0 0;
}

.status-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status-key {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  white-space: nowrap;
  width: 130px;
}

.status-value {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
}

.status-on {
  color: var(--brand-primary);
}

.status-off {
  color: #e0533d;
}

.status-code {
  font-family: var(--font-mono, Consolas, monospace);
  font-size: var(--font-size-caption);
  color: var(--text-primary);
  background-color: var(--surface);
  border-radius: var(--radius-control);
  padding: 2px 8px;
  word-break: break-all;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reset-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  align-self: flex-start;
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 8px 16px;
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.reset-button:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.tray-tip {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  margin: 0;
}

.tray-tip i {
  margin-top: 2px;
}
</style>
