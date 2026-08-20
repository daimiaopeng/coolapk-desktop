<template>
  <AppDialog
    :is-open="appStore.isPublishOpen"
    title="发布新动态"
    :width="720"
    @close="appStore.closePublish"
  >
    <div class="publish-container">
      <div v-if="previewMode" class="preview-box custom-scrollbar">
        <div class="preview-content" v-html="previewHtml"></div>
        <div v-if="!message.trim()" class="preview-empty">输入内容后此处显示预览效果</div>
      </div>
      <textarea
        v-else
        ref="messageInput"
        v-model="message"
        placeholder="分享这一刻的酷搞感受，与酷友讨论数码生活..."
        class="publish-textarea custom-scrollbar"
        rows="6"
        maxlength="1000"
      ></textarea>

      <div class="publish-media-preview" v-if="images.length > 0">
        <div v-for="(img, i) in images" :key="i" class="media-thumb">
          <img :src="img.preview" alt="upload" />
          <button class="remove-img" :disabled="submitting" @click="removeImage(i)"><i class="fas fa-times"></i></button>
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

      <!-- 表情面板 -->
      <div v-if="showEmojiPanel" class="emoji-panel custom-scrollbar">
        <button
          v-for="(fileName, name) in EMOJI_MAP"
          :key="name"
          class="emoji-item"
          :title="name"
          @click="insertEmoji(name)"
        >
          <img :src="EMOJI_BASE + fileName" :alt="name" />
        </button>
      </div>

      <!-- 话题面板 -->
      <div v-if="showTopicPanel" class="topic-panel custom-scrollbar">
        <div v-if="topicsLoading" class="panel-tip"><i class="fas fa-circle-notch fa-spin"></i> 正在获取热门话题...</div>
        <div v-else-if="topics.length === 0" class="panel-tip">暂无热门话题</div>
        <button
          v-for="(t, idx) in topics"
          :key="t.id || t.tag || t.title || idx"
          class="topic-item"
          :title="getTopicTitle(t)"
          @click="insertTopic(getTopicTitle(t))"
        >
          <i class="fas fa-hashtag topic-hash"></i>
          <span class="topic-name">{{ getTopicTitle(t) }}</span>
        </button>
      </div>

      <div class="publish-toolbar">
        <div class="toolbar-tools">
          <button
            class="tool-btn"
            :class="{ 'is-active': showEmojiPanel }"
            title="插入表情"
            @click="toggleEmojiPanel"
          >
            <i class="far fa-smile"></i> 表情
          </button>
          <button class="tool-btn" title="添加图片" @click="triggerImageUpload"><i class="fas fa-image"></i> 图片</button>
          <button
            class="tool-btn"
            :class="{ 'is-active': showTopicPanel }"
            title="插入话题"
            @click="toggleTopicPanel"
          >
            <i class="fas fa-hashtag"></i> 话题
          </button>
          <button class="tool-btn" title="@酷友" @click="insertAtMention"><i class="fas fa-at"></i> 提醒</button>
          <button class="tool-btn" title="预览效果" @click="previewMode = !previewMode">
            <i class="far fa-eye"></i> {{ previewMode ? '编辑' : '预览' }}
          </button>
        </div>
        <span class="word-count">{{ message.length }} / 1000</span>
      </div>

      <div v-if="errorMessage" class="error-tip">
        <i class="fas fa-exclamation-circle"></i> {{ errorMessage }}
      </div>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="appStore.closePublish">取消</AppButton>
      <AppButton
        variant="primary"
        :disabled="(!message.trim() && images.length === 0) || submitting"
        :loading="submitting"
        @click="handlePublish"
      >
        立即发布
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useAppStore } from '../../stores/app';
import { useSettingsStore } from '../../stores/settings';
import { useAuthStore } from '../../stores/auth';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { renderCoolapkEmoji, EMOJI_MAP, EMOJI_BASE } from '../../utils/coolapkEmoji';
import { renderCoolapkRichText } from '../../utils/richText';
import { clearPublishDraft, loadPublishDraft, savePublishDraft } from '../../utils/publishDrafts';
import { verifyWithCaptcha, extractCaptchaParamsFromResponse } from '../../utils/neteaseCaptcha';
import AppDialog from '../common/AppDialog.vue';
import AppButton from '../common/AppButton.vue';

const appStore = useAppStore();
const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const MAX_IMAGES = 9;
const message = ref('');
const images = ref<{ file: File; preview: string }[]>([]);
const uploadingImages = ref(false);
const uploadedCount = ref(0);
const submitting = ref(false);
const errorMessage = ref('');
const showEmojiPanel = ref(false);
const showTopicPanel = ref(false);
const topics = ref<any[]>([]);
const topicsLoading = ref(false);
const previewMode = ref(false);
const messageInput = ref<HTMLTextAreaElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
let restoringDraft = false;

function currentDraftAccount(): string {
  return String(authStore.user?.uid || 'guest');
}

const previewHtml = computed(() => {
  // 预览统一走安全化渲染（先 sanitize 再渲染酷安表情），
  // 与正文实际展示逻辑一致，防止预览阶段注入 HTML
  return renderCoolapkRichText(message.value);
});

watch(() => appStore.isPublishOpen, async (open) => {
  if (open) {
    restoringDraft = true;
    message.value = '';
    images.value = [];
    uploadingImages.value = false;
    errorMessage.value = '';
    previewMode.value = false;
    showEmojiPanel.value = false;
    showTopicPanel.value = false;
    message.value = await loadPublishDraft(currentDraftAccount());
    restoringDraft = false;
    if (topics.value.length === 0 && !topicsLoading.value) {
      fetchHotTopics();
    }
    nextTick(() => messageInput.value?.focus());
  }
});

watch(message, (value) => {
  if (!restoringDraft) void savePublishDraft(currentDraftAccount(), value);
});

function insertAtCursor(text: string) {
  const el = messageInput.value;
  const start = el?.selectionStart ?? message.value.length;
  const end = el?.selectionEnd ?? message.value.length;
  message.value = message.value.slice(0, start) + text + message.value.slice(end);
  nextTick(() => {
    if (el) {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    }
  });
}

function insertEmoji(name: string) {
  insertAtCursor(`[${name}]`);
}

function getTopicTitle(t: any): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  const raw = t.title || t.tag || t.name || t.entityTitle || t.topic_title || t.targetTitle || t.infoHtml || '';
  if (typeof raw === 'string') {
    return raw.replace(/^#|#$/g, '').trim();
  }
  return '';
}

function insertTopic(title: string) {
  const clean = String(title || '').replace(/[#\[\]]/g, '').trim();
  if (!clean) return;
  insertAtCursor(`#${clean}#`);
}

function insertAtMention() {
  insertAtCursor('@');
}

function toggleEmojiPanel() {
  showEmojiPanel.value = !showEmojiPanel.value;
  if (showEmojiPanel.value) showTopicPanel.value = false;
}

function toggleTopicPanel() {
  showTopicPanel.value = !showTopicPanel.value;
  if (showTopicPanel.value) {
    showEmojiPanel.value = false;
    fetchHotTopics();
  }
}

async function fetchHotTopics() {
  if (topicsLoading.value) return;
  topicsLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getHotTopics();
    if (res && res.data && Array.isArray(res.data)) {
      topics.value = res.data.slice(0, 20);
    }
  } catch (err) {
    console.warn('获取热门话题失败:', err);
  } finally {
    topicsLoading.value = false;
  }
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

function buildFinalMessage(): string {
  const base = message.value.trim();
  if (
    settingsStore.settings.publishDeviceSignature &&
    settingsStore.settings.deviceSignature &&
    base.length > 0
  ) {
    return `${base}\n来自 ${settingsStore.settings.deviceSignature.trim()}`;
  }
  return base;
}

async function handlePublish() {
  if ((!message.value.trim() && images.value.length === 0) || submitting.value) return;
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

    const executeCreate = async (postToken?: string) => {
      if (postToken) {
        return await CoolapkTauriAPI.createFeed(buildFinalMessage(), pic || undefined, postToken);
      }
      return await CoolapkTauriAPI.createFeed(buildFinalMessage(), pic || undefined);
    };

    let res: any;
    try {
      res = await executeCreate();
    } catch (err: any) {
      const captchaParams = extractCaptchaParamsFromResponse(err);
      if (captchaParams?.captchaId) {
        const token = await verifyWithCaptcha(captchaParams.captchaId);
        res = await executeCreate(token);
      } else {
        const errMsg = String(err?.message || err || '');
        if (errMsg.includes('网络环境可能异常') || errMsg.includes('err_request_need_upgrade_new_version')) {
          errorMessage.value = '酷安服务端风控拦截（需官方手机环境），发布失败';
          return;
        }
        throw err;
      }
    }

    if (res && res.code !== 200) {
      const captchaParams = extractCaptchaParamsFromResponse(res);
      if (captchaParams?.captchaId) {
        const token = await verifyWithCaptcha(captchaParams.captchaId);
        res = await executeCreate(token);
      } else if (
        String(res.message || res.messageStatus || '').includes('网络环境可能异常') ||
        String(res.message || res.messageStatus || '').includes('err_request_need_upgrade_new_version')
      ) {
        errorMessage.value = '酷安服务端风控拦截（需官方手机环境），发布失败';
        return;
      }
    }

    if (res && res.code === 200) {
      await clearPublishDraft(currentDraftAccount());
      message.value = '';
      images.value = [];
      // 给用户明确反馈后延迟关闭
      errorMessage.value = '';
      const successTip = document.createElement('div');
      successTip.className = 'publish-success-tip';
      successTip.textContent = '发布成功！';
      document.body.appendChild(successTip);
      setTimeout(() => successTip.remove(), 1500);
      setTimeout(() => {
        appStore.closePublish();
      }, 600);
    } else {
      errorMessage.value = res?.message || '发布动态失败';
    }
  } catch (err: any) {
    errorMessage.value = typeof err === 'string' ? err : (err?.message || '发布动态服务异常');
    // 失败时保持弹窗打开并聚焦输入框，便于用户修改重试
    nextTick(() => messageInput.value?.focus());
  } finally {
    uploadingImages.value = false;
    submitting.value = false;
  }
}
</script>

<style scoped>
.publish-container {
  display: flex;
  flex-direction: column;
}

.publish-textarea {
  width: 100%;
  border: none;
  resize: none;
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-primary);
  background: transparent;
}

.publish-textarea::placeholder {
  color: var(--text-tertiary);
}

.preview-box {
  min-height: 140px;
  max-height: 220px;
  overflow-y: auto;
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-primary);
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
}

.preview-empty {
  color: var(--text-tertiary);
  font-size: var(--font-size-sub);
}

.publish-media-preview {
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

.publish-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-light);
}

.toolbar-tools {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.tool-btn {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn:hover,
.tool-btn.is-active {
  color: var(--brand-primary);
}

.word-count {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.emoji-panel {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 4px;
  margin-top: var(--space-3);
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  background-color: var(--background);
}

.emoji-item {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  transition: background-color var(--duration-fast) var(--ease-default);
}

.emoji-item:hover {
  background-color: var(--surface-hover);
}

.emoji-item img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.topic-panel {
  margin-top: var(--space-3);
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-control);
  padding: var(--space-3);
  background-color: var(--background);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.panel-tip {
  width: 100%;
  text-align: center;
  padding: var(--space-3);
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.topic-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-light);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  max-width: 220px;
}

.topic-item:hover {
  background-color: var(--brand-soft);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.topic-hash {
  font-size: 12px;
  color: var(--brand-primary);
}

.topic-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 550;
}

.error-tip {
  margin-top: var(--space-3);
  color: var(--danger);
  font-size: var(--font-size-caption);
}
</style>

<style>
.publish-success-tip {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--brand-primary, #10b981);
  color: #fff;
  padding: 10px 22px;
  border-radius: var(--radius-pill, 9999px);
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
  z-index: 9999;
  animation: successTipIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes successTipIn {
  from {
    opacity: 0;
    transform: translate(-50%, -12px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
