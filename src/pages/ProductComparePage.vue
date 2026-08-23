<template>
  <div class="compare-page page-container custom-scrollbar">
    <div v-if="loading" class="state-wrapper">
      <LoadingState text="正在加载配置对比数据..." />
    </div>

    <div v-else-if="error" class="state-wrapper">
      <ErrorState title="对比数据加载失败" :message="error" @retry="loadCompare" />
    </div>

    <div v-else-if="configs.length < 2" class="state-wrapper">
      <EmptyState title="至少需要两个配置" description="先选择机型，再到产品参数页勾选至少两个配置进行对比">
        <button type="button" class="primary-action" @click="router.push('/product-selector?mode=compare')">
          <i class="fas fa-mobile-screen-button"></i> 去选择机型
        </button>
      </EmptyState>
    </div>

    <div v-else class="compare-table-wrapper">
      <table class="compare-table">
        <thead>
          <tr>
            <th class="field-col">参数</th>
            <th v-for="(config, index) in configs" :key="String(config.id)" class="config-col">
              <div class="config-head-cell">
                <strong>{{ modelName(config, index) }}</strong>
                <span v-if="config.title" class="config-variant">{{ config.title }}</span>
                <span v-if="config.price" class="config-price">参考价 ¥{{ config.price }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in compareGroups" :key="group.key">
            <tr class="group-row">
              <th class="group-label" :colspan="configs.length + 1">{{ group.label }}</th>
            </tr>
            <tr v-for="field in group.fields" :key="field.name" class="compare-row">
              <th scope="row" class="field-col">{{ field.label }}</th>
              <td v-for="config in configs" :key="String(config.id)" class="config-col">
                <span :class="{ 'highlight-diff': isDifferent(field.name) }">
                  {{ fieldValue(config, field.name) || '—' }}
                </span>
              </td>
            </tr>
          </template>
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
const modelTitles = ref<Record<string, string>>({});
const loading = ref(false);
const error = ref('');

interface CompareField {
  name: string;
  label: string;
}

const baseFields: CompareField[] = [
  { name: 'release_time', label: '发布时间' },
  { name: 'cpu', label: '处理器' },
  { name: 'ram', label: '运行内存' },
  { name: 'phone_material', label: '机身材料' },
  { name: 'screen_material', label: '屏幕材质' },
  { name: 'keywords', label: '关键词' },
];

interface CompareGroup {
  key: string;
  label: string;
  fields: CompareField[];
}

const fieldLabels: Record<string, string> = {
  soc_model: 'SoC型号',
  screen_size: '屏幕尺寸',
  screen_shape: '屏幕形态',
  screen_resolution: '屏幕分辨率',
  screen_refresh_rate: '屏幕刷新率',
  ram_capacity: 'RAM容量',
  rom_capacity: 'ROM容量',
  battery_capacity: '电池容量',
  rear_camera: '后置摄像头',
  front_camera: '前置摄像头',
};

function labelForField(fieldName: string): string {
  return fieldLabels[fieldName] || fieldName.replace(/_/g, ' ');
}

function modelName(config: ProductConfig, index: number): string {
  return modelTitles.value[String(config.id)] || String(config.title || `配置 ${index + 1}`);
}

const compareGroups = computed<CompareGroup[]>(() => {
  const basicFields = baseFields.filter((field) =>
    configs.value.some((config) => rawFieldValue(config, field.name).trim()),
  );
  const groupedFields = new Map<string, CompareField[]>();
  const seen = new Set<string>(basicFields.map((field) => field.name));

  for (const config of configs.value) {
    const configGroups = parseProductConfigData(config.config_data);
    for (const [groupName, fields] of Object.entries(configGroups)) {
      for (const fieldName of Object.keys(fields)) {
        const key = `${groupName}.${fieldName}`;
        if (!seen.has(key)) {
          seen.add(key);
          const fieldsInGroup = groupedFields.get(groupName) || [];
          fieldsInGroup.push({ name: key, label: labelForField(fieldName) });
          groupedFields.set(groupName, fieldsInGroup);
        }
      }
    }
  }

  return [
    ...(basicFields.length > 0 ? [{ key: 'basic', label: '基础信息', fields: basicFields }] : []),
    ...Array.from(groupedFields.entries()).map(([key, fields]) => ({ key, label: key, fields })),
  ];
});

function rawFieldValue(config: ProductConfig, fieldName: string): string {
  if (fieldName.includes('.')) {
    const separatorIndex = fieldName.indexOf('.');
    const groupName = fieldName.slice(0, separatorIndex);
    const field = fieldName.slice(separatorIndex + 1);
    const configGroups = parseProductConfigData(config.config_data);
    return configGroups[groupName]?.[field] ?? '';
  }
  const value = config[fieldName];
  if (value === undefined || value === null) return '';
  return String(value);
}

function fieldValue(config: ProductConfig, fieldName: string): string {
  const value = rawFieldValue(config, fieldName).trim();
  if (!value) return '';
  if (fieldName === 'price') return `¥${value}`;
  if (fieldName === 'release_time' && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  }
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
  const productIds = String(route.query.productIds || '')
    .split(',')
    .map((id) => id.trim());
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
    const productIdByConfig = new Map<string, string>();
    loaded.forEach((config, index) => {
      const configProductId = config.product_id ?? config.productId ?? productIds[index];
      if (configProductId !== undefined && configProductId !== null && String(configProductId)) {
        productIdByConfig.set(String(config.id), String(configProductId));
      }
    });
    const productEntries = Array.from(productIdByConfig.entries());
    const detailResults = await Promise.allSettled(
      productEntries.map(([, productId]) => CoolapkTauriAPI.getProductDetail(productId)),
    );
    const titles: Record<string, string> = {};
    detailResults.forEach((result, index) => {
      if (result.status !== 'fulfilled' || !result.value?.data) return;
      const product = result.value.data as Record<string, unknown>;
      const title = product.title || product.index_title || product.alias_title || product.name;
      if (title) titles[productEntries[index][0]] = String(title);
    });
    modelTitles.value = titles;
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
  max-width: none;
  height: 100%;
  min-width: 0;
  overflow: auto;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--radius-control, 8px);
  background: var(--brand-primary);
  color: var(--text-inverse, #fff);
  font: inherit;
  font-size: var(--font-size-sub, 13px);
  cursor: pointer;
}

.primary-action:hover {
  background: var(--brand-primary-hover, var(--brand-primary));
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
  background: var(--surface-elevated, var(--surface));
  border-bottom: 2px solid var(--border);
  box-shadow: var(--shadow-dropdown);
  z-index: 1;
}

.group-row .group-label {
  padding: 9px 14px;
  color: var(--text-secondary);
  background: var(--background-secondary, rgba(0, 0, 0, .03));
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .02em;
}

.field-col {
  position: sticky;
  left: 0;
  color: var(--text-secondary);
  font-weight: 500;
  background: var(--background-secondary, rgba(0, 0, 0, .02));
  border-right: 2px solid var(--border);
  white-space: nowrap;
  min-width: 120px;
  z-index: 2;
}

.compare-table thead .field-col {
  background: var(--surface-elevated, var(--surface));
  z-index: 3;
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

.config-variant {
  color: var(--text-secondary);
  font-size: 12px;
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
