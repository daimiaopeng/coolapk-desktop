<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div class="top-nav-bar">
      <div class="nav-title-box">
        <span class="nav-title">酷友圈活动</span>
      </div>
    </div>

    <div v-if="loading && events.length === 0" class="state-wrapper">
      <LoadingState text="正在加载活动列表..." />
    </div>

    <div v-else-if="error && events.length === 0" class="state-wrapper">
      <ErrorState title="加载活动列表失败" message="无法获取酷友圈活动，请检查网络后重试" @retry="loadEvents(true)" />
    </div>

    <div v-else-if="events.length === 0 && !loading" class="state-wrapper">
      <EmptyState title="暂无活动" description="当前没有可展示的酷友圈活动" />
    </div>

    <div v-else class="event-list">
      <article
        v-for="event in events"
        :key="event.id"
        class="event-card"
        @click="openEvent(event)"
      >
        <AppImage
          v-if="eventCover(event)"
          :src="eventCover(event)"
          class="event-cover"
          fit="cover"
          :alt="event.title || '活动封面'"
        />
        <div v-else class="event-cover event-cover-fallback">
          <i class="fas fa-trophy"></i>
        </div>

        <div class="event-info">
          <div class="event-title-row">
            <span class="event-status" :class="statusClass(event)">{{ statusText(event) }}</span>
            <h3 class="event-title">{{ event.title || '未命名活动' }}</h3>
          </div>
          <p v-if="event.subTitle" class="event-subtitle">{{ event.subTitle }}</p>
          <p v-else-if="event.description" class="event-subtitle event-desc">{{ event.description }}</p>
          <div class="event-meta">
            <span v-if="event.username" class="event-sponsor">
              <i class="fas fa-user"></i> {{ event.username }}
            </span>
            <span v-if="event.regNum" class="event-regnum">
              <i class="fas fa-users"></i> {{ event.regNum }} 人报名
            </span>
            <span v-if="timeRange(event)" class="event-time">
              <i class="fas fa-clock"></i> {{ timeRange(event) }}
            </span>
          </div>
        </div>
        <i class="fas fa-chevron-right event-arrow"></i>
      </article>

      <div class="pagination-footer">
        <LoadingState v-if="loading && page > 1" text="加载更多中..." />
        <button v-else-if="error && events.length > 0" class="retry-inline" @click="loadEvents(true)">加载失败，点击重试</button>
        <div v-else-if="noMore" class="no-more">没有更多活动了</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import type { CoolEvent } from '../types/coolevent';

const router = useRouter();

const events = ref<CoolEvent[]>([]);
const page = ref(1);
const loading = ref(false);
const noMore = ref(false);
const error = ref(false);

function eventCover(event: CoolEvent): string {
  return event.pic || event.logo || event.picArr?.[0] || event.picArr?.[1] || '';
}

function statusText(event: CoolEvent): string {
  const stage = Number(event.stageStatus ?? event.stage_status ?? -1);
  if (stage === 2) return '已结束';
  if (stage === 1) return '进行中';
  return '报名中';
}

function statusClass(event: CoolEvent): string {
  const stage = Number(event.stageStatus ?? event.stage_status ?? -1);
  if (stage === 2) return 'is-ended';
  if (stage === 1) return 'is-running';
  return 'is-open';
}

function formatStamp(value: number | string | undefined): string {
  if (!value) return '';
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  const date = new Date(num * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeRange(event: CoolEvent): string {
  const start = event.timeRegStart ?? event.time_reg_start;
  const end = event.timeEnd ?? event.time_end ?? event.timeRegEnd ?? event.time_reg_end;
  if (!start) return '';
  const startText = formatStamp(start);
  const endText = end ? formatStamp(end) : '';
  return endText && endText !== startText ? `${startText} ~ ${endText}` : startText;
}

async function loadEvents(isRefresh = false) {
  if (loading.value || (noMore.value && !isRefresh)) return;
  loading.value = true;
  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
    events.value = [];
  }
  error.value = false;
  try {
    const res = await CoolapkTauriAPI.getEventList(page.value);
    const list = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (list.length === 0) {
      noMore.value = true;
    } else {
      events.value.push(...list);
      page.value++;
    }
  } catch (err) {
    error.value = true;
    console.warn('获取活动列表失败', err);
  } finally {
    loading.value = false;
  }
}

function openEvent(event: CoolEvent) {
  router.push({ path: `/event/${event.id}` });
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    if (!loading.value && !noMore.value) {
      void loadEvents(false);
    }
  }
}

void loadEvents(false);
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width, 860px);
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.top-nav-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  margin-bottom: 2px;
}

.nav-title-box {
  flex: 1;
  text-align: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--brand-primary, #10b981);
}

.state-wrapper {
  padding: var(--space-10) 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card {
  display: flex;
  align-items: stretch;
  gap: 14px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.event-card:hover {
  background-color: var(--surface-hover);
  border-color: var(--brand-primary);
}

.event-cover {
  width: 120px;
  min-height: 84px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--background-secondary);
}

.event-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: var(--brand-primary);
  background: linear-gradient(135deg, var(--brand-soft), var(--brand-soft-hover));
}

.event-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.event-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.event-status {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  margin-top: 2px;
}

.event-status.is-open {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
}

.event-status.is-running {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
}

.event-status.is-ended {
  background-color: var(--background-secondary);
  color: var(--text-tertiary);
}

.event-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-desc {
  color: var(--text-tertiary);
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: auto;
  color: var(--text-tertiary);
  font-size: 11px;
}

.event-meta i {
  margin-right: 4px;
}

.event-arrow {
  align-self: center;
  color: var(--text-disabled);
  font-size: 12px;
  flex-shrink: 0;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}

.retry-inline {
  border: 0;
  background: transparent;
  color: var(--brand-primary, #10b981);
  font-size: 12px;
  cursor: pointer;
}
</style>