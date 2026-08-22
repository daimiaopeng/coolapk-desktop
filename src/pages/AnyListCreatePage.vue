<template>
  <div class="page-container custom-scrollbar">
    <div class="top-nav-bar">
      <div class="nav-title-box">
        <span class="nav-title">创建万物清单</span>
      </div>
      <div class="nav-right-actions">
        <button class="btn-submit" :disabled="submitting" @click="submitAlbum">
          <i v-if="submitting" class="fas fa-circle-notch fa-spin"></i>
          <i v-else class="fas fa-check"></i>
          {{ submitting ? '提交中...' : '发布' }}
        </button>
      </div>
    </div>

    <div v-if="!authStore.isLoggedIn" class="login-prompt">
      <EmptyState title="登录后创建万物清单" description="创建清单需要登录账号">
        <button class="btn-login" @click="authStore.openLoginModal()">立即登录</button>
      </EmptyState>
    </div>

    <template v-else>
      <div class="form-card">
        <label class="form-label" for="album-title">清单标题</label>
        <input
          id="album-title"
          v-model="title"
          class="form-input"
          type="text"
          maxlength="40"
          placeholder="给这份清单起个标题，例如：我的桌面外设清单"
        />
      </div>

      <div class="form-card">
        <label class="form-label" for="album-desc">清单说明</label>
        <textarea
          id="album-desc"
          v-model="description"
          class="form-textarea"
          rows="4"
          maxlength="300"
          placeholder="介绍一下这份清单的用途、适用场景等（可选）"
        ></textarea>
      </div>

      <div class="form-card">
        <div class="items-header">
          <label class="form-label">商品条目（{{ items.length }}）</label>
          <button class="btn-add-item" @click="startSearch">
            <i class="fas fa-search"></i> 从商品搜索添加
          </button>
        </div>

        <div v-if="searchMode" class="product-search-box">
          <div class="search-row">
            <input
              v-model="searchQuery"
              class="form-input search-input"
              type="text"
              placeholder="输入商品名称搜索..."
              @keyup.enter="runSearch"
            />
            <button class="btn-search" :disabled="searching" @click="runSearch">
              <i class="fas fa-search"></i>
            </button>
          </div>
          <div v-if="searching" class="search-loading">
            <LoadingState text="搜索商品中..." />
          </div>
          <div v-else-if="searchResults.length" class="search-results">
            <button
              v-for="product in searchResults"
              :key="product.id"
              class="search-result-item"
              @click="addFromProduct(product)"
            >
              <AppImage
                v-if="product.pic || product.logo"
                :src="product.pic || product.logo"
                class="result-logo"
                fit="cover"
                :alt="product.title"
              />
              <div v-else class="result-logo result-logo-fallback">
                <i class="fas fa-box"></i>
              </div>
              <span class="result-title">{{ product.title || '未命名商品' }}</span>
              <i class="fas fa-plus result-add"></i>
            </button>
          </div>
          <div v-else-if="searchTried" class="search-empty">
            <span>未找到相关商品，可直接手动填写下方条目</span>
          </div>
        </div>

        <div v-if="items.length" class="item-editor-list">
          <div v-for="(item, index) in items" :key="index" class="item-editor">
            <span class="item-index">{{ index + 1 }}</span>
            <div class="item-fields">
              <input
                v-model="item.item_name"
                class="form-input field-name"
                type="text"
                placeholder="商品名称"
              />
              <input
                v-model="item.item_description"
                class="form-input field-desc"
                type="text"
                placeholder="商品说明（可选）"
              />
              <input
                v-model="item.item_logo"
                class="form-input field-logo"
                type="text"
                placeholder="商品图片 URL（可选）"
              />
            </div>
            <button class="btn-remove-item" title="移除该条目" @click="removeItem(index)">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>

        <button v-else class="btn-add-empty" @click="addEmptyItem">
          <i class="fas fa-plus"></i> 手动添加商品条目
        </button>
      </div>

      <div v-if="submitError" class="submit-error">
        <i class="fas fa-exclamation-triangle"></i> {{ submitError }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';
import type { AnyListItem } from '../types/anylist';

const router = useRouter();
const authStore = useAuthStore();

const title = ref('');
const description = ref('');
const items = ref<AnyListItem[]>([]);
const submitting = ref(false);
const submitError = ref('');

const searchMode = ref(false);
const searchQuery = ref('');
const searching = ref(false);
const searchTried = ref(false);
const searchResults = ref<any[]>([]);

function addEmptyItem() {
  items.value.push({ item_name: '', item_description: '', item_logo: '', item_id: '' });
}

function removeItem(index: number) {
  items.value.splice(index, 1);
}

function startSearch() {
  searchMode.value = true;
  searchQuery.value = '';
  searchTried.value = false;
  searchResults.value = [];
}

async function runSearch() {
  const query = searchQuery.value.trim();
  if (!query || searching.value) return;
  searching.value = true;
  searchTried.value = false;
  searchResults.value = [];
  try {
    const res = await CoolapkTauriAPI.searchAll(query, 1);
    const list = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    searchResults.value = list.filter((item: any) => {
      const type = item.entityType || '';
      return type === 'product' || type === 'goods' || (item.id && item.title && (item.pic || item.logo));
    }).slice(0, 12);
  } catch (err) {
    console.warn('搜索商品失败', err);
  } finally {
    searching.value = false;
    searchTried.value = true;
  }
}

function addFromProduct(product: any) {
  items.value.push({
    item_id: String(product.id ?? product.entityId ?? ''),
    item_name: product.title || product.subTitle || '未命名商品',
    item_description: product.description || product.subTitle || '',
    item_logo: product.pic || product.logo || '',
  });
  searchMode.value = false;
}

async function submitAlbum() {
  const cleanTitle = title.value.trim();
  if (!cleanTitle) {
    submitError.value = '请填写清单标题';
    return;
  }
  const validItems = items.value
    .map((item) => ({
      ...item,
      item_name: (item.item_name || '').trim(),
      item_description: (item.item_description || '').trim(),
      item_logo: (item.item_logo || '').trim(),
    }))
    .filter((item) => item.item_name);

  submitting.value = true;
  submitError.value = '';
  try {
    const res = await CoolapkTauriAPI.createProductAlbum({
      title: cleanTitle,
      description: description.value.trim(),
      albumType: 0,
      productItems: validItems,
    });
    const createdId = res?.data?.id ?? res?.data?.entityId;
    if (createdId) {
      router.push({ path: `/anylist/${createdId}` });
    } else {
      submitError.value = '发布成功，但未返回清单 ID，请回到清单列表查看';
      router.push({ path: '/anylist' });
    }
  } catch (err: any) {
    submitError.value = err?.message || '发布失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width, 860px);
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.top-nav-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  margin-bottom: 2px;
}

.nav-title-box {
  flex: 1;
  text-align: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--brand-primary, #10b981);
}

.nav-right-actions {
  flex-shrink: 0;
}

.btn-submit {
  height: 32px;
  padding: 0 18px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-submit:hover:not(:disabled) {
  background: var(--brand-hover, #059669);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-login {
  height: 34px;
  padding: 0 22px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.login-prompt {
  padding: var(--space-10) 0;
}

.form-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.form-input,
.form-textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background-color: var(--background);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  padding: 9px 12px;
  outline: none;
  transition: all var(--duration-fast) var(--ease-default);
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: var(--font-family-base);
}

.items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.btn-add-item {
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-add-item:hover {
  border-color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.product-search-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background-color: var(--background);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-row {
  display: flex;
  gap: 8px;
}

.search-input {
  flex: 1;
}

.btn-search {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background-color: var(--surface);
  color: var(--brand-primary);
  cursor: pointer;
}

.btn-search:disabled {
  opacity: 0.6;
}

.search-loading,
.search-empty {
  padding: 12px;
  text-align: center;
}

.search-empty {
  font-size: 12px;
  color: var(--text-tertiary);
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}

.search-result-item:hover {
  background-color: var(--surface-hover);
}

.result-logo {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--background-secondary);
}

.result-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-tertiary);
}

.result-title {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-add {
  color: var(--brand-primary);
  font-size: 12px;
}

.item-editor-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item-editor {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  background-color: var(--background);
  border-radius: 10px;
}

.item-index {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.item-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.btn-remove-item {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  font-size: 13px;
  margin-top: 2px;
}

.btn-remove-item:hover {
  color: var(--danger);
}

.btn-add-empty {
  height: 36px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all var(--duration-fast) var(--ease-default);
}

.btn-add-empty:hover {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

.submit-error {
  padding: 10px 14px;
  background-color: rgba(240, 68, 68, 0.08);
  color: var(--danger);
  border-radius: 10px;
  font-size: 13px;
}
</style>