<template>
  <div class="feed-header">
    <UserHoverCard
      :uid="uid"
      :avatar="avatar"
      :username="username"
      :level="level"
      :verify-title="verifyTitle"
      :device="device"
    >
      <div class="user-clickable" @click.stop="handleUserClick">
        <AppAvatar :src="avatar" :plugin-url="effectivePluginUrl" size="md" />
      </div>
    </UserHoverCard>

    <div class="user-info">
      <div class="user-row">
        <UserHoverCard
          :uid="uid"
          :avatar="avatar"
          :username="username"
          :level="level"
          :verify-title="verifyTitle"
          :device="device"
        >
          <span class="username clickable" @click.stop="handleUserClick">
            {{ username || '酷友' }}
          </span>
        </UserHoverCard>

        <span v-if="level" :class="['user-level', `level-${Math.min(level, 12)}`]">
          Lv.{{ level }}
        </span>
        <span v-if="verifyTitle" class="verify-badge" :title="verifyTitle">
          <i class="fas fa-check-circle verify-icon"></i>
          <span>{{ verifyTitle }}</span>
        </span>
      </div>
      <div class="meta-row">
        <span class="dateline">{{ formatDateline(dateline) }}</span>
        <span v-if="showDeviceInfo && device" class="device-badge" :title="device">
          <i class="fas fa-mobile-alt device-icon"></i>
          <span>{{ device }}</span>
        </span>
        <span v-if="ipLocationText" class="ip-badge" :title="`IP属地: ${ipLocationText}`">
          <i class="fas fa-location-dot ip-icon"></i>
          <span>{{ ipLocationText }}</span>
        </span>
        <template v-if="isEdited">
          <span class="meta-dot">•</span>
          <button class="edited-badge" type="button" title="查看编辑记录" @click.stop="emit('edit-history')">
            <i class="fas fa-pen-to-square"></i>
            <span>已编辑</span>
          </button>
        </template>
        <span v-if="rankIndex" class="rank-badge">
          <i class="fas fa-trophy rank-icon"></i>
          <span>TOP {{ rankIndex }}</span>
        </span>
        <span v-if="recommendSource" class="recommend-source-badge">
          {{ recommendSource }}
        </span>
      </div>
    </div>

    <div class="header-actions">
      <slot name="actions">
        <AppIconButton
          icon="fas fa-ellipsis-h"
          size="sm"
          variant="subtle"
          tooltip="更多选项"
          aria-label="更多选项"
          @click.stop="emit('more')"
        />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '../../stores/settings';
import AppAvatar from '../common/AppAvatar.vue';
import AppIconButton from '../common/AppIconButton.vue';
import UserHoverCard from '../user/UserHoverCard.vue';
import { reactiveUserProfileMap, getCachedUserProfileSync } from '../../utils/userProfilePreloader';

const props = withDefaults(defineProps<{
  uid?: string | number;
  avatar?: string;
  pluginUrl?: string;
  username?: string;
  level?: number;
  gender?: number | string;
  genderTitle?: string;
  ipLocation?: string;
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

const currentUid = computed(() => String(props.uid || '').trim());
const preloadedProfile = computed(() => {
  if (!currentUid.value) return null;
  return reactiveUserProfileMap[currentUid.value] || getCachedUserProfileSync(currentUid.value);
});

// 头像挂件（支持原生字段与预加载自动补全）
const effectivePluginUrl = computed(() => {
  if (props.pluginUrl && String(props.pluginUrl).trim()) {
    return String(props.pluginUrl).trim();
  }
  const p = preloadedProfile.value;
  return p?.avatar_plugin_url || p?.userInfo?.avatar_plugin_url || p?.userAvatarPluginUrl || '';
});

// IP 属地计算（支持接口原生字段与静默预加载自动补全）
const ipLocationText = computed(() => {
  if (props.ipLocation && String(props.ipLocation).trim()) {
    const direct = String(props.ipLocation).trim();
    if (direct !== '未知' && direct !== '保密' && direct !== '未公开') return direct;
  }
  const p = preloadedProfile.value;
  const loc = p?.ip_location || p?.ipLocation || p?.city || p?.province || p?.location || p?.userInfo?.ip_location || p?.userInfo?.city;
  if (loc && String(loc).trim() && String(loc).trim() !== '未知' && String(loc).trim() !== '保密' && String(loc).trim() !== '未公开') {
    return String(loc).trim();
  }
  return '';
});

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
  const timestamp = normalizeTimestamp(time);
  if (timestamp === null) return String(time);
  if (settingsStore.settings.timeDisplay === 'absolute') {
    const d = new Date(timestamp * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * 酷安不同栏目返回的时间单位不完全一致：普通动态通常是秒，
 * 头条最新动态可能返回 10 位以上的字符串时间戳（十分之一秒）。
 */
function normalizeTimestamp(value: number | string): number | null {
  const timestamp = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  if (timestamp >= 1_000_000_000_000) return timestamp / 1000;
  if (timestamp >= 10_000_000_000) return timestamp / 10;
  return timestamp;
}
</script>

<style scoped>
.feed-header {
  position: relative;
  z-index: 1;
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

/* IP 属地微胶囊 */
.ip-badge {
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

.ip-icon {
  font-size: 10.5px;
  color: #0284c7;
}

:root[data-theme='dark'] .ip-icon,
.theme-dark .ip-icon {
  color: #38bdf8;
}
</style>
