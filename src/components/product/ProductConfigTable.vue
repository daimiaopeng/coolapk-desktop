<template>
  <div v-if="groups.length === 0" class="config-empty">
    <EmptyState title="暂无配置信息" description="该机型还没有公开的配置参数" />
  </div>

  <div v-else class="config-groups">
    <section v-for="group in groups" :key="group.title" class="config-group">
      <h4 class="group-title">{{ group.title }}</h4>
      <table class="config-table">
        <tbody>
          <tr v-for="row in group.rows" :key="row.name" class="config-row">
            <th scope="row" class="config-name">{{ row.name }}</th>
            <td class="config-value">{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EmptyState from '../common/EmptyState.vue';
import { parseProductConfigData, type ProductConfig } from '../../types/product';

const props = defineProps<{
  config: ProductConfig | null;
}>();

const groups = computed(() => {
  const config = props.config;
  if (!config) return [];
  const rawGroups = parseProductConfigData(config.config_data);
  return Object.entries(rawGroups).map(([title, fields]) => ({
    title,
    rows: Object.entries(fields).map(([name, value]) => ({ name, value })),
  }));
});
</script>

<style scoped>
.config-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.config-group {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}

.group-title {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-light);
}

.config-table {
  width: 100%;
  border-collapse: collapse;
}

.config-row {
  border-bottom: 1px solid var(--border-light);
}

.config-row:last-child {
  border-bottom: none;
}

.config-name {
  width: 38%;
  text-align: left;
  font-weight: var(--font-weight-regular);
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  padding: 8px 12px 8px 0;
  vertical-align: top;
}

.config-value {
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  padding: 8px 0;
  word-break: break-word;
}

.config-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
}
</style>