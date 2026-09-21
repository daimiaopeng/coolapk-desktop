<template>
  <AppDialog
    :is-open="isOpen"
    :title="dialogTitle"
    :width="620"
    :close-on-backdrop="currentStep !== 'exporting'"
    @close="handleDialogClose"
  >
    <div class="favorite-export-dialog">
      <Transition name="step-fade" mode="out-in">
        <!-- 阶段 1：配置阶段 -->
        <div v-if="currentStep === 'config'" key="config" class="dialog-step-config">
          <!-- 选择收藏单区域 -->
          <section v-if="mode === 'collections'" class="export-section">
            <div class="export-section-heading">
              <div class="export-heading-left">
                <span>选择收藏单</span>
                <small :class="{ 'warning-text': selectedCollectionIds.size === 0 }">
                  已选择 {{ selectedCollectionIds.size }} 个（共 {{ collections.length }} 个）
                </small>
              </div>
              <div v-if="collections.length > 0" class="export-heading-actions">
                <button
                  type="button"
                  class="export-link-btn"
                  @click="toggleSelectAllCollections"
                >
                  {{ isAllCollectionsSelected ? '取消全选' : '全选' }}
                </button>
              </div>
            </div>

            <!-- 收藏单数量较多时展示过滤搜索框 -->
            <div v-if="collections.length > 4" class="collection-search-wrap">
              <i class="fas fa-search search-icon"></i>
              <input
                v-model="collectionSearchQuery"
                type="text"
                placeholder="搜索收藏单名称…"
                class="collection-search-input"
              >
              <button
                v-if="collectionSearchQuery"
                type="button"
                class="search-clear-btn"
                aria-label="清空搜索"
                @click="collectionSearchQuery = ''"
              >
                <i class="fas fa-times-circle"></i>
              </button>
            </div>

            <div v-if="filteredCollections.length" class="collection-picker-grid">
              <label
                v-for="collection in filteredCollections"
                :key="collectionId(collection)"
                :class="['collection-picker-card', { selected: selectedCollectionIds.has(collectionId(collection)) }]"
              >
                <input
                  type="checkbox"
                  :checked="selectedCollectionIds.has(collectionId(collection))"
                  @change="toggleCollection(collectionId(collection))"
                >
                <i class="fas fa-folder collection-folder-icon"></i>
                <div class="collection-picker-info">
                  <strong :title="collectionTitle(collection)">{{ collectionTitle(collection) }}</strong>
                  <small class="collection-count-badge">{{ collectionCount(collection) }} 条内容</small>
                </div>
                <span class="unified-checkbox" :class="{ checked: selectedCollectionIds.has(collectionId(collection)) }">
                  <i class="fas fa-check"></i>
                </span>
              </label>
            </div>
            <div v-else class="collection-empty-tip">
              <i class="fas fa-folder-open"></i>
              <span>未找到相关收藏单</span>
            </div>
          </section>

          <!-- 导出格式选择 -->
          <section class="export-section">
            <div class="export-section-heading">
              <div class="export-heading-left">
                <span>导出格式</span>
                <small :class="{ 'warning-text': !hasSelectedFormats }">
                  {{ hasSelectedFormats ? '可同时生成多种文件' : '请至少选择一种导出格式' }}
                </small>
              </div>
            </div>
            <div class="format-grid">
              <label
                v-for="format in formatOptions"
                :key="format.key"
                :class="['format-card', { selected: formats[format.key] }]"
              >
                <input v-model="formats[format.key]" type="checkbox">
                <span class="format-icon"><i :class="format.icon"></i></span>
                <span class="format-copy">
                  <strong>{{ format.label }}</strong>
                  <small>{{ format.description }}</small>
                </span>
                <span class="unified-checkbox" :class="{ checked: formats[format.key] }">
                  <i class="fas fa-check"></i>
                </span>
              </label>
            </div>
          </section>

          <!-- HTML 图片选项（平滑展开折叠） -->
          <Transition name="section-expand">
            <section v-if="formats.html" class="export-section">
              <div class="export-section-heading">
                <div class="export-heading-left">
                  <span>HTML 图片质量</span>
                  <small>图片保存到 images/photos，头像保存到 images/avatars，表情保存到 images/emojis</small>
                </div>
              </div>
              <div class="image-quality-grid" role="radiogroup" aria-label="HTML 图片质量">
                <label :class="['image-quality-card', { selected: imageQuality === 'hd' }]">
                  <input v-model="imageQuality" type="radio" value="hd">
                  <span class="image-quality-copy">
                    <strong>高清图片</strong>
                    <small>体积较小，适合离线浏览</small>
                  </span>
                  <span class="unified-radio" :class="{ checked: imageQuality === 'hd' }">
                    <span class="radio-inner"></span>
                  </span>
                </label>
                <label :class="['image-quality-card', { selected: imageQuality === 'raw' }]">
                  <input v-model="imageQuality" type="radio" value="raw">
                  <span class="image-quality-copy">
                    <strong>原图最高画质</strong>
                    <small>保留最高画质，占用空间较大</small>
                  </span>
                  <span class="unified-radio" :class="{ checked: imageQuality === 'raw' }">
                    <span class="radio-inner"></span>
                  </span>
                </label>
              </div>
            </section>
          </Transition>

          <!-- 附加评论选项 -->
          <section class="export-section">
            <div class="export-section-heading">
              <div class="export-heading-left">
                <span>附加评论</span>
                <small>抓取评论会显著增加网络请求与导出时间</small>
              </div>
            </div>
            <div class="comment-options">
              <div class="comment-option comment-option-all">
                <span>
                  <strong>所有评论与楼中楼</strong>
                  <small>导出全部一级评论及其楼中楼回复</small>
                </span>
                <AppSwitch v-model="commentOptions.includeAllComments" />
              </div>
            </div>
          </section>

          <!-- 保存位置 -->
          <section class="export-section">
            <div class="export-section-heading">
              <div class="export-heading-left">
                <span>保存位置</span>
              </div>
              <div class="export-heading-actions">
                <button
                  type="button"
                  class="export-link-btn"
                  @click="chooseDownloadDir"
                >
                  更改目录
                </button>
              </div>
            </div>
            <div class="export-path-bar" :title="'点击在资源管理器中打开：' + effectiveDownloadPath" @click="openExportDirectory">
              <div class="export-path-info">
                <i class="fas fa-folder-open"></i>
                <span class="export-path-text">{{ effectiveDownloadPath }}</span>
              </div>
              <span class="export-path-action">
                <i class="fas fa-arrow-up-right-from-square"></i> 打开
              </span>
            </div>
          </section>
        </div>

        <!-- 阶段 2：正在导出看板 -->
        <div v-else-if="currentStep === 'exporting'" key="exporting" class="dialog-step-exporting">
          <div class="export-running-hero">
            <div class="running-icon-halo">
              <div class="running-icon-core">
                <i class="fas fa-arrows-rotate fa-spin"></i>
              </div>
            </div>
            <h4 class="running-title">正在处理收藏备份…</h4>
            <div class="running-step-pill">
              <span class="pill-dot"></span>
              <span class="pill-text">{{ progress || '准备就绪，正在开始任务…' }}</span>
            </div>
          </div>

          <!-- 精致条形流光进度条 -->
          <div class="running-progress-wrap">
            <div class="running-progress-track">
              <div class="running-progress-fill"></div>
            </div>
          </div>

          <!-- 任务摘要卡片（分层布局，彻底解决长路径截断） -->
          <div class="running-summary-panel">
            <div class="summary-meta-row">
              <div class="summary-meta-item">
                <span class="summary-meta-label">备份目标</span>
                <span class="summary-meta-val">{{ exportTargetDescription }}</span>
              </div>
              <div class="summary-meta-divider"></div>
              <div class="summary-meta-item">
                <span class="summary-meta-label">导出格式</span>
                <span class="summary-meta-val">{{ selectedFormatsSummary }}</span>
              </div>
            </div>
            <div class="summary-path-row">
              <span class="summary-path-label">保存目录</span>
              <span class="summary-path-val" :title="effectiveDownloadPath">{{ effectiveDownloadPath }}</span>
            </div>
          </div>

          <div v-if="cancelRequested" class="running-canceling-tip">
            <i class="fas fa-spinner fa-spin"></i> 正在安全停止任务，稍候…
          </div>
        </div>

        <!-- 阶段 3：完成结果报告 -->
        <div v-else-if="currentStep === 'completed'" key="completed" class="dialog-step-completed">
          <div class="completed-hero">
            <div :class="['completed-icon-halo', { 'is-warning': completedIsCancelled }]">
              <div class="completed-icon-core">
                <i :class="completedIsCancelled ? 'fas fa-triangle-exclamation' : 'fas fa-check'"></i>
              </div>
            </div>
            <h4 class="completed-title">{{ completedIsCancelled ? '导出已提前终止' : '备份导出完成！' }}</h4>
            <p class="completed-subtitle">{{ completedSummaryText }}</p>
          </div>

          <!-- 一体化结果面板：文件列表与保存位置合二为一 -->
          <div class="completed-card">
            <div class="completed-card-head">
              <span class="card-head-title">
                <i class="fas fa-folder-closed"></i> 生成的文件 ({{ results.length }})
              </span>
              <span class="card-head-tag">已安全存储至本地</span>
            </div>

            <div v-if="results.length" class="completed-file-list custom-scrollbar">
              <div v-for="path in results" :key="path" class="completed-file-row" :title="path">
                <span class="file-icon-wrap"><i :class="getFileIcon(path)"></i></span>
                <span class="file-name-text">{{ fileNameFromPath(path) }}</span>
                <span class="file-ext-tag">{{ getFileExt(path) }}</span>
              </div>
            </div>

            <div class="completed-card-foot" @click="openExportDirectory" title="点击在资源管理器中打开此目录">
              <div class="card-foot-left">
                <i class="fas fa-folder-open"></i>
                <span class="card-foot-path">保存至：{{ lastExportDirectory || effectiveDownloadPath }}</span>
              </div>
              <span class="card-foot-action">打开目录 <i class="fas fa-arrow-up-right-from-square"></i></span>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <template #footer>
      <!-- 配置态 Footer -->
      <template v-if="currentStep === 'config'">
        <AppButton variant="ghost" @click="close">取消</AppButton>
        <AppButton
          variant="primary"
          icon="fas fa-file-export"
          :disabled="!canStartExport"
          :title="exportButtonTooltip"
          @click="startExport"
        >
          开始导出
        </AppButton>
      </template>

      <!-- 导出中 Footer -->
      <template v-else-if="currentStep === 'exporting'">
        <div class="exporting-footer-bar">
          <span class="exporting-live-hint">
            <i class="fas fa-circle-notch fa-spin"></i> 导出进行中，请保持网络连接稳定
          </span>
          <AppButton
            variant="ghost"
            class="export-cancel-btn"
            icon="fas fa-ban"
            :disabled="cancelRequested"
            :loading="cancelRequested"
            @click="cancelExport"
          >
            {{ cancelRequested ? '正在取消…' : '取消导出' }}
          </AppButton>
        </div>
      </template>

      <!-- 完成态 Footer -->
      <template v-else-if="currentStep === 'completed'">
        <div class="completed-footer-actions">
          <AppButton variant="ghost" icon="fas fa-arrow-left" @click="backToConfig">
            返回配置
          </AppButton>
          <div class="completed-footer-right">
            <AppButton variant="ghost" @click="close">关闭</AppButton>
            <AppButton variant="primary" icon="fas fa-folder-open" @click="openExportDirectory">
              打开所在文件夹
            </AppButton>
          </div>
        </div>
      </template>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import {
  buildFavoriteExport,
  favoriteExportToHtml,
  favoriteExportToText,
  saveFavoriteExportSnapshot,
  type FavoriteExportFormat,
} from '../../utils/favoriteExport';
import AppButton from '../common/AppButton.vue';
import AppDialog from '../common/AppDialog.vue';
import AppSwitch from '../common/AppSwitch.vue';

export type ExportStep = 'config' | 'exporting' | 'completed';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  mode?: 'all' | 'collections';
  collections?: any[];
}>(), {
  mode: 'all',
  collections: () => [],
});
const emit = defineEmits<{ (event: 'close'): void }>();

const authStore = useAuthStore();
const settingsStore = useSettingsStore();

// 状态机步骤管理
const currentStep = ref<ExportStep>('config');
const completedIsCancelled = ref(false);
const completedSummaryText = ref('');

const exporting = ref(false);
const cancelRequested = ref(false);
const abortController = ref<AbortController | null>(null);
const progress = ref('');
const results = ref<string[]>([]);
const selectedCollectionIds = ref(new Set<string>());
const formats = reactive<Record<FavoriteExportFormat, boolean>>({ json: true, txt: false, html: false });
const imageQuality = ref<'hd' | 'raw'>('hd');
const commentOptions = reactive({
  includeAllComments: false,
  includeAuthorComments: false,
  includePinnedComments: false,
  includeAuthorReplies: false,
});
const formatOptions: Array<{ key: FavoriteExportFormat; label: string; description: string; icon: string }> = [
  { key: 'json', label: 'JSON', description: '完整数据与差异记录', icon: 'fas fa-code' },
  { key: 'txt', label: 'TXT', description: '纯文本，方便全文检索', icon: 'fas fa-align-left' },
  { key: 'html', label: 'HTML', description: '保留表情、图片与排版', icon: 'fas fa-globe' },
];

const mode = computed(() => props.mode);
const collections = computed(() => props.collections.filter(collection => collectionId(collection)));

// 弹窗标题动态化
const dialogTitle = computed(() => {
  if (currentStep.value === 'exporting') return '正在导出收藏';
  if (currentStep.value === 'completed') return completedIsCancelled.value ? '导出已终止' : '导出完成';
  return mode.value === 'collections' ? '导出收藏单' : '导出全部收藏';
});

// 收藏单搜索过滤
const collectionSearchQuery = ref('');
const filteredCollections = computed(() => {
  const query = collectionSearchQuery.value.trim().toLowerCase();
  if (!query) return collections.value;
  return collections.value.filter(col => collectionTitle(col).toLowerCase().includes(query));
});

// 全选 / 取消全选
const isAllCollectionsSelected = computed(() => {
  return collections.value.length > 0 && selectedCollectionIds.value.size === collections.value.length;
});

function toggleSelectAllCollections() {
  if (isAllCollectionsSelected.value) {
    selectedCollectionIds.value = new Set();
  } else {
    selectedCollectionIds.value = new Set(collections.value.map(col => collectionId(col)));
  }
}

// 格式选择状态
const hasSelectedFormats = computed(() => {
  return (Object.keys(formats) as FavoriteExportFormat[]).some(key => formats[key]);
});

const selectedFormatsSummary = computed(() => {
  const list = (Object.keys(formats) as FavoriteExportFormat[])
    .filter(k => formats[k])
    .map(k => k.toUpperCase());
  return list.length ? list.join(' / ') : '无';
});

const exportTargetDescription = computed(() => {
  if (props.mode === 'collections') {
    return `${selectedCollectionIds.value.size} 个收藏单`;
  }
  return '全部云端收藏';
});

// 保存路径
const systemDownloadPath = ref('');
const lastExportDirectory = ref('');
const effectiveDownloadPath = computed(() => {
  return settingsStore.settings.downloadPath || systemDownloadPath.value || '系统默认下载目录';
});

async function refreshDownloadPath() {
  try {
    systemDownloadPath.value = await CoolapkTauriAPI.getDownloadDirectory();
  } catch {
    systemDownloadPath.value = '';
  }
}

async function chooseDownloadDir() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, title: '选择导出保存目录' });
    if (typeof selected === 'string' && selected) {
      settingsStore.settings.downloadPath = selected;
    }
  } catch (err) {
    console.error('选择保存目录失败', err);
  }
}

async function openExportDirectory() {
  try {
    await CoolapkTauriAPI.openApkDownloadDirectory(lastExportDirectory.value || settingsStore.settings.downloadPath);
  } catch (err) {
    console.error('打开目录失败', err);
  }
}

// 导出按钮可用状态与提示
const canStartExport = computed(() => {
  if (exporting.value) return false;
  if (!authStore.isLoggedIn) return false;
  if (!hasSelectedFormats.value) return false;
  if (props.mode === 'collections' && selectedCollectionIds.value.size === 0) return false;
  return true;
});

const exportButtonTooltip = computed(() => {
  if (!authStore.isLoggedIn) return '请先登录酷安账号';
  if (props.mode === 'collections' && selectedCollectionIds.value.size === 0) return '请先选择要导出的收藏单';
  if (!hasSelectedFormats.value) return '请至少选择一种导出格式';
  return '';
});

function getFileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'json') return 'fas fa-code';
  if (ext === 'html') return 'fas fa-globe';
  if (ext === 'txt') return 'fas fa-align-left';
  return 'fas fa-file-arrow-down';
}

function getFileExt(path: string): string {
  return (path.split('.').pop() || '').toUpperCase();
}

watch(() => props.isOpen, (open) => {
  if (!open) return;
  currentStep.value = 'config';
  completedIsCancelled.value = false;
  completedSummaryText.value = '';
  progress.value = '';
  results.value = [];
  cancelRequested.value = false;
  selectedCollectionIds.value = new Set<string>();
  collectionSearchQuery.value = '';
  refreshDownloadPath();
}, { immediate: true });

function collectionId(collection: any): string {
  return String(collection?.id ?? collection?.collectionId ?? collection?.entityId ?? '').trim();
}

function collectionTitle(collection: any): string {
  return String(collection?.title ?? collection?.name ?? '未命名收藏单').trim();
}

function collectionCount(collection: any): number {
  return Number(collection?.itemNum ?? collection?.item_num ?? collection?.feedNum ?? collection?.count ?? 0) || 0;
}

function toggleCollection(id: string) {
  const next = new Set(selectedCollectionIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedCollectionIds.value = next;
}

function dateStamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function close() {
  if (currentStep.value !== 'exporting') {
    emit('close');
  }
}

function handleDialogClose() {
  close();
}

function backToConfig() {
  currentStep.value = 'config';
  progress.value = '';
  lastExportDirectory.value = '';
}

function cancelExport() {
  if (!exporting.value || !abortController.value) return;
  cancelRequested.value = true;
  progress.value = '正在安全终止导出…';
  abortController.value.abort();
}

function joinPath(base: string, child: string): string {
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base.replace(/[\\/]+$/, '')}${separator}${child}`;
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

async function startExport() {
  if (exporting.value) return;
  if (!authStore.isLoggedIn) {
    alert('请先登录酷安账号后再导出收藏');
    return;
  }
  const selectedFormats = (Object.keys(formats) as FavoriteExportFormat[]).filter(format => formats[format]);
  if (selectedFormats.length === 0) {
    return;
  }
  if (props.mode === 'collections' && selectedCollectionIds.value.size === 0) {
    return;
  }

  // 状态迁移到 exporting
  currentStep.value = 'exporting';
  completedIsCancelled.value = false;
  exporting.value = true;
  cancelRequested.value = false;
  const controller = new AbortController();
  abortController.value = controller;
  progress.value = '正在建立连接，准备抓取收藏数据…';
  results.value = [];
  lastExportDirectory.value = '';

  try {
    const stamp = dateStamp();
    const sources = props.mode === 'collections'
      ? collections.value
        .filter(collection => selectedCollectionIds.value.has(collectionId(collection)))
        .map(collection => ({ type: 'collection' as const, id: collectionId(collection), title: collectionTitle(collection) }))
      : [{ type: 'all' as const, id: 'all' as const, title: '全部收藏' as const }];
    let totalItems = 0;
    let totalFailed = 0;
    for (const source of sources) {
      controller.signal.throwIfAborted();
      const bundle = await buildFavoriteExport(String(authStore.user?.uid || ''), { ...commentOptions }, (status) => {
        progress.value = sources.length > 1 ? `“${source.title}”：${status.message}` : status.message;
      }, source, controller.signal);
      const name = source.type === 'all' ? `coolapk_favorites_${stamp}` : `coolapk_collection_${source.id}_${stamp}`;
      const exportDirectory = await CoolapkTauriAPI.createExportDirectory(name, settingsStore.settings.downloadPath);
      lastExportDirectory.value = sources.length === 1 ? exportDirectory : settingsStore.settings.downloadPath;
      for (const format of selectedFormats) {
        controller.signal.throwIfAborted();
        if (format === 'html') {
          const imageRootDirectory = joinPath(exportDirectory, 'images');
          const photoDirectory = joinPath(imageRootDirectory, 'photos');
          const avatarDirectory = joinPath(imageRootDirectory, 'avatars');
          const emojiDirectory = joinPath(imageRootDirectory, 'emojis');
          const content = await favoriteExportToHtml(bundle, {
            imageQuality: imageQuality.value,
            signal: controller.signal,
            onProgress: (message) => { progress.value = `“${source.title}”：${message}`; },
            saveImage: async (url, index, _total, kind) => {
              controller.signal.throwIfAborted();
              const dataUrl = await CoolapkTauriAPI.getImageDataUrl(url);
              controller.signal.throwIfAborted();
              const directory = kind === 'emoji' ? emojiDirectory : kind === 'avatar' ? avatarDirectory : photoDirectory;
              const prefix = kind === 'emoji' ? 'emoji' : kind === 'avatar' ? 'avatar' : 'image';
              const savedPath = await CoolapkTauriAPI.saveImageDataUrl(
                dataUrl,
                `${prefix}_${String(index + 1).padStart(4, '0')}`,
                directory,
              );
              const relativeDirectory = kind === 'emoji' ? 'images/emojis' : kind === 'avatar' ? 'images/avatars' : 'images/photos';
              return `${relativeDirectory}/${fileNameFromPath(savedPath)}`;
            },
          });
          controller.signal.throwIfAborted();
          results.value.push(await CoolapkTauriAPI.exportJsonFile(`${name}.html`, content, exportDirectory));
        } else {
          const content = format === 'json' ? JSON.stringify(bundle, null, 2) : favoriteExportToText(bundle);
          results.value.push(await CoolapkTauriAPI.exportJsonFile(
            `${name}.${format}`,
            content,
            exportDirectory,
          ));
        }
      }
      controller.signal.throwIfAborted();
      await saveFavoriteExportSnapshot(bundle);
      totalItems += bundle.summary.total;
      totalFailed += bundle.summary.contentFailed;
    }

    // 状态迁移到 completed
    currentStep.value = 'completed';
    completedIsCancelled.value = false;
    completedSummaryText.value = `成功备份 ${sources.length} 个${props.mode === 'collections' ? '收藏单' : '导出任务'}，共 ${totalItems} 条收藏内容${totalFailed ? `（正文失败 ${totalFailed} 条）` : ''}`;
  } catch (error) {
    if (controller.signal.aborted) {
      if (results.value.length > 0) {
        currentStep.value = 'completed';
        completedIsCancelled.value = true;
        completedSummaryText.value = '任务已提前终止，已下载完成的文件已安全保存在本地。';
      } else {
        currentStep.value = 'config';
        progress.value = '导出已取消';
      }
    } else {
      currentStep.value = 'config';
      alert(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    }
  } finally {
    exporting.value = false;
    if (abortController.value === controller) abortController.value = null;
  }
}
</script>

<style scoped>
.favorite-export-dialog {
  display: flex;
  flex-direction: column;
  min-height: 360px;
}

/* 步骤视图过渡 */
.step-fade-enter-active,
.step-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.step-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.step-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ================= 阶段 1：配置阶段 ================= */
.dialog-step-config {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.export-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.export-heading-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.export-heading-left > span {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 13.5px;
}

.export-heading-left small {
  color: var(--text-tertiary);
  font-size: 12px;
  transition: color 0.15s ease;
}

.export-heading-left small.warning-text {
  color: var(--text-tertiary);
}

.export-heading-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.export-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 3px 7px;
  border-radius: 5px;
  transition: all 0.15s ease;
}

.export-link-btn:hover {
  background-color: color-mix(in srgb, var(--brand-primary) 10%, transparent);
}

/* 统一复选框与单选框外观 */
.unified-checkbox {
  position: relative;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #fff;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.unified-checkbox i {
  font-size: 10px;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.unified-checkbox.checked {
  border-color: var(--brand-primary);
  background-color: var(--brand-primary);
}

.unified-checkbox.checked i {
  opacity: 1;
  transform: scale(1);
}

.unified-radio {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: all 0.18s ease;
}

.unified-radio .radio-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brand-primary);
  opacity: 0;
  transform: scale(0.4);
  transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.unified-radio.checked {
  border-color: var(--brand-primary);
}

.unified-radio.checked .radio-inner {
  opacity: 1;
  transform: scale(1);
}

/* 收藏单搜索过滤条 */
.collection-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.collection-search-wrap .search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
  pointer-events: none;
}

.collection-search-input {
  width: 100%;
  height: 32px;
  padding: 0 28px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.collection-search-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 15%, transparent);
}

.search-clear-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.search-clear-btn:hover {
  color: var(--text-secondary);
}

/* 收藏单卡片网格 */
.collection-picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 2px;
}

.collection-picker-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.collection-picker-card:hover {
  border-color: color-mix(in srgb, var(--brand-primary) 45%, var(--border));
  background: color-mix(in srgb, var(--brand-primary) 3%, var(--surface));
}

.collection-picker-card.selected {
  border-color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 8%, var(--surface));
}

.collection-picker-card > input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.collection-folder-icon {
  color: var(--text-secondary);
  font-size: 15px;
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.collection-picker-card.selected .collection-folder-icon {
  color: var(--brand-primary);
}

.collection-picker-info {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.collection-picker-info strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.collection-count-badge {
  color: var(--text-tertiary);
  font-size: 11px;
}

.collection-picker-card.selected .collection-count-badge {
  color: color-mix(in srgb, var(--brand-primary) 70%, var(--text-secondary));
}

.collection-empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  color: var(--text-tertiary);
  font-size: 13px;
  border: 1px dashed var(--border);
  border-radius: 8px;
}

/* 导出格式网格 */
.format-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.format-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.format-card:hover {
  border-color: color-mix(in srgb, var(--brand-primary) 45%, var(--border));
}

.format-card.selected {
  border-color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 8%, var(--surface));
}

.format-card > input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.format-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 8px;
  color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
  font-size: 14px;
}

.format-copy {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.format-copy strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.format-copy small {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* HTML 图片质量单选 */
.image-quality-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.image-quality-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.image-quality-card:hover {
  border-color: color-mix(in srgb, var(--brand-primary) 45%, var(--border));
}

.image-quality-card.selected {
  border-color: var(--brand-primary);
  background: color-mix(in srgb, var(--brand-primary) 8%, var(--surface));
}

.image-quality-card input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.image-quality-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.image-quality-copy strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.image-quality-copy small {
  color: var(--text-tertiary);
  font-size: 11px;
}

/* 附加评论 */
.comment-options {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}

.comment-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
}

.comment-option > span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.comment-option strong {
  color: var(--text-primary);
  font-size: 13.5px;
  font-weight: 600;
}

.comment-option small {
  color: var(--text-tertiary);
  font-size: 12px;
}

/* 导出保存位置栏 */
.export-path-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.export-path-bar:hover {
  border-color: color-mix(in srgb, var(--brand-primary) 50%, var(--border));
  background: color-mix(in srgb, var(--brand-primary) 4%, var(--surface));
}

.export-path-info {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.export-path-info i {
  color: var(--brand-primary);
  font-size: 14px;
  flex-shrink: 0;
}

.export-path-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-secondary);
}

.export-path-action {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-tertiary);
  font-size: 11.5px;
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.export-path-bar:hover .export-path-action {
  color: var(--brand-primary);
}

/* HTML 选项展开收起动画 */
.section-expand-enter-active,
.section-expand-leave-active {
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 180px;
  overflow: hidden;
  opacity: 1;
}

.section-expand-enter-from,
.section-expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: -10px;
}

/* ================= 阶段 2：正在导出看板 ================= */
.dialog-step-exporting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 16px 20px;
  gap: 20px;
}

.export-running-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}

.running-icon-halo {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--brand-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--brand-primary) 18%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--brand-primary) 14%, transparent);
}

.running-icon-core {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--brand-primary);
  color: #fff;
  font-size: 20px;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--brand-primary) 35%, transparent);
}

.running-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.running-step-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 480px;
  padding: 5px 14px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--brand-primary) 10%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--brand-primary) 20%, transparent);
  color: var(--brand-primary);
  font-size: 13px;
  font-weight: 500;
}

.pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--brand-primary);
  box-shadow: 0 0 6px var(--brand-primary);
  flex-shrink: 0;
}

.pill-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.running-progress-wrap {
  width: 100%;
  max-width: 480px;
  padding: 0 4px;
}

.running-progress-track {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--brand-primary) 16%, var(--border));
  overflow: hidden;
  position: relative;
}

.running-progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 35%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 70%, #fff));
  animation: export-track-indeterminate 1.4s infinite ease-in-out;
}

@keyframes export-track-indeterminate {
  0% { left: -35%; width: 35%; }
  50% { left: 35%; width: 45%; }
  100% { left: 100%; width: 30%; }
}

.running-summary-panel {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.summary-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
}

.summary-meta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.summary-meta-divider {
  width: 1px;
  height: 24px;
  background: var(--border-light);
}

.summary-meta-label,
.summary-path-label {
  color: var(--text-tertiary);
  font-size: 11px;
}

.summary-meta-val {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.summary-path-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.summary-path-label {
  flex-shrink: 0;
}

.summary-path-val {
  min-width: 0;
  flex: 1;
  color: var(--text-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.running-canceling-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--danger, #f43f5e);
  font-size: 12px;
}

.exporting-footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.exporting-live-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.export-cancel-btn {
  color: var(--text-secondary) !important;
  transition: all 0.15s ease !important;
}

.export-cancel-btn:hover {
  color: var(--danger, #f43f5e) !important;
  background-color: color-mix(in srgb, var(--danger, #f43f5e) 10%, transparent) !important;
}

/* ================= 阶段 3：完成结果报告 ================= */
.dialog-step-completed {
  display: flex;
  flex-direction: column;
  padding: 16px 8px 8px;
  gap: 18px;
}

.completed-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}

.completed-icon-halo {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--brand-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--brand-primary) 18%, transparent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--brand-primary) 14%, transparent);
}

.completed-icon-core {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--brand-primary);
  color: #fff;
  font-size: 22px;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--brand-primary) 35%, transparent);
}

.completed-icon-halo.is-warning {
  background: color-mix(in srgb, var(--warning, #f59e0b) 8%, transparent);
  border-color: color-mix(in srgb, var(--warning, #f59e0b) 18%, transparent);
}

.completed-icon-halo.is-warning .completed-icon-core {
  background: var(--warning, #f59e0b);
  box-shadow: 0 3px 10px color-mix(in srgb, var(--warning, #f59e0b) 35%, transparent);
}

.completed-title {
  margin: 2px 0 0;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 600;
}

.completed-subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  max-width: 480px;
  line-height: 1.5;
}

/* 一体化结果卡片面板 */
.completed-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  overflow: hidden;
}

.completed-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  background: color-mix(in srgb, var(--brand-primary) 3%, var(--surface));
  border-bottom: 1px solid var(--border-light);
}

.card-head-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.card-head-title i {
  color: var(--brand-primary);
}

.card-head-tag {
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.completed-file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  max-height: 160px;
  overflow-y: auto;
}

.completed-file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 11px;
  background: var(--background-secondary, var(--surface));
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  border-radius: 7px;
  transition: all 0.15s ease;
}

.completed-file-row:hover {
  border-color: color-mix(in srgb, var(--brand-primary) 40%, var(--border));
  background: color-mix(in srgb, var(--brand-primary) 3%, var(--surface));
}

.file-icon-wrap {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
  color: var(--brand-primary);
  font-size: 13px;
  flex-shrink: 0;
}

.file-name-text {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--text-primary);
}

.file-ext-tag {
  padding: 2px 7px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
  color: var(--brand-primary);
  font-size: 10.5px;
  font-weight: 700;
  flex-shrink: 0;
}

.completed-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 14px;
  background: color-mix(in srgb, var(--background-secondary) 60%, var(--surface));
  border-top: 1px solid var(--border-light);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.completed-card-foot:hover {
  background: color-mix(in srgb, var(--brand-primary) 5%, var(--surface));
  color: var(--brand-primary);
}

.card-foot-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex: 1;
}

.card-foot-left i {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.card-foot-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-foot-action {
  color: var(--brand-primary);
  font-weight: 500;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.completed-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.completed-footer-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

@media (max-width: 640px) {
  .format-grid,
  .collection-picker-grid,
  .image-quality-grid {
    grid-template-columns: 1fr;
  }
}
</style>
