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
          <span class="row-label">开机自启动</span>
          <span class="row-sub">登录系统后自动在后台启动应用</span>
        </div>
        <AppSwitch
          :model-value="settingsStore.settings.autostart"
          @update:model-value="toggleAutostart"
        />
      </div>
      <p v-if="autostartError" class="tray-tip">
        <i class="fas fa-exclamation-triangle"></i>
        设置开机自启动失败，请重试或检查系统权限。
      </p>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">启动时最小化到托盘</span>
          <span class="row-sub">启动后自动隐藏主窗口，在后台静默运行（适合配合开机自启动）</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.startMinimized" />
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
          <span class="row-label">更新渠道</span>
          <span class="row-sub">测试版渠道可提前体验新功能，稳定性略低于稳定版</span>
        </div>
        <select v-model="settingsStore.settings.updateChannel" class="select-control">
          <option value="stable">稳定版</option>
          <option value="beta" :disabled="!settingsStore.settings.experimentalFeatures">
            测试版{{ settingsStore.settings.experimentalFeatures ? '' : ' (需开启实验性功能)' }}
          </option>
        </select>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">实验性功能</span>
          <span class="row-sub">启用实验性功能，例如测试版更新渠道</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.experimentalFeatures" />
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
          <span class="row-label">关闭主窗口时</span>
          <span class="row-sub">点击关闭按钮后是退出程序，还是最小化到托盘常驻</span>
        </div>
        <select v-model="closeBehavior" class="select-control">
          <option value="exit">退出程序</option>
          <option value="tray">最小化到托盘</option>
        </select>
      </div>
      <p v-if="settingsStore.settings.closeToTray" class="tray-tip">
        <i class="fas fa-info-circle"></i>
        最小化到托盘后，可通过托盘图标左键恢复窗口，或右键菜单选择“退出”来彻底关闭应用。
      </p>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">窗口置顶</span>
          <span class="row-sub">主窗口始终显示在其他窗口之上</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.alwaysOnTop" />
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">记忆窗口大小与位置</span>
          <span class="row-sub">重启应用后恢复上次的窗口位置与大小</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.rememberWindowState" />
      </div>

      <p class="tray-tip">
        <i class="fas fa-info-circle"></i>
        应用支持单实例运行：重复启动时会自动聚焦已有窗口，不会打开多个实例。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import AppSwitch from '../../components/common/AppSwitch.vue';

const settingsStore = useSettingsStore();
const autostartError = ref(false);

const closeBehavior = computed({
  get: () => (settingsStore.settings.closeToTray ? 'tray' : 'exit'),
  set: (value: string) => {
    settingsStore.settings.closeToTray = value === 'tray';
  },
});

const updateTipHidden = computed(
  () => settingsStore.settings.ignoreAllUpdates || Boolean(settingsStore.settings.ignoredUpdateVersion)
);

onMounted(async () => {
  // 以系统实际状态为准校正开关（如用户在任务管理器中关闭了自启动）
  try {
    const { isEnabled } = await import('@tauri-apps/plugin-autostart');
    const enabled = await isEnabled();
    if (settingsStore.settings.autostart !== enabled) {
      settingsStore.settings.autostart = enabled;
    }
  } catch {
    // 非 Tauri 环境（浏览器预览）下忽略
  }
});

async function toggleAutostart(enabled: boolean) {
  const prev = settingsStore.settings.autostart;
  settingsStore.settings.autostart = enabled;
  autostartError.value = false;
  try {
    const { enable, disable } = await import('@tauri-apps/plugin-autostart');
    if (enabled) {
      await enable();
    } else {
      await disable();
    }
  } catch {
    settingsStore.settings.autostart = prev;
    autostartError.value = true;
  }
}

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
