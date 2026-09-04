<template>
  <AppDialog :is-open="show" :width="660" :close-on-backdrop="!generating" @close="close">
    <div class="feed-share-dialog">
      <button type="button" class="share-dialog-close" title="关闭" aria-label="关闭" @click="close">
        <i class="fas fa-times"></i>
      </button>

      <div v-if="generating" class="share-status">
        <div class="share-status-icon is-loading"><i class="fas fa-spinner fa-spin"></i></div>
        <div class="share-status-copy">
          <strong>正在生成分享图</strong>
          <span>正在整理动态、热评和图片，请稍候…</span>
          <div class="loading-track"><span></span></div>
        </div>
      </div>

      <div v-else-if="error" class="share-status share-error" role="alert">
        <div class="share-status-icon is-error"><i class="fas fa-triangle-exclamation"></i></div>
        <div class="share-status-copy">
          <strong>分享图生成失败</strong>
          <p>{{ error }}</p>
          <p v-if="failedImageUrls.length" class="failed-images">失败图片：{{ failedImageUrls.length }} 张</p>
          <AppButton class="retry-button" variant="soft" size="sm" icon="fas fa-rotate-right" @click="generate">重试</AppButton>
        </div>
      </div>

      <template v-else-if="imageDataUrl">
        <section class="share-preview-card" aria-label="分享图预览">
          <div class="share-preview-wrap">
            <img class="share-preview" :src="imageDataUrl" alt="动态分享图预览" />
          </div>
        </section>

        <div class="share-export">
          <div class="export-copy">
            <strong>导出分享图</strong>
            <span>选择一种方式保存或分享</span>
          </div>
          <div class="share-actions">
            <AppButton class="share-action-button" variant="secondary" icon="fas fa-rotate-right" :disabled="generating" @click="generate">重新生成</AppButton>
            <AppButton class="share-action-button" variant="secondary" icon="far fa-copy" :disabled="!imageDataUrl" @click="copyImage">复制图片</AppButton>
            <AppButton class="share-action-button" variant="secondary" icon="fas fa-share-nodes" :disabled="!imageDataUrl" @click="shareImage">系统分享</AppButton>
            <AppButton class="share-action-button save-action" variant="primary" icon="fas fa-download" :disabled="!imageDataUrl || saving" :loading="saving" @click="saveImage">保存图片</AppButton>
          </div>
        </div>
      </template>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { FeedItem } from '../../types/feed';
import type { FeedImageInput } from '../../utils/livePhoto';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useSettingsStore } from '../../stores/settings';
import { showToast } from '../../utils/toast';
import AppDialog from '../common/AppDialog.vue';
import AppButton from '../common/AppButton.vue';
import {
  dataUrlToBlob,
  FeedShareImageError,
  generateFeedShareImage,
  getFeedShareComments,
  getFeedShareFileName,
  type FeedShareComment,
} from '../../utils/feedShareImage';
import { getReplyData } from '../../utils/commentList';

const props = defineProps<{
  show: boolean;
  feed: FeedItem;
  images?: FeedImageInput[];
}>();

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void;
}>();

const settingsStore = useSettingsStore();
const generating = ref(false);
const saving = ref(false);
const imageDataUrl = ref('');
const error = ref('');
const failedImageUrls = ref<string[]>([]);

async function loadHotComments(): Promise<FeedShareComment[]> {
  const feedId = String(props.feed.id || '');
  if (!feedId) return [];
  try {
    const response = await CoolapkTauriAPI.getFeedReplies(feedId, 1, {
      listType: 'popular',
      fromFeedAuthor: 0,
    });
    return getFeedShareComments(getReplyData(response) as FeedShareComment[]);
  } catch {
    // 只使用评论区“热门”排序对应的接口；请求失败时不伪造或混入其他评论。
    return [];
  }
}

function close() {
  if (!generating.value) emit('update:show', false);
}

async function generate() {
  if (!props.show || generating.value) return;
  generating.value = true;
  error.value = '';
  imageDataUrl.value = '';
  failedImageUrls.value = [];
  try {
    const comments = await loadHotComments();
    const result = await generateFeedShareImage(props.feed, props.images || [], { comments });
    imageDataUrl.value = result.dataUrl;
    failedImageUrls.value = result.failedImageUrls;
  } catch (reason) {
    if (reason instanceof FeedShareImageError) {
      failedImageUrls.value = reason.failedImageUrls;
      error.value = `有 ${reason.failedImageUrls.length} 张图片加载失败，请重试后再保存。`;
    } else {
      error.value = reason instanceof Error ? reason.message : String(reason);
    }
  } finally {
    generating.value = false;
  }
}

async function copyImage() {
  if (!imageDataUrl.value) return;
  try {
    const blob = dataUrlToBlob(imageDataUrl.value);
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('当前系统不支持图片剪贴板');
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    showToast('分享图已复制', 'success');
  } catch {
    showToast('当前系统不支持复制图片，请使用保存图片', 'error');
  }
}

async function saveImage() {
  if (!imageDataUrl.value || saving.value) return;
  saving.value = true;
  try {
    const path = await CoolapkTauriAPI.saveImageDataUrl(imageDataUrl.value, getFeedShareFileName(props.feed), settingsStore.settings.downloadPath);
    showToast(path ? `分享图已保存：${path}` : '分享图已保存', 'success', 5000);
  } catch (reason) {
    showToast(`分享图保存失败：${reason instanceof Error ? reason.message : String(reason)}`, 'error', 4000);
  } finally {
    saving.value = false;
  }
}

async function shareImage() {
  if (!imageDataUrl.value) return;
  try {
    const blob = dataUrlToBlob(imageDataUrl.value);
    const file = new File([blob], getFeedShareFileName(props.feed), { type: blob.type });
    const shareNavigator = navigator as Navigator & { share?: (data: ShareData) => Promise<void>; canShare?: (data: ShareData) => boolean };
    if (!shareNavigator.share) throw new Error('当前桌面环境不支持系统分享');
    const data: ShareData = { title: '酷安动态', files: [file] };
    if (shareNavigator.canShare && !shareNavigator.canShare(data)) throw new Error('当前系统不支持分享图片文件');
    await shareNavigator.share(data);
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    showToast('当前桌面环境不支持系统分享，请使用保存图片', 'error', 4000);
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) void generate();
  },
  { immediate: true },
);
</script>

<style scoped>
.feed-share-dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--text-primary);
  max-height: calc(85vh - 40px);
}

.share-dialog-close {
  position: absolute;
  top: -12px;
  right: -12px;
  z-index: 2;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-default), background-color var(--duration-fast) var(--ease-default);
}

.share-dialog-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.share-preview-card {
  overflow: hidden;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  background: transparent;
  flex: 1 1 auto;
  min-height: 0;
}

.share-preview-wrap {
  max-height: calc(85vh - 120px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  background: transparent;
}

.share-preview {
  display: block;
  width: 100%;
  height: auto !important;
  margin: 0 auto;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.share-status {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 28px;
  border: 1px solid var(--border-light);
  border-radius: 18px;
  background: linear-gradient(135deg, var(--background-secondary), var(--surface-hover));
}

.share-status-icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  place-items: center;
  border-radius: 15px;
  font-size: 20px;
}

.share-status-icon.is-loading {
  background: var(--brand-soft);
  color: var(--brand-primary);
}

.share-status-icon.is-error {
  background: rgba(240, 68, 68, .1);
  color: var(--danger);
}

.share-status-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.share-status-copy strong {
  font-size: 15px;
}

.share-status-copy > span,
.share-status-copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.loading-track {
  width: min(220px, 100%);
  height: 5px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--border-light);
}

.loading-track span {
  display: block;
  width: 42%;
  height: 100%;
  border-radius: inherit;
  background: var(--brand-primary);
  animation: share-loading 1.3s ease-in-out infinite;
}

.share-error {
  justify-content: flex-start;
}

.share-error .share-status-copy {
  align-items: flex-start;
}

.failed-images {
  color: var(--danger) !important;
}

.retry-button {
  margin-top: 7px;
}

.share-export {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding-top: 2px;
}

.export-copy {
  display: flex;
  min-width: 100px;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.export-copy strong {
  font-size: 13px;
}

.export-copy span {
  color: var(--text-tertiary);
  font-size: 11px;
}

.share-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: nowrap;
}

.share-action-button {
  min-width: 86px;
  height: 36px;
  padding: 0 10px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.save-action {
  min-width: 94px;
  padding: 0 14px;
  border-color: var(--brand-primary);
  box-shadow: 0 4px 12px rgba(16, 183, 104, .2);
}

@keyframes share-loading {
  0% { transform: translateX(-120%); }
  50%, 100% { transform: translateX(270%); }
}

@media (max-width: 480px) {
  .share-preview-wrap {
    max-height: 52vh;
  }

  .share-export {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .share-actions {
    flex-wrap: wrap;
    justify-content: stretch;
  }

  .share-action-button {
    flex: 1 1 calc(50% - 4px);
  }
}
</style>
