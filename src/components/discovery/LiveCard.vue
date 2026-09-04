<template>
  <section v-if="isListCard" class="live-list-card" :data-live-template="templateName">
    <header v-if="title || description" class="live-list-header">
      <div class="live-list-heading">
        <span class="live-list-icon"><i class="fas fa-tower-broadcast"></i></span>
        <div>
          <h3>{{ title || '直播' }}</h3>
          <p v-if="description">{{ description }}</p>
        </div>
      </div>
    </header>
    <div :class="['live-list-items', `columns-${columns}`]">
      <LiveCard
        v-for="(child, index) in children"
        :key="getLiveId(child) || `${templateName}-${index}`"
        :entity="child"
        :compact="columns > 1"
        :show-action="columns === 1"
      />
    </div>
  </section>

  <article
    v-else
    :class="['live-card-item', statusClass, { 'is-compact': compact }]"
    :data-live-id="liveId || undefined"
    :data-live-status="status"
    role="button"
    tabindex="0"
    @click="openLive"
    @keydown="handleKeydown"
  >
    <div class="live-card-media">
      <AppImage v-if="image" :src="image" :alt="title || '直播封面'" fit="cover" image-class="live-card-cover" />
      <div v-else class="live-card-cover-fallback"><i class="fas fa-tower-broadcast"></i></div>
      <div class="live-card-media-overlay">
        <span :class="['live-status-badge', statusClass]"><i :class="statusIcon"></i>{{ statusLabel }}</span>
        <span v-if="status === 0 && showTime" class="live-card-time"><i class="far fa-clock"></i>{{ showTime }}</span>
      </div>
    </div>
    <div class="live-card-body">
      <div class="live-card-title-row">
        <h4>{{ title || '直播' }}</h4>
        <button v-if="actionVisible" type="button" :class="['live-action-button', statusClass, { 'is-pending': pending }]" :disabled="pending" @click.stop="handleAction">
          <i v-if="pending" class="fas fa-spinner fa-spin"></i>
          {{ pending ? '处理中' : actionLabel }}
        </button>
      </div>
      <p v-if="presenter || description" class="live-card-description">
        <span v-if="presenter" class="live-presenter"><i class="fas fa-user"></i>{{ presenter }}</span>
        <span v-if="description && description !== title" class="live-description-text">{{ description }}</span>
      </p>
      <div class="live-card-meta">
        <span v-if="metric"><i class="fas fa-chart-line"></i>{{ metric }} {{ metricLabel }}</span>
        <span v-if="status === 0 && showTime && compact === false" class="live-meta-time"><i class="far fa-clock"></i>{{ showTime }}</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppImage from '../common/AppImage.vue';
import { useAuthStore } from '../../stores/auth';
import { getErrorMessage } from '../../utils/errors';
import { showToast } from '../../utils/toast';
import type { DiscoveryEntity } from '../../types/discovery';
import {
  formatLiveCount,
  getLiveActionLabel,
  getLiveDescription,
  getLiveId,
  getLiveImage,
  getLiveMetric,
  getLiveMetricLabel,
  getLiveMetricNumber,
  getLiveOpenUrl,
  getLivePresenterName,
  getLiveShowTime,
  getLiveStatus,
  getLiveStatusLabel,
  getLiveTitle,
  getLiveTemplate,
  isLiveFollowed,
  isLiveListCard,
} from '../../utils/live';

defineOptions({ name: 'LiveCard' });

const props = withDefaults(defineProps<{ entity: DiscoveryEntity; compact?: boolean; showAction?: boolean }>(), { compact: false, showAction: true });
const authStore = useAuthStore();

const templateName = computed(() => getLiveTemplate(props.entity));
const isListCard = computed(() => isLiveListCard(props.entity) && children.value.length > 0);
const children = computed(() => Array.isArray(props.entity.entities) ? props.entity.entities.filter(Boolean) : []);
const columns = computed(() => {
  const value = Number(props.entity.cols ?? props.entity.columns ?? props.entity.column ?? 1);
  return Number.isFinite(value) ? Math.min(4, Math.max(1, Math.round(value))) : 1;
});
const title = computed(() => getLiveTitle(props.entity));
const description = computed(() => getLiveDescription(props.entity));
const liveId = computed(() => getLiveId(props.entity));
const image = computed(() => getLiveImage(props.entity));
const status = computed(() => getLiveStatus(props.entity));
const statusLabel = computed(() => getLiveStatusLabel(status.value));
const statusClass = computed(() => status.value === -1 ? 'is-ended' : status.value === 1 ? 'is-live' : 'is-upcoming');
const statusIcon = computed(() => status.value === -1 ? 'fas fa-circle-check' : status.value === 1 ? 'fas fa-circle-play' : 'far fa-clock');
const presenter = computed(() => getLivePresenterName(props.entity));
const showTime = computed(() => getLiveShowTime(props.entity));
const followed = ref(false);
const pending = ref(false);
const reservationCount = ref<number | null>(null);

watch(() => props.entity, (entity) => {
  followed.value = isLiveFollowed(entity);
  reservationCount.value = getLiveMetricNumber(entity, getLiveStatus(entity));
}, { immediate: true });

const metric = computed(() => status.value === 0 && reservationCount.value !== null ? formatLiveCount(reservationCount.value) : getLiveMetric(props.entity, status.value));
const metricLabel = computed(() => getLiveMetricLabel(status.value));
const actionLabel = computed(() => getLiveActionLabel(status.value, followed.value));
const actionVisible = computed(() => !isListCard.value && props.showAction && columns.value === 1 && Boolean(liveId.value));

async function openLive() {
  const url = getLiveOpenUrl(props.entity);
  if (!url) {
    showToast('直播地址缺失', 'error');
    return;
  }
  try {
    await CoolapkTauriAPI.openUrl(url, 'internal');
  } catch (error) {
    showToast(getErrorMessage(error, '打开直播失败'), 'error');
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    void openLive();
  }
}

async function handleAction() {
  if (status.value !== 0 || !liveId.value) {
    await openLive();
    return;
  }
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (pending.value) return;
  const nextFollowed = !followed.value;
  pending.value = true;
  try {
    if (nextFollowed) await CoolapkTauriAPI.followLive(liveId.value);
    else await CoolapkTauriAPI.unfollowLive(liveId.value);
    followed.value = nextFollowed;
    if (reservationCount.value !== null) reservationCount.value = Math.max(0, reservationCount.value + (nextFollowed ? 1 : -1));
    showToast(nextFollowed ? '直播预约成功' : '已取消直播预约');
  } catch (error) {
    showToast(getErrorMessage(error, nextFollowed ? '直播预约失败' : '取消预约失败'), 'error');
  } finally {
    pending.value = false;
  }
}
</script>

<style scoped>
.live-list-card {
  overflow: hidden;
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: var(--radius-card, 12px);
  background: var(--surface);
}

.live-list-header { padding: 14px 16px 10px; }
.live-list-heading { display: flex; align-items: center; gap: 10px; min-width: 0; }
.live-list-icon { display: grid; flex: 0 0 30px; width: 30px; height: 30px; place-items: center; border-radius: 9px; background: rgba(16, 185, 129, .12); color: var(--brand-primary, #10b981); }
.live-list-header h3 { margin: 0; color: var(--text-primary); font-size: 16px; font-weight: 700; }
.live-list-header p { overflow: hidden; margin: 2px 0 0; color: var(--text-tertiary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.live-list-items { display: grid; gap: 12px; padding: 0 14px 14px; }
.live-list-items.columns-1 { grid-template-columns: minmax(0, 1fr); }
.live-list-items.columns-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.live-list-items.columns-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.live-list-items.columns-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.live-card-item { display: grid; min-width: 0; grid-template-columns: minmax(180px, 36%) minmax(0, 1fr); overflow: hidden; border: 1px solid var(--border-light, rgba(0, 0, 0, .08)); border-radius: 12px; background: var(--surface-elevated, var(--surface)); cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
.live-card-item:hover { transform: translateY(-2px); border-color: rgba(16, 185, 129, .45); box-shadow: 0 8px 22px rgba(15, 86, 63, .12); }
.live-card-item.is-compact { display: flex; flex-direction: column; }
.live-card-media { position: relative; min-width: 0; aspect-ratio: 16 / 9; overflow: hidden; background: linear-gradient(135deg, rgba(16, 185, 129, .18), rgba(15, 118, 110, .2)); }
.live-card-cover, .live-card-cover-fallback { display: block; width: 100%; height: 100%; }
.live-card-cover :deep(img) { width: 100%; height: 100%; object-fit: cover; transition: transform .25s ease; }
.live-card-item:hover .live-card-cover :deep(img) { transform: scale(1.03); }
.live-card-cover-fallback { display: grid; place-items: center; color: rgba(255, 255, 255, .9); font-size: 30px; }
.live-card-media::after { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, .08), transparent 45%, rgba(0, 0, 0, .42)); content: ''; pointer-events: none; }
.live-card-media-overlay { position: absolute; right: 9px; bottom: 8px; left: 9px; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.live-status-badge, .live-card-time { display: inline-flex; align-items: center; gap: 4px; min-width: 0; padding: 3px 7px; border-radius: 5px; color: #fff; font-size: 11px; line-height: 1.2; white-space: nowrap; }
.live-status-badge.is-live { background: #0f9d58; }
.live-status-badge.is-upcoming { background: #2196f3; }
.live-status-badge.is-ended { background: #f44336; }
.live-card-time { overflow: hidden; background: rgba(0, 0, 0, .5); text-overflow: ellipsis; }

.live-card-body { display: flex; min-width: 0; flex-direction: column; justify-content: center; gap: 9px; padding: 14px; }
.live-card-title-row { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 9px; }
.live-card-title-row h4 { display: -webkit-box; min-width: 0; margin: 0; overflow: hidden; color: var(--text-primary); font-size: 16px; font-weight: 700; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.live-card-item.is-compact .live-card-body { gap: 7px; padding: 11px; }
.live-card-item.is-compact .live-card-title-row h4 { font-size: 14px; -webkit-line-clamp: 2; }
.live-card-description { display: flex; min-width: 0; flex-wrap: wrap; gap: 4px 9px; margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.45; }
.live-presenter, .live-description-text, .live-card-meta span { display: inline-flex; min-width: 0; align-items: center; gap: 4px; }
.live-presenter { color: var(--text-secondary); }
.live-presenter i, .live-card-meta i { color: var(--brand-primary, #10b981); }
.live-description-text { overflow: hidden; color: var(--text-tertiary); text-overflow: ellipsis; white-space: nowrap; }
.live-card-meta { display: flex; min-height: 17px; align-items: center; gap: 10px; color: var(--text-tertiary); font-size: 11px; }
.live-meta-time { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.live-action-button { flex: 0 0 auto; min-width: 58px; padding: 5px 9px; border: 0; border-radius: 6px; color: #fff; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; transition: opacity .15s ease, transform .15s ease; }
.live-action-button:hover:not(:disabled) { transform: translateY(-1px); }
.live-action-button:disabled { cursor: wait; opacity: .72; }
.live-action-button.is-live { background: #0f9d58; }
.live-action-button.is-upcoming { background: #2196f3; }
.live-action-button.is-upcoming:not(.is-pending) { color: #fff; }
.live-action-button.is-ended { background: #f44336; }

@media (max-width: 900px) {
  .live-list-items.columns-3, .live-list-items.columns-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .live-list-items.columns-2, .live-list-items.columns-3, .live-list-items.columns-4 { grid-template-columns: minmax(0, 1fr); }
  .live-card-item { grid-template-columns: 42% minmax(0, 1fr); }
  .live-card-body { gap: 6px; padding: 10px; }
  .live-card-title-row h4 { font-size: 14px; }
  .live-description-text { display: none; }
}
</style>
