<template>
  <div class="settings-section">
    <h3 class="section-title">通知设置</h3>
    <div class="setting-group">
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">回复提醒</span>
          <span class="row-sub">有人评论或回复你的动态时通知</span>
        </div>
        <AppSwitch v-model="replyNotify" />
      </div>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">@提醒</span>
          <span class="row-sub">有人在动态中提到你时通知</span>
        </div>
        <AppSwitch v-model="atNotify" />
      </div>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">私信提醒</span>
          <span class="row-sub">收到私信消息时桌面弹窗提醒</span>
        </div>
        <AppSwitch v-model="pmNotify" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppSwitch from '../../components/common/AppSwitch.vue';

const replyNotify = ref(true);
const atNotify = ref(true);
const pmNotify = ref(true);
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
