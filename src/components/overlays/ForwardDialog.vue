<template>
  <AppDialog :is-open="show" title="转发动态" :width="600" @close="close">
    <div class="forward-container">
      <div class="source-feed-box">
        <AppAvatar :src="sourceAvatar" size="sm" />
        <div class="source-body">
          <span class="source-username">{{ sourceUsername }}</span>
          <div class="source-message">{{ sourceMessage }}</div>
        </div>
      </div>

      <textarea
        ref="messageInput"
        v-model="message"
        placeholder="说说你的看法..."
        rows="4"
        maxlength="1000"
        class="forward-textarea custom-scrollbar"
      ></textarea>

      <div v-if="images.length > 0" class="forward-media-preview">
        <div v-for="(img, i) in images" :key="i" class="media-thumb">
          <img :src="img.preview" alt="upload" />
          <button class="remove-img" :disabled="submitting" @click="removeImage(i)">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div v-if="uploadingImages" class="upload-tip">
          <i class="fas fa-circle-notch fa-spin"></i> 正在上传图片 {{ uploadedCount }}/{{ images.length }}...
        </div>
      </div>

      <input
        ref="imageInputRef"
        type="file"
        accept="image/*"
        multiple
        style="display: none"
        @change="handleImageSelected"
      />

      <div class="forward-toolbar">
        <div class="toolbar-tools">
          <button class="tool-btn" title="添加图片" @click="triggerImageUpload">
            <i class="fas fa-image"></i> 图片
          </button>
        </div>
        <span class="word-count">{{ message.length }} / 1000</span>
      </div>

      <div v-if="errorMessage" class="error-tip">
        <i class="fas fa-exclamation-circle"></i> {{ errorMessage }}
      </div>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="close">取消</AppButton>
      <AppButton variant="primary" :disabled="submitting" :loading="submitting" @click="handleSubmit">
        转发
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import AppDialog from '../common/AppDialog.vue';
import AppButton from '../common/AppButton.vue';
import AppAvatar from '../common/AppAvatar.vue';
import { showToast } from '../../utils/toast';

const props = defineProps<{
  feed: any;
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'success'): void;
}>();

const authStore = useAuthStore();
const MAX_IMAGES = 9;
const message = ref('');
const images = ref<{ file: File; preview: string }[]>([]);
const uploadingImages = ref(false);
const uploadedCount = ref(0);
const submitting = ref(false);
const errorMessage = ref('');
const messageInput = ref<HTMLTextAreaElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);

const sourceAvatar = computed(
  () => props.feed?.userAvatar || props.feed?.userInfo?.userAvatar || props.feed?.pic || ''
);
const sourceUsername = computed(
  () => props.feed?.username || props.feed?.userInfo?.username || '酷友'
);
const sourceMessage = computed(() => {
  const raw = props.feed?.message || props.feed?.message_raw_output || props.feed?.title || '';
  const text = String(raw).replace(/<[^>]+>/g, '').trim();
  if (!text) return '（无文字内容）';
  return text.length > 200 ? `${text.slice(0, 200)}...` : text;
});

watch(
  () => props.show,
  (open) => {
    if (open) {
      message.value = '';
      images.value = [];
      uploadingImages.value = false;
      errorMessage.value = '';
      nextTick(() => messageInput.value?.focus());
    }
  }
);

function close() {
  emit('update:show', false);
}

function triggerImageUpload() {
  if (images.value.length >= MAX_IMAGES) {
    errorMessage.value = `最多只能添加 ${MAX_IMAGES} 张图片`;
    return;
  }
  imageInputRef.value?.click();
}

function handleImageSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files ? Array.from(target.files) : [];
  target.value = '';
  if (files.length === 0) return;
  errorMessage.value = '';
  const remain = MAX_IMAGES - images.value.length;
  if (files.length > remain) {
    errorMessage.value = `最多只能添加 ${MAX_IMAGES} 张图片`;
  }
  files.slice(0, remain).forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      images.value.push({ file, preview: String(reader.result) });
    };
    reader.readAsDataURL(file);
  });
}

function resolveUploadedUrl(data: any): string {
  let url = '';
  if (typeof data === 'string') {
    url = data;
  } else if (data && typeof data === 'object') {
    url = data.url || data.pic || data.path || data.filename || '';
  }
  if (!url) throw new Error('上传图片失败：服务端未返回图片地址');
  if (url.startsWith('//')) url = `https:${url}`;
  else if (url.startsWith('/')) url = `https://image.coolapk.com${url}`;
  return url;
}

function removeImage(index: number) {
  if (submitting.value) return;
  images.value.splice(index, 1);
}

async function handleSubmit() {
  if (submitting.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    errorMessage.value = '请先登录后再转发动态';
    return;
  }
  submitting.value = true;
  uploadingImages.value = images.value.length > 0;
  uploadedCount.value = 0;
  errorMessage.value = '';
  try {
    let pic = '';
    if (images.value.length > 0) {
      const urls: string[] = [];
      for (const img of images.value) {
        const bytes = new Uint8Array(await img.file.arrayBuffer());
        const contentType = img.file.type || 'image/jpeg';
        const res = await CoolapkTauriAPI.uploadImage(bytes, img.file.name, contentType, 'feed');
        urls.push(resolveUploadedUrl(res?.data));
        uploadedCount.value += 1;
      }
      pic = urls.join(',');
    }
    const res = await CoolapkTauriAPI.createForward(
      String(props.feed?.id),
      message.value.trim(),
      pic || undefined
    );
    if (res && res.code === 200) {
      showToast('转发成功！');
      emit('success');
      close();
    } else {
      errorMessage.value = res?.message || '转发动态失败';
    }
  } catch (err: any) {
    errorMessage.value = typeof err === 'string' ? err : (err?.message || '转发动态服务异常');
    nextTick(() => messageInput.value?.focus());
  } finally {
    uploadingImages.value = false;
    submitting.value = false;
  }
}
</script>

<style scoped>
.forward-container {
  display: flex;
  flex-direction: column;
}

.source-feed-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  margin-bottom: var(--space-4);
}

.source-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.source-username {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.source-message {
  font-size: var(--font-size-caption);
  line-height: var(--line-height-sub);
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.forward-textarea {
  width: 100%;
  border: none;
  resize: none;
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-primary);
  background: transparent;
}

.forward-textarea::placeholder {
  color: var(--text-tertiary);
}

.forward-media-preview {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  flex-wrap: wrap;
}

.media-thumb {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-img {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
}

.remove-img:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.upload-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  align-self: center;
}

.forward-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-light);
}

.tool-btn {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn:hover {
  color: var(--brand-primary);
}

.word-count {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.error-tip {
  margin-top: var(--space-3);
  color: var(--danger);
  font-size: var(--font-size-caption);
}
</style>
