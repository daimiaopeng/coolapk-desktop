<template>
  <div class="settings-section">
    <h3 class="section-title">诊断日志</h3>
    <p class="description">日志保存在本机，仅在你主动复制、分享或导出时离开应用。每个文件最多 2 MB，最多保留 4 个旧文件。</p>

    <div class="toolbar">
      <AppButton variant="secondary" size="sm" :loading="loading" @click="loadLogs">刷新</AppButton>
      <AppButton variant="secondary" size="sm" :disabled="!snapshot.content" @click="copyLogs">复制日志</AppButton>
      <AppButton variant="secondary" size="sm" :disabled="!snapshot.content" @click="exportLogs">导出日志</AppButton>
      <AppButton variant="danger" size="sm" :disabled="snapshot.files.length === 0" @click="clearLogs">清空日志</AppButton>
    </div>
    <label class="verbose-toggle"><input v-model="verbose" type="checkbox" @change="changeVerbose" /> 本次运行记录详细调试信息</label>

    <div class="filters">
      <select v-model="level" aria-label="日志级别" class="control">
        <option value="all">全部级别</option>
        <option value="error">错误</option>
        <option value="warn">警告</option>
        <option value="info">信息</option>
      </select>
      <input v-model="keyword" class="control search" type="search" placeholder="搜索日志内容" aria-label="搜索日志内容" />
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>
    <p class="meta">{{ snapshot.files.length }} 个文件 · {{ visibleLines.length }} 行结果</p>
    <pre class="log-content custom-scrollbar">{{ visibleLines.length ? visibleLines.join('\n') : '暂无日志' }}</pre>
    <p class="path">日志目录：{{ snapshot.directory || '正在获取…' }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import AppButton from '../../components/common/AppButton.vue';
import { requestConfirmation } from '../../utils/confirm';
import { showToast } from '../../utils/toast';
import { getVerboseDiagnosticLogging, setVerboseDiagnosticLogging } from '../../utils/diagnosticLogger';

interface DiagnosticSnapshot {
  files: Array<{ name: string; size: number; modifiedAt: number }>;
  content: string;
  directory: string;
}

const snapshot = ref<DiagnosticSnapshot>({ files: [], content: '', directory: '' });
const loading = ref(false);
const error = ref('');
const level = ref('all');
const keyword = ref('');
const verbose = ref(false);

const visibleLines = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return snapshot.value.content.split('\n').filter((line) => {
    if (level.value !== 'all' && !line.toLowerCase().includes(`[${level.value}]`)) return false;
    return !query || line.toLowerCase().includes(query);
  }).slice(-1000);
});

async function loadLogs() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    snapshot.value = await invoke<DiagnosticSnapshot>('get_diagnostic_logs');
  } catch (cause) {
    error.value = `读取日志失败：${String(cause)}`;
  } finally {
    loading.value = false;
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('当前平台无法复制到剪贴板');
}

async function copyLogs() {
  try {
    await copyText(snapshot.value.content);
    showToast('日志已复制');
  } catch (cause) {
    showToast(`复制日志失败：${String(cause)}`, 'error');
  }
}

async function exportLogs() {
  const content = snapshot.value.content;
  if (!content) return;
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: 'coolapk-diagnostics.txt',
      filters: [{ name: '文本日志', extensions: ['txt'] }],
    });
    if (!path) return;
    await writeTextFile(path, content);
    showToast(`日志已保存：${path}`, 'success', 5000);
  } catch (cause) {
    showToast(`导出日志失败：${String(cause)}`, 'error');
  }
}

async function clearLogs() {
  const confirmed = await requestConfirmation({
    title: '清空诊断日志',
    message: '确定清空本机保存的诊断日志吗？',
    confirmText: '清空',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await invoke('clear_diagnostic_logs');
    await loadLogs();
    showToast('日志已清空');
  } catch (cause) {
    showToast(`清空日志失败：${String(cause)}`, 'error');
  }
}

async function changeVerbose() {
  try {
    await setVerboseDiagnosticLogging(verbose.value);
  } catch (cause) {
    verbose.value = !verbose.value;
    showToast(`切换详细日志失败：${String(cause)}`, 'error');
  }
}

onMounted(() => {
  void loadLogs();
  void getVerboseDiagnosticLogging().then((value) => { verbose.value = value; });
});
</script>

<style scoped>
.settings-section { max-width: 900px; display: flex; flex-direction: column; gap: 14px; }
.section-title { margin: 0; color: var(--text-primary); }
.description, .meta, .path { margin: 0; color: var(--text-secondary); font-size: 13px; }
.toolbar, .filters { display: flex; flex-wrap: wrap; gap: 8px; }
.verbose-toggle { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 13px; }
.control { min-height: 34px; padding: 5px 10px; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--surface); color: var(--text-primary); }
.search { flex: 1; min-width: 170px; }
.log-content { min-height: 280px; max-height: 60vh; overflow: auto; margin: 0; padding: 14px; background: var(--surface-hover); border: 1px solid var(--border); border-radius: var(--radius-control); color: var(--text-primary); font: 12px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.error-text { color: var(--danger); margin: 0; }
.path { overflow-wrap: anywhere; }
</style>
