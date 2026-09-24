<template>
  <AppDialog
    :is-open="shuzilmGuideState.visible"
    title="设备 ID 设置"
    :width="800"
    @close="handleClose"
  >
    <div class="guide-modal-body">
      <!-- 原因状态提示条 -->
      <div
        v-if="shuzilmGuideState.reason === 'risk_controlled'"
        class="status-banner banner-danger"
      >
        <i class="fas fa-triangle-exclamation banner-icon"></i>
        <div class="banner-text">
          <div class="banner-title">酷安服务端风控拦截</div>
          <div class="banner-desc">
            {{ shuzilmGuideState.message || '请求被酷安服务端拦截。请在下方粘贴手机官方酷安复制的设备日志，保存后重试。' }}
          </div>
        </div>
      </div>
      <div
        v-else-if="shuzilmGuideState.reason === 'missing_id'"
        class="status-banner banner-warning"
      >
        <i class="fas fa-circle-exclamation banner-icon"></i>
        <div class="banner-text">
          <div class="banner-title">未配置设备 ID</div>
          <div class="banner-desc">
            请在下方粘贴手机官方酷安复制的设备日志，保存后重试。
          </div>
        </div>
      </div>
      <!-- 直接复用设置页的设备 ID 输入、剪贴板按钮和提取指引。 -->
      <DeviceSettingsPage editor-only @device-id-saved="handleSaved" />
    </div>

    <!-- 底部按钮操作栏 -->
    <template #footer>
      <div class="footer-layout">
        <div class="footer-left">
          <AppButton
            v-if="shuzilmGuideState.onConfirmContinue"
            variant="ghost"
            type="button"
            class="btn-continue-anyway"
            @click="handleContinue"
          >
            仍要尝试发送
          </AppButton>
        </div>
      </div>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import AppDialog from '../common/AppDialog.vue';
import AppButton from '../common/AppButton.vue';
import DeviceSettingsPage from '../../pages/settings/DeviceSettingsPage.vue';
import { shuzilmGuideState, closeShuzilmGuide } from '../../utils/shuzilmDeviceGuide';

// 设置页保存并同步设备码后，继续用户刚才的发帖或评论。
function handleSaved() {
  const onContinue = shuzilmGuideState.onConfirmContinue;
  closeShuzilmGuide();
  onContinue?.();
}
function handleContinue() {
  const onContinue = shuzilmGuideState.onConfirmContinue;
  closeShuzilmGuide();
  if (onContinue) {
    onContinue();
  }
}

function handleClose() {
  closeShuzilmGuide();
}
</script>

<style scoped>
.guide-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  color: var(--text-primary);
}

.status-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2, 8px);
  padding: 10px 14px;
  border-radius: var(--radius-control, 8px);
  font-size: 13px;
  line-height: 1.5;
}

.banner-danger {
  background: rgba(240, 68, 68, 0.12);
  border: 1px solid rgba(240, 68, 68, 0.3);
  color: var(--danger, #f04444);
}

.banner-warning {
  background: rgba(245, 159, 0, 0.12);
  border: 1px solid rgba(245, 159, 0, 0.3);
  color: var(--warning, #f59f00);
}

.banner-icon {
  font-size: 16px;
  margin-top: 2px;
  flex-shrink: 0;
}

.banner-title {
  font-weight: 700;
  margin-bottom: 2px;
}

.banner-desc {
  color: var(--text-secondary);
  font-size: 12px;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.step-num {
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

.step-content {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  flex: 1;
}

.step-hl {
  color: var(--text-primary);
  font-weight: 600;
  background: var(--surface);
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.sub-clicks {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  padding: 6px 10px;
  background: var(--surface);
  border-radius: 6px;
  border: 1px dashed var(--border);
  font-size: 12px;
}

.click-line {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
}

.click-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-tertiary);
  flex-shrink: 0;
}

.highlight-line {
  color: var(--brand-primary);
}

.highlight-dot {
  background: var(--brand-primary);
}

.input-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.input-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.device-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  background: var(--background, #0e1012);
  border: 1px solid var(--border);
  border-radius: var(--radius-control, 8px);
  color: var(--text-primary);
  font-size: 12px;
  font-family: Consolas, Monaco, monospace;
  line-height: 1.5;
  resize: vertical;
  transition: border-color var(--duration-fast, 0.15s);
}

.device-textarea:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.extract-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-control, 6px);
  font-size: 12px;
}

.result-success {
  background: rgba(16, 183, 104, 0.1);
  border: 1px solid rgba(16, 183, 104, 0.3);
  color: var(--success, #10b768);
}

.result-error {
  background: rgba(240, 68, 68, 0.1);
  border: 1px solid rgba(240, 68, 68, 0.25);
  color: var(--danger, #f04444);
}

.text-success {
  color: var(--success, #10b768);
}

.text-danger {
  color: var(--danger, #f04444);
}

.extracted-code {
  font-family: Consolas, Monaco, monospace;
  font-weight: 700;
  color: var(--brand-primary);
  word-break: break-all;
}

.footer-layout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.btn-continue-anyway {
  color: var(--text-tertiary) !important;
}

.btn-continue-anyway:hover {
  color: var(--text-primary) !important;
}
</style>
