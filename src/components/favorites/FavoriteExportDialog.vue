<template>
  <AppDialog
    :is-open="isOpen"
    :title="mode === 'collections' ? '导出收藏单' : '导出全部收藏'"
    :width="620"
    :close-on-backdrop="!exporting"
    @close="close"
  >
    <div class="favorite-export-dialog">
      <div class="export-intro">
        <span class="export-intro-icon"><i class="fas fa-box-archive"></i></span>
        <div>
          <strong>{{ mode === 'collections' ? '按收藏单分别备份' : '完整备份全部收藏' }}</strong>
          <p>{{ mode === 'collections' ? '选择一个或多个收藏单，每个收藏单分别生成文件和差异记录。' : '自动遍历全部云端收藏、补齐完整正文，并与上次成功导出进行对比。' }}</p>
        </div>
      </div>

      <section v-if="mode === 'collections'" class="export-section">
        <div class="export-section-heading">
          <span>选择收藏单</span>
          <small>已选择 {{ selectedCollectionIds.size }} 个</small>
        </div>
        <div class="collection-picker-grid">
          <label
            v-for="collection in collections"
            :key="collectionId(collection)"
            :class="['collection-picker-card', { selected: selectedCollectionIds.has(collectionId(collection)) }]"
          >
            <input
              type="checkbox"
              :checked="selectedCollectionIds.has(collectionId(collection))"
              @change="toggleCollection(collectionId(collection))"
            >
            <i class="fas fa-folder"></i>
            <span><strong>{{ collectionTitle(collection) }}</strong><small>{{ collectionCount(collection) }} 条内容</small></span>
            <i class="fas fa-circle-check collection-picker-check"></i>
          </label>
        </div>
      </section>

      <section class="export-section">
        <div class="export-section-heading">
          <span>导出格式</span>
          <small>可同时生成多种文件</small>
        </div>
        <div class="format-grid">
          <label v-for="format in formatOptions" :key="format.key" :class="['format-card', { selected: formats[format.key] }]">
            <input v-model="formats[format.key]" type="checkbox">
            <span class="format-icon"><i :class="format.icon"></i></span>
            <span class="format-copy">
              <strong>{{ format.label }}</strong>
              <small>{{ format.description }}</small>
            </span>
            <i class="fas fa-circle-check format-check"></i>
          </label>
        </div>
      </section>

      <section v-if="formats.html" class="export-section">
        <div class="export-section-heading">
          <span>HTML 图片</span>
          <small>图片保存到 images，头像保存到 images/avatars，表情保存到 emojis</small>
        </div>
        <div class="image-quality-grid" role="radiogroup" aria-label="HTML 图片质量">
          <label :class="['image-quality-card', { selected: imageQuality === 'hd' }]">
            <input v-model="imageQuality" type="radio" value="hd">
            <span><strong>高清图片</strong><small>体积较小，适合离线浏览</small></span>
            <i class="fas fa-circle-check"></i>
          </label>
          <label :class="['image-quality-card', { selected: imageQuality === 'raw' }]">
            <input v-model="imageQuality" type="radio" value="raw">
            <span><strong>原图</strong><small>保留最高画质，占用空间较大</small></span>
            <i class="fas fa-circle-check"></i>
          </label>
        </div>
      </section>

      <section class="export-section">
        <div class="export-section-heading">
          <span>附加评论</span>
          <small>评论会增加导出时间</small>
        </div>
        <div class="comment-options">
          <div class="comment-option comment-option-all">
            <span><strong>所有评论</strong><small>导出全部一级评论及其楼中楼回复，耗时较长</small></span>
            <AppSwitch v-model="commentOptions.includeAllComments" />
          </div>
        </div>
      </section>

      <div v-if="progress" class="export-progress" aria-live="polite">
        <i :class="exporting ? 'fas fa-spinner fa-spin' : cancelRequested ? 'fas fa-ban' : 'fas fa-circle-check'"></i>
        <span>{{ progress }}</span>
      </div>

      <div v-if="results.length" class="export-results">
        <strong>已生成 {{ results.length }} 个文件</strong>
        <span v-for="path in results" :key="path">{{ path }}</span>
      </div>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="exporting ? cancelExport() : close()">{{ exporting ? '取消导出' : results.length ? '关闭' : '取消' }}</AppButton>
      <AppButton variant="primary" icon="fas fa-file-export" :loading="exporting" @click="startExport">
        {{ results.length ? '重新导出' : '开始导出' }}
      </AppButton>
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

watch(() => props.isOpen, (open) => {
  if (!open) return;
  progress.value = '';
  results.value = [];
  cancelRequested.value = false;
  selectedCollectionIds.value = new Set<string>();
});

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
  if (!exporting.value) emit('close');
}

function cancelExport() {
  if (!exporting.value || !abortController.value) return;
  cancelRequested.value = true;
  progress.value = '正在取消导出…';
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
    alert('请至少选择一种导出格式');
    return;
  }
  if (props.mode === 'collections' && selectedCollectionIds.value.size === 0) {
    alert('请至少选择一个收藏单');
    return;
  }

  exporting.value = true;
  cancelRequested.value = false;
  const controller = new AbortController();
  abortController.value = controller;
  progress.value = '准备导出';
  results.value = [];
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
      for (const format of selectedFormats) {
        controller.signal.throwIfAborted();
        if (format === 'html') {
          const exportDirectory = await CoolapkTauriAPI.createExportDirectory(`${name}_html`, settingsStore.settings.downloadPath);
          const imageDirectory = joinPath(exportDirectory, 'images');
          const avatarDirectory = joinPath(imageDirectory, 'avatars');
          const emojiDirectory = joinPath(exportDirectory, 'emojis');
          const content = await favoriteExportToHtml(bundle, {
            imageQuality: imageQuality.value,
            signal: controller.signal,
            onProgress: (message) => { progress.value = `“${source.title}”：${message}`; },
            saveImage: async (url, index, _total, kind) => {
              controller.signal.throwIfAborted();
              const dataUrl = await CoolapkTauriAPI.getImageDataUrl(url);
              controller.signal.throwIfAborted();
              const directory = kind === 'emoji' ? emojiDirectory : kind === 'avatar' ? avatarDirectory : imageDirectory;
              const prefix = kind === 'emoji' ? 'emoji' : kind === 'avatar' ? 'avatar' : 'image';
              const savedPath = await CoolapkTauriAPI.saveImageDataUrl(
                dataUrl,
                `${prefix}_${String(index + 1).padStart(4, '0')}`,
                directory,
              );
              const relativeDirectory = kind === 'emoji' ? 'emojis' : kind === 'avatar' ? 'images/avatars' : 'images';
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
            settingsStore.settings.downloadPath,
          ));
        }
      }
      controller.signal.throwIfAborted();
      await saveFavoriteExportSnapshot(bundle);
      totalItems += bundle.summary.total;
      totalFailed += bundle.summary.contentFailed;
    }
    progress.value = `完成：${sources.length} 个${props.mode === 'collections' ? '收藏单' : '导出任务'}，共 ${totalItems} 条内容，正文失败 ${totalFailed} 条`;
  } catch (error) {
    if (controller.signal.aborted) {
      progress.value = results.value.length ? '导出已取消，已完成的文件已保留' : '导出已取消';
    } else {
      progress.value = '';
      alert(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    }
  } finally {
    exporting.value = false;
    if (abortController.value === controller) abortController.value = null;
  }
}
</script>

<style scoped>
.favorite-export-dialog { display: flex; flex-direction: column; gap: 22px; }
.export-intro { display: flex; gap: 14px; padding: 16px; border-radius: 12px; background: color-mix(in srgb, var(--brand-primary) 8%, var(--surface)); }
.export-intro-icon { display: grid; place-items: center; width: 42px; height: 42px; flex: 0 0 42px; border-radius: 11px; color: #fff; background: var(--brand-primary); }
.export-intro strong { display: block; color: var(--text-primary); font-size: 15px; }
.export-intro p { margin: 3px 0 0; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }
.export-section { display: flex; flex-direction: column; gap: 10px; }
.export-section-heading { display: flex; align-items: baseline; justify-content: space-between; }
.export-section-heading > span { color: var(--text-primary); font-weight: 700; }
.export-section-heading small { color: var(--text-tertiary); }
.collection-picker-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 180px; overflow-y: auto; }
.collection-picker-card { position: relative; display: flex; align-items: center; gap: 10px; min-width: 0; padding: 11px 12px; border: 1px solid var(--border); border-radius: 9px; cursor: pointer; }
.collection-picker-card:hover { border-color: color-mix(in srgb, var(--brand-primary) 55%, var(--border)); }
.collection-picker-card.selected { border-color: var(--brand-primary); background: color-mix(in srgb, var(--brand-primary) 7%, var(--surface)); }
.collection-picker-card > input { position: absolute; opacity: 0; pointer-events: none; }
.collection-picker-card > i:first-of-type { color: var(--text-secondary); }
.collection-picker-card > span { min-width: 0; display: flex; flex: 1; flex-direction: column; }
.collection-picker-card strong { overflow: hidden; color: var(--text-primary); font-size: 13px; white-space: nowrap; text-overflow: ellipsis; }
.collection-picker-card small { color: var(--text-tertiary); font-size: 11px; }
.collection-picker-check { color: var(--brand-primary); opacity: 0; }
.collection-picker-card.selected .collection-picker-check { opacity: 1; }
.format-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.format-card { position: relative; display: flex; align-items: center; gap: 10px; min-width: 0; padding: 13px; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; transition: .16s ease; }
.format-card:hover { border-color: color-mix(in srgb, var(--brand-primary) 55%, var(--border)); }
.format-card.selected { border-color: var(--brand-primary); background: color-mix(in srgb, var(--brand-primary) 7%, var(--surface)); }
.format-card > input { position: absolute; opacity: 0; pointer-events: none; }
.format-icon { display: grid; place-items: center; width: 34px; height: 34px; flex: 0 0 34px; border-radius: 8px; color: var(--brand-primary); background: color-mix(in srgb, var(--brand-primary) 12%, transparent); }
.format-copy { min-width: 0; display: flex; flex-direction: column; }
.format-copy strong { color: var(--text-primary); }
.format-copy small { overflow: hidden; color: var(--text-tertiary); font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }
.format-check { position: absolute; top: 7px; right: 7px; color: var(--brand-primary); opacity: 0; }
.format-card.selected .format-check { opacity: 1; }
.image-quality-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.image-quality-card { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; }
.image-quality-card:hover { border-color: color-mix(in srgb, var(--brand-primary) 55%, var(--border)); }
.image-quality-card.selected { border-color: var(--brand-primary); background: color-mix(in srgb, var(--brand-primary) 7%, var(--surface)); }
.image-quality-card input { position: absolute; opacity: 0; pointer-events: none; }
.image-quality-card span { display: flex; flex: 1; flex-direction: column; }
.image-quality-card strong { color: var(--text-primary); font-size: 14px; }
.image-quality-card small { color: var(--text-tertiary); font-size: 12px; }
.image-quality-card > i { color: var(--brand-primary); opacity: 0; }
.image-quality-card.selected > i { opacity: 1; }
.comment-options { overflow: hidden; border: 1px solid var(--border); border-radius: 10px; }
.comment-option { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; cursor: pointer; }
.comment-option + .comment-option { border-top: 1px solid var(--border-light); }
.comment-option > span { display: flex; flex-direction: column; }
.comment-option strong { color: var(--text-primary); font-size: 14px; }
.comment-option small { color: var(--text-tertiary); font-size: 12px; }
.comment-option.disabled { opacity: .5; cursor: not-allowed; }
.export-progress { display: flex; align-items: flex-start; gap: 9px; padding: 11px 13px; border-radius: 9px; color: var(--brand-primary); background: color-mix(in srgb, var(--brand-primary) 8%, transparent); font-size: 13px; }
.export-progress i { margin-top: 3px; }
.export-results { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 9px; }
.export-results strong { color: var(--text-primary); font-size: 13px; }
.export-results span { color: var(--text-tertiary); font-size: 12px; word-break: break-all; }
@media (max-width: 640px) { .format-grid, .collection-picker-grid, .image-quality-grid { grid-template-columns: 1fr; } }
</style>
