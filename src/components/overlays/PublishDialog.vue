<template>
  <AppDialog
    :is-open="appStore.isPublishOpen && !shuzilmGuideState.visible"
    :title="isEditMode ? '重新编辑动态' : '发布新动态'"
    :width="720"
    @close="appStore.closePublish"
  >
    <div class="publish-container">
      <div v-if="editLoading" class="panel-tip">正在读取可编辑动态...</div>
      <div v-else-if="editLoadError" class="error-tip"><i class="fas fa-exclamation-circle"></i> {{ editLoadError }}</div>
      <template v-else>
      <div v-if="previewMode" class="preview-box custom-scrollbar">
        <div class="preview-content" v-html="previewHtml"></div>
        <div v-if="!message.trim()" class="preview-empty">输入内容后此处显示预览效果</div>
      </div>
      <div
        v-else
        ref="messageInput"
        contenteditable="true"
        role="textbox"
        aria-label="动态内容"
        aria-multiline="true"
        data-placeholder="分享这一刻的酷搞感受，与酷友讨论数码生活..."
        class="publish-textarea custom-scrollbar"
        @input="handleEditorInput"
        @keydown="handleEditorKeydown"
        @paste="handleEditorPaste"
        @copy="handleEditorCopy"
        @cut="handleEditorCut"
        @compositionend="syncEditor"
      ></div>

      <div class="publish-media-preview" v-if="images.length > 0">
        <div v-for="(img, i) in images" :key="i" class="media-thumb">
          <AppImage :src="img.preview" alt="动态图片" image-class="media-thumb-image" />
          <button class="remove-img" :disabled="submitting" @click="removeImage(i)"><i class="fas fa-times"></i></button>
        </div>
        <div v-if="uploadingImages" class="upload-tip">
          <i class="fas fa-circle-notch fa-spin"></i> 正在上传图片 {{ uploadedCount }}/{{ images.filter((image) => !!image.file).length }}...
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

      <!-- 表情面板 (参考微信：最近使用 + 所有表情) -->
      <div v-if="showEmojiPanel" class="emoji-panel custom-scrollbar">
        <!-- 最近使用 -->
        <template v-if="recentEmojis.length">
          <div class="emoji-section-title">最近使用</div>
          <div class="emoji-grid emoji-grid-recent">
            <button
              v-for="name in recentEmojis"
              :key="'recent-' + name"
              type="button"
              class="emoji-item"
              :title="name"
              @mousedown.prevent
              @click="insertEmoji(name)"
            >
              <img :src="getEmojiUrl(String(name))" :alt="name" />
            </button>
          </div>
        </template>

        <!-- 所有表情 -->
        <div class="emoji-section-title">所有表情</div>
        <div class="emoji-grid">
          <button
            v-for="(fileName, name) in EMOJI_MAP"
            :key="name"
            type="button"
            class="emoji-item"
            :title="name"
            @mousedown.prevent
            @click="insertEmoji(name)"
          >
            <img :src="getEmojiUrl(String(name))" :alt="name" />
          </button>
        </div>
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
          @mousedown.prevent
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
            @mousedown.prevent
            @click="toggleEmojiPanel"
          >
            <i class="far fa-smile"></i> 表情
          </button>
          <button class="tool-btn" title="添加图片" @click="triggerImageUpload"><i class="fas fa-image"></i> 图片</button>
          <button
            class="tool-btn"
            :class="{ 'is-active': showTopicPanel }"
            title="插入话题"
            @mousedown.prevent
            @click="toggleTopicPanel"
          >
            <i class="fas fa-hashtag"></i> 话题
          </button>
          <button class="tool-btn" title="@酷友" @mousedown.prevent @click="insertAtMention"><i class="fas fa-at"></i> 提醒</button>
          <button class="tool-btn" title="预览效果" @click="previewMode = !previewMode">
            <i class="far fa-eye"></i> {{ previewMode ? '编辑' : '预览' }}
          </button>
        </div>
        <span class="word-count">{{ message.length }} / 1000</span>
      </div>

      <div v-if="errorMessage" class="error-tip">
        <i class="fas fa-exclamation-circle"></i> {{ errorMessage }}
      </div>
      </template>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="appStore.closePublish">取消</AppButton>
      <AppButton
        variant="primary"
        :disabled="editLoading || !!editLoadError || (!message.trim() && images.length === 0) || submitting"
        :loading="submitting"
        @click="handlePublish"
      >
        {{ isEditMode ? '保存修改' : '立即发布' }}
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
import { renderCoolapkEmoji, EMOJI_MAP, getEmojiUrl } from '../../utils/coolapkEmoji';
import { useRecentEmojis } from '../../utils/recentEmojis';
import { renderCoolapkRichText } from '../../utils/richText';
import { extractFeedImageInputs, normalizeFeedImageItems } from '../../utils/livePhoto';
import { clearPublishDraft, loadPublishDraft, savePublishDraft } from '../../utils/publishDrafts';
import { verifyWithCaptcha, extractCaptchaParamsFromResponse } from '../../utils/neteaseCaptcha';
import { shuzilmGuideState, openShuzilmGuide, isRiskControlError } from '../../utils/shuzilmDeviceGuide';
import AppDialog from '../common/AppDialog.vue';
import AppButton from '../common/AppButton.vue';
import AppImage from '../common/AppImage.vue';

const appStore = useAppStore();
const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const MAX_IMAGES = 9;
const message = ref('');
const images = ref<{ file?: File; preview: string; url?: string }[]>([]);
const uploadingImages = ref(false);
const uploadedCount = ref(0);
const submitting = ref(false);
const errorMessage = ref('');
const showEmojiPanel = ref(false);
const { recentEmojis, addRecent } = useRecentEmojis();
const showTopicPanel = ref(false);
const topics = ref<any[]>([]);
const topicsLoading = ref(false);
const previewMode = ref(false);
const editLoading = ref(false);
const editLoadError = ref('');
const isEditMode = computed(() => !!appStore.editFeedTarget);
const messageInput = ref<HTMLDivElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
let restoringDraft = false;
let openRevision = 0;

function currentDraftAccount(): string {
  return String(authStore.user?.uid || 'guest');
}

const previewHtml = computed(() => {
  // 预览统一走安全化渲染（先 sanitize 再渲染酷安表情），
  // 与正文实际展示逻辑一致，防止预览阶段注入 HTML
  return renderCoolapkRichText(message.value);
});

watch(() => appStore.isPublishOpen, async (open) => {
  const revision = ++openRevision;
  if (open) {
    restoringDraft = true;
    message.value = '';
    images.value = [];
    uploadingImages.value = false;
    errorMessage.value = '';
    previewMode.value = false;
    showEmojiPanel.value = false;
    showTopicPanel.value = false;
    editLoadError.value = '';
    if (appStore.editFeedTarget) {
      editLoading.value = true;
      try {
        const response = await CoolapkTauriAPI.getEditableFeed(String(appStore.editFeedTarget.id));
        if (revision !== openRevision || !appStore.isPublishOpen) return;
        const feed = response?.data;
        if (!feed || String(feed.id) !== String(appStore.editFeedTarget.id)) throw new Error('获取可编辑动态失败');
        const authorUid = feed.uid ?? feed.userInfo?.uid;
        if (authorUid && String(authorUid) !== String(authStore.user?.uid)) throw new Error('只能编辑自己发布的动态');
        const canEdit = feed.enableModify ?? feed.enable_modify;
        if (canEdit !== undefined && Number(canEdit) !== 1) throw new Error('此动态当前不允许编辑或编辑次数已用尽');
        if (String(feed.feedType ?? feed.feed_type ?? 'feed') !== 'feed') throw new Error('目前只支持重新编辑普通动态');
        if (Number(feed.isHtmlArticle ?? feed.is_html_article ?? 0) > 0 || Number(feed.mediaType ?? feed.media_type ?? 0) > 0 || String(feed.mediaUrl ?? feed.media_url ?? '')) throw new Error('目前只支持重新编辑普通图文动态');
        const cardFeed = appStore.editFeedTarget;
        message.value = [feed.messageRawInput, feed.message_raw_input, feed.message, feed.messageRawOutput, cardFeed.message, cardFeed.message_raw_output].find((value) => typeof value === 'string' && value.trim()) || '';
        const imageInputs = extractFeedImageInputs(feed);
        const detailItems = normalizeFeedImageItems(imageInputs.length === 1 && typeof imageInputs[0] === 'string' && imageInputs[0].includes(',') ? imageInputs[0].split(',') : imageInputs);
        const cardItems = normalizeFeedImageItems(extractFeedImageInputs(cardFeed));
        if (imageInputs.length > 0 && detailItems.length === 0 && cardItems.length === 0) throw new Error('无法识别原动态图片，为避免丢失图片，已停止编辑');
        if ([...detailItems, ...cardItems].some((item) => item.isLivePhoto)) throw new Error('暂不支持重新编辑实况照片动态，以免丢失照片信息');
        const originalPics = typeof feed.pic === 'string' ? feed.pic.split(',').filter(Boolean) : [];
        const imageCount = Math.max(detailItems.length, cardItems.length, originalPics.length);
        images.value = Array.from({ length: imageCount }, (_, index) => ({
          url: originalPics.length === imageCount ? originalPics[index] : cardItems[index]?.sourceUrl || detailItems[index]?.sourceUrl || '',
          preview: cardItems[index]?.coverUrl || detailItems[index]?.coverUrl || '',
        }));
        if (images.value.some((image) => !image.url || !image.preview)) throw new Error('原动态图片信息不完整，为避免丢失图片，已停止编辑');
      } catch (error: any) {
        if (revision === openRevision) editLoadError.value = error?.message || String(error);
      } finally {
        if (revision === openRevision) editLoading.value = false;
      }
    } else {
      const draft = await loadPublishDraft(currentDraftAccount());
      if (revision !== openRevision || !appStore.isPublishOpen) return;
      message.value = draft;
    }
    await nextTick();
    renderEditor();
    restoringDraft = false;
    if (topics.value.length === 0 && !topicsLoading.value) {
      fetchHotTopics();
    }
    nextTick(() => messageInput.value?.focus());
  }
});

watch(message, (value) => {
  if (!restoringDraft && !isEditMode.value) void savePublishDraft(currentDraftAccount(), value);
});

watch(previewMode, async (preview) => {
  if (!preview) { await nextTick(); renderEditor(); }
});

function escapeEditorText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 编辑区显示表情图片，实际草稿和发布内容仍保留酷安使用的 [表情名] 文本。
function editorText(node: Node | null): string {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node instanceof HTMLImageElement) return node.alt || '';
  return Array.from(node.childNodes).map(editorText).join('');
}

function editorOffset(): number {
  const editor = messageInput.value;
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode)) return message.value.length;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(editor);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return editorText(range.cloneContents()).length;
}

function setEditorOffset(offset: number) {
  const editor = messageInput.value;
  if (!editor) return;
  const selection = window.getSelection();
  const range = document.createRange();
  let remaining = offset;
  let found = false;
  const nodes = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  while (nodes.nextNode()) {
    const node = nodes.currentNode;
    if (node instanceof HTMLImageElement) {
      const length = node.alt.length;
      if (remaining === 0) { range.setStartBefore(node); found = true; break; }
      if (remaining <= length) { range.setStartAfter(node); found = true; break; }
      remaining -= length;
    } else if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length || 0;
      if (remaining <= length) { range.setStart(node, remaining); found = true; break; }
      remaining -= length;
    }
  }
  if (!found) range.selectNodeContents(editor);
  range.collapse(!found ? false : true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function renderEditor(caret?: number) {
  const editor = messageInput.value;
  if (!editor) return;
  editor.innerHTML = renderCoolapkEmoji(escapeEditorText(message.value));
  if (caret !== undefined) setEditorOffset(caret);
}

function emojiCount(value: string): number {
  return Array.from(value.matchAll(/\[([^\]\r\n]{1,20})\]/g)).filter((match) => !!getEmojiUrl(match[1])).length;
}

function syncEditor() {
  const editor = messageInput.value;
  if (!editor) return;
  const caret = editorOffset();
  const value = editorText(editor);
  if (value.length > 1000) {
    message.value = value.slice(0, 1000);
    renderEditor(Math.min(caret, 1000));
    return;
  }
  message.value = value;
  if (editor.querySelectorAll('img.coolapk-emoji').length !== emojiCount(value)) renderEditor(caret);
}

function handleEditorInput(event: InputEvent) {
  const editor = messageInput.value;
  if (!editor || event.currentTarget !== editor) return;
  if (event.isComposing) { message.value = editorText(editor); return; }
  syncEditor();
}

function insertAtCursor(text: string) {
  const editor = messageInput.value;
  if (!editor) return;
  editor.focus();
  const selection = window.getSelection();
  const range = selection?.rangeCount && editor.contains(selection.anchorNode) ? selection.getRangeAt(0) : document.createRange();
  if (!editor.contains(range.startContainer)) { range.selectNodeContents(editor); range.collapse(false); }
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
  syncEditor();
}

function handleEditorKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); insertAtCursor('\n'); }
}

function handleEditorPaste(event: ClipboardEvent) {
  event.preventDefault();
  insertAtCursor(event.clipboardData?.getData('text/plain') || '');
}

function handleEditorCopy(event: ClipboardEvent) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !messageInput.value?.contains(selection.anchorNode)) return;
  event.preventDefault();
  event.clipboardData?.setData('text/plain', editorText(selection.getRangeAt(0).cloneContents()));
}

function handleEditorCut(event: ClipboardEvent) {
  handleEditorCopy(event);
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  selection.getRangeAt(0).deleteContents();
  syncEditor();
}

function insertEmoji(name: string) {
  addRecent(name);
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
  if (isEditMode.value) return message.value;
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
  if ((!message.value.trim() && images.value.length === 0) || submitting.value || editLoading.value || editLoadError.value) return;

  const proceedPublish = async () => {
    submitting.value = true;
    uploadingImages.value = images.value.some((image) => !!image.file);
    uploadedCount.value = 0;
    errorMessage.value = '';
    try {
      let pic = '';
      if (images.value.length > 0) {
        const urls: string[] = [];
        for (const img of images.value) {
          if (img.url && !img.file) { urls.push(img.url); continue; }
          if (img.file) {
            const bytes = new Uint8Array(await img.file.arrayBuffer());
            const contentType = img.file.type || 'image/jpeg';
            const res = await CoolapkTauriAPI.uploadImage(bytes, img.file.name, contentType, 'feed');
            urls.push(resolveUploadedUrl(res?.data));
            uploadedCount.value += 1;
          }
        }
        pic = urls.join(',');
      }

      const executeCreate = async (postToken?: string) => {
        if (appStore.editFeedTarget) return await CoolapkTauriAPI.updateFeed(String(appStore.editFeedTarget.id), buildFinalMessage(), pic, postToken);
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
        } else if (isRiskControlError(err)) {
          errorMessage.value = `酷安服务端风控拦截（需官方设备认证），${isEditMode.value ? '修改' : '发布'}失败`;
          openShuzilmGuide({
            reason: 'risk_controlled',
            message: '请求被酷安服务端拦截。请到设备信息设置粘贴手机官方酷安复制的设备日志，保存后重试。',
            onConfirmContinue: () => {
              errorMessage.value = '';
              void proceedPublish();
            },
          });
          return;
        } else {
          throw err;
        }
      }

      if (res && res.code !== 200) {
        const captchaParams = extractCaptchaParamsFromResponse(res);
        if (captchaParams?.captchaId) {
          const token = await verifyWithCaptcha(captchaParams.captchaId);
          res = await executeCreate(token);
        } else if (isRiskControlError(res)) {
          errorMessage.value = `酷安服务端风控拦截（需官方设备认证），${isEditMode.value ? '修改' : '发布'}失败`;
          openShuzilmGuide({
            reason: 'risk_controlled',
            message: '请求被酷安服务端拦截。请到设备信息设置粘贴手机官方酷安复制的设备日志，保存后重试。',
            onConfirmContinue: () => {
              errorMessage.value = '';
              void proceedPublish();
            },
          });
          return;
        }
      }

      if (res && res.code === 200) {
        if (appStore.editFeedTarget) {
          const updatedPictures = pic ? pic.split(',') : [];
          Object.assign(appStore.editFeedTarget, { message: buildFinalMessage(), messageRawInput: buildFinalMessage(), message_raw_output: buildFinalMessage(), pics: updatedPictures, picArr: updatedPictures, imageUriList: updatedPictures, pic, isModified: 1 });
        } else {
          await clearPublishDraft(currentDraftAccount());
        }
        message.value = '';
        images.value = [];
        // 给用户明确反馈后延迟关闭
        errorMessage.value = '';
        const successTip = document.createElement('div');
        successTip.className = 'publish-success-tip';
        successTip.textContent = isEditMode.value ? '修改成功！' : '发布成功！';
        document.body.appendChild(successTip);
        setTimeout(() => successTip.remove(), 1500);
        setTimeout(() => {
          appStore.closePublish();
        }, 600);
      } else {
        errorMessage.value = res?.message || `${isEditMode.value ? '修改' : '发布'}动态失败`;
      }
    } catch (err: any) {
      errorMessage.value = typeof err === 'string' ? err : (err?.message || `${isEditMode.value ? '修改' : '发布'}动态服务异常`);
      // 失败时保持弹窗打开并聚焦输入框，便于用户修改重试
      nextTick(() => messageInput.value?.focus());
    } finally {
      uploadingImages.value = false;
      submitting.value = false;
    }
  };

  // 未设置设备 ID 时先完成设备信息设置，保存后继续发布。
  if (!isEditMode.value && !settingsStore.settings.deviceFingerprint.deviceId?.trim()) {
    openShuzilmGuide({ reason: 'missing_id', onConfirmContinue: () => { void proceedPublish(); } });
    return;
  }
  await proceedPublish();
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
  min-height: 140px;
  max-height: 220px;
  overflow-y: auto;
  outline: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-primary);
  background: transparent;
}

.publish-textarea:empty::before {
  content: attr(data-placeholder);
  color: var(--text-tertiary);
}

.publish-textarea :deep(.coolapk-emoji) {
  width: 24px;
  height: 24px;
  object-fit: contain;
  vertical-align: middle;
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

.media-thumb :deep(.app-image-container),
.media-thumb :deep(.app-image-container img) {
  width: 100%;
  height: 100%;
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
  margin-top: var(--space-3);
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px 10px 10px;
  background-color: var(--background);
}

.emoji-section-title {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  padding: 4px 4px 6px 4px;
  user-select: none;
  font-weight: 500;
  line-height: 1;
}

.emoji-section-title:not(:first-child) {
  margin-top: 8px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 4px;
}

.emoji-grid-recent {
  margin-bottom: 2px;
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
