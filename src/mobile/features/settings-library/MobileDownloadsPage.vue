<template>
  <section class="mobile-downloads-page" data-mobile-page="downloads" aria-label="下载管理">
    <div class="mobile-downloads-scroll">
      <header class="mobile-downloads-header"><span class="mobile-downloads-icon"><i class="fas fa-download"></i></span><div><h1>下载管理</h1><p>{{ downloadStore.activeCount }} 个任务进行中</p></div><button type="button" aria-label="下载设置" @click="router.push('/settings/downloads')"><i class="fas fa-gear"></i></button></header>
      <section class="mobile-downloads-summary"><div><strong>{{ downloadStore.activeCount }}</strong><span>进行中</span></div><div><strong>{{ completedCount }}</strong><span>已完成</span></div><div><strong>{{ formatBytes(downloadStore.completedTotalBytes) }}</strong><span>占用空间</span></div></section>
      <nav class="mobile-downloads-tabs"><button type="button" :class="{ active: tab === 'active' }" @click="tab = 'active'">当前任务 <b>{{ activeTasks.length }}</b></button><button type="button" :class="{ active: tab === 'history' }" @click="tab = 'history'">下载历史 <b>{{ downloadStore.historyTasks.length }}</b></button></nav>
      <section class="mobile-downloads-list">
        <article v-for="task in visibleTasks" :key="task.id" class="mobile-download-item">
          <span class="mobile-download-logo"><img v-if="task.logoUrl" :src="task.logoUrl" alt="" referrerpolicy="no-referrer" /><i v-else class="fas fa-cube"></i></span>
          <div class="mobile-download-copy"><strong>{{ task.title || task.packageName }}</strong><small>{{ task.versionName || '未知版本' }} · {{ statusText(task.status) }}</small><div class="mobile-download-progress"><i :style="{ width: `${progress(task)}%` }"></i></div><small>{{ formatBytes(task.downloaded) }} / {{ formatBytes(task.total) }}</small></div>
          <div class="mobile-download-actions"><button v-if="task.status === 'downloading' || task.status === 'queued'" type="button" aria-label="暂停" @click="downloadStore.pause(task.id)"><i class="fas fa-pause"></i></button><button v-else-if="task.status === 'paused'" type="button" aria-label="继续" @click="downloadStore.resume(task.id)"><i class="fas fa-play"></i></button><button v-else-if="task.status === 'failed'" type="button" aria-label="重试" @click="downloadStore.retry(task.id)"><i class="fas fa-rotate-right"></i></button><button type="button" aria-label="删除" @click="downloadStore.remove(task.id)"><i class="fas fa-trash"></i></button></div>
        </article>
        <div v-if="!visibleTasks.length" class="mobile-download-empty"><i class="fas fa-cloud-arrow-down"></i><strong>{{ tab === 'active' ? '暂无正在进行的下载任务' : '暂无下载历史记录' }}</strong><span>{{ tab === 'active' ? '在应用详情页点击下载即可加入队列' : '完成或失败的安装包会显示在这里' }}</span></div>
      </section>
      <button v-if="tab === 'active' && activeTasks.length" type="button" class="mobile-download-batch" @click="downloadStore.pauseAll()"><i class="fas fa-pause"></i> 全部暂停</button><button v-if="tab === 'history' && downloadStore.historyTasks.length" type="button" class="mobile-download-batch danger" @click="downloadStore.clearHistory()"><i class="fas fa-trash"></i> 清空历史</button>
      <div class="mobile-download-bottom-space"></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDownloadStore } from '../../../stores/downloads';
import type { DownloadTask } from '../../../types/download';

defineOptions({ name: 'MobileDownloadsPage' });
const router = useRouter();
const downloadStore = useDownloadStore();
const tab = ref<'active' | 'history'>('active');
const activeTasks = computed(() => downloadStore.activeTasks);
const completedCount = computed(() => downloadStore.tasks.filter((task) => task.status === 'completed').length);
const visibleTasks = computed(() => tab.value === 'active' ? activeTasks.value : downloadStore.historyTasks);
function progress(task: DownloadTask): number { return task.total > 0 ? Math.min(100, Math.round((task.downloaded / task.total) * 100)) : task.status === 'completed' ? 100 : 0; }
function statusText(status: DownloadTask['status']): string { return ({ queued: '等待中', downloading: '下载中', paused: '已暂停', completed: '已完成', failed: '失败', canceled: '已取消' })[status]; }
function formatBytes(value: number): string { if (!value) return '0 B'; if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`; return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`; }
onMounted(() => { void downloadStore.initialize(); });
</script>

<style scoped>
.mobile-downloads-page { display: flex; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: #f2f2f6; color: #28282b; }.mobile-downloads-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 12px calc(24px + env(safe-area-inset-bottom, 0px)); }.mobile-downloads-header { display: flex; align-items: center; gap: 11px; padding: 8px 4px 16px; }.mobile-downloads-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: #e4f6ec; color: #0f9d58; font-size: 20px; }.mobile-downloads-header h1 { margin: 0; font-size: 24px; }.mobile-downloads-header p { margin: 3px 0 0; color: #999; font-size: 12px; }.mobile-downloads-header > div { flex: 1; }.mobile-downloads-header button { width: 38px; height: 38px; border: 0; border-radius: 12px; background: #fff; color: #666; font-size: 17px; }.mobile-downloads-summary { display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 12px; padding: 15px 8px; border-radius: 20px; background: #fff; text-align: center; }.mobile-downloads-summary div + div { border-left: 1px solid #eee; }.mobile-downloads-summary strong, .mobile-downloads-summary span { display: block; }.mobile-downloads-summary strong { font-size: 20px; }.mobile-downloads-summary span { margin-top: 4px; color: #999; font-size: 11px; }.mobile-downloads-tabs { display: flex; gap: 6px; margin-bottom: 10px; padding: 4px; border-radius: 14px; background: #e6e6e9; }.mobile-downloads-tabs button { flex: 1; min-height: 37px; border: 0; border-radius: 11px; background: transparent; color: #777; font: inherit; font-size: 13px; }.mobile-downloads-tabs button.active { background: #fff; color: #0f9d58; font-weight: 700; box-shadow: 0 1px 4px rgba(0,0,0,.08); }.mobile-downloads-tabs b { margin-left: 3px; font-size: 11px; }.mobile-downloads-list { display: grid; gap: 8px; }.mobile-download-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 17px; background: #fff; }.mobile-download-logo { display: grid; place-items: center; flex: 0 0 43px; width: 43px; height: 43px; overflow: hidden; border-radius: 11px; background: #eef7f1; color: #0f9d58; }.mobile-download-logo img { width: 100%; height: 100%; object-fit: cover; }.mobile-download-copy { flex: 1; min-width: 0; }.mobile-download-copy strong { display: block; overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }.mobile-download-copy small { display: block; margin-top: 3px; overflow: hidden; color: #999; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.mobile-download-progress { height: 5px; margin-top: 8px; overflow: hidden; border-radius: 99px; background: #e5e5e7; }.mobile-download-progress i { display: block; height: 100%; border-radius: inherit; background: #0f9d58; }.mobile-download-actions { display: flex; flex-direction: column; gap: 5px; }.mobile-download-actions button { width: 28px; height: 28px; border: 0; border-radius: 9px; background: #f1f8f3; color: #0f9d58; }.mobile-download-actions button:last-child { background: #fff1f1; color: #df5a50; }.mobile-download-empty { display: grid; place-items: center; gap: 7px; min-height: 240px; padding: 25px; border-radius: 20px; background: #fff; color: #999; text-align: center; }.mobile-download-empty i { color: #0f9d58; font-size: 32px; }.mobile-download-empty strong { color: #555; }.mobile-download-empty span { font-size: 12px; }.mobile-download-batch { display: block; width: 100%; min-height: 42px; margin-top: 12px; border: 0; border-radius: 14px; background: #e3f5ea; color: #0f9d58; font: inherit; }.mobile-download-batch.danger { background: #fff0f0; color: #da554b; }.mobile-download-bottom-space { height: 18px; }
@media (min-width: 720px) { .mobile-downloads-scroll { width: min(100%, 720px); margin: 0 auto; padding-inline: 24px; } }
</style>
