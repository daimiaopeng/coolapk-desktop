<template>
  <AppDialog
    :is-open="appStore.isPublishOpen"
    title="发布新动态"
    :width="720"
    @close="appStore.closePublish"
  >
    <div class="publish-container">
      <textarea
        v-model="message"
        placeholder="分享这一刻的酷搞感受，与酷友讨论数码生活..."
        class="publish-textarea custom-scrollbar"
        rows="6"
        maxlength="1000"
      ></textarea>

      <div class="publish-media-preview" v-if="images.length > 0">
        <div v-for="(img, i) in images" :key="i" class="media-thumb">
          <img :src="img" alt="upload" />
          <button class="remove-img" @click="removeImage(i)"><i class="fas fa-times"></i></button>
        </div>
      </div>

      <div class="publish-toolbar">
        <div class="toolbar-tools">
          <button class="tool-btn" title="插入表情"><i class="far fa-smile"></i> 表情</button>
          <button class="tool-btn" title="添加图片" @click="triggerImageUpload"><i class="far fa-image"></i> 图片</button>
          <button class="tool-btn" title="插入话题"><i class="fas fa-hashtag"></i> 话题</button>
          <button class="tool-btn" title="@酷友"><i class="fas fa-at"></i> 提醒</button>
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
        :disabled="!message.trim()"
        :loading="submitting"
        @click="handlePublish"
      >
        立即发布
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '../../stores/app';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppDialog from '../common/AppDialog.vue';
import AppButton from '../common/AppButton.vue';

const appStore = useAppStore();
const message = ref('');
const images = ref<string[]>([]);
const submitting = ref(false);
const errorMessage = ref('');

function triggerImageUpload() {
  errorMessage.value = '图片附件发布接口在当前版 Rust 网络层暂未打通';
}

function removeImage(index: number) {
  images.value.splice(index, 1);
}

async function handlePublish() {
  if (!message.value.trim() || submitting.value) return;
  submitting.value = true;
  errorMessage.value = '';
  try {
    const res = await CoolapkTauriAPI.createFeed(message.value);
    if (res && res.code === 200) {
      message.value = '';
      appStore.closePublish();
    } else {
      errorMessage.value = res?.message || '发布动态失败';
    }
  } catch (err: any) {
    errorMessage.value = err.message || '发布动态服务异常';
  } finally {
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
