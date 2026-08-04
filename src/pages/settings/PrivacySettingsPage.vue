<template>
  <div class="settings-section">
    <h3 class="section-title">隐私设置</h3>
    <div class="setting-group">
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">允许通过酷安号搜索我</span>
          <span class="row-sub">关闭后其他酷友将无法通过酷安号精确查找到你</span>
        </div>
        <AppSwitch v-model="searchable" />
      </div>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">显示使用的设备型号</span>
          <span class="row-sub">发动态时自动附加当前系统或设备尾巴</span>
        </div>
        <AppSwitch v-model="showDevice" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppSwitch from '../../components/common/AppSwitch.vue';

const searchable = ref(true);
const showDevice = ref(true);
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
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
</style>
