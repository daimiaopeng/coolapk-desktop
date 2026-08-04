<template>
  <div class="update-status-card" :class="{ 'is-new-version': info?.hasNew }">
    <template v-if="!info">
      <div class="status-header">
        <i class="fa-solid fa-cloud-arrow-down status-icon"></i>
        <div>
          <h4 class="status-title">检查软件更新</h4>
          <p class="status-desc">连接 GitHub Release 检测官方最新桌面发布版本</p>
        </div>
      </div>
    </template>

    <template v-else-if="info.hasNew">
      <div class="status-header">
        <i class="fa-solid fa-circle-arrow-up status-icon new-icon"></i>
        <div>
          <h4 class="status-title text-success">发现新版本: {{ info.latestVersion }}</h4>
          <p class="status-desc">推荐及时升级体验更多高能特性与稳定性优化</p>
        </div>
      </div>
      <p v-if="info.releaseNotes" class="release-body">{{ info.releaseNotes }}</p>
      <div class="btn-action-row">
        <Button
          variant="primary"
          size="sm"
          icon="fa-solid fa-download"
          @click="$emit('download', info.downloadUrl)"
        >
          前往 GitHub 发布页下载产物
        </Button>
      </div>
    </template>

    <template v-else>
      <div class="status-header">
        <i class="fa-solid fa-circle-check status-icon success-icon"></i>
        <div>
          <h4 class="status-title">当前已是最新版本</h4>
          <p class="status-desc">你当前使用的酷安桌面版已经是最新稳定版本，无需更新。</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '../ui/Button.vue';

defineProps<{
  info?: {
    hasNew: boolean;
    latestVersion?: string;
    releaseNotes?: string;
    downloadUrl?: string;
  } | null;
}>();

defineEmits<{
  (e: 'download', url?: string): void;
}>();
</script>

<style scoped>
.update-status-card {
  padding: 16px 20px;
  background: var(--bg-subtle, #f8fafc);
  border: 1px solid var(--divider-color, #edf0f3);
  border-radius: var(--radius-lg, 10px);
}

.update-status-card.is-new-version {
  background: var(--color-success-light, #f0fdf4);
  border-color: var(--brand-green-border);
}

.status-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.status-icon {
  font-size: 1.6rem;
  color: var(--text-sub, #667085);
}

.status-icon.new-icon,
.status-icon.success-icon {
  color: var(--brand-green, #10b966);
}

.status-title {
  margin: 0 0 2px 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main, #172033);
}

.status-title.text-success {
  color: var(--brand-green, #10b966);
}

.status-desc {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-sub, #667085);
}

.release-body {
  margin: 12px 0;
  font-size: 0.82rem;
  color: var(--text-sub, #667085);
  line-height: 1.5;
  white-space: pre-wrap;
  background: var(--bg-card, #ffffff);
  padding: 10px 14px;
  border-radius: var(--radius-sm, 6px);
  border: 1px dashed var(--border-color, #e4e9ef);
}

.btn-action-row {
  margin-top: 12px;
}
</style>
