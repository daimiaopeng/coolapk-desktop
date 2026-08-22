<template>
  <div class="compare-page page-container custom-scrollbar">
    <header class="page-header">
      <div>
        <h2 class="page-title"><i class="fas fa-code-compare icon"></i>配置对比</h2>
        <p>横向对比多个产品配置的参数差异</p>
      </div>
      <button type="button" class="back-link" @click="router.back()">
        <i class="fas fa-arrow-left"></i> 返回
      </button>
    </header>

    <div v-if="loading" class="state-wrapper">
      <LoadingState text="正在加载配置对比数据..." />
    </div>

    <div v-else-if="error" class="state-wrapper">
      <ErrorState title="对比数据加载失败" :message="error" @retry="loadCompare" />
    </div>

    <div v-else-if="configs.length < 2" class="state-wrapper">
      <EmptyState title="至少需要两个配置" description="请回到产品参数页选择至少两个配置进行对比" />
    </div>

    <div v-else class="compare-table-wrapper">
      <table class="compare-table">
        <thead>
          <tr>
            <th class="field-col">参数</th>
            <th v-for="config in configs" :key="String(config.id)" class="config-col">
              <div class="config-head-cell">
                <strong>{{ config.title }}</strong>
                <span v-if="config.price" class="config-price">参考价 ¥{{ config.price }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="field in fieldRows" :key="field.name" class="compare-row">
            <th scope="row" class="field-col">{{ field.name }}</th>
            <td v-for="config in configs" :key="String(config.id)" class="config-col">
              <span :class="{ 'highlight-diff': isDifferent(field.name) }">
                {{ fieldValue(config, field.name) || '—' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { parseProductConfigData, type ProductConfig } from '../types/product';

const route = useRoute();
const router = useRouter();

const configs = ref<ProductConfig[]>([]);
const loading = ref(false);
const error = ref('');

interface CompareField {
  name: string;
  label: string;
}

const baseFields: CompareField[] = [
  { name: 'title', label: '名称' },
  { name: 'price', label: '参考价' },
  { name: 'release_time', label: '发布时间' },
  { name: 'cpu', label: '处理器' },
  { name: 'ram', label: '运行内存' },
  { name: 'phone_material', label: '机身材料' },
  { name: 'screen_material', label: '屏幕材质' },
  { name: 'keywords', label: '关键词' },
];

const fieldRows = computed<CompareField[]>(() => {
  const rows: CompareField[] = [...baseFields];
  const seen = new Set(rows.map((row) => row.name));
  for (const config of configs.value) {
    const groups = parseProductConfigData(config.config_data);
    for (const [groupName, fields] of Object.entries(groups)) {
      for (const fieldName of Object.keys(fields)) {
        const key = `${groupName}.${fieldName}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({ name: key, label: `${groupName} / ${fieldName}` });
        }
      }
    }
  }
  return rows;
});

function rawFieldValue(config: ProductConfig, fieldName: string): string {
  if (fieldName.includes('.')) {
    const [groupName, field] = fieldName.split('.');
    const groups = parseProductConfigData(config.config_data);
    return groups[groupName]?.[field] ?? '';
  }
  const value = config[fieldName];
  if (value === undefined || value === null) return '';
  return String(value);
}

function fieldValue(config: ProductConfig, fieldName: string): string {
  const value = rawFieldValue(config, fieldName).trim();
  if (!value) return '';
  if (fieldName === 'price') return `¥${value}`;
  return value;
}

function isDifferent(fieldName: string): boolean {
  const values = configs.value.map((config) => rawFieldValue(config, fieldName).trim());
  return new Set(values.filter(Boolean)).size > 1;
}

async function loadCompare() {
  const ids = String(route.query.ids || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length < 2) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const results = await Promise.allSettled(ids.map((id) => CoolapkTauriAPI.getProductConfig(id)));
    const loaded: ProductConfig[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value?.data && typeof result.value.data === 'object') {
        loaded.push({ ...result.value.data, id: ids[index] });
      }
    });
    configs.value = loaded;
  } catch (err: any) {
    error.value = err?.message || '加载对比数据失败';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadCompare();
});
</script>

<style scoped>
.compare-page {
  width: 100%;
  max-width: 1180px;
  height: 100%;
  min-width: 0;
  overflow: auto;
  box-sizing: border-box;
  padding: var(--space-5, 20px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 12px;
}

.page-title {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-title-lg, 24px);
}

.page-title .icon {
  color: var(--brand-primary, #10b981);
  margin-right: 10px;
}

.page-header p {
  margin: 6px 0 0;
  color: var(--text-secondary);
}

.back-link {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
}

.back-link:hover {
  color: var(--brand-primary, #10b981);
}

.state-wrapper {
  min-height: 320px;
  display: grid;
  place-items: center;
}

.compare-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-light, rgba(0, 0, 0, .08));
  border-radius: var(--radius-card, 12px);
  background: var(--surface);
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}

.compare-table th,
.compare-table td {
  padding: 12px 14px;
  font-size: 13px;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, .06));
  text-align: left;
  vertical-align: top;
}

.compare-table thead th {
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 1;
}

.field-col {
  color: var(--text-secondary);
  font-weight: 500;
  background: var(--background-secondary, rgba(0, 0, 0, .02));
  white-space: nowrap;
  min-width: 120px;
}

.config-col {
  color: var(--text-primary);
  min-width: 180px;
  word-break: break-word;
}

.config-head-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-head-cell strong {
  font-size: 14px;
}

.config-price {
  font-size: 12px;
  color: #e35b25;
}

.highlight-diff {
  color: var(--brand-primary, #10b981);
  font-weight: 600;
}
</style>