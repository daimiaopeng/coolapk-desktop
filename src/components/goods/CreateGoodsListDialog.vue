<template>
  <AppDialog
    :is-open="isOpen"
    :title="editing ? '编辑好物' : '创建好物'"
    :width="480"
    :close-on-backdrop="!submitting"
    @close="close"
  >
    <div class="form-body">
      <div class="form-field">
        <label class="form-label">封面</label>
        <div class="cover-picker">
          <div class="cover-preview">
            <AppImage v-if="coverUrl" :src="coverUrl" image-class="cover-img" fit="cover" />
            <div v-else class="cover-empty">
              <i class="fas fa-image"></i>
              <span>选择封面图片</span>
            </div>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden-input"
            @change="handleCoverSelected"
          />
          <div class="cover-actions">
            <AppButton size="sm" variant="secondary" :disabled="uploading" @click="pickCover">
              <i v-if="uploading" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-cloud-upload-alt"></i>
              {{ uploading ? '上传中...' : coverUrl ? '更换封面' : '上传封面' }}
            </AppButton>
            <button
              v-if="coverUrl"
              class="clear-cover-btn"
              type="button"
              :disabled="uploading"
              @click="coverUrl = ''"
            >
              清除
            </button>
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-label">标题 <span class="required">*</span></label>
        <input
          v-model="title"
          class="text-input"
          type="text"
          placeholder="为好物起个标题"
          maxlength="60"
        />
      </div>

      <div class="form-field">
        <label class="form-label">说明</label>
        <textarea
          v-model="message"
          class="text-area"
          rows="4"
          placeholder="介绍一下这份好物（选填）"
          maxlength="500"
        ></textarea>
      </div>

      <div v-if="listTypes.length > 0" class="form-field">
        <label class="form-label">分类</label>
        <div class="type-chips">
          <button
            v-for="type in listTypes"
            :key="typeKey(type)"
            class="type-chip"
            :class="{ 'is-active': listType === typeKey(type) }"
            type="button"
            @click="listType = typeKey(type)"
          >
            {{ type.title || type.name || typeKey(type) }}
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="close">取消</AppButton>
      <AppButton
        variant="primary"
        :loading="submitting"
        :disabled="!title.trim()"
        @click="submit"
      >
        {{ editing ? '保存修改' : '创建' }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import AppDialog from '../common/AppDialog.vue';
import AppButton from '../common/AppButton.vue';
import AppImage from '../common/AppImage.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    kind?: 'lists' | 'ranking';
    editing?: any;
  }>(),
  {
    kind: 'lists',
    editing: null,
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created', id: string): void;
}>();

const title = ref('');
const message = ref('');
const coverUrl = ref('');
const listType = ref('');
const listTypes = ref<any[]>([]);
const submitting = ref(false);
const uploading = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

function typeKey(type: any): string {
  return String(type?.id ?? type?.entityId ?? '');
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    const data = props.editing?.goodsListInfo || props.editing || {};
    title.value = data.title || '';
    message.value = data.message || data.description || '';
    coverUrl.value = data.cover || data.coverPic || data.logo || data.pic || '';
    listType.value = data.list_type || '';
    void loadTypes();
  },
);

async function loadTypes() {
  if (listTypes.value.length > 0) return;
  try {
    const res = await CoolapkTauriAPI.getGoodsListTypes();
    const data = res?.data;
    listTypes.value = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('加载好物分类失败', err);
  }
}

function pickCover() {
  fileInputRef.value?.click();
}

async function handleCoverSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files && target.files[0];
  if (!file) return;
  uploading.value = true;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || 'image/jpeg';
    const fileName = file.name || `cover.${contentType.split('/')[1] || 'jpg'}`;
    const res = await CoolapkTauriAPI.uploadImage(bytes, fileName, contentType, 'cover');
    const uploaded: any = res?.data || res;
    const url = typeof uploaded === 'string' ? uploaded : (uploaded?.url || uploaded?.data || uploaded?.pic || '');
    if (!url) {
      throw new Error('图片上传成功但未获取到封面地址');
    }
    coverUrl.value = url;
    showToast('封面已上传', 'success');
  } catch (err) {
    showToast(getErrorMessage(err, '封面上传失败'), 'error');
  } finally {
    uploading.value = false;
    target.value = '';
  }
}

function close() {
  if (submitting.value) return;
  emit('close');
}

async function submit() {
  if (submitting.value) return;
  const payload: any = {
    title: title.value.trim(),
    message: message.value.trim(),
    cover: coverUrl.value,
    topLimit: 0,
    isOpenVote: props.kind === 'ranking',
    listType: listType.value || 'feed',
  };
  submitting.value = true;
  try {
    if (props.editing) {
      const id = String(props.editing?.id ?? props.editing?.goodsListInfo?.id ?? '');
      await CoolapkTauriAPI.editGoodsList({ ...payload, id });
      showToast('已保存修改', 'success');
      emit('created', id);
    } else {
      const res = await CoolapkTauriAPI.createGoodsList(payload);
      const data = res?.data;
      const id = typeof data === 'string' ? data : String(data?.id ?? data?.entityId ?? '');
      showToast('创建成功', 'success');
      emit('created', id);
    }
  } catch (err) {
    showToast(getErrorMessage(err, '操作失败'), 'error');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.form-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.required {
  color: var(--danger);
}

.cover-picker {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.cover-preview {
  width: 120px;
  height: 120px;
  flex: 0 0 120px;
  border-radius: var(--radius-control);
  overflow: hidden;
  background-color: var(--background-secondary);
  border: 1px dashed var(--border);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.cover-empty i {
  font-size: 26px;
}

.cover-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.clear-cover-btn {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
  cursor: pointer;
  align-self: flex-start;
}

.clear-cover-btn:hover {
  color: var(--danger);
}

.hidden-input {
  display: none;
}

.text-input,
.text-area {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  padding: 8px 12px;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-default);
  font-family: inherit;
}

.text-input:focus,
.text-area:focus {
  border-color: var(--brand-primary);
}

.text-area {
  resize: vertical;
  min-height: 80px;
  line-height: var(--line-height-sub);
}

.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.type-chip {
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.type-chip:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.type-chip.is-active {
  background-color: var(--brand-soft);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}
</style>