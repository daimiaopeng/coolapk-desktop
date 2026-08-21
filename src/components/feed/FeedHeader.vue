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
        <span v-if="level" :class="['user-level', `level-${Math.min(level, 12)}`]">
          Lv.{{ level }}
        </span>
        <span v-if="verifyTitle" class="verify-badge" :title="verifyTitle">
          <i class="fas fa-check-circle verify-icon"></i>
          <span>{{ verifyTitle }}</span>
        </span>
      </div>
      <div class="meta-row">
        <span v-if="showDeviceInfo && device" class="device-badge" :title="device">
          <i class="fas fa-mobile-alt device-icon"></i>
          <span>{{ device }}</span>
        </span>
        <span class="meta-dot" v-if="showDeviceInfo && device">•</span>
        <span class="dateline">{{ formatDateline(dateline) }}</span>
        <template v-if="isEdited">
          <span class="meta-dot">•</span>
          <button class="edited-badge" type="button" title="查看编辑记录" @click.stop="emit('edit-history')">
            <i class="fas fa-pen-to-square"></i>
            已编辑
          </button>
        </template>
      </div>
    </div>

    <div class="action-more">
      <AppIconButton
        icon="fas fa-ellipsis-h"
        size="sm"
        title="更多"
        aria-label="更多"
        @click.stop="emit('more')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useSettingsStore } from '../../stores/settings';
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
  entityType?: string;
  entityId?: string | number;
  isEdited?: boolean;
}>(), {
  showDeviceInfo: true,
});

const router = useRouter();
const settingsStore = useSettingsStore();

const emit = defineEmits<{
  (e: 'more'): void;
  (e: 'edit-history'): void;
}>();

function handleUserClick() {
  const targetUid = props.uid || props.username;
  if (targetUid) {
    router.push(`/user/${targetUid}`);
  }
}

function handleSourceClick() {
  if (props.entityType === 'product' && props.entityId) {
    router.push(`/product/${props.entityId}`);
  } else if (props.entityType === 'dyh' && props.entityId) {
    router.push(`/dyh/${props.entityId}`);
  }
}

function formatDateline(time?: number | string): string {
  if (!time) return '刚刚';
  if (typeof time === 'string') return time;
  if (settingsStore.settings.timeDisplay === 'absolute') {
    const d = new Date(time * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
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
  gap: 12px;
  margin-bottom: 10px;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.user-clickable {
  cursor: pointer;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.user-clickable:hover {
  transform: scale(1.05);
}

.username {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.username.clickable {
  cursor: pointer;
}

.username.clickable:hover {
  color: var(--brand-primary);
}

.verify-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  padding: 1px 7px;
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.2);
  line-height: 1.2;
}

.verify-icon {
  font-size: 11px;
}

.user-level {
  font-size: 11px;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 8px;
  color: #ffffff;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  line-height: 1.2;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.25);
  font-style: italic;
}

.meta-row {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-dot {
  color: var(--border-dark, rgba(0, 0, 0, 0.2));
  font-size: 11px;
}

.edited-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.4;
  background: transparent;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-default);
}

.edited-badge i {
  font-size: 10px;
}

.edited-badge:hover {
  color: var(--brand-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.source-tag {
  color: var(--brand-primary, #10b981);
  font-size: 12px;
  font-weight: 500;
  background-color: var(--brand-soft, rgba(16, 185, 129, 0.1));
  padding: 1px 8px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.source-icon {
  font-size: 11px;
}

.source-tag.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.source-tag.clickable:hover {
  background-color: rgba(16, 185, 129, 0.2);
  transform: translateY(-1px);
}

.device-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.04));
  color: var(--text-secondary);
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
}

.device-icon {
  font-size: 11px;
  color: var(--brand-primary);
}

.rank-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  color: #ffffff;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  font-style: italic;
  letter-spacing: 0.5px;
}

.rank-icon {
  font-size: 11px;
}
</style>
