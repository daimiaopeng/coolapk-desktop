<template>
  <div class="settings-section">
    <h3 class="section-title">下载与缓存设置</h3>

    <div class="setting-group">
      <h4 class="group-title">下载存储</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">默认保存目录</span>
          <span class="row-sub">{{ settingsStore.settings.downloadPath }}</span>
        </div>
        <AppButton variant="secondary" size="sm">更改目录</AppButton>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">同时下载并发任务数</span>
          <span class="row-sub">控制多文件下载时的同时并行任务</span>
        </div>
        <span class="value-badge">{{ settingsStore.settings.maxConcurrentDownloads }} 任务</span>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">图片与数据缓存</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">图片加载质量</span>
          <span class="row-sub">控制高清图与缩略图加载比例</span>
        </div>
        <select v-model="settingsStore.settings.imageQuality" class="select-control">
          <option value="standard">标准 (流畅省流量)</option>
          <option value="hd">高清 (推荐)</option>
          <option value="raw">原图</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">缓存占用</span>
          <span class="row-sub">当前已占用大约 48.6 MB 内存与磁盘缓存</span>
        </div>
        <AppButton variant="ghost" size="sm" @click="clearCache">清理缓存</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../../stores/settings';
import AppButton from '../../components/common/AppButton.vue';

const settingsStore = useSettingsStore();

function clearCache() {
  alert('本地图片与数据缓存已成功清理');
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

.value-badge {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--brand-primary);
}
</style>
