<template>
  <div class="sidebar-card">
    <div class="card-header">
      <h3 class="card-title"><i class="fas fa-user-plus icon-user"></i> 推荐酷友</h3>
    </div>
    <div class="user-list">
      <div v-for="user in users" :key="user.uid" class="user-item">
        <AppAvatar :src="user.avatar" size="sm" />
        <div class="user-info">
          <span class="user-name">{{ user.name }}</span>
          <span class="user-desc">{{ user.desc }}</span>
        </div>
        <AppButton variant="soft" size="sm">关注</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppAvatar from '../common/AppAvatar.vue';
import AppButton from '../common/AppButton.vue';

const users = ref([
  { uid: 1, name: '酷安小编', desc: '官方动态发布', avatar: '' },
  { uid: 2, name: '极客实验室', desc: '前沿数码评测', avatar: '' },
  { uid: 3, name: '桌面美化社', desc: '分享极简桌面', avatar: '' },
]);
</script>

<style scoped>
.sidebar-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  overflow: hidden;
  min-width: 0;
}

.card-header {
  margin-bottom: var(--space-3);
}

.card-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-user {
  color: var(--info);
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.user-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-desc {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
