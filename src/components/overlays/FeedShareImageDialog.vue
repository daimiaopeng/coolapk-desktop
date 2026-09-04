<template>
  <AppDialog :is-open="show" title="生成动态分享图" :width="760" :close-on-backdrop="!generating" @close="close">
    <div class="feed-share-dialog">
      <div v-if="generating" class="share-status">
        <i class="fas fa-spinner fa-spin"></i>
        <span>正在生成分享图，请稍候...</span>
      </div>

      <div v-else-if="error" class="share-status share-error">
        <i class="fas fa-triangle-exclamation"></i>
        <div>
          <strong>分享图生成失败</strong>
          <p>{{ error }}</p>
          <p v-if="failedImageUrls.length" class="failed-images">失败图片：{{ failedImageUrls.length }} 张</p>
        </div>
      </div>

      <template v-else-if="imageDataUrl">
        <div class="share-preview-wrap">
          <img class="share-preview" :src="imageDataUrl" alt="动态分享图预览" />
        </div>
        <div class="share-actions">
          <AppButton variant="secondary" :disabled="generating" @click="generate">重新生成</AppButton>
          <AppButton variant="soft" :disabled="!imageDataUrl" @click="copyImage">复制图片</AppButton>
          <AppButton variant="primary" :disabled="!imageDataUrl || saving" :loading="saving" @click="saveImage">保存图片</AppButton>
          <AppButton variant="ghost" :disabled="!imageDataUrl" @click="shareImage">系统分享</AppButton>
        </div>
      </template>
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="close">关闭</AppButton>
    </template>
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
import { dataUrlToBlob, FeedShareImageError, generateFeedShareImage, getFeedShareFileName } from '../../utils/feedShareImage';

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
    const result = await generateFeedShareImage(props.feed, props.images || []);
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
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.share-preview-wrap {
  max-height: 62vh;
  overflow: auto;
  padding: 14px;
  border-radius: 14px;
  background: var(--background-secondary);
  border: 1px solid var(--border-light);
  text-align: center;
}

.share-preview {
  display: block;
  width: min(100%, 520px);
  height: auto;
  margin: 0 auto;
  border-radius: 10px;
  box-shadow: var(--shadow-md);
}

.share-status {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
}

.share-status i {
  color: var(--brand-primary);
  font-size: 22px;
}

.share-error {
  color: var(--text-primary);
}

.share-error p,
.failed-images {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.share-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
</style>
