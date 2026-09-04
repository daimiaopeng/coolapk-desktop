<template>
  <div class="live-detail-page custom-scrollbar">
    <div class="live-detail-shell">
      <header class="live-detail-header">
        <button type="button" class="live-back-button" aria-label="返回" @click="router.back()"><i class="fas fa-arrow-left"></i></button>
        <div class="live-detail-heading">
          <span class="live-detail-kicker"><i class="fas fa-tower-broadcast"></i> 直播</span>
          <h1>{{ title || '直播详情' }}</h1>
        </div>
        <button v-if="liveDetail && openUrl" type="button" class="live-browser-button" @click="openInBrowser"><i class="fas fa-globe"></i> 系统浏览器</button>
      </header>

      <LoadingState v-if="loading && !liveDetail" text="正在加载直播详情..." />
      <ErrorState v-else-if="error && !liveDetail" title="直播详情加载失败" :message="error" @retry="loadDetail" />
      <EmptyState v-else-if="!liveDetail" title="直播不存在" description="这场直播可能已经下线" />
      <section v-else class="live-detail-content">
        <div class="live-player-shell">
          <video v-if="videoUrl && !videoFailed" class="live-player" :src="videoUrl" controls playsinline preload="metadata" @error="videoFailed = true"></video>
          <div v-else class="live-player-placeholder">
            <AppImage v-if="image" :src="image" :alt="title || '直播封面'" fit="cover" image-class="live-detail-cover" />
            <div class="live-player-placeholder-mask">
              <i :class="status === 1 ? 'fas fa-circle-play' : 'fas fa-video-slash'"></i>
              <span>{{ status === 1 ? '暂未返回可播放的视频地址' : status === -1 ? '暂无可用回放地址' : '直播尚未开始' }}</span>
            </div>
          </div>
          <span :class="['live-detail-status', statusClass]"><i :class="statusIcon"></i>{{ statusLabel }}</span>
        </div>

        <div class="live-detail-info">
          <div class="live-detail-title-row">
            <h2>{{ title || '直播' }}</h2>
            <span v-if="metric" class="live-detail-metric"><i class="fas fa-chart-line"></i>{{ metric }} {{ metricLabel }}</span>
          </div>
          <div class="live-detail-meta">
            <span v-if="presenter"><i class="fas fa-user"></i>{{ presenter }}</span>
            <span v-if="showTime"><i class="far fa-clock"></i>{{ showTime }}</span>
          </div>
          <p v-if="description && description !== title" class="live-detail-description">{{ description }}</p>
          <div class="live-detail-actions">
            <button v-if="status === 0" type="button" :class="['live-reservation-button', { 'is-followed': followed, 'is-pending': pending }]" :disabled="pending" @click="toggleReservation">
              <i :class="pending ? 'fas fa-spinner fa-spin' : followed ? 'fas fa-calendar-check' : 'far fa-calendar-plus'"></i>
              {{ pending ? '处理中' : followed ? '已预约' : '预约直播' }}
            </button>
            <button v-if="openUrl" type="button" class="live-system-button" @click="openInBrowser"><i class="fas fa-external-link-alt"></i> 在浏览器中打开</button>
          </div>
          <p v-if="videoFailed" class="live-video-hint">当前视频地址无法在桌面端播放，可使用系统浏览器打开直播页面。</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppImage from '../components/common/AppImage.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import LoadingState from '../components/common/LoadingState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import { getErrorMessage } from '../utils/errors';
import { showToast } from '../utils/toast';
import type { DiscoveryEntity } from '../types/discovery';
import {
  formatLiveCount,
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
  getLiveVideoUrl,
  isLiveFollowed,
} from '../utils/live';

defineOptions({ name: 'LiveDetailPage' });

const props = defineProps<{ liveId?: string }>();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const liveId = computed(() => String(props.liveId || route.params.liveId || '').trim());
const liveDetail = ref<DiscoveryEntity | null>(null);
const loading = ref(false);
const error = ref('');
const videoFailed = ref(false);
const followed = ref(false);
const pending = ref(false);
const reservationCount = ref<number | null>(null);
let requestVersion = 0;

const title = computed(() => liveDetail.value ? getLiveTitle(liveDetail.value) : '');
const description = computed(() => liveDetail.value ? getLiveDescription(liveDetail.value) : '');
const image = computed(() => liveDetail.value ? getLiveImage(liveDetail.value) : '');
const status = computed(() => liveDetail.value ? getLiveStatus(liveDetail.value) : 0);
const statusLabel = computed(() => getLiveStatusLabel(status.value));
const statusClass = computed(() => status.value === -1 ? 'is-ended' : status.value === 1 ? 'is-live' : 'is-upcoming');
const statusIcon = computed(() => status.value === -1 ? 'fas fa-circle-check' : status.value === 1 ? 'fas fa-circle-play' : 'far fa-clock');
const presenter = computed(() => liveDetail.value ? getLivePresenterName(liveDetail.value) : '');
const showTime = computed(() => liveDetail.value ? getLiveShowTime(liveDetail.value) : '');
const metric = computed(() => liveDetail.value && status.value === 0 && reservationCount.value !== null ? formatLiveCount(reservationCount.value) : liveDetail.value ? getLiveMetric(liveDetail.value, status.value) : '');
const metricLabel = computed(() => getLiveMetricLabel(status.value));
const videoUrl = computed(() => liveDetail.value ? getLiveVideoUrl(liveDetail.value) : '');
const openUrl = computed(() => liveDetail.value ? getLiveOpenUrl(liveDetail.value) : '');

function pickDetail(response: any): DiscoveryEntity | null {
  const root = response?.data ?? response;
  const source = Array.isArray(root) ? root[0] : root;
  const candidates = [source?.live, source?.entity, source?.liveInfo, source?.live_info, source];
  const detail = candidates.find((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate));
  return detail ? detail as DiscoveryEntity : null;
}

async function loadDetail() {
  if (!liveId.value) {
    error.value = '缺少直播 ID';
    return;
  }
  const requestedId = liveId.value;
  const currentRequest = ++requestVersion;
  loading.value = true;
  error.value = '';
  videoFailed.value = false;
  try {
    const response = await CoolapkTauriAPI.getLiveDetail(requestedId);
    const detail = pickDetail(response);
    if (!detail) throw new Error('接口没有返回直播内容');
    if (currentRequest !== requestVersion || requestedId !== liveId.value) return;
    liveDetail.value = detail;
    followed.value = isLiveFollowed(detail);
    reservationCount.value = getLiveMetricNumber(detail, getLiveStatus(detail));
  } catch (requestError) {
    if (currentRequest === requestVersion) error.value = getErrorMessage(requestError, '直播详情加载失败');
  } finally {
    if (currentRequest === requestVersion) loading.value = false;
  }
}

async function toggleReservation() {
  if (!liveDetail.value || status.value !== 0 || pending.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const id = getLiveId(liveDetail.value) || liveId.value;
  if (!id) return;
  const nextFollowed = !followed.value;
  pending.value = true;
  try {
    if (nextFollowed) await CoolapkTauriAPI.followLive(id);
    else await CoolapkTauriAPI.unfollowLive(id);
    followed.value = nextFollowed;
    if (reservationCount.value !== null) reservationCount.value = Math.max(0, reservationCount.value + (nextFollowed ? 1 : -1));
    showToast(nextFollowed ? '直播预约成功' : '已取消直播预约');
  } catch (requestError) {
    showToast(getErrorMessage(requestError, nextFollowed ? '直播预约失败' : '取消预约失败'), 'error');
  } finally {
    pending.value = false;
  }
}

function openInBrowser() {
  if (openUrl.value) void CoolapkTauriAPI.openUrl(openUrl.value, 'system');
}

onMounted(() => { void loadDetail(); });
watch(liveId, () => { liveDetail.value = null; void loadDetail(); });
watch(videoUrl, () => { videoFailed.value = false; });
</script>

<style scoped>
.live-detail-page { width: 100%; height: 100%; overflow-y: auto; background: var(--background-secondary); }
.live-detail-shell { width: 100%; max-width: 1080px; margin: 0 auto; padding: 22px 24px 40px; box-sizing: border-box; }
.live-detail-header { display: flex; min-width: 0; align-items: center; gap: 13px; margin-bottom: 18px; }
.live-back-button, .live-browser-button, .live-system-button, .live-reservation-button { border: 0; font: inherit; cursor: pointer; }
.live-back-button { display: grid; flex: 0 0 34px; width: 34px; height: 34px; place-items: center; border-radius: 9px; background: var(--surface); color: var(--text-secondary); }
.live-back-button:hover { background: var(--surface-hover); color: var(--brand-primary); }
.live-detail-heading { min-width: 0; flex: 1; }
.live-detail-kicker { display: flex; align-items: center; gap: 5px; color: var(--brand-primary, #10b981); font-size: 12px; font-weight: 600; }
.live-detail-heading h1 { overflow: hidden; margin: 3px 0 0; color: var(--text-primary); font-size: 20px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.live-browser-button { padding: 8px 12px; border-radius: 8px; background: var(--surface); color: var(--text-secondary); font-size: 12px; }
.live-browser-button:hover { color: var(--brand-primary); }
.live-detail-content { overflow: hidden; border: 1px solid var(--border-light, rgba(0, 0, 0, .08)); border-radius: 14px; background: var(--surface); box-shadow: 0 8px 26px rgba(15, 23, 42, .06); }
.live-player-shell { position: relative; overflow: hidden; background: #0f172a; aspect-ratio: 16 / 8; }
.live-player, .live-player-placeholder, .live-detail-cover { display: block; width: 100%; height: 100%; }
.live-player { background: #000; object-fit: contain; }
.live-player-placeholder { position: relative; background: linear-gradient(135deg, rgba(16, 185, 129, .3), rgba(15, 23, 42, .9)); }
.live-detail-cover :deep(img) { width: 100%; height: 100%; object-fit: cover; opacity: .76; }
.live-player-placeholder-mask { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 9px; background: linear-gradient(180deg, rgba(15, 23, 42, .1), rgba(15, 23, 42, .74)); color: #fff; font-size: 13px; }
.live-player-placeholder-mask i { font-size: 32px; }
.live-detail-status { position: absolute; top: 14px; left: 14px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 6px; color: #fff; font-size: 12px; font-weight: 600; }
.live-detail-status.is-live { background: #0f9d58; }
.live-detail-status.is-upcoming { background: #2196f3; }
.live-detail-status.is-ended { background: #f44336; }
.live-detail-info { display: flex; flex-direction: column; gap: 12px; padding: 20px 22px 23px; }
.live-detail-title-row { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 16px; }
.live-detail-title-row h2 { min-width: 0; margin: 0; color: var(--text-primary); font-size: 21px; line-height: 1.4; }
.live-detail-metric { flex: 0 0 auto; padding-top: 4px; color: var(--text-secondary); font-size: 12px; }
.live-detail-metric i, .live-detail-meta i { margin-right: 4px; color: var(--brand-primary); }
.live-detail-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--text-secondary); font-size: 13px; }
.live-detail-description { margin: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.65; white-space: pre-wrap; }
.live-detail-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 3px; }
.live-reservation-button, .live-system-button { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; }
.live-reservation-button { background: #2196f3; color: #fff; }
.live-reservation-button.is-followed { background: var(--surface-hover); color: var(--text-secondary); }
.live-reservation-button:hover:not(:disabled), .live-system-button:hover { transform: translateY(-1px); }
.live-reservation-button:disabled { cursor: wait; opacity: .7; }
.live-system-button { background: var(--brand-soft, rgba(16, 185, 129, .1)); color: var(--brand-primary); }
.live-video-hint { margin: 0; color: var(--text-tertiary); font-size: 12px; }

@media (max-width: 640px) {
  .live-detail-shell { padding: 14px 12px 28px; }
  .live-detail-header { gap: 9px; }
  .live-browser-button { padding-inline: 8px; font-size: 11px; }
  .live-detail-heading h1 { font-size: 17px; }
  .live-detail-info { padding: 16px; }
  .live-detail-title-row { flex-direction: column; gap: 5px; }
  .live-detail-title-row h2 { font-size: 18px; }
}
</style>
