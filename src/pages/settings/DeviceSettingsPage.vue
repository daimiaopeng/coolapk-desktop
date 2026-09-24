<template>
  <div class="settings-section">
    <h3 v-if="!editorOnly" class="section-title">设备信息</h3>

    <div v-if="!editorOnly" class="setting-group">
      <h4 class="group-title">当前状态</h4>
      <div class="status-box">
        <div class="status-row">
          <span class="status-key">登录状态</span>
          <span :class="['status-value', deviceInfo?.loggedIn ? 'status-on' : 'status-off']">
            {{ deviceInfo?.loggedIn ? '已登录（设备码固定）' : '未登录（设备码随机）' }}
          </span>
        </div>
        <div class="status-row">
          <span class="status-key">数盟设备 ID（用于生成 X-App-Device）</span>
          <span :class="['status-value', currentDeviceId ? 'status-on' : 'status-warn']" :title="currentDeviceId || undefined">
            {{ currentDeviceId ? '已配置（' + currentDeviceId + '）' : '未配置（敏感写操作可能受限）' }}
          </span>
        </div>
        <div class="status-row">
          <span class="status-key">设备码（X-App-Device）</span>
          <code class="status-code" :title="deviceInfo?.deviceCode">{{ deviceInfo?.deviceCode || '加载中...' }}</code>
        </div>
        <p class="tray-tip">
          <i class="fas fa-info-circle"></i>
          粘贴手机官方酷安复制的设备日志，保存后会用于生成应用请求的设备码。
        </p>
      </div>
    </div>

    <!-- 数盟设备认证 -->
    <div class="setting-group">
      <h4 class="group-title">数盟设备 ID（用于生成 X-App-Device）</h4>
      <div class="setting-card">
        <p class="card-desc">
          粘贴手机官方酷安复制的完整日志或设备 ID，保存后用于应用请求的设备标识。
        </p>

        <div class="device-id-input-row">
          <div class="input-wrapper">
            <input
              v-model="deviceIdInput"
              type="text"
              class="text-input full-width-input"
              placeholder="粘贴手机官方日志或输入数盟设备 ID（形如 DU...）"
              @input="onDeviceIdInputChange"
            />
            <button
              v-if="deviceIdInput"
              type="button"
              class="clear-input-btn"
              title="清空输入"
              @click="clearDeviceIdInput"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          <button type="button" class="action-btn" @click="handlePasteClipboard">
            <i class="fas fa-paste"></i>
            读取剪贴板
          </button>
          <button
            type="button"
            class="action-btn primary-btn"
            :disabled="!parsedDeviceId"
            @click="saveCustomDeviceId"
          >
            <i class="fas fa-check"></i>
            保存
          </button>
          <button
            v-if="currentDeviceId"
            type="button"
            class="action-btn danger-btn"
            title="清除已保存的设备ID"
            @click="clearSavedDeviceId"
          >
            <i class="fas fa-trash-can"></i>
            清除
          </button>
        </div>

        <div v-if="parsedDeviceId" class="extract-tip success-tip">
          <i class="fas fa-check-circle"></i>
          <span>
            已识别有效设备 ID：<code>{{ parsedDeviceId }}</code>
            {{ parsedDeviceId === currentDeviceId ? '（当前生效中）' : '（点击“保存”生效）' }}
          </span>
        </div>
        <div v-else-if="deviceIdInput.trim()" class="extract-tip error-tip">
          <i class="fas fa-circle-xmark"></i>
          <span>未能识别出有效的设备 ID，请确认复制内容是否完整</span>
        </div>

        <!-- 提取教程指引 -->
        <div class="tutorial-box">
          <div class="tutorial-header" @click="tutorialExpanded = !tutorialExpanded">
            <div class="tutorial-title">
              <i class="fas fa-mobile-screen-button"></i>
              <span>手机官方酷安提取步骤指引</span>
            </div>
            <i :class="['fas', tutorialExpanded ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
          </div>

          <div v-show="tutorialExpanded" class="tutorial-steps">
            <div class="tut-step">
              <div class="tut-num">1</div>
              <div class="tut-content">
                打开手机官方酷安 App，依次点击：<strong>【我】</strong>→右上角<strong>【设置】</strong>（齿轮图标）→滑动到最底部点<strong>【关于】</strong>。
              </div>
            </div>
            <div class="tut-step">
              <div class="tut-num">2</div>
              <div class="tut-content">
                进入<strong>【关于】</strong>页面，点击右上角<strong>【三个点】</strong>（菜单图标），在弹出选项中点击<strong>【检查日志】</strong>进入<strong>【测试与日志】</strong>页面，在选项列表中下滑，找到<strong>【复制 OAID】</strong>（部分版本直接显示为<strong>【OAID】</strong>）。
              </div>
            </div>
            <div class="tut-step">
              <div class="tut-num">3</div>
              <div class="tut-content">
                在该条目上连续快速点击 <strong>5 次</strong>：
                <div class="tut-subclicks">
                  <div>· 前 1~4 次点击：屏幕只会提示 “OAID 已复制”；</div>
                  <div class="tut-sub-highlight">· <strong>第 5 次点击</strong>：屏幕下方会弹出 Toast 提示：<strong>“设备ID 已复制”</strong>！</div>
                </div>
              </div>
            </div>
            <div class="tut-step">
              <div class="tut-num">4</div>
              <div class="tut-content">
                复制后回到此处，点击上方的【读取剪贴板】或直接粘贴，确认识别出的设备 ID 后点击【保存】。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!editorOnly" class="setting-group">
      <h4 class="group-title">自定义设备指纹</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">启用自定义设备信息</span>
          <span class="row-sub">自定义请求头中的机型、版本与系统信息（关闭后使用客户端默认值）</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.deviceFingerprint.customFingerprint" />
      </div>
    </div>

    <template v-if="!editorOnly && settingsStore.settings.deviceFingerprint.customFingerprint">
      <div class="setting-group">
        <h4 class="group-title">机型模板</h4>
        <div class="setting-row">
          <div class="row-info">
            <span class="row-label">预设机型</span>
            <span class="row-sub">一键套用常见机型模板，或选择"自定义"手动输入</span>
          </div>
          <select v-model="presetModel" class="text-input select-input">
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
            placeholder="35"
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
            <code class="preview-value">{{ fingerprint.sdkInt || '35' }}</code>
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

    <div v-if="!editorOnly" class="setting-group">
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
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useSettingsStore, buildDeviceUserAgent } from '../../stores/settings';
import AppSwitch from '../../components/common/AppSwitch.vue';
import { DEVICE_PRESETS } from '../../utils/devicePresets';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../../stores/auth';
import type { DeviceFingerprintSettings } from '../../types/settings';
import { parseOrExtractDeviceId, isValidShuzlmDeviceId } from '../../utils/shuzilmDeviceGuide';
import { showToast } from '../../utils/toast';

defineProps<{ editorOnly?: boolean }>();
const emit = defineEmits<{ deviceIdSaved: [] }>();

/** 当前生效设备信息（Rust 端查询）：登录态 + 设备码 + 设备ID */
const deviceInfo = ref<{ loggedIn: boolean; deviceCode: string; deviceId?: string } | null>(null);

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

const currentDeviceId = computed(() => settingsStore.settings.deviceFingerprint?.deviceId || '');
const deviceIdInput = ref(currentDeviceId.value);
const parsedDeviceId = ref(isValidShuzlmDeviceId(currentDeviceId.value) ? currentDeviceId.value : '');
const tutorialExpanded = ref(!currentDeviceId.value);

watch(
  currentDeviceId,
  (val) => {
    deviceIdInput.value = val;
    parsedDeviceId.value = isValidShuzlmDeviceId(val) ? val : '';
  },
  { immediate: true }
);

function onDeviceIdInputChange() {
  const parsed = parseOrExtractDeviceId(deviceIdInput.value);
  if (parsed && isValidShuzlmDeviceId(parsed)) {
    parsedDeviceId.value = parsed;
  } else {
    parsedDeviceId.value = '';
  }
}

function clearDeviceIdInput() {
  deviceIdInput.value = '';
  parsedDeviceId.value = '';
}

async function handlePasteClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      deviceIdInput.value = text;
      onDeviceIdInputChange();
      if (parsedDeviceId.value) {
        showToast('已从剪贴板读取并成功提取设备 ID', 'success');
      } else {
        showToast('已读取剪贴板，但未能识别出合法设备 ID', 'warning');
      }
    }
  } catch (err) {
    showToast('读取剪贴板失败，请手动在此粘贴', 'error');
  }
}

async function saveCustomDeviceId() {
  if (!parsedDeviceId.value) return;
  settingsStore.settings.deviceFingerprint.deviceId = parsedDeviceId.value;
  // 旧版手动会话值不再作为隐藏配置随写请求发送。
  settingsStore.settings.deviceFingerprint.ddid = '';
  // 保存后等待原生客户端更新设备码，再提示用户继续发帖或评论。
  await nextTick();
  const synced = await settingsStore.syncDeviceProfile(settingsStore.settings);
  await settingsStore.flushSettings();
  if (!synced) {
    showToast('设备 ID 已保存，但同步请求设备码失败，请重试', 'error');
    return;
  }
  await loadDeviceInfo();
  showToast('设备 ID 已保存，可以重试发帖或评论', 'success');
  emit('deviceIdSaved');
}

async function clearSavedDeviceId() {
  settingsStore.settings.deviceFingerprint.deviceId = '';
  deviceIdInput.value = '';
  parsedDeviceId.value = '';
  await nextTick();
  const synced = await settingsStore.syncDeviceProfile(settingsStore.settings);
  await settingsStore.flushSettings();
  if (!synced) {
    showToast('设备 ID 已清除，但同步请求设备码失败，请重试', 'error');
    return;
  }
  await loadDeviceInfo();
  showToast('数盟设备 ID 已清除', 'info');
}

const fingerprint = computed(() => settingsStore.settings.deviceFingerprint);
const previewUserAgent = computed(() => buildDeviceUserAgent(fingerprint.value));

const presetModel = computed({
  get: () => {
    const f = fingerprint.value;
    return DEVICE_PRESETS.some((p) => p.model === f.model.trim()) ? f.model.trim() : '';
  },
  set: (model: string) => {
    const preset = DEVICE_PRESETS.find((item) => item.model === model);
    if (!preset) return;
    Object.assign(fingerprint.value, {
      model: preset.model,
      androidVersion: preset.androidVersion,
      build: preset.build,
    });
  },
});

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
    deviceId: '',
    ddid: '',
    model: '23113RKC6C',
    androidVersion: '16',
    build: 'AQ3A.250226.002',
    appVersion: '16.2.0',
    appCode: '2604201',
    sdkInt: '35',
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
  min-width: 0;
}

.status-key {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  white-space: nowrap;
  flex: 0 0 190px;
}

.status-value {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  min-width: 0;
  flex: 0 1 420px;
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

.status-warn {
  color: #f59e0b;
}

.setting-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}

.card-desc {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.device-id-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.input-wrapper {
  position: relative;
  flex: 1;
  min-width: 260px;
  display: flex;
  align-items: center;
}

.full-width-input {
  width: 100%;
  padding-right: 32px;
  font-family: var(--font-mono, Consolas, monospace);
  font-size: 13px;
}

.clear-input-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.clear-input-btn:hover {
  color: var(--text-primary);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 7px 14px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  white-space: nowrap;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.primary-btn {
  background-color: var(--brand-primary);
  border-color: var(--brand-primary);
  color: #ffffff;
  font-weight: var(--font-weight-medium);
}

.primary-btn:hover:not(:disabled) {
  opacity: 0.9;
  color: #ffffff;
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.danger-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.extract-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-control);
}

.success-tip {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: var(--brand-primary);
}

.success-tip code {
  font-weight: 700;
  font-family: var(--font-mono, Consolas, monospace);
  word-break: break-all;
}

.error-tip {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #ef4444;
}

.tutorial-box {
  margin-top: var(--space-2);
  border: 1px dashed var(--border);
  border-radius: var(--radius-control);
  background: var(--surface);
  overflow: hidden;
}

.tutorial-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  transition: background-color var(--duration-fast);
}

.tutorial-header:hover {
  background: var(--surface-hover, rgba(0, 0, 0, 0.03));
}

.tutorial-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.tutorial-title i {
  color: var(--brand-primary);
}

.tutorial-steps {
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px dashed var(--border);
}

.tut-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 8px;
}

.tut-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--brand-primary);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.tut-content {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.tut-subclicks {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 4px;
  padding: 6px 10px;
  background: var(--background);
  border-radius: 4px;
  border: 1px solid var(--border);
}

.tut-sub-highlight {
  color: var(--brand-primary);
  font-weight: 500;
}
</style>
