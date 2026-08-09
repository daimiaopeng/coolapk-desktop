<template>
  <div class="page-container custom-scrollbar">
    <div class="page-header">
      <div class="header-main">
        <h2 class="page-title"><i class="fas fa-globe icon"></i> {{ title }}</h2>
        <span class="page-subtitle">{{ url }}</span>
      </div>
      <div class="header-actions">
        <AppButton variant="ghost" size="sm" icon="fas fa-external-link-alt" @click="openInSystem">
          系统浏览器
        </AppButton>
      </div>
    </div>

    <div v-if="loading" class="state-wrapper">
      <LoadingState text="正在抓取页面内容..." />
    </div>
    <div v-else-if="error" class="state-wrapper">
      <ErrorState title="页面加载失败" :message="error" @retry="loadPage" />
    </div>
    <div v-else-if="!html" class="state-wrapper">
      <EmptyState title="页面为空" description="该页面没有可显示的内容" />
    </div>
    <div v-else class="external-content" v-html="renderedHtml" @click="handleAnchorClick"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { sanitizeCoolapkHtml } from '../utils/sanitizeHtml';
import { handleAnchorClick } from '../utils/anchorClick';
import AppButton from '../components/common/AppButton.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';

const route = useRoute();

// 固定当前缓存页面的目标地址，避免切换路由时后台重新抓取。
const url = ref(String(route.query.url || ''));
const title = ref('外部链接');
const html = ref('');
const loading = ref(false);
const error = ref('');

const renderedHtml = computed(() => {
  if (!html.value) return '';
  // 抓取到的整页 HTML：压缩空白后安全化，只保留文本与 <a>/<br>
  return sanitizeCoolapkHtml(
    html.value.replace(/\s+/g, ' ').replace(/>\s+</g, '><')
  );
});

async function loadPage() {
  if (!url.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res: any = await CoolapkTauriAPI.fetchExternalPage(url.value);
    const data = res?.data;
    if (!data) {
      throw new Error('服务返回异常');
    }
    title.value = data.title || '外部链接';
    html.value = data.html || '';
    if (data.status && data.status >= 400) {
      error.value = `页面返回 HTTP ${data.status}`;
    }
  } catch (err: any) {
    error.value = err?.message || '抓取页面失败';
    html.value = '';
  } finally {
    loading.value = false;
  }
}

function openInSystem() {
  CoolapkTauriAPI.openUrl(url.value, 'system');
}

watch(url, (newUrl) => {
  if (newUrl) {
    html.value = '';
    loadPage();
  }
}, { immediate: true });
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.page-title {
  font-size: var(--font-size-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.page-title .icon {
  color: var(--brand-primary);
}

.page-subtitle {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60vw;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.state-wrapper {
  padding: var(--space-10) 0;
}

.external-content {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-5);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-primary);
  word-break: break-word;
}

.external-content a {
  color: var(--brand-primary);
  text-decoration: underline;
  cursor: pointer;
}

.external-content br {
  line-height: 1.5;
}
</style>
