<template>
  <div v-if="!requestCenterState.isOnline" class="network-status-banner" role="status">
    <i class="fas fa-wifi-slash"></i>
    <span>网络连接已断开，网络恢复后可重试失败的动态和评论请求。</span>
  </div>
</template>

<script setup lang="ts">
import { requestCenterState } from '../../utils/requestCenter';
</script>

<style scoped>
.network-status-banner { position: fixed; top: 72px; left: 50%; z-index: 2200; display: flex; align-items: center; gap: 8px; transform: translateX(-50%); padding: 8px 14px; color: var(--warning); background: var(--surface-elevated); border: 1px solid var(--warning); border-radius: var(--radius-pill); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); font-size: var(--font-size-caption); }
@media (max-width: 700px) { .network-status-banner { width: calc(100% - 32px); justify-content: center; text-align: center; } }
</style>
