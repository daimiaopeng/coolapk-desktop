<template>
  <div class="feed-header">
    <div class="user-clickable" title="查看用户主页" @click.stop="handleUserClick">
      <AppAvatar :src="avatar" size="md" />
    </div>
    <div class="user-info">
      <div class="user-row">
        <span class="username clickable" title="查看用户主页" @click.stop="handleUserClick">
          {{ username || '酷友' }}
        </span>
        <span v-if="level" class="user-level">Lv.{{ level }}</span>
        <span v-if="verifyTitle" class="verify-badge">{{ verifyTitle }}</span>
      </div>
      <div class="meta-row">
        <span v-if="recommendSource" class="source-tag">{{ recommendSource }}</span>
        <span class="dateline">{{ formatDateline(dateline) }}</span>
        <span v-if="showDeviceInfo && device" class="device-tag">· {{ device }}</span>
      </div>
    </div>

    <!-- 酷安 App 原生热榜名次 01/02 醒目标记 -->
    <div v-if="rankIndex" class="rank-badge">
      <i class="fas fa-chart-line rank-icon"></i>
      <span>{{ rankIndex < 10 ? '0' + rankIndex : rankIndex }}</span>
    </div>
    <div v-else class="action-more">
      <AppIconButton icon="fas fa-ellipsis-h" size="sm" title="更多" aria-label="更多" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppAvatar from '../common/AppAvatar.vue';
import AppIconButton from '../common/AppIconButton.vue';

const props = withDefaults(defineProps<{
  uid?: string | number;
  avatar?: string;
  username?: string;
  level?: number;
  verifyTitle?: string;
  dateline?: number | string;
  device?: string;
  rankIndex?: number;
  recommendSource?: string;
  showDeviceInfo?: boolean;
}>(), {
  showDeviceInfo: true,
});

const router = useRouter();

function handleUserClick() {
  const targetUid = props.uid || props.username;
  if (targetUid) {
    router.push(`/user/${targetUid}`);
  }
}

function formatDateline(time?: number | string): string {
  if (!time) return '刚刚';
  if (typeof time === 'string') return time;
  const now = Math.floor(Date.now() / 1000);
  const diff = now - time;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  const date = new Date(time * 1000);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}
</script>

<style scoped>
.feed-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.user-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.user-clickable {
  cursor: pointer;
  transition: transform var(--duration-fast);
}

.user-clickable:hover {
  transform: scale(1.05);
}

.username.clickable {
  cursor: pointer;
}

.username.clickable:hover {
  color: var(--brand-primary);
  text-decoration: underline;
}

.username {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.user-level {
  font-size: 10px;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  font-weight: bold;
}

.verify-badge {
  font-size: 11px;
  color: var(--warning);
}

.meta-row {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.source-tag {
  color: var(--brand-primary, #10b981);
  font-size: 11px;
  background-color: var(--brand-soft, rgba(16, 185, 129, 0.1));
  padding: 0 4px;
  border-radius: 3px;
}

.device-tag {
  margin-left: 2px;
}

.rank-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #ffffff;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  font-style: italic;
}

.rank-icon {
  font-size: 12px;
}
</style>
